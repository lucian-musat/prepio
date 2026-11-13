import type { TextEntry } from '../types';

/** Learning cards: the fixed copy around the card content (labels, hints, buttons, screen-reader names). */
export const cardsTexts = {
  // Card type chips (only shown in the admin card preview)
  'cards.type.text': {
    group: 'cards',
    default: 'Text',
    description: 'Eticheta tipului de card, afișată doar în previzualizarea cardului din admin',
  },
  'cards.type.images': {
    group: 'cards',
    default: 'Imagini',
    description: 'Eticheta tipului de card, afișată doar în previzualizarea cardului din admin',
  },
  'cards.type.video': {
    group: 'cards',
    default: 'Video',
    description: 'Eticheta tipului de card, afișată doar în previzualizarea cardului din admin',
  },
  'cards.type.timeline': {
    group: 'cards',
    default: 'Axă cronologică',
    description: 'Eticheta tipului de card, afișată doar în previzualizarea cardului din admin',
  },
  'cards.type.schema': {
    group: 'cards',
    default: 'Schemă',
    description: 'Eticheta tipului de card, afișată doar în previzualizarea cardului din admin',
  },
  'cards.type.link': {
    group: 'cards',
    default: 'Link',
    description: 'Eticheta tipului de card, afișată doar în previzualizarea cardului din admin',
  },

  // Text callouts (`:::retine`, `:::atentie`, `:::exemplu` in the card text)
  'cards.callout.retine': {
    group: 'cards',
    default: 'De reținut',
    description: 'Titlul casetei „reține” din textul unui card',
  },
  'cards.callout.atentie': {
    group: 'cards',
    default: 'Atenție',
    description: 'Titlul casetei „atenție” din textul unui card',
  },
  'cards.callout.exemplu': {
    group: 'cards',
    default: 'Exemplu',
    description: 'Titlul casetei „exemplu” din textul unui card',
  },

  // Expandable points / boxes
  'cards.expand.hint': {
    group: 'cards',
    default: 'Atinge pentru detalii',
    description: 'Indicația citită de cititorul de ecran pe un punct de pe axă sau o căsuță de schemă care se deschide',
  },
  'cards.timeline.hint': {
    group: 'cards',
    default: 'Atinge un punct pentru detalii',
    description: 'Rândul de deasupra unei axe cronologice cu puncte care se deschid',
  },
  'cards.timeline.point': {
    group: 'cards',
    default: '{data}, {titlu}',
    vars: ['data', 'titlu'],
    description: 'Cum citește cititorul de ecran un punct de pe axa cronologică',
  },
  'cards.timeline.keyPoint': {
    group: 'cards',
    default: '{data}, {titlu}, moment cheie',
    vars: ['data', 'titlu'],
    description: 'Cum citește cititorul de ecran un moment cheie (★) de pe axa cronologică',
  },
  'cards.schema.hint': {
    group: 'cards',
    default: 'Atinge căsuțele cu + pentru detalii',
    description: 'Rândul de deasupra unei scheme cu căsuțe care se deschid',
  },

  // Images
  'cards.images.thumb': {
    group: 'cards',
    default: 'Miniatura {n}: {descriere}',
    vars: ['n', 'descriere'],
    description: 'Numele citit de cititorul de ecran pentru o miniatură din galerie; {descriere} este textul alternativ al imaginii',
  },
  'cards.images.zoomed': {
    group: 'cards',
    default: '{descriere} (mărită)',
    vars: ['descriere'],
    description: 'Numele citit de cititorul de ecran pentru imaginea mărită; {descriere} este textul alternativ',
  },
  'cards.images.prev': {
    group: 'cards',
    default: 'Imaginea anterioară',
    description: 'Numele citit de cititorul de ecran pentru săgeata înapoi din imaginea mărită',
  },
  'cards.images.next': {
    group: 'cards',
    default: 'Imaginea următoare',
    description: 'Numele citit de cititorul de ecran pentru săgeata înainte din imaginea mărită',
  },

  // Video
  'cards.video.unmute': {
    group: 'cards',
    default: '🔇 Atinge pentru sunet',
    description: 'Butonul de sub video, cât timp video-ul merge fără sunet',
  },
  'cards.video.unmuteLabel': {
    group: 'cards',
    default: 'Pornește sunetul',
    description: 'Numele citit de cititorul de ecran pentru butonul de sunet de sub video',
  },
  'cards.video.openYoutube': {
    group: 'cards',
    default: 'Deschide pe YouTube',
    description: 'Butonul afișat când video-ul nu poate fi redat în aplicație',
  },
  'cards.video.frameTitle': {
    group: 'cards',
    default: 'Video YouTube',
    description: 'Numele citit de cititorul de ecran pentru playerul video (web)',
  },

  // Link
  'cards.link.open': {
    group: 'cards',
    default: 'Deschide ↗',
    description: 'Butonul care deschide linkul unui card de tip link',
  },
} as const satisfies Record<string, TextEntry>;
