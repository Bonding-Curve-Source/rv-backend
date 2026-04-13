import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { AuthService } from './auth.service.js';
import { LoginDTO } from './dto/login.dto.js';
import { NonceQueryDTO } from './dto/nonce-query.dto.js';
import { UserService } from '../user/user.service.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private user: UserService,
  ) {}

  @Post('login')
  @ApiOperation({ summary: 'Đăng nhập bằng ví (chữ ký)' })
  public login(@Body() data: LoginDTO) {
    return this.auth.login(data);
  }

  @Get('nonce')
  @ApiOperation({ summary: 'Lấy nonce và message cần ký' })
  public async getNonce(@Query() query: NonceQueryDTO) {
    const nonce = await this.user.getNonce(query.walletAddress);
    const message = this.auth.prepareSigningMessage(nonce as string);
    return {
      nonce,
      message,
    };
  }
}
