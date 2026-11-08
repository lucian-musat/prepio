import LessonAccessGuard from '../../../../src/access/LessonAccessGuard';
import LessonScreen from '../../../../src/screens/LessonScreen';

/** A lesson outside the plan goes to Home with its paywall sheet (LessonAccessGuard). */
export default function LessonRoute() {
  return (
    <LessonAccessGuard>
      <LessonScreen />
    </LessonAccessGuard>
  );
}
