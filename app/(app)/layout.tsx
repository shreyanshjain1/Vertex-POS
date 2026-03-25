import { getActiveShopContext } from '@/lib/auth/get-active-shop';
import AppSidebar from '@/components/layout/AppSidebar';
import CommandPalette from '@/components/layout/CommandPalette';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { shop, role } = await getActiveShopContext();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.16),_transparent_26%),linear-gradient(180deg,_#f7faf8_0%,_#eef2ec_100%)]">
      <div className="relative lg:flex">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),transparent)]" />
        <AppSidebar shopName={shop.name} shopType={shop.posType} role={role} />
        <main className="min-h-screen flex-1">
          <div className="mx-auto max-w-[1500px] px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
            <CommandPalette role={role} />
            <div className="relative rounded-[34px] border border-white/70 bg-white/28 p-2 shadow-[0_28px_70px_-48px_rgba(28,25,23,0.28)] backdrop-blur-[2px] sm:p-3">
              <div className="rounded-[30px] bg-white/20 p-1 sm:p-2">{children}</div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
