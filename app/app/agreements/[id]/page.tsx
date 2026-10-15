'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, post } from '@/lib/client/api';
import { Avatar, ConfirmModal, CopyId, DecisionBadge, EmptyState, Icon, I, ModeBadge, Money, Skeleton, StatusBadge, btnDanger, btnGhost, btnPrimary, cardCls, inputCls, labelCls, textareaCls, useToast } from '@/components/ui';

type Detail = {
  agreement: { id: string; title: string; description: string; status: string; amountMinor: number; currency: string; deadline: string; reviewDays: number; isDemo: boolean; clientId: string; providerId: string; createdAt: string; client: { name: string }; provider: { name: string } };
  versions: { id: string; version: number; termsHash: string; changeNote: string; createdAt: string; snapshotParsed: { deliverables: { id: string; title: string; description: string }[]; criteria: { id: string; deliverableId: string; text: string }[]; evidenceRequirements: string; settlementTerms: { allowPartial: boolean; notes: string } }; approvedByParsed: string[] }[];
  funding: { amountMinor: number; currency: string; method: string; status: string; reference: string; createdAt: string } | null;
  evidence: { id: string; type: string; title: string; criterionId: string; contentHash: string; createdAt: string; submittedBy: { name: string } }[];
  disputes: { id: string; reason: string; status: string; criterionId: string; createdAt: string; adjudications: { id: string; mode: string; status: string; txId: string; result: { decision: string } | null }[] }[];
  settlements: { id: string; decision: string; toProviderMinor: number; toClientMinor: number; currency: string; status: string; mode: string; reference: string }[];
  chainTxs: { id: string; kind: string; network: string; txId: string; status: string; detail: string; createdAt: string }[];
  events: { id: string; action: string; detail: string; createdAt: string; actorId: string | null }[];
  myRole: 'CLIENT' | 'PROVIDER';
};

const TABS = ['Overview', 'Timeline', 'Transactions'] as const;

export default function AgreementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [confirm, setConfirm] = useState<null | 'fund' | 'accept' | 'settle'>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>('Overview');
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeCriterion, setDisputeCriterion] = useState('');
  const [submitNote, setSubmitNote] = useState('');
  const [failSim, setFailSim] = useState(false);

  const load = useCallback(() => { api<Detail>(`/api/agreements/${id}`).then(setD).catch((e) => setErr(e.message)); }, [id]);
  useEffect(() => { load(); }, [load]);

  if (err) return <div className="border border-vermilion/30 bg-vermilion-tint px-4 py-3 text-[13px] text-vermilion" role="alert" style={{ borderRadius: 8 }}>{err}</div>;
  if (!d) return <div className="space-y-4" aria-busy="true"><Skeleton className="h-24" /><Skeleton className="h-96" /></div>;

  const a = d.agreement;
  const version = d.versions[d.versions.length - 1];
  const snap = version.snapshotParsed;
  const settlement = d.settlements[0];
  const openDispute = d.disputes[0];

  const act = async (key: string, fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(key);
    try { await fn(); toast(okMsg); load(); } catch (e) { toast(e instanceof Error ? e.message : 'Action failed', 'err'); }
    setBusy(''); setConfirm(null);
  };

  return (
    <div className="rise">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[20px] font-semibold tracking-tight text-ink">{a.title}</h1>
            <StatusBadge status={a.status} />
            <ModeBadge mode={a.isDemo ? 'DEMO_SIMULATED' : 'GENLAYER_TESTNET'} />
          </div>
          {a.description && <p className="mt-1 text-[13px] leading-relaxed text-faint">{a.description}</p>}
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-faint">
            <CopyId value={a.id} label="agreement ID" />
            <span aria-hidden="true">·</span><span>You are the {d.myRole.toLowerCase()}</span>
            <span aria-hidden="true">·</span><span>Created {new Date(a.createdAt).toLocaleDateString()}</span>
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="tabular text-[22px] font-semibold leading-none text-ink"><Money minor={a.amountMinor} currency={a.currency} /></p>
          <p className="mt-1 text-[12px] text-faint">Deadline {new Date(a.deadline).toLocaleDateString()} · {a.reviewDays}-day review</p>
        </div>
      </div>

      {/* Action bar */}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-y border-line py-3" role="group" aria-label="Agreement actions">
        {a.status === 'CREATED' && d.myRole === 'CLIENT' && (
          <button type="button" className={btnPrimary} onClick={() => setConfirm('fund')}>Fund agreement</button>
        )}
        {a.status === 'FUNDED' && d.myRole === 'PROVIDER' && (
          <>
            <label className="sr-only" htmlFor="note">Submission note</label>
            <input id="note" className={`${inputCls} w-[220px]`} placeholder="Submission note (optional)" value={submitNote} onChange={(e) => setSubmitNote(e.target.value)} />
            <button type="button" className={btnPrimary} disabled={busy === 'submit'} onClick={() => act('submit', () => post(`/api/agreements/${id}/submit`, { note: submitNote }), 'Work submitted. The client can now accept it or dispute a specific criterion.')}>
              {busy === 'submit' ? 'Submitting…' : 'Submit work for review'}
            </button>
          </>
        )}
        {a.status === 'UNDER_REVIEW' && d.myRole === 'CLIENT' && (
          <button type="button" className={btnPrimary} onClick={() => setConfirm('accept')}>Accept work & authorize settlement</button>
        )}
        {settlement && ['AUTHORIZED', 'FAILED'].includes(settlement.status) && ['DECIDED', 'SETTLEMENT_PENDING', 'SETTLEMENT_FAILED'].includes(a.status) && (
          <>
            <button type="button" className={btnPrimary} onClick={() => setConfirm('settle')}>{settlement.status === 'FAILED' ? 'Retry settlement' : 'Execute settlement'}</button>
            <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-faint">
              <input type="checkbox" checked={failSim} onChange={(e) => setFailSim(e.target.checked)} className="h-3.5 w-3.5" />
              Simulate failure (retry-path test)
            </label>
          </>
        )}
        <Link href={`/app/agreements/${id}/evidence`} className={btnGhost}><Icon d={I.evidence} size={14} /> Evidence studio</Link>
        {openDispute && <Link href={`/app/disputes/${openDispute.id}`} className={btnDanger}><Icon d={I.disputes} size={14} /> Dispute centre</Link>}
        {a.status === 'SETTLED' && <Link href={`/app/receipts/${id}`} className={btnGhost}>Settlement receipt</Link>}
        {a.status === 'UNDER_REVIEW' && d.myRole === 'PROVIDER' && <span className="text-[12.5px] text-faint">Awaiting the client&rsquo;s acceptance decision.</span>}
        {a.status === 'FUNDED' && d.myRole === 'CLIENT' && <span className="text-[12.5px] text-faint">Funded. Awaiting the provider&rsquo;s submission.</span>}
        {a.status === 'CREATED' && d.myRole === 'PROVIDER' && <span className="text-[12.5px] text-faint">Unfunded. Awaiting the client&rsquo;s funding.</span>}
      </div>

      {/* Tabs */}
      <div className="mt-4 flex gap-1 border-b border-line" role="tablist" aria-label="Case file sections">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} type="button" onClick={() => setTab(t)}
            className={`relative px-3 pb-2.5 pt-1 text-[13px] transition-colors duration-fast ${tab === t ? 'font-medium text-ink' : 'text-faint hover:text-ink'}`}>
            {t}{t === 'Transactions' && d.chainTxs.length > 0 ? ` (${d.chainTxs.length})` : ''}{t === 'Timeline' ? ` (${d.events.length})` : ''}
            {tab === t && <span className="absolute inset-x-2 -bottom-px h-[2px] bg-mineral" aria-hidden="true" />}
          </button>
        ))}
      </div>

      {tab === 'Overview' && (
        <div className="mt-5 grid items-start gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-6">
            <section aria-label="Terms of record">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[14px] font-semibold text-ink">Terms of record · v{version.version}</h2>
                <span className="flex items-center gap-1.5 text-[11.5px] text-faint">sha256 <CopyId value={version.termsHash} label="terms hash" /></span>
              </div>
              <div className={`${cardCls} divide-y divide-line`}>
                <div className="px-4 py-3.5">
                  <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Deliverables</h3>
                  <ul className="mt-2 space-y-2.5">
                    {snap.deliverables.map((x) => (
                      <li key={x.id} className="flex gap-2.5 text-[13px]">
                        <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-mineral" aria-hidden="true" />
                        <span><strong className="font-medium text-ink">{x.title}</strong>{x.description && <span className="block leading-relaxed text-faint">{x.description}</span>}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="px-4 py-3.5">
                  <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Objective acceptance criteria — the adjudication standard</h3>
                  <ol className="mt-2 space-y-2">
                    {snap.criteria.map((c, i) => (
                      <li key={c.id} className="flex gap-2.5 text-[13px]">
                        <span className="flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-full bg-sidebar font-mono text-[10px] font-medium text-slate2 border border-line">{i + 1}</span>
                        <span className="leading-relaxed text-slate2">{c.text} <span className="font-mono text-[10.5px] text-faint">{c.id}</span></span>
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="grid gap-3 px-4 py-3.5 text-[13px] sm:grid-cols-2">
                  <p className="leading-relaxed text-slate2"><span className="block text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Evidence required</span>{snap.evidenceRequirements || 'Not specified'}</p>
                  <p className="leading-relaxed text-slate2"><span className="block text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Partial settlement</span>{snap.settlementTerms.allowPartial ? 'Authorized (explicit adjudication split only)' : 'Not authorized'}{snap.settlementTerms.notes ? ` — ${snap.settlementTerms.notes}` : ''}</p>
                </div>
              </div>
              {d.versions.length > 1 && <p className="mt-2 text-[12px] text-faint">{d.versions.length} versions on record. Funded versions are immutable — amendments create new versions, never rewrite history.</p>}
            </section>

            {a.status === 'UNDER_REVIEW' && (
              <section className="border border-vermilion/25 bg-paper px-4 py-4 shadow-card" style={{ borderRadius: 10 }} aria-label="Open a dispute">
                <h2 className="flex items-center gap-2 text-[14px] font-semibold text-vermilion"><Icon d={I.disputes} size={16} /> Dispute a specific criterion</h2>
                <p className="mt-1 text-[13px] leading-relaxed text-faint">Name what failed and why. The adjudicator sees the frozen terms above plus the evidence register — nothing else.</p>
                <label className={`${labelCls} mt-3`} htmlFor="dc">Disputed criterion</label>
                <select id="dc" className={inputCls} value={disputeCriterion} onChange={(e) => setDisputeCriterion(e.target.value)}>
                  <option value="">Whole delivery</option>
                  {snap.criteria.map((c) => <option key={c.id} value={c.id}>{c.id} — {c.text.slice(0, 90)}…</option>)}
                </select>
                <label className={`${labelCls} mt-3`} htmlFor="dr">Reason — what does the evidence show?</label>
                <textarea id="dr" className={textareaCls} rows={4} value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} placeholder="Be specific and reference the evidence you have submitted or will submit…" aria-invalid={disputeReason.length > 0 && disputeReason.trim().length < 10} />
                <div className="mt-2.5 flex items-center gap-3">
                  <button type="button" className={btnDanger} disabled={busy === 'dispute' || disputeReason.trim().length < 10}
                    onClick={() => act('dispute', () => post(`/api/agreements/${id}/disputes`, { reason: disputeReason, criterionId: disputeCriterion }), `Dispute opened against the frozen v${version.version} terms.`)}>
                    {busy === 'dispute' ? 'Opening…' : 'Open dispute'}
                  </button>
                  {disputeReason.trim().length > 0 && disputeReason.trim().length < 10 && <span className="text-[12px] text-vermilion">At least 10 characters required.</span>}
                </div>
              </section>
            )}
          </div>

          <div className="space-y-6">
            <section className={`${cardCls} px-4 py-3.5`} aria-label="Parties and funding">
              <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Parties</h2>
              <div className="mt-2.5 space-y-2.5">
                {[{ label: 'Client', name: a.client.name, you: d.myRole === 'CLIENT' }, { label: 'Provider', name: a.provider.name, you: d.myRole === 'PROVIDER' }].map((p) => (
                  <p key={p.label} className="flex items-center gap-2.5 text-[13px]">
                    <Avatar name={p.name} size={26} />
                    <span className="min-w-0"><span className="block truncate font-medium text-ink">{p.name}</span><span className="block text-[11.5px] text-faint">{p.label}{p.you ? ' · you' : ''}</span></span>
                  </p>
                ))}
              </div>
              <h2 className="mt-4 border-t border-line pt-3.5 text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Funding</h2>
              {d.funding ? (
                <div className="mt-2 text-[13px]">
                  <p className="flex items-center justify-between"><span className="text-faint">Amount recorded</span><Money minor={d.funding.amountMinor} currency={d.funding.currency} className="font-semibold text-ink" /></p>
                  <p className="mt-1.5 flex items-center justify-between gap-2"><span className="text-faint">Reference</span><CopyId value={d.funding.reference} /></p>
                  <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-amber2"><span className="h-1.5 w-1.5 rounded-full bg-amber2" />{d.funding.method} — simulated, no real assets moved</p>
                </div>
              ) : <p className="mt-2 text-[13px] text-amber2">Not funded yet. {d.myRole === 'CLIENT' ? 'Use “Fund agreement” above.' : 'Waiting for the client to fund.'}</p>}
            </section>

            <section className={`${cardCls} px-4 py-3.5`} aria-label="Evidence summary">
              <div className="flex items-center justify-between">
                <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Evidence register · {d.evidence.length}</h2>
                <Link href={`/app/agreements/${id}/evidence`} className="text-[12.5px] font-medium text-mineral hover:underline">Open studio →</Link>
              </div>
              <ul className="mt-2 divide-y divide-line">
                {d.evidence.slice(-5).reverse().map((e) => (
                  <li key={e.id} className="py-2 text-[13px]">
                    <span className="block truncate font-medium text-ink">{e.title}</span>
                    <span className="block text-[11.5px] text-faint">{e.type} · {e.submittedBy.name} · sha256 {e.contentHash.slice(0, 10)}…</span>
                  </li>
                ))}
                {d.evidence.length === 0 && <li className="py-3 text-[13px] text-faint">No evidence yet. Add it in the Evidence Studio before submitting or disputing.</li>}
              </ul>
            </section>

            {settlement && (
              <section className={`${cardCls} px-4 py-3.5`} aria-label="Settlement">
                <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Settlement instruction</h2>
                <div className="mt-2.5 flex items-center gap-2"><DecisionBadge decision={settlement.decision} /><span className="text-[13px] font-medium text-ink">{settlement.status.toLowerCase()}</span><ModeBadge mode={settlement.mode} /></div>
                <dl className="mt-2.5 space-y-1.5 text-[13px]">
                  <div className="flex justify-between"><dt className="text-faint">To provider</dt><dd className="font-medium text-ink"><Money minor={settlement.toProviderMinor} currency={settlement.currency} /></dd></div>
                  <div className="flex justify-between"><dt className="text-faint">Refund to client</dt><dd className="font-medium text-ink"><Money minor={settlement.toClientMinor} currency={settlement.currency} /></dd></div>
                  {settlement.reference && <div className="flex justify-between gap-2"><dt className="text-faint">Execution ref</dt><dd><CopyId value={settlement.reference} /></dd></div>}
                </dl>
                <p className="mt-2 border-t border-line pt-2 text-[12px] leading-relaxed text-faint">A recorded decision is not a payment. Execution is a separate, idempotent step.</p>
                {settlement.status === 'EXECUTED' && <Link href={`/app/receipts/${id}`} className="mt-1 inline-block text-[12.5px] font-medium text-mineral hover:underline">View receipt →</Link>}
              </section>
            )}
          </div>
        </div>
      )}

      {tab === 'Timeline' && (
        <section className="mt-5 max-w-3xl" aria-label="Lifecycle timeline">
          <p className="mb-3 text-[13px] text-faint">Select any event to inspect its actor, timestamp and reference. Every entry is a persisted audit record.</p>
          {d.events.length === 0 ? <EmptyState title="No events yet" body="Creation, funding, submissions, disputes and settlements will be recorded here." /> : (
            <ol className="relative border-l border-line2 pl-6">
              {d.events.map((e, i) => {
                const open = selectedEvent === e.id;
                return (
                  <li key={e.id} className="relative pb-2.5">
                    <span className={`absolute -left-[29.5px] top-[14px] h-[9px] w-[9px] rounded-full border-2 border-canvas ${i === d.events.length - 1 ? 'bg-mineral' : 'bg-line2'}`} aria-hidden="true" />
                    <button type="button" onClick={() => setSelectedEvent(open ? null : e.id)} aria-expanded={open}
                      className={`w-full border px-3.5 py-2.5 text-left transition-colors duration-fast ${open ? 'border-mineral/40 bg-mineral-tint/40' : 'border-line bg-paper hover:border-line2 hover:bg-sidebar/60'}`} style={{ borderRadius: 8 }}>
                      <span className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[13px] font-medium text-ink">{e.action.replaceAll('_', ' ')}</span>
                        <time className="text-[11.5px] tabular text-faint">{new Date(e.createdAt).toLocaleString()}</time>
                      </span>
                      {open && (
                        <span className="mt-1.5 block text-[12.5px] leading-relaxed text-slate2">
                          {e.detail || 'No additional detail recorded.'}
                          <span className="mt-1 flex flex-wrap gap-x-3 font-mono text-[10.5px] text-faint"><span>actor {e.actorId ?? 'system'}</span><span>event {e.id}</span></span>
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      )}

      {tab === 'Transactions' && (
        <section className="mt-5 max-w-3xl" aria-label="Transaction history">
          <p className="mb-3 text-[13px] text-faint">Funding, adjudication and settlement records for this agreement. <strong className="text-ink">SIMULATED</strong> entries never touched a chain; pending is never shown as completed.</p>
          {d.chainTxs.length === 0 ? <EmptyState title="No transactions recorded" body="Funding and settlement operations will appear here with their references and states." /> : (
            <div className={`${cardCls} divide-y divide-line`}>
              {d.chainTxs.map((t) => (
                <div key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${t.status === 'FAILED' ? 'bg-vermilion-tint text-vermilion' : t.status === 'SIMULATED' ? 'bg-amber2-tint text-amber2' : 'bg-mineral-tint text-mineral'}`}><Icon d={I.transactions} size={13} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-ink">{t.kind.charAt(0) + t.kind.slice(1).toLowerCase()} <span className="font-normal text-faint">· {t.network}</span></p>
                    <CopyId value={t.txId} />
                  </div>
                  <span className="text-right">
                    <span className={`block font-mono text-[10.5px] font-semibold ${t.status === 'SIMULATED' ? 'text-amber2' : t.status === 'FAILED' ? 'text-vermilion' : 'text-mineral'}`}>{t.status}</span>
                    <time className="block text-[11.5px] text-faint">{new Date(t.createdAt).toLocaleString()}</time>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <ConfirmModal open={confirm === 'fund'} title="Fund this agreement?" confirmLabel="Record demo funding"
        body={`This records ${a.amountMinor.toLocaleString()} minor units (${a.currency}) in the demo ledger and freezes terms v${version.version}. No real assets move. After funding, criteria cannot be silently edited.`}
        busy={busy === 'fund'} onCancel={() => setConfirm(null)}
        onConfirm={() => act('fund', () => post(`/api/agreements/${id}/fund`, {}), 'Funding recorded in the demo ledger. Terms are now frozen.')} />
      <ConfirmModal open={confirm === 'accept'} title="Accept the work?" confirmLabel="Accept & authorize settlement"
        body="Acceptance authorizes a full release to the provider under the agreement rules. It does not execute the payment — execution is a separate step you can review first. This cannot be undone from the UI."
        busy={busy === 'accept'} onCancel={() => setConfirm(null)}
        onConfirm={() => act('accept', () => post(`/api/agreements/${id}/accept`, { idempotencyKey: `accept:${id}` }), 'Work accepted. Settlement is authorized and pending execution.')} />
      <ConfirmModal open={confirm === 'settle'} title={failSim ? 'Simulate a failed settlement?' : 'Execute settlement?'} danger={failSim} confirmLabel={failSim ? 'Run (fails safely)' : 'Execute in demo ledger'}
        body={failSim ? 'Execution will be recorded as FAILED and the agreement moved to a retryable state. No funds move in demo mode.' : 'Executes the authorized instruction in the demo ledger. Repeat clicks return the existing receipt — settlement cannot run twice.'}
        busy={busy === 'settle'} onCancel={() => setConfirm(null)}
        onConfirm={() => act('settle', () => post(`/api/settlements/${settlement?.id}/execute`, { simulateFailure: failSim }), failSim ? 'Settlement failed as simulated. It is safe to retry.' : 'Settlement executed (simulated). The receipt is ready.')} />
    </div>
  );
}
