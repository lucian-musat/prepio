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
  'home.hero.welcomeBackNoName': {
    group: 'home',
    default: 'Bine ai revenit!',
    description: 'Salutul elevului care revine și nu și-a completat numele',
  },
  'home.hero.label': {
    group: 'home',
    default: 'Bine ai venit!',
    description: 'Rândul mic de deasupra titlului de pe Acasă (elev nou)',
  },
  'home.hero.title': {
    group: 'home',
    default: 'Pregătește BAC-ul, pas cu pas.',
    description: 'Titlul mare de pe Acasă (elev nou)',
  },
  'home.lessonItem.finished': {
    group: 'home',
    default: 'Terminată',
    description: 'Sub titlul unei lecții terminate, în lista de pe Acasă',
  },
  'home.lessonItem.current': {
    group: 'home',
    default: 'Continuă',
    description: 'Sub titlul lecției la care a rămas elevul, în lista de pe Acasă',
  },
  'home.lessonItem.lockedLabel': {
    group: 'home',
    default: '{titlu}, blocată',
    vars: ['titlu'],
    description: 'Cum citește cititorul de ecran o lecție blocată fără motiv',
  },
  'home.lessonItem.lockedReasonLabel': {
    group: 'home',
    default: '{titlu}, blocată, {motiv}',
    vars: ['titlu', 'motiv'],
    description: 'Cum citește cititorul de ecran o lecție blocată, cu motivul (scris cu literă mică)',
  },
  'home.lessonItem.paywallReason': {
    group: 'home',
    default: 'face parte din accesul complet',
    description: 'Motivul citit de cititorul de ecran pentru o lecție din accesul complet, când nu e afișat altul',
  },
} as const satisfies Record<string, TextEntry>;
