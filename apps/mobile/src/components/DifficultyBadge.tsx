import { difficultyTone, type Difficulty, type TextKey } from '@prepio/shared';
import Chip from '../ui/Chip';
import { t } from '../texts/store';

const LABELS: Record<Difficulty, TextKey> = {
  easy: 'lesson.test.difficulty.easy',
  medium: 'lesson.test.difficulty.medium',
  hard: 'lesson.test.difficulty.hard',
};

export default function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const { fg, bg } = difficultyTone[difficulty];
  return <Chip label={t(LABELS[difficulty])} fg={fg} bg={bg} size="badge" />;
}
