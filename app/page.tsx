'use client';
import Link from 'next/link';
import { Icon, I, Logo } from '@/components/ui';
import HeroPreview from '@/components/HeroPreview';

const FACTS = [
  { title: 'Frozen before funding', body: 'Every acceptance criterion is hashed into the record at terms v1.' },
  { title: 'Evidence floor', body: 'No evidence on both sides means no verdict — full stop.' },
  { title: 'Recomputed settlement', body: 'Money amounts are deterministic math, never model output.' },
];

const SEQUENCE = [
  { n: '01', title: 'Agree', ref: 'terms v1 · sha256 9f2a…', body: 'Client and provider negotiate scope, milestones, and acceptance tests. The funded terms become the benchmark — frozen and versioned.' },
  { n: '02', title: 'Fund', ref: 'milestone 2 · $12,500.00', body: 'The client funds the milestone. The record shows funded, attributed, and balanced — before any work is reviewed.' },
  { n: '03', title: 'Prove', ref: 'evidence · sha256 7bd9…', body: 'Delivery is submitted as hashed evidence. The other party accepts against the frozen criteria, or disputes with a reason tied to them.' },
  { n: '04', title: 'Decide', ref: 'GenLayer · FINALIZED', body: 'The Intelligent Contract compares both sides’ evidence against the frozen wording and stores a criterion-level verdict.' },
  { n: '05', title: 'Settle', ref: 'authorized ≠ executed', body: 'A deterministic step turns the authorized split into two balanced transfers. Duplicates are blocked by idempotency keys.' },
];

const DIFFERENCE = [
  { title: 'Decisions you can inspect', body: 'Every verdict names the specific criterion, quotes the evidence gap, and carries a structured confidence — not a star rating or a chat transcript.' },
  { title: 'Both sides, one record', body: 'Provider evidence and client objection live in the same evidence register, so the adjudicator sees the same record you do — nothing side-channelled.' },
  { title: 'Honest by construction', body: 'The product says simulated when it is simulated. In this demo, funding, adjudication and settlement are all local records — no chain transaction is claimed anywhere.' },
];

function ArrowLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-mineral hover:underline">
      {children} <Icon d={I.arrowR} size={13} />
    </Link>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      {/* ---------- Header ---------- */}
      <header className="sticky top-0 z-10 border-b border-line bg-canvas/95 backdrop-blur-sm">
        <div className="mx-auto flex h-12 max-w-[1240px] items-center gap-5 px-4 sm:px-6">
          <Logo />
          <nav className="ml-2 hidden items-center gap-5 text-[13px] text-slate2 md:flex" aria-label="Public sections">
            <a href="#sequence" className="hover:text-ink">How it works</a>
            <a href="#difference" className="hover:text-ink">Why ProofPay</a>
            <a href="#genlayer" className="hover:text-ink">GenLayer</a>
          </nav>
          <span className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-1.5 font-mono text-[10.5px] text-faint sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-amber2" aria-hidden="true" /> DEMO_SIMULATED
            </span>
            <Link href="/app" className="inline-flex items-center gap-1.5 rounded-[8px] bg-midnight px-3.5 py-2 text-[13px] font-medium text-white transition-colors duration-fast hover:bg-ink">
              Open workspace <Icon d={I.arrowR} size={13} />
            </Link>
          </span>
        </div>
      </header>

      <main>
        {/* ---------- Hero ---------- */}
        <section className="mx-auto grid max-w-[1240px] items-start gap-8 px-4 pb-12 pt-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(420px,540px)] lg:gap-12 lg:pb-16 lg:pt-12" aria-label="Introduction">
          <div className="max-w-[560px] pt-1 lg:pt-6">
            <p className="flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-mineral">
              <span className="h-px w-6 bg-mineral/50" aria-hidden="true" /> Evidence-backed escrow
            </p>
            <h1 className="mt-4 text-[34px] font-semibold leading-[1.08] tracking-[-0.02em] sm:text-[40px] lg:text-[44px]">
              Escrow that remembers exactly what was agreed.
            </h1>
            <p className="mt-4 max-w-[52ch] text-[15.5px] leading-relaxed text-slate2">
              ProofPay freezes acceptance criteria before funding, records evidence from both sides, and lets a GenLayer Intelligent Contract decide disputes criterion by criterion — so settlement follows the agreement, not the loudest voice.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <Link href="/app/agreements/new" className="inline-flex items-center gap-1.5 rounded-[8px] bg-mineral px-4 py-2.5 text-[14px] font-medium text-white transition-colors duration-fast hover:bg-mineral-deep">
                Create an agreement <Icon d={I.arrowR} size={14} />
              </Link>
              <Link href="/app/disputes/dsp_contested" className="inline-flex items-center gap-1.5 rounded-[8px] border border-line2 px-4 py-2.5 text-[14px] font-medium text-ink transition-colors duration-fast hover:bg-sidebar">
                Review the seeded dispute
              </Link>
            </div>
            <p className="mt-3 text-[12.5px] text-faint">
              No sign-up needed for the demo — enter as Elena Vasquez (client), Kwame Mensah (provider), or Alex Chen.
            </p>

            {/* Key facts — divider stack, no cards */}
            <dl className="mt-8 border-t border-line">
              {FACTS.map((f) => (
                <div key={f.title} className="grid gap-0.5 border-b border-line py-3 sm:grid-cols-[168px_1fr] sm:gap-4">
                  <dt className="text-[13px] font-semibold text-ink">{f.title}</dt>
                  <dd className="text-[13px] leading-relaxed text-slate2">{f.body}</dd>
                </div>
              ))}
            </dl>

            <p className="mt-5">
              <ArrowLink href="#sequence">Walk the full sequence</ArrowLink>
            </p>
          </div>

          <HeroPreview />
        </section>

        {/* ---------- Sequence ---------- */}
        <section id="sequence" className="border-t border-line bg-paper" aria-label="How ProofPay works">
          <div className="mx-auto max-w-[1240px] px-4 py-10 sm:px-6 lg:py-14">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-mineral">From agreement to settlement</p>
                <h2 className="mt-2 max-w-[34ch] text-[24px] font-semibold leading-snug tracking-[-0.01em]">Five records, in order. Nothing settles out of sequence.</h2>
              </div>
              <ArrowLink href="/app">See it in the workspace</ArrowLink>
            </div>

            <ol className="mt-8 grid gap-x-8 lg:grid-cols-5">
              {SEQUENCE.map((s, i) => (
                <li key={s.n} className={`relative border-t-2 py-4 ${i < 4 ? 'lg:pr-6' : ''} ${i === 3 ? 'border-mineral' : 'border-line2/70'}`}>
                  <p className="flex items-baseline justify-between gap-2">
                    <span className={`font-mono text-[11px] font-semibold ${i === 3 ? 'text-mineral' : 'text-faint'}`}>{s.n}</span>
                    <span className="truncate font-mono text-[10px] text-faint">{s.ref}</span>
                  </p>
                  <h3 className="mt-2 text-[14.5px] font-semibold">{s.title}</h3>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-slate2">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------- Difference ---------- */}
        <section id="difference" className="mx-auto max-w-[1240px] px-4 py-10 sm:px-6 lg:py-14" aria-label="Why ProofPay">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-mineral">Why ProofPay</p>
          <h2 className="mt-2 max-w-[40ch] text-[24px] font-semibold leading-snug tracking-[-0.01em]">Built for the moment a delivery gets questioned.</h2>
          <div className="mt-7 grid gap-x-10 gap-y-7 md:grid-cols-3">
            {DIFFERENCE.map((d) => (
              <article key={d.title} className="border-t border-line pt-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-line bg-paper" aria-hidden="true">
                  <Icon d={I.shield} size={15} className="text-mineral" />
                </span>
                <h3 className="mt-3 text-[15px] font-semibold">{d.title}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate2">{d.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ---------- GenLayer: simulated vs live ---------- */}
        <section id="genlayer" className="border-t border-line bg-paper" aria-label="GenLayer integration, simulated versus live">
          <div className="mx-auto grid max-w-[1240px] gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:py-14">
            <div>
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-mineral">GenLayer adjudication</p>
              <h2 className="mt-2 max-w-[36ch] text-[24px] font-semibold leading-snug tracking-[-0.01em]">An intelligent contract reads the evidence. Deterministic code guards the money.</h2>
              <div className="mt-4 max-w-[62ch] space-y-3 text-[14px] leading-relaxed text-slate2">
                <p>
                  <strong className="font-medium text-ink">What GenLayer decides.</strong> The <span className="font-mono text-[12.5px]">ProofPayAdjudicator</span> contract receives the frozen terms, the criteria under dispute, and both parties’ evidence references. Under GenLayer’s Optimistic Democracy, a leader proposes a criterion-level verdict and validators independently re-run the judgment — they must agree on the decision fields before the result is stored.
                </p>
                <p>
                  <strong className="font-medium text-ink">What deterministic code decides.</strong> Whether a dispute is allowed at all, whether the evidence floor is met, and every settlement amount. A verdict is re-validated locally: no evidence, no settlement; a malformed verdict settles nothing. The contract is a decision record — it never holds custody of funds, and “authorized” is always recorded separately from “executed.”
                </p>
              </div>
              <p className="mt-5"><ArrowLink href="/app/disputes">Open the dispute workspace</ArrowLink></p>
            </div>

            <div className="h-fit border border-line2/80 bg-canvas" style={{ borderRadius: 10 }}>
              <p className="flex items-center justify-between border-b border-line px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">
                This demo <span className="font-mono text-[10px] font-medium normal-case tracking-normal text-amber2">DEMO_SIMULATED</span>
              </p>
              <dl className="divide-y divide-line text-[13px]">
                {[
                  ['Contract source', 'Real · Python Intelligent Contract'],
                  ['Adjudication in this demo', 'Simulated locally · no chain transaction'],
                  ['Funding & settlement', 'Simulated records · balanced, attributed'],
                  ['When configured', 'Studionet / Bradbury testnet via genlayer-js'],
                ].map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[128px_1fr] gap-3 px-4 py-2.5">
                    <dt className="text-faint">{k}</dt>
                    <dd className="font-medium text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="border-t border-line px-4 py-2.5 text-[11.5px] leading-relaxed text-faint">
                Point <span className="font-mono text-[11px]">GENLAYER_CONTRACT_ADDRESS</span> and <span className="font-mono text-[11px]">GENLAYER_PRIVATE_KEY</span> at a deployed contract to switch modes — the UI never relabels simulated activity as on-chain.
              </p>
            </div>
          </div>
        </section>

        {/* ---------- Closing CTA ---------- */}
        <section className="mx-auto max-w-[1240px] px-4 py-10 sm:px-6 lg:py-12" aria-label="Get started">
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-8">
            <div>
              <h2 className="text-[20px] font-semibold tracking-[-0.01em]">Review a real case file, not a screenshot.</h2>
              <p className="mt-1 max-w-[56ch] text-[13.5px] leading-relaxed text-slate2">The seeded workspace holds a settled agreement, a contested dispute, and a case returned for more evidence — all interactive.</p>
            </div>
            <span className="flex flex-wrap gap-2.5">
              <Link href="/app" className="inline-flex items-center gap-1.5 rounded-[8px] bg-midnight px-4 py-2.5 text-[14px] font-medium text-white transition-colors duration-fast hover:bg-ink">
                Open workspace <Icon d={I.arrowR} size={14} />
              </Link>
              <Link href="/app/agreements/new" className="inline-flex items-center gap-1.5 rounded-[8px] border border-line2 px-4 py-2.5 text-[14px] font-medium text-ink transition-colors duration-fast hover:bg-sidebar">
                Create an agreement
              </Link>
            </span>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-2 px-4 py-4 sm:px-6">
          <span className="flex items-center gap-2"><Logo /><span className="text-[12px] text-faint">Escrow with a memory.</span></span>
          <span className="font-mono text-[10.5px] text-faint">Demo workspace · DEMO_SIMULATED · no real funds or chain transactions</span>
        </div>
      </footer>
    </div>
  );
}
