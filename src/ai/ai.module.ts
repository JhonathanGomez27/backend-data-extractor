import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiService } from './ai.service';
import { OpenaiProvider } from './providers/openai.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { ClaudeProvider } from './providers/claude.provider';

@Module({
  imports: [ConfigModule],
  providers: [AiService, OpenaiProvider, GeminiProvider, ClaudeProvider],
  exports: [AiService, OpenaiProvider, GeminiProvider, ClaudeProvider],
})
export class AiModule {}
