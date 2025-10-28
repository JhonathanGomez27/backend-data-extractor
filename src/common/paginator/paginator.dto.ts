import { IsNumber, IsOptional, IsString } from "class-validator";

export class PaginatorDto {

    @IsNumber()
    page: number;

    @IsNumber()
    limit: number;

    @IsString()
    @IsOptional()
    searchText?: string;
}