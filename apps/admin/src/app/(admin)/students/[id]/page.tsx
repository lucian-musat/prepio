import Link from 'next/link';
import { notFound } from 'next/navigation';
import { listStudentBacAttempts } from '@/lib/data/bac';
import { LEDGER_KIND_LABELS } from '@/lib/data/studentLabels';
import {
  EVENTS_PAGE_SIZE, getStudent, getStudentAccount, getStudentEvents, getStudentProgress, ledgerDetails, orderLabel, orderPrice, orderStatusLabel,
  type AdminLedgerEntry, type AdminOrder,
} from '@/lib/data/students';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerClient } from '@/lib/supabase/server';
import BacTab from './BacTab';
import ProgressTab from './ProgressTab';
import { NoticeProvider } from './Notice';
import StudentHeader from './StudentHeader';
import TimelineTab from './TimelineTab';

export const dynamic = 'force-dynamic';

const dateTimeFmt = new Intl.DateTimeFormat('ro-RO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Bucharest' });
const fmt = (iso: string) => dateTimeFmt.format(new Date(iso));

const TABS = [
  { key: 'parcurs', label: 'Parcurs' },
  { key: 'bac', label: 'Subiecte BAC' },
  { key: 'cronologie', label: 'Cronologie' },
  { key: 'credite', label: 'Credite' },
  { key: 'comenzi', label: 'Comenzi' },
] as const;
type Tab = (typeof TABS)[number]['key'];

function LedgerTable({ ledger }: { ledger: AdminLedgerEntry[] }) {
  if (ledger.length === 0) return <p className="text-muted mb-0">Nicio mișcare încă.</p>;
  return (
    <div className="table-responsive">
      <table className="table table-sm align-middle mb-0">
        <thead><tr><th>Data</th><th>Tip</th><th>Detalii</th><th>±</th><th>Sold după</th></tr></thead>
        <tbody>
          {ledger.map((e) => (
            <tr key={e.id}>
              <td className="text-nowrap">{fmt(e.createdAt)}</td>
              <td>{LEDGER_KIND_LABELS[e.kind] ?? e.kind}</td>
              <td>{ledgerDetails(e)}</td>
              <td className={e.delta > 0 ? 'text-success' : 'text-danger'}>{e.delta > 0 ? `+${e.delta}` : e.delta}</td>
              <td>{e.balanceAfter}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrdersTable({ orders }: { orders: AdminOrder[] }) {
  if (orders.length === 0) return <p className="text-muted mb-0">Nicio comandă.</p>;
  return (
    <div className="table-responsive">
      <table className="table table-sm align-middle mb-0">
        <thead><tr><th>Data</th><th>Comandă</th><th>Preț</th><th>Stare</th></tr></thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td className="text-nowrap">{fmt(o.createdAt)}</td>
              <td>{orderLabel(o)}</td>
              <td>{orderPrice(o)}</td>
              <td>{orderStatusLabel(o)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function StudentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const tab: Tab = TABS.find((t) => t.key === sp.tab)?.key ?? 'parcurs';
  const db = await createServerClient();
  const data = await getStudent(db, id);
  if (!data) notFound();
  const { student, ledger, orders } = data;
  // getStudent succeeded through the session client (admin_students refuses non-admins), so the caller is an admin.
  const [progress, account, events, bacAttempts] = await Promise.all([
    getStudentProgress(db, id),
    getStudentAccount(createAdminClient(), id),
    tab === 'cronologie' ? getStudentEvents(db, id) : Promise.resolve([]),
    tab === 'bac' ? listStudentBacAttempts(db, id) : Promise.resolve([]),
  ]);

  return (
    <>
      <p className="mb-2"><Link href="/students">‹ Elevi</Link></p>
      <NoticeProvider>
      <StudentHeader student={student} lessonsTotal={progress.length} mode={account.mode} suspendedBy={account.suspendedBy} />

      <div className="card">
        <div className="card-header">
          <nav className="nav nav-tabs card-header-tabs" aria-label="Secțiuni elev">
            {TABS.map((t) => (
              <Link
                key={t.key}
                href={t.key === 'parcurs' ? `/students/${id}` : `/students/${id}?tab=${t.key}`}
                className={`nav-link${t.key === tab ? ' active' : ''}`}
                aria-current={t.key === tab ? 'page' : undefined}
              >
                {t.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="card-body">
          {tab === 'parcurs' && <ProgressTab userId={id} rows={progress} />}
          {tab === 'bac' && <BacTab attempts={bacAttempts} />}
          {tab === 'cronologie' && <TimelineTab userId={id} initial={events} pageSize={EVENTS_PAGE_SIZE} />}
          {tab === 'credite' && <LedgerTable ledger={ledger} />}
          {tab === 'comenzi' && <OrdersTable orders={orders} />}
        </div>
      </div>
      </NoticeProvider>
    </>
  );
}
