import { Inject, Injectable } from '@nestjs/common';
import { ClientEntity } from './client.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class ClientsService {

    constructor(
        @InjectRepository(ClientEntity) private clientRepo: Repository<ClientEntity>
    ) {  }

    async findByBasicUsername(username: string): Promise<ClientEntity | null> {
        return this.clientRepo.findOne({ where: { basicUsername: username } });
    }
}
