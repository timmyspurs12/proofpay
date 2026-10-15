'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, post } from '@/lib/client/api';
import { Avatar, Icon, I, Money, PageHeader, btnGhost, btnPrimary, inputCls, labelCls, textareaCls, useToast } from '@/components/ui';
import { parseMoneyToMinor, CURRENCIES } from '@/lib/domain/money';

type User = { id: string; name: string; role: string; wallets?: { address: string }[] };

const STEPS = [
  { label: 'Parties & value', hint: 'Who, how much, by when' },
  { label: 'Deliverables', hint: 'What will be delivered' },
  { label: 'Acceptance criteria', hint: 'How proof is judged' },
  { label: 'Terms & review', hint: 'Evidence, review, settlement' },
];

export default function NewAgreementPage() {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [users, setUsers] = useState<User[]>([]);
  const [meId, setMeId] = useState('');
  const [busy, setBusy] = useState(false);
  const [draftSaved, setDraftSaved] = useState('');
  const [touched, setTouched] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [counterpartyId, setCounterpartyId] = useState('');
  const [myRole, setMyRole] = useState<'CLIENT' | 'PROVIDER'>('CLIENT');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [deadline, setDeadline] = useState('');
  const [deliverables, setDeliverables] = useState([{ title: '', description: '' }]);
  const [criteria, setCriteria] = useState([{ text: '', deliverableIdx: 0 }]);
  const [evidenceRequirements, setEvidenceRequirements] = useState('');
  const [reviewDays, setReviewDays] = useState('7');
  const [allowPartial, setAllowPartial] = useState(true);
  const [settlementNotes, setSettlementNotes] = useState('');

  useEffect(() => {
    api<{ user: { id: string } | null }>('/api/auth/me').then((m) => setMeId(m.user?.id ?? ''));
    api<User[]>('/api/users').then(setUsers).catch(() => {});
    try {
      const raw = localStorage.getItem('proofpay_draft');
      if (raw) {
        const d = JSON.parse(raw);
        setTitle(d.title ?? ''); setDescription(d.description ?? ''); setAmount(d.amount ?? '');
        if (Array.isArray(d.deliverables) && d.deliverables.length) setDeliverables(d.deliverables);
        if (Array.isArray(d.criteria) && d.criteria.length) setCriteria(d.criteria);
        setDraftSaved('Draft restored from this browser.');
      }
    } catch { /* ignore */ }
  }, []);

  const amountMinor = useMemo(() => parseMoneyToMinor(amount), [amount]);
  const errors: Record<number, string> = {};
  if (title.trim().length < 3) errors[0] = 'Give the agreement a title (3+ characters).';
  else if (!counterpartyId) errors[0] = 'Choose the counterparty.';
  else if (!amountMinor) errors[0] = 'Enter a valid payment amount.';
  else if (!deadline) errors[0] = 'Set a deadline.';
  if (deliverables.some((d) => !d.title.trim())) errors[1] = 'Every deliverable needs a title.';
  if (criteria.some((c) => c.text.trim().length < 10)) errors[2] = 'Each criterion must be an objective, checkable statement (10+ characters).';
  const valid = Object.keys(errors).length === 0;
  const counterparty = users.find((u) => u.id === counterpartyId);

  const saveDraft = () => {
    localStorage.setItem('proofpay_draft', JSON.stringify({ title, description, amount, deliverables, criteria }));
    setDraftSaved(`Draft saved in this browser at ${new Date().toLocaleTimeString()}. A draft is not an agreement — nothing is recorded or funded yet.`);
    toast('Draft saved locally.');
  };

  const submit = async () => {
    setTouched(true);
    if (!valid) { toast('Complete the highlighted steps first.', 'err'); return; }
    setBusy(true);
    try {
      const dels = deliverables.map((d, i) => ({ id: `del_${i + 1}`, title: d.title, description: d.description }));
      const created = await post<{ id: string }>('/api/agreements', {
        title, description, counterpartyId,
        counterpartyRole: myRole === 'CLIENT' ? 'PROVIDER' : 'CLIENT',
        amountMinor, currency, deadline: new Date(deadline).toISOString(),
        reviewDays: Number(reviewDays) || 7,
        deliverables: dels,
        criteria: criteria.map((c, i) => ({ id: `crit_${i + 1}`, deliverableId: dels[c.deliverableIdx]?.id ?? dels[0].id, text: c.text })),
        evidenceRequirements, allowPartial, settlementNotes,
      });
      localStorage.removeItem('proofpay_draft');
      toast('Agreement created (unfunded). Funding is a separate, explicit step on the case file.');
      router.push(`/app/agreements/${created.id}`);
    } catch (e) { toast(e instanceof Error ? e.message : 'Could not create agreement', 'err'); }
    setBusy(false);
  };

  const fieldErr = (s: number) => (touched || step === s) && errors[s];

  return (
    <div className="rise">
      <PageHeader title="New agreement" sub="Terms are hashed into version v1 at creation. Creating an agreement and funding it are separate, explicit acts." />

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <div>
          {/* Progress */}
          <ol className="mb-5 flex border border-line bg-paper shadow-card" style={{ borderRadius: 10 }} aria-label="Progress">
            {STEPS.map((s, i) => {
              const done = i < step && !errors[i];
              const current = i === step;
              return (
                <li key={s.label} className={`flex-1 ${i > 0 ? 'border-l border-line' : ''}`}>
                  <button type="button" onClick={() => setStep(i)} aria-current={current ? 'step' : undefined}
                    className={`flex w-full items-center gap-2.5 px-3.5 py-3 text-left transition-colors duration-fast ${current ? 'bg-mineral-tint/50' : 'hover:bg-sidebar'}`}>
                    <span className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${done ? 'bg-mineral text-white' : current ? 'bg-midnight text-white' : 'bg-sidebar text-faint border border-line2'}`}>
                      {done ? <Icon d={I.check} size={11} /> : i + 1}
                    </span>
                    <span className="hidden min-w-0 sm:block">
                      <span className={`block truncate text-[12.5px] font-medium ${current ? 'text-ink' : 'text-slate2'}`}>{s.label}</span>
                      <span className="block truncate text-[11px] text-faint">{errors[i] && (touched || current) ? errors[i] : s.hint}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="border border-line bg-paper p-5 shadow-card" style={{ borderRadius: 10 }}>
            {step === 0 && (
              <div className="space-y-4">
                <div><label className={labelCls} htmlFor="t">Agreement title</label><input id="t" className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Helio Health — booking API, milestone 2" autoFocus /></div>
                <div><label className={labelCls} htmlFor="d">Description</label><textarea id="d" className={textareaCls} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is being bought, in plain terms?" /></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelCls} htmlFor="role">Your role</label>
                    <select id="role" className={inputCls} value={myRole} onChange={(e) => setMyRole(e.target.value as 'CLIENT' | 'PROVIDER')}>
                      <option value="CLIENT">Client (buyer)</option><option value="PROVIDER">Provider (seller)</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="cp">Counterparty</label>
                    <select id="cp" className={inputCls} value={counterpartyId} onChange={(e) => setCounterpartyId(e.target.value)}>
                      <option value="">Select from demo directory…</option>
                      {users.filter((u) => u.id !== meId).map((u) => <option key={u.id} value={u.id}>{u.name} — {u.role}</option>)}
                    </select>
                    {counterparty?.wallets?.[0] && <p className="mt-1 truncate font-mono text-[10.5px] text-faint">{counterparty.wallets[0].address}</p>}
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="amt">Payment amount</label>
                    <input id="amt" className={inputCls} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="12,500.00" aria-describedby="amt-hint" aria-invalid={amount !== '' && !amountMinor} />
                    <p id="amt-hint" className="mt-1 text-[12px] text-faint">{amountMinor ? <>Stored as {amountMinor.toLocaleString()} minor units (integer, no floats).</> : 'Major units; stored as integer minor units.'}</p>
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="cur">Currency</label>
                    <select id="cur" className={inputCls} value={currency} onChange={(e) => setCurrency(e.target.value)}>{CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
                  </div>
                  <div><label className={labelCls} htmlFor="dl">Deadline</label><input id="dl" type="date" className={inputCls} value={deadline} onChange={(e) => setDeadline(e.target.value)} /></div>
                </div>
                {fieldErr(0) && <p className="flex items-center gap-1.5 text-[13px] text-vermilion" role="alert"><Icon d={I.alert} size={14} />{errors[0]}</p>}
              </div>
            )}

            {step === 1 && (
              <div className="space-y-3">
                {deliverables.map((d, i) => (
                  <fieldset key={i} className="border border-line p-4" style={{ borderRadius: 8 }}>
                    <legend className="px-1 text-[12px] font-semibold text-ink">Deliverable {i + 1}</legend>
                    <label className={labelCls} htmlFor={`dt${i}`}>Title</label>
                    <input id={`dt${i}`} className={inputCls} value={d.title} onChange={(e) => setDeliverables(deliverables.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} placeholder="e.g. Booking API" />
                    <label className={`${labelCls} mt-3`} htmlFor={`dd${i}`}>Description</label>
                    <textarea id={`dd${i}`} className={textareaCls} rows={2} value={d.description} onChange={(e) => setDeliverables(deliverables.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} placeholder="Scope, format, where it will be delivered" />
                    {deliverables.length > 1 && <button type="button" className="mt-2 text-[12px] font-medium text-vermilion hover:underline" onClick={() => setDeliverables(deliverables.filter((_, j) => j !== i))}>Remove deliverable</button>}
                  </fieldset>
                ))}
                <button type="button" className={btnGhost} onClick={() => setDeliverables([...deliverables, { title: '', description: '' }])}><Icon d={I.plus} size={14} /> Add deliverable</button>
                {fieldErr(1) && <p className="flex items-center gap-1.5 text-[13px] text-vermilion" role="alert"><Icon d={I.alert} size={14} />{errors[1]}</p>}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <p className="border-l-2 border-mineral bg-mineral-tint/50 px-3 py-2 text-[13px] leading-relaxed text-slate2">Write criteria an independent reviewer could check from evidence alone. Vague criteria (“good quality”) produce UNCERTAIN findings at adjudication.</p>
                {criteria.map((c, i) => (
                  <div key={i} className="border border-line p-4" style={{ borderRadius: 8 }}>
                    <label className={labelCls} htmlFor={`ct${i}`}>Criterion {i + 1}</label>
                    <textarea id={`ct${i}`} className={textareaCls} rows={2} value={c.text} onChange={(e) => setCriteria(criteria.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} placeholder="e.g. Cancellation refunds the hold within the same request, covered by an automated test." />
                    <div className="mt-1 flex items-center justify-between">
                      <span className={`text-[11px] ${c.text.trim().length >= 10 ? 'text-mineral' : 'text-faint'}`}>{c.text.trim().length}/10 min characters</span>
                      {criteria.length > 1 && <button type="button" className="text-[12px] font-medium text-vermilion hover:underline" onClick={() => setCriteria(criteria.filter((_, j) => j !== i))}>Remove criterion</button>}
                    </div>
                    <label className={`${labelCls} mt-2`} htmlFor={`cd${i}`}>Belongs to deliverable</label>
                    <select id={`cd${i}`} className={inputCls} value={c.deliverableIdx} onChange={(e) => setCriteria(criteria.map((x, j) => (j === i ? { ...x, deliverableIdx: Number(e.target.value) } : x)))}>
                      {deliverables.map((d, di) => <option key={di} value={di}>{d.title || `Deliverable ${di + 1}`}</option>)}
                    </select>
                  </div>
                ))}
                <button type="button" className={btnGhost} onClick={() => setCriteria([...criteria, { text: '', deliverableIdx: 0 }])}><Icon d={I.plus} size={14} /> Add criterion</button>
                {fieldErr(2) && <p className="flex items-center gap-1.5 text-[13px] text-vermilion" role="alert"><Icon d={I.alert} size={14} />{errors[2]}</p>}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div><label className={labelCls} htmlFor="evr">Evidence requirements</label><textarea id="evr" className={textareaCls} rows={3} value={evidenceRequirements} onChange={(e) => setEvidenceRequirements(e.target.value)} placeholder="e.g. Repository + commit link, deployment URL, CI run, written criterion mapping" /></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><label className={labelCls} htmlFor="rv">Review period (days)</label><input id="rv" className={inputCls} inputMode="numeric" value={reviewDays} onChange={(e) => setReviewDays(e.target.value)} /></div>
                  <div className="flex items-end pb-0.5">
                    <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-ink">
                      <input type="checkbox" className="h-4 w-4" checked={allowPartial} onChange={(e) => setAllowPartial(e.target.checked)} />
                      Authorize partial settlement by adjudication
                    </label>
                  </div>
                </div>
                <div><label className={labelCls} htmlFor="sn">Settlement terms note</label><textarea id="sn" className={textareaCls} rows={2} value={settlementNotes} onChange={(e) => setSettlementNotes(e.target.value)} placeholder="Refund, release and expiry expectations both parties agree to" /></div>
                <div className="flex gap-2.5 border border-amber2/30 bg-amber2-tint px-3.5 py-3 text-[13px] leading-relaxed" style={{ borderRadius: 8 }}>
                  <Icon d={I.alert} size={15} className="mt-0.5 shrink-0 text-amber2" />
                  <p><strong className="text-amber2">Review before you create.</strong> <span className="text-slate2">Creation records terms v1 with a sha256 hash — it does not fund anything. The client funds as a separate step, and after funding the criteria cannot be silently edited.</span></p>
                </div>
                {!valid && <p className="text-[13px] text-vermilion" role="alert">Some steps are incomplete: {Object.entries(errors).map(([k, v]) => `Step ${Number(k) + 1} — ${v}`).join(' ')}</p>}
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
              <button type="button" className={btnGhost} disabled={step === 0} onClick={() => setStep(step - 1)}>← Back</button>
              {step < 3 ? (
                <button type="button" className={btnPrimary} onClick={() => { setTouched(true); setStep(step + 1); }}>Continue →</button>
              ) : (
                <button type="button" className={btnPrimary} disabled={busy} onClick={submit}>{busy ? 'Creating…' : 'Confirm & create agreement (unfunded)'}</button>
              )}
              <button type="button" className="ml-auto text-[13px] font-medium text-slate2 transition hover:text-ink" onClick={saveDraft}>Save draft</button>
            </div>
            {draftSaved && <p className="mt-2 text-[12px] text-faint" role="status">{draftSaved}</p>}
          </div>
        </div>

        {/* Live summary rail */}
        <aside className="border border-line bg-paper shadow-card lg:sticky lg:top-[104px]" style={{ borderRadius: 10 }} aria-label="Agreement summary">
          <div className="border-b border-line px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Live summary · v1 draft</p>
            <h3 className="mt-1 text-[15px] font-semibold leading-snug text-ink">{title || 'Untitled agreement'}</h3>
            {description && <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-[12.5px] leading-relaxed text-faint">{description}</p>}
          </div>
          <dl className="space-y-2 px-4 py-3 text-[13px]">
            <div className="flex items-center justify-between gap-3"><dt className="text-faint">You</dt><dd className="font-medium text-ink">{myRole === 'CLIENT' ? 'Client' : 'Provider'}</dd></div>
            <div className="flex items-center justify-between gap-3"><dt className="text-faint">Counterparty</dt><dd className="flex items-center gap-1.5 font-medium text-ink">{counterparty ? <><Avatar name={counterparty.name} size={20} />{counterparty.name}</> : '—'}</dd></div>
            <div className="flex items-center justify-between gap-3"><dt className="text-faint">Amount</dt><dd className="font-semibold text-ink">{amountMinor ? <Money minor={amountMinor} currency={currency} /> : '—'}</dd></div>
            <div className="flex items-center justify-between gap-3"><dt className="text-faint">Deadline</dt><dd className="font-medium text-ink">{deadline || '—'}</dd></div>
            <div className="flex items-center justify-between gap-3"><dt className="text-faint">Review period</dt><dd className="font-medium text-ink">{reviewDays || '7'} days</dd></div>
            <div className="flex items-center justify-between gap-3"><dt className="text-faint">Partial settlement</dt><dd className="font-medium text-ink">{allowPartial ? 'Authorized' : 'Not authorized'}</dd></div>
          </dl>
          <div className="border-t border-line px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Deliverables · {deliverables.filter((d) => d.title).length}</p>
            <ul className="mt-1.5 space-y-1 text-[13px] text-slate2">
              {deliverables.filter((d) => d.title).map((d, i) => <li key={i} className="flex gap-2"><span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-mineral" />{d.title}</li>)}
              {deliverables.every((d) => !d.title) && <li className="text-faint">None yet.</li>}
            </ul>
            <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Acceptance criteria · {criteria.filter((c) => c.text).length}</p>
            <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-[13px] text-slate2">
              {criteria.filter((c) => c.text).map((c, i) => <li key={i}>{c.text}</li>)}
              {criteria.every((c) => !c.text) && <li className="list-none text-faint">None yet.</li>}
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}
