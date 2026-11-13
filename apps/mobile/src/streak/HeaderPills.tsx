import CreditChip from '../credits/CreditChip';
import StreakPill from './StreakPill';

/** The top-bar pills: the streak, then the access and credits chip. `onSolve`: what the streak sheet's „Rezolvă un exercițiu” does. */
export default function HeaderPills({ need, onSolve }: { need?: number; onSolve?: () => void }) {
  return (
    <>
      <StreakPill onSolve={onSolve} />
      <CreditChip need={need} />
    </>
  );
}
