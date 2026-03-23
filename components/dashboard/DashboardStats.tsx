import Card from '@/components/ui/Card';

type Props = {
  totalProducts: number;
  lowStockCount: number;
  totalSuppliers: number;
  todaySales: string;
};

const items = [
  {
    label: 'Active products',
    helper: 'Sellable catalog items',
    tone: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  },
  {
    label: 'Low-stock products',
    helper: 'Needs replenishment soon',
    tone: 'bg-amber-50 text-amber-700 border-amber-200'
  },
  {
    label: 'Suppliers',
    helper: 'Active procurement partners',
    tone: 'bg-blue-50 text-blue-700 border-blue-200'
  },
  {
    label: 'Sales today',
    helper: 'Completed sales total',
    tone: 'bg-purple-50 text-purple-700 border-purple-200'
  }
] as const;

export default function DashboardStats({
  totalProducts,
  lowStockCount,
  totalSuppliers,
  todaySales
}: Props) {
  const values = [String(totalProducts), String(lowStockCount), String(totalSuppliers), todaySales];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item, index) => (
        <Card key={item.label} className={`border ${item.tone}`}>
          <div className="text-xs font-semibold uppercase tracking-[0.18em]">{item.label}</div>
          <div className="mt-3 text-3xl font-black">{values[index]}</div>
          <div className="mt-2 text-sm opacity-90">{item.helper}</div>
        </Card>
      ))}
    </div>
  );
}