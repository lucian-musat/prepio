// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Card } from '@prepio/shared';
import type { ActionResult } from '@/lib/actionResult';
import type { CardInput } from '@/lib/data/lesson';
import CardForm from './CardForm';

const actions = vi.hoisted(() => ({ uploadCardImage: vi.fn(), fetchLinkMetadata: vi.fn() }));
vi.mock('@/app/(admin)/lessons/[id]/actions', () => actions);

afterEach(() => {
  cleanup();
  actions.uploadCardImage.mockReset();
  actions.fetchLinkMetadata.mockReset();
});

type Save = (c: CardInput) => Promise<ActionResult<unknown>>;

function setup(type: string, initial?: Card) {
  const user = userEvent.setup();
  const onSave = vi.fn<Save>(async () => ({ ok: true }));
  render(<CardForm lessonId="l1" initial={initial} onSave={onSave} onCancel={() => {}} />);
  return { user, onSave, pick: async () => user.click(screen.getByRole('radio', { name: type })) };
}

const value = (label: string) => (screen.getByLabelText(label) as HTMLInputElement).value;
const saveButton = () => screen.getByRole('button', { name: 'Salvează' }) as HTMLButtonElement;

describe('VideoFields', () => {
  it('recognises a YouTube link and shows the thumbnail', async () => {
    const { user, onSave, pick } = setup('Video');
    await pick();
    await user.type(screen.getByLabelText('Link YouTube'), 'https://youtu.be/dQw4w9WgXcQ');
    expect(screen.getByText('Video recunoscut ✓')).toBeTruthy();
    expect(document.querySelector('img')?.getAttribute('src')).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
    await user.type(screen.getByLabelText('Start (secunde)'), '30');
    await user.click(saveButton());
    expect(onSave).toHaveBeenCalledWith({
      title: null, type: 'video', youtubeId: 'dQw4w9WgXcQ', startSeconds: 30, endSeconds: null, text: null,
    });
  });

  it('shows an error for other hosts', async () => {
    const { user, pick } = setup('Video');
    await pick();
    await user.type(screen.getByLabelText('Link YouTube'), 'https://vimeo.com/12345');
    expect(screen.getByText('Linkul YouTube nu este valid.')).toBeTruthy();
    expect(screen.queryByText('Video recunoscut ✓')).toBeNull();
  });
});

describe('TimelineFields', () => {
  it('adds, edits, moves and removes points', async () => {
    const { user, pick } = setup('Axă cronologică');
    await pick();
    await user.click(screen.getByRole('button', { name: '+ Adaugă punct' }));
    await user.click(screen.getByRole('button', { name: '+ Adaugă punct' }));
    expect(screen.getAllByLabelText('Data')).toHaveLength(2);
    await user.type(screen.getAllByLabelText('Titlu')[0], 'Unirea');
    await user.type(screen.getAllByLabelText('Titlu')[1], 'Războiul');
    await user.click(screen.getAllByLabelText('Moment cheie ★')[1]);
    expect((screen.getAllByLabelText('Moment cheie ★')[1] as HTMLInputElement).checked).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Mută sus punctul 2' }));
    expect((screen.getAllByLabelText('Titlu')[0] as HTMLInputElement).value).toBe('Războiul');
    expect((screen.getAllByLabelText('Moment cheie ★')[0] as HTMLInputElement).checked).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Șterge punctul 1' }));
    expect(screen.getAllByLabelText('Titlu')).toHaveLength(1);
    expect(value('Titlu')).toBe('Unirea');
  });

  it('uploads a point image and blocks saving meanwhile', async () => {
    let finish: (v: ActionResult<{ path: string }>) => void = () => {};
    actions.uploadCardImage.mockReturnValue(new Promise((r) => { finish = r; }));
    const { user, pick } = setup('Axă cronologică');
    await pick();
    await user.click(screen.getByRole('button', { name: '+ Adaugă punct' }));
    await user.upload(screen.getByLabelText('Imagine punctul 1'), new File(['x'], 'a.png', { type: 'image/png' }));
    expect(saveButton().disabled).toBe(true);
    await act(async () => finish({ ok: true, data: { path: 'lessons/l1/p.png' } }));
    expect(saveButton().disabled).toBe(false);
    expect(screen.getByRole('button', { name: 'Elimină imaginea' })).toBeTruthy();
  });
});

describe('SchemaFields', () => {
  it('edits labels and boxes', async () => {
    const { user, onSave, pick } = setup('Schemă');
    await pick();
    expect(value('Etichetă secțiune (Cauze)')).toBe('Cauze');
    await user.clear(screen.getByLabelText('Etichetă secțiune (Cauze)'));
    await user.type(screen.getByLabelText('Etichetă secțiune (Cauze)'), 'Motive');
    await user.click(screen.getByRole('button', { name: '+ Adaugă cauză' }));
    await user.click(screen.getByRole('button', { name: '+ Adaugă urmare' }));
    const texts = screen.getAllByRole('textbox', { name: 'Text' }); // cause, central, consequence
    expect(texts).toHaveLength(3);
    await user.type(texts[0], 'Cauza 1');
    await user.type(texts[1], 'Marea Unire');
    await user.type(texts[2], 'Urmarea 1');
    await user.click(saveButton());
    const saved = onSave.mock.calls[0][0] as Extract<CardInput, { type: 'schema' }>;
    expect(saved.causesLabel).toBe('Motive');
    expect(saved.causes.map((b) => b.text)).toEqual(['Cauza 1']);
    expect(saved.central.text).toBe('Marea Unire');
    expect(saved.consequences.map((b) => b.text)).toEqual(['Urmarea 1']);
  });
});

describe('LinkFields', () => {
  const meta = { title: 'Pagina', description: 'Descriere pagină', imageUrl: 'https://x.test/i.png' };

  it('autofills empty fields from the page', async () => {
    actions.fetchLinkMetadata.mockResolvedValue({ ok: true, data: meta });
    const { user, pick } = setup('Link');
    await pick();
    await user.type(screen.getByLabelText('URL'), 'https://x.test');
    await user.click(screen.getByRole('button', { name: 'Completează automat' }));
    expect(actions.fetchLinkMetadata).toHaveBeenCalledWith('https://x.test');
    expect(await screen.findByDisplayValue('Pagina')).toBeTruthy();
    expect(value('Descriere')).toBe('Descriere pagină');
    expect(document.querySelector('img')?.getAttribute('src')).toBe('https://x.test/i.png');
  });

  it('asks before overwriting filled fields', async () => {
    actions.fetchLinkMetadata.mockResolvedValue({ ok: true, data: meta });
    const { user, pick } = setup('Link');
    await pick();
    await user.type(screen.getByLabelText('URL'), 'https://x.test');
    await user.type(screen.getByLabelText('Titlul paginii'), 'Titlul meu');
    await user.click(screen.getByRole('button', { name: 'Completează automat' }));
    const alert = await screen.findByRole('alert');
    expect(value('Titlul paginii')).toBe('Titlul meu');
    await user.click(within(alert).getByRole('button', { name: 'Anulează' }));
    expect(value('Titlul paginii')).toBe('Titlul meu');
    await user.click(screen.getByRole('button', { name: 'Completează automat' }));
    await user.click(within(await screen.findByRole('alert')).getByRole('button', { name: 'Înlocuiește' }));
    expect(value('Titlul paginii')).toBe('Pagina');
    expect(value('Descriere')).toBe('Descriere pagină');
  });

  it('shows the action error, keeps manual entry and blocks saving while fetching', async () => {
    let finish: (v: ActionResult<unknown>) => void = () => {};
    actions.fetchLinkMetadata.mockReturnValue(new Promise((r) => { finish = r; }));
    const { user, pick } = setup('Link');
    await pick();
    await user.type(screen.getByLabelText('URL'), 'https://x.test');
    await user.click(screen.getByRole('button', { name: 'Completează automat' }));
    expect(saveButton().disabled).toBe(true);
    await act(async () => finish({ ok: false, error: 'Pagina nu poate fi citită.' }));
    expect(screen.getByText('Pagina nu poate fi citită.')).toBeTruthy();
    expect(saveButton().disabled).toBe(false);
    await user.type(screen.getByLabelText('Titlul paginii'), 'Manual');
    expect(value('Titlul paginii')).toBe('Manual');
  });

  it('removes the preview image', async () => {
    actions.fetchLinkMetadata.mockResolvedValue({ ok: true, data: meta });
    const { user, pick } = setup('Link');
    await pick();
    await user.type(screen.getByLabelText('URL'), 'https://x.test');
    await user.click(screen.getByRole('button', { name: 'Completează automat' }));
    await user.click(await screen.findByRole('button', { name: 'Elimină imaginea' }));
    expect(document.querySelector('img')).toBeNull();
  });
});
