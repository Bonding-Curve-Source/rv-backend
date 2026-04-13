import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required to run seed');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const raiseTokensSeed = [
  {
    tokenAddress: '0x0000000000000000000000000000000000000000',
    name: 'BNB',
    symbol: 'BNB',
    image:
      'https://tokens.pancakeswap.finance/images/symbol/bnb.png',
  },
  {
    tokenAddress: '0xae13d989dac2f0debff460ac112a837c89baa7cd',
    name: 'Wrapped BNB',
    symbol: 'WBNB',
    image:
      'https://tokens.pancakeswap.finance/images/symbol/bnb.png',
  },
  {
    tokenAddress: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
    name: 'USD Coin',
    symbol: 'USDC',
    image:
      'https://tokens.pancakeswap.finance/images/symbol/usdc.png',
  },
  {
    tokenAddress: '0x55d398326f99059ff775485246999027b3197955',
    name: 'Tether USD',
    symbol: 'USDT',
    image:
      'https://tokens.pancakeswap.finance/images/symbol/usdt.png',
  },
  {
    tokenAddress: '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82',
    name: 'PancakeSwap',
    symbol: 'CAKE',
    image:
      'https://tokens.pancakeswap.finance/images/symbol/cake.png',
  },
].map((row) => ({
  ...row,
  tokenAddress: row.tokenAddress.toLowerCase(),
}));

const raiseValuesSeed = [
  { value: 10, symbol: 'USDT' },
  { value: 100, symbol: 'USDT' },
  { value: 1_000, symbol: 'USDT' },
  { value: 10_000, symbol: 'USDT' },
  { value: 100_000, symbol: 'USDT' },
  { value: 1_000_000, symbol: 'USDT' },
];

async function main() {
  await prisma.$transaction([
    prisma.token.deleteMany(),
    prisma.raiseValue.deleteMany(),
    prisma.raiseToken.deleteMany(),
  ]);

  await prisma.raiseToken.createMany({ data: raiseTokensSeed });
  await prisma.raiseValue.createMany({ data: raiseValuesSeed });

  const [nTok, nVal] = await Promise.all([
    prisma.raiseToken.count(),
    prisma.raiseValue.count(),
  ]);

  console.log(
    `[seed] RaiseToken: ${nTok} rows, RaiseValue: ${nVal} rows`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
