import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import * as Reanimated from 'react-native-reanimated';
import type { CardContent } from '@prepio/shared';
import SchemaCard from './SchemaCard';

// Reanimated's jest helper; the public typings only describe the no-op production stub.
const { getAnimatedStyle } = Reanimated as unknown as { getAnimatedStyle: (node: unknown) => { transform: { rotate: string }[] } };

type Schema = Extract<CardContent, { type: 'schema' }>;
const box = (id: string, text: string, detail: string | null = null) => ({ id, text, detail });
const schema = (over: Partial<Schema> = {}): Schema => ({
  type: 'schema',
  causesLabel: 'Cauze',
  consequencesLabel: 'Urmări',
  causes: [box('cause-0', 'Destrămarea imperiilor'), box('cause-1', 'Autodeterminarea', 'Principiul lui Wilson')],
  central: box('central', 'Marea Unire'),
  consequences: [box('consequence-0', 'România Mare')],
  ...over,
});

it('renders zone labels, the central box and every box', async () => {
  await render(<SchemaCard content={schema()} />);
  for (const t of ['Cauze', 'Urmări', 'Marea Unire', 'Destrămarea imperiilor', 'Autodeterminarea', 'România Mare']) {
    expect(screen.getByText(t)).toBeTruthy();
  }
});

it('pressing a box with detail reveals it and sets expanded', async () => {
  await render(<SchemaCard content={schema()} />);
  expect(screen.queryByText('Principiul lui Wilson')).toBeNull();
  // Only aria-expanded is set (react-native-web 0.21 drops accessibilityState); native maps it to this state.
  const toggle = screen.getByRole('button');
  expect(toggle.props.accessibilityState).toMatchObject({ expanded: false });
  await fireEvent.press(toggle);
  expect(screen.getByText('Principiul lui Wilson')).toBeTruthy();
  expect(screen.getByRole('button').props.accessibilityState).toMatchObject({ expanded: true });
  await fireEvent.press(screen.getByRole('button'));
  expect(screen.queryByText('Principiul lui Wilson')).toBeNull();
});

it('renders empty zones without crashing', async () => {
  await render(<SchemaCard content={schema({ causes: [], consequences: [] })} />);
  expect(screen.getByText('Marea Unire')).toBeTruthy();
});

describe('tap affordance', () => {
  const HINT = 'Atinge căsuțele cu + pentru detalii';

  it('shows the hint only when at least one box has a detail', async () => {
    await render(<SchemaCard content={schema({ causes: [box('cause-0', 'Fără detaliu')] })} />);
    expect(screen.queryByText(HINT)).toBeNull();
    await render(<SchemaCard content={schema()} />);
    expect(screen.getByText(HINT)).toBeTruthy();
  });

  it('only boxes with a detail get the + badge and a tap hint for screen readers', async () => {
    await render(<SchemaCard content={schema({ central: box('central', 'Marea Unire', 'Alba Iulia') })} />);
    expect(screen.getAllByTestId('schema-badge', { includeHiddenElements: true })).toHaveLength(2);
    for (const b of screen.getAllByRole('button')) expect(b.props.accessibilityHint).toBe('Atinge pentru detalii');
  });

  it('the badge turns from + into × when the box opens and back when it closes', async () => {
    jest.useFakeTimers();
    try {
      await render(<SchemaCard content={schema()} />);
      const rotation = () =>
        getAnimatedStyle(screen.getByTestId('schema-badge', { includeHiddenElements: true })).transform[0].rotate;
      expect(rotation()).toBe('0deg');
      await fireEvent.press(screen.getByRole('button'));
      await act(async () => jest.advanceTimersByTime(600));
      expect(rotation()).toBe('45deg');
      await fireEvent.press(screen.getByRole('button'));
      await act(async () => jest.advanceTimersByTime(600));
      expect(rotation()).toBe('0deg');
    } finally {
      jest.useRealTimers();
    }
  });

  it('the label of an expanded box includes its detail', async () => {
    await render(<SchemaCard content={schema()} />);
    expect(screen.getByRole('button').props.accessibilityLabel).toBe('Autodeterminarea');
    await fireEvent.press(screen.getByRole('button'));
    expect(screen.getByRole('button').props.accessibilityLabel).toBe('Autodeterminarea. Principiul lui Wilson');
  });
});

it('a box keeps its size until the detail opens (no flex gap reserved for the hidden detail)', async () => {
  await render(<SchemaCard content={schema()} />);
  expect(StyleSheet.flatten(screen.getByTestId('schema-box').props.style).gap).toBeUndefined();
});
