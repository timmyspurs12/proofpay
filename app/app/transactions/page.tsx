'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client/api';
import { CopyId, EmptyState, Icon, I, PageHeader, Skeleton, cardCls, inputCls, tdCls, thCls } from '@/components/ui';

type Row = { id: string; at: string; kind: string; agreementId: string; agreementTitle: string; actorRole: string; status: string; detail: string; reference: string };

const KIND_LABEL: Record<string, string> = {
  TX_FUNDING: 'Funding', TX_ADJUDICATION: 'Adjudication', TX_SETTLEMENT: 'Settlement execution', SETTLEMENT: 'Settlement instruction',
};

export default function TransactionsPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    api<{ rows: Row[] }>(`/api/activity?type=`).then((d) => {
      setRows(d.rows.filter((r) => r.kind.startsWith('TX_') || r.kind === 'SETTLEMENT'));
    }).catch((e) => setErr(e.message));
  }, []);

  const filtered = useMemo(() => (rows ?? []).filter((r) =>
    (!kind || r.kind === kind) && (!status || r.status === status) &&
    (!q || `${r.reference} ${r.agreementTitle} ${r.detail} ${r.kind}`.toLowerCase().includes(q.toLowerCase()))), [rows, q, kind, status]);
  const statuses = useMemo(() => [...new Set((rows ?? []).map((r) => r.status))].sort(), [rows]);

  if (err) return <div className="border border-vermilion/30 bg-vermilion-tint px-4 py-3 text-[13px] text-vermilion" role="alert" style={{ borderRadius: 8 }}>{err}</div>;

  return (
    <div className="rise">
      <PageHeader title="Transactions" sub="Funding, adjudication and settlement records. A decision is not a transaction, and a pending transaction is never shown as a confirmed settlement." />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Icon d={I.search} size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
          <label className="sr-only" htmlFor="tq">Search transactions</label>
          <input id="tq" className={`${inputCls} w-[230px] pl-8`} placeholder="Search reference, agreement…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <label className="sr-only" htmlFor="tk">Type</label>
        <select id="tk" className="h-9 border border-line2 bg-paper px-2 text-[13px] rounded-[6px]" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">All types</option>
          {Object.entries(KIND_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <label className="sr-only" htmlFor="ts">Execution state</label>
        <select id="ts" className="h-9 border border-line2 bg-paper px-2 text-[13px] rounded-[6px]" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All states</option>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="ml-auto text-[12px] text-faint" role="status">{filtered.length} record{filtered.length === 1 ? '' : 's'}</span>
      </div>

      {!rows ? <Skeleton className="h-80" /> : filtered.length === 0 ? (
        <EmptyState title="No transactions match" body="Funding an agreement, requesting adjudication or executing a settlement creates records here — simulated ones keep their SIMULATED label." />
      ) : (
        <div className={`${cardCls} overflow-x-auto`}>
          <table className="w-full min-w-[760px]">
            <thead><tr className="border-b border-line bg-sidebar/60">
              <th className={thCls}>Reference</th><th className={thCls}>Type</th><th className={thCls}>Agreement</th><th className={thCls}>Network / detail</th><th className={thCls}>Execution state</th><th className={`${thCls} text-right`}>Timestamp</th>
            </tr></thead>
            <tbody className="divide-y divide-line">
              {filtered.map((r) => (
                <tr key={r.id} className="transition-colors duration-fast hover:bg-sidebar/60">
                  <td className={tdCls}><CopyId value={r.reference} /></td>
                  <td className={`${tdCls} whitespace-nowrap font-medium text-ink`}>{KIND_LABEL[r.kind] ?? r.kind.replaceAll('_', ' ')}</td>
                  <td className={tdCls}><Link href={`/app/agreements/${r.agreementId}`} className="font-medium text-mineral hover:underline">{r.agreementTitle}</Link></td>
                  <td className={`${tdCls} max-w-[300px]`}><span className="block truncate text-slate2" title={r.detail}>{r.detail}</span></td>
                  <td className={tdCls}>
                    <span className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold ${r.status === 'SIMULATED' ? 'text-amber2' : r.status === 'FAILED' ? 'text-vermilion' : r.status === 'PENDING' ? 'text-amber2' : 'text-mineral'}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${r.status === 'SIMULATED' || r.status === 'PENDING' ? 'bg-amber2' : r.status === 'FAILED' ? 'bg-vermilion' : 'bg-mineral'} ${r.status === 'PENDING' ? 'pulse-dot' : ''}`} />
                      {r.status}
                    </span>
                  </td>
                  <td className={`${tdCls} whitespace-nowrap text-right tabular text-faint`}>{new Date(r.at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-[12px] leading-relaxed text-faint">
        Explorer links are shown only when a real GenLayer transaction exists (live mode). In this demo workspace every reference is a
        simulated <span className="font-mono">demo-tx-…</span> identifier, so no explorer link is presented rather than fabricating one.
      </p>
    </div>
  );
}
