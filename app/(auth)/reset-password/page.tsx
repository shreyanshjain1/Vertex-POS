import ResetPasswordForm from '@/components/auth/ResetPasswordForm';

export default async function ResetPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const query = await searchParams;

  return <ResetPasswordForm token={query.token ?? ''} />;
}
