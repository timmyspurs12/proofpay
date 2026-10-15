import { getSessionUser } from '@/lib/server/auth';
import { ok, handle } from '@/lib/server/api';
import { genLayerConfig } from '@/lib/genlayer/config';

export async function GET() {
  return handle(async () => {
    const user = await getSessionUser();
    const cfg = genLayerConfig();
    return ok({
      user: user ? { id: user.id, name: user.name, email: user.email, role: user.role, wallets: user.wallets } : null,
      genlayer: { mode: cfg.mode, network: cfg.network, contractAddress: cfg.contractAddress || null, contractVersion: cfg.contractVersion },
    });
  });
}
