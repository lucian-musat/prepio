import { useEffect, useState } from 'react';
import { bootTexts } from './boot';

// One boot per app run, shared by every mount (a remounted root must not wait or refetch).
let booted = false;
let booting: Promise<void> | undefined;

/** Runs bootTexts() once and reports when the text store is ready for the first screen. */
export function useTextsBoot(): boolean {
  const [ready, setReady] = useState(booted);

  useEffect(() => {
    if (booted) return;
    let live = true;
    booting ??= bootTexts()
      .then(() => undefined, () => undefined)
      .finally(() => {
        booted = true;
      });
    void booting.then(() => {
      if (live) setReady(true);
    });
    return () => {
      live = false;
    };
  }, []);

  return ready;
}
