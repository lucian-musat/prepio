'use client';

import { useRef, useState, type ReactNode } from 'react';
import { Button, ButtonGroup } from 'react-bootstrap';

function moveTo<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * Reorderable list of form rows: drag handle (HTML5 drag-and-drop) plus up/down
 * buttons as the keyboard fallback, and a remove button per row.
 */
export default function SortableList<T extends { id: string }>({
  items, onChange, render, addLabel, onAdd, addDisabled, itemName,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  render: (item: T, index: number) => ReactNode;
  addLabel: string;
  onAdd: () => void;
  addDisabled?: boolean;
  /** Used in button labels, e.g. `imaginea` → "Mută sus imaginea 2". */
  itemName: string;
}) {
  const dragFrom = useRef<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  const endDrag = () => {
    dragFrom.current = null;
    setOver(null);
  };

  return (
    <div>
      {items.map((item, i) => {
        const n = i + 1;
        return (
          <div
            key={item.id}
            data-sortable-row
            className={`d-flex gap-2 align-items-start border rounded p-2 mb-2 ${over === i ? 'border-primary bg-body-tertiary' : ''}`}
            onDragOver={(e) => {
              if (dragFrom.current === null) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              setOver(i);
            }}
            onDrop={(e) => {
              e.preventDefault();
              const from = dragFrom.current;
              endDrag();
              if (from !== null && from !== i) onChange(moveTo(items, from, i));
            }}
          >
            <span
              draggable
              aria-hidden
              title="Trage pentru a muta"
              className="text-secondary px-1 user-select-none"
              style={{ cursor: 'grab', lineHeight: 1.8 }}
              onDragStart={(e) => {
                dragFrom.current = i;
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(i));
                const row = e.currentTarget.closest('[data-sortable-row]');
                if (row) e.dataTransfer.setDragImage(row, 16, 16);
              }}
              onDragEnd={endDrag}
            >
              ⠿
            </span>
            <div className="flex-grow-1" style={{ minWidth: 0 }}>{render(item, i)}</div>
            <ButtonGroup size="sm">
              <Button
                variant="outline-secondary"
                aria-label={`Mută sus ${itemName} ${n}`}
                disabled={i === 0}
                onClick={() => onChange(moveTo(items, i, i - 1))}
              >
                ↑
              </Button>
              <Button
                variant="outline-secondary"
                aria-label={`Mută jos ${itemName} ${n}`}
                disabled={i === items.length - 1}
                onClick={() => onChange(moveTo(items, i, i + 1))}
              >
                ↓
              </Button>
              <Button
                variant="outline-danger"
                aria-label={`Șterge ${itemName} ${n}`}
                onClick={() => onChange(items.filter((_, j) => j !== i))}
              >
                Șterge
              </Button>
            </ButtonGroup>
          </div>
        );
      })}
      <Button variant="outline-primary" size="sm" disabled={addDisabled} onClick={onAdd}>{addLabel}</Button>
    </div>
  );
}
