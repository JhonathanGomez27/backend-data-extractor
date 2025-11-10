import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserEntity } from './user.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {

    constructor(
        @InjectRepository(UserEntity) private userRepo: Repository<UserEntity>
    ) {  }

    
    async create(data: Partial<UserEntity>): Promise<UserEntity> {
        const user = this.userRepo.create(data);
        return this.userRepo.save(user);
    }

    async findByEmail(email: string): Promise<UserEntity | null> {
        return this.userRepo.findOne({ where: { email } });
    }

    async findById(id: string): Promise<UserEntity | null> {
        return this.userRepo.findOne({ where: { id } });
    }

    async updateRefreshToken(userId: string, refreshToken: string | null): Promise<void> {
        const hashedToken = refreshToken ? await bcrypt.hash(refreshToken, 10) : null;
        await this.userRepo.update(userId, { refreshToken: hashedToken });
    }
}
