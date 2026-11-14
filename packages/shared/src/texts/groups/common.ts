import type { TextEntry } from '../types';

export const commonTexts = {
  'common.back': {
    group: 'common',
    default: 'Înapoi',
    description: 'Butonul și săgeata de întoarcere la ecranul anterior',
  },
  'common.continue': {
    group: 'common',
    default: 'Continuă',
    description: 'Butonul de mers mai departe (carduri, ultima întrebare, previzualizarea cardului din admin)',
  },
  'common.retry': {
    group: 'common',
    default: 'Încearcă din nou',
    description: 'Butonul de reîncercare de pe ecranul de eroare',
  },
  'common.retryButton': {
    group: 'common',
    default: 'Reîncearcă',
    description: 'Butonul de reîncercare după o încărcare sau o salvare eșuată (Acasă, lecție)',
  },
  'common.goHome': {
    group: 'common',
    default: 'Mergi la început',
    description: 'Butonul spre prima pagină, pe ecranele de eroare și „Pagina nu există”',
  },
  'common.cancel': {
    group: 'common',
    default: 'Anulează',
    description: 'Butonul implicit de renunțare din dialogurile de confirmare',
  },
  'common.close': {
    group: 'common',
    default: 'Închide',
    description: 'Numele citit de cititorul de ecran pentru butoanele ×, pentru imaginea mărită și pentru fundalul unui dialog (atingerea lui îl închide)',
  },
  'common.closeWindow': {
    group: 'common',
    default: 'Închide fereastra',
    description: 'Numele citit de cititorul de ecran pentru fundalul unei ferestre de jos (atingerea lui o închide): oferta, credite, seria, ora mementoului',
  },
  'common.loading': {
    group: 'common',
    default: 'Se încarcă',
    description: 'Numele citit de cititorul de ecran pentru indicatorul de încărcare',
  },
  'common.progress': {
    group: 'common',
    default: 'Progres',
    description: 'Numele implicit citit de cititorul de ecran pentru bara de progres',
  },
  'common.button.withCost': {
    group: 'common',
    default: '{eticheta}, costă {credite}',
    vars: ['eticheta', 'credite'],
    description: 'Cum citește cititorul de ecran un buton care costă credite; {credite} este de forma „2 credite”',
  },
  'common.scoreRing.label': {
    group: 'common',
    default: 'Nota {nota} din {max}',
    vars: ['nota', 'max'],
    description: 'Cum citește cititorul de ecran cercul cu nota',
  },
  'common.skeleton.evaluating': {
    group: 'common',
    default: 'Se evaluează răspunsul…',
    description: 'Textul de sub punctele animate cât timp profesorul digital verifică un răspuns',
  },
  'common.preview.title': {
    group: 'common',
    default: 'Previzualizare',
    description: 'Titlul paginii de previzualizare a cardului din admin',
  },
  'common.preview.webOnly': {
    group: 'common',
    default: 'Previzualizarea este disponibilă doar pe web.',
    description: 'Previzualizarea cardului deschisă în aplicația de telefon',
  },
  'common.preview.waiting': {
    group: 'common',
    default: 'Se așteaptă cardul…',
    description: 'Previzualizarea cardului din admin, până sosește cardul',
  },
  'common.preview.backLabel': {
    group: 'common',
    default: 'Înapoi la cardul anterior',
    description: 'Numele citit de cititorul de ecran pentru butonul „Înapoi” din previzualizare',
  },
  'common.preview.eyebrow': {
    group: 'common',
    default: 'Card {n} din {total}',
    vars: ['n', 'total'],
    description: 'Rândul de deasupra cardului din previzualizarea din admin',
  },
} as const satisfies Record<string, TextEntry>;
