'use client';

import { useState } from 'react';
import { Button } from 'react-bootstrap';
import { useRunner } from '@/components/editor/common';
import type { StudentEvent } from '@/lib/data/students';
import { loadMoreEventsAction } from '../actions';
import { formatDayTime } from './format';

const KIND_ICONS: Record<string, string> = {
  registered: '👋', welcome_credits: '🎁', name_changed: '✏️', mode_changed: '🧭', app_opened: '📱',
  lesson_started: '📖', lesson_finished: '✅', test_failed: '❌', consolidation_started: '🧩',
  consolidation_finished: '🏁', check: '🎓', check_refunded: '↩️', check_blocked: '⛔', purchase: '🪙',
  credits_adjusted: '⚙️', suspended: '🛑', reactivated: '🔓', progress_reset: '🔄',
  access_purchased: '⭐', access_granted: '🎟️', access_revoked: '⛔', access_expired: '⌛',
};

/** Newest first, ordered by id; merges the server's first page with the older pages loaded here. */
function merge(...lists: StudentEvent[][]): StudentEvent[] {
  const byId = new Map<number, StudentEvent>();
  for (const list of lists) for (const e of list) byId.set(e.id, e);
  return [...byId.values()].sort((a, b) => b.id - a.id);
}

export default function TimelineTab({ userId, initial, pageSize }: { userId: string; initial: StudentEvent[]; pageSize: number }) {
  // Older pages stay when the page data refreshes (actions revalidate the route), so nothing already shown is lost.
  const [older, setOlder] = useState<StudentEvent[]>([]);
  const [hasMore, setHasMore] = useState(initial.length === pageSize);
  const { run, pending, alert } = useRunner();
  const events = merge(initial, older);

  function loadMore() {
    const shown = events;
    const before = shown[shown.length - 1].id;
    let page: StudentEvent[] = [];
    run(
      async () => {
        const res = await loadMoreEventsAction(userId, before);
        if (res.ok) page = res.data ?? [];
        return res;
      },
      () => {
        setOlder(merge(shown, page));
        setHasMore(page.length === pageSize);
      },
    );
  }

  if (events.length === 0) return <p className="text-muted mb-0">Încă nu există activitate.</p>;
  return (
    <>
      {alert}
      <ul className="list-unstyled mb-0">
        {events.map((e) => (
          <li key={e.id} className="d-flex gap-3 py-2 border-bottom">
            <span className="text-muted text-nowrap" style={{ minWidth: 96 }}>{formatDayTime(e.createdAt)}</span>
            <span>
              <span aria-hidden="true" className="me-2" data-testid="event-icon">{e.icon ?? KIND_ICONS[e.kind] ?? '•'}</span>
              {e.label}
              {e.details && <span className="d-block small text-muted">{e.details}</span>}
            </span>
          </li>
        ))}
      </ul>
      {hasMore && (
        <Button variant="outline-secondary" size="sm" className="mt-3" disabled={pending} onClick={loadMore}>
          Mai vechi
        </Button>
      )}
    </>
  );
}
