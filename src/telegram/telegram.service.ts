import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf } from 'telegraf';

export interface TelegramAlertOptions {
  title?: string;
  message?: string;
  error?: Error | unknown;
  extra?: Record<string, any>;
  level?: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
}

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private bot: Telegraf | null = null;
  private readonly token: string;
  private readonly chatId: string;

  constructor(private readonly configService: ConfigService) {
    this.token = this.configService.get<string>('telegram.botToken');
    this.chatId = this.configService.get<string>('telegram.chatId');
  }

  /**
   * Obtiene la instancia del bot de Telegram (singleton)
   */
  private getBot(): Telegraf {
    if (!this.token) {
      throw new Error('Missing TELEGRAM_BOT_TOKEN in configuration');
    }
    if (!this.bot) {
      this.bot = new Telegraf(this.token);
    }
    return this.bot;
  }

  /**
   * Convierte un objeto a JSON de forma segura con límite de longitud
   */
  private safeJson(obj: any, maxLen: number = 1500): string {
    try {
      const s = JSON.stringify(obj, null, 2);
      return s.length > maxLen ? s.slice(0, maxLen) + '\n…(truncado)' : s;
    } catch {
      return String(obj);
    }
  }

  /**
   * Envía una alerta formateada a Telegram
   */
  async sendTelegramAlert(options: TelegramAlertOptions = {}): Promise<void> {
    const {
      title = 'API Error',
      message,
      error,
      extra,
      level = 'ERROR',
    } = options;

    // Si no hay token o chatId configurados, salir silenciosamente (útil en desarrollo)
    if (!this.token || !this.chatId) {
      this.logger.warn('Telegram not configured, skipping alert');
      return;
    }

    // Formatear el mensaje con Markdown
    const text = `🚨 *${level}* — *${title}*
🕒 ${new Date().toISOString()}

*Mensaje:*
${message ? `\`${String(message).slice(0, 3500)}\`` : '_(sin mensaje)_'}

${error ? `*Error:*\n\`${this.getErrorMessage(error).slice(0, 3500)}\`\n` : ''}${extra ? `*Extra:*\n\`\`\`\n${this.safeJson(extra)}\n\`\`\`\n` : ''}`;

    try {
      const bot = this.getBot();
      await bot.telegram.sendMessage(this.chatId, text, {
        parse_mode: 'Markdown',
        // disable_web_page_preview: true,
      });
    } catch (e) {
      // Evitar loops si Telegram falla
      this.logger.error(`Failed to send Telegram alert`);
    }
  }

  /**
   * Extrae el mensaje de error de forma segura
   */
  private getErrorMessage(error: Error | unknown): string {
    if (error instanceof Error) {
      return error.stack || error.message;
    }
    return String(error);
  }

  /**
   * Método auxiliar para enviar mensajes simples
   */
  async sendMessage(text: string): Promise<void> {
    if (!this.token || !this.chatId) {
      this.logger.warn('Telegram not configured, skipping message');
      return;
    }

    try {
      const bot = this.getBot();
      await bot.telegram.sendMessage(this.chatId, text, {
        parse_mode: 'Markdown',
      });
    } catch (e) {
      this.logger.error(`Failed to send Telegram message` );
    }
  }
}
