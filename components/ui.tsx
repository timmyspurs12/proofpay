'use client';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { formatMoney } from '@/lib/domain/money';

/* ---------------- Wordmark ---------------- */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="ProofPay" className="shrink-0">
      <rect x="1.5" y="1.5" width="29" height="29" rx="7" fill="#191A19" />
      <path d="M10 22.5 V9.8 h5.2 a4.4 4.4 0 0 1 0 8.8 H13" fill="none" stroke="#FAFAF8" strokeWidth="2.3" strokeLinecap="round" />
      <path d="M18.6 19.6 l2.3 2.3 4-4.4" fill="none" stroke="#3E9B77" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark />
      {!compact && (
        <span className="leading-none">
          <span className="block text-[15px] font-semibold tracking-tight text-ink">ProofPay</span>
          <span className="mt-0.5 block text-[9px] font-medium uppercase tracking-[0.16em] text-faint">Payment operations</span>
        </span>
      )}
    </span>
  );
}

/* ---------------- Icons (16px line) ---------------- */
export const I = {
  overview: 'M3 5.5A1.5 1.5 0 0 1 4.5 4h4A1.5 1.5 0 0 1 10 5.5v4A1.5 1.5 0 0 1 8.5 11h-4A1.5 1.5 0 0 1 3 9.5v-4ZM14 5.5A1.5 1.5 0 0 1 15.5 4h4A1.5 1.5 0 0 1 21 5.5v9a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 14 14.5v-9ZM3 15.5A1.5 1.5 0 0 1 4.5 14h4A1.5 1.5 0 0 1 10 15.5v4A1.5 1.5 0 0 1 8.5 21h-4A1.5 1.5 0 0 1 3 19.5v-4Z',
  agreements: 'M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z M14 3v5h5 M9.5 13h6 M9.5 17h6',
  evidence: 'M8 3h8l4 4v13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z M10 12.5l2 2 4-4.5',
  disputes: 'M12 3v3 M5 7l7-4 7 4 M3 13l2-6 2 6a3.5 3.5 0 0 1-4 0Z M17 13l2-6 2 6a3.5 3.5 0 0 1-4 0Z M8.5 21h7 M12 6v15',
  transactions: 'M4 7h13l-3-3 M20 17H7l3 3',
  activity: 'M4 5v14a1 1 0 0 0 1 1h14 M8 15v-4 M12 15V8 M16 15v-6',
  plus: 'M12 5v14M5 12h14',
  search: 'M10.5 4a6.5 6.5 0 1 0 4.9 11.5L20 20',
  bell: 'M6 16v-5a6 6 0 0 1 12 0v5l1.5 3h-15L6 16Z M10 21a2 2 0 0 0 4 0',
  help: 'M9.5 9.3A2.6 2.6 0 1 1 12 12.5V14 M12 17.5v.5 M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
  chevronD: 'M6 9.5 12 15l6-5.5',
  chevronR: 'M9.5 6 15 12l-5.5 6',
  copy: 'M9 9h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z M5 15V5a1 1 0 0 1 1-1h9',
  check: 'M4.5 12.5 10 18 19.5 7',
  x: 'M6 6l12 12M18 6 6 18',
  arrowR: 'M4 12h15 M13 6l6 6-6 6',
  external: 'M14 4h6v6 M20 4l-9 9 M9 5H6a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-3',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M12 7.5V12l3 2',
  alert: 'M12 4 2.8 20h18.4L12 4Z M12 10v4.5 M12 17.5v.5',
  shield: 'M12 3.5 5 6v5c0 4.6 3 7.7 7 9.5 4-1.8 7-4.9 7-9.5V6l-7-2.5Z M9.3 12l2 2 3.6-4',
  collapse: 'M9 5 3.5 12 9 19 M15 5l5.5 7L15 19',
  menu: 'M4 7h16M4 12h16M4 17h16',
  settings: 'M12 8.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4Z M12 3v2.2 M12 18.8V21 M3 12h2.2 M18.8 12H21 M5.6 5.6l1.6 1.6 M16.8 16.8l1.6 1.6 M18.4 5.6l-1.6 1.6 M7.2 16.8l-1.6 1.6',
};

export function Icon({ d, size = 16, className = '' }: { d: string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d={d} />
    </svg>
  );
}

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <span className="inline-flex shrink-0 select-none items-center justify-center rounded-full bg-midnight font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden="true">{initials}</span>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center border border-line2 bg-paper px-1 font-mono text-[10px] font-medium text-slate2 shadow-[0_1px_0_#D9D9D1]" style={{ borderRadius: 4 }}>{children}</kbd>;
}

/* ---------------- Status system (understated labels) ---------------- */
const STATUS_META: Record<string, { label: string; dot: string; text: string }> = {
  DRAFT: { label: 'Draft', dot: '#B9B9B0', text: 'text-slate2' },
  CREATED: { label: 'Unfunded', dot: '#D9A441', text: 'text-amber2' },
  FUNDED: { label: 'Funded · awaiting work', dot: '#D9A441', text: 'text-amber2' },
  SUBMITTED: { label: 'Submitted', dot: '#D9A441', text: 'text-amber2' },
  UNDER_REVIEW: { label: 'Awaiting acceptance', dot: '#D9A441', text: 'text-amber2' },
  DISPUTED: { label: 'In dispute', dot: '#B3402A', text: 'text-vermilion' },
  ADJUDICATING: { label: 'Adjudicating', dot: '#B3402A', text: 'text-vermilion' },
  DECIDED: { label: 'Decided', dot: '#176B50', text: 'text-mineral' },
  ADDITIONAL_EVIDENCE_REQUIRED: { label: 'Needs evidence', dot: '#B3402A', text: 'text-vermilion' },
  SETTLEMENT_PENDING: { label: 'Settlement pending', dot: '#D9A441', text: 'text-amber2' },
  SETTLEMENT_FAILED: { label: 'Settlement failed', dot: '#B3402A', text: 'text-vermilion' },
  SETTLED: { label: 'Settled', dot: '#176B50', text: 'text-mineral' },
  CANCELLED: { label: 'Cancelled', dot: '#B9B9B0', text: 'text-slate2' },
  EXPIRED: { label: 'Expired', dot: '#B9B9B0', text: 'text-slate2' },
  OPEN: { label: 'Open', dot: '#B3402A', text: 'text-vermilion' },
  EVIDENCE: { label: 'Collecting evidence', dot: '#D9A441', text: 'text-amber2' },
  NEEDS_EVIDENCE: { label: 'Needs evidence', dot: '#B3402A', text: 'text-vermilion' },
  CLOSED: { label: 'Closed', dot: '#B9B9B0', text: 'text-slate2' },
};

export function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status.replaceAll('_', ' ').toLowerCase(), dot: '#B9B9B0', text: 'text-slate2' };
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12px] font-medium ${m.text}`}>
      <span className="inline-block h-[7px] w-[7px] rounded-full" style={{ background: m.dot }} aria-hidden="true" />
      {m.label}
    </span>
  );
}

const DECISION_META: Record<string, { label: string; cls: string }> = {
  BUYER_WINS: { label: 'Buyer wins — refund', cls: 'bg-midnight text-white' },
  SELLER_WINS: { label: 'Seller wins — release', cls: 'bg-mineral text-white' },
  PARTIAL_SETTLEMENT: { label: 'Partial settlement', cls: 'bg-amber2 text-white' },
  INSUFFICIENT_EVIDENCE: { label: 'Insufficient evidence', cls: 'bg-vermilion text-white' },
};

export function DecisionBadge({ decision }: { decision: string }) {
  const m = DECISION_META[decision] ?? { label: decision, cls: 'bg-midnight text-white' };
  return <span className={`inline-flex px-2 py-[3px] text-[11px] font-semibold ${m.cls}`} style={{ borderRadius: 5 }}>{m.label}</span>;
}

export function ModeBadge({ mode }: { mode: string }) {
  if (mode === 'GENLAYER_TESTNET')
    return <span className="inline-flex items-center gap-1.5 border border-mineral/30 bg-mineral-tint px-1.5 py-[2px] text-[11px] font-medium text-mineral-deep" style={{ borderRadius: 5 }}><span className="h-1.5 w-1.5 rounded-full bg-mineral" />GenLayer testnet</span>;
  return (
    <span className="inline-flex items-center gap-1.5 border border-amber2/30 bg-amber2-tint px-1.5 py-[2px] text-[11px] font-medium text-amber2" style={{ borderRadius: 5 }}
      title="No GenLayer transaction exists for this record — simulated demo mode">
      <span className="h-1.5 w-1.5 rounded-full bg-amber2" />Simulated
    </span>
  );
}

/* ---------------- Primitives ---------------- */
export function Money({ minor, currency = 'USD', className = '' }: { minor: number; currency?: string; className?: string }) {
  return <span className={`tabular ${className}`}>{formatMoney(minor, currency)}</span>;
}

export function CopyId({ value, label, className = '' }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button"
      className={`group inline-flex max-w-full items-center gap-1 font-mono text-[11.5px] text-slate2 transition-colors duration-fast hover:text-mineral ${className}`}
      title={label ?? `Copy ${value}`} aria-label={`Copy ${label ?? value}`}
      onClick={async (e) => {
        e.preventDefault(); e.stopPropagation();
        try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1400); } catch { /* unavailable */ }
      }}>
      <span className="truncate">{value}</span>
      <span className={`shrink-0 ${copied ? 'text-mineral' : 'text-faint opacity-0 group-hover:opacity-100'} transition-opacity duration-fast`}>
        <Icon d={copied ? I.check : I.copy} size={12} />
      </span>
      <span className="sr-only" role="status">{copied ? 'Copied' : ''}</span>
    </button>
  );
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[20px] font-semibold leading-tight tracking-tight text-ink">{title}</h1>
        {sub && <p className="mt-0.5 text-[13px] text-faint">{sub}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ kicker, title, right }: { kicker?: string; title: string; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-[13px] font-semibold tracking-tight text-ink">
        {kicker && <span className="mr-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-faint">{kicker}</span>}
        {title}
      </h2>
      {right}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="border border-dashed border-line2 bg-paper px-6 py-12 text-center" style={{ borderRadius: 10 }}>
      <span className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-sidebar text-faint"><Icon d={I.agreements} size={17} /></span>
      <p className="text-[14px] font-semibold text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-faint">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = 'h-24' }: { className?: string }) {
  return <div className={`animate-pulse border border-line bg-paper ${className}`} style={{ borderRadius: 10 }} aria-hidden="true" />;
}

export const btnPrimary = 'inline-flex h-8 items-center justify-center gap-1.5 bg-mineral px-3 text-[13px] font-medium text-white transition-all duration-fast hover:bg-mineral-deep active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 rounded-[6px]';
export const btnDark = 'inline-flex h-8 items-center justify-center gap-1.5 bg-midnight px-3 text-[13px] font-medium text-white transition-all duration-fast hover:bg-black active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 rounded-[6px]';
export const btnGhost = 'inline-flex h-8 items-center justify-center gap-1.5 border border-line2 bg-paper px-3 text-[13px] font-medium text-ink transition-all duration-fast hover:bg-sidebar hover:border-line2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 rounded-[6px]';
export const btnDanger = 'inline-flex h-8 items-center justify-center gap-1.5 border border-vermilion/35 bg-paper px-3 text-[13px] font-medium text-vermilion transition-all duration-fast hover:bg-vermilion-tint active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 rounded-[6px]';
export const btnSm = 'h-7 px-2.5 text-[12px]';
export const cardCls = 'border border-line bg-paper shadow-card rounded-[10px]';
export const inputCls = 'h-9 w-full border border-line2 bg-paper px-2.5 text-[13px] text-ink placeholder:text-faint transition-colors duration-fast focus:border-mineral rounded-[6px] disabled:opacity-50';
export const textareaCls = 'w-full border border-line2 bg-paper px-2.5 py-2 text-[13px] leading-relaxed text-ink placeholder:text-faint transition-colors duration-fast focus:border-mineral rounded-[6px] disabled:opacity-50';
export const labelCls = 'mb-1 block text-[12px] font-medium text-slate2';
export const thCls = 'px-3 py-2 text-left text-[11px] font-medium uppercase tracking-[0.06em] text-faint';
export const tdCls = 'px-3 py-2.5 text-[13px]';

/* ---------------- Toasts ---------------- */
const ToastCtx = createContext<(msg: string, kind?: 'ok' | 'err') => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; msg: string; kind: string }[]>([]);
  const push = useCallback((msg: string, kind: 'ok' | 'err' = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[95] flex w-[min(92vw,360px)] flex-col gap-2" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`rise pointer-events-auto flex items-start gap-2 border px-3 py-2.5 text-[13px] shadow-menu ${t.kind === 'err' ? 'border-vermilion/30 bg-[#FDF4F1] text-vermilion' : 'border-mineral/25 bg-[#F2F8F4] text-mineral-deep'}`} style={{ borderRadius: 8 }}>
            <Icon d={t.kind === 'err' ? I.alert : I.check} size={15} className="mt-[1px] shrink-0" />
            <span className="leading-snug">{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------------- Confirm modal ---------------- */
export function ConfirmModal({
  open, title, body, confirmLabel, busy, danger, onCancel, onConfirm,
}: {
  open: boolean; title: string; body: string; confirmLabel: string; busy?: boolean; danger?: boolean;
  onCancel: () => void; onConfirm: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div className="overlay-in fixed inset-0 z-[90] flex items-end justify-center bg-ink/40 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label={title} onClick={onCancel}>
      <div className="rise w-full max-w-md border border-line bg-paper p-5 shadow-menu" style={{ borderRadius: 12 }} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-slate2">{body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onCancel} disabled={busy}>Cancel</button>
          <button ref={confirmRef} type="button" className={danger ? 'inline-flex h-8 items-center rounded-[6px] bg-vermilion px-3 text-[13px] font-medium text-white transition hover:brightness-95 active:scale-[0.98] disabled:opacity-45' : btnDark} onClick={onConfirm} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Drawer ---------------- */
export function Drawer({ open, title, sub, onClose, children, wide }: { open: boolean; title: string; sub?: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[85]" role="dialog" aria-modal="true" aria-label={title}>
      <div className="overlay-in absolute inset-0 bg-ink/35" onClick={onClose} />
      <aside className={`drawer-in absolute inset-y-0 right-0 flex w-full flex-col border-l border-line bg-paper shadow-menu ${wide ? 'max-w-xl' : 'max-w-md'}`}>
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-semibold text-ink">{title}</h3>
            {sub && <p className="mt-0.5 truncate font-mono text-[11px] text-faint">{sub}</p>}
          </div>
          <button type="button" onClick={onClose} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] text-slate2 transition hover:bg-sidebar hover:text-ink" aria-label="Close panel">
            <Icon d={I.x} size={15} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </aside>
    </div>
  );
}
