'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, patch, post } from '@/lib/client/api';
import { Avatar, ConfirmModal, CopyId, DecisionBadge, Drawer, Icon, I, ModeBadge, Money, Skeleton, StatusBadge, btnGhost, btnPrimary, inputCls, labelCls, textareaCls, useToast } from '@/components/ui';

type Finding = { criterionId: string; finding: string; note: string };
type Verdict = { decision: string; providerShareBps: number | null; rationale: string; evidenceRefs: string[]; uncertainties: string[]; criterionFindings: Finding[] };
type Ev = { id: string; type: string; title: string; url: string; contentText: string; fileName?: string; fileSize?: number; contentHash: string; criterionId: string; createdAt: string; role: 'CLIENT' | 'PROVIDER'; submittedBy: { name: string } };
type Data = {
  dispute: {
    id: string; reason: string; criterionId: string; status: string; openedById: string; createdAt: string;
    agreement: { id: string; title: string; status: string; amountMinor: number; currency: string; clientId: string; providerId: string; client: { name: string }; provider: { name: string }; funding: { amountMinor: number } | null };
    submissions: { id: string; authorId: string; kind: string; body: string; createdAt: string }[];
    adjudications: { id: string; mode: string; status: string; txId: string; network: string; contractAddress: string; snapshotHash: string; createdAt: string; result: { decision: string; providerShareBps: number | null; rationale: string; verdictJson: string; createdAt: string } | null }[];
    settlements: { id: string; decision: string; toProviderMinor: number; toClientMinor: number; currency: string; status: string; mode: string; reference: string; failureReason: string; createdAt: string }[];
  };
  version: { version: number; termsHash: string; snapshotParsed: { criteria: { id: string; text: string }[]; deliverables: { id: string; title: string }[]; settlementTerms: { allowPartial: boolean } } } | null;
  evidence: Ev[];
  chainTxs: { id: string; kind: string; txId: string; status: string; network: string; detail: string; createdAt: string }[];
  myRole: 'CLIENT' | 'PROVIDER';
};

function FactTag({ kind }: { kind: 'fact' | 'claim' | 'model' }) {
  const map = { fact: ['border-mineral/25 bg-mineral-tint text-mineral-deep', 'Recorded fact'], claim: ['border-amber2/25 bg-amber2-tint text-amber2', 'Party claim'], model: ['border-midnight bg-midnight text-white', 'Adjudicator interpretation'] } as const;
  const [cls, label] = map[kind];
  return <span className={`inline-flex border px-1.5 py-[1px] text-[10px] font-semibold uppercase tracking-[0.04em] ${cls}`} style={{ borderRadius: 4 }}>{label}</span>;
}

const PHASES = ['Awaiting evidence', 'Ready for adjudication', 'Adjudication pending', 'Decision recorded', 'Settlement pending', 'Settlement completed'] as const;

export default function DisputeCentrePage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [confirmRun, setConfirmRun] = useState(false);
  const [confirmSettle, setConfirmSettle] = useState(false);
  const [rebuttal, setRebuttal] = useState('');
  const [tab, setTab] = useState<'evidence' | 'submissions' | 'history'>('evidence');
  const [criterionFilter, setCriterionFilter] = useState<string>(''); // '' = disputed/all context
  const [selectedEv, setSelectedEv] = useState<Ev | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [idemKey] = useState(() => `adjudicate:${id}:${Math.random().toString(36).slice(2, 10)}`);

  const load = useCallback(() => { api<Data>(`/api/disputes/${id}`).then(setD).catch((e) => setErr(e.message)); }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (d?.dispute.criterionId) setCriterionFilter(d.dispute.criterionId); }, [d?.dispute.criterionId]);

  const latestAdj = d?.dispute.adjudications[0];
  const verdict: Verdict | null = useMemo(() => {
    try { return latestAdj?.result ? (JSON.parse(latestAdj.result.verdictJson) as Verdict) : null; } catch { return null; }
  }, [latestAdj]);
  const settlement = d?.dispute.settlements[0];

  const milestones = useMemo(() => {
    if (!d) return [] as { id: string; at: string; title: string; detail: string; tone: string }[];
    const out = [{ id: 'opened', at: d.dispute.createdAt, title: 'Dispute opened', detail: d.dispute.reason.slice(0, 160), tone: 'bg-vermilion' }];
    for (const s of d.dispute.submissions) out.push({ id: s.id, at: s.createdAt, title: `${s.kind === 'CLAIM' ? 'Claim' : 'Rebuttal'} submitted`, detail: s.body.slice(0, 160), tone: 'bg-amber2' });
    for (const a of [...d.dispute.adjudications].reverse()) {
      out.push({ id: `${a.id}-req`, at: a.createdAt, title: 'Adjudication requested', detail: `${a.mode === 'GENLAYER_TESTNET' ? a.network : 'Simulated demo adjudication'} · ${a.txId || 'no tx yet'}`, tone: 'bg-midnight' });
      if (a.result) out.push({ id: `${a.id}-res`, at: a.result.createdAt, title: `Decision recorded · ${a.result.decision.replaceAll('_', ' ')}`, detail: a.result.rationale.slice(0, 160), tone: 'bg-mineral' });
    }
    for (const s of d.dispute.settlements) out.push({ id: s.id, at: s.createdAt ?? d.dispute.createdAt, title: `Settlement ${s.status.toLowerCase()}`, detail: `Provider ${s.toProviderMinor} / client ${s.toClientMinor} minor units · ${s.mode}`, tone: s.status === 'FAILED' ? 'bg-vermilion' : 'bg-mineral' });
    return out.sort((a, b) => +new Date(a.at) - +new Date(b.at));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d]);

  if (err) return <div className="border border-vermilion/30 bg-vermilion-tint px-4 py-3 text-[13px] text-vermilion" role="alert" style={{ borderRadius: 8 }}>{err}</div>;
  if (!d) return <div className="grid gap-4 xl:grid-cols-[280px_1fr_360px]" aria-busy="true"><Skeleton className="h-96" /><Skeleton className="h-96" /><Skeleton className="h-96" /></div>;

  const { dispute } = d;
  const criteria = d.version?.snapshotParsed.criteria ?? [];
  const byCriterion = (cid: string, role: string) => d.evidence.filter((e) => e.criterionId === cid && e.role === role);
  const orderedCriteria = [...criteria].sort((a, b) => (a.id === dispute.criterionId ? -1 : b.id === dispute.criterionId ? 1 : 0));
  const visibleCriteria = criterionFilter ? criteria.filter((c) => c.id === criterionFilter) : orderedCriteria;
  const canAdjudicate = ['DISPUTED', 'ADDITIONAL_EVIDENCE_REQUIRED'].includes(dispute.agreement.status) || ['OPEN', 'EVIDENCE', 'NEEDS_EVIDENCE'].includes(dispute.status);

  const phase: number = settlement?.status === 'EXECUTED' ? 5
    : settlement ? 4
    : verdict ? 3
    : latestAdj && ['PENDING', 'QUEUED', 'ACCEPTED'].includes(latestAdj.status) ? 2
    : canAdjudicate && d.evidence.length >= 2 ? 1 : 0;
  const failed = settlement?.status === 'FAILED' || latestAdj?.status === 'FAILED' || latestAdj?.status === 'UNDETERMINED';

  const runAdjudication = async () => {
    setBusy('run'); setConfirmRun(false);
    try {
      const res = await post<{ mode: string }>(`/api/disputes/${id}/adjudications`, { idempotencyKey: idemKey });
      toast(res.mode === 'GENLAYER_TESTNET' ? 'Submitted to GenLayer — PENDING until finality. Pending is not a decision.' : 'Simulated adjudication complete. Every record from it is labelled simulated.');
      load();
    } catch (e) { toast(e instanceof Error ? e.message : 'Adjudication failed', 'err'); }
    setBusy('');
  };
  const refresh = async () => {
    if (!latestAdj) return;
    setBusy('refresh');
    try { const r = await patch<{ note?: string }>(`/api/disputes/${id}/adjudications`, { requestId: latestAdj.id }); toast(r.note ?? 'Status refreshed.'); load(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Refresh failed', 'err'); }
    setBusy('');
  };

  return (
    <div className="rise">
      {/* Case header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-[12px] text-faint">
            <Link href={`/app/agreements/${dispute.agreement.id}`} className="font-medium text-mineral hover:underline">{dispute.agreement.title}</Link>
            <span aria-hidden="true">/</span><span className="font-mono text-[11px]">{dispute.id}</span>
          </p>
          <h1 className="mt-1 text-[20px] font-semibold tracking-tight text-ink">Dispute case review</h1>
          <p className="mt-0.5 max-w-2xl text-[13px] text-faint">
            Judged against frozen terms v{d.version?.version} · <span className="font-mono text-[11px]">sha256 {d.version?.termsHash.slice(0, 12)}…</span> · Amount at stake <Money minor={dispute.agreement.amountMinor} currency={dispute.agreement.currency} className="font-medium text-ink" />
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge status={dispute.agreement.status} />
          <ModeBadge mode={latestAdj?.mode ?? 'DEMO_SIMULATED'} />
        </div>
      </div>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[272px_minmax(0,1fr)_360px]">
        {/* LEFT — case navigation & timeline */}
        <aside className="space-y-4 xl:sticky xl:top-[104px]" aria-label="Case navigation and timeline">
          <section className="border border-line bg-paper px-4 py-3.5 shadow-card" style={{ borderRadius: 10 }}>
            <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Case</h2>
            <dl className="mt-2.5 space-y-2 text-[13px]">
              <div><dt className="text-faint">Client</dt><dd className="flex items-center gap-2 font-medium text-ink"><Avatar name={dispute.agreement.client.name} size={22} />{dispute.agreement.client.name}</dd></div>
              <div><dt className="text-faint">Provider</dt><dd className="flex items-center gap-2 font-medium text-ink"><Avatar name={dispute.agreement.provider.name} size={22} />{dispute.agreement.provider.name}</dd></div>
              <div><dt className="text-faint">Opened by</dt><dd className="font-medium text-ink">{dispute.openedById === dispute.agreement.clientId ? dispute.agreement.client.name : dispute.agreement.provider.name}</dd></div>
              <div><dt className="text-faint">State</dt><dd><StatusBadge status={dispute.status === 'ADJUDICATING' ? 'ADJUDICATING' : dispute.agreement.status} /></dd></div>
              {dispute.criterionId && <div><dt className="text-faint">Disputed criterion</dt><dd className="font-mono text-[12px] font-semibold text-vermilion">{dispute.criterionId}</dd></div>}
            </dl>
            <label className="mt-3 block text-[11px] font-medium uppercase tracking-[0.08em] text-faint" htmlFor="crit-filter">Focus criterion</label>
            <select id="crit-filter" className={`${inputCls} mt-1`} value={criterionFilter} onChange={(e) => setCriterionFilter(e.target.value)}>
              <option value="">All criteria (disputed first)</option>
              {criteria.map((c) => <option key={c.id} value={c.id}>{c.id}{c.id === dispute.criterionId ? ' · disputed' : ''} — {c.text.slice(0, 52)}…</option>)}
            </select>
            <Link href={`/app/agreements/${dispute.agreement.id}/evidence?dispute=${id}`} className={`${btnGhost} mt-3 w-full`}><Icon d={I.plus} size={14} /> Add evidence</Link>
          </section>

          <section aria-label="Case timeline">
            <h2 className="mb-2 px-0.5 text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Timeline · select an event</h2>
            <ol className="relative border-l border-line2 pl-5">
              {milestones.map((m) => {
                const open = selectedEvent === m.id;
                return (
                  <li key={m.id} className="relative pb-2">
                    <span className={`absolute -left-[23.5px] top-[13px] h-[8px] w-[8px] rounded-full border-2 border-canvas ${m.tone}`} aria-hidden="true" />
                    <button type="button" onClick={() => setSelectedEvent(open ? null : m.id)} aria-expanded={open}
                      className={`w-full border px-3 py-2 text-left transition-colors duration-fast ${open ? 'border-mineral/40 bg-mineral-tint/40' : 'border-line bg-paper hover:bg-sidebar/60'}`} style={{ borderRadius: 8 }}>
                      <span className="block text-[12.5px] font-medium leading-snug text-ink">{m.title}</span>
                      <time className="block text-[11px] tabular text-faint">{new Date(m.at).toLocaleString()}</time>
                      {open && <span className="mt-1 block text-[12px] leading-relaxed text-slate2">{m.detail}</span>}
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        </aside>

        {/* CENTRE — evidence review */}
        <div className="min-w-0">
          <section className="border border-vermilion/25 bg-paper px-4 py-3.5 shadow-card" style={{ borderRadius: 10 }} aria-label="Dispute reason">
            <div className="flex flex-wrap items-center gap-2"><FactTag kind="claim" /><h2 className="text-[13.5px] font-semibold text-ink">Why this case was opened</h2></div>
            <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-slate2">{dispute.reason}</p>
          </section>

          <div className="mt-4 flex gap-1 border-b border-line" role="tablist" aria-label="Case review sections">
            {([['evidence', `Evidence by criterion (${d.evidence.length})`], ['submissions', `Claims & rebuttals (${dispute.submissions.length})`], ['history', `Transactions (${d.chainTxs.length})`]] as const).map(([key, label]) => (
              <button key={key} role="tab" aria-selected={tab === key} type="button" onClick={() => setTab(key)}
                className={`relative px-3 pb-2.5 pt-1 text-[13px] transition-colors duration-fast ${tab === key ? 'font-medium text-ink' : 'text-faint hover:text-ink'}`}>
                {label}{tab === key && <span className="absolute inset-x-2 -bottom-px h-[2px] bg-mineral" aria-hidden="true" />}
              </button>
            ))}
          </div>

          {tab === 'evidence' && (
            <div className="mt-4 space-y-4">
              {visibleCriteria.map((c) => {
                const disputed = dispute.criterionId === c.id;
                const finding = verdict?.criterionFindings.find((f) => f.criterionId === c.id);
                return (
                  <article key={c.id} className={`border bg-paper shadow-card ${disputed ? 'border-vermilion/40' : 'border-line'}`} style={{ borderRadius: 10 }} aria-label={`Criterion ${c.id}`}>
                    <header className={`border-b px-4 py-3 ${disputed ? 'border-vermilion/20 bg-vermilion-tint/50' : 'border-line bg-sidebar/50'}`}>
                      <p className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-faint">
                        Original requirement · <span className="font-mono normal-case tracking-normal">{c.id}</span>
                        {disputed && <span className="font-semibold text-vermilion">Disputed criterion</span>}
                      </p>
                      <p className="mt-1 text-[14px] font-medium leading-relaxed text-ink">{c.text}</p>
                      {finding && (
                        <p className="mt-2 flex flex-wrap items-start gap-2 border-t border-line/70 pt-2 text-[13px]">
                          <FactTag kind="model" />
                          <span className={`font-mono text-[12px] font-bold ${finding.finding === 'MET' ? 'text-mineral' : finding.finding === 'NOT_MET' ? 'text-vermilion' : 'text-amber2'}`}>{finding.finding.replace('_', ' ')}</span>
                          <span className="min-w-0 flex-1 leading-relaxed text-slate2">{finding.note}</span>
                        </p>
                      )}
                    </header>
                    <div className="grid md:grid-cols-2">
                      {(['PROVIDER', 'CLIENT'] as const).map((role) => (
                        <div key={role} className={`px-4 py-3 ${role === 'PROVIDER' ? 'border-line md:border-r' : ''} ${role === 'CLIENT' ? 'border-t border-line md:border-t-0' : ''}`}>
                          <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-faint">
                            <Avatar name={role === 'PROVIDER' ? dispute.agreement.provider.name : dispute.agreement.client.name} size={18} />
                            {role === 'PROVIDER' ? 'Provider submission' : 'Client objection'}
                          </p>
                          {byCriterion(c.id, role).length === 0 ? (
                            <p className="mt-2 text-[13px] italic text-faint">No evidence linked to this criterion.</p>
                          ) : (
                            <ul className="mt-1.5 divide-y divide-line">
                              {byCriterion(c.id, role).map((e) => (
                                <li key={e.id}>
                                  <button type="button" onClick={() => setSelectedEv(e)} className="w-full py-2 text-left" aria-label={`Inspect evidence: ${e.title}`}>
                                    <span className="block truncate text-[13px] font-medium text-ink hover:text-mineral">{e.title}</span>
                                    <span className="mt-0.5 flex flex-wrap gap-x-2 font-mono text-[10px] text-faint">
                                      <span>{e.type}</span><span>sha256 {e.contentHash.slice(0, 10)}…</span><span>{new Date(e.createdAt).toLocaleDateString()}</span>
                                    </span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
              {visibleCriteria.length === 0 && <p className="border border-dashed border-line2 px-4 py-8 text-center text-[13px] text-faint" style={{ borderRadius: 10 }}>No criteria on the frozen version.</p>}
              <p className="text-[12px] text-faint">
                General evidence (not linked to a criterion): {d.evidence.filter((e) => !e.criterionId).length} item(s) — still sent to the adjudicator as context.
                {' '}<Link href={`/app/agreements/${dispute.agreement.id}/evidence?dispute=${id}`} className="font-medium text-mineral hover:underline">Add evidence in the studio →</Link>
              </p>
            </div>
          )}

          {tab === 'submissions' && (
            <div className="mt-4">
              <ol className="space-y-2.5">
                {dispute.submissions.map((s) => (
                  <li key={s.id} className="border border-line bg-paper px-4 py-3 shadow-card" style={{ borderRadius: 10 }}>
                    <p className="flex flex-wrap items-center gap-2 text-[13px]">
                      <FactTag kind="claim" />
                      <strong className="text-ink">{s.kind === 'CLAIM' ? 'Claim' : 'Rebuttal'}</strong>
                      <span className="flex items-center gap-1.5 text-slate2"><Avatar name={s.authorId === dispute.agreement.clientId ? dispute.agreement.client.name : dispute.agreement.provider.name} size={20} />{s.authorId === dispute.agreement.clientId ? dispute.agreement.client.name : dispute.agreement.provider.name}</span>
                      <time className="ml-auto text-[11.5px] tabular text-faint">{new Date(s.createdAt).toLocaleString()}</time>
                    </p>
                    <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-slate2">{s.body}</p>
                  </li>
                ))}
                {dispute.submissions.length === 0 && <li className="border border-dashed border-line2 px-4 py-8 text-center text-[13px] text-faint" style={{ borderRadius: 10 }}>No claims or rebuttals yet.</li>}
              </ol>
              <form className="mt-4 border border-line bg-paper px-4 py-3.5 shadow-card" style={{ borderRadius: 10 }} onSubmit={async (e) => {
                e.preventDefault(); setBusy('rebut');
                try { await post(`/api/disputes/${id}/submissions`, { kind: 'REBUTTAL', body: rebuttal }); setRebuttal(''); toast('Rebuttal recorded on the case.'); load(); }
                catch (err2) { toast(err2 instanceof Error ? err2.message : 'Could not submit', 'err'); }
                setBusy('');
              }}>
                <label className={labelCls} htmlFor="reb">Add your response ({d.myRole.toLowerCase()})</label>
                <textarea id="reb" className={textareaCls} rows={3} value={rebuttal} onChange={(e) => setRebuttal(e.target.value)} placeholder="Respond to the other party's evidence, criterion by criterion…" />
                <button type="submit" className={`${btnPrimary} mt-2`} disabled={busy === 'rebut' || rebuttal.trim().length < 3}>{busy === 'rebut' ? 'Recording…' : 'Submit rebuttal'}</button>
              </form>
            </div>
          )}

          {tab === 'history' && (
            <div className="mt-4 border border-line bg-paper shadow-card" style={{ borderRadius: 10 }}>
              {d.chainTxs.length === 0 ? <p className="px-4 py-8 text-center text-[13px] text-faint">No funding, adjudication or settlement records yet.</p> : (
                <ul className="divide-y divide-line">
                  {d.chainTxs.map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-ink">{t.kind.charAt(0) + t.kind.slice(1).toLowerCase()} <span className="font-normal text-faint">· {t.network}</span></p>
                        <CopyId value={t.txId} />
                        <p className="truncate text-[12px] text-faint">{t.detail}</p>
                      </div>
                      <span className={`font-mono text-[10.5px] font-semibold ${t.status === 'SIMULATED' ? 'text-amber2' : t.status === 'FAILED' ? 'text-vermilion' : 'text-mineral'}`}>{t.status}</span>
                      <time className="text-[11.5px] tabular text-faint">{new Date(t.createdAt).toLocaleString()}</time>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* RIGHT — decision & execution panel */}
        <aside className="space-y-4 xl:sticky xl:top-[104px]" aria-label="Decision and execution">
          <section className="border border-line bg-paper shadow-card" style={{ borderRadius: 10 }}>
            <div className="border-b border-line px-4 py-3">
              <h2 className="text-[13px] font-semibold text-ink">Decision & execution</h2>
              <ol className="mt-3 space-y-0" aria-label="Case progress">
                {PHASES.map((p, i) => {
                  const done = i < phase; const current = i === phase;
                  return (
                    <li key={p} className="relative flex gap-2.5 pb-3 last:pb-0">
                      {i < PHASES.length - 1 && <span className={`absolute left-[7px] top-[18px] h-[calc(100%-14px)] w-px ${done ? 'bg-mineral' : 'bg-line2'}`} aria-hidden="true" />}
                      <span className={`relative z-[1] mt-[1px] flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full border ${done ? 'border-mineral bg-mineral text-white' : current ? (failed ? 'border-vermilion bg-vermilion text-white' : 'border-mineral bg-paper') : 'border-line2 bg-paper'}`}>
                        {done ? <Icon d={I.check} size={9} /> : current && failed ? <Icon d={I.x} size={9} /> : current ? <span className="pulse-dot h-[7px] w-[7px] rounded-full bg-mineral" /> : null}
                      </span>
                      <span className={`text-[12.5px] leading-[18px] ${current ? 'font-medium text-ink' : done ? 'text-slate2' : 'text-faint'}`}>
                        {failed && current ? `${p} — failed, retryable` : p}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>

            <div className="px-4 py-3.5">
              <h3 className="flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.08em] text-faint">GenLayer adjudication
                <ModeBadge mode={latestAdj?.mode ?? 'DEMO_SIMULATED'} /></h3>
              <dl className="mt-2.5 space-y-1.5 font-mono text-[11.5px]">
                <div className="flex justify-between gap-3"><dt className="font-sans text-[12px] text-faint">Contract</dt><dd className="text-right">ProofPayAdjudicator@1.0.0</dd></div>
                <div className="flex justify-between gap-3"><dt className="font-sans text-[12px] text-faint">Network</dt><dd className="text-right">{latestAdj?.network ?? 'Demo (simulated)'}</dd></div>
                <div className="flex justify-between gap-3"><dt className="font-sans text-[12px] text-faint">Address</dt><dd>{latestAdj?.contractAddress ? `${latestAdj.contractAddress.slice(0, 12)}…` : 'Not configured'}</dd></div>
                <div className="flex justify-between gap-3"><dt className="font-sans text-[12px] text-faint">State</dt><dd className="font-semibold text-mineral">{busy === 'run' ? 'SUBMITTING…' : latestAdj?.status ?? 'NOT REQUESTED'}</dd></div>
                {latestAdj?.txId && <div className="flex justify-between gap-3"><dt className="font-sans text-[12px] text-faint">Transaction</dt><dd><CopyId value={latestAdj.txId} /></dd></div>}
                {latestAdj && <div className="flex justify-between gap-3"><dt className="font-sans text-[12px] text-faint">Snapshot</dt><dd title={latestAdj.snapshotHash}>{latestAdj.snapshotHash.slice(0, 12)}…</dd></div>}
              </dl>
              {latestAdj?.mode === 'DEMO_SIMULATED' && (
                <p className="mt-2.5 border border-amber2/25 bg-amber2-tint/60 px-2.5 py-2 text-[12px] leading-relaxed text-slate2" style={{ borderRadius: 6 }}>
                  Simulated mode — no GenLayer transaction exists for this case. The demo engine applies published deterministic rules (see rationale). Live setup: <span className="font-mono text-[11px]">docs/GENLAYER.md</span>.
                </p>
              )}
              <p className="mt-2 text-[11.5px] leading-relaxed text-faint">Consensus data is shown only from real transaction records. Validator identities or vote counts are never invented; in live mode, Refresh reads the actual GenLayer status.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className={btnPrimary} disabled={busy === 'run' || !canAdjudicate} onClick={() => setConfirmRun(true)}>
                  {busy === 'run' ? 'Submitting…' : latestAdj ? 'Re-run adjudication' : 'Request adjudication'}
                </button>
                {latestAdj?.mode === 'GENLAYER_TESTNET' && (
                  <button type="button" className={btnGhost} disabled={busy === 'refresh'} onClick={refresh}>{busy === 'refresh' ? 'Refreshing…' : 'Refresh chain status'}</button>
                )}
              </div>
              {!canAdjudicate && <p className="mt-2 text-[12px] text-faint">Available while the case is disputed or awaiting evidence.</p>}
              <p className="mt-1.5 font-mono text-[10px] text-faint">idempotency {idemKey} — retries reuse it, never duplicate the case</p>
            </div>
          </section>

          <section className="border border-line bg-paper px-4 py-3.5 shadow-card" style={{ borderRadius: 10 }} aria-label="Verdict">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Structured decision</h3>
            {!verdict ? (
              <p className="mt-2 text-[13px] leading-relaxed text-faint">No decision recorded. An empty or one-sided register returns INSUFFICIENT_EVIDENCE — never a guessed outcome.</p>
            ) : (
              <div className="mt-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <DecisionBadge decision={verdict.decision} />
                  {verdict.decision === 'PARTIAL_SETTLEMENT' && verdict.providerShareBps !== null && (
                    <span className="font-mono text-[11.5px] font-semibold text-ink">provider {(verdict.providerShareBps / 100).toFixed(2)}% · client {(100 - verdict.providerShareBps / 100).toFixed(2)}%</span>
                  )}
                </div>
                <p className="mt-1.5 font-mono text-[10.5px] text-faint">recorded {latestAdj?.result ? new Date(latestAdj.result.createdAt).toLocaleString() : ''} · {latestAdj?.mode === 'GENLAYER_TESTNET' ? 'GenLayer contract state' : 'simulated demo engine'}</p>
                <h4 className="mt-3 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Rationale <FactTag kind="model" /></h4>
                <p className="mt-1 text-[13px] leading-relaxed text-slate2">{verdict.rationale}</p>
                <h4 className="mt-3 text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Evidence considered · {verdict.evidenceRefs.length}</h4>
                {verdict.evidenceRefs.length === 0 ? <p className="mt-1 text-[13px] text-faint">None cited.</p> : (
                  <ul className="mt-1 space-y-1">
                    {verdict.evidenceRefs.map((r) => {
                      const ev = d.evidence.find((e) => e.id === r);
                      return <li key={r}><button type="button" className="text-left text-[13px] text-slate2 hover:text-mineral" onClick={() => ev && setSelectedEv(ev)}><span className="font-mono text-[11px]">{r}</span>{ev ? ` — ${ev.title}` : ' — (not in register)'}</button></li>;
                    })}
                  </ul>
                )}
                {verdict.uncertainties.length > 0 && (
                  <>
                    <h4 className="mt-3 text-[11px] font-medium uppercase tracking-[0.08em] text-vermilion">Outstanding uncertainties</h4>
                    <ul className="mt-1 list-disc space-y-1 pl-4 text-[13px] leading-relaxed text-slate2">{verdict.uncertainties.map((u, i) => <li key={i}>{u}</li>)}</ul>
                  </>
                )}
                <Link href={`/app/receipts/${dispute.agreement.id}`} className="mt-3 inline-block text-[12.5px] font-medium text-mineral hover:underline">Open the case receipt →</Link>
              </div>
            )}
          </section>

          <section className="border border-line bg-paper px-4 py-3.5 shadow-card" style={{ borderRadius: 10 }} aria-label="Settlement">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Authorized settlement</h3>
            {!settlement ? (
              <p className="mt-2 text-[13px] leading-relaxed text-faint">Nothing is authorized. Authorization requires a definitive decision (or client acceptance on the case file) and is recomputed deterministically from the funded amount — never taken from rationale text.</p>
            ) : (
              <div className="mt-2.5">
                <p className="flex flex-wrap items-center gap-2"><span className="text-[13px] font-semibold text-ink">{settlement.status}</span><ModeBadge mode={settlement.mode} /></p>
                <dl className="mt-2.5 space-y-1.5 text-[13px]">
                  <div className="flex justify-between gap-2"><dt className="text-faint">To provider</dt><dd className="font-medium text-ink"><Money minor={settlement.toProviderMinor} currency={settlement.currency} /></dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-faint">Refund to client</dt><dd className="font-medium text-ink"><Money minor={settlement.toClientMinor} currency={settlement.currency} /></dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-faint">Funded total</dt><dd className="tabular text-slate2"><Money minor={dispute.agreement.funding?.amountMinor ?? dispute.agreement.amountMinor} currency={settlement.currency} /></dd></div>
                  {settlement.reference && <div className="flex justify-between gap-2"><dt className="text-faint">Execution ref</dt><dd><CopyId value={settlement.reference} /></dd></div>}
                </dl>
                {settlement.failureReason && <p className="mt-2 flex gap-1.5 text-[12.5px] text-vermilion" role="alert"><Icon d={I.alert} size={14} className="mt-px shrink-0" />{settlement.failureReason}</p>}
                {settlement.status === 'EXECUTED' ? (
                  <Link href={`/app/receipts/${dispute.agreement.id}`} className={`${btnPrimary} mt-3`}>View receipt →</Link>
                ) : (
                  <button type="button" className={`${btnPrimary} mt-3`} disabled={busy === 'settle'} onClick={() => setConfirmSettle(true)}>
                    {busy === 'settle' ? 'Executing…' : settlement.status === 'FAILED' ? 'Retry settlement execution' : 'Execute authorized settlement'}
                  </button>
                )}
                <p className="mt-2 text-[11.5px] leading-relaxed text-faint">Idempotent: re-executing returns the same receipt. A recorded decision ≠ a completed payment.</p>
              </div>
            )}
          </section>
        </aside>
      </div>

      {/* Evidence drawer */}
      <Drawer open={!!selectedEv} onClose={() => setSelectedEv(null)} title={selectedEv?.title ?? ''} sub={selectedEv ? `${selectedEv.type} · ${selectedEv.id}` : ''}>
        {selectedEv && (
          <div className="space-y-4 text-[13px]">
            <div className="flex items-center gap-2"><FactTag kind="fact" /><span className="text-faint">{selectedEv.role === 'PROVIDER' ? 'Provider submission' : 'Client objection'} · {new Date(selectedEv.createdAt).toLocaleString()}</span></div>
            <dl className="space-y-2.5">
              <div className="flex justify-between gap-3"><dt className="text-faint">Criterion</dt><dd className="text-right font-medium text-ink">{selectedEv.criterionId ? `${selectedEv.criterionId} — ${criteria.find((c) => c.id === selectedEv.criterionId)?.text ?? ''}` : 'General'}</dd></div>
              {selectedEv.fileName && <div className="flex justify-between gap-3"><dt className="text-faint">File</dt><dd className="font-mono text-[11.5px]">{selectedEv.fileName}</dd></div>}
            </dl>
            <div className="border border-line bg-sidebar/60 px-3 py-2.5" style={{ borderRadius: 8 }}>
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Integrity metadata</p>
              <p className="mt-1 break-all font-mono text-[11px] leading-relaxed text-slate2">sha256 {selectedEv.contentHash}</p>
              <p className="mt-1 flex items-center justify-between"><span className="text-[12px] text-faint">Hash recorded at submission</span><CopyId value={selectedEv.contentHash} label="content hash" /></p>
              <p className="mt-1 text-[12px] text-faint">Proves the content snapshot — not authorship, not correctness.</p>
            </div>
            {selectedEv.url && <a href={selectedEv.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 break-all font-medium text-mineral hover:underline">{selectedEv.url} <Icon d={I.external} size={13} /></a>}
            {selectedEv.contentText && <p className="whitespace-pre-wrap border border-line px-3 py-2.5 leading-relaxed text-slate2" style={{ borderRadius: 8 }}>{selectedEv.contentText.slice(0, 2400)}</p>}
          </div>
        )}
      </Drawer>

      <ConfirmModal open={confirmRun} title="Request adjudication?" confirmLabel={latestAdj?.mode === 'GENLAYER_TESTNET' ? 'Submit to GenLayer' : 'Run simulated adjudication'}
        body={`The adjudicator receives the frozen v${d.version?.version} criteria, ${d.evidence.length} evidence references with hashes, and both parties' claims. Evidence content is untrusted data and cannot instruct the adjudicator. ${latestAdj?.mode === 'GENLAYER_TESTNET' ? 'The transaction stays PENDING until GenLayer finality.' : 'Demo mode: the deterministic simulated engine runs and every resulting record is labelled simulated.'}`}
        busy={busy === 'run'} onCancel={() => setConfirmRun(false)} onConfirm={runAdjudication} />
      <ConfirmModal open={confirmSettle} title="Execute the authorized settlement?" confirmLabel="Execute in demo ledger"
        body="Amounts were recomputed from the funded total under the recorded decision. Demo mode moves no real assets; execution is recorded as a separate, idempotent step with its own reference."
        busy={busy === 'settle'} onCancel={() => setConfirmSettle(false)}
        onConfirm={async () => {
          setBusy('settle'); setConfirmSettle(false);
          try { await post(`/api/settlements/${settlement?.id}/execute`, {}); toast('Settlement executed (simulated).'); load(); }
          catch (e) { toast(e instanceof Error ? e.message : 'Settlement failed', 'err'); }
          setBusy('');
        }} />
    </div>
  );
}
