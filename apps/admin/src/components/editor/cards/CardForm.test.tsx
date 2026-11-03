// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Card } from '@prepio/shared';
import type { ActionResult } from '@/lib/actionResult';
import type { CardInput } from '@/lib/data/lesson';
import CardForm from './CardForm';

const upload = vi.hoisted(() => vi.fn());
vi.mock('@/app/(admin)/lessons/[id]/actions', () => ({ uploadCardImage: upload }));

afterEach(() => {
  cleanup();
  upload.mockReset();
});

type Save = (c: CardInput) => Promise<ActionResult<unknown>>;

function setup(initial?: Card, onSave = vi.fn<Save>(async () => ({ ok: true }))) {
  const user = userEvent.setup();
  render(<CardForm lessonId="l1" initial={initial} onSave={onSave} onCancel={() => {}} />);
  return { user, onSave };
}

const textBox = () => screen.getByRole('textbox', { name: 'Text' }) as HTMLTextAreaElement;
const altValues = () => screen.getAllByLabelText('Descriere (alt)').map((el) => (el as HTMLInputElement).value);

const imagesCard = (alts: string[]): Card => ({
  id: 'c1', position: 0, title: 'Hărți', type: 'images', display: 'single', text: null,
  images: alts.map((alt, i) => ({ path: `lessons/l1/img${i}.png`, alt, credit: null })),
});

describe('CardForm', () => {
  it('new cards default to text; the type picker switches the fields', async () => {
    const { user } = setup();
    expect(screen.getByRole('radiogroup', { name: 'Tipul cardului' })).toBeTruthy();
    expect((screen.getByRole('radio', { name: 'Text' }) as HTMLInputElement).checked).toBe(true);
    expect(textBox()).toBeTruthy();
    await user.click(screen.getByRole('radio', { name: 'Imagini' }));
    // empty fields: no confirm needed
    expect(screen.queryByText(/Schimbi tipul\?/)).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Text' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Adaugă imagini' })).toBeTruthy();
    expect(screen.getByLabelText('Galerie')).toBeTruthy();
  });

  it('asks before discarding non-empty fields and keeps the title', async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText('Titlu (opțional)'), 'Unirea');
    await user.type(textBox(), 'Conținut');
    await user.click(screen.getByRole('radio', { name: 'Imagini' }));
    expect(screen.getByText('Schimbi tipul? Conținutul specific tipului actual se va pierde.')).toBeTruthy();
    await user.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Anulează' }));
    expect(screen.queryByText(/Schimbi tipul\?/)).toBeNull();
    expect(textBox().value).toBe('Conținut');

    await user.click(screen.getByRole('radio', { name: 'Imagini' }));
    await user.click(screen.getByRole('button', { name: 'Schimbă tipul' }));
    expect(screen.queryByRole('textbox', { name: 'Text' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Adaugă imagini' })).toBeTruthy();
    expect((screen.getByLabelText('Titlu (opțional)') as HTMLInputElement).value).toBe('Unirea');
  });

  it('toolbar B wraps the selection in **', async () => {
    const { user } = setup();
    await user.type(textBox(), 'salut lume');
    textBox().setSelectionRange(6, 10);
    await user.click(screen.getByRole('button', { name: 'B' }));
    expect(textBox().value).toBe('salut **lume**');
  });

  it('list and callout buttons work on the current lines', async () => {
    const { user } = setup();
    await user.type(textBox(), 'unu{enter}doi');
    textBox().setSelectionRange(0, 7);
    await user.click(screen.getByRole('button', { name: 'Listă numerotată' }));
    expect(textBox().value).toBe('1. unu\n2. doi');
    textBox().setSelectionRange(0, 0);
    await user.click(screen.getByRole('button', { name: 'De reținut' }));
    expect(textBox().value).toBe(':::retine\n1. unu\n:::\n2. doi');
  });

  it('saves a text card and shows server errors', async () => {
    const onSave = vi.fn<Save>(async () => ({ ok: false, error: 'Eroare de server.' }));
    const { user } = setup(undefined, onSave);
    await user.type(textBox(), 'Text simplu');
    await user.click(screen.getByRole('button', { name: 'Salvează' }));
    expect(onSave).toHaveBeenCalledWith({ title: null, type: 'text', text: 'Text simplu' });
    expect(await screen.findByText('Eroare de server.')).toBeTruthy();
  });

  it('shows validation errors only after a save attempt', async () => {
    const { user, onSave } = setup(imagesCard(['']));
    expect(screen.queryByText('Imaginea 1: descrierea nu poate fi goală.')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Salvează' }));
    const message = screen.getByText('Imaginea 1: descrierea nu poate fi goală.');
    expect(document.activeElement).toBe(message.closest('[role="alert"]'));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('reorders and removes images with the buttons', async () => {
    const { user, onSave } = setup(imagesCard(['Prima', 'A doua']));
    expect(altValues()).toEqual(['Prima', 'A doua']);
    await user.click(screen.getByRole('button', { name: 'Mută jos imaginea 1' }));
    expect(altValues()).toEqual(['A doua', 'Prima']);
    expect((screen.getByRole('button', { name: 'Mută sus imaginea 1' }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Șterge imaginea 2' }));
    expect(altValues()).toEqual(['A doua']);
    await user.click(screen.getByRole('button', { name: 'Salvează' }));
    expect(onSave.mock.calls[0][0]).toMatchObject({
      id: 'c1', type: 'images', images: [{ path: 'lessons/l1/img1.png', alt: 'A doua', credit: null }],
    });
  });

  it('renders images sharing a path without duplicate React keys', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const card = imagesCard(['A', 'B']);
    if (card.type === 'images') card.images[1].path = card.images[0].path;
    setup(card);
    expect(altValues()).toEqual(['A', 'B']);
    expect(error.mock.calls.some((c) => String(c[0]).includes('same key'))).toBe(false);
    error.mockRestore();
  });

  it('blocks saving while an upload is in flight', async () => {
    let finish: (v: ActionResult<{ path: string }>) => void = () => {};
    upload.mockReturnValue(new Promise((r) => { finish = r; }));
    const { user, onSave } = setup(imagesCard([]));
    await user.upload(screen.getByLabelText('Încarcă imagini'), new File(['x'], 'harta.png', { type: 'image/png' }));
    const save = screen.getByRole('button', { name: 'Salvează' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(screen.getByText('Se încarcă imaginile…')).toBeTruthy();
    await user.type(screen.getByLabelText('Titlu (opțional)'), 'X{enter}');
    fireEvent.submit(screen.getByTestId('card-form'));
    expect(onSave).not.toHaveBeenCalled();

    await act(async () => finish({ ok: true, data: { path: 'lessons/l1/new.png' } }));
    expect(save.disabled).toBe(false);
    expect(screen.queryByText('Se încarcă imaginile…')).toBeNull();
    await user.type(screen.getByLabelText('Descriere (alt)'), 'Harta');
    await user.click(save);
    expect(onSave.mock.calls[0][0]).toMatchObject({ title: 'HărțiX', images: [{ path: 'lessons/l1/new.png', alt: 'Harta' }] });
  });

  it('uploads images and adds them to the card', async () => {
    upload.mockResolvedValue({ ok: true, data: { path: 'lessons/l1/new.png' } });
    const { user, onSave } = setup(imagesCard([]));
    await user.upload(screen.getByLabelText('Încarcă imagini'), new File(['x'], 'harta.png', { type: 'image/png' }));
    expect(upload).toHaveBeenCalledWith('l1', expect.any(FormData));
    await user.type(await screen.findByLabelText('Descriere (alt)'), 'Harta României');
    await user.type(screen.getByLabelText('Sursa / creditul imaginii'), 'Wikimedia');
    await user.click(screen.getByLabelText('Galerie'));
    await user.click(screen.getByRole('button', { name: 'Salvează' }));
    expect(onSave.mock.calls[0][0]).toMatchObject({
      type: 'images', display: 'gallery',
      images: [{ path: 'lessons/l1/new.png', alt: 'Harta României', credit: 'Wikimedia' }],
    });
  });
});
