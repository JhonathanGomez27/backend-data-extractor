import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { OpenaiService } from './openai.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';


@Controller('openai')
export class OpenaiController {

  constructor(
    private readonly openaiService: OpenaiService
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('generate-template')
  async generateText(
    @Body() body: { goal: string, details?: Record<string, any> }
  ) {
    return this.openaiService.generateTemplates(body.goal, body.details);
  }
} 
