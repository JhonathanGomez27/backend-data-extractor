import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModelEntity } from './model.entity';
import { ModelsController } from './models.controller';
import { ModelsService } from './models.service';
import { OpenaiModule } from 'src/openai/openai.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([ModelEntity]),
        OpenaiModule
    ],
    controllers: [ModelsController],
    providers: [ModelsService],
    exports: []
})
export class ModelsModule { }
