import { fireEvent, render, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import type { Question } from '@prepio/shared';
import QuestionView from './QuestionView';

const base = { id: 'q', position: 1, prompt: 'Întrebare?', difficulty: 'medium' as const, explanation: 'Explicația.' };
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

const renderQ = async (q: Question) => {
  const onAnswered = jest.fn();
  const onNext = jest.fn();
  await render(
    <PaperProvider>
      <QuestionView question={q} onAnswered={onAnswered} onNext={onNext} />
    </PaperProvider>,
  );
  return { onAnswered, onNext };
};
const verify = () => screen.getByRole('button', { name: 'Verifică' });
const isDisabled = (el: any) => !!el.props.accessibilityState?.disabled || !!el.props['aria-disabled'];

it('shows the difficulty badge', async () => {
  await renderQ(single);
  expect(screen.getByText('mediu')).toBeTruthy();
});

describe('single choice', () => {
  it('Verifică is disabled until a selection exists', async () => {
    await renderQ(single);
    expect(isDisabled(verify())).toBe(true);
    await fireEvent.press(screen.getByText('Varianta A'));
    expect(isDisabled(verify())).toBe(false);
  });

  it('correct answer shows Corect! and explanation', async () => {
    const { onAnswered, onNext } = await renderQ(single);
    await fireEvent.press(screen.getByText('Varianta B'));
    await fireEvent.press(verify());
    expect(screen.getByText('Corect!')).toBeTruthy();
    expect(screen.getByText('Explicația.')).toBeTruthy();
    expect(onAnswered).toHaveBeenCalledWith(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Următoarea întrebare' }));
    expect(onNext).toHaveBeenCalled();
  });

  it('wrong answer shows Greșit, the correct answer and explanation', async () => {
    const { onAnswered } = await renderQ(single);
    await fireEvent.press(screen.getByText('Varianta A'));
    await fireEvent.press(verify());
    expect(screen.getByText('Greșit')).toBeTruthy();
    expect(screen.getByText('Răspuns corect: Varianta B')).toBeTruthy();
    expect(screen.getByText('Explicația.')).toBeTruthy();
    expect(onAnswered).toHaveBeenCalledWith(false);
  });
});

describe('multiple choice', () => {
  it('needs a selection; all correct options -> Corect!', async () => {
    const { onAnswered } = await renderQ(multi);
    expect(isDisabled(verify())).toBe(true);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Alfa' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Gama' }));
    await fireEvent.press(verify());
    expect(screen.getByText('Corect!')).toBeTruthy();
    expect(onAnswered).toHaveBeenCalledWith(true);
  });

  it('partial selection -> Greșit with the correct answers', async () => {
    await renderQ(multi);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Alfa' }));
    await fireEvent.press(verify());
    expect(screen.getByText('Greșit')).toBeTruthy();
    expect(screen.getByText('Răspunsuri corecte: Alfa; Gama')).toBeTruthy();
  });
});

describe('chronological order', () => {
  const texts = () => screen.getAllByTestId('order-item-text').map((n) => n.props.children);
  const target = ['Primul', 'Al doilea', 'Al treilea'];

  it('initial order differs from the correct order', async () => {
    await renderQ(order);
    expect(texts()).not.toEqual(target);
  });

  it('up/down buttons reorder; correct order -> Corect!', async () => {
    const { onAnswered } = await renderQ(order);
    for (let pass = 0; pass < 5; pass++) {
      const i = texts().findIndex((t, idx) => t !== target[idx]);
      if (i === -1) break;
      await fireEvent.press(screen.getByLabelText(`Mută în sus: ${target[i]}`));
    }
    expect(texts()).toEqual(target);
    await fireEvent.press(verify());
    expect(screen.getByText('Corect!')).toBeTruthy();
    expect(onAnswered).toHaveBeenCalledWith(true);
  });

  it('wrong order -> Greșit with the correct sequence and year labels', async () => {
    const { onAnswered } = await renderQ(order);
    for (let k = 0; k < 3 && texts()[0] !== 'Al treilea'; k++) {
      await fireEvent.press(screen.getByLabelText('Mută în sus: Al treilea'));
    }
    expect(texts()[0]).toBe('Al treilea');
    await fireEvent.press(verify());
    expect(screen.getByText('Greșit')).toBeTruthy();
    expect(screen.getByText('1000')).toBeTruthy();
    expect(screen.getByText('1200')).toBeTruthy();
    expect(screen.getByText('Explicația.')).toBeTruthy();
    expect(onAnswered).toHaveBeenCalledWith(false);
  });
});
