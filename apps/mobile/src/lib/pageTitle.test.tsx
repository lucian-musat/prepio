import { Platform } from 'react-native';
import { render } from '@testing-library/react-native';
import { pageTitle, PageTitle } from './pageTitle';

let mockFocused = true;
jest.mock('expo-router', () => ({ useIsFocused: () => mockFocused }));

describe('pageTitle', () => {
  it('names the page before the app', () => {
    expect(pageTitle('Creditele mele')).toBe('Creditele mele · Prepio');
  });

  it('is just the app name without a page name', () => {
    expect(pageTitle()).toBe('Prepio');
    expect(pageTitle('  ')).toBe('Prepio');
  });
});

describe('<PageTitle>', () => {
  const original = Platform.OS;
  afterEach(() => {
    Platform.OS = original;
  });

  it('sets the document title on web', async () => {
    Platform.OS = 'web';
    (globalThis as unknown as { document?: { title: string } }).document = { title: '' };
    await render(<PageTitle name="Subiecte BAC" />);
    expect((globalThis as unknown as { document: { title: string } }).document.title).toBe('Subiecte BAC · Prepio');
  });

  it('leaves the title alone while the screen is not focused', async () => {
    Platform.OS = 'web';
    (globalThis as unknown as { document?: { title: string } }).document = { title: 'Lecție · Prepio' };
    mockFocused = false;
    await render(<PageTitle name="Subiecte BAC" />);
    mockFocused = true;
    expect((globalThis as unknown as { document: { title: string } }).document.title).toBe('Lecție · Prepio');
  });

  it('renders nothing', async () => {
    const { toJSON } = await render(<PageTitle name="Profilul tău" />);
    expect(toJSON()).toBeNull();
  });
});
