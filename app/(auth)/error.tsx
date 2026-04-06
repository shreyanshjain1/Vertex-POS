'use client';

import ErrorState from '@/components/system/ErrorState';

export default function AuthError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      title="The sign-in screen failed to load"
      message="Authentication UI could not be rendered correctly. Retry the page. If it still fails, verify auth providers, session settings, and server environment values."
      onRetry={reset}
      homeHref="/login"
      homeLabel="Back to login"
      details={process.env.NODE_ENV === 'development' ? error.message : error.digest ?? null}
    />
  );
}
