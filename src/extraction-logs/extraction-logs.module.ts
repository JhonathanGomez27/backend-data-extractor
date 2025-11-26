import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExtractionLogEntity } from './extraction-log.entity';
import { ExtractionLogsService } from './extraction-logs.service';
import { ExtractionLogsController } from './extraction-logs.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ExtractionLogEntity])],
  controllers: [ExtractionLogsController],
  providers: [ExtractionLogsService],
  exports: [ExtractionLogsService],
})
export class ExtractionLogsModule {}
