import { genLayerConfig } from './config';

/**
 * Server-side GenLayer adapter (genlayer-js@1.1.8, verified API):
 *   createClient({ chain, account }), createAccount(privateKey),
 *   writeContract({ account, address, functionName, args, value }),
 *   readContract({ address, functionName, args }),
 *   getTransaction({ hash }), waitForTransactionReceipt({ hash, status }).
 * Imported dynamically so the SDK never enters a browser bundle and the
 * private key never leaves the server.
 */

export interface AdjudicationPayload {
  caseId: string;
  agreementId: string;
  versionHash: string;
  criteriaJson: string;
  evidenceJson: string;
  clientClaim: string;
  providerClaim: string;
  allowPartial: boolean;
}

async function makeClient() {
  const cfg = genLayerConfig();
  if (cfg.mode !== 'GENLAYER_TESTNET') throw new Error('GenLayer live mode is not configured');
  const sdk = await import('genlayer-js');
  const chains = await import('genlayer-js/chains');
  const chain =
    cfg.network.key === 'testnetBradbury'
      ? chains.testnetBradbury
      : cfg.network.key === 'localnet'
        ? chains.localnet
        : chains.studionet;
  const account = sdk.createAccount(process.env.GENLAYER_PRIVATE_KEY as `0x${string}`);
  const client = sdk.createClient({ chain, account });
  return { client, cfg };
}

/** Submit an adjudication write. Returns the real GenLayer transaction id. */
export async function submitAdjudicationOnChain(p: AdjudicationPayload): Promise<{ txId: string }> {
  const { client, cfg } = await makeClient();
  const txId = await client.writeContract({
    address: cfg.contractAddress as `0x${string}`,
    functionName: 'adjudicate',
    args: [p.caseId, p.agreementId, p.versionHash, p.criteriaJson, p.evidenceJson, p.clientClaim, p.providerClaim, p.allowPartial],
    value: BigInt(0),
  });
  return { txId: String(txId) };
}

/** Read the stored verdict JSON for a case; empty string while undecided. */
export async function readVerdictOnChain(caseId: string): Promise<string> {
  const { client, cfg } = await makeClient();
  const result = await client.readContract({
    address: cfg.contractAddress as `0x${string}`,
    functionName: 'get_verdict',
    args: [caseId],
  });
  return typeof result === 'string' ? result : '';
}

/** Fetch live transaction status; mapped to our coarse lifecycle. */
export async function fetchTxStatus(txId: string): Promise<{ status: string; raw: unknown }> {
  const { client } = await makeClient();
  const tx = await client.getTransaction({ hash: txId as never });
  const name = (tx as { statusName?: string })?.statusName ?? 'PENDING';
  const map: Record<string, string> = {
    FINALIZED: 'FINALIZED',
    ACCEPTED: 'ACCEPTED',
    UNDETERMINED: 'UNDETERMINED',
  };
  return { status: map[name] ?? 'PENDING', raw: tx };
}
