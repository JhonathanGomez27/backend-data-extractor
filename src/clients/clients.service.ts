import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ClientEntity } from './client.entity';
import { Like, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { createClientDto } from './dto/create-client.dto';
import * as bcrypt from 'bcrypt';
import { PaginatorDto } from 'src/common/paginator/paginator.dto';
@Injectable()
export class ClientsService {

    constructor(
        @InjectRepository(ClientEntity) private clientRepo: Repository<ClientEntity>
    ) {  }

    async create(dto: createClientDto) {
        const exists = await this.clientRepo.findOne({ where: { name: dto.name } });
        if (exists) throw new ConflictException('Client already exists');

        const basicPasswordHash = await bcrypt.hash(dto.basicPassword, 12);
        const client = this.clientRepo.create({
            name: dto.name,
            description: dto.description,
            imageUrl: dto.imageUrl,
            basicUsername: dto.basicUsername,
            basicPasswordHash
        });
        return this.clientRepo.save(client);
    }

    async findByBasicUsername(username: string): Promise<ClientEntity | null> {
        return this.clientRepo.findOne({ where: { basicUsername: username } });
    }

    async findAll(paginator: PaginatorDto): Promise<{ data: ClientEntity[]; total: number }> {
        const skip = (paginator.page - 1) * paginator.limit;

        const clients = await this.clientRepo.findAndCount({
            skip,
            take: paginator.limit,
            where: {
                ...(paginator.searchText && {
                    name: Like(`%${paginator.searchText}%`)
                })
            }
        });

        return {
            data: clients[0],
            total: clients[1]
        }
    }

    async findById(id: string): Promise<ClientEntity | null> {
        return this.clientRepo.findOne({ where: { id } });
    }

    async rotateBasicPassword(id: string): Promise<{ username: string; password: string }> {
        const client = await this.findById(id);
        if (!client) throw new NotFoundException('Client not found');

        const newPass =crypto.randomUUID();
        client.basicPasswordHash = await bcrypt.hash(newPass, 12);

        await this.clientRepo.save(client);

        return { username: client.basicUsername, password: newPass }
    }


}
