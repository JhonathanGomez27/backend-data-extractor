import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateClientAiDto {
  @IsString()
  @IsIn(['openai', 'gemini', 'claude'])
  provider: 'openai' | 'gemini' | 'claude';

  @IsString()
  @IsOptional()
  aiModel?: string;
}
