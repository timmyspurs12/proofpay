import { prisma } from '@/lib/server/db';
import { getSessionUser } from '@/lib/server/auth';
import { ok, handle, AuthError } from '@/lib/server/api';

export async function GET(req: Request) {
  return handle(async () => {
    const me = await getSessionUser();
    if (!me) throw new AuthError();
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') ?? '').toLowerCase();
    const type = url.searchParams.get('type') ?? '';
    const role = url.searchParams.get('role') ?? '';
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');

    const myAgreements = await prisma.agreement.findMany({
      where: { OR: [{ clientId: me.id }, { providerId: me.id }] },
      select: { id: true, title: true, clientId: true, providerId: true },
    });
    const ids = myAgreements.map((a) => a.id);
    const titleOf = new Map(myAgreements.map((a) => [a.id, a.title]));
    const disputeRows = await prisma.dispute.findMany({ where: { agreementId: { in: ids } }, select: { id: true, agreementId: true } });
    const disputeAgreement = new Map(disputeRows.map((d) => [d.id, d.agreementId]));

    const [events, chainTxs, settlements] = await Promise.all([
      prisma.auditEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 300 }),
      prisma.blockchainTransaction.findMany({ where: { agreementId: { in: ids } }, orderBy: { createdAt: 'desc' }, take: 200 }),
      prisma.settlementInstruction.findMany({ where: { agreementId: { in: ids } }, orderBy: { createdAt: 'desc' }, take: 200 }),
    ]);

    type Row = { id: string; at: Date; kind: string; agreementId: string; agreementTitle: string; actorRole: string; status: string; detail: string; reference: string };
    const rows: Row[] = [];
    for (const e of events) {
      const agreementId = e.entityType === 'agreement' ? e.entityId : disputeAgreement.get(e.entityId);
      if (!agreementId || !ids.includes(agreementId)) continue;
      const ag = myAgreements.find((a) => a.id === agreementId)!;
      rows.push({
        id: e.id, at: e.createdAt, kind: e.action, agreementId, agreementTitle: titleOf.get(agreementId) ?? agreementId,
        actorRole: e.actorId === ag.clientId ? 'CLIENT' : e.actorId === ag.providerId ? 'PROVIDER' : 'SYSTEM',
        status: 'RECORDED', detail: e.detail, reference: e.id,
      });
    }
    for (const t of chainTxs) {
      if (!t.agreementId) continue;
      rows.push({ id: t.id, at: t.createdAt, kind: `TX_${t.kind}`, agreementId: t.agreementId, agreementTitle: titleOf.get(t.agreementId) ?? t.agreementId, actorRole: 'SYSTEM', status: t.status, detail: `${t.network} — ${t.detail}`, reference: t.txId });
    }
    for (const s of settlements) {
      rows.push({ id: s.id, at: s.createdAt, kind: 'SETTLEMENT', agreementId: s.agreementId, agreementTitle: titleOf.get(s.agreementId) ?? s.agreementId, actorRole: 'SYSTEM', status: s.status, detail: `${s.decision}: provider ${s.toProviderMinor} / client ${s.toClientMinor} minor units (${s.mode})`, reference: s.reference || s.id });
    }
    rows.sort((a, b) => +new Date(b.at) - +new Date(a.at));

    const filtered = rows.filter((r) => {
      if (type && r.kind !== type) return false;
      if (role && r.actorRole !== role) return false;
      if (from && new Date(r.at) < new Date(from)) return false;
      if (to && new Date(r.at) > new Date(`${to}T23:59:59`)) return false;
      if (q && !`${r.kind} ${r.detail} ${r.reference} ${r.agreementTitle}`.toLowerCase().includes(q)) return false;
      return true;
    });
    return ok({ rows: filtered.slice(0, 200), kinds: [...new Set(rows.map((r) => r.kind))].sort() });
  });
}
