import type { TextEntry } from '../types';

export const homeTexts = {
  'home.hero.welcome': {
    group: 'home',
    default:
      'Bine ai venit în Prepio! Aici te pregătești pentru proba de istorie de la Bacalaureat. ' +
      'Alege o lecție din programă, citește cardurile cu ce trebuie să știi și răspunde la câteva întrebări. ' +
      'Apoi exersează cu exerciții ca la BAC. Când scrii un răspuns, profesorul digital îți spune pe loc ce poți ' +
      'îmbunătăți. Spor la învățat!',
    optional: true,
    description: 'Paragraful de bun venit de sub titlul de pe Acasă; gol = ascuns',
  },
  'home.hero.welcomeBack': {
    group: 'home',
    default: 'Bine ai revenit, {nume}!',
    vars: ['nume'],
    description: 'Salutul elevului care revine, afișat în titlul de pe Acasă',
  },
} as const satisfies Record<string, TextEntry>;
