'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api, post } from '@/lib/client/api';
import { Avatar, Icon, I, Kbd, Logo, LogoMark, Money, StatusBadge, ToastProvider, useToast } from './ui';

type Me = {
  user: { id: string; name: string; email: string; role: string; wallets?: { address: string }[] } | null;
  genlayer: { mode: string; network: { label: string; chainId: number }; contractAddress: string | null; contractVersion: string };
};
type AgRow = { id: string; title: string; status: string; amountMinor: number; currency: string };

const NAV = [
  { href: '/app', label: 'Overview', icon: I.overview, exact: true },
  { href: '/app/agreements', label: 'Agreements', icon: I.agreements },
  { href: '/app/evidence', label: 'Evidence Review', icon: I.evidence },
  { href: '/app/disputes', label: 'Disputes', icon: I.disputes },
  { href: '/app/transactions', label: 'Transactions', icon: I.transactions },
  { href: '/app/activity', label: 'Activity', icon: I.activity },
];

function crumbsFor(path: string): { label: string; href?: string }[] {
  const seg = path.split('/').filter(Boolean);
  const out: { label: string; href?: string }[] = [{ label: 'Workspace', href: '/app' }];
  if (seg[1] === 'agreements' && seg[2] === 'new') out.push({ label: 'Agreements', href: '/app/agreements' }, { label: 'New agreement' });
  else if (seg[1] === 'agreements' && seg[2]) {
    out.push({ label: 'Agreements', href: '/app/agreements' }, { label: 'Case file' });
    if (seg[3] === 'evidence') out.push({ label: 'Evidence studio' });
  } else if (seg[1] === 'agreements') out.push({ label: 'Agreements' });
  else if (seg[1] === 'evidence') out.push({ label: 'Evidence Review' });
  else if (seg[1] === 'disputes' && seg[2]) out.push({ label: 'Disputes', href: '/app/disputes' }, { label: 'Case review' });
  else if (seg[1] === 'disputes') out.push({ label: 'Disputes' });
  else if (seg[1] === 'transactions') out.push({ label: 'Transactions' });
  else if (seg[1] === 'activity') out.push({ label: 'Activity' });
  else if (seg[1] === 'receipts') out.push({ label: 'Receipt' });
  else if (seg[1] === 'settings') out.push({ label: 'Settings' });
  else if (seg.length <= 1) out.push({ label: 'Overview' });
  return out;
}

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<AgRow[]>([]);
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    setQ(''); setIdx(0);
    api<AgRow[]>('/api/agreements').then(setRows).catch(() => setRows([]));
    setTimeout(() => inputRef.current?.focus(), 30);
  }, [open ]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = needle ? rows.filter((r) => `${r.title} ${r.id} ${r.status}`.toLowerCase().includes(needle)) : rows;
    return base.slice(0, 8);
  }, [rows, q]);

  if (!open) return null;
  const go = (r: AgRow) => { onClose(); router.push(`/app/agreements/${r.id}`); };
  return (
    <div className="fixed inset-0 z-[92]" role="dialog" aria-modal="true" aria-label="Search agreements">
      <div className="overlay-in absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="rise relative mx-auto mt-[12vh] w-[min(92vw,560px)] overflow-hidden border border-line bg-paper shadow-menu" style={{ borderRadius: 12 }}>
        <div className="flex items-center gap-2 border-b border-line px-4">
          <Icon d={I.search} size={16} className="text-faint" />
          <input ref={inputRef} value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, results.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
              if (e.key === 'Enter' && results[idx]) go(results[idx]);
              if (e.key === 'Escape') onClose();
            }}
            placeholder="Search agreements by title, ID or status…" className="h-12 w-full bg-transparent text-[14px] outline-none placeholder:text-faint" aria-label="Search agreements" />
          <Kbd>esc</Kbd>
        </div>
        <ul className="max-h-[46vh] overflow-y-auto py-1.5" role="listbox" aria-label="Results">
          {results.length === 0 && <li className="px-4 py-6 text-center text-[13px] text-faint">No agreements match “{q}”. Try a title fragment or an agreement ID.</li>}
          {results.map((r, i) => (
            <li key={r.id}>
              <button type="button" role="option" aria-selected={i === idx} onMouseEnter={() => setIdx(i)} onClick={() => go(r)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-fast ${i === idx ? 'bg-mineral-tint/60' : ''}`}>
                <Icon d={I.agreements} size={16} className="shrink-0 text-faint" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">{r.title}</span>
                  <span className="block font-mono text-[10.5px] text-faint">{r.id}</span>
                </span>
                <StatusBadge status={r.status} />
                <Money minor={r.amountMinor} currency={r.currency} className="text-[13px] font-medium text-ink" />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-3 border-t border-line bg-sidebar px-4 py-2 text-[11px] text-faint">
          <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
          <span className="flex items-center gap-1"><Kbd>↵</Kbd> open</span>
          <Link href="/app/agreements/new" onClick={onClose} className="ml-auto font-medium text-mineral hover:underline">+ New agreement</Link>
        </div>
      </div>
    </div>
  );
}

function ShellInner({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [users, setUsers] = useState<{ id: string; name: string; role: string; email: string }[]>([]);
  const [notifs, setNotifs] = useState<{ id: string; title: string; body: string; href: string; createdAt: string; read: boolean }[]>([]);
  const [busy, setBusy] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const menuRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const m = await api<Me>('/api/auth/me');
      setMe(m);
      if (m.user) {
        const [u, n] = await Promise.all([
          api<{ id: string; name: string; role: string; email: string }[]>('/api/users').catch(() => []),
          api<{ id: string; title: string; body: string; href: string; createdAt: string; read: boolean }[]>('/api/notifications').catch(() => []),
        ]);
        setUsers(u); setNotifs(n);
      }
    } catch {
      setMe({ user: null, genlayer: { mode: 'DEMO_SIMULATED', network: { label: 'Demo', chainId: 0 }, contractAddress: null, contractVersion: '' } });
    }
  }, []);
  useEffect(() => { load(); }, [load, pathname]);
  useEffect(() => { setMobileOpen(false); setMenuOpen(false); setNotifOpen(false); }, [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen((o) => !o); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) { setMenuOpen(false); setNotifOpen(false); } };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const signIn = async (userId: string) => {
    setBusy(true);
    try { await post('/api/auth/login', { userId }); toast('Signed in to the demo workspace.'); await load(); router.push('/app'); }
    catch (e) { toast(e instanceof Error ? e.message : 'Sign-in failed', 'err'); }
    setBusy(false);
  };
  const signOut = async () => { await post('/api/auth/logout'); setMe((m) => (m ? { ...m, user: null } : m)); router.push('/'); };

  const crumbs = crumbsFor(pathname);
  const unread = notifs.filter((n) => !n.read).length;

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className={`flex h-14 items-center gap-2 border-b border-line px-4 ${collapsed ? 'justify-center px-2' : ''}`}>
        <Link href="/" aria-label="ProofPay home" className="flex items-center gap-2.5">{collapsed ? <LogoMark size={26} /> : <Logo />}</Link>
        <button type="button" onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="ml-auto hidden h-7 w-7 items-center justify-center rounded-[6px] text-faint transition hover:bg-black/[0.04] hover:text-ink lg:flex" title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <Icon d={I.collapse} size={15} className={collapsed ? 'rotate-180 transition-transform duration-base' : 'transition-transform duration-base'} />
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-3" aria-label="Workspace">
        {!collapsed && <p className="px-2 pb-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-faint">Workspace</p>}
        {NAV.map((n) => {
          const active = n.exact ? pathname === n.href : pathname === n.href || pathname.startsWith(`${n.href}/`) || (n.href === '/app/agreements' && pathname.startsWith('/app/receipts'));
          return (
            <Link key={n.href} href={n.href} aria-current={active ? 'page' : undefined} title={collapsed ? n.label : undefined}
              className={`group flex items-center gap-2.5 rounded-[6px] px-2.5 py-[7px] text-[13px] transition-colors duration-fast ${collapsed ? 'justify-center' : ''} ${active ? 'bg-black/[0.05] font-medium text-ink shadow-[inset_2px_0_0_#176B50]' : 'text-slate2 hover:bg-black/[0.03] hover:text-ink'}`}>
              <Icon d={n.icon} size={16} className={active ? 'text-mineral' : 'text-faint group-hover:text-slate2'} />
              {!collapsed && n.label}
            </Link>
          );
        })}
        {!collapsed && <p className="px-2 pb-1.5 pt-4 text-[10px] font-medium uppercase tracking-[0.12em] text-faint">Create</p>}
        <Link href="/app/agreements/new" title={collapsed ? 'New agreement' : undefined}
          className={`flex items-center gap-2.5 rounded-[6px] px-2.5 py-[7px] text-[13px] text-slate2 transition-colors duration-fast hover:bg-black/[0.03] hover:text-ink ${collapsed ? 'justify-center' : ''} ${pathname === '/app/agreements/new' ? 'bg-black/[0.05] font-medium text-ink' : ''}`}>
          <Icon d={I.plus} size={16} className="text-faint" />{!collapsed && 'New agreement'}
        </Link>
      </nav>

      <div className="border-t border-line px-2.5 py-3">
        <a href="/#genlayer" title={collapsed ? 'Help and documentation' : undefined}
          className={`flex items-center gap-2.5 rounded-[6px] px-2.5 py-[7px] text-[13px] text-slate2 transition-colors duration-fast hover:bg-black/[0.03] hover:text-ink ${collapsed ? 'justify-center' : ''}`}>
          <Icon d={I.help} size={16} className="text-faint" />{!collapsed && 'Help and documentation'}
        </a>
        <Link href="/app/settings" title={collapsed ? 'Settings' : undefined}
          className={`flex items-center gap-2.5 rounded-[6px] px-2.5 py-[7px] text-[13px] text-slate2 transition-colors duration-fast hover:bg-black/[0.03] hover:text-ink ${collapsed ? 'justify-center' : ''} ${pathname === '/app/settings' ? 'bg-black/[0.05] font-medium text-ink' : ''}`}>
          <Icon d={I.settings} size={16} className="text-faint" />{!collapsed && 'Settings'}
        </Link>

        {me?.user ? (
          <div className="relative mt-2" ref={undefined}>
            <button type="button" onClick={() => { setMenuOpen((o) => !o); setNotifOpen(false); }} aria-haspopup="menu" aria-expanded={menuOpen}
              className={`flex w-full items-center gap-2.5 rounded-[8px] px-2 py-2 text-left transition-colors duration-fast hover:bg-black/[0.04] ${collapsed ? 'justify-center' : ''}`} title={collapsed ? me.user.name : undefined}>
              <Avatar name={me.user.name} size={28} />
              {!collapsed && (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium leading-tight text-ink">{me.user.name}</span>
                    <span className="block truncate text-[11px] leading-tight text-faint">{me.user.role} · demo persona</span>
                  </span>
                  <Icon d={I.chevronD} size={14} className="shrink-0 text-faint" />
                </>
              )}
            </button>
            {menuOpen && (
              <div className="rise absolute bottom-full left-0 z-50 mb-1.5 w-64 border border-line bg-paper p-1.5 shadow-menu" style={{ borderRadius: 10 }} role="menu" aria-label="Account">
                <div className="border-b border-line px-2.5 py-2">
                  <p className="text-[13px] font-medium text-ink">{me.user.name}</p>
                  <p className="truncate text-[12px] text-faint">{me.user.email}</p>
                  {me.user.wallets?.[0] && <p className="mt-1 truncate font-mono text-[10.5px] text-faint">{me.user.wallets[0].address}</p>}
                </div>
                <p className="px-2.5 pb-1 pt-2 text-[10px] font-medium uppercase tracking-[0.12em] text-faint">Switch persona</p>
                {users.map((u) => (
                  <button key={u.id} type="button" role="menuitem" disabled={busy || u.id === me.user?.id} onClick={() => signIn(u.id)}
                    className="flex w-full items-center gap-2 rounded-[6px] px-2.5 py-1.5 text-left text-[13px] text-slate2 transition hover:bg-sidebar hover:text-ink disabled:opacity-50">
                    <Avatar name={u.name} size={22} /> {u.name} <span className="text-faint">· {u.role}</span>
                    {u.id === me.user?.id && <Icon d={I.check} size={13} className="ml-auto text-mineral" />}
                  </button>
                ))}
                <div className="mt-1 border-t border-line pt-1">
                  <Link href="/app/settings" role="menuitem" className="block rounded-[6px] px-2.5 py-1.5 text-[13px] text-slate2 transition hover:bg-sidebar hover:text-ink">Account & protocol settings</Link>
                  <button type="button" role="menuitem" onClick={signOut} className="block w-full rounded-[6px] px-2.5 py-1.5 text-left text-[13px] text-vermilion transition hover:bg-vermilion-tint">Sign out</button>
                </div>
              </div>
            )}
          </div>
        ) : (
          !collapsed && <p className="px-2 py-1 text-[12px] leading-relaxed text-faint">Sign in from the main panel to open your workspace.</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas">
      {/* Slim demo-integrity strip */}
      <div className="no-print flex items-center gap-2 bg-midnight px-4 py-[5px] text-[11.5px] text-white/85 sm:px-5">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${me?.genlayer.mode === 'GENLAYER_TESTNET' ? 'bg-emerald-400' : 'bg-amber-400'}`} aria-hidden="true" />
        <span className="truncate">
          {me?.genlayer.mode === 'GENLAYER_TESTNET'
            ? `Live — ${me.genlayer.network.label} · ${me.genlayer.contractAddress}`
            : 'Demo workspace — simulated ledger, no real funds or chain transactions. Simulated records are labelled everywhere.'}
        </span>
        <a href="/#genlayer" className="ml-auto shrink-0 font-medium text-white underline decoration-white/40 underline-offset-2 hover:decoration-white">Live vs simulated</a>
      </div>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className={`no-print sticky top-0 hidden h-screen shrink-0 border-r border-line bg-sidebar transition-[width] duration-base lg:block ${collapsed ? 'w-[60px]' : 'w-[228px]'}`}>{sidebar}</aside>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-[80] lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
            <div className="overlay-in absolute inset-0 bg-ink/40" onClick={() => setMobileOpen(false)} />
            <aside className="drawer-in absolute inset-y-0 left-0 w-[264px] border-r border-line bg-sidebar" style={{ animationName: 'fadeUp' }}>{sidebar}</aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar */}
          <header className="no-print sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-line bg-canvas/90 px-4 backdrop-blur-sm sm:px-6" ref={menuRef}>
            <button type="button" className="flex h-8 w-8 items-center justify-center rounded-[6px] text-slate2 hover:bg-sidebar lg:hidden" aria-label="Open navigation" onClick={() => setMobileOpen(true)}>
              <Icon d={I.menu} size={18} />
            </button>
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[13px]">
              {crumbs.map((c, i) => (
                <span key={i} className="flex min-w-0 items-center gap-1.5">
                  {i > 0 && <span className="text-line2" aria-hidden="true">/</span>}
                  {c.href && i < crumbs.length - 1
                    ? <Link href={c.href} className="shrink-0 text-faint transition hover:text-ink">{c.label}</Link>
                    : <span className="truncate font-medium text-ink" aria-current="page">{c.label}</span>}
                </span>
              ))}
            </nav>

            <button type="button" onClick={() => setPaletteOpen(true)}
              className="ml-auto hidden h-8 w-[240px] items-center gap-2 border border-line2 bg-paper px-2.5 text-[13px] text-faint transition hover:border-line2 hover:text-slate2 md:flex" style={{ borderRadius: 7 }}
              aria-label="Search agreements (Command K)">
              <Icon d={I.search} size={14} /> <span className="flex-1 text-left">Search…</span> <Kbd>⌘</Kbd><Kbd>K</Kbd>
            </button>
            <button type="button" onClick={() => setPaletteOpen(true)} className="ml-auto flex h-8 w-8 items-center justify-center rounded-[6px] text-slate2 hover:bg-sidebar md:hidden" aria-label="Search agreements">
              <Icon d={I.search} size={17} />
            </button>

            <div className="relative">
              <button type="button" onClick={() => { setNotifOpen((o) => !o); setMenuOpen(false); }} aria-haspopup="true" aria-expanded={notifOpen} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
                className="relative flex h-8 w-8 items-center justify-center rounded-[6px] text-slate2 transition hover:bg-sidebar hover:text-ink">
                <Icon d={I.bell} size={17} />
                {unread > 0 && <span className="absolute right-1.5 top-1.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-vermilion px-[3px] text-[9px] font-semibold text-white">{unread}</span>}
              </button>
              {notifOpen && (
                <div className="rise absolute right-0 z-50 mt-1.5 w-[min(90vw,340px)] border border-line bg-paper shadow-menu" style={{ borderRadius: 10 }} role="region" aria-label="Notifications">
                  <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
                    <p className="text-[13px] font-semibold text-ink">Notifications</p>
                    {notifs.length > 0 && (
                      <button type="button" className="text-[12px] font-medium text-mineral hover:underline" onClick={async () => { await post('/api/notifications'); load(); }}>Mark all read</button>
                    )}
                  </div>
                  <ul className="max-h-[50vh] overflow-y-auto">
                    {notifs.length === 0 && <li className="px-3.5 py-6 text-center text-[13px] text-faint">Nothing new. Disputes, evidence and settlement updates will appear here.</li>}
                    {notifs.slice(0, 8).map((n) => (
                      <li key={n.id} className="border-b border-line last:border-0">
                        <Link href={n.href || '/app'} className="block px-3.5 py-2.5 transition hover:bg-sidebar">
                          <span className="flex items-center gap-2 text-[13px] font-medium text-ink">{n.title}{!n.read && <span className="h-1.5 w-1.5 rounded-full bg-mineral" aria-label="Unread" />}</span>
                          <span className="mt-0.5 block text-[12px] leading-snug text-faint">{n.body}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <Link href="/app/agreements/new" className="hidden h-8 items-center gap-1.5 rounded-[6px] bg-mineral px-3 text-[13px] font-medium text-white transition hover:bg-mineral-deep active:scale-[0.98] sm:inline-flex">
              <Icon d={I.plus} size={14} /> New agreement
            </Link>
          </header>

          <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
            {!me ? (
              <div className="space-y-3" aria-busy="true"><div className="h-8 w-56 animate-pulse rounded bg-sidebar" /><div className="h-40 animate-pulse rounded-[10px] border border-line bg-paper" /></div>
            ) : !me.user ? (
              <div className="mx-auto mt-10 max-w-md border border-line bg-paper p-6 shadow-card" style={{ borderRadius: 12 }}>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-mineral-tint text-mineral"><Icon d={I.agreements} size={19} /></span>
                <h1 className="mt-3 text-[18px] font-semibold tracking-tight text-ink">Sign in to your workspace</h1>
                <p className="mt-1 text-[13px] leading-relaxed text-faint">Demo personas only — synthetic users, no real credentials. Each persona sees only the agreements they are a party to; authorization is enforced on the server.</p>
                <div className="mt-4 flex flex-col gap-1.5">
                  {users.length === 0 && <p className="text-[13px] text-faint">Loading personas… If this persists, run <span className="font-mono">npm run db:seed</span>.</p>}
                  {users.map((u) => (
                    <button key={u.id} type="button" disabled={busy} onClick={() => signIn(u.id)}
                      className="flex items-center gap-2.5 border border-line bg-paper px-3 py-2.5 text-left transition hover:border-mineral hover:bg-mineral-tint/40 disabled:opacity-50" style={{ borderRadius: 8 }}>
                      <Avatar name={u.name} size={26} />
                      <span className="text-[13px] font-medium text-ink">{u.name}</span>
                      <span className="text-[12px] text-faint">{u.role}</span>
                      <Icon d={I.arrowR} size={14} className="ml-auto text-faint" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              children
            )}
          </main>

          <footer className="no-print border-t border-line px-6 py-3 text-[11.5px] text-faint">
            ProofPay demo workspace · Simulated records are always labelled · <Link href="/app/settings" className="hover:text-ink hover:underline">Protocol status</Link>
          </footer>
        </div>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ShellInner>{children}</ShellInner>
    </ToastProvider>
  );
}
