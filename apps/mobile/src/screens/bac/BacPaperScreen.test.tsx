import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BAC_GRADE_NOTE, type BacAnswers, type BacItem } from '@prepio/shared';
import {
  BacApiError,
  fetchBacPaper,
  fetchLatestGraded,
  fetchOpenAttempt,
  saveBacDraft,
  submitBac,
  type BacAttemptView,
  type BacPaper,
} from '../../lib/bac';
import { OFFLINE } from '../../lib/api';
import { fetchCreditPackages } from '../../lib/credits';
import BacPaperScreen from './BacPaperScreen';

jest.mock('../../lib/bac', () => ({
  ...jest.requireActual('../../lib/bac'),
  fetchBacPaper: jest.fn(),
  fetchOpenAttempt: jest.fn(),
  fetchLatestGraded: jest.fn(),
  saveBacDraft: jest.fn(),
  submitBac: jest.fn(),
}));
jest.mock('../../lib/credits', () => ({ ...jest.requireActual('../../lib/credits'), fetchCreditPackages: jest.fn(), purchaseCredits: jest.fn() }));
jest.mock('../../credits/CreditsProvider');
jest.mock('../../access/AccessProvider');
jest.mock('../../lib/access', () => ({ ...jest.requireActual('../../lib/access'), purchaseAccess: jest.fn() }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({ id: 's1' }),
  useFocusEffect: () => {},
}));
const { mockResetCredits, setBalance } = jest.requireMock<typeof import('../../credits/__mocks__/CreditsProvider')>('../../credits/CreditsProvider');
const { mockResetAccess } = jest.requireMock<typeof import('../../access/__mocks__/AccessProvider')>('../../access/AccessProvider');
const mockedPaper = fetchBacPaper as jest.Mock;
const mockedOpen = fetchOpenAttempt as jest.Mock;
const mockedGraded = fetchLatestGraded as jest.Mock;
const mockedSave = saveBacDraft as jest.Mock;
const mockedSubmit = submitBac as jest.Mock;

const HINT = 'Citește cerința de două ori.';
const base = { modelAnswer: null, explanation: null, sources: [], templateId: 't1', creditCost: 0 };
const short = (section: 1 | 2, number: number): BacItem =>
  ({
    ...base,
    id: `i${section}-${number}`,
    position: number,
    type: 'short_answer',
    prompt: `Cerința ${['', 'I', 'II'][section]}.${number}`,
    accepted: [],
    mistakes: [],
    section,
    number,
    points: section === 2 ? 7 : number === 1 ? 1 : 4,
  }) as unknown as BacItem;
const ESSAY = {
  ...base,
  id: 'i3-1',
  position: 1,
  type: 'essay',
  prompt: 'Elaborați un eseu despre statul român modern.',
  requirements: [
    { id: 'r1', text: 'Menționați două fapte.', modelAnswer: null, templateId: null, argument: false },
    { id: 'r2', text: 'Formulați un punct de vedere.', modelAnswer: null, templateId: null, argument: true },
  ],
  section: 3,
  number: 1,
  points: 30,
} as unknown as BacItem;
const ITEMS: BacItem[] = [...[1, 2, 3, 4, 5, 6, 7].map((n) => short(1, n)), short(2, 1), short(2, 2), ESSAY];
const PAPER: BacPaper = {
  subject: { id: 's1', title: 'Varianta 3', year: 2026, variant: '3', creditCost: 15 },
  sources: [{ id: 'src1', position: 0, title: null, author: '', work: '', body: 'În 1858 a fost semnată Convenția de la Paris.', section: 1 }],
  items: ITEMS,
  templates: { t1: { id: 't1', title: 'Răspuns scurt', exerciseType: 'short_answer', points: '', body: HINT } },
};

const attempt = (over: Partial<BacAttemptView> = {}): BacAttemptView => ({
  id: 'att1',
  status: 'draft',
  answers: {},
  position: { section: 1, index: 0 },
  points: null,
  grade: null,
  results: null,
  gradedAt: null,
  ...over,
});
/** Every item answered except I.6 and the essay's second requirement. */
const MOST: BacAnswers = {
  ...Object.fromEntries(ITEMS.filter((i) => i.type === 'short_answer' && i.id !== 'i1-6').map((i) => [i.id, { type: 'short_answer', text: 'Răspuns' }])),
  'i3-1': { type: 'essay', parts: { r1: 'Unirea și Constituția.', r2: '' } },
};
const RESULTS = [
  { itemId: 'i1-5', section: 1, number: 5, points: 0, max: 4, feedback: 'Ai inversat cauza cu efectul.' },
  { itemId: 'i3-1', section: 3, number: 1, points: 20, max: 30, feedback: 'Punctul de vedere nu e susținut.' },
];
const GRADED = attempt({ status: 'graded', grade: 8.4, points: 74, results: RESULTS as never, gradedAt: '2026-11-09T10:00:00Z' });

const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const mount = async () =>
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <BacPaperScreen />
    </SafeAreaProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockResetCredits(50);
  mockResetAccess();
  mockedPaper.mockResolvedValue(PAPER);
  mockedOpen.mockResolvedValue(null);
  mockedGraded.mockResolvedValue(null);
  mockedSave.mockResolvedValue(undefined);
  (fetchCreditPackages as jest.Mock).mockResolvedValue([{ id: 'p20', credits: 20, priceBani: 999, featured: true }]);
});
afterEach(() => jest.useRealTimers());

const next = () => fireEvent.press(screen.getByRole('button', { name: 'Următorul →' }));
const openSubmit = async () => {
  await act(async () => void fireEvent.press(await screen.findByRole('button', { name: 'Predă lucrarea' })));
};
const send = () => screen.getByRole('button', { name: 'Trimite la corectat, costă 15 credite' });

const TAILS: Record<number, string> = { 1: '· 1 punct', 4: '· 4 puncte', 7: '· 7 puncte', 30: '· 30 de puncte' };

it('shows a collapsed „Cum rezolv” and the pluralised points at every item; a tap opens the hint', async () => {
  await mount();
  for (let i = 0; i < ITEMS.length; i++) {
    const it = ITEMS[i]!;
    expect(await screen.findByText(it.prompt)).toBeTruthy();
    expect(screen.getByText('💡 Cum rezolv')).toBeTruthy();
    expect(screen.queryByText(HINT)).toBeNull();
    expect(screen.getByText(TAILS[it.points]!)).toBeTruthy();
    if (i < ITEMS.length - 1) await act(async () => void next());
  }
});

it('the hint opens on tap and is collapsed again on the next item', async () => {
  await mount();
  expect(await screen.findByText('Cerința I.1')).toBeTruthy();
  const toggle = screen.getByRole('button', { name: /Cum rezolv/ });
  expect(toggle.props.accessibilityState).toMatchObject({ expanded: false });
  await act(async () => void fireEvent.press(toggle));
  expect(screen.getByText(HINT)).toBeTruthy();
  expect(screen.getByRole('button', { name: /Cum rezolv/ }).props.accessibilityState).toMatchObject({ expanded: true });
  await act(async () => void next());
  expect(screen.getByText('Cerința I.2')).toBeTruthy();
  expect(screen.queryByText(HINT)).toBeNull();
});

it('next moves from I.7 to II.1', async () => {
  mockedOpen.mockResolvedValue(attempt({ position: { section: 1, index: 6 } }));
  await mount();
  expect(await screen.findByText('Cerința I.7')).toBeTruthy();
  expect(screen.getByRole('tab', { name: 'Subiectul I' }).props.accessibilityState).toMatchObject({ selected: true });
  await act(async () => void next());
  expect(screen.getByText('Cerința II.1')).toBeTruthy();
  expect(screen.getByRole('tab', { name: 'Subiectul II' }).props.accessibilityState).toMatchObject({ selected: true });
  // The tab switch saves the new position at once (0-based within the section).
  await waitFor(() => expect(mockedSave).toHaveBeenCalledWith('s1', {}, { section: 2, index: 0 }));
});

it('at the last item the primary action says what to do next and opens the submit summary', async () => {
  mockedOpen.mockResolvedValue(attempt({ answers: MOST, position: { section: 3, index: 0 } }));
  await mount();
  expect(await screen.findByText('Elaborați un eseu despre statul român modern.')).toBeTruthy();
  expect(screen.getByText('Ai ajuns la ultima cerință. Verifică ce mai ai de completat și predă lucrarea.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Următorul →' })).toBeNull();
  // The action bar's button (the header link has the same name).
  const handIn = screen.getAllByRole('button', { name: 'Predă lucrarea' });
  expect(handIn).toHaveLength(2);
  await act(async () => void fireEvent.press(handIn[handIn.length - 1]!));
  expect(screen.getByText('Ai răspuns la 8 din 10 cerințe')).toBeTruthy();
  expect(screen.getByText('Necompletate: I.6, III (cerința 2)')).toBeTruthy();
});

it('before the last item there is no last-item hint', async () => {
  await mount();
  expect(await screen.findByText('Cerința I.1')).toBeTruthy();
  expect(screen.queryByText(/Ai ajuns la ultima cerință/)).toBeNull();
  expect(screen.getByRole('button', { name: 'Următorul →' })).toBeTruthy();
});

it('submit shows the answered count and the empty list', async () => {
  mockedOpen.mockResolvedValue(attempt({ answers: MOST }));
  await mount();
  await openSubmit();
  expect(screen.getByText('Ai răspuns la 8 din 10 cerințe')).toBeTruthy();
  expect(screen.getByText('Necompletate: I.6, III (cerința 2)')).toBeTruthy();
  expect(screen.getByText('După trimitere nu mai poți modifica răspunsurile.')).toBeTruthy();
  expect(send()).toBeTruthy();
  await act(async () => void fireEvent.press(screen.getByRole('button', { name: 'Mai lucrez' })));
  expect(screen.getByText('Cerința I.1')).toBeTruthy();
});

it('a successful submit renders the result with „8,40” and the grade note', async () => {
  mockedOpen.mockResolvedValue(attempt({ answers: MOST }));
  mockedSubmit.mockResolvedValue({ attemptId: 'att1', points: 74, grade: 8.4, results: RESULTS, credits: { spent: 15, balance: 35 } });
  await mount();
  await openSubmit();
  await act(async () => void fireEvent.press(send()));
  expect(await screen.findByText('8,40')).toBeTruthy();
  expect(screen.getByText(BAC_GRADE_NOTE)).toBeTruthy();
  expect(screen.getByText('I.5 — Ai inversat cauza cu efectul.')).toBeTruthy();
  expect(mockedSubmit).toHaveBeenCalledWith({ subjectId: 's1', answers: MOST });
  expect(setBalance).toHaveBeenCalledWith(35);
});

it('a 402 opens the credits sheet, keeping the answers', async () => {
  mockedOpen.mockResolvedValue(attempt({ answers: MOST }));
  mockedSubmit.mockRejectedValue(new BacApiError('insufficient_credits', 'Nu ai destule credite.', { required: 15, balance: 4 }));
  await mount();
  await openSubmit();
  await act(async () => void fireEvent.press(send()));
  const sheet = await screen.findByTestId('buy-credits-sheet');
  expect(within(sheet).getByText(/Corectarea lucrării costă/)).toBeTruthy();
  expect(setBalance).toHaveBeenCalledWith(4);
  expect(screen.getByText('Ai răspuns la 8 din 10 cerințe')).toBeTruthy();
});

it('too few credits on the client: the sheet opens and nothing is sent', async () => {
  mockResetCredits(3);
  mockedOpen.mockResolvedValue(attempt({ answers: MOST }));
  await mount();
  await openSubmit();
  await act(async () => void fireEvent.press(send()));
  expect(await screen.findByTestId('buy-credits-sheet')).toBeTruthy();
  expect(mockedSubmit).not.toHaveBeenCalled();
});

it('rate_limited shows the message on the submit view', async () => {
  mockedOpen.mockResolvedValue(attempt({ answers: MOST }));
  mockedSubmit.mockRejectedValue(new BacApiError('rate_limited', 'Corectarea nu este disponibilă acum. Încearcă din nou mai târziu.'));
  await mount();
  await openSubmit();
  await act(async () => void fireEvent.press(send()));
  expect(await screen.findByText('Corectarea nu este disponibilă acum. Încearcă din nou mai târziu.')).toBeTruthy();
  expect(send()).toBeTruthy();
});

it('an edit made just before a failed submit is still saved', async () => {
  mockedSubmit.mockRejectedValue(new BacApiError('rate_limited', 'Corectarea nu este disponibilă acum. Încearcă din nou mai târziu.'));
  await mount();
  await act(async () => void fireEvent.changeText(await screen.findByLabelText('Răspunsul tău'), 'Cuza'));
  await openSubmit();
  await act(async () => void fireEvent.press(send()));
  expect(await screen.findByText('Corectarea nu este disponibilă acum. Încearcă din nou mai târziu.')).toBeTruthy();
  expect(mockedSave).toHaveBeenCalledWith('s1', { 'i1-1': { type: 'short_answer', text: 'Cuza' } }, { section: 1, index: 0 });
});

it('a lost connection on submit while the server is already grading shows the grading view', async () => {
  mockedOpen.mockResolvedValueOnce(attempt({ answers: MOST })).mockResolvedValue(attempt({ status: 'grading', answers: MOST }));
  mockedSubmit.mockRejectedValue(new BacApiError('grading_failed', OFFLINE));
  await mount();
  await openSubmit();
  await act(async () => void fireEvent.press(send()));
  expect(await screen.findByText('Corectăm lucrarea…')).toBeTruthy();
  expect(screen.queryByText(OFFLINE)).toBeNull();
});

it('a lost connection on submit with nothing being graded shows the error inline', async () => {
  mockedOpen.mockResolvedValue(attempt({ answers: MOST }));
  mockedSubmit.mockRejectedValue(new BacApiError('grading_failed', OFFLINE));
  await mount();
  await openSubmit();
  await act(async () => void fireEvent.press(send()));
  expect(await screen.findByText(OFFLINE)).toBeTruthy();
  expect(send()).toBeTruthy();
});

it('a refunded grading failure keeps the refund message on the paper after „Mai lucrez”', async () => {
  const REFUND = 'Corectarea nu a reușit. Nu ți-am luat niciun credit. Încearcă din nou.';
  mockedOpen.mockResolvedValueOnce(attempt({ answers: MOST })).mockResolvedValue(attempt({ status: 'failed', answers: MOST }));
  mockedSubmit.mockRejectedValue(new BacApiError('grading_failed', REFUND));
  await mount();
  await openSubmit();
  await act(async () => void fireEvent.press(send()));
  expect(await screen.findByText(REFUND)).toBeTruthy();
  await act(async () => void fireEvent.press(screen.getByRole('button', { name: 'Mai lucrez' })));
  expect(screen.getByText('Cerința I.1')).toBeTruthy();
  expect(screen.getByText(REFUND)).toBeTruthy();
});

it('a lost connection with nothing stored shows no refund message on the paper', async () => {
  mockedOpen.mockResolvedValue(attempt({ answers: MOST }));
  mockedSubmit.mockRejectedValue(new BacApiError('grading_failed', OFFLINE));
  await mount();
  await openSubmit();
  await act(async () => void fireEvent.press(send()));
  expect(await screen.findByText(OFFLINE)).toBeTruthy();
  await act(async () => void fireEvent.press(screen.getByRole('button', { name: 'Mai lucrez' })));
  expect(screen.queryByText('Corectarea nu a reușit. Nu ți-am luat niciun credit. Încearcă din nou.')).toBeNull();
});

it('resumes a grading attempt', async () => {
  jest.useFakeTimers();
  mockedOpen.mockResolvedValueOnce(attempt({ status: 'grading', answers: MOST })).mockResolvedValueOnce(attempt({ status: 'grading', answers: MOST })).mockResolvedValue(null);
  mockedGraded.mockResolvedValue(GRADED);
  await mount();
  expect(await screen.findByText('Corectăm lucrarea…')).toBeTruthy();
  await act(async () => {
    jest.advanceTimersByTime(5000);
  });
  expect(screen.getByText('Corectăm lucrarea…')).toBeTruthy();
  await act(async () => {
    jest.advanceTimersByTime(5000);
  });
  expect(await screen.findByText('8,40')).toBeTruthy();
  expect(screen.getByText(BAC_GRADE_NOTE)).toBeTruthy();
  expect(mockedSave).not.toHaveBeenCalled();
});

it('failed shows the refund message and the paper is editable again', async () => {
  jest.useFakeTimers();
  mockedOpen.mockResolvedValueOnce(attempt({ status: 'grading', answers: MOST })).mockResolvedValue(attempt({ status: 'failed', answers: MOST }));
  await mount();
  expect(await screen.findByText('Corectăm lucrarea…')).toBeTruthy();
  await act(async () => {
    jest.advanceTimersByTime(5000);
  });
  expect(await screen.findByText('Corectarea nu a reușit. Nu ți-am luat niciun credit. Încearcă din nou.')).toBeTruthy();
  const field = screen.getByLabelText('Răspunsul tău');
  expect(field.props.value).toBe('Răspuns');
  expect(field.props.editable).not.toBe(false);
});
