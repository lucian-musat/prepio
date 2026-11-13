// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UiTextRow } from '@/lib/data/uiTexts';

vi.mock('./actions', () => ({ saveUiTextAction: vi.fn(), resetUiTextAction: vi.fn() }));

import TextsTable from './TextsTable';

afterEach(cleanup);

const base = { vars: [] as string[], optional: false, updatedAt: null, updatedBy: null, orphan: false, value: null };
const rows: UiTextRow[] = [
  { ...base, key: 'home.hero.welcome', group: 'home', defaultText: 'Bine ai venit! Alege o lecție din programă.', optional: true },
  { ...base, key: 'access.banner.title', group: 'access', defaultText: 'Accesul meu', value: 'Accesul tău', updatedAt: '2026-11-13T10:00:00Z', updatedBy: 'admin@prepio.local' },
  { ...base, key: 'old.gone', group: null, defaultText: null, value: 'vechi', orphan: true },
];

describe('TextsTable', () => {
  it('searches without regard to case or diacritics', () => {
    render(<TextsTable initial={rows} />);
    fireEvent.change(screen.getByLabelText('Caută'), { target: { value: 'LECTIE din programa' } });
    expect(screen.getByText('home.hero.welcome')).toBeTruthy();
    expect(screen.queryByText('access.banner.title')).toBeNull();
    fireEvent.change(screen.getByLabelText('Caută'), { target: { value: 'accesul meu' } });
    expect(screen.getByText('access.banner.title')).toBeTruthy();
    expect(screen.queryByText('home.hero.welcome')).toBeNull();
  });

  it('filters by group', () => {
    render(<TextsTable initial={rows} />);
    fireEvent.change(screen.getByLabelText('Grup'), { target: { value: 'access' } });
    expect(screen.getByText('access.banner.title')).toBeTruthy();
    expect(screen.queryByText('home.hero.welcome')).toBeNull();
  });

  it('shows only modified texts on demand and marks them', () => {
    render(<TextsTable initial={rows} />);
    expect(screen.getByText('home.hero.welcome')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Doar modificate'));
    expect(screen.queryByText('home.hero.welcome')).toBeNull();
    expect(screen.getByText('access.banner.title')).toBeTruthy();
    expect(screen.getByText('modificat')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Revino la implicit' })).toBeTruthy();
  });

  it('lists orphans separately with a delete button', () => {
    render(<TextsTable initial={rows} />);
    expect(screen.getByText('Texte care nu mai există în aplicație')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Șterge' })).toBeTruthy();
  });
});
