'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client/api';
import { CopyId, Drawer, EmptyState, Icon, I, PageHeader, Skeleton, cardCls, inputCls } from '@/components/ui';

type EvRow = { id: string; type: string; title: string; url: string; contentText: string; fileName: string; fileSize: number; contentHash: string; criterionId: string; createdAt: string; submittedById: string; submittedBy: { name: string }; agreementId: string; agreementTitle: string; clientId: string };
type AgLite = { id: string; title: string; clientId: string };

const TYPES = ['GITHUB', 'DEPLOYMENT_URL', 'SCREENSHOT', 'DOCUMENT', 'DELIVERABLE_FILE', 'NOTE'];

export default function EvidenceReviewPage() {
  const [rows, setRows] = useState<EvRow[] | null>(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [party, setParty] = useState('');
  const [selected, setSelected] = useState<EvRow | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const agreements = await api<AgLite[]>('/api/agreements');
        const per = await Promise.all(agreements.map(async (a) => {
          const evs = await api<Omit<EvRow, 'agreementId' | 'agreementTitle' | 'clientId'>[]>(`/api/agreements/${a.id}/evidence`).catch(() => []);
          return evs.map((e) => ({ ...e, agreementId: a.id, agreementTitle: a.title, clientId: a.clientId }));
        }));
        setRows(per.flat().sort((x, y) => +new Date(y.createdAt) - +new Date(x.createdAt)));
      } catch (e) { setErr(e instanceof Error ? e.message : 'Could not load evidence'); }
    })();
  }, []);

  const filtered = useMemo(() => (rows ?? []).filter((e) =>
    (!type || e.type === type) &&
    (!party || (party === 'CLIENT' ? e.submittedById === e.clientId : e.submittedById !== e.clientId)) &&
    (!q || `${e.title} ${e.id} ${e.agreementTitle} ${e.submittedBy.name}`.toLowerCase().includes(q.toLowerCase()))), [rows, q, type, party]);

  if (err) return <div className="border border-vermilion/30 bg-vermilion-tint px-4 py-3 text-[13px] text-vermilion" role="alert" style={{ borderRadius: 8 }}>{err}</div>;

  return (
    <div className="rise">
      <PageHeader title="Evidence Review" sub="Every evidence item across your agreements — one register per case, hashed at submission. Select any item to inspect its integrity metadata." />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Icon d={I.search} size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
          <label className="sr-only" htmlFor="eq">Search evidence</label>
          <input id="eq" className={`${inputCls} w-[220px] pl-8`} placeholder="Search title, agreement, author…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <label className="sr-only" htmlFor="et">Type</label>
        <select id="et" className="h-9 border border-line2 bg-paper px-2 text-[13px] rounded-[6px]" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>{TYPES.map((t) => <option key={t} value={t}>{t.replaceAll('_', ' ')}</option>)}
        </select>
        <label className="sr-only" htmlFor="ep">Submitting party</label>
        <select id="ep" className="h-9 border border-line2 bg-paper px-2 text-[13px] rounded-[6px]" value={party} onChange={(e) => setParty(e.target.value)}>
          <option value="">Both parties</option><option value="CLIENT">Client evidence</option><option value="PROVIDER">Provider evidence</option>
        </select>
        <span className="ml-auto text-[12px] text-faint" role="status">{filtered.length} item{filtered.length === 1 ? '' : 's'}</span>
      </div>

      {!rows ? <Skeleton className="h-96" /> : filtered.length === 0 ? (
        <EmptyState title="No evidence found" body="Evidence submitted in any case file's Evidence Studio appears here. Hashes prove what was submitted — never authorship or correctness by themselves."
          action={<Link href="/app/agreements" className="inline-flex h-8 items-center rounded-[6px] bg-mineral px-3 text-[13px] font-medium text-white hover:bg-mineral-deep">Open agreements</Link>} />
      ) : (
        <ul className={`${cardCls} divide-y divide-line`}>
          {filtered.map((e) => (
            <li key={e.id}>
              <button type="button" onClick={() => setSelected(e)} className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-fast hover:bg-sidebar/60" aria-label={`Inspect: ${e.title}`}>
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] bg-sidebar text-faint"><Icon d={I.evidence} size={14} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">{e.title}</span>
                  <span className="block truncate text-[12px] text-faint">
                    <Link href={`/app/agreements/${e.agreementId}`} className="font-medium text-mineral hover:underline" onClick={(ev) => ev.stopPropagation()}>{e.agreementTitle}</Link>
                    {' '}· {e.type.replaceAll('_', ' ')} · {e.submittedBy.name} ({e.submittedById === e.clientId ? 'client' : 'provider'}){e.criterionId ? <> · <span className="font-mono text-[11px]">{e.criterionId}</span></> : ''}
                  </span>
                  <span className="block truncate font-mono text-[10.5px] text-faint">sha256 {e.contentHash.slice(0, 24)}… · {new Date(e.createdAt).toLocaleString()}</span>
                </span>
                <span className="mt-1 shrink-0 border border-mineral/25 bg-mineral-tint px-1.5 py-[1px] text-[10px] font-semibold text-mineral-deep" style={{ borderRadius: 4 }}>HASH RECORDED</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected?.title ?? ''} sub={selected ? `${selected.type} · ${selected.id}` : ''}>
        {selected && (
          <div className="space-y-4 text-[13px]">
            <dl className="space-y-2.5">
              <div className="flex justify-between gap-3"><dt className="text-faint">Agreement</dt><dd><Link href={`/app/agreements/${selected.agreementId}`} className="font-medium text-mineral hover:underline">{selected.agreementTitle}</Link></dd></div>
              <div className="flex justify-between gap-3"><dt className="text-faint">Submitted by</dt><dd className="font-medium text-ink">{selected.submittedBy.name} ({selected.submittedById === selected.clientId ? 'client' : 'provider'})</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-faint">Submitted at</dt><dd className="tabular font-medium text-ink">{new Date(selected.createdAt).toLocaleString()}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-faint">Criterion</dt><dd className="font-mono text-[12px]">{selected.criterionId || 'General'}</dd></div>
              {selected.fileName && <div className="flex justify-between gap-3"><dt className="text-faint">File</dt><dd className="font-mono text-[11.5px]">{selected.fileName}{selected.fileSize ? ` · ${(selected.fileSize / 1024).toFixed(1)} KB` : ''}</dd></div>}
            </dl>
            <div className="border border-line bg-sidebar/60 px-3 py-2.5" style={{ borderRadius: 8 }}>
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-faint">Integrity metadata</p>
              <p className="mt-1 break-all font-mono text-[11px] leading-relaxed text-slate2">sha256 {selected.contentHash}</p>
              <p className="mt-1 flex items-center justify-between"><span className="text-[12px] text-faint">Hash recorded at submission</span><CopyId value={selected.contentHash} label="content hash" /></p>
            </div>
            {selected.url && <a href={selected.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 break-all font-medium text-mineral hover:underline">{selected.url} <Icon d={I.external} size={13} /></a>}
            {selected.contentText && <p className="whitespace-pre-wrap border border-line px-3 py-2.5 leading-relaxed text-slate2" style={{ borderRadius: 8 }}>{selected.contentText.slice(0, 2400)}</p>}
            <Link href={`/app/agreements/${selected.agreementId}/evidence`} className="inline-block font-medium text-mineral hover:underline">Open this case&rsquo;s Evidence Studio →</Link>
          </div>
        )}
      </Drawer>
    </div>
  );
}
