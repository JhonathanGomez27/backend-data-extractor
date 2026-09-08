import { IsNotEmpty, IsString, IsUUID, IsOptional, IsObject, IsIn } from 'class-validator';

export class CreateModelDto {
  @IsString() @IsNotEmpty() name: string;

  @IsOptional() @IsString() description?: string;
  
  @IsUUID() modelTypeId: string;

  @IsUUID() clientId: string;

  @IsOptional() @IsObject() data?: Record<string, any>;

  @IsOptional() @IsIn(['openai', 'gemini', 'claude']) provider?: 'openai' | 'gemini' | 'claude';

  @IsOptional() @IsString() aiModel?: string;

  @IsOptional() @IsString() status?: 'active' | 'inactive'; 
}
