export type TextGroup =
  | 'common'
  | 'errors'
  | 'auth'
  | 'onboarding'
  | 'home'
  | 'lesson'
  | 'cards'
  | 'consolidation'
  | 'bac'
  | 'access'
  | 'credits'
  | 'invite'
  | 'profile'
  | 'streak'
  | 'notifications'
  | 'pages'
  | 'meta'
  | 'suspended';

export type TextEntry = {
  group: TextGroup;
  /** Text used when no admin override exists. */
  default: string;
  /** Admin-facing hint shown next to the editor. */
  description?: string;
  /** Allowed `{name}` variables; every one must appear in the text. */
  vars?: readonly string[];
  /** When true the override may be empty (the text is hidden). */
  optional?: boolean;
};

/** Romanian group labels for the admin. */
export const TEXT_GROUP_LABELS: Record<TextGroup, string> = {
  common: 'Comune',
  errors: 'Erori',
  auth: 'Autentificare',
  onboarding: 'Introducere',
  home: 'Acasă',
  lesson: 'Lecție',
  cards: 'Carduri',
  consolidation: 'Consolidare',
  bac: 'Simulare BAC',
  access: 'Acces',
  credits: 'Credite',
  invite: 'Invitații',
  profile: 'Profil',
  streak: 'Serie',
  notifications: 'Notificări',
  pages: 'Pagini',
  meta: 'Meta',
  suspended: 'Cont suspendat',
};
