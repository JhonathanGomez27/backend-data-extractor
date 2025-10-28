import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModelTypeEntity } from './model-type.entity';
import { ModelTypesController } from './model-types.controller';
import { ModelTypesService } from './model-types.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([ModelTypeEntity]),
    ],
    controllers: [ModelTypesController],
    providers: [ModelTypesService],
    exports: []
})
export class ModelTypesModule {}
