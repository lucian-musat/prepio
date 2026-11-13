import type { TextEntry } from '../types';

/**
 * Error copy. `errors.api.*` replace the `message` of the admin API's error responses: the app maps the response's
 * `code` to one of these keys (the server's own message is never shown). The defaults are the server's texts.
 */
export const errorsTexts = {
  // Screens
  'errors.crash.title': {
    group: 'errors',
    default: 'Ceva n-a mers bine',
    description: 'Titlul ecranului afișat când aplicația întâlnește o eroare neprevăzută',
  },
  'errors.crash.body': {
    group: 'errors',
    default: 'Am primit eroarea și ne uităm la ea. Încearcă din nou peste puțin timp.',
    description: 'Textul ecranului de eroare neprevăzută',
  },
  'errors.notFound.title': {
    group: 'errors',
    default: 'Pagina nu există',
    description: 'Titlul (și titlul filei din browser) pentru un link care nu duce nicăieri',
  },
  'errors.notFound.body': {
    group: 'errors',
    default: 'Linkul pe care l-ai urmat nu mai e valabil.',
    description: 'Textul paginii „Pagina nu există”',
  },

  // Produced by the app (no server reply)
  'errors.offline': {
    group: 'errors',
    default: 'Nu ne-am putut conecta. Verifică internetul și încearcă din nou.',
    description: 'Fără internet sau serverul nu răspunde',
  },
  'errors.sessionExpired': {
    group: 'errors',
    default: 'Sesiunea a expirat. Intră din nou în cont.',
    description: 'Sesiunea elevului nu mai e valabilă (aplicația îl scoate din cont)',
  },
  'errors.evaluate.timeout': {
    group: 'errors',
    default: 'Evaluarea durează prea mult. Încearcă din nou.',
    description: 'Verificarea cu profesorul digital nu a răspuns la timp',
  },
  'errors.evaluate.notConfigured': {
    group: 'errors',
    default: 'Evaluarea nu e disponibilă acum. Încearcă mai târziu.',
    description: 'Verificarea cu profesorul digital nu e configurată în această versiune a aplicației',
  },
  'errors.bac.timeout': {
    group: 'errors',
    default: 'Corectarea durează prea mult. Încearcă din nou.',
    description: 'Corectarea unui subiect BAC nu a răspuns la timp',
  },
  'errors.bac.notConfigured': {
    group: 'errors',
    default: 'Corectarea nu e disponibilă acum. Încearcă mai târziu.',
    description: 'Corectarea BAC nu e configurată în această versiune a aplicației',
  },
  'errors.bac.draftLocked': {
    group: 'errors',
    default: 'Subiectul este în curs de corectare.',
    description: 'Ciorna unui subiect BAC nu se mai poate salva: lucrarea se corectează',
  },
  'errors.purchase.failed': {
    group: 'errors',
    default: 'Cumpărarea nu a reușit. Încearcă din nou.',
    description: 'Cumpărarea de credite sau de acces a eșuat fără un motiv de la server',
  },
  'errors.purchase.timeout': {
    group: 'errors',
    default: 'Cumpărarea durează prea mult. Încearcă din nou.',
    description: 'Cumpărarea de credite sau de acces nu a răspuns la timp',
  },
  'errors.purchase.notConfigured': {
    group: 'errors',
    default: 'Cumpărarea nu e disponibilă acum. Încearcă mai târziu.',
    description: 'Cumpărarea nu e configurată în această versiune a aplicației',
  },
  'errors.accountDelete.notConfigured': {
    group: 'errors',
    default: 'Ștergerea contului nu e disponibilă acum. Încearcă mai târziu.',
    description: 'Ștergerea contului nu e configurată în această versiune a aplicației',
  },

  // Server replies, by error code (every endpoint)
  'errors.api.generic': {
    group: 'errors',
    default: 'Ceva n-a mers bine. Încearcă din nou.',
    description: 'Serverul a răspuns cu o eroare pe care aplicația nu o cunoaște',
  },
  'errors.api.badRequest': {
    group: 'errors',
    default: 'Cererea nu este validă.',
    description: 'Serverul a refuzat cererea (cod bad_request)',
  },
  'errors.api.unauthorized': {
    group: 'errors',
    default: 'Trebuie să fii autentificat.',
    description: 'Serverul nu a recunoscut sesiunea (cod unauthorized)',
  },
  'errors.api.suspended': {
    group: 'errors',
    default: 'Contul tău este suspendat.',
    description: 'Un administrator a suspendat contul (cod suspended)',
  },
  'errors.api.tooLong': {
    group: 'errors',
    default: 'Textul depășește {max} de caractere.',
    vars: ['max'],
    description: 'Răspunsul trimis e prea lung (cod too_long); {max} este limita',
  },

  // Consolidation check (/api/consolidation/evaluate)
  'errors.api.evaluate.empty': {
    group: 'errors',
    default: 'Scrie un text înainte de a-l trimite.',
    description: 'Verificare: răspuns gol (cod empty)',
  },
  'errors.api.evaluate.notFound': {
    group: 'errors',
    default: 'Exercițiul nu a fost găsit.',
    description: 'Verificare: exercițiul nu mai există (cod not_found)',
  },
  'errors.api.evaluate.rateLimited': {
    group: 'errors',
    default: 'Serviciul de evaluare este foarte solicitat azi. Încearcă din nou mâine.',
    description: 'Verificare: limita zilnică atinsă (cod rate_limited)',
  },
  'errors.api.evaluate.insufficientCredits': {
    group: 'errors',
    default: 'Nu ai destule credite pentru această verificare.',
    description: 'Verificare: credite insuficiente (cod insufficient_credits)',
  },
  'errors.api.evaluate.aiFailed': {
    group: 'errors',
    default: 'Evaluarea nu a reușit. Încearcă din nou.',
    description: 'Verificare: profesorul digital nu a răspuns (cod ai_failed, sau un răspuns ilizibil)',
  },
  'errors.api.evaluate.aiFailedRefunded': {
    group: 'errors',
    default: 'Verificarea nu a reușit. Nu ți-am luat niciun credit. Încearcă din nou.',
    description: 'Verificare: profesorul digital nu a răspuns, creditele au fost returnate (cod ai_failed)',
  },
  'errors.api.evaluate.accessRequired': {
    group: 'errors',
    default: 'Lecția face parte din accesul complet.',
    description: 'Verificare: lecția nu e inclusă în accesul elevului (cod access_required)',
  },

  // BAC grading (/api/bac/submit)
  'errors.api.bac.accessRequired': {
    group: 'errors',
    default: 'Subiectele BAC fac parte din accesul complet.',
    description: 'Corectare BAC: fără acces complet (cod access_required)',
  },
  'errors.api.bac.notFound': {
    group: 'errors',
    default: 'Subiectul nu a fost găsit.',
    description: 'Corectare BAC: subiectul nu mai există (cod not_found)',
  },
  'errors.api.bac.rateLimited': {
    group: 'errors',
    default: 'Corectarea nu este disponibilă acum. Încearcă din nou mai târziu.',
    description: 'Corectare BAC: prea multe corectări (cod rate_limited)',
  },
  'errors.api.bac.insufficientCredits': {
    group: 'errors',
    default: 'Nu ai destule credite pentru corectarea lucrării.',
    description: 'Corectare BAC: credite insuficiente (cod insufficient_credits)',
  },
  'errors.api.bac.alreadyGrading': {
    group: 'errors',
    default: 'Lucrarea se corectează deja.',
    description: 'Corectare BAC: lucrarea e deja trimisă (cod already_grading)',
  },
  'errors.api.bac.gradingFailed': {
    group: 'errors',
    default: 'Corectarea nu a reușit. Nu ți-am luat niciun credit. Încearcă din nou.',
    description: 'Corectare BAC: corectarea a eșuat (cod grading_failed, sau un răspuns ilizibil)',
  },

  // Credit purchase (/api/credits/purchase)
  'errors.api.credits.packageUnavailable': {
    group: 'errors',
    default: 'Pachetul nu mai este disponibil. Alege altul.',
    description: 'Cumpărare credite: pachetul ales a fost scos (cod package_unavailable)',
  },
  'errors.api.credits.serverError': {
    group: 'errors',
    default: 'Cumpărarea nu a reușit. Încearcă din nou.',
    description: 'Cumpărare credite: eroare pe server (cod server_error)',
  },

  // Access purchase (/api/access/purchase)
  'errors.api.access.offerChanged': {
    group: 'errors',
    default: 'Oferta s-a schimbat. Verifică noul preț.',
    description: 'Cumpărare acces: prețul sau oferta s-au schimbat între timp (cod offer_changed)',
  },
  'errors.api.access.serverError': {
    group: 'errors',
    default: 'Plata nu a reușit. Încearcă din nou.',
    description: 'Cumpărare acces: eroare pe server (cod server_error)',
  },

  // Account deletion (/api/account/delete)
  'errors.api.accountDelete.forbidden': {
    group: 'errors',
    default: 'Contul de administrator nu poate fi șters de aici.',
    description: 'Ștergere cont: contul este de administrator (cod forbidden)',
  },
  'errors.api.accountDelete.serverError': {
    group: 'errors',
    default: 'Contul nu a putut fi șters. Încearcă din nou.',
    description: 'Ștergere cont: eroare pe server (cod server_error, sau un răspuns ilizibil)',
  },
} as const satisfies Record<string, TextEntry>;
