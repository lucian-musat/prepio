// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UiTextRow } from '@/lib/data/uiTexts';
import TextEditModal from './TextEditModal';

afterEach(cleanup);

const base = { group: 'home', updatedAt: null, updatedBy: null, orphan: false, value: null } as const;
const named: UiTextRow = { ...base, key: 'home.hero.welcomeBack', defaultText: 'Bine ai revenit, {nume}!', vars: ['nume'], optional: false, description: 'Salut' };
const optional: UiTextRow = { ...base, key: 'home.hero.welcome', defaultText: 'Bun venit', vars: [], optional: true };

const setup = (row: UiTextRow, onSave = vi.fn()) => {
  render(<TextEditModal row={row} pending={false} error={null} onSave={onSave} onClose={() => {}} />);
  return {
    onSave,
    box: screen.getByLabelText('Text') as HTMLTextAreaElement,
    save: screen.getByRole('button', { name: 'Salvează' }) as HTMLButtonElement,
  };
};

describe('TextEditModal', () => {
  it('shows the key and variable chips; save is disabled while unchanged', () => {
    const { save } = setup(named);
    expect(screen.getByText('home.hero.welcomeBack')).toBeTruthy();
    expect(screen.getByText('{nume}')).toBeTruthy();
    expect(save.disabled).toBe(true);
  });

  it('shows the message and disables save when a variable is removed', () => {
    const { box, save } = setup(named);
    fireEvent.change(box, { target: { value: 'Salut!' } });
    expect(screen.getByRole('alert').textContent).toContain('Lipsește variabila {nume}');
    expect(save.disabled).toBe(true);
  });

  it('saves a valid change', () => {
    const { box, save, onSave } = setup(named);
    fireEvent.change(box, { target: { value: 'Salut, {nume}!' } });
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledWith('Salut, {nume}!');
  });

  it('accepts an empty value for an optional key', () => {
    const { box, save } = setup(optional);
    expect(screen.getByText('Lasă gol ca să ascunzi textul.')).toBeTruthy();
    fireEvent.change(box, { target: { value: '' } });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(save.disabled).toBe(false);
  });
});
