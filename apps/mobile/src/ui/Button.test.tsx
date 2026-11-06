import { Platform, StyleSheet } from 'react-native';
import { color } from '@prepio/shared';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Button from './Button';

it('calls onPress once per press', async () => {
  const onPress = jest.fn();
  await render(<Button label="Verifică" onPress={onPress} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Verifică' }));
  expect(onPress).toHaveBeenCalledTimes(1);
});

it('does not call onPress when disabled', async () => {
  const onPress = jest.fn();
  await render(<Button label="Verifică" onPress={onPress} disabled />);
  const button = screen.getByRole('button', { name: 'Verifică' });
  expect(button.props.accessibilityState).toMatchObject({ disabled: true });
  await fireEvent.press(button);
  expect(onPress).not.toHaveBeenCalled();
});

it('does not call onPress while loading', async () => {
  const onPress = jest.fn();
  await render(<Button label="Se evaluează…" onPress={onPress} loading />);
  const button = screen.getByRole('button', { name: 'Se evaluează…' });
  expect(button.props.accessibilityState).toMatchObject({ busy: true });
  await fireEvent.press(button);
  expect(onPress).not.toHaveBeenCalled();
});

it('uses accessibilityLabel as the accessible name when given, keeping the visible label', async () => {
  await render(<Button label="Înapoi" accessibilityLabel="Înapoi la cartonașul anterior" onPress={jest.fn()} />);
  expect(screen.getByRole('button', { name: 'Înapoi la cartonașul anterior' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Înapoi' })).toBeNull();
  expect(screen.getByText('Înapoi')).toBeTruthy();
});

it('secondary button face turns surfaceMuted on hover (prototype `.btn.ghost:hover`)', async () => {
  await render(<Button variant="secondary" label="Înapoi" onPress={jest.fn()} />);
  const button = screen.getByRole('button', { name: 'Înapoi' });
  const faceBg = () => StyleSheet.flatten(screen.getByTestId('button-face').props.style).backgroundColor;
  expect(faceBg()).toBe(color.surface);
  await fireEvent(button, 'hoverIn');
  expect(faceBg()).toBe(color.surfaceMuted);
  await fireEvent(button, 'hoverOut');
  expect(faceBg()).toBe(color.surface);
});

it('primary button face brightens 5 % on hover on web (prototype `.btn:hover`)', async () => {
  const os = Platform.OS;
  Platform.OS = 'web';
  try {
    await render(<Button label="Verifică" onPress={jest.fn()} />);
    const filter = () => (StyleSheet.flatten(screen.getByTestId('button-face').props.style) as { filter?: string }).filter;
    expect(filter()).toBeUndefined();
    await fireEvent(screen.getByRole('button', { name: 'Verifică' }), 'hoverIn');
    expect(filter()).toBe('brightness(1.05)');
    await fireEvent(screen.getByRole('button', { name: 'Verifică' }), 'hoverOut');
    expect(filter()).toBeUndefined();
  } finally {
    Platform.OS = os;
  }
});

const padding = () => StyleSheet.flatten(screen.getByTestId('button-face').props.style).paddingHorizontal;

it('an icon-only button is named by its accessibilityLabel and has the compact padding', async () => {
  await render(<Button icon="back" accessibilityLabel="Exercițiul anterior" variant="secondary" onPress={jest.fn()} />);
  expect(screen.getByRole('button', { name: 'Exercițiul anterior' })).toBeTruthy();
  expect(screen.getByTestId('button-icon')).toBeTruthy();
  expect(padding()).toBe(12);
});

it('compact narrows the side padding of a labelled button', async () => {
  await render(<Button label="Sari peste" onPress={jest.fn()} />);
  expect(padding()).toBe(18);
  await render(<Button label="Sari peste" compact onPress={jest.fn()} />);
  expect(padding()).toBe(12);
});
