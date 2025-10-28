import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ClientsService } from './clients.service';
import { createClientDto } from './dto/create-client.dto';
import { PaginatorDto } from 'src/common/paginator/paginator.dto';

@UseGuards(JwtAuthGuard)
@Controller('admin/clients')
export class ClientsController {

    constructor(private service: ClientsService) { }

    @Post()
    async createClient(
        @Body() dto: createClientDto
    ) {
        return this.service.create(dto);
    }

    @Get()
    async getClients(
        @Query() paginator: PaginatorDto
    ) {
        return this.service.findAll(paginator);
    }

    @Get(':id')
    async getClientById(
        @Param('id') id: string
    ) {
        return this.service.findById(id);
    }

    @Patch(':id/reset-basic')
    async resetClientBasicInfo(
        @Param('id') id: string
    ) {
        return this.service.rotateBasicPassword(id);
    }

}
