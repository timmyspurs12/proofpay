'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client/api';
import { Avatar, EmptyState, Icon, I, Money, Skeleton, StatusBadge, btnGhost, btnPrimary, cardCls, inputCls, tdCls, thCls } from '@/components/ui';

type Ag = { id: string; title: string; status: string; amountMinor: number; currency: string; deadline: string; updatedAt: string; clientId: string; providerId: string; client: { id: string; name: string }; provider: { id: string; name: string }; _count: { evidence: number } };
type Dash = {
  me: { id: string; name: string; role: string };
  metrics: { totalValueMinor: number; awaitingMyAction: number; awaitingAcceptance: number; activeDisputes: number; agreementsCount: number };
  awaitingMyAction: Ag[];
  activeDisputes: { id: string; agreementTitle: string; agreementId: string; status: string }[];
  completedSettlements: { id: string; agreementTitle: string; toProviderMinor: number; toClientMinor: number; currency: string }[];
  distribution: Record<string, number>;
  agreements: Ag[];
  events: { id: string; action: string; entityId: string; detail: string; createdAt: string; actorId: string | null }[];
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
function dayLabel(iso: string): string {
  const d = new Date(iso); const now = new Date();
  const same = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (same(d, now)) return 'Today';
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (same(d, y)) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
function relTime(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - +new Date(iso)) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

type SortKey = 'recent' | 'amount-desc' | 'amount-asc' | 'title';

export default function WorkspacePage() {
  const [d, setD] = useState<Dash | null>(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');
  const router = useRouter();
  useEffect(() => { api<Dash>('/api/dashboard').then(setD).catch((e) => setErr(e.message)); }, []);

  const agreements = useMemo(() => {
    let rows = d?.agreements ?? [];
    if (q) rows = rows.filter((a) => `${a.title} ${a.id} ${a.client.name} ${a.provider.name}`.toLowerCase().includes(q.toLowerCase()));
    const sorted = [...rows];
    if (sort === 'amount-desc') sorted.sort((a, b) => b.amountMinor - a.amountMinor);
    if (sort === 'amount-asc') sorted.sort((a, b) => a.amountMinor - b.amountMinor);
    if (sort === 'title') sorted.sort((a, b) => a.title.localeCompare(b.title));
    if (sort === 'recent') sorted.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
    return sorted;
  }, [d, q, sort]);

  const groupedEvents = useMemo(() => {
    const groups = new Map<string, Dash['events']>();
    for (const e of d?.events.slice(0, 14) ?? []) {
      const k = dayLabel(e.createdAt);
      groups.set(k, [...(groups.get(k) ?? []), e]);
    }
    return [...groups.entries()];
  }, [d]);

  if (err) return <div className="border border-vermilion/30 bg-vermilion-tint px-4 py-3 text-[13px] text-vermilion" role="alert" style={{ borderRadius: 8 }}>{err}</div>;
  if (!d) return <div className="space-y-4" aria-busy="true"><Skeleton className="h-9 w-72" /><Skeleton className="h-[72px]" /><div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]"><Skeleton className="h-80" /><Skeleton className="h-80" /></div></div>;

  const dist = d.distribution;
  const activeCount = Object.entries(dist).filter(([s]) => !['SETTLED', 'CANCELLED', 'EXPIRED', 'DRAFT'].includes(s)).reduce((n, [, c]) => n + c, 0);
  const pendingSettlement = (dist.SETTLEMENT_PENDING ?? 0) + (dist.DECIDED ?? 0) + (dist.SETTLEMENT_FAILED ?? 0);
  const metrics = [
    { label: 'Active agreements', value: activeCount, href: '/app/agreements', hint: `${d.metrics.agreementsCount} total · ${formatHint(d.metrics.totalValueMinor)} funded` },
    { label: 'Awaiting acceptance', value: d.metrics.awaitingAcceptance, href: '/app/agreements?status=UNDER_REVIEW', hint: 'Work submitted, review due' },
    { label: 'Open disputes', value: d.metrics.activeDisputes, href: '/app/disputes', hint: 'Cases needing evidence or a decision', alert: d.metrics.activeDisputes > 0 },
    { label: 'Pending settlement', value: pendingSettlement, href: '/app/agreements?status=SETTLEMENT_PENDING', hint: 'Authorized, not yet executed', alert: (dist.SETTLEMENT_FAILED ?? 0) > 0 },
  ];
  const soon = (d.agreements ?? []).filter((a) => !['SETTLED', 'CANCELLED', 'EXPIRED'].includes(a.status) && +new Date(a.deadline) - Date.now() < 7 * 86400_000 && +new Date(a.deadline) > Date.now());

  return (
    <div className="rise">
      <div className="mb-1 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight text-ink">{greeting()}, {d.me.name.split(' ')[0]}. Here&rsquo;s your payment operations.</h1>
          <p className="mt-0.5 text-[13px] text-faint">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · Signed in as {d.me.role.toLowerCase()} · Demo workspace
          </p>
        </div>
        <Link href="/app/agreements/new" className={btnPrimary}><Icon d={I.plus} size={14} /> New agreement</Link>
      </div>

      {/* Operational summary — compact metric row */}
      <dl className="mt-5 grid grid-cols-2 border border-line bg-paper shadow-card lg:grid-cols-4" style={{ borderRadius: 10 }} aria-label="Operational summary">
        {metrics.map((m, i) => (
          <Link key={m.label} href={m.href} className={`group px-4 py-3.5 transition-colors duration-fast hover:bg-sidebar ${i > 0 ? 'border-l border-line' : ''} ${i >= 2 ? 'max-lg:border-t max-lg:border-line' : ''} ${i === 2 ? 'max-lg:border-l-0' : ''}`}>
            <dt className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-faint">
              {m.alert && <span className="h-1.5 w-1.5 rounded-full bg-vermilion" aria-hidden="true" />}{m.label}
            </dt>
            <dd className="mt-1 flex items-baseline gap-2">
              <span className="tabular text-[22px] font-semibold leading-none tracking-tight text-ink">{m.value}</span>
              <span className="truncate text-[11.5px] text-faint">{m.hint}</span>
            </dd>
          </Link>
        ))}
      </dl>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1.65fr_1fr]">
        {/* Recent agreements table */}
        <section aria-label="Recent agreements">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="text-[14px] font-semibold text-ink">Recent agreements</h2>
            <div className="ml-auto flex items-center gap-2">
              <label className="sr-only" htmlFor="ov-q">Search agreements</label>
              <div className="relative">
                <Icon d={I.search} size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
                <input id="ov-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className={`${inputCls} w-[180px] pl-8`} />
              </div>
              <label className="sr-only" htmlFor="ov-sort">Sort agreements</label>
              <select id="ov-sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="h-9 border border-line2 bg-paper px-2 text-[13px] rounded-[6px]">
                <option value="recent">Last activity</option>
                <option value="amount-desc">Amount · high to low</option>
                <option value="amount-asc">Amount · low to high</option>
                <option value="title">Title A–Z</option>
              </select>
              <Link href="/app/agreements" className="text-[13px] font-medium text-mineral hover:underline">View all</Link>
            </div>
          </div>

          {agreements.length === 0 ? (
            <EmptyState title={q ? 'No agreements match your search' : 'No agreements yet'}
              body={q ? 'Try a different title, counterparty or agreement ID.' : 'Create your first agreement: define deliverables and objective criteria, then fund it as a separate explicit step.'}
              action={!q && <Link href="/app/agreements/new" className={btnPrimary}>Create agreement</Link>} />
          ) : (
            <div className={`${cardCls} overflow-x-auto`}>
              <table className="w-full min-w-[560px]">
                <thead><tr className="border-b border-line bg-sidebar/60">
                  <th className={thCls}>Agreement</th><th className={thCls}>Counterparty</th><th className={`${thCls} text-right`}>Amount</th><th className={thCls}>Stage</th><th className={`${thCls} text-right`}>Last activity</th><th className="w-8"><span className="sr-only">Open</span></th>
                </tr></thead>
                <tbody className="divide-y divide-line">
                  {agreements.map((a) => {
                    const counterparty = a.clientId === d.me.id ? a.provider : a.client;
                    return (
                      <tr key={a.id} onClick={() => router.push(`/app/agreements/${a.id}`)} className="cursor-pointer transition-colors duration-fast hover:bg-sidebar/70" tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/app/agreements/${a.id}`); }} aria-label={`Open ${a.title}`}>
                        <td className={tdCls}>
                          <span className="block max-w-[260px] truncate font-medium text-ink">{a.title}</span>
                          <span className="block font-mono text-[10.5px] text-faint">{a.id} · {a._count.evidence} evidence</span>
                        </td>
                        <td className={tdCls}><span className="flex items-center gap-2 text-slate2"><Avatar name={counterparty.name} size={22} />{counterparty.name}</span></td>
                        <td className={`${tdCls} text-right`}><Money minor={a.amountMinor} currency={a.currency} className="font-medium text-ink" /></td>
                        <td className={tdCls}><StatusBadge status={a.status} /></td>
                        <td className={`${tdCls} text-right whitespace-nowrap text-faint`}>{relTime(a.updatedAt)}</td>
                        <td className="pr-2 text-faint"><Icon d={I.chevronR} size={14} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Requires attention */}
        <section aria-label="Requires attention">
          <h2 className="mb-3 flex items-center gap-2 text-[14px] font-semibold text-ink">Requires attention
            {(d.awaitingMyAction.length + d.activeDisputes.length + soon.length) > 0 && (
              <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-vermilion px-1 text-[10px] font-semibold text-white">{d.awaitingMyAction.length + d.activeDisputes.length + soon.length}</span>
            )}
          </h2>
          <div className={`${cardCls} divide-y divide-line`}>
            {d.activeDisputes.map((x) => (
              <Link key={x.id} href={`/app/disputes/${x.id}`} className="flex gap-3 px-4 py-3 transition-colors duration-fast hover:bg-sidebar/70">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-vermilion-tint text-vermilion"><Icon d={I.disputes} size={14} /></span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-ink">{x.agreementTitle}</span>
                  <span className="block text-[12px] leading-snug text-faint">Dispute {x.status.toLowerCase().replaceAll('_', ' ')} — review evidence and respond in the case workspace.</span>
                </span>
                <Icon d={I.chevronR} size={14} className="ml-auto shrink-0 self-center text-faint" />
              </Link>
            ))}
            {d.awaitingMyAction.map((a) => (
              <Link key={a.id} href={`/app/agreements/${a.id}`} className="flex gap-3 px-4 py-3 transition-colors duration-fast hover:bg-sidebar/70">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber2-tint text-amber2"><Icon d={I.clock} size={14} /></span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-ink">{a.title}</span>
                  <span className="block text-[12px] leading-snug text-faint">
                    {a.status === 'CREATED' && 'Created but unfunded — funding freezes the terms and starts the work.'}
                    {a.status === 'FUNDED' && 'Funded — the provider can submit work against the criteria.'}
                    {a.status === 'UNDER_REVIEW' && 'Work is awaiting your acceptance decision.'}
                    {a.status === 'ADDITIONAL_EVIDENCE_REQUIRED' && 'Adjudication needs more evidence before it can decide.'}
                    {a.status === 'SETTLEMENT_FAILED' && 'Settlement execution failed — it is safe to retry.'}
                    {!['CREATED', 'FUNDED', 'UNDER_REVIEW', 'ADDITIONAL_EVIDENCE_REQUIRED', 'SETTLEMENT_FAILED'].includes(a.status) && `Currently ${a.status.toLowerCase().replaceAll('_', ' ')}.`}
                  </span>
                </span>
                <Icon d={I.chevronR} size={14} className="ml-auto shrink-0 self-center text-faint" />
              </Link>
            ))}
            {soon.filter((a) => !d.awaitingMyAction.some((x) => x.id === a.id)).map((a) => (
              <Link key={a.id} href={`/app/agreements/${a.id}`} className="flex gap-3 px-4 py-3 transition-colors duration-fast hover:bg-sidebar/70">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bluegrey-tint text-bluegrey"><Icon d={I.clock} size={14} /></span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-ink">{a.title}</span>
                  <span className="block text-[12px] text-faint">Deadline {new Date(a.deadline).toLocaleDateString()} — approaching within 7 days.</span>
                </span>
                <Icon d={I.chevronR} size={14} className="ml-auto shrink-0 self-center text-faint" />
              </Link>
            ))}
            {d.awaitingMyAction.length === 0 && d.activeDisputes.length === 0 && soon.length === 0 && (
              <p className="px-4 py-8 text-center text-[13px] text-faint">All clear. Nothing needs your attention right now.</p>
            )}
          </div>

          {d.completedSettlements.length > 0 && (
            <>
              <h2 className="mb-3 mt-6 text-[14px] font-semibold text-ink">Recently settled</h2>
              <ul className={`${cardCls} divide-y divide-line`}>
                {d.completedSettlements.map((s) => (
                  <li key={s.id} className="flex items-center gap-2.5 px-4 py-2.5 text-[13px]">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-mineral-tint text-mineral"><Icon d={I.check} size={12} /></span>
                    <span className="min-w-0 flex-1 truncate text-slate2">{s.agreementTitle}</span>
                    <Money minor={s.toProviderMinor + s.toClientMinor} currency={s.currency} className="font-medium text-ink" />
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      {/* Recent activity — grouped feed */}
      <section className="mt-8" aria-label="Recent activity">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[14px] font-semibold text-ink">Recent activity</h2>
          <Link href="/app/activity" className="text-[13px] font-medium text-mineral hover:underline">Open explorer</Link>
        </div>
        {groupedEvents.length === 0 ? (
          <EmptyState title="No activity yet" body="Agreement, evidence, adjudication and settlement events will appear here as they happen — nothing is fabricated." />
        ) : (
          <div className={`${cardCls} px-4 py-2 sm:px-5`}>
            {groupedEvents.map(([label, evs]) => (
              <div key={label} className="py-2">
                <p className="py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-faint">{label}</p>
                <ul>
                  {evs.map((e) => (
                    <li key={e.id} className="flex gap-3 border-t border-line py-2.5 first:border-t-0">
                      <span className="mt-[5px] h-[7px] w-[7px] shrink-0 rounded-full bg-mineral" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px]"><span className="font-medium text-ink">{e.action.replaceAll('_', ' ')}</span>{e.detail && <span className="text-faint"> — {e.detail}</span>}</p>
                      </div>
                      <time className="shrink-0 text-[12px] text-faint">{relTime(e.createdAt)}</time>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function formatHint(minor: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(minor / 100);
}
