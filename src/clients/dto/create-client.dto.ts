import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class createClientDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() imageUrl?: string;

  // credenciales iniciales para Basic
  @IsString() @MinLength(4) basicUsername: string;
  @IsString() @MinLength(8) basicPassword: string;
}
