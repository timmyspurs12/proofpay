'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Avatar, CopyId, DecisionBadge, Icon, I, ModeBadge, Money, StatusBadge } from './ui';

const STAGES = [
  { key: 'agree', label: 'Agree', section: 0 },
  { key: 'evidence', label: 'Evidence', section: 1 },
  { key: 'adjudicate', label: 'Adjudicate', section: 2 },
  { key: 'settle', label: 'Settle', section: 3 },
] as const;

function SectionLabel({ children, active }: { children: React.ReactNode; active: boolean }) {
  return (
    <p className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors duration-fast ${active ? 'text-mineral' : 'text-faint'}`}>
      <span className={`h-[5px] w-[5px] rounded-full transition-colors duration-fast ${active ? 'bg-mineral' : 'bg-line2'}`} aria-hidden="true" />
      {children}
    </p>
  );
}

/**
 * Bespoke hero preview of ProofPay's actual dispute-review experience.
 * Data mirrors the seeded demo case (Helio Health — booking API, dsp_contested)
 * and is labelled simulated. The four stage tabs drive focus across the
 * composition — this is the landing page's interactive demonstration.
 */
export default function HeroPreview() {
  const [stage, setStage] = useState(2); // Adjudicate focused by default — the differentiator
  const active = (n: number) => stage === n;
  const sectionCls = (n: number) => `px-4 py-3 transition-colors duration-base sm:px-5 ${active(n) ? 'bg-mineral-tint/35' : ''}`;

  return (
    <figure className="w-full" aria-label="Preview of the ProofPay dispute review workspace (simulated demo case)">
      <div className="overflow-hidden border border-line2/80 bg-paper shadow-lift" style={{ borderRadius: 12 }}>
        {/* Case chrome — mirrors the authenticated case header */}
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-2.5 sm:px-5">
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold leading-tight text-ink">Helio Health — booking API</span>
            <span className="block font-mono text-[10px] leading-tight text-faint">dispute dsp_contested · milestone 2</span>
          </span>
          <span className="ml-auto flex shrink-0 items-center gap-2">
            <span className="hidden sm:inline"><StatusBadge status="DISPUTED" /></span>
            <ModeBadge mode="DEMO_SIMULATED" />
          </span>
        </div>

        {/* Frozen criterion */}
        <div className={sectionCls(0)} aria-label="Frozen acceptance criterion">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionLabel active={active(0)}>Frozen acceptance criterion · terms v1</SectionLabel>
            <span className="flex items-center gap-1 font-mono text-[10px] text-faint">sha256 <CopyId value="9f2ac41be07d3a…" label="terms hash (demo)" /></span>
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink">
            <span className="mr-1.5 font-mono text-[11px] font-semibold text-vermilion">crit_2 · disputed</span>
            Cancellation refunds the hold <em className="not-italic underline decoration-vermilion/50 decoration-dotted underline-offset-2">within the same request</em> and is covered by an automated test.
          </p>
          <p className="mt-1 text-[11px] text-faint">Hashed before funding · cannot be silently edited afterward</p>
        </div>

        <div className="h-px bg-line" aria-hidden="true" />

        {/* Evidence rows */}
        <div className={sectionCls(1)} aria-label="Evidence from both parties">
          <SectionLabel active={active(1)}>Evidence register · both parties, one record</SectionLabel>
          <ul className="mt-2 divide-y divide-line">
            <li className="flex items-start gap-2.5 py-2">
              <Avatar name="Kwame Mensah" size={24} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-medium text-ink">Booking API repository @ a3f9c1e <span className="font-normal text-faint">· provider</span></span>
                <span className="block truncate font-mono text-[10px] text-faint">GITHUB · sha256 7bd91c… · cancellation test asserted</span>
              </span>
              <span className="mt-0.5 shrink-0 border border-mineral/25 bg-mineral-tint px-1 py-px font-mono text-[9px] font-semibold text-mineral-deep" style={{ borderRadius: 4 }}>HASH RECORDED</span>
            </li>
            <li className="flex items-start gap-2.5 py-2">
              <Avatar name="Alex Chen" size={24} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-medium text-ink">QA log — hold persisted 24h <span className="font-normal text-faint">· client objection</span></span>
                <span className="block truncate font-mono text-[10px] text-faint">DOCUMENT · sha256 c204aa… · cancel BK-1042, hold still present next day</span>
              </span>
              <span className="mt-0.5 shrink-0 border border-mineral/25 bg-mineral-tint px-1 py-px font-mono text-[9px] font-semibold text-mineral-deep" style={{ borderRadius: 4 }}>HASH RECORDED</span>
            </li>
          </ul>
          <p className="text-[11px] leading-relaxed text-faint">A hash proves what was submitted — not authorship, and not that the work is correct. That judgment comes next.</p>
        </div>

        <div className="h-px bg-line" aria-hidden="true" />

        {/* Decision */}
        <div className={sectionCls(2)} aria-label="GenLayer decision">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionLabel active={active(2)}>GenLayer adjudication · ProofPayAdjudicator@1.0.0</SectionLabel>
            <span className="font-mono text-[10px] text-faint">state <span className="font-semibold text-mineral">FINALIZED</span> · demo-tx-s2adj…</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <DecisionBadge decision="PARTIAL_SETTLEMENT" />
            <span className="font-mono text-[11px] font-medium text-ink">crit_1 MET · crit_2 NOT_MET · crit_3 MET</span>
          </div>
          {/* Split meter */}
          <div className="mt-2.5" aria-label="Authorized split: 66.67 percent to provider, 33.33 percent refunded to client">
            <div className="flex h-[6px] overflow-hidden rounded-full bg-line" role="img">
              <span className="bg-mineral transition-all duration-base" style={{ width: stage >= 2 ? '66.67%' : '0%' }} />
              <span className="bg-midnight/70" style={{ width: '33.33%' }} />
            </div>
            <p className="mt-1.5 flex flex-wrap justify-between gap-2 font-mono text-[10.5px] text-slate2">
              <span>provider 66.67% · <Money minor={833375} className="font-semibold text-ink" /></span>
              <span>client refund 33.33% · <Money minor={416625} className="font-semibold text-ink" /></span>
            </p>
          </div>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-faint">Validators independently re-run this judgment and must agree on the decision fields before anything is stored. Simulated here — no chain transaction exists for this preview.</p>
        </div>

        <div className="h-px bg-line" aria-hidden="true" />

        {/* Settlement */}
        <div className={`${sectionCls(3)} flex flex-wrap items-center gap-x-3 gap-y-1.5`} aria-label="Settlement status">
          <SectionLabel active={active(3)}>Settlement</SectionLabel>
          <span className="flex items-center gap-1.5 text-[12px] font-medium text-ink">
            <Icon d={I.check} size={13} className="text-mineral" /> Authorized by decision
          </span>
          <span className="font-mono text-[10.5px] text-faint" aria-hidden="true">→</span>
          <span className="text-[12px] text-slate2">Execution recorded separately · idempotent</span>
          <span className="ml-auto font-mono text-[10px] font-semibold text-amber2">AWAITING EXECUTION · SIMULATED</span>
        </div>

        {/* Stage tabs */}
        <div className="flex items-center gap-1 overflow-x-auto border-t border-line bg-sidebar/70 px-3 py-2" role="tablist" aria-label="Walk through the four stages">
          {STAGES.map((s, i) => (
            <button key={s.key} role="tab" aria-selected={stage === i} type="button" onClick={() => setStage(i)}
              className={`flex shrink-0 items-center gap-1.5 rounded-[6px] px-2.5 py-1.5 text-[12px] font-medium transition-colors duration-fast ${stage === i ? 'bg-midnight text-white' : 'text-slate2 hover:bg-black/[0.05] hover:text-ink'}`}>
              <span className={`font-mono text-[10px] ${stage === i ? 'text-emerald-300' : 'text-faint'}`}>0{i + 1}</span>{s.label}
            </button>
          ))}
          <Link href="/app/disputes/dsp_contested" className="ml-auto flex shrink-0 items-center gap-1 whitespace-nowrap px-2 text-[12px] font-medium text-mineral hover:underline">
            Open this case live <Icon d={I.arrowR} size={12} />
          </Link>
        </div>
      </div>
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-2 px-0.5 font-mono text-[10.5px] text-faint">
        <span className="h-1.5 w-1.5 rounded-full bg-amber2" aria-hidden="true" />
        Synthetic case from the seeded demo workspace — every record labelled simulated. Amounts: $12,500.00 funded.
      </figcaption>
    </figure>
  );
}
