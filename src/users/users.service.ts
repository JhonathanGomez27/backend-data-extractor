import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserEntity } from './user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class UsersService {

    constructor(
        @InjectRepository(UserEntity) private userRepo: Repository<UserEntity>
    ) {  }

    async findByEmail(email: string): Promise<UserEntity | null> {
        return this.userRepo.findOne({ where: { email } });
    }
}
