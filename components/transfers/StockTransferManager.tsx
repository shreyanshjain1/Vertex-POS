'use client';

import { useMemo, useState } from 'react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { dateTime } from '@/lib/format';
import {
  getStockTransferStatusLabel,
  stockTransferStatusTone,
  type StockTransferStatusValue
} from '@/lib/stock-transfers';

type ShopOption = {
  id: string;
  name: string;
  role: string;
};

type ProductOption = {
  id: string;
  shopId?: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  stockQty: number;
};

type TransferItemView = {
  id: string;
  fromProductId: string;
  toProductId: string;
  productNameSnapshot: string;
  destinationProductNameSnapshot: string;
  qty: number;
  createdAt: string;
  fromProduct: {
    id: string;
    name: string;
    stockQty: number;
    sku: string | null;
    barcode: string | null;
  };
  toProduct: {
    id: string;
    name: string;
    stockQty: number;
    sku: string | null;
    barcode: string | null;
  };
};

export type StockTransferView = {
  id: string;
  fromShopId: string;
  toShopId: string;
  transferNumber: string;
  status: string;
  notes: string | null;
  sentAt: string | null;
  receivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  fromShop: { id: string; name: string };
  toShop: { id: string; name: string };
  createdByUser: { id: string; name: string | null; email: string };
  receivedByUser?: { id: string; name: string | null; email: string } | null;
  items: TransferItemView[];
};

type DraftLine = {
  fromProductId: string;
  toProductId: string;
  fromProductName: string;
  toProductName: string;
  qty: number;
};

function matchDestinationProduct(sourceProduct: ProductOption, destinationProducts: ProductOption[]) {
  const normalizedSku = sourceProduct.sku?.trim().toLowerCase();
  const normalizedBarcode = sourceProduct.barcode?.trim();
  const normalizedName = sourceProduct.name.trim().toLowerCase();

  return (
    destinationProducts.find((product) => normalizedBarcode && product.barcode?.trim() === normalizedBarcode) ??
    destinationProducts.find((product) => normalizedSku && product.sku?.trim().toLowerCase() === normalizedSku) ??
    destinationProducts.find((product) => product.name.trim().toLowerCase() === normalizedName) ??
    null
  );
}

export default function StockTransferManager({
  activeShopId,
  activeShopName,
  otherShops,
  sourceProducts,
  destinationProducts,
  initialTransfers
}: {
  activeShopId: string;
  activeShopName: string;
  currencySymbol: string;
  otherShops: ShopOption[];
  sourceProducts: ProductOption[];
  destinationProducts: ProductOption[];
  initialTransfers: StockTransferView[];
}) {
  const [history, setHistory] = useState(initialTransfers);
  const [toShopId, setToShopId] = useState(otherShops[0]?.id ?? '');
  const [fromProductId, setFromProductId] = useState(sourceProducts[0]?.id ?? '');
  const [toProductId, setToProductId] = useState('');
  const [qty, setQty] = useState('1');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [busyTransferId, setBusyTransferId] = useState<string | null>(null);

  const availableDestinationProducts = useMemo(
    () => destinationProducts.filter((product) => product.shopId === toShopId),
    [destinationProducts, toShopId]
  );
  const selectedSourceProduct = useMemo(
    () => sourceProducts.find((product) => product.id === fromProductId) ?? null,
    [fromProductId, sourceProducts]
  );

  function replaceTransfer(nextTransfer: StockTransferView) {
    setHistory((current) => current.map((entry) => (entry.id === nextTransfer.id ? nextTransfer : entry)));
  }

  function onChangeDestinationShop(nextShopId: string) {
    setToShopId(nextShopId);
    const destinationPool = destinationProducts.filter((product) => product.shopId === nextShopId);
    const sourceProduct = sourceProducts.find((product) => product.id === fromProductId);
    const suggestedMatch = sourceProduct ? matchDestinationProduct(sourceProduct, destinationPool) : null;
    setToProductId(suggestedMatch?.id ?? destinationPool[0]?.id ?? '');
  }

  function onChangeSourceProduct(nextProductId: string) {
    setFromProductId(nextProductId);
    const sourceProduct = sourceProducts.find((product) => product.id === nextProductId);
    const suggestedMatch = sourceProduct ? matchDestinationProduct(sourceProduct, availableDestinationProducts) : null;
    setToProductId(suggestedMatch?.id ?? availableDestinationProducts[0]?.id ?? '');
  }

  function addLine() {
    setError('');
    setSuccess('');

    const sourceProduct = sourceProducts.find((product) => product.id === fromProductId);
    const destinationProduct = availableDestinationProducts.find((product) => product.id === toProductId);
    const parsedQty = Number(qty);

    if (!toShopId) {
      setError('Select a destination branch first.');
      return;
    }

    if (!sourceProduct || !destinationProduct) {
      setError('Select both the source and destination products.');
      return;
    }

    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      setError('Transfer quantity must be greater than zero.');
      return;
    }

    if (parsedQty > sourceProduct.stockQty) {
      setError(`${sourceProduct.name} only has ${sourceProduct.stockQty} unit(s) available.`);
      return;
    }

    setLines((current) => [
      ...current,
      {
        fromProductId: sourceProduct.id,
        toProductId: destinationProduct.id,
        fromProductName: sourceProduct.name,
        toProductName: destinationProduct.name,
        qty: parsedQty
      }
    ]);
    setQty('1');
  }

  function removeLine(index: number) {
    setLines((current) => current.filter((_, lineIndex) => lineIndex !== index));
  }

  async function createTransfer() {
    setError('');
    setSuccess('');

    if (!toShopId) {
      setError('Select a destination branch.');
      return;
    }

    if (!lines.length) {
      setError('Add at least one transfer line.');
      return;
    }

    setLoading(true);
    const response = await fetch('/api/transfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toShopId,
        notes: notes || null,
        items: lines.map((line) => ({
          fromProductId: line.fromProductId,
          toProductId: line.toProductId,
          qty: line.qty
        }))
      })
    });
    const data = await response.json().catch(() => ({ error: 'Unable to create stock transfer.' }));
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? 'Unable to create stock transfer.');
      return;
    }

    setHistory((current) => [data.stockTransfer, ...current]);
    setLines([]);
    setNotes('');
    setSuccess('Stock transfer saved as draft.');
  }

  async function updateTransfer(transferId: string, action: 'SEND' | 'RECEIVE' | 'CANCEL') {
    setBusyTransferId(transferId);
    setError('');
    setSuccess('');

    const response = await fetch(`/api/transfers/${transferId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    const data = await response.json().catch(() => ({ error: 'Unable to update stock transfer.' }));
    setBusyTransferId(null);

    if (!response.ok) {
      setError(data.error ?? 'Unable to update stock transfer.');
      return;
    }

    replaceTransfer(data.stockTransfer);
    if (action === 'SEND') {
      setSuccess('Transfer sent and source stock reduced.');
    } else if (action === 'RECEIVE') {
      setSuccess('Transfer received and destination stock increased.');
    } else {
      setSuccess('Transfer cancelled.');
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <Card>
        <div className="mb-4">
          <div className="text-lg font-black text-stone-900">Create branch transfer</div>
          <div className="text-sm text-stone-500">Source branch: {activeShopName}</div>
        </div>

        {otherShops.length ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <select
                className="rounded-xl border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm"
                value={toShopId}
                onChange={(event) => onChangeDestinationShop(event.target.value)}
              >
                {otherShops.map((shop) => (
                  <option key={shop.id} value={shop.id}>
                    {shop.name} ({shop.role})
                  </option>
                ))}
              </select>
              <Input placeholder="Transfer notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
            </div>

            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <div className="grid gap-3 md:grid-cols-4">
                <select
                  className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm"
                  value={fromProductId}
                  onChange={(event) => onChangeSourceProduct(event.target.value)}
                >
                  {sourceProducts.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm"
                  value={toProductId}
                  onChange={(event) => setToProductId(event.target.value)}
                >
                  {availableDestinationProducts.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
                <Input type="number" min={1} value={qty} onChange={(event) => setQty(event.target.value)} />
                <Button type="button" variant="secondary" onClick={addLine}>Add line</Button>
              </div>
              {selectedSourceProduct ? (
                <div className="mt-3 text-sm text-stone-600">
                  Available in {activeShopName}: <span className="font-semibold text-stone-900">{selectedSourceProduct.stockQty}</span> unit(s)
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              {lines.length ? (
                lines.map((line, index) => (
                  <div key={`${line.fromProductId}-${line.toProductId}-${index}`} className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
                    <div>
                      <div className="font-semibold text-stone-900">{line.fromProductName}</div>
                      <div className="text-xs text-stone-500">
                        {line.qty} unit(s) to {line.toProductName}
                      </div>
                    </div>
                    <Button type="button" variant="ghost" onClick={() => removeLine(index)}>Remove</Button>
                  </div>
                ))
              ) : (
                <div className="text-sm text-stone-500">No transfer lines added yet.</div>
              )}
            </div>

            {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
            {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

            <Button onClick={createTransfer} disabled={!lines.length || loading}>
              {loading ? 'Saving transfer...' : 'Save transfer draft'}
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-5 text-sm text-stone-500">
            You need access to more than one branch before stock transfers can be created.
          </div>
        )}
      </Card>

      <Card>
        <div className="mb-4">
          <div className="text-lg font-black text-stone-900">Transfer history</div>
          <div className="text-sm text-stone-500">Only the active branch can send its own drafts or receive inbound transfers addressed to it.</div>
        </div>

        <div className="space-y-4">
          {history.length ? (
            history.map((transfer) => {
              const isSourceBranch = transfer.fromShopId === activeShopId;
              const isDestinationBranch = transfer.toShopId === activeShopId;
              const status = transfer.status as StockTransferStatusValue;

              return (
                <div key={transfer.id} className="rounded-2xl border border-stone-200 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="font-semibold text-stone-900">{transfer.transferNumber}</div>
                      <div className="text-sm text-stone-500">
                        {transfer.fromShop.name} to {transfer.toShop.name}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge tone={stockTransferStatusTone(status)}>
                          {getStockTransferStatusLabel(status)}
                        </Badge>
                        <Badge tone={isSourceBranch ? 'amber' : 'blue'}>
                          {isSourceBranch ? 'Outgoing' : 'Incoming'}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right text-sm text-stone-600">
                      <div>Created {dateTime(transfer.createdAt)}</div>
                      {transfer.sentAt ? <div>Sent {dateTime(transfer.sentAt)}</div> : null}
                      {transfer.receivedAt ? <div>Received {dateTime(transfer.receivedAt)}</div> : null}
                    </div>
                  </div>

                  {transfer.notes ? <div className="mt-3 text-sm text-stone-600">Notes: {transfer.notes}</div> : null}

                  <div className="mt-4 space-y-2 rounded-2xl bg-stone-50 p-4">
                    {transfer.items.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
                        <div className="font-semibold text-stone-900">{item.productNameSnapshot}</div>
                        <div className="text-xs text-stone-500">
                          {item.qty} unit(s) to {item.destinationProductNameSnapshot}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {isSourceBranch && transfer.status === 'DRAFT' ? (
                      <Button type="button" onClick={() => updateTransfer(transfer.id, 'SEND')} disabled={busyTransferId === transfer.id}>
                        {busyTransferId === transfer.id ? 'Sending...' : 'Send transfer'}
                      </Button>
                    ) : null}
                    {isSourceBranch && transfer.status === 'DRAFT' ? (
                      <Button type="button" variant="danger" onClick={() => updateTransfer(transfer.id, 'CANCEL')} disabled={busyTransferId === transfer.id}>
                        Cancel draft
                      </Button>
                    ) : null}
                    {isDestinationBranch && transfer.status === 'IN_TRANSIT' ? (
                      <Button type="button" variant="secondary" onClick={() => updateTransfer(transfer.id, 'RECEIVE')} disabled={busyTransferId === transfer.id}>
                        {busyTransferId === transfer.id ? 'Receiving...' : 'Confirm receipt'}
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-sm text-stone-500">No branch transfers recorded yet.</div>
          )}
        </div>
      </Card>
    </div>
  );
}
