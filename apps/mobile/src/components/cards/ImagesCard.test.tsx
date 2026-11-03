import { Platform } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { CardContent } from '@prepio/shared';
import ImagesCard from './ImagesCard';

jest.mock('../../lib/content', () => ({ imageUrl: (p: string) => `http://x/${p}` }));

type Images = Extract<CardContent, { type: 'images' }>;

const images: Images['images'] = [
  { path: 'a.jpg', alt: 'Prima', credit: 'Autor A' },
  { path: 'b.jpg', alt: 'A doua', credit: null },
  { path: 'c.jpg', alt: 'A treia', credit: 'Autor C' },
];
const make = (display: Images['display'], over: Partial<Images> = {}): Images => ({
  type: 'images',
  images,
  display,
  text: null,
  ...over,
});

it('single display stacks every image with its credit', async () => {
  await render(<ImagesCard content={make('single')} />);
  expect(screen.getByLabelText('Prima')).toBeTruthy();
  expect(screen.getByLabelText('A doua')).toBeTruthy();
  expect(screen.getByLabelText('A treia')).toBeTruthy();
  expect(screen.getByText('Autor A')).toBeTruthy();
  expect(screen.getByText('Autor C')).toBeTruthy();
});

it('gallery shows the main image and switches it from the thumbnails', async () => {
  await render(<ImagesCard content={make('gallery')} />);
  expect(screen.getByLabelText('Prima')).toBeTruthy();
  expect(screen.queryByLabelText('A doua')).toBeNull();
  await fireEvent.press(screen.getByLabelText('Miniatura 2: A doua'));
  expect(screen.getByLabelText('A doua')).toBeTruthy();
  expect(screen.queryByLabelText('Prima')).toBeNull();
});

it('opens the viewer on press, navigates and closes it', async () => {
  await render(<ImagesCard content={make('gallery')} />);
  expect(screen.queryByLabelText('Închide')).toBeNull();
  await fireEvent.press(screen.getByLabelText('Prima'));
  expect(screen.getByLabelText('Închide')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Imaginea următoare'));
  expect(screen.getByLabelText('A doua (mărită)')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Închide'));
  expect(screen.queryByLabelText('Închide')).toBeNull();
});

it('hides a failed image', async () => {
  await render(<ImagesCard content={make('single')} />);
  await fireEvent(screen.getByTestId('card-image-0'), 'error');
  expect(screen.queryByLabelText('Prima')).toBeNull();
  expect(screen.queryByText('Autor A')).toBeNull();
  expect(screen.getByLabelText('A doua')).toBeTruthy();
});

it('on web a press zooms the viewer image and a second press resets it', async () => {
  const os = Platform.OS;
  Platform.OS = 'web';
  try {
    await render(<ImagesCard content={make('single')} />);
    await fireEvent.press(screen.getByLabelText('Prima'));
    const big = () => screen.getByLabelText('Prima (mărită)');
    expect(big().props.accessibilityState.expanded).toBe(false);
    await fireEvent.press(big());
    expect(big().props.accessibilityState.expanded).toBe(true);
    await fireEvent.press(big());
    expect(big().props.accessibilityState.expanded).toBe(false);
  } finally {
    Platform.OS = os;
  }
});

it('renders the optional text', async () => {
  await render(<ImagesCard content={make('single', { text: 'Legendă lungă' })} />);
  expect(screen.getByText('Legendă lungă')).toBeTruthy();
});

it('renders nothing for an empty list', async () => {
  await render(<ImagesCard content={make('gallery', { images: [] })} />);
  expect(screen.toJSON()).toBeNull();
});
