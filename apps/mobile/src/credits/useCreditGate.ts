import { createElement, useCallback, useRef, useState, type ReactElement } from 'react';
import { EvaluateApiError } from '../lib/api';
import BuyCreditsSheet from './BuyCreditsSheet';
import { useCredits } from './CreditsProvider';

/** What a digital-teacher check asks of the credits before and after it runs. */
export type CreditGate = {
  /** False (and the buy sheet opens, keeping `run` for „Verifică acum”) when the known balance is below `cost`. */
  allow(cost: number, run: () => void): boolean;
  /**
   * A failed check: on `insufficient_credits` it takes the server's balance, opens the sheet and returns true
   * (the caller shows no error). Any other error that carries the balance (a refunded failure) only settles it.
   */
  onError(e: unknown, run: () => void): boolean;
  /** The balance from a check's response. */
  settle(balance: number): void;
};

type Blocked = { required: number; run: () => void };

/**
 * The credit gate of a check and its BuyCreditsSheet (render `sheet` next to the screen). The sheet opens over
 * the exercise, so whatever the student typed stays where it is; „Verifică acum” re-runs the blocked check.
 */
export function useCreditGate(opts: { onSkip?: () => void } = {}): CreditGate & { sheet: ReactElement } {
  const { balance, setBalance } = useCredits();
  // The latest balance: a kept `run` re-enters `allow` after a purchase, from a render that predates it.
  const balanceRef = useRef(balance);
  balanceRef.current = balance;
  const [blocked, setBlocked] = useState<Blocked | null>(null);
  const onSkipRef = useRef(opts.onSkip);
  onSkipRef.current = opts.onSkip;

  const allow = useCallback((cost: number, run: () => void) => {
    const b = balanceRef.current;
    if (b === null || b >= cost) return true;
    setBlocked({ required: cost, run });
    return false;
  }, []);

  const settle = useCallback(
    (n: number) => {
      balanceRef.current = n;
      setBalance(n);
    },
    [setBalance],
  );

  const onError = useCallback(
    (e: unknown, run: () => void) => {
      if (!(e instanceof EvaluateApiError)) return false;
      if (typeof e.balance === 'number') settle(e.balance);
      if (e.code !== 'insufficient_credits') return false;
      setBlocked({ required: e.required ?? (balanceRef.current ?? 0) + 1, run });
      return true;
    },
    [settle],
  );

  const close = useCallback(() => setBlocked(null), []);
  const sheet = createElement(BuyCreditsSheet, {
    visible: blocked !== null,
    required: blocked?.required ?? 0,
    cost: blocked?.required ?? 0,
    onClose: close,
    onSkip: () => {
      setBlocked(null);
      onSkipRef.current?.();
    },
    onCheckNow: () => {
      const run = blocked?.run;
      setBlocked(null);
      run?.();
    },
  });

  return { allow, onError, settle, sheet };
}
