'use client';

import ErrorState from '@/components/system/ErrorState';

export default function ProtectedAppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      title="This workspace could not be loaded"
      message="Vertex POS ran into an error while loading the current screen. Retry first. If it keeps failing, verify your database, auth session, and environment values."
      onRetry={reset}
      homeHref="/dashboard"
      homeLabel="Back to dashboard"
      details={process.env.NODE_ENV === 'development' ? error.message : error.digest ?? null}
    />
  );
}
