import Link from 'next/link';
import { currentAccessContributors, referralStateLabel, type AdminReferralRow } from '@/lib/data/referrals';

const dateFmt = new Intl.DateTimeFormat('ro-RO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Bucharest' });
const fmt = (iso: string) => dateFmt.format(new Date(iso));

export default function ReferralsSection({
  code, invitedBy, invitees, failed = false, currentGrantId = null,
}: {
  code: string | null;
  invitedBy: { id: string; name: string } | null;
  invitees: AdminReferralRow[];
  /** The data could not be loaded: show a note instead of an empty list. */
  failed?: boolean;
  /** The free-access grant (access_ledger id) behind the current access, when it came from referrals. */
  currentGrantId?: number | null;
}) {
  if (failed) return <p className="text-danger mb-0" role="alert">Recomandările nu au putut fi încărcate.</p>;
  const current = currentAccessContributors(invitees, { kind: 'referral_reward', entryId: currentGrantId });
  const currentIds = new Set(current.map((r) => r.id));
  return (
    <div>
      <p className="mb-1">Cod de recomandare: <code data-testid="referral-code">{code ?? '—'}</code></p>
      {invitedBy && <p className="mb-3">Invitat de <Link href={`/students/${invitedBy.id}`}>{invitedBy.name}</Link></p>}
      {current.length > 0 && <p className="mb-3">{`Au contribuit la accesul curent: ${current.map((r) => r.firstName).join(', ')}`}</p>}
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
                  <td>
                    {referralStateLabel(r.state, r.rewardCredits)}
                    {currentIds.has(r.id) && <span className="badge text-bg-success ms-2">acces curent</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
