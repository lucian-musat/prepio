import Link from 'next/link';
import { listStudents, STUDENTS_PAGE_SIZE } from '@/lib/data/students';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const dateFmt = new Intl.DateTimeFormat('ro-RO', { dateStyle: 'medium', timeZone: 'Europe/Bucharest' });

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  const db = await createServerClient();
  const { rows, total } = await listStudents(db, { search: q, page });
  const pages = Math.max(1, Math.ceil(total / STUDENTS_PAGE_SIZE));
  const href = (p: number) => `/students?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;
  return (
    <>
      <h1 className="h3 mb-3">Elevi</h1>
      <form className="d-flex gap-2 mb-3" role="search" style={{ maxWidth: 480 }}>
        <input type="search" name="q" defaultValue={q} className="form-control" aria-label="Caută elev" placeholder="Nume sau email" />
        <button type="submit" className="btn btn-primary">Caută</button>
      </form>
      {rows.length === 0 ? (
        <p className="text-muted">{q ? 'Niciun elev găsit.' : 'Nu există elevi încă.'}</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead>
              <tr><th>Nume</th><th>Email</th><th>Sold</th><th>Înscris</th></tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td><Link href={`/students/${s.id}`}>{s.displayName || '—'}</Link></td>
                  <td>{s.email ?? '—'}</td>
                  <td>{s.creditBalance}</td>
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
