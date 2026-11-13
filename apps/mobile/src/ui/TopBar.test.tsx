import { fireEvent, render, screen } from '@testing-library/react-native';
import { applyOverrides, resetTexts } from '../texts/store';
import { router } from 'expo-router';
import TopBar, { goBackOrHome } from './TopBar';

jest.mock('expo-router', () => ({ router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn() } }));

const mockedRouter = router as unknown as { back: jest.Mock; replace: jest.Mock; canGoBack: jest.Mock };

const renderBar = async () => await render(<TopBar title="Lecția" onBack={goBackOrHome} raised={false} />);

beforeEach(() => jest.clearAllMocks());

it('back goes home when there is no history', async () => {
  mockedRouter.canGoBack.mockReturnValue(false);
  await renderBar();
  await fireEvent.press(screen.getByRole('button', { name: 'Înapoi' }));
  expect(mockedRouter.replace).toHaveBeenCalledWith('/');
  expect(mockedRouter.back).not.toHaveBeenCalled();
});

it('back pops when there is history', async () => {
  mockedRouter.canGoBack.mockReturnValue(true);
  await renderBar();
  await fireEvent.press(screen.getByRole('button', { name: 'Înapoi' }));
  expect(mockedRouter.back).toHaveBeenCalled();
  expect(mockedRouter.replace).not.toHaveBeenCalled();
});

it('has no back button without onBack', async () => {
  await render(<TopBar title="Prepio" raised={false} />);
  expect(screen.queryByRole('button', { name: 'Înapoi' })).toBeNull();
  expect(screen.getByText('Prepio')).toBeTruthy();
});

it('labels the progress bar with progressLabel (default "Progres")', async () => {
  await render(<TopBar title="Lecția" progress={0.5} raised={false} />);
  expect(screen.getByRole('progressbar', { name: 'Progres' })).toBeTruthy();
  await screen.rerender(<TopBar title="Lecția" progress={0.5} progressLabel="Progres lecție" raised={false} />);
  expect(screen.getByRole('progressbar', { name: 'Progres lecție' })).toBeTruthy();
});

describe('texts', () => {
  afterEach(() => resetTexts());
  it('names the back button and the logo from the texts', async () => {
    applyOverrides({ 'common.back': '[override]', 'meta.appName': '[app]' });
    await render(<TopBar logo onBack={() => {}} raised={false} />);
    expect(screen.getByRole('button', { name: '[override]' })).toBeTruthy();
    expect(screen.getByText('[app]')).toBeTruthy();
  });
});
