import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from 'src/users/users.module';
import { ClientsModule } from 'src/clients/clients.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LocalStrategy } from './admin/local.strategy';
import { JwtStrategy } from './admin/jwt.strategy';
import { JwtRefreshStrategy } from './admin/jwt-refresh.strategy';
import { BasicStrategy } from 'src/clients/basic.strategy';
import { ClientsService } from 'src/clients/clients.service';

@Module({
  imports: [
    UsersModule,
    ClientsModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        signOptions: { expiresIn: config.get('jwt.expiresIn') },
      }),
    }),
    ConfigModule
  ],
  providers: [AuthService, LocalStrategy, JwtStrategy, JwtRefreshStrategy, BasicStrategy],
  controllers: [AuthController],
  exports: [JwtModule]
})
export class AuthModule {}
