'use client';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { api, post } from '@/lib/client/api';
import { CopyId, Drawer, EmptyState, Icon, I, PageHeader, Skeleton, btnPrimary, cardCls, inputCls, labelCls, textareaCls, useToast } from '@/components/ui';

type Ev = { id: string; type: string; title: string; url: string; contentText: string; fileName: string; fileSize: number; contentHash: string; criterionId: string; disputeId: string | null; createdAt: string; submittedById: string; submittedBy: { name: string } };
type Detail = { agreement: { id: string; title: string; clientId: string; providerId: string }; versions: { snapshotParsed: { criteria: { id: string; text: string }[] } }[]; evidence: Ev[]; myRole: string };

const TYPES = [
  { v: 'GITHUB', label: 'GitHub repo / commit' },
  { v: 'DEPLOYMENT_URL', label: 'Deployment URL' },
  { v: 'SCREENSHOT', label: 'Screenshot' },
  { v: 'DOCUMENT', label: 'Document' },
  { v: 'DELIVERABLE_FILE', label: 'Deliverable file' },
  { v: 'NOTE', label: 'Written explanation' },
];
const TYPE_LABEL = Object.fromEntries(TYPES.map((t) => [t.v, t.label]));

function StudioInner() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const toast = useToast();
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [filterCriterion, setFilterCriterion] = useState('');
  const [selected, setSelected] = useState<Ev | null>(null);

  const [type, setType] = useState('NOTE');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [contentText, setContentText] = useState('');
  const [criterionId, setCriterionId] = useState('');
  const [fileMeta, setFileMeta] = useState<{ name: string; size: number; text: string } | null>(null);

  const load = useCallback(() => { api<Detail>(`/api/agreements/${id}`).then(setD).catch((e) => setErr(e.message)); }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const c = search.get('criterion'); if (c) setCriterionId(c); }, [search]);

  const criteria = d?.versions[d.versions.length - 1]?.snapshotParsed.criteria ?? [];
  const filtered = useMemo(() => (d?.evidence ?? []).filter((e) => (!filterType || e.type === filterType) && (!filterCriterion || e.criterionId === filterCriterion)), [d, filterType, filterCriterion]);

  if (err) return <div className="border border-vermilion/30 bg-vermilion-tint px-4 py-3 text-[13px] text-vermilion" role="alert" style={{ borderRadius: 8 }}>{err}</div>;
  if (!d) return <Skeleton className="h-96" />;

  const onFile = async (f: File | null) => {
    if (!f) return;
    if (f.size > 25_000_000) { toast('File exceeds the 25 MB evidence limit.', 'err'); return; }
    let text = '';
    if (f.size <= 200_000 && (f.type.startsWith('text') || /\.(txt|md|json|csv|log)$/i.test(f.name))) text = (await f.text()).slice(0, 5000);
    setFileMeta({ name: f.name, size: f.size, text });
    setTitle((t) => t || f.name);
    if (!contentText && text) setContentText(text);
    toast(`Staged locally: ${f.name} (${(f.size / 1024).toFixed(1)} KB). Name, size and content snapshot are hashed on submit; the binary stays in this browser in demo mode.`);
  };

  const linkValid = type === 'GITHUB' || type === 'DEPLOYMENT_URL' ? /^https:\/\//.test(url) : true;
  const canSubmit = !busy && linkValid && title.trim().length >= 2 && (type !== 'NOTE' || contentText.trim().length >= 3);

  const submit = async () => {
    setBusy(true);
    try {
      const res = await post<{ duplicateWarning: string | null }>(`/api/agreements/${id}/evidence`, {
        type, title, url, contentText, criterionId,
        fileName: fileMeta?.name ?? '', fileSize: fileMeta?.size ?? 0,
        disputeId: search.get('dispute') ?? undefined,
      });
      toast(res.duplicateWarning ?? 'Evidence recorded with its sha256 integrity hash.');
      setTitle(''); setUrl(''); setContentText(''); setFileMeta(null);
      load();
    } catch (e) { toast(e instanceof Error ? e.message : 'Could not submit evidence', 'err'); }
    setBusy(false);
  };

  return (
    <div className="rise">
      <PageHeader title="Evidence studio" sub={<>For <Link href={`/app/agreements/${id}`} className="font-medium text-mineral hover:underline">{d.agreement.title}</Link> — one shared register for both parties.</>} />

      <div className="mb-5 flex gap-2.5 border border-amber2/25 bg-amber2-tint/60 px-3.5 py-3 text-[13px] leading-relaxed" style={{ borderRadius: 8 }} role="note">
        <Icon d={I.alert} size={15} className="mt-0.5 shrink-0 text-amber2" />
        <p className="text-slate2"><strong className="text-amber2">What a hash proves — and what it doesn&rsquo;t.</strong> Submission records a sha256 of the URL/content snapshot: that exact content, at that time, from that party. It does <em>not</em> prove authorship or that the work meets the criteria — that judgment belongs to acceptance or adjudication. Links are format-checked; reachability is not independently verified in demo mode.</p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[380px_1fr]">
        <form className="border border-line bg-paper p-4 shadow-card lg:sticky lg:top-[104px]" style={{ borderRadius: 10 }} onSubmit={(e) => { e.preventDefault(); submit(); }} aria-label="Add evidence">
          <h2 className="text-[14px] font-semibold text-ink">Add evidence</h2>
          <div className="mt-3.5 space-y-3.5">
            <div>
              <label className={labelCls} htmlFor="etype">Evidence type</label>
              <select id="etype" className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>{TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}</select>
            </div>
            <div>
              <label className={labelCls} htmlFor="etitle">Title</label>
              <input id="etitle" className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Name it so a reviewer finds it in seconds" required minLength={2} />
            </div>
            {(type === 'GITHUB' || type === 'DEPLOYMENT_URL') && (
              <div>
                <label className={labelCls} htmlFor="eurl">URL (https)</label>
                <input id="eurl" className={inputCls} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" aria-invalid={url !== '' && !linkValid} />
                {url && !linkValid && <p className="mt-1 text-[12px] text-vermilion" role="alert">Link evidence must start with https://</p>}
                {url && linkValid && <p className="mt-1 text-[12px] text-mineral">Format valid. Reachability is not independently verified in demo mode.</p>}
              </div>
            )}
            {(type === 'SCREENSHOT' || type === 'DOCUMENT' || type === 'DELIVERABLE_FILE') && (
              <div>
                <label className={labelCls} htmlFor="efile">File (max 25 MB · hashed on submit)</label>
                <input id="efile" type="file" className="w-full text-[13px] file:mr-3 file:h-8 file:cursor-pointer file:rounded-[6px] file:border file:border-line2 file:bg-paper file:px-3 file:text-[12px] file:font-medium hover:file:bg-sidebar" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
                {fileMeta && <p className="mt-1 font-mono text-[11px] text-slate2">{fileMeta.name} · {(fileMeta.size / 1024).toFixed(1)} KB staged</p>}
              </div>
            )}
            <div>
              <label className={labelCls} htmlFor="etext">Content / explanation</label>
              <textarea id="etext" className={textareaCls} rows={4} value={contentText} onChange={(e) => setContentText(e.target.value)} placeholder="What does this prove, and against which criterion? The adjudicator reads this." />
              {type === 'NOTE' && contentText.trim().length < 3 && <p className="mt-1 text-[12px] text-faint">Written evidence needs at least a short explanation.</p>}
            </div>
            <div>
              <label className={labelCls} htmlFor="ecrit">Related acceptance criterion</label>
              <select id="ecrit" className={inputCls} value={criterionId} onChange={(e) => setCriterionId(e.target.value)}>
                <option value="">General (no specific criterion)</option>
                {criteria.map((c) => <option key={c.id} value={c.id}>{c.id} — {c.text.slice(0, 90)}…</option>)}
              </select>
            </div>
            <button type="submit" className={`${btnPrimary} w-full`} disabled={!canSubmit}>{busy ? 'Recording & hashing…' : 'Submit evidence'}</button>
          </div>
        </form>

        <section aria-label="Evidence register">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="text-[14px] font-semibold text-ink">Register · {filtered.length}</h2>
            <div className="ml-auto flex gap-2">
              <label className="sr-only" htmlFor="ft">Filter by type</label>
              <select id="ft" className="h-9 border border-line2 bg-paper px-2 text-[13px] rounded-[6px]" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                <option value="">All types</option>{TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
              </select>
              <label className="sr-only" htmlFor="fc">Filter by criterion</label>
              <select id="fc" className="h-9 border border-line2 bg-paper px-2 text-[13px] rounded-[6px]" value={filterCriterion} onChange={(e) => setFilterCriterion(e.target.value)}>
                <option value="">All criteria</option>{criteria.map((c) => <option key={c.id} value={c.id}>{c.id}</option>)}
              </select>
            </div>
          </div>
          {filtered.length === 0 ? (
            <EmptyState title="No evidence matches" body="Submit the first item, or clear the filters. Evidence from both parties shares this one register, each item linked to the criterion it addresses." />
          ) : (
            <ul className="divide-y divide-line border border-line bg-paper shadow-card" style={{ borderRadius: 10 }}>
              {filtered.map((e) => (
                <li key={e.id}>
                  <button type="button" onClick={() => setSelected(e)} className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-fast hover:bg-sidebar/60" aria-label={`Inspect evidence: ${e.title}`}>
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] bg-sidebar text-faint"><Icon d={I.evidence} size={14} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-ink">{e.title}</span>
                      <span className="block text-[12px] text-faint">{TYPE_LABEL[e.type] ?? e.type} · {e.submittedBy.name} ({e.submittedById === d.agreement.clientId ? 'client' : 'provider'}){e.criterionId ? <> · <span className="font-mono text-[11px]">{e.criterionId}</span></> : ''} · {new Date(e.createdAt).toLocaleDateString()}</span>
                      <span className="block truncate font-mono text-[10.5px] text-faint">sha256 {e.contentHash.slice(0, 24)}…</span>
                    </span>
                    <span className="mt-1 shrink-0 border border-mineral/25 bg-mineral-tint px-1.5 py-[1px] text-[10px] font-semibold text-mineral-deep" style={{ borderRadius: 4 }}>HASH RECORDED</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected?.title ?? ''} sub={selected ? `${selected.type} · ${selected.id}` : ''}>
        {selected && (
          <div className="space-y-4 text-[13px]">
            <dl className="space-y-2.5">
              <div className="flex justify-between gap-3"><dt className="text-faint">Submitted by</dt><dd className="font-medium text-ink">{selected.submittedBy.name} ({selected.submittedById === d.agreement.clientId ? 'client' : 'provider'})</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-faint">Submitted at</dt><dd className="tabular font-medium text-ink">{new Date(selected.createdAt).toLocaleString()}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-faint">Criterion</dt><dd className="text-right font-medium text-ink">{selected.criterionId ? `${selected.criterionId} — ${criteria.find((c) => c.id === selected.criterionId)?.text ?? ''}` : 'General'}</dd></div>
              {selected.fileName && <div className="flex justify-between gap-3"><dt className="text-faint">File</dt><dd className="font-mono text-[11.5px]">{selected.fileName}{selected.fileSize ? ` · ${(selected.fileSize / 1024).toFixed(1)} KB` : ''}</dd></div>}
            </dl>
            <div className="border border-line bg-sidebar/60 px-3 py-2.5" style={{ borderRadius: 8 }}>
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Integrity metadata</p>
              <p className="mt-1 break-all font-mono text-[11px] leading-relaxed text-slate2">sha256 {selected.contentHash}</p>
              <p className="mt-1.5 flex items-center justify-between gap-2"><span className="text-[12px] text-faint">Status: hash recorded at submission</span><CopyId value={selected.contentHash} label="content hash" /></p>
              <p className="mt-1 text-[12px] leading-relaxed text-faint">Proves the submitted content snapshot — not authorship, not correctness.</p>
            </div>
            {selected.url && (
              <div>
                <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Reference</p>
                <a href={selected.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 break-all font-medium text-mineral hover:underline">{selected.url} <Icon d={I.external} size={13} /></a>
              </div>
            )}
            {selected.contentText && (
              <div>
                <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Content preview</p>
                <p className="whitespace-pre-wrap border border-line bg-paper px-3 py-2.5 leading-relaxed text-slate2" style={{ borderRadius: 8 }}>{selected.contentText.slice(0, 2400)}{selected.contentText.length > 2400 ? '…' : ''}</p>
              </div>
            )}
            <p className="text-[12px] leading-relaxed text-faint">Binary previews are not stored server-side in demo mode; the file name, size and text snapshot above are what the hash covers.</p>
          </div>
        )}
      </Drawer>
    </div>
  );
}

export default function EvidenceStudioPage() {
  return <Suspense fallback={<Skeleton className="h-96" />}><StudioInner /></Suspense>;
}
