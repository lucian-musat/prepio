import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import type { Question } from '@prepio/shared';
import QuestionView from './QuestionView';

jest.mock('expo-router', () => ({ router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => false } }));

const base = { id: 'q', position: 1, prompt: 'Întrebare?', difficulty: 'medium' as const, explanation: 'Explicația. A doua frază.' };
const single: Question = {
  ...base,
  type: 'single_choice',
  options: [
    { id: 'a', text: 'Varianta A', correct: false },
    { id: 'b', text: 'Varianta B', correct: true },
  ],
};
const multi: Question = {
  ...base,
  type: 'multiple_choice',
  options: [
    { id: 'a', text: 'Alfa', correct: true },
    { id: 'b', text: 'Beta', correct: false },
    { id: 'c', text: 'Gama', correct: true },
  ],
};
const order: Question = {
  ...base,
  type: 'chronological_order',
  options: [
    { id: 'x', text: 'Primul', label: '1000' },
    { id: 'y', text: 'Al doilea', label: '1100' },
    { id: 'z', text: 'Al treilea', label: '1200' },
  ],
};

const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const wrap = (ui: React.ReactElement) => <SafeAreaProvider initialMetrics={metrics as Metrics}>{ui}</SafeAreaProvider>;
const frame = { title: 'Întrebarea 1 din 1', progress: 0.5, onBack: jest.fn() };

const renderQ = async (q: Question) => {
  const onAnswered = jest.fn();
  const onNext = jest.fn();
  await render(wrap(<QuestionView question={q} onAnswered={onAnswered} onNext={onNext} frame={frame} />));
  return { onAnswered, onNext };
};
const bar = () => within(screen.getByTestId('action-bar'));
const verify = () => bar().getByRole('button', { name: 'Verifică' });
// Two presses inside one act, before React re-renders: what a fast double tap does. RNTL warns about
// the nested act() calls this needs, so that one expected warning is silenced here.
const pressTwice = async (el: Parameters<typeof fireEvent.press>[0]) => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    await act(async () => {
      void fireEvent.press(el);
      void fireEvent.press(el);
    });
  } finally {
    spy.mockRestore();
  }
};
const isDisabled = (el: any) => !!el.props.accessibilityState?.disabled || !!el.props['aria-disabled'];

it('shows the type label and the difficulty badge', async () => {
  await renderQ(single);
  expect(screen.getByText('Alegere unică')).toBeTruthy();
  expect(screen.getByText('mediu')).toBeTruthy();
});

it('labels multiple choice and order questions', async () => {
  await renderQ(multi);
  expect(screen.getByText('Alegere multiplă')).toBeTruthy();
  await screen.rerender(wrap(<QuestionView question={order} onAnswered={jest.fn()} frame={frame} />));
  expect(screen.getByText('Ordine cronologică')).toBeTruthy();
});

describe('single choice', () => {
  it('Verifică is disabled until a selection exists', async () => {
    await renderQ(single);
    expect(isDisabled(verify())).toBe(true);
    await fireEvent.press(screen.getByText('Varianta A'));
    expect(isDisabled(verify())).toBe(false);
  });

  it('correct answer shows Corect, bravo! with the first sentence of the explanation', async () => {
    const { onAnswered, onNext } = await renderQ(single);
    await fireEvent.press(screen.getByText('Varianta B'));
    await fireEvent.press(verify());
    expect(bar().getByText('Corect, bravo!')).toBeTruthy();
    expect(bar().getByText('Explicația.')).toBeTruthy();
    expect(screen.getByText('Explicația. A doua frază.')).toBeTruthy();
    expect(onAnswered).toHaveBeenCalledWith(true);
    await fireEvent.press(bar().getByRole('button', { name: 'Următoarea întrebare' }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('wrong answer shows Nu chiar., the correct answer and explanation', async () => {
    const { onAnswered } = await renderQ(single);
    await fireEvent.press(screen.getByText('Varianta A'));
    await fireEvent.press(verify());
    expect(screen.getByText('Nu chiar.')).toBeTruthy();
    expect(screen.getByText('Răspuns corect: Varianta B')).toBeTruthy();
    expect(screen.getByText('Explicația. A doua frază.')).toBeTruthy();
    expect(onAnswered).toHaveBeenCalledWith(false);
  });

  it('explanation and correct answers render in the content, verdict in the action bar', async () => {
    await renderQ(single);
    await fireEvent.press(screen.getByText('Varianta A'));
    await fireEvent.press(verify());
    expect(bar().getByText('Nu chiar.')).toBeTruthy();
    expect(bar().queryByText('Explicația. A doua frază.')).toBeNull();
    expect(bar().queryByText('Răspuns corect: Varianta B')).toBeNull();
    const content = within(screen.getByTestId('screen-content'));
    expect(content.getByText('Explicația. A doua frază.')).toBeTruthy();
    expect(content.getByText('Răspuns corect: Varianta B')).toBeTruthy();
    // A short single correct answer is repeated in the bar.
    expect(bar().getByText('Răspunsul corect: Varianta B')).toBeTruthy();
  });

  it('long correct answer shows the short hint in the bar', async () => {
    const long = 'x'.repeat(80);
    await renderQ({
      ...single,
      options: [
        { id: 'a', text: 'Scurt', correct: false },
        { id: 'b', text: long, correct: true },
      ],
    });
    await fireEvent.press(screen.getByText('Scurt'));
    await fireEvent.press(verify());
    expect(bar().getByText('Vezi răspunsul corect mai sus.')).toBeTruthy();
    expect(bar().queryByText(new RegExp(long))).toBeNull();
  });

  it('Verifică pressed twice answers once', async () => {
    const { onAnswered } = await renderQ(single);
    await fireEvent.press(screen.getByText('Varianta B'));
    const button = verify();
    await pressTwice(button);
    expect(onAnswered).toHaveBeenCalledTimes(1);
  });

  it('next pressed twice advances once', async () => {
    const { onNext } = await renderQ(single);
    await fireEvent.press(screen.getByText('Varianta B'));
    await fireEvent.press(verify());
    const next = bar().getByRole('button', { name: 'Următoarea întrebare' });
    await pressTwice(next);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('announces the result of each option to screen readers', async () => {
    await renderQ(single);
    await fireEvent.press(screen.getByText('Varianta A'));
    await fireEvent.press(verify());
    const picked = screen.getByRole('radio', { name: 'Varianta A, greșit, ai ales-o' });
    const revealed = screen.getByRole('radio', { name: 'Varianta B, corect' });
    expect(picked.props.accessibilityState).toMatchObject({ checked: true, disabled: false });
    expect(revealed.props.accessibilityState).toMatchObject({ checked: false, disabled: false });
  });

  it('options cannot be changed after checking', async () => {
    await renderQ(single);
    await fireEvent.press(screen.getByText('Varianta A'));
    await fireEvent.press(verify());
    await fireEvent.press(screen.getByText('Varianta B'));
    expect(screen.getByRole('radio', { name: 'Varianta B, corect' }).props.accessibilityState).toMatchObject({ checked: false });
  });
});

describe('multiple choice', () => {
  it('needs a selection; all correct options -> Corect, bravo!', async () => {
    const { onAnswered } = await renderQ(multi);
    expect(isDisabled(verify())).toBe(true);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Alfa' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Gama' }));
    await fireEvent.press(verify());
    expect(screen.getByText('Corect, bravo!')).toBeTruthy();
    expect(onAnswered).toHaveBeenCalledWith(true);
    expect(screen.getByRole('checkbox', { name: 'Alfa, corect, ai ales-o' })).toBeTruthy();
  });

  it('toggling a checkbox twice unselects it', async () => {
    await renderQ(multi);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Alfa' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Alfa' }));
    expect(isDisabled(verify())).toBe(true);
  });

  it('partial selection -> Nu chiar. with the correct answers', async () => {
    await renderQ(multi);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Alfa' }));
    await fireEvent.press(verify());
    expect(screen.getByText('Nu chiar.')).toBeTruthy();
    expect(screen.getByText('Răspunsuri corecte: Alfa; Gama')).toBeTruthy();
    expect(bar().getByText('Vezi răspunsul corect mai sus.')).toBeTruthy();
  });
});

describe('chronological order', () => {
  const texts = () => screen.getAllByTestId('order-item-text').map((n) => n.props.children);
  const target = ['Primul', 'Al doilea', 'Al treilea'];

  it('initial order differs from the correct order', async () => {
    await renderQ(order);
    expect(texts()).not.toEqual(target);
  });

  it('Verifică is enabled right away', async () => {
    await renderQ(order);
    expect(isDisabled(verify())).toBe(false);
  });

  it('up/down buttons reorder; correct order -> Corect, bravo!', async () => {
    const { onAnswered } = await renderQ(order);
    for (let pass = 0; pass < 5; pass++) {
      const i = texts().findIndex((t, idx) => t !== target[idx]);
      if (i === -1) break;
      await fireEvent.press(screen.getByLabelText(`Mută în sus: ${target[i]}`));
    }
    expect(texts()).toEqual(target);
    await fireEvent.press(verify());
    expect(screen.getByText('Corect, bravo!')).toBeTruthy();
    expect(onAnswered).toHaveBeenCalledWith(true);
    expect(screen.queryByText('Ordinea corectă:')).toBeNull();
    expect(screen.queryByLabelText(/Mută în sus/)).toBeNull();
  });

  it('wrong order -> Nu chiar. with the correct sequence and year labels', async () => {
    const { onAnswered } = await renderQ(order);
    for (let k = 0; k < 3 && texts()[0] !== 'Al treilea'; k++) {
      await fireEvent.press(screen.getByLabelText('Mută în sus: Al treilea'));
    }
    expect(texts()[0]).toBe('Al treilea');
    await fireEvent.press(verify());
    expect(bar().getByText('Nu chiar.')).toBeTruthy();
    const content = within(screen.getByTestId('screen-content'));
    expect(content.getByText('Ordinea corectă:')).toBeTruthy();
    expect(content.getByText('1000')).toBeTruthy();
    expect(content.getByText('1200')).toBeTruthy();
    expect(content.getByText('Explicația. A doua frază.')).toBeTruthy();
    expect(onAnswered).toHaveBeenCalledWith(false);
  });
});
