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
  'home.profileLabel': {
    group: 'home',
    default: 'Profil',
    description: 'Numele citit de cititorul de ecran pentru inițiala din colțul de sus (deschide profilul)',
  },
  'home.loadFailed': {
    group: 'home',
    default: 'Nu am putut încărca lecțiile',
    description: 'Titlul erorii când lista de lecții nu se încarcă',
  },
  'home.modeChip': {
    group: 'home',
    default: '{icon} {mod} · {terminate} din {total} terminate',
    vars: ['icon', 'mod', 'terminate', 'total'],
    description: 'Eticheta de sub titlu: modul de învățare și câte lecții sunt terminate',
  },
  'home.bac.title': {
    group: 'home',
    default: 'Subiecte BAC',
    description: 'Titlul cardului spre subiectele de BAC (și numele lui pentru cititorul de ecran)',
  },
  'home.bac.subtitle': {
    group: 'home',
    default: 'Exersează lucrarea completă',
    description: 'Sub „Subiecte BAC”',
  },
  'home.invite.link': {
    group: 'home',
    default: '🎁 Invită colegi ›',
    description: 'Linkul spre invitații de la finalul listei de lecții',
  },
  'home.invite.linkWithProgress': {
    group: 'home',
    default: '🎁 Invită colegi, {progres} ›',
    vars: ['progres'],
    description: 'Linkul spre invitații, cu progresul spre recompensă (de exemplu „2/5”)',
  },
  'home.inviteNote.text': {
    group: 'home',
    default: 'Ai terminat prima lecție! Invită un coleg și primești credite.',
    description: 'Nota afișată o singură dată pe Acasă, după prima lecție terminată',
  },
  'home.inviteNote.button': {
    group: 'home',
    default: 'Invită',
    description: 'Butonul notei de după prima lecție terminată',
  },
  'home.continue.first': {
    group: 'home',
    default: 'Începe de aici',
    description: 'Rândul de sus al cardului principal, pentru un elev fără progres',
  },
  'home.continue.resume': {
    group: 'home',
    default: 'Continuă de unde ai rămas',
    description: 'Rândul de sus al cardului principal, când elevul a rămas în mijlocul unei lecții',
  },
  'home.continue.next': {
    group: 'home',
    default: 'Următoarea lecție',
    description: 'Rândul de sus al cardului principal, după o lecție terminată',
  },
  'home.continue.title': {
    group: 'home',
    default: 'Lecția {n} · {titlu}',
    vars: ['n', 'titlu'],
    description: 'Titlul cardului principal: numărul și titlul lecției',
  },
  'home.continue.whereCard': {
    group: 'home',
    default: 'Ai rămas la cardul {n}',
    vars: ['n'],
    description: 'Pe cardul principal: unde a rămas elevul în carduri',
  },
  'home.continue.whereQuestion': {
    group: 'home',
    default: 'Ai rămas la întrebarea {n} din verificare',
    vars: ['n'],
    description: 'Pe cardul principal: unde a rămas elevul în test',
  },
  'home.continue.resumeButton': {
    group: 'home',
    default: 'Continuă lecția',
    description: 'Butonul cardului principal, când elevul a rămas în mijlocul lecției',
  },
  'home.continue.startButton': {
    group: 'home',
    default: 'Începe lecția',
    description: 'Butonul cardului principal, pentru o lecție neîncepută',
  },
  'home.locked.afterLesson': {
    group: 'home',
    default: 'Se deschide după lecția {n}',
    vars: ['n'],
    description: 'Traseu ghidat: sub o lecție blocată; {n} este lecția de dinaintea ei',
  },
  'home.locked.paywall': {
    group: 'home',
    default: 'Disponibilă cu acces complet',
    description: 'Sub o lecție care nu face parte din planul elevului',
  },
} as const satisfies Record<string, TextEntry>;
