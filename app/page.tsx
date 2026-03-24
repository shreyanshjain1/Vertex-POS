import Link from 'next/link';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export default async function HomePage() {
  const session = await auth().catch(() => null);
  if (session?.user?.id) {
    redirect('/dashboard');
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-stone-50 via-white to-stone-100">
      <section className="mx-auto flex min-h-screen max-w-7xl flex-col justify-center px-6 py-20 lg:flex-row lg:items-center lg:justify-between lg:gap-14">
        <div className="max-w-3xl">
          <div className="mb-5 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm font-semibold text-emerald-700">
            Retail-ready POS • Inventory • Procurement • Reporting
          </div>
          <h1 className="text-5xl font-black tracking-tight text-stone-900 md:text-6xl">Run a real store, not a school project.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-stone-600">
            Vertex POS helps shop owners, managers, and cashiers handle onboarding, products, suppliers, purchases, checkout, receipts, stock movement, settings, and business reporting in one clean workspace.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link href="/signup" className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700">
              Create account
            </Link>
            <Link href="/login" className="rounded-2xl border border-stone-300 bg-white px-5 py-3 text-sm font-semibold text-stone-900 shadow-sm transition hover:bg-stone-50">
              Sign in
            </Link>
          </div>
        </div>
        <div className="mt-16 grid gap-4 lg:mt-0 lg:w-[420px]">
          {[
            ['Shop onboarding', 'Create shop profile, tax, currency, receipt settings, first categories, first products, and suppliers.'],
            ['Fast checkout', 'Barcode-ready catalog search, cart editing, tax, discount, payment capture, and printable receipts.'],
            ['Operational visibility', 'Inventory movement history, low stock alerts, purchases, suppliers, sales history, and reports.']
          ].map(([title, body]) => (
            <div key={title} className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-black text-stone-900">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-stone-600">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
