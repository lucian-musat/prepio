import { fireEvent, render, screen } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';
import type { CardContent } from '@prepio/shared';
import LinkCard from './LinkCard';

type Link = Extract<CardContent, { type: 'link' }>;
const link = (over: Partial<Link> = {}): Link => ({
  type: 'link',
  url: 'https://ro.wikipedia.org/wiki/X',
  pageTitle: 'Titlu pagină',
  description: 'O descriere',
  image: null,
  text: null,
  ...over,
});

beforeEach(() => jest.mocked(WebBrowser.openBrowserAsync).mockClear());

it('shows the domain without www, the title and the description', async () => {
  await render(<LinkCard content={link()} />);
  expect(screen.getByText('RO.WIKIPEDIA.ORG')).toBeTruthy();
  expect(screen.getByText('Titlu pagină')).toBeTruthy();
  expect(screen.getByText('O descriere')).toBeTruthy();
  await render(<LinkCard content={link({ url: 'https://www.example.com/a' })} />);
  expect(screen.getByText('EXAMPLE.COM')).toBeTruthy();
});

it('opens the url in the browser', async () => {
  await render(<LinkCard content={link()} />);
  await fireEvent.press(screen.getByRole('button', { name: /Deschide/ }));
  expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://ro.wikipedia.org/wiki/X');
});

it('never opens a non-http url', async () => {
  await render(<LinkCard content={link({ url: 'javascript:alert(1)' })} />);
  await fireEvent.press(screen.getByRole('button', { name: /Deschide/ }));
  expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
});

it('has no image when image is null, and resolves url and path images', async () => {
  await render(<LinkCard content={link()} />);
  expect(screen.queryByTestId('link-image')).toBeNull();
  await screen.rerender(<LinkCard content={link({ image: { kind: 'url', url: 'https://x.test/a.png' } })} />);
  expect(screen.getByTestId('link-image').props.source).toEqual({ uri: 'https://x.test/a.png' });
  await screen.rerender(<LinkCard content={link({ image: { kind: 'path', path: 'cards/a.png' } })} />);
  expect(screen.getByTestId('link-image').props.source.uri).toContain('cards/a.png');
});

it('hides the image when it fails to load', async () => {
  await render(<LinkCard content={link({ image: { kind: 'url', url: 'https://x.test/a.png' } })} />);
  await fireEvent(screen.getByTestId('link-image'), 'error');
  expect(screen.queryByTestId('link-image')).toBeNull();
});

it('an invalid url still renders the title, without a domain', async () => {
  await render(<LinkCard content={link({ url: 'nu e un url' })} />);
  expect(screen.getByText('Titlu pagină')).toBeTruthy();
  expect(screen.queryByText('RO.WIKIPEDIA.ORG')).toBeNull();
});

it('renders the optional text', async () => {
  await render(<LinkCard content={link({ text: 'Citește aici' })} />);
  expect(screen.getByText('Citește aici')).toBeTruthy();
});
