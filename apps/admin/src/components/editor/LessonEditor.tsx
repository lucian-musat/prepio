'use client';

import { Tab, Tabs } from 'react-bootstrap';
import type { LessonForEdit } from '@/lib/data/lesson';
import CardsEditor from './CardsEditor';
import ExercisesEditor from './ExercisesEditor';
import LessonHeader from './LessonHeader';
import QuestionsEditor from './QuestionsEditor';

export default function LessonEditor({ data }: { data: LessonForEdit }) {
  const { lesson, cards, questions, exercises } = data;
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
        <Tab eventKey="exercises" title={`Exerciții de redactare (${exercises.length})`}>
          <ExercisesEditor lessonId={lesson.id} exercises={exercises} />
        </Tab>
      </Tabs>
    </>
  );
}
