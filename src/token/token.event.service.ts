import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Contract, Interface, JsonRpcProvider } from 'ethers';

import { factoryAbi } from './abi/factory.abi';
import { collectRpcUrls, getLogsChunked, shortRpcLabel } from './rpc-provider.util';
import { TokenService } from './token.service';

const factoryInterface = new Interface(factoryAbi);
const TOKEN_CREATED_TOPIC0 = factoryInterface.getEvent('TokenCreated')!.topicHash;

function uint256ToDecimalString(v: unknown): string {
  if (typeof v === 'bigint') return v.toString(10);
  if (typeof v === 'number' && Number.isFinite(v)) return String(Math.trunc(v));
  if (typeof v === 'string' && v.trim() !== '') return v.trim();
  return '0';
}

const HEALTH_INTERVAL_MS = 90_000;
/** Khoảng poll TokenCreated — không phụ thuộc ethers `polling` (tự gọi getLogs chunked). */
const TOKEN_POLL_MS = 4_000;

@Injectable()
export class TokenEventService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TokenEventService.name);
  /** Max số block mỗi lần `eth_getLogs` (QuikNode Discover ≈ 5). Env: `ETH_GETLOGS_MAX_BLOCK_RANGE`. */
  private readonly maxBlocksPerLogQuery: bigint;
  private provider: JsonRpcProvider | null = null;
  private contract: Contract | null = null;
  private rpcUrls: string[] = [];
  private rpcIndex = 0;
  private chainId: number | undefined;
  private factoryAddress: string | null = null;
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private lastScannedBlock: bigint | null = null;
  private pollInFlight = false;
  private rotating = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly tokenService: TokenService,
  ) {
    const raw = configService.get<string>('ETH_GETLOGS_MAX_BLOCK_RANGE');
    const n =
      raw !== undefined && raw !== '' ? parseInt(raw, 10) : 5;
    const clamped = Math.min(10_000, Math.max(1, Number.isFinite(n) ? n : 5));
    this.maxBlocksPerLogQuery = BigInt(clamped);
  }

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

    const backupCount = Math.max(0, this.rpcUrls.length - 1);
    this.logger.log(
      `TokenCreated RPC pool: ${this.rpcUrls.length} endpoint(s) — #0 = RPC_URL, #1… = RPC_BACKUP_URL (comma list). Failover khi lỗi / health fail.`,
    );
    this.logger.log(
      `RPC order: ${this.rpcUrls.map((u, i) => `[${i}] ${shortRpcLabel(u)}`).join(' → ')}`,
    );
    this.logger.log(
      `eth_getLogs chunk size: ${this.maxBlocksPerLogQuery} block(s)/request (đặt ETH_GETLOGS_MAX_BLOCK_RANGE nếu RPC cho phép range lớn hơn).`,
    );
    if (backupCount === 0) {
      this.logger.warn(
        'Chỉ có 1 RPC — thêm RPC_BACKUP_URL (phân tách bằng dấu phẩy) để tự chuyển khi node lỗi.',
      );
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
      await provider.on('error', (err: Error) => {
        this.logger.warn(`Provider error on ${url}: ${err.message}`);
        void this.rotateToNextRpc('provider-error');
      });

      this.healthTimer = setInterval(() => {
        void this.pingOrRotate();
      }, HEALTH_INTERVAL_MS);

      this.lastScannedBlock = BigInt(await provider.getBlockNumber());
      this.pollTimer = setInterval(() => {
        void this.pollTokenCreated();
      }, TOKEN_POLL_MS);

      this.provider = provider;
      this.contract = contract;

      this.logger.log(
        `Listening TokenCreated via chunked getLogs (${this.maxBlocksPerLogQuery} blocks/req) from ${this.factoryAddress} (RPC ${this.rpcIndex + 1}/${this.rpcUrls.length}: ${url})`,
      );
    } catch (e) {
      await contract.removeAllListeners().catch(() => {});
      await provider.removeAllListeners().catch(() => {});
      provider.destroy();
      throw e;
    }
  }

  private async pollTokenCreated(): Promise<void> {
    if (this.pollInFlight || this.rotating || !this.provider || !this.contract) return;
    if (this.lastScannedBlock === null) return;
    this.pollInFlight = true;
    try {
      const head = BigInt(await this.provider.getBlockNumber());
      const from = this.lastScannedBlock + 1n;
      if (from > head) {
        return;
      }
      const logs = await getLogsChunked(
        this.provider,
        {
          address: this.factoryAddress!,
          topics: [TOKEN_CREATED_TOPIC0],
        },
        from,
        head,
        this.maxBlocksPerLogQuery,
      );
      for (const log of logs) {
        let parsed;
        try {
          parsed = this.contract.interface.parseLog(log);
        } catch {
          continue;
        }
        if (parsed.name !== 'TokenCreated') continue;
        const a = parsed.args;
        try {
          await this.persistTokenCreated(
            String(a.tokenAddress),
            String(a.bondingCurve),
            String(a.creator),
            String(a.raiseToken),
            String(a.name),
            String(a.symbol),
            BigInt(a.targetValue.toString()),
          );
        } catch (error) {
          this.logger.error(
            'Failed to save TokenCreated',
            error instanceof Error ? error.stack : error,
          );
        }
      }
      this.lastScannedBlock = head;
    } catch (e) {
      this.logger.warn(
        `TokenCreated getLogs failed: ${e instanceof Error ? e.message : e}`,
      );
      await this.rotateToNextRpc('getLogs-poll');
    } finally {
      this.pollInFlight = false;
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
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
    this.lastScannedBlock = null;
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
