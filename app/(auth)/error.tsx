'use client';

import { useEffect } from 'react';
import ErrorState from '@/components/system/ErrorState';

export default function AuthSegmentError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      title="Authentication screen failed to load"
      message="We could not finish loading the sign-in or account access flow. Try again, then return to the login screen if needed."
      onReset={reset}
      homeHref="/login"
      homeLabel="Back to sign in"
    />
  );
}
