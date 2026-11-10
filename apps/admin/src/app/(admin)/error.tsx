'use client';

import { useEffect } from 'react';
import { Button } from 'react-bootstrap';
import { captureBoundaryError } from '@/lib/sentry';

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    captureBoundaryError(error);
  }, [error]);

  return (
    <div className="text-center py-5">
      <h1 className="h4 mb-3">Ceva n-a mers bine pe această pagină.</h1>
      {error.digest ? <p className="text-muted small">Cod: {error.digest}</p> : null}
      <Button variant="primary" onClick={reset}>
        Încearcă din nou
      </Button>
    </div>
  );
}
