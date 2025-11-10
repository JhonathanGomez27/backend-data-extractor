import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from 'src/users/users.service';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {

    constructor(
        private users: UsersService,
        private jwt: JwtService,
        private config: ConfigService
    ) {  }

    async validateAdmin(email: string, password: string) {
        const user = await this.users.findByEmail(email);
        if (!user) return null;
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return null;
        return user;
    }

    async issueJwt(user: any) {
        const payload = { sub: user.id, email: user.email, role: user.role };
        const accessToken = this.jwt.sign(payload);
        
        // Crear refresh token manualmente con diferentes opciones
        const refreshToken = this.jwt.sign(payload, {
            secret: this.config.get<string>('jwt.refreshSecret'),
            expiresIn: this.config.get<string>('jwt.refreshExpiresIn'),
        } as any);

        // Guardar el hash del refresh token en la base de datos
        await this.users.updateRefreshToken(user.id, refreshToken);

        return { 
            access_token: accessToken,
            refresh_token: refreshToken,
            user: { id: user.id, name: user.name, email: user.email, role: user.role } 
        };
    }

    async refreshTokens(userId: string, refreshToken: string) {
        const user = await this.users.findById(userId);
        if (!user || !user.refreshToken) {
            throw new UnauthorizedException('Access Denied');
        }

        const refreshTokenMatches = await bcrypt.compare(refreshToken, user.refreshToken);
        if (!refreshTokenMatches) {
            throw new UnauthorizedException('Access Denied');
        }

        const payload = { sub: user.id, email: user.email, role: user.role };
        const accessToken = this.jwt.sign(payload);
        const newRefreshToken = this.jwt.sign(payload, {
            secret: this.config.get<string>('jwt.refreshSecret'),
            expiresIn: this.config.get<string>('jwt.refreshExpiresIn'),
        } as any);

        // Actualizar el refresh token en la base de datos
        await this.users.updateRefreshToken(user.id, newRefreshToken);

        return {
            access_token: accessToken,
            refresh_token: newRefreshToken,
            user: { id: user.id, name: user.name, email: user.email, role: user.role }
        };
    }

    async logout(userId: string) {
        await this.users.updateRefreshToken(userId, null);
    }

    // Opcional: verificar o decodificar manualmente
    verifyToken(token: string) {
        return this.jwt.verify(token);
    }

    decodeToken(token: string) {
        return this.jwt.decode(token);
    }
}
