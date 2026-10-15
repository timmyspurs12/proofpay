'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client/api';
import { EmptyState, Icon, I, PageHeader, Skeleton, cardCls, inputCls } from '@/components/ui';

type Row = { id: string; at: string; kind: string; agreementId: string; agreementTitle: string; actorRole: string; status: string; detail: string; reference: string };

function dayLabel(iso: string): string {
  const d = new Date(iso); const now = new Date();
  const same = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (same(d, now)) return 'Today';
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (same(d, y)) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}
function tone(status: string, kind: string): string {
  if (status === 'FAILED' || kind.includes('FAILED')) return 'bg-vermilion';
  if (status === 'SIMULATED' || status === 'PENDING') return 'bg-amber2';
  if (kind.includes('SETTLEMENT') || kind.includes('VERDICT') || kind.includes('DECID')) return 'bg-mineral';
  return 'bg-bluegrey';
}

export default function ActivityPage() {
  const [data, setData] = useState<{ rows: Row[]; kinds: string[] } | null>(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      const qs = new URLSearchParams({ q, type, role }).toString();
      api<{ rows: Row[]; kinds: string[] }>(`/api/activity?${qs}`).then(setData).catch((e) => setErr(e.message));
    }, 180);
    return () => clearTimeout(t);
  }, [q, type, role]);

  const rows = useMemo(() => (data?.rows ?? []).filter((r) => !status || r.status === status), [data, status]);
  const statuses = useMemo(() => [...new Set((data?.rows ?? []).map((r) => r.status))].sort(), [data]);
  const groups = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of rows) map.set(dayLabel(r.at), [...(map.get(dayLabel(r.at)) ?? []), r]);
    return [...map.entries()];
  }, [rows]);

  if (err) return <div className="border border-vermilion/30 bg-vermilion-tint px-4 py-3 text-[13px] text-vermilion" role="alert" style={{ borderRadius: 8 }}>{err}</div>;

  return (
    <div className="rise">
      <PageHeader title="Activity" sub="A chronological stream of persisted events across your agreements — including failed and pending operations. Nothing here is invented." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Icon d={I.search} size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
          <label className="sr-only" htmlFor="aq">Search activity</label>
          <input id="aq" className={`${inputCls} w-[230px] pl-8`} placeholder="Search detail, reference, agreement…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <label className="sr-only" htmlFor="at">Event type</label>
        <select id="at" className="h-9 border border-line2 bg-paper px-2 text-[13px] rounded-[6px]" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All event types</option>
          {(data?.kinds ?? []).map((k) => <option key={k} value={k}>{k.replaceAll('_', ' ')}</option>)}
        </select>
        <label className="sr-only" htmlFor="ar">Actor role</label>
        <select id="ar" className="h-9 border border-line2 bg-paper px-2 text-[13px] rounded-[6px]" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">All actors</option><option value="CLIENT">Client</option><option value="PROVIDER">Provider</option><option value="SYSTEM">System</option>
        </select>
        <label className="sr-only" htmlFor="as">Status</label>
        <select id="as" className="h-9 border border-line2 bg-paper px-2 text-[13px] rounded-[6px]" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {(q || type || role || status) && <button type="button" className="text-[13px] font-medium text-mineral hover:underline" onClick={() => { setQ(''); setType(''); setRole(''); setStatus(''); }}>Clear</button>}
        <span className="ml-auto text-[12px] text-faint" role="status">{rows.length} event{rows.length === 1 ? '' : 's'}</span>
      </div>

      {!data ? <Skeleton className="h-96" /> : rows.length === 0 ? (
        <EmptyState title="No activity matches" body="Adjust the search or filters. Each persona only ever sees activity on agreements they are a party to." />
      ) : (
        <div className={`${cardCls} px-4 py-1 sm:px-5`}>
          {groups.map(([label, evs]) => (
            <section key={label} aria-label={label}>
              <h2 className="border-b border-line pb-1.5 pt-3.5 text-[11px] font-medium uppercase tracking-[0.08em] text-faint">{label}</h2>
              <ul>
                {evs.map((r) => (
                  <li key={r.id} className="flex gap-3 border-b border-line py-3 last:border-b-0">
                    <span className={`mt-[6px] h-[7px] w-[7px] shrink-0 rounded-full ${tone(r.status, r.kind)}`} aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
                        <span className="font-medium text-ink">{r.kind.replaceAll('_', ' ')}</span>
                        <span className={`font-mono text-[10px] font-semibold ${r.status === 'SIMULATED' ? 'text-amber2' : r.status === 'FAILED' ? 'text-vermilion' : 'text-mineral'}`}>{r.status}</span>
                        <span className="text-[11.5px] text-faint">{r.actorRole.toLowerCase()}</span>
                      </p>
                      {r.detail && <p className="mt-0.5 truncate text-[12.5px] text-faint" title={r.detail}>{r.detail}</p>}
                      <p className="mt-0.5 flex flex-wrap gap-x-3 text-[12px]">
                        <Link href={`/app/agreements/${r.agreementId}`} className="font-medium text-mineral hover:underline">{r.agreementTitle}</Link>
                        <span className="truncate font-mono text-[10.5px] text-faint">{r.reference}</span>
                      </p>
                    </div>
                    <time className="shrink-0 text-[12px] tabular text-faint">{new Date(r.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
