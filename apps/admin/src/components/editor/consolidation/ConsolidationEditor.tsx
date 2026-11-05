'use client';

import type { EditorConsolidation } from '@/lib/data/consolidation';
import ExerciseList from './ExerciseList';
import SourcesEditor from './SourcesEditor';

/** The lesson's Consolidare tab: its sources, then its exercises. */
export default function ConsolidationEditor({ lessonId, data }: { lessonId: string; data: EditorConsolidation }) {
  return (
    <>
      <section className="mb-4" aria-labelledby="consolidation-sources">
        <h2 id="consolidation-sources" className="h5">Surse</h2>
        <SourcesEditor lessonId={lessonId} sources={data.sources} exercises={data.exercises} />
      </section>
      <section aria-labelledby="consolidation-exercises">
        <h2 id="consolidation-exercises" className="h5">Exerciții</h2>
        <ExerciseList lessonId={lessonId} data={data} />
      </section>
    </>
  );
}
