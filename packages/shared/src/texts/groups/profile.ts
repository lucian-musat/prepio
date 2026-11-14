import type { TextEntry } from '../types';

/** The profile page and the account deletion confirmation (also on the suspended screen). */
export const profileTexts = {
  'profile.title': { group: 'profile', default: 'Profilul tău', description: 'Titlul paginii de profil' },
  'profile.name.label': { group: 'profile', default: 'Nume', description: 'Eticheta câmpului cu numele' },
  'profile.name.empty': { group: 'profile', default: 'Scrie-ți numele.', description: 'Numele e gol (profil și pasul cu numele)' },
  'profile.name.tooLong': {
    group: 'profile',
    default: 'Numele poate avea cel mult {max} de caractere.',
    vars: ['max'],
    description: 'Numele e prea lung (profil și pasul cu numele)',
  },
  'profile.name.saved': { group: 'profile', default: 'Numele a fost salvat.' },
  'profile.save': { group: 'profile', default: 'Salvează', description: 'Butonul de salvare a numelui' },
  'profile.account.line': { group: 'profile', default: '{email} · {metoda}', vars: ['email', 'metoda'], description: 'Sub nume: contul și felul în care elevul intră' },
  'profile.account.google': { group: 'profile', default: 'Google', description: 'Felul de intrare: cu Google' },
  'profile.account.emailCode': { group: 'profile', default: 'cod pe email', description: 'Felul de intrare: cu cod pe email' },
  'profile.mode.label': { group: 'profile', default: 'Mod de învățare' },
  'profile.mode.saved': { group: 'profile', default: 'Modul a fost salvat.' },
  'profile.mode.savedStale': {
    group: 'profile',
    default: 'Modul a fost salvat. Reîncarcă aplicația dacă nu vezi schimbarea.',
    description: 'Modul s-a salvat, dar profilul nu s-a putut reîncărca',
  },
  'profile.plan.expired': { group: 'profile', default: 'Expirat', description: 'Rândul „Acces la lecții”: accesul a expirat' },
  'profile.inviteWithProgress': {
    group: 'profile',
    default: 'Invită colegi, {progres}',
    vars: ['progres'],
    description: 'Pentru cititorul de ecran: rândul „Invită colegi” cu progresul (de forma „2/5”)',
  },
  'profile.reminder.title': { group: 'profile', default: 'Memento zilnic', description: 'Titlul secțiunii cu mementoul (doar în aplicația de telefon)' },
  'profile.reminder.switch': { group: 'profile', default: 'Notificare seara', description: 'Comutatorul mementoului' },
  'profile.reminder.time': { group: 'profile', default: 'Ora', description: 'Rândul cu ora mementoului' },
  'profile.reminder.blocked': { group: 'profile', default: 'Notificările sunt oprite din setările telefonului.' },
  'profile.reminder.openSettings': { group: 'profile', default: 'Deschide setările', description: 'Legătura spre setările telefonului' },
  'profile.reminder.note': { group: 'profile', default: 'Primești notificarea doar în zilele în care n-ai rezolvat încă niciun exercițiu.' },
  'profile.deleteAccount': { group: 'profile', default: 'Șterge contul', description: 'Butonul care cere confirmarea ștergerii contului' },
  'profile.privacyLink': { group: 'profile', default: 'Politica de confidențialitate', description: 'Legătura de pe profil' },
  'profile.termsLink': { group: 'profile', default: 'Termeni de utilizare', description: 'Legătura de pe profil' },

  // Account deletion confirmation (profile and suspended screen)
  'profile.delete.confirm': {
    group: 'profile',
    default: 'Ștergi contul definitiv? Se șterg numele, emailul, progresul, creditele și accesul, și nu le mai poți recupera.',
    description: 'Confirmarea ștergerii contului (profil și ecranul de cont suspendat)',
  },
  'profile.delete.yes': { group: 'profile', default: 'Da, șterge contul' },
  'profile.delete.cancel': { group: 'profile', default: 'Renunță', description: 'Renunță la ștergerea contului' },
} as const satisfies Record<string, TextEntry>;
