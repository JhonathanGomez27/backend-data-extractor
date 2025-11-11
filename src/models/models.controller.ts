import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ModelsService } from './models.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CreateModelDto } from './dto/create-model.dto';
import { BasicAuthGuard } from 'src/common/guards/basic-auth.guard';
import { PaginatorDto } from 'src/common/paginator/paginator.dto';

@Controller('models')
export class ModelsController {
    constructor(private service: ModelsService) {}

    // ADMIN
    @UseGuards(JwtAuthGuard)
    @Post('')
    create(@Body() dto: CreateModelDto) { return this.service.create(dto); }

    //Get all models with pagination
    @UseGuards(JwtAuthGuard)
    @Get('')
    listModels(@Query() paginator: PaginatorDto) { return this.service.listModels(paginator); }
    

    // @UseGuards(JwtAuthGuard)
    // @Get('admin/models')
    // listAdmin(@Query('clientId') clientId?: string) { return this.service.listAdmin({ clientId }); }

    // CLIENT (Basic)
    @UseGuards(BasicAuthGuard)
    @Get('client/models')
    listClient(@Query() paginator: PaginatorDto) {
        // req.user.clientId viene del BasicStrategy
        return this.service.listForClient(paginator);
    }

    @UseGuards(JwtAuthGuard)
    @Get(':id')
    getClient(@Param('id') id: string) {
        return this.service.getForClient(id); // valida ownership dentro del service
    }

    @UseGuards(BasicAuthGuard)
    @Post('client/extract')
    extractModelForClient(
        @Body() dto: { transcripcion: any, config_global?: Record<string, any> },
        @Query() query: Record<string, any>
    ) {
        return this.service.extractModelForClient(dto.transcripcion, dto.config_global, query);
    }
}
