import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';

import { UserService } from './user.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
// import { ReqUser } from '../common/decorators/req-user.decorator.js';
import type { UserReq } from './user.interface.js';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AddRefCodeDto } from './dto/update-user.dto.js';

/**
 * https://docs.nestjs.com/recipes/terminus
 */
@ApiBearerAuth()
@ApiTags('User Me')
@UseGuards(JwtAuthGuard)
@Controller('users/me')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // @Get()
  // @ApiOperation({ summary: 'Thông tin user hiện tại' })
  // public getMe(@ReqUser() user: UserReq) {
  //   return this.userService.getUserById(user.id);
  // }
}
