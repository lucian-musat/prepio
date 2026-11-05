'use client';

import { Tab, Tabs } from 'react-bootstrap';
import type { LessonForEdit } from '@/lib/data/lesson';
import CardsEditor from './CardsEditor';
import LessonHeader from './LessonHeader';
import QuestionsEditor from './QuestionsEditor';

export default function LessonEditor({ data }: { data: LessonForEdit }) {
  const { lesson, cards, questions } = data;
  return (
    <>
      <LessonHeader id={lesson.id} title={lesson.title} status={lesson.status} />
      <Tabs defaultActiveKey="cards" className="mb-3" mountOnEnter={false}>
        <Tab eventKey="cards" title={`Carduri (${cards.length})`}>
          <CardsEditor lessonId={lesson.id} cards={cards} />
        </Tab>
        <Tab eventKey="questions" title={`Întrebări (${questions.length})`}>
          <QuestionsEditor lessonId={lesson.id} questions={questions} />
        </Tab>
      </Tabs>
    </>
  );
}
