import { render, screen } from '@testing-library/react-native';
import type { BacItem } from '@prepio/shared';
import { applyOverrides, resetTexts } from '../../texts/store';
import BacGradingView from './BacGradingView';
import BacHint from './BacHint';
import BacSubmitView from './BacSubmitView';

afterEach(() => resetTexts());

const item = {
  id: 'i1',
  position: 1,
  type: 'short_answer',
  prompt: 'Cerința I.1',
  accepted: [],
  mistakes: [],
  modelAnswer: null,
  explanation: null,
  sources: [],
  templateId: null,
  creditCost: 0,
  section: 1,
  number: 1,
  points: 2,
} as unknown as BacItem;

it('BacGradingView shows the overridden title', async () => {
  applyOverrides({ 'bac.grading.title': '[override]' });
  await render(<BacGradingView />);
  expect(screen.getByText('[override]')).toBeTruthy();
});

it('BacHint reads the overridden accessibility hint', async () => {
  applyOverrides({ 'bac.hint.show': '[override]' });
  await render(<BacHint body="Pasul unu" />);
  expect(screen.getByRole('button').props.accessibilityHint).toBe('[override]');
});

it('BacSubmitView shows the overridden texts', async () => {
  applyOverrides({ 'bac.submit.answered': '[{n} / {cerinte}]', 'bac.submit.emptyHeading': '[override]' });
  await render(<BacSubmitView items={[item]} answers={{}} cost={15} error={null} sending={false} onSend={() => {}} onBack={() => {}} />);
  expect(screen.getByText('[0 / 1 cerință]')).toBeTruthy();
  expect(screen.getByText('[override]')).toBeTruthy();
});
