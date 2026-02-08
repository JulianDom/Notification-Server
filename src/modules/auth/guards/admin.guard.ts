import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class AdminGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err: Error | null, user: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('Invalid or expired admin token');
    }
    return user;
  }
}
