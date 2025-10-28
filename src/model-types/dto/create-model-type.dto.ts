import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateModelTypeDto {
  @IsString() @IsNotEmpty() name: string;

  @IsString() @IsOptional() description?: string;
  
  @IsUUID() @IsOptional() clientId?: string; // omitido => global
}
