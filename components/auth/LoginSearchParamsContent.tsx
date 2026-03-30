'use client';

import { useSearchParams } from 'next/navigation';
import LoginForm from '@/components/auth/LoginForm';

export default function LoginSearchParamsContent() {
  const searchParams = useSearchParams();

  return (
    <LoginForm
      inactiveAccess={searchParams.get('error') === 'shop-access-lost'}
      callbackUrl={searchParams.get('callbackUrl')}
    />
  );
}
