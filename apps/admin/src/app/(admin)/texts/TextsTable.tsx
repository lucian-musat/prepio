'use client';

import { useState, useTransition } from 'react';
import { Alert, Badge, Button, ButtonGroup, Col, Form, Row, Table } from 'react-bootstrap';
import { TEXT_GROUP_LABELS, type TextGroup } from '@prepio/shared';
import type { ActionResult } from '@/lib/actionResult';
import type { UiTextRow } from '@/lib/data/uiTexts';
import { resetUiTextAction, saveUiTextAction } from './actions';
import TextEditModal from './TextEditModal';

const dateFmt = new Intl.DateTimeFormat('ro-RO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Bucharest' });

/** Lower-case, no diacritics (ș/ş, ț/ţ included). */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[șş]/g, 's')
    .replace(/[țţ]/g, 't')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function Current({ row }: { row: UiTextRow }) {
  if (row.value === null) return <span className="text-muted">—</span>;
  return (
    <>
      <Badge bg="warning" text="dark" className="me-2">modificat</Badge>
      {row.value === '' ? <em className="text-muted">(gol — ascuns)</em> : row.value}
    </>
  );
}

function Edited({ row }: { row: UiTextRow }) {
  if (!row.updatedAt) return null;
  return (
    <span className="small text-muted">
      {row.updatedBy}
      <br />
      {dateFmt.format(new Date(row.updatedAt))}
    </span>
  );
}

export default function TextsTable({ initial }: { initial: UiTextRow[] }) {
  const [rows, setRows] = useState(initial);
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('');
  const [onlyModified, setOnlyModified] = useState(false);
  const [editing, setEditing] = useState<UiTextRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<ActionResult<UiTextRow[]>>, onOk?: () => void) => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fn();
        if (res.ok) {
          if (res.data) setRows(res.data);
          onOk?.();
        } else setError(res.error);
      } catch {
        setError('Operația a eșuat. Încearcă din nou.');
      }
    });
  };

  const needle = normalize(q.trim());
  const catalog = rows.filter((r) => !r.orphan);
  const orphans = rows.filter((r) => r.orphan);
  const visible = catalog.filter((r) => {
    if (group && r.group !== group) return false;
    if (onlyModified && r.value === null) return false;
    if (!needle) return true;
    return normalize(`${r.key} ${r.defaultText ?? ''} ${r.value ?? ''}`).includes(needle);
  });
  const groups = [...new Set(catalog.map((r) => r.group).filter((g): g is TextGroup => !!g))];

  return (
    <>
      {!editing && error && <Alert variant="danger" dismissible onClose={() => setError(null)}>{error}</Alert>}
      <Row className="g-2 align-items-end mb-3">
        <Col md={5}>
          <Form.Group controlId="texts-search">
            <Form.Label>Caută</Form.Label>
            <Form.Control value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cheie sau text" />
          </Form.Group>
        </Col>
        <Col md={4}>
          <Form.Group controlId="texts-group">
            <Form.Label>Grup</Form.Label>
            <Form.Select value={group} onChange={(e) => setGroup(e.target.value)}>
              <option value="">Toate grupurile</option>
              {groups.map((g) => <option key={g} value={g}>{TEXT_GROUP_LABELS[g]}</option>)}
            </Form.Select>
          </Form.Group>
        </Col>
        <Col md={3}>
          <Form.Check
            type="switch"
            id="texts-modified"
            label="Doar modificate"
            checked={onlyModified}
            onChange={(e) => setOnlyModified(e.target.checked)}
          />
        </Col>
      </Row>

      <Table responsive hover size="sm" className="align-middle">
        <thead>
          <tr>
            <th>Grup</th><th>Cheie</th><th>Text implicit</th><th>Text actual</th><th>Modificat</th><th />
          </tr>
        </thead>
        <tbody>
          {visible.map((r) => (
            <tr key={r.key}>
              <td>{r.group ? TEXT_GROUP_LABELS[r.group] : ''}</td>
              <td><code className="small">{r.key}</code></td>
              <td>{r.defaultText}</td>
              <td><Current row={r} /></td>
              <td><Edited row={r} /></td>
              <td className="text-nowrap">
                <ButtonGroup size="sm">
                  <Button variant="outline-primary" disabled={pending} onClick={() => { setError(null); setEditing(r); }}>Editează</Button>
                  {r.value !== null && (
                    <Button variant="outline-secondary" disabled={pending} onClick={() => run(() => resetUiTextAction(r.key))}>Revino la implicit</Button>
                  )}
                </ButtonGroup>
              </td>
            </tr>
          ))}
          {visible.length === 0 && (
            <tr><td colSpan={6} className="text-muted">Niciun text găsit.</td></tr>
          )}
        </tbody>
      </Table>

      {orphans.length > 0 && (
        <>
          <h2 className="h5 mt-4">Texte care nu mai există în aplicație</h2>
          <Table responsive size="sm" className="align-middle">
            <tbody>
              {orphans.map((r) => (
                <tr key={r.key}>
                  <td><code className="small">{r.key}</code></td>
                  <td>{r.value}</td>
                  <td><Edited row={r} /></td>
                  <td className="text-end">
                    <Button size="sm" variant="outline-danger" disabled={pending} onClick={() => run(() => resetUiTextAction(r.key))}>Șterge</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}

      {editing && (
        <TextEditModal
          row={editing}
          pending={pending}
          error={error}
          onClose={() => { setEditing(null); setError(null); }}
          onSave={(value) => run(() => saveUiTextAction(editing.key, value), () => setEditing(null))}
        />
      )}
    </>
  );
}
