'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/client/api';
import { CopyId, DecisionBadge, Icon, I, LogoMark, Money, Skeleton, btnGhost, btnPrimary } from '@/components/ui';

type Detail = {
  agreement: { id: string; title: string; status: string; amountMinor: number; currency: string; client: { name: string }; provider: { name: string } };
  versions: { version: number; termsHash: string; snapshotParsed: { criteria: { id: string; text: string }[] } }[];
  evidence: { id: string; title: string; type: string; contentHash: string }[];
  disputes: { id: string; adjudications: { txId: string; mode: string; network: string; contractAddress: string; result: { decision: string; rationale: string; verdictJson: string; createdAt: string } | null }[] }[];
  settlements: { id: string; decision: string; toProviderMinor: number; toClientMinor: number; currency: string; status: string; mode: string; reference: string; executedAt: string | null; createdAt: string }[];
  chainTxs: { kind: string; txId: string; status: string; network: string; createdAt: string }[];
};

export default function ReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { api<Detail>(`/api/agreements/${id}`).then(setD).catch((e) => setErr(e.message)); }, [id]);
  if (err) return <div className="border border-vermilion/30 bg-vermilion-tint px-4 py-3 text-[13px] text-vermilion" role="alert" style={{ borderRadius: 8 }}>{err}</div>;
  if (!d) return <Skeleton className="mx-auto h-[560px] max-w-3xl" />;

  const a = d.agreement;
  const version = d.versions[d.versions.length - 1];
  const settlement = d.settlements[0];
  const adj = d.disputes.flatMap((x) => x.adjudications).find((x) => x.result);
  const verdict = (() => { try { return adj?.result ? JSON.parse(adj.result.verdictJson) as { rationale: string; uncertainties: string[] } : null; } catch { return null; } })();
  const executed = settlement?.status === 'EXECUTED';

  const download = () => {
    const payload = { receipt: 'ProofPay case receipt', exportedAt: new Date().toISOString(), agreement: { id: a.id, title: a.title, status: a.status }, termsVersion: version.version, termsHash: version.termsHash, decision: adj?.result ?? null, settlement: settlement ?? null, transactions: d.chainTxs, note: 'Simulated records are labelled by mode/status. A recorded decision is distinct from an executed settlement.' };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `proofpay-receipt-${a.id}.json`; link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rise mx-auto max-w-3xl">
      <div className="no-print mb-4 flex flex-wrap gap-2">
        <Link href={`/app/agreements/${id}`} className={btnGhost}>← Case file</Link>
        <span className="ml-auto flex gap-2">
          <button type="button" className={btnGhost} onClick={() => window.print()}>Print receipt</button>
          <button type="button" className={btnPrimary} onClick={download}>Export JSON</button>
        </span>
      </div>

      <article className="border border-line bg-paper px-6 py-7 shadow-card sm:px-9" style={{ borderRadius: 12 }} aria-label="Case receipt">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
          <span className="flex items-center gap-2.5"><LogoMark /><span><span className="block text-[15px] font-semibold text-ink">ProofPay</span><span className="block text-[10px] uppercase tracking-[0.14em] text-faint">Decision & settlement receipt</span></span></span>
          <CopyId value={a.id} label="agreement ID" />
        </div>

        <h1 className="mt-5 text-[19px] font-semibold tracking-tight text-ink">{a.title}</h1>
        <dl className="mt-3 grid gap-x-6 gap-y-2.5 text-[13px] sm:grid-cols-2">
          <div className="flex justify-between gap-3 border-b border-line pb-2"><dt className="text-faint">Client</dt><dd className="font-medium text-ink">{a.client.name}</dd></div>
          <div className="flex justify-between gap-3 border-b border-line pb-2"><dt className="text-faint">Provider</dt><dd className="font-medium text-ink">{a.provider.name}</dd></div>
          <div className="flex justify-between gap-3 border-b border-line pb-2"><dt className="text-faint">Agreement value</dt><dd className="font-semibold text-ink"><Money minor={a.amountMinor} currency={a.currency} /></dd></div>
          <div className="flex justify-between gap-3 border-b border-line pb-2"><dt className="text-faint">Agreement state</dt><dd className="font-medium text-ink">{a.status.replaceAll('_', ' ').toLowerCase()}</dd></div>
        </dl>

        <h2 className="mt-6 text-[11px] font-medium uppercase tracking-[0.1em] text-faint">Original contractual criteria · terms v{version.version}</h2>
        <p className="mt-1 flex items-center gap-1.5 text-[11.5px] text-faint">sha256 <CopyId value={version.termsHash} label="terms hash" /></p>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[13px] leading-relaxed text-slate2">
          {version.snapshotParsed.criteria.map((c) => <li key={c.id}>{c.text}</li>)}
        </ol>

        <h2 className="mt-6 text-[11px] font-medium uppercase tracking-[0.1em] text-faint">Evidence references · {d.evidence.length}</h2>
        {d.evidence.length === 0 ? <p className="mt-2 text-[13px] text-faint">No evidence on the register.</p> : (
          <ul className="mt-2 divide-y divide-line border-y border-line">
            {d.evidence.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[13px]">
                <span className="text-ink">{e.title} <span className="text-faint">({e.type})</span></span>
                <span className="font-mono text-[10.5px] text-faint">sha256 {e.contentHash.slice(0, 16)}…</span>
              </li>
            ))}
          </ul>
        )}

        <h2 className="mt-6 text-[11px] font-medium uppercase tracking-[0.1em] text-faint">Decision</h2>
        {adj?.result ? (
          <div className="mt-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <DecisionBadge decision={adj.result.decision} />
              <time className="text-[12px] tabular text-faint">{new Date(adj.result.createdAt).toLocaleString()}</time>
              <span className={`font-mono text-[10.5px] font-semibold ${adj.mode === 'GENLAYER_TESTNET' ? 'text-mineral' : 'text-amber2'}`}>{adj.mode === 'GENLAYER_TESTNET' ? 'GENLAYER TESTNET' : 'SIMULATED · DEMO ENGINE'}</span>
            </div>
            <p className="mt-2.5 text-[13px] leading-relaxed text-slate2">{adj.result.rationale}</p>
            {adj.txId && <p className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-slate2">Adjudication reference <CopyId value={adj.txId} /> <span className="text-faint">({adj.network})</span></p>}
            {adj.contractAddress && <p className="flex flex-wrap items-center gap-2 text-[13px] text-slate2">Contract <CopyId value={adj.contractAddress} /></p>}
            {verdict?.uncertainties?.length ? <p className="mt-2 text-[13px] leading-relaxed text-slate2"><strong className="font-medium text-ink">Uncertainties:</strong> {verdict.uncertainties.join(' ')}</p> : null}
          </div>
        ) : (
          <p className="mt-2 text-[13px] text-slate2">No adjudicated decision. {settlement ? 'Settlement was authorized by party acceptance (below).' : 'This case has no decision yet.'}</p>
        )}

        <h2 className="mt-6 text-[11px] font-medium uppercase tracking-[0.1em] text-faint">Settlement</h2>
        {settlement ? (
          <div className="mt-2 border border-line bg-sidebar/50 px-4 py-3.5" style={{ borderRadius: 8 }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <DecisionBadge decision={settlement.decision} />
              <span className={`flex items-center gap-1.5 font-mono text-[11px] font-semibold ${executed ? 'text-mineral' : 'text-amber2'}`}>{executed && <Icon d={I.check} size={12} />}{executed ? 'EXECUTED' : settlement.status}</span>
            </div>
            <dl className="mt-3 space-y-1.5 text-[13px]">
              <div className="flex justify-between"><dt className="text-faint">To provider</dt><dd className="font-semibold text-ink"><Money minor={settlement.toProviderMinor} currency={settlement.currency} /></dd></div>
              <div className="flex justify-between"><dt className="text-faint">Refund to client</dt><dd className="font-semibold text-ink"><Money minor={settlement.toClientMinor} currency={settlement.currency} /></dd></div>
              <div className="flex justify-between"><dt className="text-faint">Mode</dt><dd className="font-mono text-[11.5px]">{settlement.mode}{settlement.mode === 'DEMO_LEDGER' ? ' — simulated, no real assets' : ''}</dd></div>
              {settlement.reference && <div className="flex justify-between gap-3"><dt className="text-faint">Execution reference</dt><dd><CopyId value={settlement.reference} /></dd></div>}
              {settlement.executedAt && <div className="flex justify-between"><dt className="text-faint">Executed at</dt><dd className="tabular text-slate2">{new Date(settlement.executedAt).toLocaleString()}</dd></div>}
            </dl>
            <p className="mt-3 border-t border-line pt-2.5 text-[12px] leading-relaxed text-faint">
              {executed ? 'The decision was recorded first; settlement executed afterward as a separate step. Both records exist independently for audit.' : 'Authorized but not yet executed — until execution completes, no payment has occurred.'}
            </p>
          </div>
        ) : <p className="mt-2 text-[13px] text-slate2">No settlement instruction exists for this agreement.</p>}

        <h2 className="mt-6 text-[11px] font-medium uppercase tracking-[0.1em] text-faint">Transaction references</h2>
        <ul className="mt-2 divide-y divide-line border-y border-line">
          {d.chainTxs.map((t, i) => (
            <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[13px]">
              <span className="text-slate2">{t.kind} · {t.network}</span>
              <span className="flex items-center gap-2"><span className={`font-mono text-[10px] font-semibold ${t.status === 'SIMULATED' ? 'text-amber2' : 'text-mineral'}`}>{t.status}</span><CopyId value={t.txId} /></span>
            </li>
          ))}
          {d.chainTxs.length === 0 && <li className="py-2 text-[13px] text-faint">None.</li>}
        </ul>

        <p className="mt-6 border-t border-line pt-4 text-[12px] leading-relaxed text-faint">
          In one paragraph: the parties froze criteria into terms v{version.version}; funding and work proceeded against that snapshot;{' '}
          {adj?.result ? 'a dispute was adjudicated against the cited evidence, producing the structured decision above; ' : 'no adjudication was required; '}
          {executed ? 'the authorized settlement then executed as a separately recorded step.' : 'settlement remains in the state shown — a decision alone never moves funds.'}
          {' '}Entries labelled SIMULATED are demo records, not blockchain transactions.
        </p>
      </article>
    </div>
  );
}
