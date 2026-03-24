import { getActiveShopContext } from '@/lib/auth/get-active-shop';
import AppSidebar from '@/components/layout/AppSidebar';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { shop } = await getActiveShopContext();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.14),_transparent_28%),linear-gradient(180deg,_#f7faf8_0%,_#f4f4f0_100%)]">
      <div className="relative lg:flex">
        <AppSidebar shopName={shop.name} shopType={shop.posType} />
        <main className="min-h-screen flex-1">
          <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
