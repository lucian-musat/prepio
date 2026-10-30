import type { Difficulty } from './types';

export const colors = {
  parchment: '#F7F1E3',
  paper: '#FFFDF7',
  ink: '#2B2118',
  inkMuted: '#6B5D4F',
  bordeaux: '#7A1F2B',
  gold: '#B8893B',
  border: '#E3D8C3',
  success: '#2F6B3A',
  error: '#A12C2C',
} as const;

export const difficultyColors: Record<Difficulty, string> = {
  easy: '#2F6B3A',
  medium: '#B8893B',
  hard: '#7A1F2B',
};

export const radius = 12;

export const fonts = { heading: 'Lora', body: 'Source Sans 3' } as const;
