import Card from '@/components/ui/Card';

type Props = {
  totalProducts: number;
  lowStockCount: number;
  totalSuppliers: number;
  todaySales: string;
};

const tones = [
  'bg-emerald-50 text-emerald-700 border-emerald-200',
  'bg-amber-50 text-amber-700 border-amber-200',
  'bg-blue-50 text-blue-700 border-blue-200',
  'bg-purple-50 text-purple-700 border-purple-200'
];

export default function DashboardStats({ totalProducts, lowStockCount, totalSuppliers, todaySales }: Props) {
  const items = [
    ['Active products', String(totalProducts)],
    ['Low-stock products', String(lowStockCount)],
    ['Suppliers', String(totalSuppliers)],
    ['Sales today', todaySales]
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map(([label, value], index) => (
        <Card key={label} className={`border ${tones[index]}`}>
          <div className="text-xs font-semibold uppercase tracking-[0.18em]">{label}</div>
          <div className="mt-3 text-3xl font-black">{value}</div>
        </Card>
      ))}
    </div>
  );
}
