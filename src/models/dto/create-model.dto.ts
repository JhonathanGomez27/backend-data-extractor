import { IsNotEmpty, IsString, IsUUID, IsOptional, IsObject } from 'class-validator';

export class CreateModelDto {
  @IsString() @IsNotEmpty() name: string;
  
  @IsUUID() modelTypeId: string;

  @IsUUID() clientId: string;

  @IsOptional() @IsObject() data?: Record<string, any>;
}
