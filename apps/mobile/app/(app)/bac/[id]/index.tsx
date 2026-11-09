import BacAccessGuard from '../../../../src/access/BacAccessGuard';
import BacPaperScreen from '../../../../src/screens/bac/BacPaperScreen';

/** Without full access the route goes back to the list with its paywall sheet (BacAccessGuard). */
export default function BacPaperRoute() {
  return (
    <BacAccessGuard>
      <BacPaperScreen />
    </BacAccessGuard>
  );
}
