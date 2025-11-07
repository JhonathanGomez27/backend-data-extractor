import { Controller, Post, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @UseGuards(AuthGuard('admin-local'))
  @Post('login')
  async login(@Request() req) {
    return this.auth.issueJwt(req.user); // { access_token, user }
  }
}
