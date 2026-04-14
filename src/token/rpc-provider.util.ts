import { JsonRpcProvider } from 'ethers';
import type { Log } from 'ethers';

/**
 * Một số RPC (vd. QuikNode Discover) giới hạn độ rộng block cho `eth_getLogs`.
 * Chia [fromBlock, toBlock] thành nhiều truy vấn, mỗi lần tối đa `maxBlocksInclusive` block (gồm cả hai đầu).
 */
export async function getLogsChunked(
  provider: JsonRpcProvider,
  baseFilter: { address: string; topics?: (string | null)[] },
  fromBlock: bigint,
  toBlock: bigint,
  maxBlocksInclusive: bigint,
): Promise<Log[]> {
  if (fromBlock > toBlock) return [];
  if (maxBlocksInclusive < 1n) {
    throw new Error('getLogsChunked: maxBlocksInclusive must be >= 1');
  }
  const out: Log[] = [];
  let f = fromBlock;
  while (f <= toBlock) {
    const t =
      f + maxBlocksInclusive - 1n <= toBlock
        ? f + maxBlocksInclusive - 1n
        : toBlock;
    const logs = await provider.getLogs({
      ...baseFilter,
      fromBlock: f,
      toBlock: t,
    });
    out.push(...logs);
    f = t + 1n;
  }
  return out;
}

/** Host (+ path ngắn) để log — không in full URL có API key. */
export function shortRpcLabel(url: string): string {
  try {
    const u = new URL(url);
    const p = u.pathname && u.pathname !== '/' ? u.pathname.slice(0, 24) : '';
    return `${u.hostname}${p || ''}`;
  } catch {
    return url.length > 48 ? `${url.slice(0, 45)}…` : url;
  }
}

export function collectRpcUrls(
  rpcUrl?: string | null,
  rpcBackup?: string | null,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (u: string) => {
    const t = u.trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };
  if (rpcUrl) push(rpcUrl);
  if (rpcBackup) {
    for (const part of rpcBackup.split(',')) {
      push(part);
    }
  }
  return out;
}

export async function withJsonRpcFailover<T>(
  urls: string[],
  chainId: number | undefined,
  fn: (provider: JsonRpcProvider) => Promise<T>,
): Promise<T> {
  let lastError: unknown;
  for (const url of urls) {
    const provider = new JsonRpcProvider(url, chainId);
    try {
      return await fn(provider);
    } catch (e) {
      lastError = e;
    } finally {
      provider.destroy();
    }
  }
  throw lastError;
}
