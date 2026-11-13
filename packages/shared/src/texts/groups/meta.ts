import type { TextEntry } from '../types';

/** The app name and the navigation titles of the routes (the browser tab title on the web). */
export const metaTexts = {
  'meta.appName': {
    group: 'meta',
    default: 'Prepio',
    description: 'Numele aplicației: logo-ul din bara de sus, titlul filei din browser pe Acasă și pe Bun venit',
  },
  'meta.pageTitle': {
    group: 'meta',
    default: '{pagina} · Prepio',
    vars: ['pagina'],
    description: 'Titlul filei din browser pentru o pagină cu nume',
  },
  'meta.route.lesson': { group: 'meta', default: 'Lecție', description: 'Titlul de navigare al lecției' },
  'meta.route.consolidation': { group: 'meta', default: 'Consolidare', description: 'Titlul de navigare al consolidării' },
  'meta.route.bacList': { group: 'meta', default: 'Subiecte BAC', description: 'Titlul de navigare al listei de subiecte BAC' },
  'meta.route.bacPaper': { group: 'meta', default: 'Subiect BAC', description: 'Titlul de navigare al unui subiect BAC' },
  'meta.route.bacResult': { group: 'meta', default: 'Rezultat BAC', description: 'Titlul de navigare al rezultatului BAC' },
  'meta.route.profile': { group: 'meta', default: 'Profil', description: 'Titlul de navigare al profilului' },
  'meta.route.credits': { group: 'meta', default: 'Creditele mele', description: 'Titlul de navigare al paginii de credite' },
  'meta.route.inviteFriends': { group: 'meta', default: 'Invită colegi', description: 'Titlul de navigare al paginii de invitații' },
  'meta.route.email': { group: 'meta', default: 'Email', description: 'Titlul de navigare al pasului cu adresa de email' },
  'meta.route.code': { group: 'meta', default: 'Cod', description: 'Titlul de navigare al pasului cu codul primit pe email' },
  'meta.route.suspended': { group: 'meta', default: 'Cont suspendat', description: 'Titlul de navigare al ecranului de cont suspendat' },
  'meta.route.terms': {
    group: 'meta',
    default: 'Înainte să continui',
    description: 'Titlul de navigare al pasului cu acordul pentru termeni (la prima intrare)',
  },
  'meta.route.name': { group: 'meta', default: 'Cum te numești?', description: 'Titlul de navigare al pasului cu numele' },
  'meta.route.mode': { group: 'meta', default: 'Cum vrei să înveți?', description: 'Titlul de navigare al pasului cu modul de învățare' },
  'meta.route.privacyPage': {
    group: 'meta',
    default: 'Politica de confidențialitate',
    description: 'Titlul de navigare al paginii Politica de confidențialitate (doar titlul, nu conținutul)',
  },
  'meta.route.termsPage': {
    group: 'meta',
    default: 'Termeni de utilizare',
    description: 'Titlul de navigare al paginii Termeni de utilizare (doar titlul, nu conținutul)',
  },
  'meta.route.deleteAccount': { group: 'meta', default: 'Ștergerea contului', description: 'Titlul de navigare al paginii publice despre ștergerea contului' },
  'meta.route.invite': { group: 'meta', default: 'Invitație', description: 'Titlul de navigare al linkului de invitație' },
  'meta.route.referrals': {
    group: 'meta',
    default: 'Cum funcționează recomandările',
    description: 'Titlul de navigare al paginii cu regulile recomandărilor',
  },
  'meta.route.preview': { group: 'meta', default: 'Previzualizare', description: 'Titlul de navigare al previzualizării cardului din admin' },
} as const satisfies Record<string, TextEntry>;
