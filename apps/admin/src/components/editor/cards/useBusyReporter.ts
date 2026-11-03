import { useCallback, useEffect, useRef } from 'react';

/**
 * Implements the `onBusyChange` contract of `FieldsProps` for one field group: `begin()` reports busy
 * and returns an idempotent `end()`; operations still running at unmount are released then, and their
 * later `end()` is a no-op.
 */
export function useBusyReporter(onBusyChange?: (busy: boolean) => void) {
  const cb = useRef(onBusyChange);
  cb.current = onBusyChange;
  const active = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const running = active; // a counter, not a DOM node: reading it at cleanup is intended
    return () => {
      mounted.current = false;
      for (; running.current > 0; running.current--) cb.current?.(false);
    };
  }, []);
  return useCallback(() => {
    active.current++;
    cb.current?.(true);
    let done = false;
    return () => {
      if (done || !mounted.current) return;
      done = true;
      active.current--;
      cb.current?.(false);
    };
  }, []);
}
