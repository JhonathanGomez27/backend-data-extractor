import { Type } from "class-transformer";
import { IsNumber, IsOptional, IsString, IsUUID, Min } from "class-validator";

export class PaginatorDto {

    @Type(() => Number)
    @IsNumber()
    @IsOptional()
    @Min(1)
    page?: number;

    @Type(() => Number)
    @IsNumber()
    @IsOptional()
    @Min(1)
    limit?: number;

    @IsString()
    @IsOptional()
    searchText?: string;

    @IsUUID()
    @IsOptional()
    clientId?: string;
}