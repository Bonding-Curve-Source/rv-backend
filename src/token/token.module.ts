import { Module } from '@nestjs/common';
import { TokenController } from './token.controller';
import { TokenEventService } from './token.event.service';
import { TokenService } from './token.service';

@Module({
  controllers: [TokenController],
  providers: [TokenService, TokenEventService],
  exports: [TokenService],
})
export class TokenModule {}
