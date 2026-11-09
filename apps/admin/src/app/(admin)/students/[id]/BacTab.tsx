import { BAC_TOTAL_POINTS, formatGrade } from '@prepio/shared';
import type { StudentBacAttempt } from '@/lib/data/bac';
import { formatDayTime } from './format';

const STATUS: Record<StudentBacAttempt['status'], { label: string; className: string }> = {
  graded: { label: 'Corectată', className: 'text-success' },
  failed: { label: 'Corectare nereușită', className: 'text-danger' },
};

export default function BacTab({ attempts }: { attempts: StudentBacAttempt[] }) {
  if (attempts.length === 0) return <p className="text-muted mb-0">Nicio lucrare corectată încă.</p>;
  return (
    <div className="table-responsive">
      <table className="table table-sm align-middle mb-0">
        <thead><tr><th>Subiect</th><th>Data</th><th>Punctaj</th><th>Nota</th><th>Stare</th></tr></thead>
        <tbody>
          {attempts.map((a) => (
            <tr key={a.id}>
              <td>{a.subjectTitle}</td>
              <td className="text-nowrap">{formatDayTime(a.date)}</td>
              <td>{a.points != null ? `${a.points} / ${BAC_TOTAL_POINTS}` : '—'}</td>
              <td>{a.grade != null ? formatGrade(a.grade) : '—'}</td>
              <td className={STATUS[a.status].className}>{STATUS[a.status].label}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
