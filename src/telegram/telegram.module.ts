import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TelegramService } from './telegram.service';

@Module({
  imports: [ConfigModule],
  providers: [TelegramService],
  controllers: [],
  exports: [TelegramService],
})
export class TelegramModule {}
