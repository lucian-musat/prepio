import { act, renderHook, waitFor } from '@testing-library/react-native';
import { fetchOpenAttempt, saveBacDraft, type BacAttemptView } from '../../lib/bac';
import { useBacDraft } from './useBacDraft';

jest.mock('../../lib/bac', () => ({
  ...jest.requireActual('../../lib/bac'),
  fetchOpenAttempt: jest.fn(),
  saveBacDraft: jest.fn(),
}));
const mockedOpen = fetchOpenAttempt as jest.Mock;
const mockedSave = saveBacDraft as jest.Mock;

const attempt = (over: Partial<BacAttemptView> = {}): BacAttemptView => ({
  id: 'att1',
  status: 'draft',
  answers: { i1: { type: 'short_answer', text: 'Cuza' } },
  position: { section: 2, index: 1 },
  points: null,
  grade: null,
  results: null,
  gradedAt: null,
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockedSave.mockResolvedValue(undefined);
});
afterEach(() => jest.useRealTimers());

it('restores the answers and the position from the open attempt', async () => {
  mockedOpen.mockResolvedValue(attempt());
  const { result } = await renderHook(() => useBacDraft('s1'));
  await waitFor(() => expect(result.current.status).toBe('ready'));
  expect(mockedOpen).toHaveBeenCalledWith('s1');
  expect(result.current.answers).toEqual({ i1: { type: 'short_answer', text: 'Cuza' } });
  expect(result.current.position).toEqual({ section: 2, index: 1 });
  expect(result.current.attempt?.status).toBe('draft');
});

it('without an open attempt it starts empty on Subiectul I, cerința 1', async () => {
  mockedOpen.mockResolvedValue(null);
  const { result } = await renderHook(() => useBacDraft('s1'));
  await waitFor(() => expect(result.current.status).toBe('ready'));
  expect(result.current.answers).toEqual({});
  expect(result.current.position).toEqual({ section: 1, index: 0 });
  expect(mockedSave).not.toHaveBeenCalled();
});

it('saves 1500 ms after the last change, once', async () => {
  jest.useFakeTimers();
  mockedOpen.mockResolvedValue(null);
  const { result } = await renderHook(() => useBacDraft('s1'));
  await waitFor(() => expect(result.current.status).toBe('ready'));
  await act(async () => {
    result.current.setAnswer('i1', { type: 'short_answer', text: 'C' });
  });
  await act(async () => {
    jest.advanceTimersByTime(1000);
  });
  await act(async () => {
    result.current.setAnswer('i1', { type: 'short_answer', text: 'Cu' });
  });
  await act(async () => {
    jest.advanceTimersByTime(1499);
  });
  expect(mockedSave).not.toHaveBeenCalled();
  await act(async () => {
    jest.advanceTimersByTime(1);
  });
  expect(mockedSave).toHaveBeenCalledTimes(1);
  expect(mockedSave).toHaveBeenCalledWith('s1', { i1: { type: 'short_answer', text: 'Cu' } }, { section: 1, index: 0 });
  await waitFor(() => expect(result.current.saveState).toBe('saved'));
});

it('an unchanged answer does not save', async () => {
  jest.useFakeTimers();
  mockedOpen.mockResolvedValue(attempt());
  const { result } = await renderHook(() => useBacDraft('s1'));
  await waitFor(() => expect(result.current.status).toBe('ready'));
  await act(async () => {
    result.current.setAnswer('i1', { type: 'short_answer', text: 'Cuza' });
  });
  await act(async () => {
    jest.advanceTimersByTime(2000);
  });
  expect(mockedSave).not.toHaveBeenCalled();
});

it('saves a pending change on unmount', async () => {
  jest.useFakeTimers();
  mockedOpen.mockResolvedValue(null);
  const { result, unmount } = await renderHook(() => useBacDraft('s1'));
  await waitFor(() => expect(result.current.status).toBe('ready'));
  await act(async () => {
    result.current.setAnswer('i1', { type: 'short_answer', text: 'Carol' });
  });
  await act(async () => {
    result.current.setPosition({ section: 1, index: 3 });
  });
  await act(async () => unmount());
  expect(mockedSave).toHaveBeenCalledTimes(1);
  expect(mockedSave).toHaveBeenCalledWith('s1', { i1: { type: 'short_answer', text: 'Carol' } }, { section: 1, index: 3 });
});

it('flush saves at once; a failed save shows „Nu s-a putut salva” and is retried on the next change', async () => {
  mockedOpen.mockResolvedValue(null);
  mockedSave.mockRejectedValueOnce(new Error('network'));
  const { result } = await renderHook(() => useBacDraft('s1'));
  await waitFor(() => expect(result.current.status).toBe('ready'));
  await act(async () => {
    result.current.setAnswer('i1', { type: 'short_answer', text: 'X' });
  });
  await act(async () => {
    await result.current.flush();
  });
  expect(result.current.saveState).toBe('error');
  await act(async () => {
    await result.current.flush();
  });
  expect(mockedSave).toHaveBeenCalledTimes(2);
  expect(result.current.saveState).toBe('saved');
});
