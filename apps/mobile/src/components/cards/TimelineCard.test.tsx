import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import type { CardContent } from '@prepio/shared';
import TimelineCard from './TimelineCard';

// Reanimated's jest helper; the public typings only describe the no-op production stub.
const { getAnimatedStyle } = Reanimated as unknown as { getAnimatedStyle: (node: unknown) => { transform: { rotate: string }[] } };

type Timeline = Extract<CardContent, { type: 'timeline' }>;
const point = (i: number, over: Partial<Timeline['points'][number]> = {}) => ({
  id: `point-${i}`,
  date: `Data ${i}`,
  title: `Titlu ${i}`,
  details: null,
  key: false,
  imagePath: null,
  ...over,
});
const timeline = (points: Timeline['points']): Timeline => ({ type: 'timeline', points });

it('renders dates and titles in stored order', async () => {
  await render(<TimelineCard content={timeline([point(2), point(1), point(3)])} />);
  const dates = screen.getAllByText(/^Data /).map((n) => n.props.children);
  expect(dates).toEqual(['Data 2', 'Data 1', 'Data 3']);
  expect(screen.getByText('Titlu 1')).toBeTruthy();
});

it('a key point exposes "moment cheie" in its accessibility label', async () => {
  await render(<TimelineCard content={timeline([point(1, { key: true }), point(2)])} />);
  expect(screen.getByLabelText(/moment cheie/)).toBeTruthy();
  expect(screen.getAllByLabelText(/moment cheie/)).toHaveLength(1);
});

it('pressing a point with details toggles them and the expanded state', async () => {
  await render(<TimelineCard content={timeline([point(1, { details: 'Detalii despre unire' })])} />);
  // The card sets only aria-expanded (react-native-web 0.21 drops accessibilityState); native Pressable maps it
  // to the host's accessibilityState, so asserting that state proves the aria prop is set.
  const toggle = screen.getByRole('button');
  expect(toggle.props.accessibilityState).toMatchObject({ expanded: false });
  expect(screen.queryByText('Detalii despre unire')).toBeNull();
  await fireEvent.press(toggle);
  expect(screen.getByText('Detalii despre unire')).toBeTruthy();
  expect(screen.getByRole('button').props.accessibilityState).toMatchObject({ expanded: true });
  await fireEvent.press(screen.getByRole('button'));
  expect(screen.queryByText('Detalii despre unire')).toBeNull();
});

it('the label of an expanded point includes its details, so screen readers read them', async () => {
  await render(<TimelineCard content={timeline([point(1, { details: 'Detalii despre unire' })])} />);
  expect(screen.getByRole('button').props.accessibilityLabel).toBe('Data 1, Titlu 1');
  await fireEvent.press(screen.getByRole('button'));
  expect(screen.getByRole('button').props.accessibilityLabel).toBe('Data 1, Titlu 1. Detalii despre unire');
});

it('a point without details is not a button', async () => {
  await render(<TimelineCard content={timeline([point(1)])} />);
  expect(screen.queryByRole('button')).toBeNull();
});

it('renders an empty timeline without crashing', async () => {
  await render(<TimelineCard content={timeline([])} />);
  expect(screen.queryByText(/^Data /)).toBeNull();
});

describe('tap affordance', () => {
  const HINT = 'Atinge un punct pentru detalii';

  it('shows the hint only when at least one point has details', async () => {
    await render(<TimelineCard content={timeline([point(1), point(2)])} />);
    expect(screen.queryByText(HINT)).toBeNull();
    await render(<TimelineCard content={timeline([point(1), point(2, { details: 'Mai mult' })])} />);
    expect(screen.getByText(HINT)).toBeTruthy();
  });

  it('only points with details get the chevron and a tap hint for screen readers', async () => {
    await render(<TimelineCard content={timeline([point(1), point(2, { details: 'Mai mult' }), point(3)])} />);
    expect(screen.getAllByTestId('timeline-chevron', { includeHiddenElements: true })).toHaveLength(1);
    expect(screen.getByRole('button').props.accessibilityHint).toBe('Atinge pentru detalii');
  });

  it('the chevron turns over when the point opens and back when it closes', async () => {
    jest.useFakeTimers();
    try {
      await render(<TimelineCard content={timeline([point(1, { details: 'Mai mult' })])} />);
      const rotation = () =>
        getAnimatedStyle(screen.getByTestId('timeline-chevron', { includeHiddenElements: true })).transform[0].rotate;
      expect(rotation()).toBe('0deg');
      await fireEvent.press(screen.getByRole('button'));
      await act(async () => jest.advanceTimersByTime(600));
      expect(rotation()).toBe('180deg');
      await fireEvent.press(screen.getByRole('button'));
      await act(async () => jest.advanceTimersByTime(600));
      expect(rotation()).toBe('0deg');
    } finally {
      jest.useRealTimers();
    }
  });
});
