// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PREVIEW_READY_MESSAGE } from '@prepio/shared';
import type { CardInput } from '@/lib/data/lesson';
import CardPreview from './CardPreview';

const URL_ = 'http://localhost:8081';
const UNAVAILABLE = 'Previzualizarea nu este disponibilă. Poți salva cardul în continuare.';

const draft = (text: string): CardInput => ({ title: 'Unirea', type: 'text', text });

/** Replaces the iframe's window with a fake that records postMessage calls. */
function fakeWindow() {
  const iframe = screen.getByTitle('Previzualizare card') as HTMLIFrameElement;
  const win = { postMessage: vi.fn() };
  Object.defineProperty(iframe, 'contentWindow', { configurable: true, get: () => win });
  return win;
}

function message(data: unknown, origin: string, source: unknown) {
  const ev = new MessageEvent('message', { data, origin });
  Object.defineProperty(ev, 'source', { value: source });
  act(() => {
    window.dispatchEvent(ev);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv('NEXT_PUBLIC_STUDENT_WEB_URL', URL_);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('CardPreview', () => {
  it('embeds the student /preview page', () => {
    render(<CardPreview draft={draft('a')} index={0} total={1} />);
    expect(screen.getByTitle('Previzualizare card').getAttribute('src')).toBe(`${URL_}/preview`);
    expect(screen.getByRole('radio', { name: /Telefon/ })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Desktop/ })).toBeTruthy();
  });

  it('posts the card on ready, then once 150 ms after a change, to the student origin', () => {
    const { rerender } = render(<CardPreview draft={draft('a')} index={1} total={3} />);
    const win = fakeWindow();
    expect(win.postMessage).not.toHaveBeenCalled();

    message(PREVIEW_READY_MESSAGE, URL_, win);
    expect(win.postMessage).toHaveBeenCalledTimes(1);
    expect(win.postMessage).toHaveBeenLastCalledWith(
      { source: 'prepio-admin', kind: 'card', card: { ...draft('a'), id: 'preview', position: 1 }, index: 1, total: 3 },
      URL_,
    );

    rerender(<CardPreview draft={draft('ab')} index={1} total={3} />);
    rerender(<CardPreview draft={draft('abc')} index={1} total={3} />);
    act(() => vi.advanceTimersByTime(149));
    expect(win.postMessage).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(1));
    expect(win.postMessage).toHaveBeenCalledTimes(2);
    expect(win.postMessage.mock.lastCall?.[0].card.text).toBe('abc');
    act(() => vi.advanceTimersByTime(1000));
    expect(win.postMessage).toHaveBeenCalledTimes(2);
  });

  it('keeps a saved card id', () => {
    render(<CardPreview draft={{ ...draft('a'), id: 'c9' }} index={0} total={1} />);
    const win = fakeWindow();
    message(PREVIEW_READY_MESSAGE, URL_, win);
    expect(win.postMessage.mock.lastCall?.[0].card.id).toBe('c9');
  });

  it('ignores ready from another origin or another window', () => {
    const { rerender } = render(<CardPreview draft={draft('a')} index={0} total={1} />);
    const win = fakeWindow();
    message(PREVIEW_READY_MESSAGE, 'http://evil.example', win);
    message(PREVIEW_READY_MESSAGE, URL_, { postMessage: vi.fn() });
    message({ source: 'prepio-preview', kind: 'other' }, URL_, win);
    expect(win.postMessage).not.toHaveBeenCalled();
    // not ready: changes are not posted either
    rerender(<CardPreview draft={draft('ab')} index={0} total={1} />);
    act(() => vi.advanceTimersByTime(500));
    expect(win.postMessage).not.toHaveBeenCalled();
  });

  it('shows the unavailable alert when no ready arrives within 8 s', () => {
    render(<CardPreview draft={draft('a')} index={0} total={1} />);
    act(() => vi.advanceTimersByTime(7999));
    expect(screen.queryByText(UNAVAILABLE)).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText(UNAVAILABLE)).toBeTruthy();
  });

  it('a ready clears the timeout', () => {
    render(<CardPreview draft={draft('a')} index={0} total={1} />);
    const win = fakeWindow();
    message(PREVIEW_READY_MESSAGE, URL_, win);
    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.queryByText(UNAVAILABLE)).toBeNull();
  });

  it('shows the unavailable alert and no iframe when the env is missing', () => {
    vi.stubEnv('NEXT_PUBLIC_STUDENT_WEB_URL', '');
    render(<CardPreview draft={draft('a')} index={0} total={1} />);
    expect(screen.getByText(UNAVAILABLE)).toBeTruthy();
    expect(screen.queryByTitle('Previzualizare card')).toBeNull();
  });
});
