'use client';
import { useEffect, useState } from 'react';
import { api, post } from '@/lib/client/api';
import { Avatar, Icon, I, PageHeader, Skeleton, btnGhost, useToast } from '@/components/ui';

type Me = { user: { id: string; name: string; email: string; role: string; wallets?: { address: string; chainId: number }[] } | null; genlayer: { mode: string; network: { label: string; chainId: number; rpc: string }; contractAddress: string | null; contractVersion: string } };

function Row({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-2.5 last:border-b-0">
      <dt className="shrink-0 text-[13px] text-faint">{label}</dt>
      <dd className={`text-right text-[13px] font-medium text-ink ${mono ? 'font-mono text-[11.5px] font-normal' : ''}`}>{children}</dd>
    </div>
  );
}

export default function SettingsPage() {
  const [me, setMe] = useState<Me | null>(null);
  const toast = useToast();
  useEffect(() => { api<Me>('/api/auth/me').then(setMe).catch(() => {}); }, []);
  if (!me?.user) return <Skeleton className="h-72" />;
  const g = me.genlayer;
  const live = g.mode === 'GENLAYER_TESTNET';

  return (
    <div className="rise">
      <PageHeader title="Settings" sub="Account, workspace personas and the GenLayer protocol connection." />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section className="border border-line bg-paper px-5 py-4 shadow-card" style={{ borderRadius: 10 }} aria-label="Account">
          <h2 className="flex items-center gap-2.5 text-[14px] font-semibold text-ink"><Avatar name={me.user.name} size={30} /> {me.user.name}</h2>
          <dl className="mt-2">
            <Row label="Email">{me.user.email}</Row>
            <Row label="Role">{me.user.role}</Row>
            <Row label="Workspace">ProofPay demo workspace</Row>
            <Row label="Wallet identity (testnet)" mono>{me.user.wallets?.[0]?.address ?? 'None linked'}</Row>
            <Row label="Wallet chain" mono>{me.user.wallets?.[0] ? `chain ${me.user.wallets[0].chainId}` : '—'}</Row>
          </dl>
          <p className="mt-3 border-t border-line pt-3 text-[12.5px] leading-relaxed text-faint">
            Demo sign-in uses synthetic personas; per-agreement authorization is still enforced on the server. Production wallet
            login uses a nonce + signature flow with expiry and replay protection (<span className="font-mono text-[11px]">lib/server/walletAuth.ts</span>) and
            refuses to “verify” until a real verifier (viem <span className="font-mono text-[11px]">verifyMessage</span>) is configured. Switch personas from the account menu in the sidebar.
          </p>
          <button type="button" className={`${btnGhost} mt-3`} onClick={async () => { await post('/api/notifications'); toast('All notifications marked read.'); }}>
            <Icon d={I.check} size={14} /> Mark notifications read
          </button>
        </section>

        <section className="border border-line bg-paper px-5 py-4 shadow-card" style={{ borderRadius: 10 }} aria-label="GenLayer configuration">
          <h2 className="flex items-center gap-2 text-[14px] font-semibold text-ink">
            GenLayer integration
            <span className={`ml-auto inline-flex items-center gap-1.5 border px-1.5 py-[2px] text-[11px] font-medium ${live ? 'border-mineral/30 bg-mineral-tint text-mineral-deep' : 'border-amber2/30 bg-amber2-tint text-amber2'}`} style={{ borderRadius: 5 }}>
              <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-mineral' : 'bg-amber2'}`} />{live ? 'Live testnet' : 'Simulated'}
            </span>
          </h2>
          <dl className="mt-2">
            <Row label="Mode" mono>{g.mode}</Row>
            <Row label="Network">{g.network.label} · chain {g.network.chainId}</Row>
            <Row label="RPC endpoint" mono>{g.network.rpc}</Row>
            <Row label="Contract address" mono>{g.contractAddress ?? 'Not deployed / not configured'}</Row>
            <Row label="Contract version" mono>{g.contractVersion}</Row>
          </dl>
          <div className="mt-3 space-y-2.5 border-t border-line pt-3 text-[12.5px] leading-relaxed text-faint">
            <p><strong className="font-medium text-ink">Live today:</strong> the Intelligent Contract source, the server-side genlayer-js adapter, deterministic verdict validation, settlement guards, and the full application workflow.</p>
            <p><strong className="font-medium text-ink">Simulated in this workspace:</strong> funding, adjudication outcomes and settlement execution — until a contract is deployed to Studionet/Bradbury and <span className="font-mono text-[11px]">GENLAYER_CONTRACT_ADDRESS</span> + <span className="font-mono text-[11px]">GENLAYER_PRIVATE_KEY</span> (faucet-funded testnet key) are set. Simulated records are labelled; the two never mix silently.</p>
            <p>Deployment steps: <span className="font-mono text-[11px]">docs/GENLAYER.md</span> in the repository.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
