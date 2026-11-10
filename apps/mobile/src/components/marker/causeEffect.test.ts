import { DONE, ROLE, relationSentence } from './causeEffect';

describe('relationSentence', () => {
  it('joins the cause and the effect as written, dropping a trailing comma of the cause', () => {
    expect(relationSentence('domnul era obligat să colaboreze cu două guverne,', 'Începuturile domniei lui Al. I. Cuza au fost anevoioase')).toBe(
      'Pentru că domnul era obligat să colaboreze cu două guverne, Începuturile domniei lui Al. I. Cuza au fost anevoioase.',
    );
  });

  it('keeps a proper noun capitalised, trims spaces and one trailing ; or .', () => {
    expect(relationSentence(' Mihai Viteazul a intrat în Alba Iulia; ', 'unirea.')).toBe('Pentru că Mihai Viteazul a intrat în Alba Iulia, unirea.');
  });
});

describe('ROLE', () => {
  it('numbers the steps and labels the marks', () => {
    expect(ROLE.cause.step).toBe(1);
    expect(ROLE.effect.step).toBe(2);
    expect(ROLE.cause.label).toBe('CAUZĂ');
    expect(ROLE.effect.label).toBe('EFECT');
    expect(ROLE.cause.question).toBe('De ce s-a întâmplat ceva?');
    expect(ROLE.effect.clues).toEqual(['ca urmare', 'astfel', 'ceea ce', 'de aceea']);
    expect(DONE).toBe('✓ Gata, ambele roluri marcate');
  });
});
