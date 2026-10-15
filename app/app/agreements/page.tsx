'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/client/api';
import { Avatar, EmptyState, Icon, I, Money, PageHeader, Skeleton, StatusBadge, btnGhost, btnPrimary, cardCls, inputCls, tdCls, thCls } from '@/components/ui';

type Row = { id: string; title: string; description: string; status: string; amountMinor: number; currency: string; deadline: string; updatedAt: string; createdAt: string; clientId: string; providerId: string; client: { id: string; name: string }; provider: { id: string; name: string }; _count: { evidence: number } };

const STATUSES = ['', 'CREATED', 'FUNDED', 'SUBMITTED', 'UNDER_REVIEW', 'DISPUTED', 'ADJUDICATING', 'ADDITIONAL_EVIDENCE_REQUIRED', 'DECIDED', 'SETTLEMENT_PENDING', 'SETTLEMENT_FAILED', 'SETTLED', 'CANCELLED'];
const PAGE = 10;
type SortKey = 'recent' | 'amount-desc' | 'amount-asc' | 'deadline' | 'title';

function AgreementsInner() {
  const search = useSearchParams();
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [meId, setMeId] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(search.get('status') ?? '');
  const [counterparty, setCounterparty] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');
  const [shown, setShown] = useState(PAGE);
  const [err, setErr] = useState('');

  useEffect(() => {
    api<Row[]>('/api/agreements').then(setRows).catch((e) => setErr(e.message));
    api<{ user: { id: string } | null }>('/api/auth/me').then((m) => setMeId(m.user?.id ?? '')).catch(() => {});
  }, []);
  useEffect(() => { setStatus(search.get('status') ?? ''); }, [search]);

  const counterparties = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of rows ?? []) {
      map.set(a.client.id, a.client.name);
      map.set(a.provider.id, a.provider.name);
    }
    if (meId) map.delete(meId);
    return [...map.entries()];
  }, [rows, meId]);

  const filtered = useMemo(() => {
    let out = (rows ?? []).filter((a) =>
      (!status || a.status === status) &&
      (!counterparty || a.client.id === counterparty || a.provider.id === counterparty) &&
      (!q || `${a.title} ${a.id} ${a.description} ${a.client.name} ${a.provider.name}`.toLowerCase().includes(q.toLowerCase())));
    out = [...out];
    if (sort === 'amount-desc') out.sort((a, b) => b.amountMinor - a.amountMinor);
    if (sort === 'amount-asc') out.sort((a, b) => a.amountMinor - b.amountMinor);
    if (sort === 'deadline') out.sort((a, b) => +new Date(a.deadline) - +new Date(b.deadline));
    if (sort === 'title') out.sort((a, b) => a.title.localeCompare(b.title));
    if (sort === 'recent') out.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
    return out;
  }, [rows, q, status, counterparty, sort]);

  if (err) return <div className="border border-vermilion/30 bg-vermilion-tint px-4 py-3 text-[13px] text-vermilion" role="alert" style={{ borderRadius: 8 }}>{err}</div>;

  return (
    <div className="rise">
      <PageHeader title="Agreements" sub="Every case file where you are client or provider. Rows open the full agreement workspace."
        actions={<Link href="/app/agreements/new" className={btnPrimary}><Icon d={I.plus} size={14} /> New agreement</Link>} />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Icon d={I.search} size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
          <label className="sr-only" htmlFor="q">Search agreements</label>
          <input id="q" className={`${inputCls} w-[220px] pl-8`} placeholder="Search title, ID, party…" value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE); }} />
        </div>
        <label className="sr-only" htmlFor="st">Status filter</label>
        <select id="st" className="h-9 border border-line2 bg-paper px-2 text-[13px] rounded-[6px]" value={status} onChange={(e) => { setStatus(e.target.value); setShown(PAGE); }}>
          {STATUSES.map((s) => <option key={s} value={s}>{s ? s.replaceAll('_', ' ').toLowerCase() : 'All stages'}</option>)}
        </select>
        <label className="sr-only" htmlFor="cp">Counterparty filter</label>
        <select id="cp" className="h-9 border border-line2 bg-paper px-2 text-[13px] rounded-[6px]" value={counterparty} onChange={(e) => { setCounterparty(e.target.value); setShown(PAGE); }}>
          <option value="">All counterparties</option>
          {counterparties.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <label className="sr-only" htmlFor="so">Sort</label>
        <select id="so" className="h-9 border border-line2 bg-paper px-2 text-[13px] rounded-[6px]" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
          <option value="recent">Last activity</option>
          <option value="deadline">Deadline · soonest</option>
          <option value="amount-desc">Amount · high to low</option>
          <option value="amount-asc">Amount · low to high</option>
          <option value="title">Title A–Z</option>
        </select>
        {(q || status || counterparty) && (
          <button type="button" className="text-[13px] font-medium text-mineral hover:underline" onClick={() => { setQ(''); setStatus(''); setCounterparty(''); }}>Clear filters</button>
        )}
        <span className="ml-auto text-[12px] text-faint" role="status">{filtered.length} agreement{filtered.length === 1 ? '' : 's'}</span>
      </div>

      {!rows ? <Skeleton className="h-80" /> : filtered.length === 0 ? (
        <EmptyState title="No agreements match these filters" body="Adjust the search or filters — or create a new agreement. Only agreements where you are a party are ever listed."
          action={<Link href="/app/agreements/new" className={btnPrimary}>Create agreement</Link>} />
      ) : (
        <>
          <div className={`${cardCls} overflow-x-auto`}>
            <table className="w-full min-w-[720px]">
              <thead><tr className="border-b border-line bg-sidebar/60">
                <th className={thCls}>Agreement</th><th className={thCls}>Counterparty</th><th className={thCls}>Your role</th><th className={`${thCls} text-right`}>Amount</th><th className={thCls}>Stage</th><th className={thCls}>Deadline</th><th className={`${thCls} text-right`}>Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-line">
                {filtered.slice(0, shown).map((a) => {
                  const mine = a.clientId === meId ? 'Client' : 'Provider';
                  const other = a.clientId === meId ? a.provider : a.client;
                  return (
                    <tr key={a.id} onClick={() => router.push(`/app/agreements/${a.id}`)} tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/app/agreements/${a.id}`); }}
                      className="cursor-pointer transition-colors duration-fast hover:bg-sidebar/70" aria-label={`Open ${a.title}`}>
                      <td className={tdCls}>
                        <span className="block max-w-[280px] truncate font-medium text-ink">{a.title}</span>
                        <span className="block font-mono text-[10.5px] text-faint">{a.id} · {a._count.evidence} evidence</span>
                      </td>
                      <td className={tdCls}><span className="flex items-center gap-2 text-slate2"><Avatar name={other.name} size={22} />{other.name}</span></td>
                      <td className={`${tdCls} text-slate2`}>{mine}</td>
                      <td className={`${tdCls} text-right`}><Money minor={a.amountMinor} currency={a.currency} className="font-medium text-ink" /></td>
                      <td className={tdCls}><StatusBadge status={a.status} /></td>
                      <td className={`${tdCls} whitespace-nowrap text-slate2`}>{new Date(a.deadline).toLocaleDateString()}</td>
                      <td className={`${tdCls} text-right`} onClick={(e) => e.stopPropagation()}>
                        <span className="inline-flex gap-1.5">
                          <Link href={`/app/agreements/${a.id}/evidence`} className="inline-flex h-7 items-center rounded-[6px] border border-line2 bg-paper px-2 text-[12px] font-medium text-slate2 transition hover:bg-sidebar hover:text-ink">Evidence</Link>
                          <Link href={`/app/agreements/${a.id}`} className="inline-flex h-7 items-center rounded-[6px] bg-midnight px-2 text-[12px] font-medium text-white transition hover:bg-black">Open</Link>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length > shown && (
            <div className="mt-3 text-center">
              <button type="button" className={btnGhost} onClick={() => setShown((s) => s + PAGE)}>Load more ({filtered.length - shown} remaining)</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function AgreementsPage() {
  return <Suspense fallback={<Skeleton className="h-80" />}><AgreementsInner /></Suspense>;
}
