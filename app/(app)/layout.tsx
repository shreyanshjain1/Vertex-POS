import { getActiveShopContext } from '@/lib/auth/get-active-shop';
import AppSidebar from '@/components/layout/AppSidebar';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  await getActiveShopContext();
  return (
    <div className="md:flex">
      <AppSidebar />
      <main className="min-h-screen flex-1 bg-stone-50">
        <div className="mx-auto max-w-7xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
