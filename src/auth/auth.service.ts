import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from 'src/users/users.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {

    constructor(
        private users: UsersService,
        private jwt: JwtService
    ) {  }

    async validateAdmin(email: string, password: string) {
        const user = await this.users.findByEmail(email);
        if (!user) return null;
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return null;
        return user;
    }

    issueJwt(user: any) {
        const payload = { sub: user.id, email: user.email, role: user.role };
        return { access_token: this.jwt.sign(payload), user: { id: user.id, email: user.email, role: user.role } };
    }
}
