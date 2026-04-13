import type { User } from '@prisma/client';

export interface JwtPayload {
  sub: number;
  walletAddress: string;
}

export type Payload = Pick<User, 'id' | 'walletAddress'>;
