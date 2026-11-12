import { AccessibilityInfo, ScrollView } from 'react-native';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import type { Question } from '@prepio/shared';
import QuestionView from './QuestionView';

jest.mock('expo-router', () => ({ router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => false } }));

const base = { id: 'q', position: 1, prompt: 'Întrebare?', difficulty: 'medium' as const, explanation: 'Explicația pe larg aici. A doua frază.' };
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
  const unexpected: unknown[][] = [];
  const spy = jest.spyOn(console, 'error').mockImplementation((...args) => {
    if (!/overlapping act/.test(String(args[0]))) unexpected.push(args);
  });
  try {
    await act(async () => {
      void fireEvent.press(el);
      void fireEvent.press(el);
    });
  } finally {
    spy.mockRestore();
  }
  expect(unexpected).toEqual([]);
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

  it('correct answer shows Corect, bravo! and the explanation once, in the content', async () => {
    const { onAnswered, onNext } = await renderQ(single);
    await fireEvent.press(screen.getByText('Varianta B'));
    await fireEvent.press(verify());
    expect(bar().getByText('Corect, bravo!')).toBeTruthy();
    expect(bar().queryByText(/Explicația/)).toBeNull();
    expect(screen.getAllByText(/Explicația pe larg aici/)).toHaveLength(1);
    expect(onAnswered).toHaveBeenCalledWith(true);
    await fireEvent.press(bar().getByRole('button', { name: 'Următoarea întrebare' }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('wrong answer shows Nu chiar., the correct answer once in the bar (the option is marked) and the explanation', async () => {
    const { onAnswered } = await renderQ(single);
    await fireEvent.press(screen.getByText('Varianta A'));
    await fireEvent.press(verify());
    expect(screen.getByText('Nu chiar.')).toBeTruthy();
    expect(within(screen.getByTestId('screen-content')).queryByText('Răspuns corect: Varianta B')).toBeNull();
    expect(bar().getByText('Răspuns corect: Varianta B')).toBeTruthy();
    expect(screen.getByText('Explicația pe larg aici. A doua frază.')).toBeTruthy();
    expect(onAnswered).toHaveBeenCalledWith(false);
  });

  it('marks the correct option 300 ms after a wrong answer, like the prototype', async () => {
    jest.useFakeTimers();
    try {
      await renderQ(single);
      await fireEvent.press(screen.getByText('Varianta A'));
      await fireEvent.press(verify());
      expect(screen.getByTestId('option-icon-close')).toBeTruthy();
      expect(screen.queryByTestId('option-icon-check')).toBeNull();
      await act(async () => {
        jest.advanceTimersByTime(300);
      });
      expect(screen.getByTestId('option-icon-check')).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it('announces the verdict and its line once to screen readers', async () => {
    // RN's jest setup already mocks AccessibilityInfo, so spyOn returns that mock with earlier calls: clear it.
    const spy = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockClear().mockImplementation(() => {});
    try {
      await renderQ(single);
      await fireEvent.press(screen.getByText('Varianta A'));
      await fireEvent.press(verify());
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('Nu chiar. Răspuns corect: Varianta B');
    } finally {
      spy.mockRestore();
    }
  });

  it('announces a correct verdict without a line when there is no explanation', async () => {
    // RN's jest setup already mocks AccessibilityInfo, so spyOn returns that mock with earlier calls: clear it.
    const spy = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockClear().mockImplementation(() => {});
    try {
      await renderQ({ ...single, explanation: null });
      await fireEvent.press(screen.getByText('Varianta B'));
      await fireEvent.press(verify());
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('Corect, bravo!');
    } finally {
      spy.mockRestore();
    }
  });

  it('explanation and correct answers render in the content, verdict in the action bar', async () => {
    await renderQ(single);
    await fireEvent.press(screen.getByText('Varianta A'));
    await fireEvent.press(verify());
    expect(bar().getByText('Nu chiar.')).toBeTruthy();
    expect(bar().queryByText('Explicația pe larg aici. A doua frază.')).toBeNull();
    const content = within(screen.getByTestId('screen-content'));
    expect(content.getByText('Explicația pe larg aici. A doua frază.')).toBeTruthy();
    // A short single correct answer is named in the bar only; the content marks the option.
    expect(content.queryByText('Răspuns corect: Varianta B')).toBeNull();
    expect(bar().getByText('Răspuns corect: Varianta B')).toBeTruthy();
  });

  it('the next button keeps the primary colour after a wrong answer', async () => {
    const { StyleSheet } = require('react-native');
    const { color } = require('@prepio/shared');
    await renderQ(single);
    await fireEvent.press(screen.getByText('Varianta A'));
    await fireEvent.press(verify());
    const face = within(bar().getByRole('button', { name: 'Următoarea întrebare' })).getByTestId('button-face');
    expect(StyleSheet.flatten(face.props.style).backgroundColor).toBe(color.primary);
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

describe('reveal and verdict edge cases', () => {
  it('shows the verdict only (no "see above" hint) when no option is marked correct', async () => {
    const broken: Question = { ...single, explanation: null, options: [{ id: 'a', text: 'Prima', correct: false }, { id: 'b', text: 'A doua', correct: false }] } as Question;
    await renderQ(broken);
    await fireEvent.press(screen.getByText('Prima'));
    await fireEvent.press(verify());
    expect(screen.getByText('Nu chiar.')).toBeTruthy();
    expect(screen.queryByText('Vezi răspunsul corect mai sus.')).toBeNull();
  });

  it('scrolls so the reveal lands 12 px under the top bar (content top padding 12, gap 12)', async () => {
    const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => {});
    try {
      await renderQ(single);
      await fireEvent.press(screen.getByText('Varianta A'));
      await fireEvent.press(verify());
      let node: any = within(screen.getByTestId('screen-content')).getByText('Explicația pe larg aici. A doua frază.');
      while (node && typeof node.props.onLayout !== 'function') node = node.parent;
      await fireEvent(node, 'layout', { nativeEvent: { layout: { x: 0, y: 300, width: 320, height: 100 } } });
      expect(scrollTo).toHaveBeenCalledWith({ y: 300, animated: true });
    } finally {
      scrollTo.mockRestore();
    }
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
    // The correct options are marked in the list; the bar points at them.
    expect(screen.queryByText('Răspunsuri corecte: Alfa; Gama')).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Gama, corect' })).toBeTruthy();
    expect(bar().getByText('Vezi răspunsul corect mai sus.')).toBeTruthy();
  });

  it('tells the student to pick every correct option', async () => {
    await renderQ(multi);
    expect(screen.getByText('Alege toate variantele corecte.')).toBeTruthy();
    await screen.rerender(wrap(<QuestionView question={single} onAnswered={jest.fn()} frame={frame} />));
    expect(screen.queryByText('Alege toate variantele corecte.')).toBeNull();
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
    expect(content.getByText('Explicația pe larg aici. A doua frază.')).toBeTruthy();
    expect(onAnswered).toHaveBeenCalledWith(false);
    // Each row says whether it is in place.
    expect(screen.getByLabelText('1. Al treilea, poziție greșită')).toBeTruthy();
  });
});

describe('keyboard on the web', () => {
  const { Platform } = require('react-native');
  const original = Platform.OS;
  let listeners: ((e: unknown) => void)[] = [];
  beforeEach(() => {
    listeners = [];
    Platform.OS = 'web';
    (globalThis as unknown as { window: unknown }).window = {
      addEventListener: (_: string, l: (e: unknown) => void) => listeners.push(l),
      removeEventListener: (_: string, l: (e: unknown) => void) => (listeners = listeners.filter((x) => x !== l)),
    };
  });
  afterEach(() => {
    Platform.OS = original;
    delete (globalThis as unknown as { window?: unknown }).window;
  });
  const key = (k: string) =>
    act(async () => listeners.forEach((l) => l({ key: k, ctrlKey: false, metaKey: false, altKey: false, target: null, preventDefault: () => {} })));

  it('B picks the second option, Enter checks, Enter again goes on', async () => {
    const { onAnswered, onNext } = await renderQ(single);
    await key('b');
    await key('Enter');
    expect(onAnswered).toHaveBeenCalledWith(true);
    await key('Enter');
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('number keys toggle multiple-choice options', async () => {
    const { onAnswered } = await renderQ(multi);
    await key('1');
    await key('3');
    await key('Enter');
    expect(onAnswered).toHaveBeenCalledWith(true);
  });

  it('Enter does nothing before an option is picked', async () => {
    const { onAnswered } = await renderQ(single);
    await key('Enter');
    expect(onAnswered).not.toHaveBeenCalled();
  });
});
