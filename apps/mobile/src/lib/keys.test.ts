import { cardKey, choiceKey, ignoresKeys } from './keys';

const ev = (key: string, over: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean; target: unknown }> = {}) => ({
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  target: { tagName: 'DIV', isContentEditable: false },
  ...over,
});

describe('ignoresKeys', () => {
  it('lets typing in fields and shortcuts with modifiers through', () => {
    expect(ignoresKeys(ev('a', { target: { tagName: 'INPUT' } }))).toBe(true);
    expect(ignoresKeys(ev('a', { target: { tagName: 'TEXTAREA' } }))).toBe(true);
    expect(ignoresKeys(ev('a', { target: { tagName: 'DIV', isContentEditable: true } }))).toBe(true);
    expect(ignoresKeys(ev('ArrowRight', { altKey: true }))).toBe(true);
    expect(ignoresKeys(ev('r', { ctrlKey: true }))).toBe(true);
    expect(ignoresKeys(ev('ArrowRight'))).toBe(false);
  });
});

describe('cardKey', () => {
  it('arrows move between cards', () => {
    expect(cardKey(ev('ArrowRight'))).toBe('next');
    expect(cardKey(ev('ArrowLeft'))).toBe('prev');
    expect(cardKey(ev('Enter'))).toBeNull();
    expect(cardKey(ev('ArrowRight', { target: { tagName: 'INPUT' } }))).toBeNull();
  });
});

describe('choiceKey', () => {
  it('1–9 and A–I pick an option, Enter confirms', () => {
    expect(choiceKey(ev('1'), 4)).toEqual({ pick: 0 });
    expect(choiceKey(ev('4'), 4)).toEqual({ pick: 3 });
    expect(choiceKey(ev('b'), 4)).toEqual({ pick: 1 });
    expect(choiceKey(ev('D'), 4)).toEqual({ pick: 3 });
    expect(choiceKey(ev('Enter'), 4)).toEqual({ enter: true });
  });

  it('ignores keys past the options and in fields', () => {
    expect(choiceKey(ev('5'), 4)).toBeNull();
    expect(choiceKey(ev('e'), 4)).toBeNull();
    expect(choiceKey(ev('1', { target: { tagName: 'INPUT' } }), 4)).toBeNull();
  });
});
