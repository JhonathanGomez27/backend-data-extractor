import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ModelsService } from './models.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CreateModelDto } from './dto/create-model.dto';
import { BulkUpdateAiDto } from './dto/bulk-update-ai.dto';
import { BasicAuthGuard } from 'src/common/guards/basic-auth.guard';
import { PaginatorDto } from 'src/common/paginator/paginator.dto';

@Controller('models')
export class ModelsController {
  constructor(private service: ModelsService) { }

  // ADMIN
  @UseGuards(JwtAuthGuard)
  @Post('')
  create(@Body() dto: CreateModelDto) {
    return this.service.create(dto);
  }

  //   Put editar

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  updateModel(@Param('id') id: string, @Body() dto: CreateModelDto) {
    return this.service.updateModel(id, dto);
  }

  // Bulk update AI configuration for all models of a client
  @UseGuards(JwtAuthGuard)
  @Patch('client/:clientId/bulk-ai-config')
  bulkUpdateClientModels(
    @Param('clientId') clientId: string,
    @Body() dto: BulkUpdateAiDto,
  ) {
    return this.service.bulkUpdateAiConfigForClient(clientId, dto);
  }

  //Get all models with pagination
  @UseGuards(JwtAuthGuard)
  @Get('')
  listModels(@Query() paginator: PaginatorDto) {
    return this.service.listModels(paginator);
  }

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
  @Get('ai-providers')
  getAiProviders() {
    return this.service.getAiProviders();
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  getClient(@Param('id') id: string) {
    return this.service.getForClient(id); // valida ownership dentro del service
  }

  @UseGuards(BasicAuthGuard)
  @Post('client/extract')
  extractModelForClient(
    @Body() dto: { transcripcion: any; audio_source_value?: string },
  ) {
    return this.service.extractModelForClient(
      dto.transcripcion,
      dto.audio_source_value
    );
  }
}
