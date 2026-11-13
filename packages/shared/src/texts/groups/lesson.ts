import type { TextEntry } from '../types';

/** The lesson flow: start screen, cards, questions (the test) and the result screens. */
export const lessonTexts = {
  // Counts (noun forms only: the app adds the number and the „de” rule, e.g. „20 de lecții”)
  'lesson.count.one': {
    group: 'lesson',
    default: 'lecție',
    description: 'Forma de singular din „1 lecție” (numărul de lecții de pe Acasă)',
  },
  'lesson.count.many': {
    group: 'lesson',
    default: 'lecții',
    description: 'Forma de plural din „5 lecții” / „20 de lecții” (numărul de lecții de pe Acasă)',
  },
  'lesson.cardCount.one': {
    group: 'lesson',
    default: 'card',
    description: 'Forma de singular din „1 card” (zona Învățare a lecției)',
  },
  'lesson.cardCount.many': {
    group: 'lesson',
    default: 'carduri',
    description: 'Forma de plural din „5 carduri” (zona Învățare a lecției)',
  },
  'lesson.questionCount.one': {
    group: 'lesson',
    default: 'întrebare',
    description: 'Forma de singular din „1 întrebare” (zona Verificare a lecției)',
  },
  'lesson.questionCount.many': {
    group: 'lesson',
    default: 'întrebări',
    description: 'Forma de plural din „5 întrebări” (zona Verificare a lecției)',
  },
  'lesson.exerciseCount.one': {
    group: 'lesson',
    default: 'exercițiu',
    description: 'Forma de singular din „1 exercițiu” (zona Consolidare a lecției)',
  },
  'lesson.exerciseCount.many': {
    group: 'lesson',
    default: 'exerciții',
    description: 'Forma de plural din „5 exerciții” (zona Consolidare a lecției)',
  },

  // Screen frame, loading and errors
  'lesson.screenTitle': {
    group: 'lesson',
    default: 'Lecție',
    description: 'Titlul din bara de sus a ecranului de lecție (start, încărcare, erori)',
  },
  'lesson.backToLessons': {
    group: 'lesson',
    default: 'Înapoi la lecții',
    description: 'Butonul spre Acasă de pe erorile lecției și de la finalul unei lecții fără consolidare',
  },
  'lesson.loadFailed': {
    group: 'lesson',
    default: 'Nu am putut încărca lecția',
    description: 'Titlul erorii când lecția nu se încarcă',
  },
  'lesson.notFound': {
    group: 'lesson',
    default: 'Lecția nu a fost găsită',
    description: 'Lecția deschisă nu există (link vechi)',
  },
  'lesson.locked.title': {
    group: 'lesson',
    default: 'Lecția este blocată',
    description: 'Traseu ghidat: o lecție deschisă înaintea celor de dinainte',
  },
  'lesson.locked.body': {
    group: 'lesson',
    default: 'Termină mai întâi lecțiile de dinainte, în ordine.',
    description: 'Textul de sub „Lecția este blocată”',
  },
  'lesson.saveFailed': {
    group: 'lesson',
    default: 'Progresul nu a putut fi salvat. Încearcă din nou.',
    description: 'La finalul lecției, când lecția terminată nu a putut fi salvată',
  },

  // Start screen
  'lesson.start.resume': {
    group: 'lesson',
    default: 'Continuă de unde ai rămas',
    description: 'Butonul principal al ecranului de start când elevul are o poziție salvată',
  },
  'lesson.start.retake': {
    group: 'lesson',
    default: 'Reia testul',
    description: 'Butonul principal al ecranului de start după un test picat',
  },
  'lesson.start.learn': {
    group: 'lesson',
    default: 'Începe învățarea',
    description: 'Butonul care deschide primul card',
  },
  'lesson.start.skip': {
    group: 'lesson',
    default: 'Știu deja, sari la verificare',
    description: 'Butonul / linkul care sare peste carduri, direct la întrebări',
  },
  'lesson.start.learnZone': {
    group: 'lesson',
    default: 'Învățare',
    description: 'Numele zonei cu cardurile, pe ecranul de start',
  },
  'lesson.start.checkZone': {
    group: 'lesson',
    default: 'Verificare',
    description: 'Numele zonei cu întrebările, pe ecranul de start',
  },
  'lesson.start.consolidateZone': {
    group: 'lesson',
    default: 'Consolidare',
    description: 'Numele zonei cu exercițiile de consolidare, pe ecranul de start',
  },
  'lesson.start.consolidateSubtitle': {
    group: 'lesson',
    default: '{exercitii} tip BAC',
    vars: ['exercitii'],
    description: 'Sub „Consolidare”; {exercitii} este de forma „3 exerciții”',
  },
  'lesson.start.consolidateLocked': {
    group: 'lesson',
    default: 'Se deschide după ce termini verificarea',
    description: 'Sub zona Consolidare, cât timp lecția nu e terminată',
  },
  'lesson.start.consolidateContinue': {
    group: 'lesson',
    default: 'Continuă ›',
    description: 'În dreapta zonei Consolidare, după ce elevul a încercat un exercițiu',
  },
  'lesson.start.consolidateStart': {
    group: 'lesson',
    default: 'Începe ›',
    description: 'În dreapta zonei Consolidare, înainte de primul exercițiu',
  },
  'lesson.start.finished': {
    group: 'lesson',
    default: '✓ Lecție terminată',
    description: 'Sub zonele unei lecții deja terminate',
  },
  'lesson.start.guidedHint': {
    group: 'lesson',
    default: 'Dacă răspunzi corect la toate, treci la lecția următoare.',
    description: 'Traseu ghidat: sub zonele unei lecții neterminate',
  },

  // Progress lines on the start screen
  'lesson.progress.card': {
    group: 'lesson',
    default: 'Ai rămas la cardul {n} din {total}',
    vars: ['n', 'total'],
    description: 'Sub zona Învățare, când elevul a ieșit din carduri',
  },
  'lesson.progress.question': {
    group: 'lesson',
    default: 'Ai rămas la întrebarea {n} din {total}',
    vars: ['n', 'total'],
    description: 'Sub zona Verificare, când elevul a ieșit din test',
  },
  'lesson.progress.lastTest': {
    group: 'lesson',
    default: 'Ultima încercare: {corecte} din {total} corecte',
    vars: ['corecte', 'total'],
    description: 'Sub zona Verificare, după un test picat',
  },
  'lesson.progress.consolidation': {
    group: 'lesson',
    default: '{corecte} din {total} rezolvate corect',
    vars: ['corecte', 'total'],
    description: 'Sub zona Consolidare, după ce elevul a încercat un exercițiu',
  },

  // Skip dialog
  'lesson.skip.title': {
    group: 'lesson',
    default: 'Sari la verificare?',
    description: 'Titlul dialogului care cere confirmarea înainte de a sări peste carduri',
  },
  'lesson.skip.guided': {
    group: 'lesson',
    default:
      'Treci peste carduri și începi direct verificarea. Ca să treci la lecția următoare, trebuie să răspunzi corect la ' +
      'toate întrebările. Dacă greșești, revezi cardurile și reiei verificarea.',
    description: 'Textul dialogului „Sari la verificare?” în traseul ghidat',
  },
  'lesson.skip.free': {
    group: 'lesson',
    default: 'Treci peste carduri și începi direct verificarea. Lecția e terminată când ajungi la final. Poți reveni oricând la carduri.',
    description: 'Textul dialogului „Sari la verificare?” în explorarea liberă',
  },
  'lesson.skip.confirm': {
    group: 'lesson',
    default: 'Da, sari la verificare',
    description: 'Butonul de confirmare din dialogul „Sari la verificare?”',
  },

  // Cards
  'lesson.cards.eyebrow': {
    group: 'lesson',
    default: 'Card {n} din {total}',
    vars: ['n', 'total'],
    description: 'Rândul de deasupra fiecărui card din lecție',
  },
  'lesson.cards.prevLabel': {
    group: 'lesson',
    default: 'Înapoi la cardul anterior',
    description: 'Numele citit de cititorul de ecran pentru butonul „Înapoi” de sub carduri',
  },
  'lesson.cards.toTest': {
    group: 'lesson',
    default: 'La verificare',
    description: 'Butonul de pe ultimul card, când urmează întrebările',
  },
  'lesson.cards.skip': {
    group: 'lesson',
    default: 'Sari la verificare',
    description: 'Linkul de sub carduri care sare direct la întrebări',
  },

  // Test (questions)
  'lesson.test.title': {
    group: 'lesson',
    default: 'Întrebarea {n} din {total}',
    vars: ['n', 'total'],
    description: 'Titlul din bara de sus în timpul testului',
  },
  'lesson.test.check': {
    group: 'lesson',
    default: 'Verifică',
    description: 'Butonul care verifică răspunsul ales',
  },
  'lesson.test.next': {
    group: 'lesson',
    default: 'Următoarea întrebare',
    description: 'Butonul de după verificarea unui răspuns, când mai urmează întrebări',
  },
  'lesson.test.type.singleChoice': {
    group: 'lesson',
    default: 'Alegere unică',
    description: 'Tipul întrebării, deasupra enunțului',
  },
  'lesson.test.type.multipleChoice': {
    group: 'lesson',
    default: 'Alegere multiplă',
    description: 'Tipul întrebării, deasupra enunțului',
  },
  'lesson.test.type.chronologicalOrder': {
    group: 'lesson',
    default: 'Ordine cronologică',
    description: 'Tipul întrebării, deasupra enunțului',
  },
  'lesson.test.difficulty.easy': {
    group: 'lesson',
    default: 'ușor',
    description: 'Eticheta de dificultate de lângă tipul întrebării',
  },
  'lesson.test.difficulty.medium': {
    group: 'lesson',
    default: 'mediu',
    description: 'Eticheta de dificultate de lângă tipul întrebării',
  },
  'lesson.test.difficulty.hard': {
    group: 'lesson',
    default: 'dificil',
    description: 'Eticheta de dificultate de lângă tipul întrebării',
  },
  'lesson.test.multipleHint': {
    group: 'lesson',
    default: 'Alege toate variantele corecte.',
    description: 'Sub enunțul unei întrebări cu alegere multiplă',
  },
  'lesson.test.right': {
    group: 'lesson',
    default: 'Corect, bravo!',
    description: 'Verdictul după un răspuns corect',
  },
  'lesson.test.wrong': {
    group: 'lesson',
    default: 'Nu chiar.',
    description: 'Verdictul după un răspuns greșit',
  },
  'lesson.test.correctAnswer': {
    group: 'lesson',
    default: 'Răspuns corect: {raspuns}',
    vars: ['raspuns'],
    description: 'După un răspuns greșit (sub verdict) și în lista greșelilor: varianta corectă',
  },
  'lesson.test.correctAnswers': {
    group: 'lesson',
    default: 'Răspunsuri corecte: {raspunsuri}',
    vars: ['raspunsuri'],
    description: 'În lista greșelilor, pentru o întrebare cu mai multe variante corecte',
  },
  'lesson.test.seeAbove': {
    group: 'lesson',
    default: 'Vezi răspunsul corect mai sus.',
    description: 'Sub verdictul greșit, când răspunsul corect e prea lung pentru bara de jos',
  },
  'lesson.test.correctOrder': {
    group: 'lesson',
    default: 'Ordinea corectă:',
    description: 'Titlul casetei cu ordinea corectă, după o ordine cronologică greșită',
  },
  'lesson.test.option.right': {
    group: 'lesson',
    default: '{varianta}, corect',
    vars: ['varianta'],
    description: 'Cum citește cititorul de ecran, după verificare, o variantă corectă pe care elevul nu a ales-o',
  },
  'lesson.test.option.rightPicked': {
    group: 'lesson',
    default: '{varianta}, corect, ai ales-o',
    vars: ['varianta'],
    description: 'Cum citește cititorul de ecran, după verificare, o variantă corectă aleasă de elev',
  },
  'lesson.test.option.wrongPicked': {
    group: 'lesson',
    default: '{varianta}, greșit, ai ales-o',
    vars: ['varianta'],
    description: 'Cum citește cititorul de ecran, după verificare, o variantă greșită aleasă de elev',
  },
  'lesson.test.order.inPlace': {
    group: 'lesson',
    default: '{n}. {text}, poziție corectă',
    vars: ['n', 'text'],
    description: 'Cum citește cititorul de ecran, după verificare, un eveniment pus la locul lui',
  },
  'lesson.test.order.misplaced': {
    group: 'lesson',
    default: '{n}. {text}, poziție greșită',
    vars: ['n', 'text'],
    description: 'Cum citește cititorul de ecran, după verificare, un eveniment pus greșit',
  },
  'lesson.test.order.moveUp': {
    group: 'lesson',
    default: 'Mută în sus: {text}',
    vars: ['text'],
    description: 'Numele citit de cititorul de ecran pentru săgeata în sus a unui eveniment',
  },
  'lesson.test.order.moveDown': {
    group: 'lesson',
    default: 'Mută în jos: {text}',
    vars: ['text'],
    description: 'Numele citit de cititorul de ecran pentru săgeata în jos a unui eveniment',
  },

  // Result screens
  'lesson.result.finishedTitle': {
    group: 'lesson',
    default: 'Lecție terminată',
    description: 'Titlul din bara de sus a ecranului de final al unei lecții trecute',
  },
  'lesson.result.done': {
    group: 'lesson',
    default: 'Ai terminat lecția!',
    description: 'Explorare liberă: titlul mare de la finalul lecției',
  },
  'lesson.result.passed': {
    group: 'lesson',
    default: 'Lecție terminată! 🎉',
    description: 'Traseu ghidat: titlul mare după un test cu toate răspunsurile corecte',
  },
  'lesson.result.score': {
    group: 'lesson',
    default: '{corecte} din {total} întrebări corecte',
    vars: ['corecte', 'total'],
    description: 'Scorul de la finalul lecției (și numele cercului cu scorul)',
  },
  'lesson.result.unlocked': {
    group: 'lesson',
    default: 'Ai deblocat: {titlu}',
    vars: ['titlu'],
    description: 'Traseu ghidat: lecția deschisă de testul trecut',
  },
  'lesson.result.consolidationUnlocked': {
    group: 'lesson',
    default: 'Consolidare deblocată',
    description: 'Caseta de la finalul lecției care anunță exercițiile de consolidare',
  },
  'lesson.result.consolidationUnlockedHint': {
    group: 'lesson',
    default: 'Exersează cerințele de BAC pe lecția asta',
    description: 'Sub „Consolidare deblocată”',
  },
  'lesson.result.startConsolidation': {
    group: 'lesson',
    default: 'Începe consolidarea',
    description: 'Butonul de la finalul lecției care deschide consolidarea',
  },
  'lesson.result.nextLesson': {
    group: 'lesson',
    default: 'Mergi la lecția următoare',
    description: 'Butonul de la finalul lecției spre lecția următoare',
  },
  'lesson.result.goHome': {
    group: 'lesson',
    default: 'Înapoi acasă',
    description: 'Butonul de la finalul lecției spre Acasă',
  },
  'lesson.result.failedTitle': {
    group: 'lesson',
    default: 'Rezultatul testului',
    description: 'Traseu ghidat: titlul din bara de sus după un test picat',
  },
  'lesson.result.almost': {
    group: 'lesson',
    default: 'Aproape!',
    description: 'Traseu ghidat: titlul mare după un test picat',
  },
  'lesson.result.failedBody': {
    group: 'lesson',
    default: 'Ca să treci mai departe, ai nevoie de toate răspunsurile corecte. Revezi cardurile și încearcă din nou.',
    description: 'Traseu ghidat: textul de sub „Aproape!”',
  },
  'lesson.result.mistakes': {
    group: 'lesson',
    default: 'Ai greșit la:',
    description: 'Titlul listei cu întrebările greșite',
  },
  'lesson.result.mistake': {
    group: 'lesson',
    default: 'Întrebarea {n} · {intrebare}',
    vars: ['n', 'intrebare'],
    description: 'O întrebare greșită din listă (se deschide cu răspunsul corect)',
  },
  'lesson.result.mistakeNumber': {
    group: 'lesson',
    default: 'Întrebarea {n}',
    vars: ['n'],
    description: 'O întrebare greșită din listă, când enunțul ei nu mai e disponibil',
  },
  'lesson.result.correctOrder': {
    group: 'lesson',
    default: 'Ordinea corectă: {ordine}',
    vars: ['ordine'],
    description: 'În lista greșelilor: ordinea corectă a unei întrebări de ordine cronologică',
  },
  'lesson.result.reviewCards': {
    group: 'lesson',
    default: 'Revezi cardurile',
    description: 'Traseu ghidat: butonul care redeschide cardurile după un test picat',
  },
  'lesson.result.retakeNow': {
    group: 'lesson',
    default: 'Reia testul acum',
    description: 'Traseu ghidat: butonul care reia testul după un test picat',
  },
} as const satisfies Record<string, TextEntry>;
