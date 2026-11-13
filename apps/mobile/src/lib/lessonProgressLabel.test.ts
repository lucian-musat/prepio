import { applyOverrides, resetTexts } from '../texts/store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { describeProgress } from './lessonProgressLabel';
import { clearLastTest, readLastTest, saveLastTest } from './lastTest';

const counts = { cards: 14, questions: 9 };

describe('describeProgress', () => {
  it('names the card the student left on, out of all cards', () => {
    expect(describeProgress({ phase: 'cards', index: 3, results: {} }, null, counts)).toEqual({ learn: 'Ai rămas la cardul 4 din 14' });
  });

  it('names the question during the test', () => {
    expect(describeProgress({ phase: 'questions', index: 2, results: {} }, null, counts)).toEqual({ check: 'Ai rămas la întrebarea 3 din 9' });
  });

  it('shows the last failed attempt when no test is in progress', () => {
    expect(describeProgress(null, { correct: 7, total: 9 }, counts)).toEqual({ check: 'Ultima încercare: 7 din 9 corecte' });
    expect(describeProgress({ phase: 'cards', index: 0, results: {} }, { correct: 7, total: 9 }, counts)).toEqual({
      learn: 'Ai rămas la cardul 1 din 14',
      check: 'Ultima încercare: 7 din 9 corecte',
    });
  });

  it('a test in progress wins over the last attempt', () => {
    expect(describeProgress({ phase: 'questions', index: 0, results: {} }, { correct: 7, total: 9 }, counts)).toEqual({
      check: 'Ai rămas la întrebarea 1 din 9',
    });
  });

  it('says how many consolidation exercises are solved correctly once one was tried', () => {
    expect(describeProgress(null, null, counts, { count: 10, correct: 3, done: 4 })).toEqual({ consolidate: '3 din 10 rezolvate corect' });
    expect(describeProgress(null, null, counts, { count: 10, correct: 0, done: 0 })).toEqual({});
  });

  it('is empty without progress', () => {
    expect(describeProgress(null, null, counts)).toEqual({});
  });
});

describe('last test (this device)', () => {
  beforeEach(() => AsyncStorage.clear());

  it('saves, reads and clears a lesson’s last failed attempt', async () => {
    await saveLastTest('l1', { correct: 7, total: 9 });
    expect(await readLastTest('l1')).toEqual({ correct: 7, total: 9 });
    expect(await readLastTest('l2')).toBeNull();
    await clearLastTest('l1');
    expect(await readLastTest('l1')).toBeNull();
  });

  it('a broken stored value reads as none', async () => {
    await AsyncStorage.setItem('prepio.lastTest.l1', '{"correct":"x"}');
    expect(await readLastTest('l1')).toBeNull();
  });

  it('unreadable storage reads as none', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('blocked'));
    expect(await readLastTest('l1')).toBeNull();
  });
});

it('describeProgress takes its lines from the catalog', () => {
  applyOverrides({ 'lesson.progress.card': '[card {n}/{total}]' });
  try {
    expect(describeProgress({ phase: 'cards', index: 1, results: {} }, null, { cards: 5, questions: 3 }).learn).toBe('[card 2/5]');
  } finally {
    resetTexts();
  }
});
