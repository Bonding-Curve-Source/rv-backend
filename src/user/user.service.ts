import { Injectable, Logger } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { PrismaService } from 'nestjs-prisma';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  constructor(
    private readonly prismaService: PrismaService,
  ) {}

  public async getNonce(walletAddress: string) {
    const nonce = this.randomNonce();

    const user = await this.prismaService.user.upsert({
      where: {
        walletAddress,
      },
      update: { nonce: nonce },
      create: {
        walletAddress,
        nonce,
      },
    });

    return user.nonce;
  }

  public async loginSuccess(userId: number) {
    const user = await this.prismaService.user.update({
      where: {
        id: userId,
      },
      data: {
        nonce: null
      },
    });

    return user;
  }

  private randomNonce() {
    const nonce = Math.floor(Math.random() * 900000) + 100000;
    return nonce.toString();
  }

  public getUserById(userId: number) {
    return this.prismaService.user.findUnique({
      where: {
        id: userId,
      },
    });
  }

  public async getUserByWalletAddress(walletAddress: string) {
    return this.prismaService.user.findUnique({
      where: {
        walletAddress,
      },
    });
  }
}
