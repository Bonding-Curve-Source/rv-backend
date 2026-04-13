import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { ValidateTokenCommand } from '../commands/validate-token.command.js';
import { JwtService } from '@nestjs/jwt';
import { type JwtPayload } from '../auth.interface.js';

@CommandHandler(ValidateTokenCommand)
export class ValidateTokenHandler implements ICommandHandler<ValidateTokenCommand> {
  constructor(private jwt: JwtService) {}

  async execute(command: ValidateTokenCommand) {
    const { token } = command;
    try {
      const decoded = await this.jwt.verifyAsync<JwtPayload>(token);
      return {
        id: decoded.sub,
        walletAddress: decoded.walletAddress,
      };
    } catch (error) {
      throw new Error('Invalid token');
    }
  }
}
