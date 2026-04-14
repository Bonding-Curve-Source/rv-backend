import { JsonRpcProvider } from 'ethers';

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
