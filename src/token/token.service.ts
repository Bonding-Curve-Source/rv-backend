import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Contract } from 'ethers';
import { PrismaService } from 'nestjs-prisma';

import { factoryAbi } from './abi/factory.abi';
import { collectRpcUrls, withJsonRpcFailover } from './rpc-provider.util';

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  private static readonly ZERO_ADDR =
    '0x0000000000000000000000000000000000000000';

  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  private chainId(): number | undefined {
    const raw = this.configService.get<string | number>('CHAIN_ID');
    if (raw === undefined || raw === '') return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  }

  private rpcUrls(): string[] {
    return collectRpcUrls(
      this.configService.get<string>('RPC_URL'),
      this.configService.get<string>('RPC_BACKUP_URL'),
    );
  }

  private async enrichRaiseTokenMetadata(raiseToken: string): Promise<void> {
    const r = raiseToken.toLowerCase();
    const prisma = this.prismaService as any;

    if (r === TokenService.ZERO_ADDR) {
      try {
        await prisma.raiseToken.update({
          where: { tokenAddress: r },
          data: { name: 'BNB', symbol: 'BNB' },
        });
      } catch (e) {
        this.logger.warn(
          `enrichRaiseTokenMetadata(native): ${e instanceof Error ? e.message : e}`,
        );
      }
      return;
    }

    const urls = this.rpcUrls();
    if (urls.length === 0) return;

    const abi = [
      'function symbol() view returns (string)',
      'function name() view returns (string)',
    ];
    try {
      await withJsonRpcFailover(urls, this.chainId(), async (provider) => {
        const c = new Contract(r, abi, provider);
        const symbol: string = await c.symbol();
        let name: string;
        try {
          name = await c.name();
        } catch {
          name = symbol;
        }
        const nameTrim = name && String(name).trim();
        await prisma.raiseToken.update({
          where: { tokenAddress: r },
          data: {
            symbol: String(symbol).slice(0, 64),
            name: nameTrim
              ? String(nameTrim).slice(0, 128)
              : String(symbol).slice(0, 128),
          },
        });
      });
    } catch (e) {
      this.logger.warn(
        `enrichRaiseTokenMetadata(${r}): ${e instanceof Error ? e.message : e}`,
      );
    }
  }

  async upsertToken(payload: {
    tokenAddress: string;
    bondingCurve: string;
    creatorAddress: string;
    raiseToken: string;
    name: string;
    symbol: string;
    targetValue?: string;
  }) {
    const prisma = this.prismaService as any;
    const raise = payload.raiseToken.toLowerCase();
    const targetValue =
      payload.targetValue !== undefined &&
      String(payload.targetValue).trim() !== ''
        ? String(payload.targetValue).trim()
        : '0';

    await prisma.raiseToken.upsert({
      where: { tokenAddress: raise },
      create: {
        tokenAddress: raise,
        name: 'Unknown raise asset',
        symbol: '???',
        image: '',
      },
      update: {},
    });

    await this.enrichRaiseTokenMetadata(raise);

    return prisma.token.upsert({
      where: { tokenAddress: payload.tokenAddress.toLowerCase() },
      update: {
        bondingCurve: payload.bondingCurve.toLowerCase(),
        creatorAddress: payload.creatorAddress.toLowerCase(),
        raiseToken: raise,
        name: payload.name,
        symbol: payload.symbol,
        targetValue,
      },
      create: {
        tokenAddress: payload.tokenAddress.toLowerCase(),
        bondingCurve: payload.bondingCurve.toLowerCase(),
        creatorAddress: payload.creatorAddress.toLowerCase(),
        raiseToken: raise,
        name: payload.name,
        symbol: payload.symbol,
        targetValue,
      },
      include: { raiseAsset: true },
    });
  }

  async getTokens() {
    const prisma = this.prismaService as any;
    return prisma.token.findMany({
      orderBy: { id: 'desc' },
      include: { raiseAsset: true },
    });
  }

  /**
   * Lấy đúng `raiseToken` từ `tokens[token]` on-chain — tránh DB luôn 0x0 khi event legacy
   * hoặc decode listener lệch.
   */
  async syncRaiseTokenFromChain(tokenAddress: string): Promise<void> {
    const urls = this.rpcUrls();
    const factoryAddress = this.configService.get<string>('FACTORY_ADDRESS');
    if (!urls.length || !factoryAddress) return;

    try {
      await withJsonRpcFailover(urls, this.chainId(), async (provider) => {
        const contract = new Contract(factoryAddress, factoryAbi, provider);
        const info = (await contract.getTokenInfo(tokenAddress)) as {
          raiseToken?: string;
        };
        const raise = String(info.raiseToken).toLowerCase();
        if (!raise) return;

        const prisma = this.prismaService as any;
        await prisma.raiseToken.upsert({
          where: { tokenAddress: raise },
          create: {
            tokenAddress: raise,
            name: 'Unknown raise asset',
            symbol: '???',
            image: '',
          },
          update: {},
        });

        await this.enrichRaiseTokenMetadata(raise);

        await prisma.token.updateMany({
          where: { tokenAddress: tokenAddress.toLowerCase() },
          data: { raiseToken: raise },
        });
      });
    } catch (e) {
      this.logger.warn(
        `syncRaiseTokenFromChain(${tokenAddress}): ${e instanceof Error ? e.message : e}`,
      );
    }
  }
}
