'use client';

import Button from '@/components/ui/Button';

export default function PrintButton({ label = 'Print labels' }: { label?: string }) {
  return (
    <Button type="button" onClick={() => window.print()}>
      {label}
    </Button>
  );
}
