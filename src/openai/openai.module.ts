import { Module } from '@nestjs/common';
import { OpenaiService } from './openai.service';
import { OpenaiController } from './openai.controller';
import { ConfigModule } from '@nestjs/config';
import { TelegramModule } from 'src/telegram/telegram.module';

@Module({
  imports: [
    ConfigModule,
    TelegramModule
  ],
  controllers: [OpenaiController],
  providers: [OpenaiService],
  exports: [OpenaiService],
})
export class OpenaiModule {}
