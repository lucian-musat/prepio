import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { fetchCreditPackages, purchaseCredits } from '../lib/credits';
import { Button } from '../ui';
import { useCreditGate } from './useCreditGate';

jest.mock('./CreditsProvider');
const { mockResetCredits } = jest.requireMock<typeof import('./__mocks__/CreditsProvider')>('./CreditsProvider');
jest.mock('../lib/credits', () => ({ ...jest.requireActual('../lib/credits'), fetchCreditPackages: jest.fn(), purchaseCredits: jest.fn() }));

const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

/** The press handler of a button, to tap it twice before React re-renders (fireEvent wraps each tap in act). */
type Fiber = { memoizedProps?: { onPress?: unknown }; return: Fiber | null };
const pressHandler = (el: object) => {
  let f = (el as { unstable_fiber: Fiber | null }).unstable_fiber;
  while (f && typeof f.memoizedProps?.onPress !== 'function') f = f.return;
  return f!.memoizedProps!.onPress as () => void;
};

function Harness({ run, onSkip, skipDisabled }: { run: () => void; onSkip?: () => void; skipDisabled?: boolean }) {
  const gate = useCreditGate({ onSkip, skipDisabled });
  return (
    <SafeAreaProvider initialMetrics={metrics}>
      {gate.sheet}
      <Button label="Verifică" onPress={() => (gate.allow(2, run) ? run() : undefined)} />
    </SafeAreaProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockResetCredits(1);
  (fetchCreditPackages as jest.Mock).mockResolvedValue([{ id: 'p50', credits: 50, priceBani: 1999, featured: true }]);
  (purchaseCredits as jest.Mock).mockResolvedValue({ orderId: 'o1', credits: 50, balance: 51 });
});

it('a double tap on „Verifică acum” runs the blocked check once', async () => {
  const run = jest.fn();
  await render(<Harness run={run} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Verifică' }));
  expect(run).not.toHaveBeenCalled();
  await act(async () => void fireEvent.press(await screen.findByRole('button', { name: 'Cumpără 50 de credite · 19,99 lei' })));
  const now = screen.getByRole('button', { name: 'Verifică acum, costă 2 credite' });
  // Both taps land before the sheet re-renders (closed).
  await act(async () => {
    const press = pressHandler(now);
    press();
    press();
  });
  expect(run).toHaveBeenCalledTimes(1);
});

it('skipDisabled: the sheet does not skip while a check is in flight', async () => {
  const onSkip = jest.fn();
  await render(<Harness run={jest.fn()} onSkip={onSkip} skipDisabled />);
  await fireEvent.press(screen.getByRole('button', { name: 'Verifică' }));
  expect(screen.getByRole('button', { name: 'Sari peste exercițiu' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Sari peste exercițiu' }));
  expect(onSkip).not.toHaveBeenCalled();
});
