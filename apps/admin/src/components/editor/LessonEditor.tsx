'use client';

import { Tab, Tabs } from 'react-bootstrap';
import type { LessonForEdit } from '@/lib/data/lesson';
import CardsEditor from './CardsEditor';
import ConsolidationEditor from './consolidation/ConsolidationEditor';
import LessonHeader from './LessonHeader';
import QuestionsEditor from './QuestionsEditor';

export default function LessonEditor({ data }: { data: LessonForEdit }) {
  const { lesson, cards, questions, consolidation } = data;
  return (
    <>
      <LessonHeader id={lesson.id} title={lesson.title} status={lesson.status} />
      <Tabs defaultActiveKey="cards" className="mb-3" mountOnEnter={false}>
        <Tab eventKey="cards" title={`Carduri (${cards.length})`}>
          <CardsEditor lessonId={lesson.id} cards={cards} />
        </Tab>
        <Tab eventKey="questions" title={`Verificare (${questions.length})`}>
          <QuestionsEditor lessonId={lesson.id} questions={questions} />
        </Tab>
        <Tab eventKey="consolidation" title={`Consolidare (${consolidation.exercises.length})`}>
          <ConsolidationEditor lessonId={lesson.id} data={consolidation} />
        </Tab>
      </Tabs>
    </>
  );
}
