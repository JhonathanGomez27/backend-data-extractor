import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModelTypeEntity } from './model-type.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([ModelTypeEntity]),
    ],
    controllers: [],
    providers: [],
    exports: []
})
export class ModelTypesModule {}
