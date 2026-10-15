'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client/api';
import { DecisionBadge, EmptyState, Icon, I, Money, PageHeader, Skeleton, StatusBadge, cardCls, inputCls, tdCls, thCls } from '@/components/ui';

type DRow = { id: string; status: string; reason: string; criterionId: string; createdAt: string; agreementId: string; agreementTitle: string; amountMinor: number; currency: string; agreementStatus: string; latestDecision: string | null };
type AgDetail = { agreement: { id: string; title: string; status: string; amountMinor: number; currency: string }; disputes: { id: string; status: string; reason: string; criterionId: string; createdAt: string; adjudications: { result: { decision: string } | null }[] }[] };

const FILTERS = ['', 'OPEN', 'EVIDENCE', 'ADJUDICATING', 'NEEDS_EVIDENCE', 'DECIDED', 'CLOSED'];

export default function DisputesPage() {
  const [rows, setRows] = useState<DRow[] | null>(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const agreements = await api<{ id: string }[]>('/api/agreements');
        const details = await Promise.all(agreements.map((a) => api<AgDetail>(`/api/agreements/${a.id}`).catch(() => null)));
        const out: DRow[] = [];
        for (const d of details) {
          if (!d) continue;
          for (const x of d.disputes) {
            out.push({
              id: x.id, status: x.status, reason: x.reason, criterionId: x.criterionId, createdAt: x.createdAt,
              agreementId: d.agreement.id, agreementTitle: d.agreement.title, amountMinor: d.agreement.amountMinor,
              currency: d.agreement.currency, agreementStatus: d.agreement.status,
              latestDecision: x.adjudications.find((a) => a.result)?.result?.decision ?? null,
            });
          }
        }
        setRows(out.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)));
      } catch (e) { setErr(e instanceof Error ? e.message : 'Could not load disputes'); }
    })();
  }, []);

  const filtered = useMemo(() => (rows ?? []).filter((r) => (!status || r.status === status) && (!q || `${r.agreementTitle} ${r.id} ${r.reason}`.toLowerCase().includes(q.toLowerCase()))), [rows, q, status]);

  if (err) return <div className="border border-vermilion/30 bg-vermilion-tint px-4 py-3 text-[13px] text-vermilion" role="alert" style={{ borderRadius: 8 }}>{err}</div>;

  return (
    <div className="rise">
      <PageHeader title="Disputes" sub="Case-review workspaces. A dispute pins the exact funded terms version it will be judged against." />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Icon d={I.search} size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
          <label className="sr-only" htmlFor="dq">Search disputes</label>
          <input id="dq" className={`${inputCls} w-[220px] pl-8`} placeholder="Search case, agreement, reason…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Dispute status filter">
          {FILTERS.map((s) => (
            <button key={s} type="button" onClick={() => setStatus(s)} aria-pressed={status === s}
              className={`h-8 rounded-[6px] border px-2.5 text-[12.5px] font-medium transition-colors duration-fast ${status === s ? 'border-midnight bg-midnight text-white' : 'border-line2 bg-paper text-slate2 hover:bg-sidebar hover:text-ink'}`}>
              {s ? s.replaceAll('_', ' ').toLowerCase() : 'All'}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[12px] text-faint" role="status">{filtered.length} case{filtered.length === 1 ? '' : 's'}</span>
      </div>

      {!rows ? <Skeleton className="h-80" /> : filtered.length === 0 ? (
        <EmptyState title="No disputes" body="Disputes are opened from an agreement's case file while work is under review. When one exists, its evidence, adjudication and settlement live in the case workspace."
          action={<Link href="/app/agreements" className="inline-flex h-8 items-center rounded-[6px] bg-mineral px-3 text-[13px] font-medium text-white hover:bg-mineral-deep">Open agreements</Link>} />
      ) : (
        <div className={`${cardCls} overflow-x-auto`}>
          <table className="w-full min-w-[680px]">
            <thead><tr className="border-b border-line bg-sidebar/60">
              <th className={thCls}>Case</th><th className={thCls}>Disputed criterion</th><th className={`${thCls} text-right`}>Amount at stake</th><th className={thCls}>Case state</th><th className={thCls}>Decision</th><th className={`${thCls} text-right`}>Opened</th>
            </tr></thead>
            <tbody className="divide-y divide-line">
              {filtered.map((r) => (
                <tr key={r.id} onClick={() => router.push(`/app/disputes/${r.id}`)} tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/app/disputes/${r.id}`); }}
                  className="cursor-pointer transition-colors duration-fast hover:bg-sidebar/70" aria-label={`Open dispute case for ${r.agreementTitle}`}>
                  <td className={tdCls}>
                    <span className="block max-w-[280px] truncate font-medium text-ink">{r.agreementTitle}</span>
                    <span className="block max-w-[280px] truncate text-[12px] text-faint">{r.reason}</span>
                    <span className="block font-mono text-[10.5px] text-faint">{r.id}</span>
                  </td>
                  <td className={tdCls}>{r.criterionId ? <span className="font-mono text-[12px] font-medium text-vermilion">{r.criterionId}</span> : <span className="text-faint">Whole delivery</span>}</td>
                  <td className={`${tdCls} text-right`}><Money minor={r.amountMinor} currency={r.currency} className="font-medium text-ink" /></td>
                  <td className={tdCls}><StatusBadge status={r.status === 'EVIDENCE' || r.status === 'OPEN' ? 'DISPUTED' : r.status} /></td>
                  <td className={tdCls}>{r.latestDecision ? <DecisionBadge decision={r.latestDecision} /> : <span className="text-[12.5px] text-faint">Not decided</span>}</td>
                  <td className={`${tdCls} whitespace-nowrap text-right text-faint`}>{new Date(r.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
