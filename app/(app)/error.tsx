'use client';

import { useEffect } from 'react';
import ErrorState from '@/components/system/ErrorState';

export default function AppSegmentError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      title="Unable to load the store workspace"
      message="This part of Vertex POS could not load correctly. Try again, or head back to the dashboard and retry the action from there."
      onReset={reset}
      homeHref="/dashboard"
      homeLabel="Back to dashboard"
    />
  );
}
