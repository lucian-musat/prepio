import type { TextEntry } from '../types';

/**
 * The evening reminder notifications (Android app only). They are written when the reminders are scheduled (start,
 * every streak change, return to the app), so an edit reaches a phone at its next scheduling.
 */
export const notificationsTexts = {
  'notifications.channelName': {
    group: 'notifications',
    default: 'Memento zilnic',
    description: 'Numele categoriei de notificări din setările telefonului',
  },
  'notifications.reminder.aliveTitle': {
    group: 'notifications',
    default: '🔥 Seria ta de {zile} te așteaptă',
    vars: ['zile'],
    description: 'Titlul mementoului când seria e în curs; {zile} este de forma „5 zile”',
  },
  'notifications.reminder.aliveBody': {
    group: 'notifications',
    default: 'Un exercițiu de 2 minute e de ajuns ca s-o păstrezi.',
    description: 'Textul mementoului când seria e în curs',
  },
  'notifications.reminder.newTitle': {
    group: 'notifications',
    default: 'Hai să începem o serie nouă 🔥',
    description: 'Titlul mementoului fără serie',
  },
  'notifications.reminder.newBody': {
    group: 'notifications',
    default: 'Rezolvă un exercițiu azi.',
    description: 'Textul mementoului fără serie',
  },
} as const satisfies Record<string, TextEntry>;
