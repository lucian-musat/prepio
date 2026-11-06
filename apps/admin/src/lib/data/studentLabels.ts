// Labels shared by the students data layer (server) and the student page (client).

export type LearningMode = 'guided' | 'free';

export const MODE_LABELS: Record<string, string> = { guided: 'Traseu ghidat', free: 'Explorare liberă' };
export const PROVIDER_LABELS: Record<string, string> = { google: 'Google', email: 'email' };
