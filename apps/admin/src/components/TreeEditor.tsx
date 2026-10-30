'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { Alert, Badge, Button, ButtonGroup, Form, ListGroup, Modal } from 'react-bootstrap';
import type { LessonStatus } from '@prepio/shared';
import {
  createLesson, createNode, deleteLesson, deleteNode, moveLesson, moveNode, renameNode, setLessonStatus,
} from '@/app/(admin)/actions/tree';
import type { TreeLesson, TreeNode } from '@/lib/data/tree';

type Dialog =
  | { kind: 'title'; heading: string; initial: string; submit: string; onSubmit: (title: string) => Promise<unknown> }
  | { kind: 'confirm'; heading: string; body: string; onConfirm: () => Promise<unknown> }
  | null;

type Ask = (d: NonNullable<Dialog>) => void;
type Run = (fn: () => Promise<unknown>) => void;

function countDescendants(node: TreeNode): { nodes: number; lessons: number } {
  let nodes = 0;
  let lessons = node.lessons.length;
  for (const c of node.children) {
    const sub = countDescendants(c);
    nodes += 1 + sub.nodes;
    lessons += sub.lessons;
  }
  return { nodes, lessons };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function LessonRow({ lesson, first, last, run, ask }: { lesson: TreeLesson; first: boolean; last: boolean; run: Run; ask: Ask }) {
  const published = lesson.status === 'published';
  const next: LessonStatus = published ? 'draft' : 'published';
  return (
    <ListGroup.Item className="d-flex flex-wrap align-items-center gap-2 py-2" data-testid="lesson-row">
      <span className="flex-grow-1">
        <Link href={`/lessons/${lesson.id}`} className="text-decoration-none fw-semibold">{lesson.title}</Link>{' '}
        <Badge bg={published ? 'success' : 'secondary'} data-testid="lesson-status">{published ? 'Publicată' : 'Ciornă'}</Badge>
      </span>
      <ButtonGroup size="sm">
        <Button variant="outline-secondary" onClick={() => run(() => setLessonStatus(lesson.id, next))}>
          {published ? 'Retrage' : 'Publică'}
        </Button>
        <Button variant="outline-secondary" aria-label={`Mută sus lecția ${lesson.title}`} disabled={first} onClick={() => run(() => moveLesson(lesson.id, 'up'))}>↑</Button>
        <Button variant="outline-secondary" aria-label={`Mută jos lecția ${lesson.title}`} disabled={last} onClick={() => run(() => moveLesson(lesson.id, 'down'))}>↓</Button>
        <Link href={`/lessons/${lesson.id}`} className="btn btn-outline-primary">Editează</Link>
        <Button
          variant="outline-danger"
          onClick={() =>
            ask({
              kind: 'confirm',
              heading: 'Ștergi lecția?',
              body: `Lecția „${lesson.title}” și tot conținutul ei vor fi șterse definitiv.`,
              onConfirm: () => deleteLesson(lesson.id),
            })
          }
        >
          Șterge lecția
        </Button>
      </ButtonGroup>
    </ListGroup.Item>
  );
}

function NodeItem({ node, first, last, run, ask }: { node: TreeNode; first: boolean; last: boolean; run: Run; ask: Ask }) {
  const counts = countDescendants(node);
  return (
    <ListGroup.Item data-testid="node-row" className="p-0 border-0 bg-transparent">
      <div className="card mb-2">
        <div className="card-body py-2">
          <div className="d-flex flex-wrap align-items-center gap-2">
            <h2 className="h6 mb-0 flex-grow-1">{node.title}</h2>
            <ButtonGroup size="sm">
              <Button
                variant="outline-primary"
                onClick={() =>
                  ask({ kind: 'title', heading: 'Adaugă subnod', initial: '', submit: 'Adaugă', onSubmit: (t) => createNode(node.id, t) })
                }
              >
                Adaugă subnod
              </Button>
              <Button
                variant="outline-primary"
                onClick={() =>
                  ask({ kind: 'title', heading: 'Adaugă lecție', initial: '', submit: 'Adaugă', onSubmit: (t) => createLesson(node.id, t) })
                }
              >
                Adaugă lecție
              </Button>
              <Button
                variant="outline-secondary"
                onClick={() =>
                  ask({ kind: 'title', heading: 'Redenumește', initial: node.title, submit: 'Salvează', onSubmit: (t) => renameNode(node.id, t) })
                }
              >
                Redenumește
              </Button>
              <Button variant="outline-secondary" aria-label={`Mută sus ${node.title}`} disabled={first} onClick={() => run(() => moveNode(node.id, 'up'))}>↑</Button>
              <Button variant="outline-secondary" aria-label={`Mută jos ${node.title}`} disabled={last} onClick={() => run(() => moveNode(node.id, 'down'))}>↓</Button>
              <Button
                variant="outline-danger"
                onClick={() =>
                  ask({
                    kind: 'confirm',
                    heading: 'Ștergi nodul?',
                    body: `Vor fi șterse „${node.title}”, ${plural(counts.nodes, 'subnod', 'subnoduri')} și ${plural(counts.lessons, 'lecție', 'lecții')}.`,
                    onConfirm: () => deleteNode(node.id),
                  })
                }
              >
                Șterge
              </Button>
            </ButtonGroup>
          </div>
          {node.lessons.length > 0 && (
            <ListGroup className="mt-2">
              {node.lessons.map((l, i) => (
                <LessonRow key={l.id} lesson={l} first={i === 0} last={i === node.lessons.length - 1} run={run} ask={ask} />
              ))}
            </ListGroup>
          )}
        </div>
      </div>
      {node.children.length > 0 && (
        <ListGroup variant="flush" className="ms-3 ms-md-4 ps-2 border-start">
          {node.children.map((c, i) => (
            <NodeItem key={c.id} node={c} first={i === 0} last={i === node.children.length - 1} run={run} ask={ask} />
          ))}
        </ListGroup>
      )}
    </ListGroup.Item>
  );
}

export default function TreeEditor({ tree }: { tree: TreeNode[] }) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run: Run = (fn) => {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'A apărut o eroare');
      }
    });
  };
  const ask: Ask = (d) => {
    setTitle(d.kind === 'title' ? d.initial : '');
    setDialog(d);
  };
  const close = () => setDialog(null);
  const submit = () => {
    if (!dialog) return;
    if (dialog.kind === 'title') {
      if (!title.trim()) return;
      const fn = dialog.onSubmit;
      const t = title;
      run(() => fn(t));
    } else {
      run(dialog.onConfirm);
    }
    close();
  };

  return (
    <>
      {error && <Alert variant="danger" dismissible onClose={() => setError(null)}>{error}</Alert>}
      <div className="mb-3">
        <Button
          variant="primary"
          disabled={pending}
          onClick={() => ask({ kind: 'title', heading: 'Adaugă temă', initial: '', submit: 'Adaugă', onSubmit: (t) => createNode(null, t) })}
        >
          Adaugă temă
        </Button>
      </div>
      {tree.length === 0 ? (
        <p className="text-secondary">Nu există conținut încă.</p>
      ) : (
        <ListGroup variant="flush">
          {tree.map((n, i) => (
            <NodeItem key={n.id} node={n} first={i === 0} last={i === tree.length - 1} run={run} ask={ask} />
          ))}
        </ListGroup>
      )}

      <Modal show={dialog !== null} onHide={close} centered>
        <Form onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <Modal.Header closeButton>
            <Modal.Title as="h2" className="h5">{dialog?.heading}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {dialog?.kind === 'title' ? (
              <Form.Group controlId="tree-title">
                <Form.Label>Titlu</Form.Label>
                <Form.Control autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
              </Form.Group>
            ) : (
              <p className="mb-0" data-testid="confirm-text">{dialog?.body}</p>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={close}>Anulează</Button>
            {dialog?.kind === 'title' ? (
              <Button type="submit" variant="primary" disabled={!title.trim()}>{dialog.submit}</Button>
            ) : (
              <Button type="submit" variant="danger">Șterge</Button>
            )}
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
}