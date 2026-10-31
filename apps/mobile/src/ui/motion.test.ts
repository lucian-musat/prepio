import { ReduceMotion } from 'react-native-reanimated';
import {
  cardIn, cardInConfig, cardOut, cardOutConfig, enterScreen, enterStagger, screenConfig, staggerConfig, timing,
} from './motion';

// Reanimated keeps builder settings in fields its typings don't expose.
const inspect = (p: unknown) => p as { durationV?: number; delayV?: number; reduceMotionV: ReduceMotion; definitions: Record<string, { opacity: number }> };

it('entering presets respect reduce motion', () => {
  for (const c of [staggerConfig(0), screenConfig('forward'), screenConfig('back'), cardInConfig('next'), cardInConfig('prev'), cardOutConfig('next'), cardOutConfig('prev'), timing(100)]) {
    expect(c.reduceMotion).toBe(ReduceMotion.System);
  }
  for (const p of [enterStagger(0), enterScreen('forward'), enterScreen('back'), cardIn('next'), cardIn('prev'), cardOut('next'), cardOut('prev')]) {
    expect(inspect(p).reduceMotionV).toBe(ReduceMotion.System);
  }
});

it('stagger delay grows by 50 ms', () => {
  expect(staggerConfig(0).delay).toBe(40);
  expect(staggerConfig(3).delay).toBe(190);
  expect(inspect(enterStagger(0)).delayV).toBe(40);
  expect(inspect(enterStagger(3)).delayV).toBe(190);
});

it('presets use the token durations and end at rest', () => {
  expect(inspect(enterStagger(0)).durationV).toBe(420);
  expect(inspect(enterScreen('back')).durationV).toBe(420);
  expect(inspect(cardIn('next')).durationV).toBe(320);
  const end = inspect(cardIn('next')).definitions.to;
  expect(end.opacity).toBe(1);
});
