import Link from 'next/link';
import { referralStateLabel, type AdminReferralRow } from '@/lib/data/referrals';

const dateFmt = new Intl.DateTimeFormat('ro-RO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Bucharest' });
const fmt = (iso: string) => dateFmt.format(new Date(iso));

export default function ReferralsSection({
  code, invitedBy, invitees, failed = false,
}: {
  code: string | null;
  invitedBy: { id: string; name: string } | null;
  invitees: AdminReferralRow[];
  /** The data could not be loaded: show a note instead of an empty list. */
  failed?: boolean;
}) {
  if (failed) return <p className="text-danger mb-0" role="alert">Recomandările nu au putut fi încărcate.</p>;
  return (
    <div>
      <p className="mb-1">Cod de recomandare: <code data-testid="referral-code">{code ?? '—'}</code></p>
      {invitedBy && <p className="mb-3">Invitat de <Link href={`/students/${invitedBy.id}`}>{invitedBy.name}</Link></p>}
      {invitees.length === 0 ? (
        <p className="text-muted mb-0">Nu a invitat pe nimeni.</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0">
            <thead><tr><th>Prenume</th><th>E-mail</th><th>Înregistrat</th><th>Abonat</th><th>Stare</th></tr></thead>
            <tbody>
              {invitees.map((r) => (
                <tr key={r.id}>
                  <td>{r.firstName}</td>
                  <td>{r.accountDeleted ? <span className="text-muted">cont șters</span> : (r.email ?? '—')}</td>
                  <td className="text-nowrap">{fmt(r.createdAt)}</td>
                  <td className="text-nowrap">{r.firstPaidAt ? fmt(r.firstPaidAt) : '—'}</td>
                  <td>{referralStateLabel(r.state, r.rewardCredits)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
