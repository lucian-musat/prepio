import { DIFFICULTY_LABELS, difficultyTone, type Difficulty } from '@prepio/shared';
import Chip from '../ui/Chip';

export default function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const { fg, bg } = difficultyTone[difficulty];
  return <Chip label={DIFFICULTY_LABELS[difficulty]} fg={fg} bg={bg} size="badge" />;
}
