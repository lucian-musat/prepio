import type { TextEntry } from '../types';

/** Signed-out screens: welcome, consent, invite code field, email sign-in and the emailed code. */
export const authTexts = {
  // Welcome
  'auth.welcome.pageTitle': {
    group: 'auth',
    default: 'Intră în cont',
    description: 'Titlul filei din browser pe ecranul Bun venit (în față apare numele aplicației)',
  },
  'auth.welcome.title': {
    group: 'auth',
    default: 'Bun venit la Prepio',
    description: 'Titlul cardului de pe ecranul Bun venit',
  },
  'auth.welcome.subtitle': {
    group: 'auth',
    default: 'Pregătește-te pentru BAC cu lecții scurte și exerciții. Intră sau creează-ți cont ca să începi.',
    description: 'Textul cardului de pe ecranul Bun venit',
  },
  'auth.welcome.google': {
    group: 'auth',
    default: 'Continuă cu Google',
    description: 'Butonul de intrare în cont cu Google',
  },
  'auth.welcome.email': {
    group: 'auth',
    default: 'Continuă cu email',
    description: 'Butonul de intrare în cont cu un cod primit pe email (apare doar când intrarea cu email e activată)',
  },

  // Consent checkbox (Welcome and the terms gate)
  'auth.consent.label': {
    group: 'auth',
    default:
      'Am cel puțin 14 ani și accept Termenii de utilizare și Politica de confidențialitate. ' +
      'Dacă am sub 18 ani, am acordul părintelui sau al tutorelui pentru a folosi Prepio și pentru plăți.',
    description: 'Textul căsuței de acord obligatorii (vârstă, termeni, acordul părintelui); linkurile sunt afișate separat dedesubt',
  },
  'auth.consent.hint': {
    group: 'auth',
    default: 'Bifează confirmarea de mai sus.',
    description: 'Indiciul citit de cititorul de ecran pe un buton dezactivat până se bifează acordul',
  },
  'auth.consent.termsLink': {
    group: 'auth',
    default: 'Termenii de utilizare',
    description: 'Linkul de sub căsuța de acord către pagina Termenilor (doar eticheta linkului)',
  },
  'auth.consent.privacyLink': {
    group: 'auth',
    default: 'Politica de confidențialitate',
    description: 'Linkul de sub căsuța de acord către pagina Politicii de confidențialitate (doar eticheta linkului)',
  },

  // Invite code field (Welcome)
  'auth.referral.link': {
    group: 'auth',
    default: 'Ai un cod de invitație?',
    description: 'Linkul care deschide câmpul pentru codul de invitație (apare doar când programul de recomandări e activ)',
  },
  'auth.referral.codeLabel': {
    group: 'auth',
    default: 'Cod de invitație',
    description: 'Numele câmpului pentru codul de invitație, citit de cititorul de ecran',
  },
  'auth.referral.codePlaceholder': {
    group: 'auth',
    default: 'Codul de invitație',
    description: 'Textul din câmpul gol pentru codul de invitație',
  },
  'auth.referral.privacy': {
    group: 'auth',
    default: 'Cel care te-a invitat va vedea prenumele și emailul tău.',
    description: 'Nota de sub câmpul pentru codul de invitație',
  },
  'auth.referral.how': {
    group: 'auth',
    default: 'Cum funcționează recomandările?',
    description: 'Linkul spre pagina care explică recomandările',
  },
  'auth.referral.invalid': {
    group: 'auth',
    default: 'Codul nu este valid.',
    description: 'Mesajul sub câmp când codul de invitație nu există',
  },
  'auth.referral.unreachable': {
    group: 'auth',
    default: 'Nu am putut verifica codul acum.',
    description: 'Mesajul sub câmp când codul nu a putut fi verificat (fără internet sau prea multe încercări)',
  },
  'auth.referral.invitedBy': {
    group: 'auth',
    default: 'Invitat de {nume} ✓',
    vars: ['nume'],
    description: 'Confirmarea unui cod valid; {nume} este prenumele celui care a invitat',
  },
  'auth.referral.invited': {
    group: 'auth',
    default: 'Invitat ✓',
    description: 'Confirmarea unui cod valid când prenumele celui care a invitat nu e cunoscut',
  },

  // Email step
  'auth.email.title': {
    group: 'auth',
    default: 'Care e adresa ta de email?',
    description: 'Titlul pasului în care elevul scrie adresa de email',
  },
  'auth.email.body': {
    group: 'auth',
    default: 'Îți trimitem un cod de 6 cifre cu care intri în cont. Nu ai nevoie de parolă.',
    description: 'Explicația de sub titlul pasului cu adresa de email',
  },
  'auth.email.fieldLabel': {
    group: 'auth',
    default: 'Adresa de email',
    description: 'Numele câmpului pentru adresa de email, citit de cititorul de ecran',
  },
  'auth.email.placeholder': {
    group: 'auth',
    default: 'nume@exemplu.ro',
    description: 'Exemplul din câmpul gol pentru adresa de email',
  },
  'auth.email.submit': {
    group: 'auth',
    default: 'Trimite codul',
    description: 'Butonul care trimite codul de intrare pe email',
  },

  // Code step
  'auth.code.title': {
    group: 'auth',
    default: 'Verifică-ți emailul',
    description: 'Titlul pasului în care elevul scrie codul primit pe email',
  },
  'auth.code.body': {
    group: 'auth',
    default: 'Ți-am trimis un cod de 6 cifre la {email}.',
    vars: ['email'],
    description: 'Explicația de sub titlul pasului cu codul; {email} este adresa scrisă de elev',
  },
  'auth.code.fieldLabel': {
    group: 'auth',
    default: 'Codul din email',
    description: 'Numele câmpului pentru cod, citit de cititorul de ecran',
  },
  'auth.code.tooShort': {
    group: 'auth',
    default: 'Scrie codul de {n} cifre.',
    vars: ['n'],
    description: 'Mesajul când elevul apasă Continuă cu un cod incomplet; {n} este numărul de cifre',
  },
  'auth.code.resend': {
    group: 'auth',
    default: 'Retrimite codul',
    description: 'Butonul de retrimitere a codului',
  },
  'auth.code.resendIn': {
    group: 'auth',
    default: 'Retrimite în {n} s',
    vars: ['n'],
    description: 'Butonul de retrimitere cât timp nu e activ încă; {n} sunt secundele rămase',
  },
  'auth.code.changeEmail': {
    group: 'auth',
    default: 'Schimbă adresa',
    description: 'Butonul care întoarce elevul la pasul cu adresa de email',
  },
  'auth.code.missingBody': {
    group: 'auth',
    default: 'Nu mai știm la ce adresă ți-am trimis codul. Scrie-o din nou și îți trimitem altul.',
    description: 'Textul afișat când pagina codului e deschisă direct, fără adresa de email',
  },
  'auth.code.missingAction': {
    group: 'auth',
    default: 'Scrie adresa de email',
    description: 'Butonul care duce la pasul cu adresa de email când adresa lipsește',
  },

  // Shared
  'auth.signOut': {
    group: 'auth',
    default: 'Ieși din cont',
    description: 'Linkul de ieșire din cont din pașii de început (acord, nume, mod de învățare)',
  },
} as const satisfies Record<string, TextEntry>;
