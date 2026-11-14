import { describe, expect, it } from 'vitest';
import { parseRichText } from './richText';

describe('parseRichText', () => {
  it('returns [] for empty input', () => {
    expect(parseRichText('')).toEqual([]);
  });

  it('splits paragraphs on blank lines and keeps \\n inside one', () => {
    expect(parseRichText('One\ntwo\n\nThree')).toEqual([
      { kind: 'paragraph', spans: [{ text: 'One\ntwo' }] },
      { kind: 'paragraph', spans: [{ text: 'Three' }] },
    ]);
    expect(parseRichText('A\r\n\r\nB')).toHaveLength(2);
  });

  it('parses heading, bullet list and ordered list', () => {
    expect(parseRichText('### Titlu\n- a\n- b\n1. x\n2. y')).toEqual([
      { kind: 'heading', spans: [{ text: 'Titlu' }] },
      { kind: 'list', ordered: false, items: [[{ text: 'a' }], [{ text: 'b' }]] },
      { kind: 'list', ordered: true, items: [[{ text: 'x' }], [{ text: 'y' }]] },
    ]);
  });

  it('parses bold and italic spans', () => {
    expect(parseRichText('**Alba Iulia** a fost *decisivă*')).toEqual([
      {
        kind: 'paragraph',
        spans: [{ text: 'Alba Iulia', bold: true }, { text: ' a fost ' }, { text: 'decisivă', italic: true }],
      },
    ]);
  });

  it('keeps unmatched markers literal', () => {
    expect(parseRichText('2 * 3')).toEqual([{ kind: 'paragraph', spans: [{ text: '2 * 3' }] }]);
    expect(parseRichText('2 * 3 * 4')).toEqual([{ kind: 'paragraph', spans: [{ text: '2 * 3 * 4' }] }]);
    expect(parseRichText('**open')).toEqual([{ kind: 'paragraph', spans: [{ text: '**open' }] }]);
  });

  it('treats ***x*** as bold wrapping a literal star (documented behaviour)', () => {
    expect(parseRichText('***x***')).toEqual([
      { kind: 'paragraph', spans: [{ text: '*x', bold: true }, { text: '*' }] },
    ]);
  });

  it('never interprets HTML', () => {
    expect(parseRichText('<script>x</script>')).toEqual([
      { kind: 'paragraph', spans: [{ text: '<script>x</script>' }] },
    ]);
  });

  it('parses callouts', () => {
    expect(parseRichText(':::retine\nText\n:::')).toEqual([
      { kind: 'callout', variant: 'retine', blocks: [{ kind: 'paragraph', spans: [{ text: 'Text' }] }] },
    ]);
  });

  it('runs an unclosed callout to the end', () => {
    expect(parseRichText('Intro\n:::atentie\n- a\nb')).toEqual([
      { kind: 'paragraph', spans: [{ text: 'Intro' }] },
      {
        kind: 'callout',
        variant: 'atentie',
        blocks: [
          { kind: 'list', ordered: false, items: [[{ text: 'a' }]] },
          { kind: 'paragraph', spans: [{ text: 'b' }] },
        ],
      },
    ]);
  });

  it('does not nest callouts: an opener inside is plain text', () => {
    expect(parseRichText(':::retine\n:::exemplu\nx\n:::')).toEqual([
      {
        kind: 'callout',
        variant: 'retine',
        blocks: [{ kind: 'paragraph', spans: [{ text: ':::exemplu\nx' }] }],
      },
    ]);
  });
});
