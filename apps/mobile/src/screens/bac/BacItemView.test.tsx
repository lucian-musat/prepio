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

it('the points after the prompt never wrap alone (non-breaking spaces)', async () => {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <BacItemView item={item} sources={[{ source, label: 'A' }]} value={undefined} onChange={jest.fn()} hint={null} templateIds={new Set()} onOpenTemplate={jest.fn()} />
    </SafeAreaProvider>,
  );
  const exact = { normalizer: (t: string) => t };
  expect(screen.getByText('·\u00A07\u00A0puncte', exact)).toBeTruthy();
  expect(screen.queryByText('· 7 puncte', exact)).toBeNull();
});

it('opens on the source the requirement names (desktop split)', async () => {
  const wide = { frame: { x: 0, y: 0, width: 1280, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
  const { Dimensions } = require('react-native');
  jest.spyOn(Dimensions, 'get').mockReturnValue({ width: 1280, height: 800, scale: 1, fontScale: 1 });
  const words = (w: string) => Array.from({ length: 90 }, () => w).join(' ');
  const a: Source = { ...source, id: 'sa', body: words('alfa') };
  const b: Source = { ...source, id: 'sb', body: words('beta') };
  const named = { ...item, type: 'short_answer', prompt: 'Numiți noua constituție precizată în sursa B.', accepted: ['x'], mistakes: [] } as unknown as BacItem;
  await render(
    <SafeAreaProvider initialMetrics={wide}>
      <BacItemView item={named} sources={[{ source: a, label: 'A' }, { source: b, label: 'B' }]} value={undefined} onChange={jest.fn()} hint={null} templateIds={new Set()} onOpenTemplate={jest.fn()} />
    </SafeAreaProvider>,
  );
  expect(screen.getByRole('tab', { name: 'Sursa B' }).props.accessibilityState).toMatchObject({ selected: true });
});
