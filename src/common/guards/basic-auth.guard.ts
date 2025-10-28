import { AuthGuard } from '@nestjs/passport';
export class BasicAuthGuard extends AuthGuard('client-basic') {}
