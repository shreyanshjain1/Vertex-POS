import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { dateTime } from '@/lib/format';

export default function InventoryManager({ products, movements }: { products: { id: string; name: string; stockQty: number }[]; movements: { id: string; type: string; qtyChange: number; notes: string | null; createdAt: string; product: { name: string } }[] }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <Card>
        <h2 className="text-xl font-black text-stone-900">Manual stock adjustment</h2>
        <AdjustmentForm products={products} />
      </Card>
      <Card>
        <h2 className="text-xl font-black text-stone-900">Inventory movements</h2>
        <div className="mt-4 space-y-3">
          {movements.length ? movements.map((move) => <div key={move.id} className="rounded-2xl border border-stone-200 p-4"><div className="flex justify-between gap-3"><div><div className="font-semibold text-stone-900">{move.product.name}</div><div className="text-sm text-stone-500">{move.type.replaceAll('_', ' ')}</div></div><div className={`text-lg font-black ${move.qtyChange < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{move.qtyChange > 0 ? `+${move.qtyChange}` : move.qtyChange}</div></div><div className="mt-2 text-xs text-stone-500">{dateTime(move.createdAt)} • {move.notes || 'No notes'}</div></div>) : <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-stone-500">No inventory movement yet.</div>}
        </div>
      </Card>
    </div>
  );
}

function AdjustmentForm({ products }: { products: { id: string; name: string; stockQty: number }[] }) {
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await fetch('/api/inventory/adjustments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: form.get('productId'), qtyChange: Number(form.get('qtyChange')), notes: form.get('notes') })
    });
    location.reload();
  }

  return (
    <form onSubmit={onSubmit} className="mt-5 space-y-4">
      <select name="productId" className="w-full rounded-xl border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm">
        {products.map((product) => <option key={product.id} value={product.id}>{product.name} ({product.stockQty} in stock)</option>)}
      </select>
      <Input name="qtyChange" type="number" placeholder="e.g. 5 or -2" required />
      <Input name="notes" placeholder="Adjustment reason" />
      <Button type="submit">Apply adjustment</Button>
    </form>
  );
}
