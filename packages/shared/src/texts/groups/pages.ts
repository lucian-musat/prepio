import type { TextEntry } from '../types';

/**
 * Public explanation pages: „Cum funcționează recomandările” (/recomandari) and „Ștergerea contului” (/sterge-cont).
 * The Terms of use and the Privacy policy are not here: their text is versioned and stays in code.
 */
export const pagesTexts = {
  // „Cum funcționează recomandările” (/recomandari)
  'pages.referrals.title': { group: 'pages', default: 'Cum funcționează recomandările', description: 'Titlul paginii cu regulile recomandărilor' },
  'pages.referrals.fallback.colleagues': {
    group: 'pages',
    default: 'numărul de colegi stabilit de Prepio',
    description: 'Pus în locul numărului de colegi când valorile actuale nu se pot încărca',
  },
  'pages.referrals.fallback.credits': {
    group: 'pages',
    default: 'numărul de credite stabilit de Prepio',
    description: 'Pus în locul numărului de credite când valorile actuale nu se pot încărca',
  },
  'pages.referrals.fallback.duration': {
    group: 'pages',
    default: 'perioada stabilită de Prepio',
    description: 'Pus în locul duratei accesului gratuit când valorile actuale nu se pot încărca',
  },
  'pages.referrals.bonus.unknown': {
    group: 'pages',
    default: 'Accesul gratuit este la fel ca un acces cumpărat: aceleași lecții, aceleași funcții și aceleași credite bonus incluse ca la o cumpărare.',
    description: 'Ce include accesul gratuit, când valorile actuale nu se pot încărca',
  },
  'pages.referrals.bonus.included': {
    group: 'pages',
    default: 'Accesul gratuit este la fel ca un acces cumpărat: aceleași lecții, aceleași funcții și aceleași credite bonus incluse (acum {credite}).',
    vars: ['credite'],
    description: 'Ce include accesul gratuit, când accesul cumpărat vine cu credite bonus; {credite} este de forma „100 de credite”',
  },
  'pages.referrals.bonus.none': {
    group: 'pages',
    default: 'Accesul gratuit este la fel ca un acces cumpărat: aceleași lecții, aceleași funcții. Acum accesul cumpărat nu include credite bonus, deci nici accesul gratuit.',
    description: 'Ce include accesul gratuit, când accesul cumpărat nu vine cu credite bonus',
  },
  'pages.referrals.off.title': { group: 'pages', default: 'Recomandările nu sunt active acum.', description: 'Anunțul de sus, când recomandările sunt oprite' },
  'pages.referrals.off.body': {
    group: 'pages',
    default: 'Poți citi regulile, dar acum nu se primesc recompense și codurile nu sunt acceptate.',
    description: 'Sub anunțul că recomandările sunt oprite',
  },

  'pages.referrals.short.title': { group: 'pages', default: 'Pe scurt', description: 'Prima secțiune (mereu deschisă)' },
  'pages.referrals.short.intro': {
    group: 'pages',
    default: 'Dai codul sau linkul tău unui coleg. Când acel coleg își cumpără acces la Prepio, tu primești o recompensă.',
  },
  'pages.referrals.short.noAccess': {
    group: 'pages',
    default:
      'Dacă nu ai acces activ (ești în perioada de probă sau accesul a expirat): colegii care își cumpără acces se adună. Când ai {colegi}, primești {durata} de acces gratuit.',
    vars: ['colegi', 'durata'],
    description: '„Pe scurt”, fără credite bonus (sau fără valorile actuale); {colegi} este de forma „5 colegi”, {durata} de forma „3 luni”',
  },
  'pages.referrals.short.noAccessWithBonus': {
    group: 'pages',
    default:
      'Dacă nu ai acces activ (ești în perioada de probă sau accesul a expirat): colegii care își cumpără acces se adună. Când ai {colegi}, primești {durata} de acces gratuit, cu {credite} bonus incluse.',
    vars: ['colegi', 'durata', 'credite'],
    description: '„Pe scurt”, când accesul vine cu credite bonus; {credite} este de forma „100 de credite”',
  },
  'pages.referrals.short.active': {
    group: 'pages',
    default: 'Dacă ai acces activ: primești {credite} pentru fiecare coleg care își cumpără acces, imediat.',
    vars: ['credite'],
    description: '{credite} este de forma „40 de credite”',
  },

  'pages.referrals.paid.title': { group: 'pages', default: 'Cine este un coleg care a plătit' },
  'pages.referrals.paid.firstPurchase': {
    group: 'pages',
    default: 'Un coleg se numără când își cumpără accesul complet pentru prima dată. Contează doar prima cumpărare; reînnoirile nu aduc nimic în plus.',
  },
  'pages.referrals.paid.adminAccess': { group: 'pages', default: 'Accesul primit de la un administrator nu contează ca plată.' },
  'pages.referrals.paid.notYet': {
    group: 'pages',
    default: 'Un coleg care și-a creat cont cu codul tău, dar nu a cumpărat nimic, nu aduce nicio recompensă (încă).',
  },

  'pages.referrals.noAccess.title': { group: 'pages', default: 'Dacă nu ai acces activ (probă sau expirat)' },
  'pages.referrals.noAccess.counted': {
    group: 'pages',
    default: 'Fiecare coleg care își cumpără acces este numărat. Când ai {colegi}, primești {durata} de acces gratuit.',
    vars: ['colegi', 'durata'],
    description: '{colegi} este de forma „5 colegi”, {durata} de forma „3 luni”',
  },
  'pages.referrals.noAccess.waiting': {
    group: 'pages',
    default:
      'Colegii care așteaptă rămân numărați până sunt folosiți pentru accesul gratuit sau până îți cumperi acces cât timp recomandările sunt pornite (atunci se transformă în credite). Ei nu expiră, nici dacă îți expiră ție accesul.',
  },
  'pages.referrals.noAccess.usedOnce': {
    group: 'pages',
    default: 'Un coleg este folosit o singură dată. După ce primești accesul gratuit, numărătoarea continuă cu colegii care nu au fost încă numărați.',
  },
  'pages.referrals.noAccess.onePeriod': {
    group: 'pages',
    default:
      'Primești cel mult o perioadă de acces gratuit pentru fiecare coleg care plătește. Dacă mai mulți colegi așteaptă decât este nevoie, ceilalți rămân la rând pentru data viitoare.',
  },

  'pages.referrals.active.title': { group: 'pages', default: 'Dacă ai acces activ' },
  'pages.referrals.active.credits': {
    group: 'pages',
    default: 'Primești {credite} pentru fiecare coleg care își cumpără acces, imediat ce plătește.',
    vars: ['credite'],
    description: '{credite} este de forma „40 de credite”',
  },
  'pages.referrals.active.meaning': {
    group: 'pages',
    default: 'Un acces activ înseamnă orice acces care nu a expirat, cumpărat sau dat de un administrator.',
  },
  'pages.referrals.active.moment': {
    group: 'pages',
    default: 'Contează momentul în care plătește colegul: dacă atunci ai acces activ, primești credite; dacă nu, colegul așteaptă.',
  },

  'pages.referrals.buy.title': { group: 'pages', default: 'Dacă îți cumperi tu acces' },
  'pages.referrals.buy.converted': {
    group: 'pages',
    default: 'Cât timp recomandările sunt pornite, colegii care așteaptă la tine se transformă în credite: primești {credite} pentru fiecare.',
    vars: ['credite'],
    description: '{credite} este de forma „40 de credite”',
  },
  'pages.referrals.buy.notBoth': {
    group: 'pages',
    default: 'Nu primești și acces gratuit pentru aceiași colegi: un coleg aduce fie acces gratuit, fie credite, niciodată amândouă.',
  },
  'pages.referrals.buy.adminAccess': {
    group: 'pages',
    default: 'Accesul oferit de un administrator nu transformă colegii în credite; doar cumpărarea ta o face.',
  },

  'pages.referrals.examples.title': { group: 'pages', default: 'Exemple' },
  'pages.referrals.examples.anaQ': { group: 'pages', default: 'Ana nu are acces', description: 'Titlul primului exemplu' },
  'pages.referrals.examples.anaA': {
    group: 'pages',
    default:
      'Ana este în perioada de probă și invită colegi. Pe rând, colegii ei își cumpără acces, iar Prepio îi numără. Când ajung la {colegi}, Ana primește {durata} de acces gratuit. Cei care nu au fost încă numărați se adună pentru perioada următoare.',
    vars: ['colegi', 'durata'],
    description: 'Primul exemplu, fără credite bonus',
  },
  'pages.referrals.examples.anaAWithBonus': {
    group: 'pages',
    default:
      'Ana este în perioada de probă și invită colegi. Pe rând, colegii ei își cumpără acces, iar Prepio îi numără. Când ajung la {colegi}, Ana primește {durata} de acces gratuit, cu {credite} bonus incluse. Cei care nu au fost încă numărați se adună pentru perioada următoare.',
    vars: ['colegi', 'durata', 'credite'],
    description: 'Primul exemplu, când accesul vine cu credite bonus; {credite} este de forma „100 de credite”',
  },
  'pages.referrals.examples.mihaiQ': { group: 'pages', default: 'Mihai are acces', description: 'Titlul celui de-al doilea exemplu' },
  'pages.referrals.examples.mihaiA': {
    group: 'pages',
    default: 'Mihai are acces activ. Doi colegi de-ai lui își cumpără acces. Mihai primește câte {credite} pentru fiecare, adică 2 × {credite} = {total}, imediat.',
    vars: ['credite', 'total'],
    description: '{credite} este de forma „40 de credite”, {total} de forma „80 de credite”',
  },
  'pages.referrals.examples.ioanaQ': { group: 'pages', default: 'Ioana își cumpără acces', description: 'Titlul celui de-al treilea exemplu' },
  'pages.referrals.examples.ioanaA': {
    group: 'pages',
    default:
      'Ioana nu avea acces, iar un coleg de-al ei își cumpărase deja acces și aștepta. Când Ioana își cumpără și ea acces, cât timp recomandările sunt pornite, colegul care aștepta se transformă în {credite} pentru ea.',
    vars: ['credite'],
    description: '{credite} este de forma „40 de credite”',
  },
  'pages.referrals.examples.unavailable': {
    group: 'pages',
    default: 'Exemplele cu cifre apar când Prepio poate încărca valorile actuale. Încearcă din nou mai târziu.',
    description: 'În locul exemplelor, când valorile actuale nu se pot încărca',
  },

  'pages.referrals.code.title': { group: 'pages', default: 'Cum se folosește codul' },
  'pages.referrals.code.signUpOnly': {
    group: 'pages',
    default: 'Codul sau linkul se folosesc doar la înregistrare, în aplicația Prepio. Nu poți introduce un cod după ce ai terminat înregistrarea.',
  },
  'pages.referrals.code.newAccount': {
    group: 'pages',
    default:
      'Contul trebuie să fie nou: creat în ultimele 24 de ore, cu înregistrarea neterminată (termeni, nume și mod de învățare), fără cumpărături și fără lecții începute.',
  },
  'pages.referrals.code.olderInviter': {
    group: 'pages',
    default: 'Contul celui care te invită trebuie să fie mai vechi decât al tău. Nu îți poți folosi propriul cod.',
  },
  'pages.referrals.code.oneInviter': {
    group: 'pages',
    default: 'Poți avea un singur invitator. O singură persoană te poate invita, iar alegerea nu se mai schimbă.',
  },
  'pages.referrals.code.whenOff': { group: 'pages', default: 'Cât timp recomandările sunt oprite, codurile nu sunt acceptate.' },

  'pages.referrals.rules.title': { group: 'pages', default: 'Reguli importante' },
  'pages.referrals.rules.keepReward': {
    group: 'pages',
    default: 'Nu pierzi recompensa dacă colegul tău renunță la acces sau i se returnează banii mai târziu: ce ai primit rămâne al tău.',
  },
  'pages.referrals.rules.cap': {
    group: 'pages',
    default:
      'Poți primi recompense pentru cel mult {colegi} (limita se verifică la prima plată a fiecărui coleg). Un coleg care plătește după ce limita a fost atinsă apare în listă ca „Are acces · fără recompensă (ai atins limita)”.',
    vars: ['colegi'],
    description: '{colegi} este limita, de forma „100 de colegi”; textul din ghilimele este cel din lista „Invită colegi”',
  },
  'pages.referrals.rules.once': { group: 'pages', default: 'Un coleg nu aduce recompensă de două ori.' },
  'pages.referrals.rules.valuesChange': {
    group: 'pages',
    default:
      'Valorile (colegi necesari, credite, durata accesului) se pot schimba. Ce ai primit deja nu se modifică; la recompensele următoare se aplică valorile din acel moment.',
  },

  'pages.referrals.inviter.title': { group: 'pages', default: 'Ce vede cel care te-a invitat' },
  'pages.referrals.inviter.sees': {
    group: 'pages',
    default:
      'Cel care te-a invitat vede prenumele și adresa de email, și dacă ai cumpărat acces sau nu. Mai vede data înregistrării tale, data plății și dacă ai adus recompensă; nu vede altceva despre contul tău.',
  },
  'pages.referrals.inviter.youSee': { group: 'pages', default: 'Tu vezi doar prenumele celui care te-a invitat, când te înregistrezi.' },
  'pages.referrals.inviter.deleted': {
    group: 'pages',
    default:
      'Dacă îți ștergi contul după ce ai cumpărat acces, în lista celui care te-a invitat rămâne doar prenumele tău, marcat „cont șters”; adresa de email este ștearsă. Dacă nu ai cumpărat nimic, dispari din listă.',
  },

  'pages.referrals.where.title': { group: 'pages', default: 'Unde vezi recomandările' },
  'pages.referrals.where.invite': {
    group: 'pages',
    default: 'Ecranul „Invită colegi” (din pagina principală sau din Profil): codul tău, linkul, colegii invitați și cât mai ai până la accesul gratuit.',
  },
  'pages.referrals.where.credits': {
    group: 'pages',
    default:
      'Istoricul creditelor: creditele primite pentru recomandări apar cu prenumele colegului, iar creditele bonus ale accesului gratuit apar ca „Credite incluse în accesul gratuit din recomandări”.',
  },
  'pages.referrals.where.access': { group: 'pages', default: 'Istoricul accesului: accesul gratuit primit pentru recomandări apare acolo.' },
  'pages.referrals.where.noNotifications': {
    group: 'pages',
    default: 'Nu trimitem notificări: vezi schimbările data viitoare când deschizi ecranul „Invită colegi”.',
  },

  'pages.referrals.stopped.title': { group: 'pages', default: 'Dacă Prepio oprește recomandările' },
  'pages.referrals.stopped.noRewards': { group: 'pages', default: 'Cât timp sunt oprite, nu se mai primesc recompense și codurile nu mai sunt acceptate.' },
  'pages.referrals.stopped.kept': { group: 'pages', default: 'Recompensele deja primite rămân. Istoricul tău rămâne vizibil.' },
  'pages.referrals.stopped.paidWhileOff': {
    group: 'pages',
    default: 'Un coleg care plătește cât timp recomandările sunt oprite nu este recompensat, nici dacă ele sunt pornite din nou mai târziu.',
  },
  'pages.referrals.stopped.buyWhileOff': {
    group: 'pages',
    default:
      'Dacă îți cumperi acces cât timp recomandările sunt oprite, colegii care așteaptă nu se transformă în credite; rămân la rând și se transformă la o cumpărare următoare, făcută cât timp recomandările sunt pornite.',
  },

  'pages.referrals.faq.title': { group: 'pages', default: 'Întrebări frecvente' },
  'pages.referrals.faq.paidAfterQ': { group: 'pages', default: 'Invitatul a plătit după ce mi-am cumpărat eu accesul' },
  'pages.referrals.faq.paidAfterA': {
    group: 'pages',
    default: 'Cât timp ai acces activ în momentul în care plătește, primești {credite} pentru el, imediat. Nu așteaptă și nu se adună spre acces gratuit.',
    vars: ['credite'],
    description: '{credite} este de forma „40 de credite”',
  },
  'pages.referrals.faq.expiredQ': { group: 'pages', default: 'Mi-a expirat accesul' },
  'pages.referrals.faq.expiredA': {
    group: 'pages',
    default:
      'Colegii care plătesc cât timp nu ai acces activ se adună, iar la {colegi} primești {durata} de acces gratuit. Colegii deja adunați nu dispar. Dacă îți cumperi acces nou cât timp recomandările sunt pornite, se transformă în credite.',
    vars: ['colegi', 'durata'],
    description: '{colegi} este de forma „5 colegi”, {durata} de forma „3 luni”',
  },
  'pages.referrals.faq.deletedQ': { group: 'pages', default: 'Invitatul și-a șters contul' },
  'pages.referrals.faq.deletedA': {
    group: 'pages',
    default: 'Dacă plătise deja, recompensa rămâne și el rămâne în lista ta, cu prenumele și mențiunea „cont șters”. Dacă nu plătise, dispare din listă.',
  },
  'pages.referrals.faq.codeLaterQ': { group: 'pages', default: 'Pot introduce codul după ce m-am înregistrat?' },
  'pages.referrals.faq.codeLaterA': { group: 'pages', default: 'Nu. Codul se introduce doar la înregistrare. După aceea, nu se mai poate adăuga.' },
  'pages.referrals.faq.missingQ': { group: 'pages', default: 'De ce nu apare invitatul în listă?' },
  'pages.referrals.faq.missingA': {
    group: 'pages',
    default:
      'Un coleg apare în listă doar dacă și-a creat contul cu codul tău. Dacă a intrat fără cod, a introdus codul după înregistrare, are un cont mai vechi de 24 de ore sau recomandările erau oprite, nu este legat de tine. Un coleg care și-a șters contul înainte să plătească dispare din listă.',
  },
  'pages.referrals.faq.refundQ': { group: 'pages', default: 'Se pierd recompensele dacă invitatul anulează?' },
  'pages.referrals.faq.refundA': { group: 'pages', default: 'Nu. Odată ce a plătit, recompensa rămâne.' },

  'pages.referrals.contact.title': { group: 'pages', default: 'Cui te adresezi' },
  'pages.referrals.contact.prefix': {
    group: 'pages',
    default: 'Pentru întrebări sau dacă ți se pare că ceva nu s-a calculat corect, scrie-ne la',
    description: 'Textul dinaintea adresei de email de contact',
  },
  'pages.referrals.contact.suffix': { group: 'pages', default: '.', description: 'Textul de după adresa de email de contact' },

  // „Ștergerea contului” (/sterge-cont)
  'pages.deleteAccount.title': { group: 'pages', default: 'Ștergerea contului', description: 'Titlul paginii publice despre ștergerea contului' },
  'pages.deleteAccount.signIn': { group: 'pages', default: 'Intră în cont', description: 'Butonul de jos, pentru cine nu e intrat în cont' },
  'pages.deleteAccount.goToProfile': { group: 'pages', default: 'Mergi la profil', description: 'Butonul de jos, pentru cine e intrat în cont' },
  'pages.deleteAccount.lead': {
    group: 'pages',
    default: 'Poți să îți ștergi contul Prepio oricând. Ștergerea este definitivă: după ce contul este șters, nu mai poate fi recuperat.',
  },
  'pages.deleteAccount.removed.title': { group: 'pages', default: 'Ce se șterge' },
  'pages.deleteAccount.removed.name': { group: 'pages', default: 'Numele și adresa de email din cont.' },
  'pages.deleteAccount.removed.login': { group: 'pages', default: 'Contul de autentificare, fie cel Google, fie cel cu cod trimis pe email.' },
  'pages.deleteAccount.removed.progress': {
    group: 'pages',
    default: 'Progresul la lecții, exercițiile de consolidare și lucrările BAC, cu notele lor.',
  },
  'pages.deleteAccount.removed.credits': { group: 'pages', default: 'Creditele și accesul rămase. Banii pentru ele nu se returnează.' },
  'pages.deleteAccount.removed.history': { group: 'pages', default: 'Istoricul creditelor și al plăților.' },
  'pages.deleteAccount.removed.inviteCode': {
    group: 'pages',
    default: 'Codul tău de invitație. Colegii pe care i-ai invitat își păstrează conturile.',
  },
  'pages.deleteAccount.kept.title': { group: 'pages', default: 'Ce nu se șterge' },
  'pages.deleteAccount.kept.content': {
    group: 'pages',
    default: 'Lecțiile și exercițiile sunt conținutul Prepio, nu datele tale, așa că rămân.',
  },
  'pages.deleteAccount.kept.fingerprint': {
    group: 'pages',
    default: 'Păstrăm doar o amprentă ireversibilă a adresei de email, ca să știm că ai primit deja creditele de bun venit. Din ea nu se poate afla adresa.',
  },
  'pages.deleteAccount.kept.referral': {
    group: 'pages',
    default:
      'Dacă ți-ai făcut cont cu linkul unui coleg și ți-ai cumpărat acces, colegul îți vede în continuare prenumele în lista lui, cu mențiunea „cont șters”.',
  },
  'pages.deleteAccount.how.title': { group: 'pages', default: 'Cum îl ștergi' },
  'pages.deleteAccount.how.signedOut': {
    group: 'pages',
    default: 'După ce intri, mergi la Profil → Șterge contul.',
    description: 'Pentru cine nu e intrat în cont',
  },
  'pages.deleteAccount.how.ready': {
    group: 'pages',
    default: 'Din Profil alegi Șterge contul și confirmi ștergerea.',
    description: 'Pentru cine e intrat în cont',
  },
  'pages.deleteAccount.how.needsName': {
    group: 'pages',
    default: 'După ce completezi numele, mergi la Profil → Șterge contul.',
    description: 'Pentru cine a intrat în cont, dar nu și-a completat încă numele',
  },
  'pages.deleteAccount.contact.prefix': { group: 'pages', default: 'Sau scrie-ne la', description: 'Textul dinaintea adresei de email de contact' },
  'pages.deleteAccount.contact.suffix': { group: 'pages', default: '.', description: 'Textul de după adresa de email de contact' },
} as const satisfies Record<string, TextEntry>;
