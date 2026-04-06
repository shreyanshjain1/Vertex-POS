'use client';

import ErrorState from '@/components/system/ErrorState';

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      title="Vertex POS hit an unexpected error"
      message="Something failed while rendering this page. Please retry. If this keeps happening, check the server logs and environment configuration."
      onRetry={reset}
      details={process.env.NODE_ENV === 'development' ? error.message : error.digest ?? null}
    />
  );
}
