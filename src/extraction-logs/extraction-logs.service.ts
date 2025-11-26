import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExtractionLogEntity } from './extraction-log.entity';

export interface CreateExtractionLogDto {
  clientId: string;
  modelsUsed: { id: string; name: string; description: string }[];
  transcriptionSize: number;
  durationMs: number;
  status: 'success' | 'error' | 'partial';
  errorMessage?: string;
  metadata?: Record<string, any>;
  response?: Record<string, any>;
}

@Injectable()
export class ExtractionLogsService {
  constructor(
    @InjectRepository(ExtractionLogEntity)
    private readonly logRepo: Repository<ExtractionLogEntity>,
  ) {}

  async createLog(dto: CreateExtractionLogDto): Promise<ExtractionLogEntity> {
    const log = this.logRepo.create(dto);
    return this.logRepo.save(log);
  }

  async findByClient(clientId: string, limit = 100): Promise<ExtractionLogEntity[]> {
    return this.logRepo.find({
      where: { clientId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getStats(clientId: string): Promise<{
    totalExtractions: number;
    successCount: number;
    errorCount: number;
    avgDurationMs: number;
  }> {
    const logs = await this.logRepo.find({ where: { clientId } });
    
    const totalExtractions = logs.length;
    const successCount = logs.filter((l) => l.status === 'success').length;
    const errorCount = logs.filter((l) => l.status === 'error').length;
    const avgDurationMs = logs.length > 0
      ? logs.reduce((sum, l) => sum + (l.durationMs || 0), 0) / logs.length
      : 0;

    return { totalExtractions, successCount, errorCount, avgDurationMs };
  }
}
