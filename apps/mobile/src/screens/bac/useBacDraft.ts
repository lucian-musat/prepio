import { useCallback, useEffect, useRef, useState } from 'react';
import type { BacAnswers, ExerciseAnswer } from '@prepio/shared';
import { fetchOpenAttempt, saveBacDraft, type BacAttemptView, type BacPosition } from '../../lib/bac';

/** Quiet autosave: the save after the last change waits this long. */
export const SAVE_DEBOUNCE_MS = 1500;
export const START: BacPosition = { section: 1, index: 0 };

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export type BacDraft = {
  /** Loading the open attempt; `error` when it could not be read (`reload` retries). */
  status: 'loading' | 'error' | 'ready';
  /** The open attempt as loaded (draft / grading / failed), null when there is none. */
  attempt: BacAttemptView | null;
  answers: BacAnswers;
  /** 0-based index within its section. */
  position: BacPosition;
  saveState: SaveState;
  /** A changed answer: saved after SAVE_DEBOUNCE_MS without further changes. `empty` is what „no answer” looks like. */
  setAnswer(itemId: string, answer: ExerciseAnswer, empty?: ExerciseAnswer): void;
  setPosition(p: BacPosition): void;
  /** Saves a pending change now (blur, tab switch). */
  flush(): Promise<void>;
  /** Drops a pending change without saving it (the paper was just submitted). */
  discard(): void;
  /** An empty paper on Subiectul I (after a graded attempt: the next save starts a new draft). */
  reset(): void;
  reload(): void;
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The student's draft of a BAC paper: loads the open attempt, holds the answers and the position, and saves them with
 * `saveBacDraft` debounced, on `flush` and on unmount. Saves run one after another, each with the latest state.
 */
export function useBacDraft(subjectId: string): BacDraft {
  const [status, setStatus] = useState<BacDraft['status']>('loading');
  const [attempt, setAttempt] = useState<BacAttemptView | null>(null);
  const [answers, setAnswers] = useState<BacAnswers>({});
  const [position, setPositionState] = useState<BacPosition>(START);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [loadKey, setLoadKey] = useState(0);

  const answersRef = useRef<BacAnswers>({});
  const positionRef = useRef<BacPosition>(START);
  const dirty = useRef(false);
  const ready = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const mounted = useRef(true);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let live = true;
    ready.current = false;
    setStatus('loading');
    fetchOpenAttempt(subjectId).then(
      (a) => {
        if (!live) return;
        answersRef.current = a?.answers ?? {};
        positionRef.current = a?.position ?? START;
        dirty.current = false;
        ready.current = true;
        setAttempt(a);
        setAnswers(answersRef.current);
        setPositionState(positionRef.current);
        setStatus('ready');
      },
      (e) => {
        if (!live) return;
        console.warn('[bac] the open attempt could not be read:', e);
        setStatus('error');
      },
    );
    return () => {
      live = false;
    };
  }, [subjectId, loadKey]);

  const flush = useCallback((): Promise<void> => {
    clearTimer();
    if (!ready.current || !dirty.current) return chain.current;
    dirty.current = false;
    chain.current = chain.current.then(async () => {
      if (mounted.current) setSaveState('saving');
      try {
        await saveBacDraft(subjectId, answersRef.current, positionRef.current);
        if (mounted.current) setSaveState(dirty.current ? 'saving' : 'saved');
      } catch (e) {
        console.warn('[bac] the draft could not be saved:', e);
        // Kept for the next change or flush.
        dirty.current = true;
        if (mounted.current) setSaveState('error');
      }
    });
    return chain.current;
  }, [subjectId]);

  const schedule = useCallback(() => {
    dirty.current = true;
    clearTimer();
    timer.current = setTimeout(() => void flush(), SAVE_DEBOUNCE_MS);
  }, [flush]);

  const setAnswer = useCallback(
    (itemId: string, answer: ExerciseAnswer, empty?: ExerciseAnswer) => {
      const cur = answersRef.current[itemId];
      if (same(cur, answer) || (cur === undefined && empty !== undefined && same(empty, answer))) return;
      answersRef.current = { ...answersRef.current, [itemId]: answer };
      setAnswers(answersRef.current);
      schedule();
    },
    [schedule],
  );

  const setPosition = useCallback(
    (p: BacPosition) => {
      if (same(p, positionRef.current)) return;
      positionRef.current = p;
      setPositionState(p);
      schedule();
    },
    [schedule],
  );

  const discard = useCallback(() => {
    clearTimer();
    dirty.current = false;
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    dirty.current = false;
    answersRef.current = {};
    positionRef.current = START;
    setAttempt(null);
    setAnswers({});
    setPositionState(START);
    setSaveState('idle');
  }, []);

  const reload = useCallback(() => setLoadKey((k) => k + 1), []);

  // Leaving the paper saves what is pending.
  useEffect(() => () => void flush(), [flush]);

  return { status, attempt, answers, position, saveState, setAnswer, setPosition, flush, discard, reset, reload };
}
