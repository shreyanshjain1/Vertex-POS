import { redirect } from 'next/navigation';

export default async function SaleReceiptRedirectPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/print/receipt/${id}`);
}