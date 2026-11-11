'use client';

import { useState } from 'react';
import { Badge, Button, Table } from 'react-bootstrap';
import type { LessonProgressRow } from '@/lib/data/students';
import { formatRelative } from './format';
import ResetDialog from './ResetDialog';

const STATUS: Record<LessonProgressRow['status'], { label: string; bg: string; text?: 'dark' }> = {
  not_started: { label: 'Neîncepută', bg: 'secondary' },
  in_progress: { label: 'În curs', bg: 'warning', text: 'dark' },
  finished: { label: 'Terminată', bg: 'success' },
};

/** `readOnly` (an admin's account) hides the reset buttons. */
export default function ProgressTab({ userId, rows, readOnly = false }: { userId: string; rows: LessonProgressRow[]; readOnly?: boolean }) {
  const [resetting, setResetting] = useState<{ id: string; title: string } | null>(null);
  if (rows.length === 0) return <p className="text-muted">Nu există lecții publicate.</p>;
  return (
    <>
      {/* position-relative keeps the visually-hidden header (absolute) inside the scroll box at phone width. */}
      <div className="table-responsive position-relative">
        <Table size="sm" className="align-middle mb-0">
          <thead>
            <tr><th>Lecție</th><th>Stare</th><th>Unde a rămas</th><th>Ultima activitate</th><th><span className="visually-hidden">Acțiuni</span></th></tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const s = STATUS[r.status];
              return (
                <tr key={r.lessonId}>
                  <td>{r.title}</td>
                  <td><Badge bg={s.bg} text={s.text}>{s.label}</Badge></td>
                  <td>{r.where}</td>
                  <td className="text-nowrap">{r.lastActivityAt ? formatRelative(r.lastActivityAt) : '—'}</td>
                  <td className="text-end">
                    {!readOnly && r.status !== 'not_started' && (
                      <Button size="sm" variant="outline-secondary" onClick={() => setResetting({ id: r.lessonId, title: r.title })}>
                        Resetează
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>
      {resetting && <ResetDialog userId={userId} lesson={resetting} show onHide={() => setResetting(null)} />}
    </>
  );
}
