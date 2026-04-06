'use client';

import { useEffect } from 'react';
import ErrorState from '@/components/system/ErrorState';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <ErrorState
          title="Vertex POS hit an unexpected error"
          message="We could not finish loading this page. Try again, then head back to your dashboard if the issue keeps showing up."
          onReset={reset}
        />
      </body>
    </html>
  );
}
