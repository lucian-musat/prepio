import type { TextEntry } from '../types';

/**
 * BAC simulation: the subject list, the paper (tabs, map, autosave), the hand-in summary, grading and the result.
 * The per-item feedback on the result comes from the grader (stored with the attempt), not from here.
 */
export const bacTexts = {
  'bac.backToSubjects': {
    group: 'bac',
    default: 'Înapoi la subiecte',
    description: 'Butonul spre lista de subiecte (rezultat, „nu ai încă un rezultat”, fereastra de acces de pe listă)',
  },

  // Subject list
  'bac.list.title': { group: 'bac', default: 'Subiecte BAC', description: 'Titlul din bara de sus a listei de subiecte' },
  'bac.list.intro': {
    group: 'bac',
    default:
      'Lucrări complete, ca la examen: Subiectul I, II și III. Lucrezi în ritmul tău și totul se salvează automat. La final primești o notă orientativă și vezi ce mai ai de lucrat.',
    description: 'Paragraful de deasupra listei de subiecte',
  },
  'bac.list.yearHeading': {
    group: 'bac',
    default: 'Istorie · {an}',
    vars: ['an'],
    description: 'Titlul grupului de subiecte dintr-un an',
  },
  'bac.list.empty': { group: 'bac', default: 'Nu există încă subiecte publicate.' },
  'bac.list.loadFailed': { group: 'bac', default: 'Nu am putut încărca subiectele' },
  'bac.list.state.new': { group: 'bac', default: 'Neînceput', description: 'Eticheta unui subiect neînceput' },
  'bac.list.state.draft': {
    group: 'bac',
    default: 'În lucru',
    description: 'Eticheta unui subiect început, când nu se știe unde a rămas elevul',
  },
  'bac.list.state.draftAt': {
    group: 'bac',
    default: 'În lucru · Subiectul {subiect}, cerința {n}',
    vars: ['subiect', 'n'],
    description: 'Eticheta unui subiect început, cu locul unde a rămas elevul ({subiect} = I, II sau III)',
  },
  'bac.list.state.grading': { group: 'bac', default: 'Se corectează…', description: 'Eticheta unui subiect trimis la corectat' },
  'bac.list.state.failed': {
    group: 'bac',
    default: 'Corectarea nu a reușit',
    description: 'Eticheta unui subiect a cărui corectare a eșuat',
  },
  'bac.list.state.completed': {
    group: 'bac',
    default: '✓ Completat',
    description: 'Eticheta unui subiect corectat (fără notă cunoscută)',
  },
  'bac.list.state.completedGrade': {
    group: 'bac',
    default: '✓ Completat · {nota}',
    vars: ['nota'],
    description: 'Eticheta unui subiect corectat, cu ultima notă (de forma 8,40)',
  },
  'bac.list.cost': {
    group: 'bac',
    default: '{n} credite la predare',
    vars: ['n'],
    description: 'Costul corectării, sub titlul subiectului',
  },
  'bac.list.costLabel': {
    group: 'bac',
    default: 'Costă {n} credite la predare',
    vars: ['n'],
    description: 'Cum citește cititorul de ecran costul corectării',
  },
  'bac.list.lastGrade': {
    group: 'bac',
    default: 'Ultima notă: {nota}',
    vars: ['nota'],
    description: 'Legătura spre ultimul rezultat, sub un subiect început din nou (urmată de „›”)',
  },
  'bac.list.lastGradeLabel': {
    group: 'bac',
    default: 'Ultima notă: {nota}, vezi rezultatul',
    vars: ['nota'],
    description: 'Cum citește cititorul de ecran legătura spre ultimul rezultat',
  },

  // Paper
  'bac.paper.titleFallback': {
    group: 'bac',
    default: 'Subiect BAC',
    description: 'Titlul lucrării cât timp subiectul se încarcă sau nu a putut fi încărcat',
  },
  'bac.paper.loadFailed': { group: 'bac', default: 'Nu am putut încărca subiectul' },
  'bac.paper.missing': { group: 'bac', default: 'Subiectul nu este disponibil', description: 'Subiectul nu mai e publicat' },
  'bac.paper.section': {
    group: 'bac',
    default: 'Subiectul {subiect}',
    vars: ['subiect'],
    description: 'Tabul unei părți a lucrării ({subiect} = I, II sau III; pe telefon tabul arată doar cifra romană)',
  },
  'bac.paper.item': {
    group: 'bac',
    default: 'Cerința {n}',
    vars: ['n'],
    description: 'Cum citește cititorul de ecran un punct din harta cerințelor (necompletat)',
  },
  'bac.paper.itemDone': {
    group: 'bac',
    default: 'Cerința {n}, completată',
    vars: ['n'],
    description: 'Cum citește cititorul de ecran un punct din harta cerințelor (completat)',
  },
  'bac.paper.itemPartial': {
    group: 'bac',
    default: 'Cerința {n}, incompletă',
    vars: ['n'],
    description: 'Cum citește cititorul de ecran un punct din harta cerințelor (scris doar în parte)',
  },
  'bac.paper.saved': { group: 'bac', default: 'Salvat', description: 'Lângă harta cerințelor, după salvarea automată (nu pe telefon)' },
  'bac.paper.saveFailed': { group: 'bac', default: 'Nu s-a putut salva', description: 'Lângă harta cerințelor, când salvarea automată a eșuat' },
  'bac.paper.submit': {
    group: 'bac',
    default: 'Predă lucrarea',
    description: 'Legătura din bara de sus și butonul de la ultima cerință, care deschid predarea',
  },
  'bac.paper.next': { group: 'bac', default: 'Următorul', description: 'Butonul spre cerința următoare (urmat de „→”)' },
  'bac.paper.lastItemHint': {
    group: 'bac',
    default: 'Ai ajuns la ultima cerință. Verifică ce mai ai de completat și predă lucrarea.',
    description: 'Deasupra butoanelor, la ultima cerință a lucrării',
  },

  // Hint („💡 Cum rezolv” on an item; the title is consolidation.exercise.howTo)
  'bac.hint.show': { group: 'bac', default: 'Arată indicațiile', description: 'Indiciul cititorului de ecran pentru „Cum rezolv” închis' },
  'bac.hint.hide': { group: 'bac', default: 'Ascunde indicațiile', description: 'Indiciul cititorului de ecran pentru „Cum rezolv” deschis' },

  // Hand-in summary
  'bac.submit.answered': {
    group: 'bac',
    default: 'Ai răspuns complet la {n} din {cerinte}',
    vars: ['n', 'cerinte'],
    description: 'Titlul predării; {cerinte} este de forma „10 cerințe”',
  },
  'bac.submit.partialHeading': { group: 'bac', default: 'Incomplete:', description: 'Deasupra cerințelor scrise doar în parte' },
  'bac.submit.partialKind': {
    group: 'bac',
    default: 'Incomplet',
    description: 'Cum citește cititorul de ecran o cerință scrisă în parte („Incomplet: I.6”)',
  },
  'bac.submit.emptyHeading': { group: 'bac', default: 'Necompletate:', description: 'Deasupra cerințelor necompletate' },
  'bac.submit.emptyKind': {
    group: 'bac',
    default: 'Necompletat',
    description: 'Cum citește cititorul de ecran o cerință necompletată („Necompletat: I.6”)',
  },
  'bac.submit.essayMissing.one': {
    group: 'bac',
    default: 'cerința',
    description: 'O singură cerință lipsă din eseu: „III (cerința 4)”',
  },
  'bac.submit.essayMissing.many': {
    group: 'bac',
    default: 'cerințele',
    description: 'Mai multe cerințe lipsă din eseu: „III (cerințele 2, 4)”',
  },
  'bac.submit.warning': { group: 'bac', default: 'După ce predai lucrarea, nu mai poți schimba răspunsurile.' },
  'bac.submit.send': { group: 'bac', default: 'Trimite la corectat', description: 'Butonul care trimite lucrarea (arată și costul)' },
  'bac.submit.keepWorking': { group: 'bac', default: 'Mai lucrez', description: 'Butonul de întoarcere la lucrare' },

  // Grading
  'bac.grading.title': { group: 'bac', default: 'Corectăm lucrarea…', description: 'Cât timp lucrarea se corectează' },

  // Result
  'bac.result.title': { group: 'bac', default: 'Rezultat', description: 'Titlul din bara de sus a rezultatului' },
  'bac.result.yourGrade': { group: 'bac', default: 'Nota ta', description: 'Deasupra notei' },
  'bac.result.gradeNote': {
    group: 'bac',
    default: 'Notă orientativă. Un profesor te-ar putea nota diferit.',
    description: 'Sub notă (aceeași frază apare în Termeni, care nu se editează de aici)',
  },
  'bac.result.gradedOn': {
    group: 'bac',
    default: 'Corectată pe {data} · include 10 puncte din oficiu',
    vars: ['data'],
    description: 'Sub notă, când se știe data corectării ({data} de forma „9 noiembrie 2026”)',
  },
  'bac.result.exOfficio': { group: 'bac', default: 'Include 10 puncte din oficiu', description: 'Sub notă, imediat după corectare' },
  'bac.result.subtotal': {
    group: 'bac',
    default: 'Subiectul {subiect} · {puncte} / {max} p',
    vars: ['subiect', 'puncte', 'max'],
    description: 'Punctajul pe fiecare parte a lucrării ({subiect} = I, II sau III)',
  },
  'bac.result.workOn': { group: 'bac', default: 'De lucrat', description: 'Titlul listei de cerințe fără punctaj maxim' },
  'bac.result.points': {
    group: 'bac',
    default: '{puncte} / {max} p',
    vars: ['puncte', 'max'],
    description: 'Punctajul unei cerințe din „De lucrat”',
  },
  'bac.result.congrats': {
    group: 'bac',
    default: 'Felicitări! Ai luat punctajul maxim la toate cerințele.',
    description: 'În locul listei „De lucrat”, când toate cerințele au punctaj maxim',
  },
  'bac.result.redo': { group: 'bac', default: 'Reia subiectul', description: 'Butonul care începe o lucrare nouă la același subiect' },
  'bac.result.redoNote': { group: 'bac', default: 'Dacă reiei subiectul, corectarea costă din nou credite.' },
  'bac.result.continue': {
    group: 'bac',
    default: 'Continuă lucrarea începută',
    description: 'În locul lui „Reia subiectul”, când elevul are deja o lucrare începută la subiect',
  },
  'bac.result.loadFailed': { group: 'bac', default: 'Nu am putut încărca rezultatul' },
  'bac.result.none': { group: 'bac', default: 'Nu ai încă un rezultat la acest subiect.' },
} as const satisfies Record<string, TextEntry>;
