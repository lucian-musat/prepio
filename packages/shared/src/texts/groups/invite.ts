import type { TextEntry } from '../types';

/** „Invită colegi”: the student's code and link, the progress toward the reward and the invitees. */
export const inviteTexts = {
  'invite.screen.title': { group: 'invite', default: 'Invită colegi', description: 'Titlul paginii de invitații (și rândul din Profil care o deschide)' },
  'invite.loadFailed': { group: 'invite', default: 'Nu am putut încărca invitațiile.' },
  'invite.copied': { group: 'invite', default: 'Copiat ✓', description: 'După copierea linkului sau a codului' },
  'invite.copyFailed': { group: 'invite', default: 'Nu am putut copia.' },
  'invite.capReached': {
    group: 'invite',
    default: 'Ai ajuns la numărul maxim de colegi pentru care primești recompense. Îi poți invita în continuare, dar fără recompensă.',
  },
  'invite.shareMessage': {
    group: 'invite',
    default: 'Învăț pentru BAC cu Prepio. Dacă vrei să încerci și tu, fă-ți cont cu linkul meu: {link}',
    vars: ['link'],
    description: 'Mesajul trimis prin „Trimite linkul”',
  },
  'invite.colleague.one': { group: 'invite', default: 'coleg', description: 'Forma de singular din „1 coleg”' },
  'invite.colleague.many': { group: 'invite', default: 'colegi', description: 'Forma de plural din „3 colegi”' },
  'invite.duration.oneMonth': { group: 'invite', default: 'o lună', description: 'Durata accesului gratuit când e de o lună (altfel „3 luni”)' },

  // Referral row states
  'invite.status.registered': { group: 'invite', default: 'Și-a făcut cont, încă fără acces' },
  'invite.status.pending': { group: 'invite', default: 'Are acces · se numără pentru accesul tău gratuit' },
  'invite.status.consumedAccess': { group: 'invite', default: 'Are acces · a contat pentru accesul tău gratuit' },
  'invite.status.convertedCredits': { group: 'invite', default: 'Are acces · +{credite}', vars: ['credite'], description: '{credite} este de forma „40 de credite”' },
  'invite.status.overCap': { group: 'invite', default: 'Are acces · fără recompensă (ai atins limita)' },
  'invite.status.noReward': { group: 'invite', default: 'Are acces · fără recompensă' },

  // How it works
  'invite.how.title': { group: 'invite', default: 'Cum funcționează' },
  'invite.how.step1': { group: 'invite', default: 'Trimiți linkul tău colegilor.' },
  'invite.how.step2': { group: 'invite', default: 'Își fac cont cu el.' },
  'invite.how.rewardCredits': {
    group: 'invite',
    default: 'Pentru fiecare coleg care își cumpără acces primești {credite}.',
    vars: ['credite'],
    description: 'Al treilea pas, pentru un elev cu acces',
  },
  'invite.how.rewardFree': {
    group: 'invite',
    default: 'Când {prag} dintre ei își cumpără acces, primești {durata} gratis.',
    vars: ['prag', 'durata'],
    description: 'Al treilea pas, pentru un elev fără acces; {durata} este de forma „o lună” / „3 luni”',
  },

  // Summary
  'invite.summary.needMore': {
    group: 'invite',
    default: 'Mai ai nevoie de {colegi} care să-și cumpere acces și primești {durata} gratis',
    vars: ['colegi', 'durata'],
    description: '{colegi} este de forma „2 colegi”',
  },
  'invite.summary.progressLabel': { group: 'invite', default: 'Progres spre accesul gratuit', description: 'Pentru cititorul de ecran: bara de progres' },
  'invite.summary.progress': { group: 'invite', default: '{n} din {total}', vars: ['n', 'total'], description: 'Sub bara de progres' },
  'invite.summary.soFar': { group: 'invite', default: 'Până acum: {totaluri}', vars: ['totaluri'], description: '{totaluri}: rezultatele de mai jos, despărțite prin „ · ”' },
  'invite.summary.withAccess': { group: 'invite', default: '{colegi} cu acces', vars: ['colegi'] },
  'invite.summary.creditsEarnedOne': { group: 'invite', default: '{credite} câștigat', vars: ['credite'], description: '„1 credit câștigat”' },
  'invite.summary.creditsEarnedMany': { group: 'invite', default: '{credite} câștigate', vars: ['credite'], description: '„40 de credite câștigate”' },
  'invite.summary.periodOne': { group: 'invite', default: 'o perioadă de acces gratuit câștigată' },
  'invite.summary.periodMany': { group: 'invite', default: '{n} perioade de acces gratuit câștigate', vars: ['n'] },

  // Code and invitees
  'invite.code.label': { group: 'invite', default: 'Codul tău' },
  'invite.code.sendLink': { group: 'invite', default: 'Trimite linkul' },
  'invite.code.copyLink': { group: 'invite', default: 'Copiază linkul' },
  'invite.code.copyCode': { group: 'invite', default: 'Copiază codul', description: 'Pe web' },
  'invite.code.sendCode': { group: 'invite', default: 'Trimite codul', description: 'În aplicația de telefon' },
  'invite.list.title': { group: 'invite', default: 'Colegii invitați' },
  'invite.list.empty': { group: 'invite', default: 'Încă nu ai invitat pe nimeni. Trimite linkul de mai sus.' },
  'invite.list.anonymous': { group: 'invite', default: 'Coleg', description: 'Un coleg invitat fără prenume' },
  'invite.list.deleted': { group: 'invite', default: '{nume} · cont șters', vars: ['nume'], description: 'Un coleg invitat care și-a șters contul' },
  'invite.list.registered': { group: 'invite', default: 'Cont creat pe {data}', vars: ['data'] },
  'invite.list.paid': { group: 'invite', default: 'acces din {data}', vars: ['data'], description: 'După „Cont creat pe …”, despărțit prin „ · ”' },
  'invite.rules': { group: 'invite', default: 'Toate regulile ›', description: 'Legătura spre pagina cu regulile recomandărilor' },
} as const satisfies Record<string, TextEntry>;
