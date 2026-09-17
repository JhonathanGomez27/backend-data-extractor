import { IsIn, IsOptional, IsString } from 'class-validator';

export class BulkUpdateAiDto {
  @IsString()
  @IsIn(['openai', 'gemini', 'claude', 'inherit'])
  provider: 'openai' | 'gemini' | 'claude' | 'inherit';

  @IsString()
  @IsOptional()
  aiModel?: string;
}
