import { Injectable } from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';

@Injectable()
export class RaiseConfigService {
  constructor(private readonly prismaService: PrismaService) { }

  findAllRaiseTokens() {
    const prisma = this.prismaService as any;
    return prisma.raiseToken.findMany({
      orderBy: { id: 'asc' },
    });
  }

  findAllRaiseValues() {
    const prisma = this.prismaService as any;
    return prisma.raiseValue.findMany({
      orderBy: { id: 'asc' },
    });
  }

  async getRaiseConfig() {
    const [raiseTokens, raiseValues] = await Promise.all([
      this.findAllRaiseTokens(),
      this.findAllRaiseValues(),
    ]);
    return { raiseTokens, raiseValues };
  }
}

export type RaiseConfigResponse = Awaited<
  ReturnType<RaiseConfigService['getRaiseConfig']>
>;
