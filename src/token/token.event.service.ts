import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Contract, JsonRpcProvider } from 'ethers';

import { factoryAbi, TOKEN_CREATED } from './abi/factory.abi';
import { collectRpcUrls } from './rpc-provider.util';
import { TokenService } from './token.service';

function uint256ToDecimalString(v: unknown): string {
  if (typeof v === 'bigint') return v.toString(10);
  if (typeof v === 'number' && Number.isFinite(v)) return String(Math.trunc(v));
  if (typeof v === 'string' && v.trim() !== '') return v.trim();
  return '0';
}

const HEALTH_INTERVAL_MS = 90_000;

@Injectable()
export class TokenEventService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TokenEventService.name);
  private provider: JsonRpcProvider | null = null;
  private contract: Contract | null = null;
  private rpcUrls: string[] = [];
  private rpcIndex = 0;
  private chainId: number | undefined;
  private factoryAddress: string | null = null;
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private rotating = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly tokenService: TokenService,
  ) {}

  async onModuleInit() {
    const factoryAddress = this.configService.get<string>('FACTORY_ADDRESS');
    this.factoryAddress = factoryAddress ?? null;
    this.rpcUrls = collectRpcUrls(
      this.configService.get<string>('RPC_URL'),
      this.configService.get<string>('RPC_BACKUP_URL'),
    );
    const rawChain = this.configService.get<string | number>('CHAIN_ID');
    if (rawChain !== undefined && rawChain !== '') {
      const n = Number(rawChain);
      this.chainId = Number.isFinite(n) ? n : undefined;
    }

    if (!this.rpcUrls.length || !factoryAddress) {
      this.logger.warn(
        'Skip TokenCreated listener: missing RPC or factory address env (RPC_URL, optional RPC_BACKUP_URL, FACTORY_ADDRESS).',
      );
      return;
    }

    for (let attempt = 0; attempt < this.rpcUrls.length; attempt++) {
      this.rpcIndex = attempt;
      try {
        await this.attachListener();
        return;
      } catch (error) {
        this.logger.warn(
          `TokenCreated listener failed on ${this.rpcUrls[this.rpcIndex]}: ${
            error instanceof Error ? error.message : error
          }`,
        );
        await this.detachListener();
      }
    }
    this.logger.error('TokenCreated: could not start listener on any RPC endpoint');
  }

  private async attachListener(): Promise<void> {
    const url = this.rpcUrls[this.rpcIndex];
    const provider = new JsonRpcProvider(url, this.chainId);
    const contract = new Contract(this.factoryAddress!, factoryAbi, provider);

    try {
      await contract.on(
        TOKEN_CREATED,
        async (
          tokenAddress: string,
          bondingCurve: string,
          creator: string,
          raiseToken: string,
          name: string,
          symbol: string,
          targetValue: bigint,
        ) => {
          try {
            await this.persistTokenCreated(
              tokenAddress,
              bondingCurve,
              creator,
              raiseToken,
              name,
              symbol,
              targetValue,
            );
          } catch (error) {
            this.logger.error(
              'Failed to save TokenCreated',
              error instanceof Error ? error.stack : error,
            );
          }
        },
      );

      await provider.on('error', (err: Error) => {
        this.logger.warn(`Provider error on ${url}: ${err.message}`);
        void this.rotateToNextRpc('provider-error');
      });

      this.healthTimer = setInterval(() => {
        void this.pingOrRotate();
      }, HEALTH_INTERVAL_MS);

      this.provider = provider;
      this.contract = contract;

      this.logger.log(
        `Listening TokenCreated via contract.on from ${this.factoryAddress} (RPC ${this.rpcIndex + 1}/${this.rpcUrls.length}: ${url})`,
      );
    } catch (e) {
      await contract.removeAllListeners().catch(() => {});
      await provider.removeAllListeners().catch(() => {});
      provider.destroy();
      throw e;
    }
  }

  private async pingOrRotate(): Promise<void> {
    if (this.rotating || !this.provider) return;
    try {
      await this.provider.getBlockNumber();
    } catch (e) {
      this.logger.warn(
        `RPC health check failed: ${e instanceof Error ? e.message : e}`,
      );
      await this.rotateToNextRpc('health-check');
    }
  }

  private async rotateToNextRpc(reason: string): Promise<void> {
    if (this.rotating) return;
    this.rotating = true;
    try {
      const prev = this.rpcUrls[this.rpcIndex];
      await this.detachListener();
      const start = (this.rpcIndex + 1) % this.rpcUrls.length;
      for (let i = 0; i < this.rpcUrls.length; i++) {
        this.rpcIndex = (start + i) % this.rpcUrls.length;
        const url = this.rpcUrls[this.rpcIndex];
        try {
          await this.attachListener();
          this.logger.warn(`RPC failover (${reason}): ${prev} -> ${url}`);
          return;
        } catch (e) {
          this.logger.warn(
            `Failover attach failed on ${url}: ${e instanceof Error ? e.message : e}`,
          );
          await this.detachListener();
        }
      }
      this.logger.error(
        `TokenCreated: all RPC endpoints failed after failover (${reason})`,
      );
    } finally {
      this.rotating = false;
    }
  }

  private async detachListener(): Promise<void> {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
    if (this.contract) {
      await this.contract.removeAllListeners();
      this.contract = null;
    }
    if (this.provider) {
      await this.provider.removeAllListeners();
      this.provider.destroy();
      this.provider = null;
    }
  }

  private async persistTokenCreated(
    tokenAddress: string,
    bondingCurve: string,
    creator: string,
    raiseToken: string,
    name: string,
    symbol: string,
    targetValue: bigint,
  ) {
    const t = String(tokenAddress);
    const tv = uint256ToDecimalString(targetValue);
    this.logger.log(
      `TokenCreated: ${t} curve ${bondingCurve} raise ${raiseToken} targetValue ${tv}`,
    );
    await this.tokenService.upsertToken({
      tokenAddress: t,
      bondingCurve: String(bondingCurve),
      creatorAddress: String(creator),
      raiseToken: String(raiseToken),
      name: String(name),
      symbol: String(symbol),
      targetValue: tv,
    });
    await this.tokenService.syncRaiseTokenFromChain(t);
    this.logger.log(`Saved token ${t}`);
  }

  async onModuleDestroy() {
    await this.detachListener();
  }
}
