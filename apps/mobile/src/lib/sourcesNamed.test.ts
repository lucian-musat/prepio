import { pointsTail, sourcesNamedIn } from './sourcesNamed';

describe('sourcesNamedIn', () => {
  it('finds the source a requirement names', () => {
    expect(sourcesNamedIn('Numiți noua constituție precizată în sursa B.')).toEqual(['B']);
    expect(sourcesNamedIn('Precizați, din sursa A, o informație')).toEqual(['A']);
    expect(sourcesNamedIn('Menționați, din sursele A și B, două fapte')).toEqual(['A', 'B']);
  });

  it('names nothing for „sursa dată” or no source', () => {
    expect(sourcesNamedIn('Formulați, pe baza sursei date, un punct de vedere')).toEqual([]);
    expect(sourcesNamedIn('Elaborați un eseu despre statul român modern.')).toEqual([]);
  });
});

describe('pointsTail', () => {
  it('never lets the points word wrap alone', () => {
    expect(pointsTail(2)).toBe('· 2 puncte');
    expect(pointsTail(1)).toBe('· 1 punct');
    expect(pointsTail(30)).toBe('· 30 de puncte');
  });
});
