import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CONSOLIDATION_TYPE_LABELS, formatLei, type ConsolidationType } from '@prepio/shared';
import { getStudent, type AdminLedgerEntry } from '@/lib/data/students';
import { createServerClient } from '@/lib/supabase/server';
import AdjustCreditsForm from './AdjustCreditsForm';

export const dynamic = 'force-dynamic';

const dateTimeFmt = new Intl.DateTimeFormat('ro-RO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Bucharest' });
const fmt = (iso: string) => dateTimeFmt.format(new Date(iso));

const KIND_LABELS: Record<string, string> = {
  welcome: 'Bun venit',
  purchase: 'Achiziție',
  check: 'Verificare',
  refund: 'Rambursare',
  admin: 'Ajustare admin',
};
const STATUS_LABELS: Record<string, string> = { pending: 'În așteptare', approved: 'Plătită', failed: 'Eșuată' };

function details(e: AdminLedgerEntry): string {
  if (e.kind === 'admin') return [e.reason, e.adminEmail].filter(Boolean).join(' · ');
  const parts: string[] = [];
  if (e.exerciseType) {
    const label = CONSOLIDATION_TYPE_LABELS[e.exerciseType as ConsolidationType] ?? e.exerciseType;
    const prompt = e.exercisePrompt ? (e.exercisePrompt.length > 60 ? `${e.exercisePrompt.slice(0, 60)}…` : e.exercisePrompt) : '';
    parts.push(prompt ? `${label}: ${prompt}` : label);
  }
  if (e.reason) parts.push(e.reason);
  return parts.join(' · ');
}

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await createServerClient();
  const data = await getStudent(db, id);
  if (!data) notFound();
  const { student, ledger, orders } = data;
  return (
    <>
      <p className="mb-2"><Link href="/students">‹ Elevi</Link></p>
      <div className="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
        <div>
          <h1 className="h3 mb-1">{student.displayName || student.email || 'Elev'}</h1>
          <div className="text-muted">{student.email ?? '—'} · înscris {fmt(student.createdAt)}</div>
        </div>
        <div className="text-end">
          <div className="text-muted small">Sold</div>
          <div className="display-5 fw-bold" data-testid="balance">{student.creditBalance}</div>
        </div>
      </div>

      <AdjustCreditsForm userId={student.id} />

      <h2 className="h5">Istoric credite</h2>
      {ledger.length === 0 ? (
        <p className="text-muted">Nicio mișcare încă.</p>
      ) : (
        <div className="table-responsive mb-4">
          <table className="table table-sm align-middle">
            <thead><tr><th>Data</th><th>Tip</th><th>Detalii</th><th>±</th><th>Sold după</th></tr></thead>
            <tbody>
              {ledger.map((e) => (
                <tr key={e.id}>
                  <td className="text-nowrap">{fmt(e.createdAt)}</td>
                  <td>{KIND_LABELS[e.kind] ?? e.kind}</td>
                  <td>{details(e)}</td>
                  <td className={e.delta > 0 ? 'text-success' : 'text-danger'}>{e.delta > 0 ? `+${e.delta}` : e.delta}</td>
                  <td>{e.balanceAfter}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="h5">Comenzi</h2>
      {orders.length === 0 ? (
        <p className="text-muted">Nicio comandă.</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm align-middle">
            <thead><tr><th>Data</th><th>Credite</th><th>Preț</th><th>Stare</th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="text-nowrap">{fmt(o.createdAt)}</td>
                  <td>{o.credits}</td>
                  <td>{formatLei(o.priceBani)}</td>
                  <td>{STATUS_LABELS[o.status] ?? o.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
