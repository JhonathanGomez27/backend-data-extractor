import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateClientAiDto {
  @IsString()
  @IsIn(['openai', 'gemini', 'claude', 'deepseek'])
  provider: 'openai' | 'gemini' | 'claude' | 'deepseek';

  @IsString()
  @IsOptional()
  aiModel?: string;

  @IsString()
  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  reasoningEffort?: 'low' | 'medium' | 'high';
}
