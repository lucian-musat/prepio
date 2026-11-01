import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { color, feedbackText, type WritingExercise as WritingExerciseData } from '@prepio/shared';
import { EvaluateApiError, evaluateEssay } from '../lib/api';
import { WritingExercise } from './WritingExercise';

jest.mock('../lib/api', () => {
  const actual = jest.requireActual('../lib/api');
  return { ...actual, evaluateEssay: jest.fn() };
});
jest.mock('expo-router', () => ({ router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => false } }));
const mockEvaluate = evaluateEssay as jest.Mock;

const exercise: WritingExerciseData = { id: 'e1', position: 1, prompt: 'Scrie despre Cuza.', criteria: 'c' };
const result = { grade: 8, gradeMin: 1, gradeMax: 10, summary: 'Eseu bun.', suggestions: ['Adaugă date.', 'Dezvoltă concluzia.'] };
const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const frame = { title: 'Exercițiul 1 din 1', progress: 1, onBack: jest.fn() };

const setup = async () => {
  const onNext = jest.fn();
  await render(
    <SafeAreaProvider initialMetrics={metrics as Metrics}>
      <WritingExercise exercise={exercise} frame={frame} nextLabel="Continuă" onNext={onNext} />
    </SafeAreaProvider>,
  );
  return { onNext };
};
const bar = () => within(screen.getByTestId('action-bar'));
const content = () => within(screen.getByTestId('screen-content'));
const input = () => screen.getByLabelText('Răspunsul tău');
const submitBtn = () => bar().getByRole('button', { name: /Trimite pentru evaluare|Retrimite/ });
const isDisabled = (el: any) => !!el.props.accessibilityState?.disabled || !!el.props['aria-disabled'];
const textColor = (el: any) => StyleSheet.flatten(el.props.style)?.color;

beforeEach(() => mockEvaluate.mockReset());

it('renders the frame, eyebrow, prompt, field and an empty counter, with submit disabled', async () => {
  await setup();
  expect(screen.getByText('Exercițiul 1 din 1')).toBeTruthy();
  expect(screen.getByRole('progressbar')).toBeTruthy();
  expect(content().getByText('Exercițiu de scriere · evaluat cu AI')).toBeTruthy();
  expect(content().getByText('Scrie despre Cuza.')).toBeTruthy();
  expect(input().props.placeholder).toBe('Scrie răspunsul tău aici…');
  expect(content().getByText('0 / 3000')).toBeTruthy();
  expect(isDisabled(submitBtn())).toBe(true);
});

it('disables submit and turns the counter red over the limit (counts code points)', async () => {
  await setup();
  await fireEvent.changeText(input(), 'a'.repeat(3001));
  expect(textColor(screen.getByText('3001 / 3000'))).toBe(feedbackText.wrong);
  expect(isDisabled(submitBtn())).toBe(true);
  await fireEvent.changeText(input(), '😀'.repeat(3000));
  expect(textColor(screen.getByText('3000 / 3000'))).toBe(color.textMuted);
  expect(isDisabled(submitBtn())).toBe(false);
});

it('continue is available before submitting', async () => {
  const { onNext } = await setup();
  const next = bar().getByRole('button', { name: 'Continuă' });
  expect(isDisabled(next)).toBe(false);
  await fireEvent.press(next);
  expect(onNext).toHaveBeenCalledTimes(1);
  expect(mockEvaluate).not.toHaveBeenCalled();
});

it('shows the skeleton while evaluating, then the result with Nota ta, summary, ring label and suggestions', async () => {
  let resolve!: (v: typeof result) => void;
  mockEvaluate.mockReturnValue(new Promise((r) => (resolve = r)));
  await setup();
  await fireEvent.changeText(input(), 'Eseul meu');
  await fireEvent.press(submitBtn());
  expect(await content().findByText('Se evaluează răspunsul…')).toBeTruthy();
  expect(submitBtn().props.accessibilityState).toMatchObject({ busy: true });
  expect(mockEvaluate).toHaveBeenCalledWith({ exerciseId: 'e1', text: 'Eseul meu' });
  await act(async () => resolve(result));
  expect(content().getByText('Nota ta')).toBeTruthy();
  expect(content().getByLabelText('Nota 8 din 10')).toBeTruthy();
  expect(content().getByText('Eseu bun.')).toBeTruthy();
  expect(content().getByText('Ce poți îmbunătăți')).toBeTruthy();
  expect(content().getByText('Adaugă date.')).toBeTruthy();
  expect(content().getByText('Dezvoltă concluzia.')).toBeTruthy();
  expect(content().queryByText('Se evaluează răspunsul…')).toBeNull();
  expect(bar().getByRole('button', { name: 'Retrimite' })).toBeTruthy();
});

it('hides the suggestions label when there are no suggestions', async () => {
  mockEvaluate.mockResolvedValue({ ...result, suggestions: [] });
  await setup();
  await fireEvent.changeText(input(), 'Eseul meu');
  await fireEvent.press(submitBtn());
  expect(await content().findByText('Nota ta')).toBeTruthy();
  expect(content().queryByText('Ce poți îmbunătăți')).toBeNull();
});

it('submit pressed twice calls evaluateEssay once', async () => {
  mockEvaluate.mockReturnValue(new Promise(() => {}));
  await setup();
  await fireEvent.changeText(input(), 'Eseul meu');
  const button = submitBtn();
  // Two presses inside one act, before React re-renders (a fast double tap); RNTL warns about the nested act().
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    await act(async () => {
      void fireEvent.press(button);
      void fireEvent.press(button);
    });
  } finally {
    spy.mockRestore();
  }
  expect(mockEvaluate).toHaveBeenCalledTimes(1);
});

it('shows the error inline as an alert and keeps the text', async () => {
  mockEvaluate.mockRejectedValue(new EvaluateApiError('ai_failed', 'Evaluarea nu a reușit. Încearcă din nou.'));
  await setup();
  await fireEvent.changeText(input(), 'Eseul meu');
  await fireEvent.press(submitBtn());
  const alert = await content().findByRole('alert');
  const message = within(alert).getByText('Evaluarea nu a reușit. Încearcă din nou.');
  // AA text tone on the danger-subtle box.
  expect(textColor(message)).toBe(feedbackText.wrong);
  expect(StyleSheet.flatten(alert.props.style).backgroundColor).toBe(color.dangerSubtle);
  expect(input().props.value).toBe('Eseul meu');
  expect(isDisabled(submitBtn())).toBe(false);
});

it('resubmits the edited text', async () => {
  mockEvaluate.mockResolvedValue(result);
  await setup();
  await fireEvent.changeText(input(), 'Prima versiune');
  await fireEvent.press(submitBtn());
  await content().findByText('Nota ta');
  await fireEvent.changeText(input(), 'A doua versiune');
  await fireEvent.press(bar().getByRole('button', { name: 'Retrimite' }));
  await content().findByText('Nota ta');
  expect(mockEvaluate).toHaveBeenLastCalledWith({ exerciseId: 'e1', text: 'A doua versiune' });
  expect(mockEvaluate).toHaveBeenCalledTimes(2);
});

it('stacks the two actions on a narrow phone so neither label truncates', async () => {
  const RN = require('react-native');
  const spy = jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({ width: 360, height: 800, scale: 2, fontScale: 1 });
  try {
    await setup();
    expect(StyleSheet.flatten(screen.getByTestId('writing-actions').props.style).flexDirection).toBe('column');
  } finally {
    spy.mockRestore();
  }
  await setup();
  expect(StyleSheet.flatten(screen.getByTestId('writing-actions').props.style).flexDirection).toBe('row');
});

it('scrolls the content to the skeleton when loading starts and to the result when it arrives, once each', async () => {
  const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => {});
  try {
    let resolve!: (v: typeof result) => void;
    mockEvaluate.mockReturnValue(new Promise((r) => (resolve = r)));
    await setup();
    await fireEvent(screen.getByTestId('writing-card'), 'layout', { nativeEvent: { layout: { x: 0, y: 10, width: 320, height: 400 } } });
    await fireEvent.changeText(input(), 'Eseul meu');
    await fireEvent.press(submitBtn());
    const slotLayout = (y: number) => ({ nativeEvent: { layout: { x: 0, y, width: 300, height: 120 } } });
    await fireEvent(screen.getByTestId('evaluation-slot'), 'layout', slotLayout(300));
    expect(scrollTo).toHaveBeenCalledTimes(1);
    // 12 px under the top bar, like the prototype: card 10 + slot 300 - 12.
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 298, animated: true });
    // A later layout of the same skeleton (e.g. a resize) doesn't scroll again.
    await fireEvent(screen.getByTestId('evaluation-slot'), 'layout', slotLayout(300));
    expect(scrollTo).toHaveBeenCalledTimes(1);
    await act(async () => resolve(result));
    await fireEvent(screen.getByTestId('evaluation-slot'), 'layout', slotLayout(320));
    expect(scrollTo).toHaveBeenCalledTimes(2);
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 318, animated: true });
  } finally {
    scrollTo.mockRestore();
  }
});
