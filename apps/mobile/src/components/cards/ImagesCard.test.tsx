import { Image, Platform, StyleSheet } from 'react-native';
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

const ratio = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style).aspectRatio;

it('sizes an image from the native load event', async () => {
  await render(<ImagesCard content={make('single')} />);
  expect(ratio('card-image-0')).toBeCloseTo(16 / 9);
  await fireEvent(screen.getByTestId('card-image-0'), 'load', { nativeEvent: { source: { width: 300, height: 600 } } });
  expect(ratio('card-image-0')).toBe(0.5);
});

it('sizes an image with Image.getSize when the load event has no source (react-native-web)', async () => {
  const getSize = jest.spyOn(Image, 'getSize').mockImplementation((_uri, ok) => ok(400, 200));
  try {
    await render(<ImagesCard content={make('single')} />);
    // react-native-web passes the DOM load event as nativeEvent: no `source`.
    await fireEvent(screen.getByTestId('card-image-1'), 'load', { nativeEvent: {} });
    expect(getSize).toHaveBeenCalledWith('http://x/b.jpg', expect.any(Function), expect.any(Function));
    expect(ratio('card-image-1')).toBe(2);
  } finally {
    getSize.mockRestore();
  }
});

// The components set only aria-* (react-native-web 0.21 drops accessibilityState); native Pressable maps them to
// the host's accessibilityState, so asserting that state proves the aria props are set.
const state = (el: { props: { accessibilityState?: object } }) => el.props.accessibilityState;

it('images are buttons and gallery thumbnails expose the selected state', async () => {
  await render(<ImagesCard content={make('gallery')} />);
  expect(screen.getByRole('button', { name: 'Prima' })).toBeTruthy();
  const thumb = (n: number) => screen.getByLabelText(new RegExp(`^Miniatura ${n}:`));
  expect(state(thumb(1))).toMatchObject({ selected: true });
  expect(state(thumb(2))).toMatchObject({ selected: false });
  await fireEvent.press(thumb(2));
  expect(state(thumb(1))).toMatchObject({ selected: false });
  expect(state(thumb(2))).toMatchObject({ selected: true });
});

it('a failed image is remembered by path, so reordering or replacing images shows the right ones', async () => {
  await render(<ImagesCard content={make('single')} />);
  await fireEvent(screen.getByTestId('card-image-0'), 'error');
  expect(screen.queryByLabelText('Prima')).toBeNull();
  // The author removes the failed image: the others keep showing.
  await screen.rerender(<ImagesCard content={make('single', { images: [images[1], images[2]] })} />);
  expect(screen.getByLabelText('A doua')).toBeTruthy();
  expect(screen.getByLabelText('A treia')).toBeTruthy();
  // The author uploads a replacement in the failed slot: it shows.
  await screen.rerender(<ImagesCard content={make('single', { images: [{ path: 'd.jpg', alt: 'Înlocuită', credit: null }, images[1]] })} />);
  expect(screen.getByLabelText('Înlocuită')).toBeTruthy();
});

it('on web a press zooms the viewer image and a second press resets it', async () => {
  const os = Platform.OS;
  Platform.OS = 'web';
  try {
    await render(<ImagesCard content={make('single')} />);
    await fireEvent.press(screen.getByLabelText('Prima'));
    const big = () => screen.getByLabelText('Prima (mărită)');
    expect(state(big())).toMatchObject({ expanded: false });
    expect(screen.getByRole('button', { name: 'Prima (mărită)' })).toBeTruthy();
    await fireEvent.press(big());
    expect(state(big())).toMatchObject({ expanded: true });
    await fireEvent.press(big());
    expect(state(big())).toMatchObject({ expanded: false });
  } finally {
    Platform.OS = os;
  }
});

it('on web a tap after a touch drag (no trailing click) still zooms', async () => {
  const os = Platform.OS;
  Platform.OS = 'web';
  // Capture the pan callbacks the viewer registers (the global mock is a no-op).
  const rngh = jest.requireMock('react-native-gesture-handler');
  const usePan = rngh.usePanGesture;
  let pan: { onBegin?: () => void; onActivate?: () => void } = {};
  rngh.usePanGesture = (config: typeof pan) => {
    pan = config;
    return {};
  };
  try {
    await render(<ImagesCard content={make('single')} />);
    await fireEvent.press(screen.getByLabelText('Prima'));
    const big = () => screen.getByLabelText('Prima (mărită)');
    // Mouse drag: begin, activate, then the trailing click is swallowed.
    pan.onBegin?.();
    pan.onActivate?.();
    await fireEvent.press(big());
    expect(state(big())).toMatchObject({ expanded: false });
    // Touch drag: begin, activate, no click. The next tap begins a new gesture and zooms.
    pan.onBegin?.();
    pan.onActivate?.();
    pan.onBegin?.();
    await fireEvent.press(big());
    expect(state(big())).toMatchObject({ expanded: true });
  } finally {
    rngh.usePanGesture = usePan;
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

it('caps an image at 45 % of the screen height, so a portrait photo leaves room for its caption and text', async () => {
  const { Dimensions } = require('react-native');
  await render(<ImagesCard content={make('single')} />);
  const style = StyleSheet.flatten(screen.getByTestId('card-image-0').props.style);
  expect(style.maxHeight).toBe(Math.round(Dimensions.get('window').height * 0.45));
});
