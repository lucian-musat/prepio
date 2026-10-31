import { ReduceMotion } from 'react-native-reanimated';
import {
  cardIn, cardInConfig, cardOut, cardOutConfig, enterScreen, enterStagger, screenConfig, staggerConfig, timing,
} from './motion';

it('entering presets respect reduce motion', () => {
  const configs = [staggerConfig(0), screenConfig('forward'), screenConfig('back'), cardInConfig('next'), cardInConfig('prev'), cardOutConfig('next'), cardOutConfig('prev'), timing(100)];
  for (const c of configs) expect(c.reduceMotion).toBe(ReduceMotion.System);
});

it('presets are callable animation builders', () => {
  for (const p of [enterStagger(0), enterScreen('forward'), cardIn('next'), cardOut('prev')]) {
    expect(typeof p).toBe('function');
  }
});

it('stagger delay grows by 50 ms', () => {
  expect(staggerConfig(0).delay).toBe(40);
  expect(staggerConfig(3).delay).toBe(190);
});
