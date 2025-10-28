import { BasicStrategy as HttpBasicStrategy } from 'passport-http';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { ClientsService } from './clients.service';

@Injectable()
export class BasicStrategy extends PassportStrategy(HttpBasicStrategy, 'client-basic') {
  constructor(private clients: ClientsService) { super(); }

  async validate(username: string, password: string) {
    const client = await this.clients.findByBasicUsername(username);
    if (!client) throw new UnauthorizedException();
    const ok = await bcrypt.compare(password, client.basicPasswordHash);
    if (!ok) throw new UnauthorizedException();
    // retornamos un payload mínimo para req.user
    return { clientId: client.id, name: client.name };
  }
}
