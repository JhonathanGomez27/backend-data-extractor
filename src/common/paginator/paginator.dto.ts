import { IsNumber, IsOptional, IsString, IsUUID } from "class-validator";

export class PaginatorDto {

    @IsNumber()
    page: number;

    @IsNumber()
    limit: number;

    @IsString()
    @IsOptional()
    searchText?: string;

    @IsUUID()
    @IsOptional()
    clientId?: string;
}