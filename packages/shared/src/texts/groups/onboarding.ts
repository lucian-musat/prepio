import type { TextEntry } from '../types';

/** The steps after the first sign-in: terms gate, name and learning mode. */
export const onboardingTexts = {
  // Terms gate
  'onboarding.terms.title': {
    group: 'onboarding',
    default: 'Înainte să continui',
    description: 'Titlul ecranului în care elevul acceptă termenii',
  },
  'onboarding.terms.body': {
    group: 'onboarding',
    default:
      'Prepio este pentru elevii de liceu care au cel puțin 14 ani. Ca să folosești aplicația, confirmă ' +
      'vârsta (și, dacă ai sub 18 ani, acordul părintelui) și acceptă termenii.',
    description: 'Explicația de sub titlul ecranului de acceptare a termenilor',
  },
  'onboarding.terms.saveFailed': {
    group: 'onboarding',
    default: 'Nu am putut salva. Încearcă din nou.',
    description: 'Eroarea când acceptarea termenilor nu a putut fi salvată',
  },
  'onboarding.terms.outdated': {
    group: 'onboarding',
    default: 'Actualizează aplicația (sau reîncarcă pagina) ca să continui. Dacă problema rămâne, scrie-ne la {email}.',
    vars: ['email'],
    description: 'Eroarea când termenii de pe server sunt de altă versiune decât cei din aplicație; {email} este adresa de contact',
  },

  // Name
  'onboarding.name.title': {
    group: 'onboarding',
    default: 'Cum te numești?',
    description: 'Titlul pasului în care elevul își scrie prenumele',
  },
  'onboarding.name.body': {
    group: 'onboarding',
    default: 'Îți spunem pe nume în aplicație. Îl poți schimba mai târziu.',
    description: 'Explicația de sub titlul pasului cu prenumele',
  },
  'onboarding.name.fieldLabel': {
    group: 'onboarding',
    default: 'Numele tău',
    description: 'Numele câmpului pentru prenume, citit de cititorul de ecran',
  },
  'onboarding.name.placeholder': {
    group: 'onboarding',
    default: 'Prenumele tău',
    description: 'Textul din câmpul gol pentru prenume',
  },
  'onboarding.name.limit': {
    group: 'onboarding',
    default: 'Cel mult {max} de caractere.',
    vars: ['max'],
    description: 'Nota de sub câmpul pentru prenume; {max} este lungimea maximă',
  },
  'onboarding.name.saveFailed': {
    group: 'onboarding',
    default: 'Numele nu a putut fi salvat. Încearcă din nou.',
    description: 'Eroarea când prenumele nu a putut fi salvat',
  },

  // Learning mode
  'onboarding.mode.title': {
    group: 'onboarding',
    default: 'Cum vrei să înveți?',
    description: 'Titlul pasului în care elevul alege modul de învățare',
  },
  'onboarding.mode.body': {
    group: 'onboarding',
    default: 'Poți schimba oricând din Profil.',
    description: 'Explicația de sub titlul pasului cu modul de învățare',
  },
  'onboarding.mode.saveFailed': {
    group: 'onboarding',
    default: 'Modul nu a putut fi salvat. Încearcă din nou.',
    description: 'Eroarea când modul de învățare nu a putut fi salvat',
  },
  'onboarding.mode.notConfirmed': {
    group: 'onboarding',
    default: 'Nu am putut confirma alegerea. Încearcă din nou.',
    description: 'Eroarea când alegerea modului a fost trimisă, dar profilul nu o arată',
  },
  'onboarding.mode.recommended': {
    group: 'onboarding',
    default: 'Recomandat',
    description: 'Eticheta de pe cardul modului recomandat (traseul ghidat)',
  },
  'onboarding.mode.guided.name': {
    group: 'onboarding',
    default: 'Traseu ghidat',
    description: 'Numele modului ghidat (și în profil și pe Acasă)',
  },
  'onboarding.mode.guided.point1': {
    group: 'onboarding',
    default: 'Parcurgi lecțiile în ordine, una după alta.',
    description: 'Modul ghidat: primul punct din descriere',
  },
  'onboarding.mode.guided.point2': {
    group: 'onboarding',
    default: 'Lecția următoare se deschide după ce răspunzi corect la toate întrebările.',
    description: 'Modul ghidat: al doilea punct din descriere',
  },
  'onboarding.mode.guided.point3': {
    group: 'onboarding',
    default: 'Dacă greșești, revezi cardurile și reiei testul.',
    description: 'Modul ghidat: al treilea punct din descriere',
  },
  'onboarding.mode.guided.point4': {
    group: 'onboarding',
    default: 'Știi deja materia? Sari direct la verificare.',
    description: 'Modul ghidat: al patrulea punct din descriere',
  },
  'onboarding.mode.free.name': {
    group: 'onboarding',
    default: 'Explorare liberă',
    description: 'Numele modului liber (și în profil și pe Acasă)',
  },
  'onboarding.mode.free.point1': {
    group: 'onboarding',
    default: 'Începi orice lecție, în ce ordine vrei.',
    description: 'Modul liber: primul punct din descriere',
  },
  'onboarding.mode.free.point2': {
    group: 'onboarding',
    default: 'O lecție e terminată când ajungi la final.',
    description: 'Modul liber: al doilea punct din descriere',
  },
} as const satisfies Record<string, TextEntry>;
