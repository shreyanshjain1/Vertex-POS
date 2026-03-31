import VerifyEmailForm from '@/components/auth/VerifyEmailForm';

export default async function VerifyEmailPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const query = await searchParams;

  return <VerifyEmailForm token={query.token ?? ''} />;
}
