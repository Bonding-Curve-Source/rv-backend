import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Contract, JsonRpcProvider } from 'ethers';

import { factoryAbi, TOKEN_CREATED } from './abi/factory.abi';
import { TokenService } from './token.service';

function uint256ToDecimalString(v: unknown): string {
  if (typeof v === 'bigint') return v.toString(10);
  if (typeof v === 'number' && Number.isFinite(v)) return String(Math.trunc(v));
  if (typeof v === 'string' && v.trim() !== '') return v.trim();
  return '0';
}

@Injectable()
export class TokenEventService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TokenEventService.name);
  private provider: JsonRpcProvider | null = null;
  private contract: Contract | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly tokenService: TokenService,
  ) {}

  async onModuleInit() {
    const rpcUrl = this.configService.get<string>('RPC_URL');
    const factoryAddress = this.configService.get<string>('FACTORY_ADDRESS');

    if (!rpcUrl || !factoryAddress) {
      this.logger.warn(
        'Skip TokenCreated listener: missing RPC or factory address env (BSC_TESTNET_RPC/RPC_URL, MEME_FACTORY_ADDRESS/FACTORY_ADDRESS).',
      );
      return;
    }

    this.provider = new JsonRpcProvider(rpcUrl);
    this.contract = new Contract(factoryAddress, factoryAbi, this.provider);

    await this.contract.on(
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

    this.logger.log(`Listening TokenCreated via contract.on from ${factoryAddress}`);
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
    if (this.contract) {
      this.contract.removeAllListeners();
      this.contract = null;
    }
    this.provider = null;
  }
}
