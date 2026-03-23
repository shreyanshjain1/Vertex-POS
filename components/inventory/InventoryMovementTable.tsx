'use client';

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

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function toneForType(type: string) {
  const normalized = type.toUpperCase();

  if (normalized.includes('SALE') || normalized === 'REMOVE' || normalized.includes('OUT')) {
    return 'text-red-600 bg-red-50 border-red-200';
  }

  if (normalized.includes('PURCHASE') || normalized === 'ADD' || normalized.includes('IN')) {
    return 'text-emerald-600 bg-emerald-50 border-emerald-200';
  }

  return 'text-stone-700 bg-stone-50 border-stone-200';
}

export default function InventoryMovementTable({
  movements
}: {
  movements: Movement[];
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
              <td className="px-3 py-3 text-stone-600">{formatDateTime(movement.createdAt)}</td>
              <td className="px-3 py-3 font-medium text-stone-900">{movement.product.name}</td>
              <td className="px-3 py-3">
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${toneForType(movement.type)}`}>
                  {movement.type}
                </span>
              </td>
              <td className={`px-3 py-3 font-semibold ${movement.qtyChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {movement.qtyChange > 0 ? `+${movement.qtyChange}` : movement.qtyChange}
              </td>
              <td className="px-3 py-3 text-stone-600">{movement.referenceId ?? '—'}</td>
              <td className="px-3 py-3 text-stone-600">{movement.notes ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}