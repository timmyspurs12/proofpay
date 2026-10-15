/**
 * GenLayer configuration — verified against docs.genlayer.com/developers/networks.
 * No credentials → DEMO_SIMULATED mode. Simulated records are always labelled.
 */

export type GenLayerMode = 'GENLAYER_TESTNET' | 'DEMO_SIMULATED';

export interface NetworkInfo {
  key: string;
  label: string;
  rpc: string;
  chainId: number;
  explorer: string;
}

export const NETWORKS: Record<string, NetworkInfo> = {
  studionet: {
    key: 'studionet',
    label: 'GenLayer Studionet',
    rpc: 'https://studio.genlayer.com/api',
    chainId: 61999,
    explorer: 'https://explorer-studio.genlayer.com',
  },
  testnetBradbury: {
    key: 'testnetBradbury',
    label: 'GenLayer Testnet Bradbury',
    rpc: 'https://rpc-bradbury.genlayer.com',
    chainId: 4221,
    explorer: 'https://explorer-bradbury.genlayer.com',
  },
  localnet: {
    key: 'localnet',
    label: 'GenLayer Localnet',
    rpc: 'http://localhost:4000/api',
    chainId: 61127,
    explorer: 'http://localhost:8080',
  },
};

export function genLayerConfig() {
  const networkKey = process.env.GENLAYER_NETWORK ?? 'studionet';
  const network = NETWORKS[networkKey] ?? NETWORKS.studionet;
  const contractAddress = process.env.GENLAYER_CONTRACT_ADDRESS ?? '';
  const hasSigner = Boolean(process.env.GENLAYER_PRIVATE_KEY);
  const mode: GenLayerMode = contractAddress && hasSigner ? 'GENLAYER_TESTNET' : 'DEMO_SIMULATED';
  return { mode, network, contractAddress, hasSigner, contractVersion: 'proofpay-adjudicator@1.0.0' };
}
