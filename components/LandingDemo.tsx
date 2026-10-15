'use client';
import { useState } from 'react';
import Link from 'next/link';
import { DecisionBadge, Icon, I } from './ui';

const STEPS = [
  {
    key: 'agree', label: 'Agree',
    title: 'Terms are frozen before money moves',
    body: 'Deliverables and objective acceptance criteria are hashed into agreement version v1 (sha256). After funding, the API refuses silent edits — a change needs a new, approved version.',
    panel: (
      <div className="font-mono text-[12px] leading-relaxed">
        <p className="text-faint">agreement agr_contested · version v1</p>
        <p className="mt-2.5 text-ink">crit_2 — “Cancellation refunds the hold within the same request…”</p>
        <p className="mt-2.5 text-slate2">terms_hash <span className="text-mineral">9f2ac41be07d…</span></p>
        <p className="text-slate2">funding <span className="text-amber2">demo-tx-s2fund01 · SIMULATED</span></p>
      </div>
    ),
  },
  {
    key: 'evidence', label: 'Evidence',
    title: 'Both sides build one shared register',
    body: 'Repository commits, deployment URLs, QA logs and notes are hashed at submission (sha256). A hash proves what was submitted — never, by itself, that the work is correct.',
    panel: (
      <div className="space-y-0 text-[13px]">
        {[['Booking API repo @ a3f9c1e', 'provider'], ['QA log — hold persisted 24h', 'client'], ['Cancellation test note', 'provider']].map(([t, who]) => (
          <p key={t} className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-b-0">
            <span className="text-ink">{t} <span className="text-faint">· {who}</span></span>
            <span className="shrink-0 font-mono text-[10.5px] font-medium text-mineral">SHA256 RECORDED</span>
          </p>
        ))}
      </div>
    ),
  },
  {
    key: 'adjudicate', label: 'Adjudicate',
    title: 'GenLayer weighs evidence against the frozen criteria',
    body: 'The Intelligent Contract receives only the criteria snapshot, evidence references with hashes, and both claims. Validators independently re-run the judgment and must agree on the decision fields (Equivalence Principle) before any verdict is stored.',
    panel: (
      <div className="text-[13px]">
        <p className="font-mono text-[11px] text-faint">ProofPayAdjudicator.adjudicate(case, criteria, evidence_refs…)</p>
        <p className="mt-3 flex flex-wrap items-center gap-2"><DecisionBadge decision="PARTIAL_SETTLEMENT" /><span className="font-mono text-[12px] text-ink">provider_share_bps = 6667</span></p>
        <p className="mt-2.5 leading-relaxed text-slate2">crit_1 MET · crit_2 NOT_MET · crit_3 MET — rationale cites ev_s2_repo, ev_s2_qa, ev_s2_ci</p>
        <p className="mt-2 flex items-center gap-1.5 text-[12px] text-amber2"><Icon d={I.alert} size={13} /> Demo mode: this illustration is simulated — open the workspace to run it.</p>
      </div>
    ),
  },
  {
    key: 'settle', label: 'Settle',
    title: 'Settlement follows rules, not the rationale text',
    body: 'A verdict only authorizes. Deterministic code recomputes amounts from the funded total and the authorized split, blocks duplicates with idempotency keys, and records execution separately from the decision.',
    panel: (
      <div className="font-mono text-[12px] leading-relaxed">
        <p className="text-ink">funded 12,500.00 USD → provider 8,333.75 · client 4,166.25</p>
        <p className="mt-2 text-slate2">instruction AUTHORIZED → EXECUTED</p>
        <p className="text-slate2">duplicate execute → existing receipt returned, no second movement</p>
      </div>
    ),
  },
];

export default function LandingDemo() {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  return (
    <div className="overflow-hidden border border-line bg-paper shadow-card" style={{ borderRadius: 12 }}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-faint"><span className="h-1.5 w-1.5 rounded-full bg-amber2" /> Interactive demonstration · simulated data</span>
        <div className="ml-auto flex gap-1" role="tablist" aria-label="Demonstration stages">
          {STEPS.map((s, idx) => (
            <button key={s.key} role="tab" aria-selected={idx === i} type="button" onClick={() => setI(idx)}
              className={`h-7 rounded-[6px] px-2.5 text-[12px] font-medium transition-colors duration-fast ${idx === i ? 'bg-midnight text-white' : 'text-slate2 hover:bg-sidebar hover:text-ink'}`}>
              {idx + 1} · {s.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid md:grid-cols-2">
        <div className="px-5 py-5">
          <h3 className="text-[16px] font-semibold tracking-tight text-ink">{step.title}</h3>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate2">{step.body}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" className="inline-flex h-8 items-center rounded-[6px] border border-line2 px-3 text-[13px] font-medium transition hover:bg-sidebar disabled:opacity-40" disabled={i === 0} onClick={() => setI(i - 1)}>← Prev</button>
            <button type="button" className="inline-flex h-8 items-center rounded-[6px] bg-midnight px-3 text-[13px] font-medium text-white transition hover:bg-black disabled:opacity-40" disabled={i === STEPS.length - 1} onClick={() => setI(i + 1)}>Next →</button>
            <Link href="/app" className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-[6px] bg-mineral px-3 text-[13px] font-medium text-white transition hover:bg-mineral-deep">Open the workspace <Icon d={I.arrowR} size={13} /></Link>
          </div>
        </div>
        <div className="border-t border-line bg-sidebar/50 px-5 py-5 md:border-l md:border-t-0" aria-live="polite">{step.panel}</div>
      </div>
    </div>
  );
}
