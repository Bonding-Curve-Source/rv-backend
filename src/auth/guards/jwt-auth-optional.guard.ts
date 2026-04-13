import { Injectable, type ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthOptionalGuard extends AuthGuard('jwt') {
  override handleRequest<TUser = any>(_err: any, user: any, _info: any, _context: ExecutionContext, _status?: any): TUser {
    return user;
  }
}
