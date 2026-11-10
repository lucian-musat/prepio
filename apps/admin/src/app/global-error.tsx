'use client';

import { useEffect } from 'react';
import { captureBoundaryError } from '@/lib/sentry';

/** Last-resort boundary: replaces the root layout, so no Bootstrap or theme is available (inline styles only). */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    captureBoundaryError(error);
  }, [error]);

  return (
    <html lang="ro">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div>
          <h1 style={{ fontSize: 22, marginBottom: 16 }}>Ceva n-a mers bine.</h1>
          <button type="button" onClick={reset} style={{ padding: '8px 16px', fontSize: 16, cursor: 'pointer' }}>
            Reîncarcă
          </button>
        </div>
      </body>
    </html>
  );
}
