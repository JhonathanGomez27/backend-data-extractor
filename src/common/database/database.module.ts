import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
    imports: [
        TypeOrmModule.forRootAsync({
            inject: [ConfigService],
            useFactory: async (configService: ConfigService) => ({
                type: 'postgres',
                host: configService.get('db.host'),
                port: configService.get('db.port'),
                username: configService.get('db.user'),
                password: configService.get('db.password'),
                database: configService.get('db.database'),
                autoLoadEntities: true,
                synchronize: false,
            }),
        })
    ],
    exports: [TypeOrmModule],
})
export class DatabaseModule {
    private readonly logger = new Logger(DatabaseModule.name);

    constructor() {
        this.logger.log('DatabaseModule initialized');
    }
}
