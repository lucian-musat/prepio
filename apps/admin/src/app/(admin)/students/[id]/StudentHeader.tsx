'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Badge, Button, Card, Modal } from 'react-bootstrap';
import { formatAccessDate } from '@prepio/shared';
import { accessSourceLabel, type AccessSourceKind } from '@/lib/data/referrals';
import { MODE_LABELS, PROVIDER_LABELS, type LearningMode } from '@/lib/data/studentLabels';
import type { StudentRow } from '@/lib/data/students';
import AdjustCreditsForm from './AdjustCreditsForm';
import DeleteDialog from './DeleteDialog';
import { formatDay, formatRelative, hasActiveAccess, initials, planLabel } from './format';
import GrantAccessDialog from './GrantAccessDialog';
import ResetDialog from './ResetDialog';
import RevokeAccessDialog from './RevokeAccessDialog';
import SuspendDialog, { ReactivateDialog } from './SuspendDialog';

type Dialog = 'credits' | 'reset' | 'suspend' | 'reactivate' | 'delete' | 'grant' | 'revoke';

export default function StudentHeader({
  student, lessonsTotal, mode, suspendedBy, accessSource,
}: {
  student: StudentRow;
  lessonsTotal: number;
  mode: LearningMode | null;
  /** Email of the admin who suspended the student; null for the system. */
  suspendedBy: string | null;
  /** How the current access was obtained (see `accessSource`); the line is hidden when omitted. */
  accessSource?: { kind: AccessSourceKind; at: string | null };
}) {
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const close = () => setDialog(null);
  const suspended = student.suspendedAt != null;
  const now = new Date();
  const plan = planLabel(student.accessUntil, now, student.isAdmin);
  const fullAccess = hasActiveAccess(student.accessUntil, now);
  const meta = [
    student.email ?? '—',
    student.provider ? (PROVIDER_LABELS[student.provider] ?? student.provider) : null,
    `înregistrat ${formatDay(student.createdAt)}`,
    `ultima activitate ${student.lastActivityAt ? formatRelative(student.lastActivityAt) : '—'}`,
  ].filter(Boolean).join(' · ');

  return (
    <Card className="mb-4">
      <Card.Body>
        <div className="d-flex align-items-center gap-3">
          <div
            aria-hidden="true"
            className="rounded-circle bg-primary-subtle text-primary-emphasis fw-bold d-flex align-items-center justify-content-center flex-none"
            style={{ width: 48, height: 48, flex: 'none' }}
          >
            {initials(student.displayName, student.email)}
          </div>
          <div className="flex-grow-1" style={{ minWidth: 0 }}>
            <div className="d-flex flex-wrap align-items-center gap-2">
              <h1 className="h4 mb-0">{student.displayName || 'Fără nume'}</h1>
              <Badge bg={suspended ? 'danger' : 'success'} data-testid="status">{suspended ? 'Suspendat' : 'Activ'}</Badge>
              {student.isAdmin && <Badge bg="dark" data-testid="admin-badge">Admin</Badge>}
              {student.reregistrationBlocked && <span className="small text-muted">Reînregistrare blocată</span>}
            </div>
            <div className="text-muted small text-break">{meta}</div>
          </div>
        </div>

        {suspended && (
          <div className="alert alert-danger py-2 mt-3 mb-0" data-testid="suspension">
            {`Suspendat de ${suspendedBy ?? 'sistem'} pe ${formatDay(student.suspendedAt!)} · Motiv: „${student.suspendedReason ?? ''}”`}
          </div>
        )}

        {accessSource && (
          <div className="small mt-2" data-testid="access-source">
            {`Acces: ${accessSourceLabel(accessSource.kind)}`}
            {accessSource.kind !== 'trial' && student.accessUntil && ` · până la ${formatAccessDate(new Date(student.accessUntil))}`}
            {accessSource.kind === 'referral_reward' && <> · <Link href={`/students/${student.id}?tab=recomandari`}>vezi Recomandări</Link></>}
          </div>
        )}

        <div className="row g-2 mt-2">
          <div className="col-12 col-sm-3">
            <div className="bg-body-tertiary rounded p-2 h-100">
              <div className="small text-muted">Plan</div>
              <div className="fs-6 fw-bold" data-testid="plan">{plan}</div>
            </div>
          </div>
          <div className="col-12 col-sm-3">
            <div className="bg-body-tertiary rounded p-2 h-100">
              <div className="small text-muted">Lecții terminate</div>
              <div className="fs-5 fw-bold" data-testid="lessons-finished">{`${student.lessonsFinished} / ${lessonsTotal}`}</div>
            </div>
          </div>
          <div className="col-12 col-sm-3">
            <div className="bg-body-tertiary rounded p-2 h-100">
              <div className="small text-muted">Credite</div>
              <div className="fs-5 fw-bold">🪙 <span data-testid="balance">{student.creditBalance}</span></div>
            </div>
          </div>
          <div className="col-12 col-sm-3">
            <div className="bg-body-tertiary rounded p-2 h-100">
              <div className="small text-muted">Mod</div>
              <div className="fs-6 fw-bold" data-testid="mode">{mode ? MODE_LABELS[mode] : '—'}</div>
            </div>
          </div>
        </div>

        {student.isAdmin ? (
          <p className="text-muted small mt-3 mb-0">Cont de administrator: acțiunile asupra contului nu sunt disponibile.</p>
        ) : (
          <div className="d-flex flex-wrap gap-2 mt-3">
            <Button variant="primary" onClick={() => setDialog('credits')}>Ajustează credite</Button>
            <Button variant="outline-secondary" onClick={() => setDialog('reset')}>Resetează tot parcursul</Button>
            <Button variant="outline-primary" onClick={() => setDialog('grant')}>Acordă acces</Button>
            {fullAccess && <Button variant="outline-danger" onClick={() => setDialog('revoke')}>Retrage accesul</Button>}
            {suspended ? (
              <Button variant="outline-success" onClick={() => setDialog('reactivate')}>Reactivează</Button>
            ) : (
              <Button variant="outline-danger" onClick={() => setDialog('suspend')}>Suspendă</Button>
            )}
            <Button variant="outline-danger" onClick={() => setDialog('delete')}>Șterge contul</Button>
          </div>
        )}
      </Card.Body>

      <Modal show={dialog === 'credits'} onHide={close} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title as="h2" className="h5">Ajustează credite</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <AdjustCreditsForm userId={student.id} />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={close}>Închide</Button>
        </Modal.Footer>
      </Modal>
      {dialog === 'reset' && <ResetDialog userId={student.id} lesson={null} show onHide={close} />}
      {dialog === 'grant' && <GrantAccessDialog userId={student.id} show onHide={close} />}
      {dialog === 'revoke' && <RevokeAccessDialog userId={student.id} show onHide={close} />}
      {dialog === 'suspend' && <SuspendDialog userId={student.id} show onHide={close} />}
      {dialog === 'reactivate' && (
        <ReactivateDialog userId={student.id} blocked={student.reregistrationBlocked} show onHide={close} />
      )}
      {dialog === 'delete' && (
        <DeleteDialog
          userId={student.id}
          email={student.email ?? ''}
          suspended={suspended}
          suspendedReason={student.suspendedReason}
          show
          onHide={close}
        />
      )}
    </Card>
  );
}
