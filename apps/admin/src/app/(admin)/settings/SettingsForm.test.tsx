// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./actions', () => ({ saveSettings: vi.fn() }));

import SettingsForm from './SettingsForm';

afterEach(cleanup);

describe('SettingsForm', () => {
  it('labels the AI rules „Reguli generale” with the help text', () => {
    render(<SettingsForm initial={{ welcomeMessage: 'Salut', rules: 'Fii amabil', model: 'gpt-5-mini', bacRules: 'Fii strict' }} />);
    expect((screen.getByLabelText('Reguli generale') as HTMLTextAreaElement).value).toBe('Fii amabil');
    expect(screen.getByText(/Reguli valabile pentru orice exercițiu evaluat cu AI/).textContent).toContain('stau în Șabloane AI.');
  });

  it('shows „Reguli de notare BAC” with its help text', () => {
    render(<SettingsForm initial={{ welcomeMessage: 'Salut', rules: 'R', model: 'gpt-5-mini', bacRules: 'Fii strict' }} />);
    expect((screen.getByLabelText('Reguli de notare BAC') as HTMLTextAreaElement).value).toBe('Fii strict');
    expect(screen.getByText('Instrucțiuni pentru corectorul subiectelor BAC (strictețe, reguli generale de barem).')).toBeTruthy();
  });
});
