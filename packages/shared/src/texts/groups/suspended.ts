import type { TextEntry } from '../types';

export const suspendedTexts = {
  'suspended.title': {
    group: 'suspended',
    default: 'Contul tău a fost suspendat',
    description: 'Titlul ecranului unui cont suspendat',
  },
  'suspended.reasonLabel': {
    group: 'suspended',
    default: 'Motiv:',
    description: 'Eticheta îngroșată din fața motivului scris de administrator',
  },
  'suspended.contactPrefix': {
    group: 'suspended',
    default: 'Dacă crezi că e o greșeală, scrie-ne la',
    description: 'Textul dinaintea adresei de email de contact',
  },
  'suspended.contactSuffix': {
    group: 'suspended',
    default: '.',
    description: 'Textul de după adresa de email de contact',
  },
  'suspended.signOut': {
    group: 'suspended',
    default: 'Ieși din cont',
    description: 'Butonul de ieșire din cont',
  },
  'suspended.deleteAccount': {
    group: 'suspended',
    default: 'Șterge contul',
    description: 'Linkul care deschide confirmarea ștergerii contului',
  },
} as const satisfies Record<string, TextEntry>;
