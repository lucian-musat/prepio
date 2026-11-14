import type { TextEntry } from '../types';

/** Credits: the top-bar pill, „Creditele mele”, the packages, the „Îți mai trebuie” sheet and the cost tag. */
export const creditsTexts = {
  'credits.count.one': { group: 'credits', default: 'credit', description: 'Forma de singular din „1 credit”' },
  'credits.count.many': { group: 'credits', default: 'credite', description: 'Forma de plural din „2 credite”, „20 de credite”' },
  'credits.footnote': {
    group: 'credits',
    default: 'Plățile nu sunt active încă, așa că pachetul ți se adaugă gratuit.',
    description: 'Nota de sub pachete și din fereastra de ofertă (cât plățile nu sunt active)',
  },

  // Top-bar pill
  'credits.chip.full': { group: 'credits', default: '★ Acces ·', description: 'Bara de sus: planul cu acces complet, înaintea soldului' },
  'credits.chip.fullLabel': { group: 'credits', default: 'Acces complet', description: 'Pentru cititorul de ecran: planul din bara de sus' },
  'credits.chip.expiring': { group: 'credits', default: '⏳ {zile} ·', vars: ['zile'], description: 'Bara de sus în ultimele 7 zile; {zile} este de forma „5 zile”' },
  'credits.chip.expiringLabel': { group: 'credits', default: 'Acces complet încă {zile}', vars: ['zile'], description: 'Pentru cititorul de ecran' },
  'credits.chip.expired': { group: 'credits', default: 'Expirat ·', description: 'Bara de sus după expirare' },
  'credits.chip.expiredLabel': { group: 'credits', default: 'Acces expirat', description: 'Pentru cititorul de ecran' },
  'credits.chip.trial': { group: 'credits', default: 'Probă ·', description: 'Bara de sus în perioada de probă' },
  'credits.chip.trialLabel': { group: 'credits', default: 'Perioadă de probă', description: 'Pentru cititorul de ecran' },
  'credits.chip.label': {
    group: 'credits',
    default: '{plan}, {credite}, deschide accesul',
    vars: ['plan', 'credite'],
    description: 'Pentru cititorul de ecran: butonul din bara de sus; {credite} este de forma „12 credite”',
  },

  // Cost tag on an exercise
  'credits.costTag.text': { group: 'credits', default: '✦ Profesorul digital ·', description: 'Eticheta de cost a unui exercițiu, înaintea numărului de credite' },
  'credits.costTag.perRequirement': { group: 'credits', default: '/ cerință', description: 'După costul unui eseu (pe fiecare cerință)' },
  'credits.costTag.label': { group: 'credits', default: 'Profesorul digital, costă {credite}', vars: ['credite'], description: 'Pentru cititorul de ecran: eticheta de cost' },
  'credits.costTag.labelPerRequirement': {
    group: 'credits',
    default: 'Profesorul digital, costă {credite} pe cerință',
    vars: ['credite'],
    description: 'Pentru cititorul de ecran: eticheta de cost a unui eseu',
  },

  // Packages
  'credits.packages.loading': { group: 'credits', default: 'Se încarcă pachetele', description: 'Pentru cititorul de ecran' },
  'credits.packages.loadFailed': { group: 'credits', default: 'Nu am putut încărca pachetele.' },
  'credits.packages.empty': { group: 'credits', default: 'Nu sunt pachete disponibile acum.' },
  'credits.packages.featured': { group: 'credits', default: 'CEL MAI POPULAR', description: 'Insigna pachetului recomandat' },
  'credits.packages.option': {
    group: 'credits',
    default: '{credite}, {pret}, {pretCredit}',
    vars: ['credite', 'pret', 'pretCredit'],
    description: 'Pentru cititorul de ecran: un pachet; {pretCredit} este de forma „0,40 lei / credit”',
  },
  'credits.packages.optionFeatured': {
    group: 'credits',
    default: '{credite}, {pret}, {pretCredit}, cel mai ales',
    vars: ['credite', 'pret', 'pretCredit'],
    description: 'Pentru cititorul de ecran: pachetul recomandat',
  },
  'credits.packages.buy': { group: 'credits', default: 'Cumpără {credite} · {pret}', vars: ['credite', 'pret'], description: 'Butonul de cumpărare a pachetului ales' },
  'credits.packages.buyNone': { group: 'credits', default: 'Cumpără', description: 'Butonul de cumpărare, fără pachet ales' },

  // „Îți mai trebuie” sheet
  'credits.buy.missing': { group: 'credits', default: 'Îți mai trebuie {credite}', vars: ['credite'], description: 'Titlul ferestrei când soldul nu ajunge' },
  'credits.buy.lead.exercise': { group: 'credits', default: 'Verificarea cu profesorul digital costă', description: 'Începutul frazei de cost, la un exercițiu (urmează moneda și numărul)' },
  'credits.buy.lead.bac': { group: 'credits', default: 'Corectarea lucrării costă', description: 'Începutul frazei de cost, la un subiect BAC (urmează moneda și numărul)' },
  'credits.buy.tail.exercise': { group: 'credits', default: 'la acest exercițiu', description: 'După numărul de credite, la un exercițiu' },
  'credits.buy.havePrefix': { group: 'credits', default: 'Ai', description: '„Ai 3.” — înaintea soldului îngroșat' },
  'credits.buy.kept.exercise': { group: 'credits', default: 'Răspunsul tău rămâne salvat.' },
  'credits.buy.kept.bac': { group: 'credits', default: 'Răspunsurile tale rămân salvate.' },
  'credits.buy.skip': { group: 'credits', default: 'Sari peste exercițiu' },
  'credits.buy.added': { group: 'credits', default: 'Credite adăugate!', description: 'După cumpărarea unui pachet' },
  'credits.buy.have': { group: 'credits', default: 'Acum ai {credite}.', vars: ['credite'], description: 'După cumpărarea unui pachet' },
  'credits.buy.action.exercise': { group: 'credits', default: 'Verifică acum', description: 'După cumpărare: rulează verificarea blocată' },
  'credits.buy.action.bac': { group: 'credits', default: 'Trimite acum', description: 'După cumpărare: trimite lucrarea BAC' },
  'credits.buy.back.exercise': { group: 'credits', default: 'Înapoi la exercițiu', description: 'Înapoi la exercițiu (după cumpărarea de credite sau de acces)' },
  'credits.buy.back.bac': { group: 'credits', default: 'Înapoi la lucrare', description: 'Înapoi la lucrarea BAC (după cumpărarea de credite sau de acces)' },

  // „Creditele mele”
  'credits.screen.title': { group: 'credits', default: 'Creditele mele', description: 'Titlul paginii de credite (și rândul din Profil care o deschide)' },
  'credits.screen.balance': { group: 'credits', default: 'Sold', description: 'Eticheta mică de deasupra soldului' },
  'credits.screen.estimate': { group: 'credits', default: '≈ {min}–{max} verificări', vars: ['min', 'max'], description: 'Sub sold: câte verificări ajung' },
  'credits.screen.buyTitle': { group: 'credits', default: 'Cumpără credite' },
  'credits.screen.historyTitle': { group: 'credits', default: 'Istoric' },
  'credits.screen.loadingHistory': { group: 'credits', default: 'Se încarcă istoricul', description: 'Pentru cititorul de ecran' },
  'credits.screen.loadFailed': { group: 'credits', default: 'Nu am putut încărca istoricul.' },
  'credits.screen.empty': { group: 'credits', default: 'Încă nu ai folosit credite.' },
  'credits.screen.loadMore': { group: 'credits', default: 'Încarcă mai multe' },
  'credits.screen.rowBalance': { group: 'credits', default: 'sold {n}', vars: ['n'], description: 'Sub un rând din istoric: soldul după mișcare' },
  'credits.screen.gain': { group: 'credits', default: 'plus {credite}', vars: ['credite'], description: 'Pentru cititorul de ecran: suma unui rând primit' },
  'credits.screen.spend': { group: 'credits', default: 'minus {credite}', vars: ['credite'], description: 'Pentru cititorul de ecran: suma unui rând cheltuit' },

  // Ledger row names
  'credits.ledger.welcome': { group: 'credits', default: 'Credite de bun venit', description: 'Rând din istoric' },
  'credits.ledger.purchase': { group: 'credits', default: 'Pachet {credite}', vars: ['credite'], description: 'Rând din istoric: un pachet cumpărat' },
  'credits.ledger.accessBonus': { group: 'credits', default: 'Credite incluse în acces', description: 'Rând din istoric' },
  'credits.ledger.accessBonusReferral': { group: 'credits', default: 'Credite incluse în accesul gratuit din recomandări', description: 'Rând din istoric' },
  'credits.ledger.refund': { group: 'credits', default: 'Verificare nereușită · returnat', description: 'Rând din istoric: credite returnate după o verificare eșuată' },
  'credits.ledger.referral': { group: 'credits', default: 'Recomandare', description: 'Rând din istoric: recompensă pentru un coleg invitat' },
  'credits.ledger.referralNamed': { group: 'credits', default: 'Recomandare: {nume}', vars: ['nume'], description: 'Rând din istoric: recompensă, cu prenumele colegului' },
  'credits.ledger.admin': { group: 'credits', default: 'Ajustare', description: 'Rând din istoric: modificare făcută de un administrator' },
  'credits.ledger.adminReason': { group: 'credits', default: 'Ajustare · {motiv}', vars: ['motiv'], description: 'Rând din istoric: modificare cu motiv' },
  'credits.ledger.check': { group: 'credits', default: 'Verificare cu profesorul digital', description: 'Rând din istoric: verificarea unui exercițiu șters' },
  'credits.ledger.essay': { group: 'credits', default: 'Eseu', description: 'Rând din istoric: verificarea unui eseu' },
  'credits.ledger.essayWhole': { group: 'credits', default: 'eseul întreg', description: '„Eseu · eseul întreg” (rânduri vechi)' },
  'credits.ledger.essayRequirement': { group: 'credits', default: 'cerința {n}', vars: ['n'], description: '„Eseu · cerința 2”' },
  'credits.ledger.bacCheck': { group: 'credits', default: 'Corectare subiect', description: 'Rând din istoric: corectarea unui subiect BAC' },
  'credits.ledger.bacRefund': { group: 'credits', default: 'Corectare nereușită · returnat', description: 'Rând din istoric: credite returnate după o corectare BAC eșuată' },
} as const satisfies Record<string, TextEntry>;
