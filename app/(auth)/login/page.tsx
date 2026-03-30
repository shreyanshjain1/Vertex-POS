import { Suspense } from 'react';
import LoginForm from '@/components/auth/LoginForm';
import LoginSearchParamsContent from '@/components/auth/LoginSearchParamsContent';

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginForm inactiveAccess={false} callbackUrl={null} />}>
      <LoginSearchParamsContent />
    </Suspense>
  );
}
