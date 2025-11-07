import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ModelTypesService } from './model-types.service';
import { CreateModelTypeDto } from './dto/create-model-type.dto';
import { PaginatorDto } from 'src/common/paginator/paginator.dto';

@UseGuards(JwtAuthGuard)
@Controller('model-types')
export class ModelTypesController {
  constructor(private service: ModelTypesService) {}

  @Post()
  create(@Body() dto: CreateModelTypeDto) {
    return this.service.create(dto);
  }

  @Get()
  list(
    @Query() paginator: PaginatorDto
) {
    // global + específicos si pasa clientId
    return this.service.findAll(paginator, paginator.clientId);
  }
}
