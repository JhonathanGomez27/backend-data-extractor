import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ExtractionLogsService } from './extraction-logs.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { BasicAuthGuard } from 'src/common/guards/basic-auth.guard';

@Controller('extraction-logs')
export class ExtractionLogsController {
  constructor(private readonly logsService: ExtractionLogsService) {}

  // Admin endpoint - get logs for any client
  @UseGuards(JwtAuthGuard)
  @Get('admin')
  async getLogsAdmin(
    @Query('clientId') clientId: string,
    @Query('limit') limit?: number,
  ) {
    return this.logsService.findByClient(clientId, limit);
  }

  // Admin endpoint - get stats for any client
  @UseGuards(JwtAuthGuard)
  @Get('admin/stats')
  async getStatsAdmin(@Query('clientId') clientId: string) {
    return this.logsService.getStats(clientId);
  }

  // Client endpoint - get own logs (using Basic Auth)
  @UseGuards(BasicAuthGuard)
  @Get('client/logs')
  async getLogsClient(@Query('limit') limit?: number) {
    // clientId viene del BasicStrategy
    const clientId = 'from-request'; // Implementar según tu estrategia
    return this.logsService.findByClient(clientId, limit);
  }

  // Client endpoint - get own stats
  @UseGuards(BasicAuthGuard)
  @Get('client/stats')
  async getStatsClient() {
    const clientId = 'from-request'; // Implementar según tu estrategia
    return this.logsService.getStats(clientId);
  }
}
