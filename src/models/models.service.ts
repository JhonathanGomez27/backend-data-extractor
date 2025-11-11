import { Inject, Injectable, NotFoundException, Scope } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ModelEntity } from './model.entity';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { REQUEST as REQ } from '@nestjs/core';
import { CreateModelDto } from './dto/create-model.dto';
import { PaginatorDto } from 'src/common/paginator/paginator.dto';

@Injectable({ scope: Scope.REQUEST })
export class ModelsService {

    constructor(
        @InjectRepository(ModelEntity) private repo: Repository<ModelEntity>,
        @Inject(REQ) private request: any,
    ) { }

    create(dto: CreateModelDto) {
        // Solo admin (JWT) llega aquí
        return this.repo.save(this.repo.create(dto));
    }

    async listModels(paginatorDto: PaginatorDto) {
        const where: FindOptionsWhere<ModelEntity> = {};
        if (paginatorDto.clientId) where.clientId = paginatorDto.clientId;

        const { page = 1, limit = 10, searchText } = paginatorDto;
        if (searchText) (where as any).name = ILike(`%${searchText}%`);

        const [items, total] = await this.repo.findAndCount({
            where,
            order: { createdAt: 'DESC' },
            take: limit,
            skip: (page - 1) * limit,
        });

        return {
            data: items,
            total,
            page,
            limit,
        };
    }

    async listAdmin({ clientId }: { clientId?: string }) {
        const where: FindOptionsWhere<ModelEntity> = {};
        if (clientId) where.clientId = clientId;
        return this.repo.find({ where, order: { createdAt: 'DESC' } });
    }

    async listForClient({ modelTypeId, search, limit, offset, sort, fields }:
        { modelTypeId?: string; search?: string; limit: number; offset: number; sort: string; fields?: string; }) {

        const clientId = this.request.user?.clientId as string;
        const where: FindOptionsWhere<ModelEntity> = { clientId };
        if (modelTypeId) where.modelTypeId = modelTypeId;
        if (search) (where as any).name = ILike(`%${search}%`);

        const [sortField, sortDir] = (sort?.split(':') ?? ['createdAt','DESC']);
        const select = fields ? (['id','name','clientId','modelTypeId','createdAt','updatedAt', ...fields.split(',')]) : undefined;

        const [rows, total] = await this.repo.findAndCount({
        where, order: { [sortField]: (sortDir?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC') as any },
        take: limit, skip: offset, ...(select ? { select: Array.from(new Set(select)) as any } : {})
        });

        return { total, limit, offset, items: rows };
    }

    async getForClient(id: string) {
        const clientId = this.request.user?.clientId as string;
        const m = await this.repo.findOne({ where: { id, clientId } });
        if (!m) throw new NotFoundException();
        return m;
    }
}
