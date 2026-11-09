'use client';

import Link from 'next/link';
import { Badge, Tab, Tabs } from 'react-bootstrap';
import { BAC_TOTAL_POINTS, type BacSection } from '@prepio/shared';
import type { BacSubjectForEdit } from '@/lib/data/bac';
import BacDetailsForm from './BacDetailsForm';
import BacSectionTab from './BacSectionTab';

const SECTIONS: Array<[BacSection, string]> = [[1, 'Subiectul I'], [2, 'Subiectul II'], [3, 'Subiectul III']];

export default function BacSubjectEditor({ data }: { data: BacSubjectForEdit }) {
  const { subject, sources, items, barems, errors, templates } = data;
  const total = items.reduce((t, i) => t + i.points, 0);
  return (
    <>
      <div className="mb-3">
        <Link href="/bac" className="small">← Subiecte BAC</Link>
        <div className="d-flex flex-wrap align-items-center gap-2 mt-1">
          <h1 className="h3 mb-0 me-2 text-break">{subject.title}</h1>
          <Badge bg={subject.published ? 'success' : 'secondary'} data-testid="bac-status">{subject.published ? 'Publicat' : 'Ciornă'}</Badge>
          <span className={total === BAC_TOTAL_POINTS ? 'fw-semibold text-success' : 'fw-semibold'} data-testid="bac-total">
            Total: {total} / {BAC_TOTAL_POINTS}
          </span>
        </div>
        <div className="text-secondary small">{[subject.year, subject.variant].filter(Boolean).join(' · ')}</div>
      </div>
      <Tabs defaultActiveKey="details" className="mb-3" mountOnEnter={false}>
        <Tab eventKey="details" title="Detalii">
          <BacDetailsForm subject={subject} />
        </Tab>
        {SECTIONS.map(([section, title]) => {
          const own = items.filter((i) => i.section === section);
          return (
            <Tab key={section} eventKey={`s${section}`} title={title}>
              <BacSectionTab
                subjectId={subject.id}
                section={section}
                sources={sources.filter((s) => s.section === section)}
                items={own}
                barems={barems}
                errors={errors}
                templates={templates}
              />
            </Tab>
          );
        })}
      </Tabs>
    </>
  );
}
