import AsyncStorage from '@react-native-async-storage/async-storage';

/** The score of a lesson's last failed test, kept on this device only (the server keeps no failed attempt). */
export type LastTest = { correct: number; total: number };

const key = (lessonId: string) => `prepio.lastTest.${lessonId}`;

export async function saveLastTest(lessonId: string, test: LastTest): Promise<void> {
  await AsyncStorage.setItem(key(lessonId), JSON.stringify(test)).catch(() => undefined);
}

export async function clearLastTest(lessonId: string): Promise<void> {
  await AsyncStorage.removeItem(key(lessonId)).catch(() => undefined);
}

/** Null when nothing is stored, the value is not a score, or the storage can't be read. */
export async function readLastTest(lessonId: string): Promise<LastTest | null> {
  try {
    const raw = await AsyncStorage.getItem(key(lessonId));
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<LastTest>;
    return Number.isInteger(v.correct) && Number.isInteger(v.total) && (v.total as number) > 0
      ? { correct: v.correct as number, total: v.total as number }
      : null;
  } catch {
    return null;
  }
}
