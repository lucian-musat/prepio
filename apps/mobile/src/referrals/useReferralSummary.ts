import { useEffect, useState } from 'react';
import { fetchReferralSummary, type ReferralSummary } from '../lib/referrals';

/**
 * The student's referral summary, read once, for the entry points (Home line, Profile row). Null while loading, when
 * the read fails, or when the feature is off / the student has no code: the entry point then renders nothing.
 */
export function useReferralSummary(): ReferralSummary | null {
  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  useEffect(() => {
    let live = true;
    fetchReferralSummary().then(
      (s) => live && setSummary(s.enabled && s.code ? s : null),
      () => {}, // no entry point without a summary
    );
    return () => {
      live = false;
    };
  }, []);
  return summary;
}

/** The progress toward the free period („2/5”), only for a student without access who has subscribed invitees. */
export function progressBadge(s: ReferralSummary): string | null {
  return !s.hasAccess && s.pendingCount > 0 ? `${s.pendingCount}/${s.threshold}` : null;
}
