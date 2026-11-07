// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./actions', () => ({ saveSettings: vi.fn() }));

import SettingsForm from './SettingsForm';

afterEach(cleanup);

describe('SettingsForm', () => {
  it('labels the AI rules „Reguli generale” with the help text', () => {
    render(<SettingsForm initial={{ welcomeMessage: 'Salut', rules: 'Fii amabil', model: 'gpt-5-mini' }} />);
    expect((screen.getByLabelText('Reguli generale') as HTMLTextAreaElement).value).toBe('Fii amabil');
    expect(screen.getByText(/Reguli valabile pentru orice exercițiu evaluat cu AI/).textContent).toContain('stau în Șabloane AI.');
  });
});
