import { Command } from '@nestjs/cqrs';
import type { UserReq } from '../../user/user.interface.js';

export class ValidateTokenCommand extends Command<UserReq> {
  constructor(public readonly token: string) {
    super();
  }
}
