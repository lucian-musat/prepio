import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { BacItem, Source } from '@prepio/shared';
import BacItemView from './BacItemView';

const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const source: Source = { id: 's', position: 0, title: null, author: 'Autor', work: 'Lucrare', body: 'Domnul a fost ales, ca urmare unirea a fost recunoscută.' };
const item = {
  id: 'i1-5',
  position: 5,
  section: 1,
  number: 5,
  points: 7,
  type: 'cause_effect',
  prompt: 'Scrieți o relație cauză-efect.',
  pairs: [],
  sources: [{ sourceId: 's', label: 'A' }],
  modelAnswer: null,
  explanation: null,
  templateId: null,
  creditCost: 0,
} as unknown as BacItem;

it('a BAC cause-effect item shows the step banner without signal words', async () => {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <BacItemView
        item={item}
        sources={[{ source, label: 'A' }]}
        value={undefined}
        onChange={jest.fn()}
        hint={null}
        templateIds={new Set()}
        onOpenTemplate={jest.fn()}
      />
    </SafeAreaProvider>,
  );
  expect(screen.getByTestId('ce-banner')).toBeTruthy();
  expect(screen.getByText('De ce s-a întâmplat ceva?')).toBeTruthy();
  expect(screen.queryByText('fiindcă')).toBeNull();
  expect(screen.getByTestId('ce-gap-cause')).toBeTruthy();
});
