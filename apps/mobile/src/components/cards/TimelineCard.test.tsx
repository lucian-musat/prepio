import { fireEvent, render, screen } from '@testing-library/react-native';
import type { CardContent } from '@prepio/shared';
import TimelineCard from './TimelineCard';

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
  const toggle = screen.getByRole('button');
  expect(toggle.props.accessibilityState).toMatchObject({ expanded: false });
  expect(screen.queryByText('Detalii despre unire')).toBeNull();
  await fireEvent.press(toggle);
  expect(screen.getByText('Detalii despre unire')).toBeTruthy();
  expect(screen.getByRole('button').props.accessibilityState).toMatchObject({ expanded: true });
  await fireEvent.press(screen.getByRole('button'));
  expect(screen.queryByText('Detalii despre unire')).toBeNull();
});

it('a point without details is not a button', async () => {
  await render(<TimelineCard content={timeline([point(1)])} />);
  expect(screen.queryByRole('button')).toBeNull();
});

it('renders an empty timeline without crashing', async () => {
  await render(<TimelineCard content={timeline([])} />);
  expect(screen.queryByText(/^Data /)).toBeNull();
});
