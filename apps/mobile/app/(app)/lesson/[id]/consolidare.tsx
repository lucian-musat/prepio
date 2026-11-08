import LessonAccessGuard from '../../../../src/access/LessonAccessGuard';
import ConsolidationScreen from '../../../../src/screens/ConsolidationScreen';

/** A lesson outside the plan goes to Home with its paywall sheet (LessonAccessGuard). */
export default function ConsolidationRoute() {
  return (
    <LessonAccessGuard>
      <ConsolidationScreen />
    </LessonAccessGuard>
  );
}
