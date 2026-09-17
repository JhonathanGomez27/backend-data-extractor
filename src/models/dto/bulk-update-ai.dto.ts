import { IsIn, IsOptional, IsString } from 'class-validator';

export class BulkUpdateAiDto {
  @IsString()
  @IsIn(['openai', 'gemini', 'claude', 'deepseek', 'inherit'])
  provider: 'openai' | 'gemini' | 'claude' | 'deepseek' | 'inherit';

  @IsString()
  @IsOptional()
  aiModel?: string;
}
