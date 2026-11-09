import BacAccessGuard from '../../../../src/access/BacAccessGuard';
import BacResultScreen from '../../../../src/screens/bac/BacResultScreen';

export default function BacResultRoute() {
  return (
    <BacAccessGuard>
      <BacResultScreen />
    </BacAccessGuard>
  );
}
