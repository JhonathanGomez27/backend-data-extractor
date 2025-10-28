import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModelEntity } from './model.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([ModelEntity]),
    ],
    controllers: [],
    providers: [],
    exports: []
})
export class ModelsModule {}
