import { Injectable } from '@nestjs/common';
import { ModelTypeEntity } from './model-type.entity';
import { IsNull, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateModelTypeDto } from './dto/create-model-type.dto';
import { PaginatorDto } from 'src/common/paginator/paginator.dto';

@Injectable()
export class ModelTypesService {

    constructor(@InjectRepository(ModelTypeEntity) private repo: Repository<ModelTypeEntity>) { }

    async create(dto: CreateModelTypeDto): Promise<ModelTypeEntity> {
        const modelType = this.repo.create(dto);
        return this.repo.save(modelType);
    }

    async findAll(paginator: PaginatorDto, clientId?: string): Promise<{ data: ModelTypeEntity[]; total: number }> {
        const skip = (paginator.page - 1) * paginator.limit || 0;
        const limit = paginator.limit || 10;

        if (!clientId) {
            const [data, total] = await this.repo.findAndCount({
                skip,
                take: limit,
                where: { clientId: IsNull() },
            });
            return { data, total };
        }

        const [data, total] = await this.repo.findAndCount({
            skip,
            take: paginator.limit,
            where: { clientId: clientId },
        });
        return { data, total };
    }

    async listAll(): Promise<ModelTypeEntity[]> {
        return this.repo.find();
    }
}
