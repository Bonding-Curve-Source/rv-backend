import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import type { JwtPayload } from './auth.interface.js';
import { UserService, type UserReq } from '../user/index.js';
import { verifyMessage } from 'ethers';
import type { LoginDTO } from './dto/login.dto.js';
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private jwt: JwtService,
    private user: UserService,
  ) {}

  public prepareSigningMessage(nonce: string) {
    return `Please sign this message to verify your address. Nonce: ${nonce}`;
  }

  public async validateAccessToken(token: string) {
    const decoded = await this.jwt.verifyAsync<UserReq>(token);
    return decoded;
  }

  public generateToken(payload: JwtPayload) {
    return this.jwt.signAsync(payload);
  }

  public async login(data: LoginDTO) {
    const { walletAddress, signature } = data;
    this.logger.log(`Login request received for wallet: ${walletAddress}`);
    const user = await this.user.getUserByWalletAddress(walletAddress.toLowerCase());
    this.logger.log(`User found: ${user ? 'Yes' : 'No'}`);
    if (!user || !user.nonce) {
      throw new UnauthorizedException('User not found!');
    }
    let isFirstTimeLogin = false;
    try {
      const message = this.prepareSigningMessage(user.nonce);
      const address = verifyMessage(message, signature);
      const isValid = walletAddress.toLowerCase() === address.toLowerCase();
      if (!isValid) {
        throw new UnauthorizedException('Signature is invalid');
      }
    } catch (error) {
      throw new UnauthorizedException('Signature is invalid');
    }

    const updatedUser = await this.user.loginSuccess(user.id);

    const payload: JwtPayload = { sub: user.id, walletAddress: user.walletAddress };

    return {
      accessToken: await this.generateToken(payload),
      user: updatedUser,
      isFirstTimeLogin,
    };
  }
}
