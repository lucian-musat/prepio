import { describe, expect, it } from 'vitest';
import { CAUSAL_CONNECTORS, CONCLUSION_CONNECTORS, detectConnectors } from './connectors';

describe('detectConnectors', () => {
  it('finds a conclusion connector at the start of a sentence', () => {
    expect(detectConnectors('Așadar, Cuza a realizat unirea.')).toEqual({ causal: false, conclusion: true });
  });
  it('is diacritic-insensitive', () => {
    expect(detectConnectors('Domnul a căzut pentru ca a fost slab.').causal).toBe(true);
    expect(detectConnectors('Pentru că a vrut.').causal).toBe(true);
    expect(detectConnectors('Asadar, in concluzie.').conclusion).toBe(true);
  });
  it('matches whole words only', () => {
    expect(detectConnectors('Deciziile au fost luate.').conclusion).toBe(false);
    expect(detectConnectors('Deci, a plecat.').conclusion).toBe(true);
  });
  it('matches multi-word phrases', () => {
    expect(detectConnectors('Prin urmare, legea s-a aplicat.').conclusion).toBe(true);
    expect(detectConnectors('Din cauza războiului, țara a suferit.').causal).toBe(true);
    expect(detectConnectors('Ca urmare, statul a primit pământ.').causal).toBe(true);
  });
  it('detects both and neither', () => {
    expect(detectConnectors('Deoarece a plouat, deci am rămas.')).toEqual({ causal: true, conclusion: true });
    expect(detectConnectors('Cuza a domnit.')).toEqual({ causal: false, conclusion: false });
    expect(detectConnectors('')).toEqual({ causal: false, conclusion: false });
  });
  it('exposes the lists', () => {
    expect(CAUSAL_CONNECTORS).toContain('pentru că');
    expect(CONCLUSION_CONNECTORS).toContain('așadar');
  });
});
