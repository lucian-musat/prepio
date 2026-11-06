import Link from 'next/link';
import { listStudents, STUDENT_FILTERS, STUDENTS_PAGE_SIZE, type StudentFilter } from '@/lib/data/students';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const dateFmt = new Intl.DateTimeFormat('ro-RO', { dateStyle: 'medium', timeZone: 'Europe/Bucharest' });
const dateTimeFmt = new Intl.DateTimeFormat('ro-RO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Bucharest' });

const FILTER_LABELS: Record<StudentFilter, string> = { all: 'Toți', suspended: 'Suspendați', active_today: 'Activi azi' };
const EMPTY_LABELS: Partial<Record<StudentFilter, string>> = {
  suspended: 'Niciun elev suspendat.',
  active_today: 'Niciun elev activ azi.',
};

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; filter?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  const filter = STUDENT_FILTERS.find((f) => f === sp.filter) ?? 'all';
  const db = await createServerClient();
  const { rows, total } = await listStudents(db, { search: q, page, filter });
  const pages = Math.max(1, Math.ceil(total / STUDENTS_PAGE_SIZE));
  const href = (p: number, f: StudentFilter = filter) =>
    `/students?${new URLSearchParams({ ...(q ? { q } : {}), ...(f !== 'all' ? { filter: f } : {}), page: String(p) })}`;
  return (
    <>
      <h1 className="h3 mb-3">Elevi</h1>
      <form className="d-flex gap-2 mb-3" role="search" style={{ maxWidth: 480 }}>
        <input type="search" name="q" defaultValue={q} className="form-control" aria-label="Caută elev" placeholder="Nume sau email" />
        {filter !== 'all' && <input type="hidden" name="filter" value={filter} />}
        <button type="submit" className="btn btn-primary">Caută</button>
      </form>
      <div className="d-flex flex-wrap gap-2 mb-3" role="group" aria-label="Filtru elevi">
        {STUDENT_FILTERS.map((f) => (
          <Link
            key={f}
            href={href(1, f)}
            className={`btn btn-sm ${f === filter ? 'btn-primary' : 'btn-outline-secondary'}`}
            aria-current={f === filter ? 'true' : undefined}
          >
            {FILTER_LABELS[f]}
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="text-muted">{q ? 'Niciun elev găsit.' : (EMPTY_LABELS[filter] ?? 'Nu există elevi încă.')}</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead>
              <tr><th>Nume</th><th>Email</th><th>Stare</th><th>Sold</th><th>Ultima activitate</th><th>Înscris</th></tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td><Link href={`/students/${s.id}`}>{s.displayName || '—'}</Link></td>
                  <td>{s.email ?? '—'}</td>
                  <td>
                    {s.suspendedAt ? <span className="badge text-bg-danger">Suspendat</span> : <span className="badge text-bg-success">Activ</span>}
                    {s.reregistrationBlocked && <div className="small text-muted">Reînregistrare blocată</div>}
                  </td>
                  <td>{s.creditBalance}</td>
                  <td>{s.lastActivityAt ? dateTimeFmt.format(new Date(s.lastActivityAt)) : '—'}</td>
                  <td>{dateFmt.format(new Date(s.createdAt))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <nav className="d-flex align-items-center gap-3" aria-label="Paginare">
          {page > 1 ? <Link href={href(page - 1)}>‹ Anterioare</Link> : <span />}
          <span className="text-muted">Pagina {page} din {pages} ({total} elevi)</span>
          {page < pages && <Link href={href(page + 1)}>Următoare ›</Link>}
        </nav>
      )}
    </>
  );
}
