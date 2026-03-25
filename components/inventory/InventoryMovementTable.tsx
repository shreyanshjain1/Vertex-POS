'use client';

import Badge from '@/components/ui/Badge';
import { dateTime } from '@/lib/format';

type Movement = {
  id: string;
  type: string;
  qtyChange: number;
  referenceId?: string | null;
  notes?: string | null;
  createdAt: string;
  product: {
    name: string;
  };
};

function toneForType(type: string) {
  const normalized = type.toUpperCase();

  if (normalized.includes('SALE')) {
    return 'red';
  }

  if (normalized.includes('PURCHASE') || normalized.includes('OPENING')) {
    return 'emerald';
  }

  return 'stone';
}

export default function InventoryMovementTable({
  movements
}: {
  movements: Movement[];
  lowStockThreshold: number;
}) {
  if (!movements.length) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-6 text-sm text-stone-500">
        No inventory movement records yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="text-stone-500">
          <tr>
            <th className="px-3 py-3">Date / Time</th>
            <th className="px-3 py-3">Product</th>
            <th className="px-3 py-3">Type</th>
            <th className="px-3 py-3">Qty Change</th>
            <th className="px-3 py-3">Reference</th>
            <th className="px-3 py-3">Notes</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((movement) => (
            <tr key={movement.id} className="border-t border-stone-200">
              <td className="px-3 py-3 text-stone-600">{dateTime(movement.createdAt)}</td>
              <td className="px-3 py-3 font-medium text-stone-900">{movement.product.name}</td>
              <td className="px-3 py-3">
                <Badge tone={toneForType(movement.type)}>{movement.type.replaceAll('_', ' ')}</Badge>
              </td>
              <td className={`px-3 py-3 font-semibold ${movement.qtyChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {movement.qtyChange > 0 ? `+${movement.qtyChange}` : movement.qtyChange}
              </td>
              <td className="px-3 py-3 text-stone-600">{movement.referenceId ?? 'N/A'}</td>
              <td className="px-3 py-3 text-stone-600">{movement.notes ?? 'N/A'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
