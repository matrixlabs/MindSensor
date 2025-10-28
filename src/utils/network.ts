import type { Connection } from '@solana/web3.js';

export type SolanaNetwork = 'mainnet-beta' | 'devnet' | 'testnet' | 'unknown';

export function detectNetwork(connection: Connection): SolanaNetwork {
  const endpoint = connection.rpcEndpoint.toLowerCase();

  if (endpoint.includes('mainnet')) {
    return 'mainnet-beta';
  }
  if (endpoint.includes('devnet')) {
    return 'devnet';
  }
  if (endpoint.includes('testnet')) {
    return 'testnet';
  }

  return 'unknown';
}

export function getExplorerUrl(
  signature: string,
  network: SolanaNetwork,
): string {
  const cluster = network === 'mainnet-beta' ? '' : `?cluster=${network}`;
  return `https://explorer.solana.com/tx/${signature}${cluster}`;
}

export function getNetworkDisplayName(network: SolanaNetwork): string {
  switch (network) {
    case 'mainnet-beta':
      return 'Mainnet';
    case 'devnet':
      return 'Devnet';
    case 'testnet':
      return 'Testnet';
    default:
      return 'Unknown';
  }
}
