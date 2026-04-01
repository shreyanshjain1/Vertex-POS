import { prisma } from '@/lib/prisma';
import { roundCurrency } from '@/lib/inventory';

const ANALYTICS_WINDOW_DAYS = 30;
const PURCHASE_HISTORY_LOOKBACK_DAYS = 180;

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);
}

function endOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 23, 59, 59, 999);
}

function addDays(value: Date, amount: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + amount);
  return next;
}

function daysBetween(start: Date, end: Date) {
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));
}

function formatDateKey(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shortLabel(value: Date) {
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: '2-digit'
  }).format(value);
}

function weekdayLabel(dayIndex: number) {
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][dayIndex] ?? 'Day';
}

function hourLabel(hour: number) {
  const base = new Date(2026, 0, 1, hour, 0, 0, 0);
  return new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric'
  }).format(base);
}

type AnalyticsBase = Awaited<ReturnType<typeof getAnalyticsBase>>;
type ReorderSuggestionItem = {
  productId: string;
  productName: string;
  sku: string | null;
  currentStock: number;
  avgDailySales: number;
  leadTimeDays: number;
  safetyStock: number;
  reorderPoint: number;
  targetStock: number;
  suggestedQty: number;
  unitCost: number;
  suggestedCost: number;
  supplierId: string | null;
  supplierName: string;
  stockoutEvents: number;
  sellThroughPercent: number;
  baseUnitOfMeasureId: string;
  baseUnitName: string;
};

async function getAnalyticsBase(shopId: string) {
  const today = new Date();
  const to = endOfDay(today);
  const from = startOfDay(addDays(today, -(ANALYTICS_WINDOW_DAYS - 1)));
  const purchaseHistoryFrom = startOfDay(addDays(from, -PURCHASE_HISTORY_LOOKBACK_DAYS));

  const [settings, products, sales, adjustments, inventoryMovements, purchaseReceipts] =
    await Promise.all([
      prisma.shopSetting.findUnique({
        where: { shopId },
        select: {
          currencySymbol: true,
          reorderSafetyStock: true
        }
      }),
      prisma.product.findMany({
        where: { shopId, isActive: true },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          sku: true,
          stockQty: true,
          reorderPoint: true,
          cost: true,
          price: true,
          createdAt: true,
          baseUnitOfMeasureId: true,
          baseUnitOfMeasure: {
            select: {
              id: true,
              name: true,
              code: true
            }
          }
        }
      }),
      prisma.sale.findMany({
        where: {
          shopId,
          status: 'COMPLETED',
          createdAt: { gte: from, lte: to }
        },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          createdAt: true,
          subtotal: true,
          discountAmount: true,
          totalAmount: true,
          items: {
            select: {
              productId: true,
              productName: true,
              qty: true,
              lineTotal: true
            }
          }
        }
      }),
      prisma.saleAdjustment.findMany({
        where: {
          shopId,
          createdAt: { gte: from, lte: to }
        },
        orderBy: { createdAt: 'asc' },
        select: {
          type: true,
          totalAmount: true,
          createdAt: true,
          items: {
            select: {
              productId: true,
              qty: true,
              saleItem: {
                select: {
                  qty: true,
                  lineTotal: true,
                  productName: true,
                  sale: {
                    select: {
                      subtotal: true,
                      discountAmount: true
                    }
                  }
                }
              }
            }
          }
        }
      }),
      prisma.inventoryMovement.findMany({
        where: {
          shopId,
          createdAt: { gte: from, lte: to }
        },
        orderBy: { createdAt: 'asc' },
        select: {
          productId: true,
          qtyChange: true,
          type: true,
          createdAt: true
        }
      }),
      prisma.purchaseReceipt.findMany({
        where: {
          shopId,
          receivedAt: { gte: purchaseHistoryFrom }
        },
        orderBy: { receivedAt: 'desc' },
        select: {
          receivedAt: true,
          purchase: {
            select: {
              createdAt: true,
              supplierId: true,
              supplier: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          },
          items: {
            select: {
              productId: true,
              qtyReceived: true,
              purchaseItem: {
                select: {
                  unitCost: true
                }
              }
            }
          }
        }
      })
    ]);

  return {
    shopId,
    from,
    to,
    settings,
    products,
    sales,
    adjustments,
    inventoryMovements,
    purchaseReceipts
  };
}

function buildProductMetricMap(base: AnalyticsBase) {
  const metrics = new Map<
    string,
    {
      productId: string;
      name: string;
      soldQty: number;
      revenue: number;
      discountLeak: number;
      marginSqueeze: number;
      refundLeak: number;
    }
  >();

  for (const sale of base.sales) {
    const saleSubtotal = Number(sale.subtotal);
    const saleDiscount = Number(sale.discountAmount);

    for (const item of sale.items) {
      const lineSubtotal = Number(item.lineTotal);
      const discountShare =
        saleSubtotal > 0 ? roundCurrency((lineSubtotal / saleSubtotal) * saleDiscount) : 0;
      const netRevenue = roundCurrency(lineSubtotal - discountShare);
      const product = base.products.find((entry) => entry.id === item.productId);
      const estimatedCost = roundCurrency(item.qty * Number(product?.cost ?? 0));
      const marginSqueeze = roundCurrency(Math.max(estimatedCost - netRevenue, 0));
      const entry = metrics.get(item.productId) ?? {
        productId: item.productId,
        name: item.productName,
        soldQty: 0,
        revenue: 0,
        discountLeak: 0,
        marginSqueeze: 0,
        refundLeak: 0
      };

      entry.soldQty += item.qty;
      entry.revenue = roundCurrency(entry.revenue + netRevenue);
      entry.discountLeak = roundCurrency(entry.discountLeak + discountShare);
      entry.marginSqueeze = roundCurrency(entry.marginSqueeze + marginSqueeze);
      metrics.set(item.productId, entry);
    }
  }

  for (const adjustment of base.adjustments) {
    if (adjustment.type !== 'REFUND' && adjustment.type !== 'EXCHANGE') {
      continue;
    }

    for (const item of adjustment.items) {
      if (!item.productId || !item.saleItem) {
        continue;
      }

      const saleItemSubtotal = Number(item.saleItem.lineTotal);
      const sourceSaleSubtotal = Number(item.saleItem.sale.subtotal);
      const sourceSaleDiscount = Number(item.saleItem.sale.discountAmount);
      const discountShare =
        sourceSaleSubtotal > 0
          ? roundCurrency((saleItemSubtotal / sourceSaleSubtotal) * sourceSaleDiscount)
          : 0;
      const sourceNetRevenue = roundCurrency(saleItemSubtotal - discountShare);
      const refundLeak =
        item.saleItem.qty > 0
          ? roundCurrency((sourceNetRevenue / item.saleItem.qty) * item.qty)
          : 0;
      const entry = metrics.get(item.productId) ?? {
        productId: item.productId,
        name: item.saleItem.productName,
        soldQty: 0,
        revenue: 0,
        discountLeak: 0,
        marginSqueeze: 0,
        refundLeak: 0
      };

      entry.refundLeak = roundCurrency(entry.refundLeak + refundLeak);
      metrics.set(item.productId, entry);
    }
  }

  return metrics;
}

function buildStockoutMap(base: AnalyticsBase) {
  const movementMap = new Map<string, Array<{ qtyChange: number; createdAt: Date }>>();
  const netChangeMap = new Map<string, number>();

  for (const movement of base.inventoryMovements) {
    const list = movementMap.get(movement.productId) ?? [];
    list.push({
      qtyChange: movement.qtyChange,
      createdAt: movement.createdAt
    });
    movementMap.set(movement.productId, list);
    netChangeMap.set(
      movement.productId,
      (netChangeMap.get(movement.productId) ?? 0) + movement.qtyChange
    );
  }

  const stockoutMap = new Map<string, number>();

  for (const product of base.products) {
    const movements = movementMap.get(product.id) ?? [];
    let stockLevel = product.stockQty - (netChangeMap.get(product.id) ?? 0);
    let stockouts = 0;

    for (const movement of movements) {
      const nextStockLevel = stockLevel + movement.qtyChange;
      if (stockLevel > 0 && nextStockLevel <= 0) {
        stockouts += 1;
      }
      stockLevel = nextStockLevel;
    }

    stockoutMap.set(product.id, stockouts);
  }

  return stockoutMap;
}

function buildPurchaseContext(base: AnalyticsBase) {
  const latestInboundByProduct = new Map<string, Date>();
  const supplierProductMap = new Map<
    string,
    {
      supplierId: string;
      supplierName: string;
      productId: string;
      leadTimes: number[];
      lastUnitCost: number;
      lastReceivedAt: Date;
    }
  >();
  const supplierLeadTimeMap = new Map<
    string,
    {
      supplierId: string;
      supplierName: string;
      leadTimes: number[];
      lastReceivedAt: Date;
    }
  >();

  for (const receipt of base.purchaseReceipts) {
    const leadTimeDays = Math.max(
      1,
      daysBetween(receipt.purchase.createdAt, receipt.receivedAt)
    );

    const supplierLead = supplierLeadTimeMap.get(receipt.purchase.supplierId) ?? {
      supplierId: receipt.purchase.supplier.id,
      supplierName: receipt.purchase.supplier.name,
      leadTimes: [],
      lastReceivedAt: receipt.receivedAt
    };
    supplierLead.leadTimes.push(leadTimeDays);
    if (supplierLead.lastReceivedAt < receipt.receivedAt) {
      supplierLead.lastReceivedAt = receipt.receivedAt;
    }
    supplierLeadTimeMap.set(receipt.purchase.supplierId, supplierLead);

    for (const item of receipt.items) {
      const lastInbound = latestInboundByProduct.get(item.productId);
      if (!lastInbound || lastInbound < receipt.receivedAt) {
        latestInboundByProduct.set(item.productId, receipt.receivedAt);
      }

      const key = `${receipt.purchase.supplierId}:${item.productId}`;
      const supplierProductEntry = supplierProductMap.get(key) ?? {
        supplierId: receipt.purchase.supplier.id,
        supplierName: receipt.purchase.supplier.name,
        productId: item.productId,
        leadTimes: [],
        lastUnitCost: Number(item.purchaseItem.unitCost),
        lastReceivedAt: receipt.receivedAt
      };
      supplierProductEntry.leadTimes.push(leadTimeDays);
      if (supplierProductEntry.lastReceivedAt <= receipt.receivedAt) {
        supplierProductEntry.lastReceivedAt = receipt.receivedAt;
        supplierProductEntry.lastUnitCost = Number(item.purchaseItem.unitCost);
      }
      supplierProductMap.set(key, supplierProductEntry);
    }
  }

  return {
    latestInboundByProduct,
    supplierProductMap,
    supplierLeadTimeMap
  };
}

function computeSmartReorderSuggestions(base: AnalyticsBase) {
  const metrics = buildProductMetricMap(base);
  const stockoutMap = buildStockoutMap(base);
  const purchaseContext = buildPurchaseContext(base);
  const analysisDays = daysBetween(base.from, base.to);
  const safetyStock = base.settings?.reorderSafetyStock ?? 3;

  const items: ReorderSuggestionItem[] = base.products
    .map((product) => {
      const metric = metrics.get(product.id);
      const soldQty = metric?.soldQty ?? 0;
      const avgDailySales = roundCurrency(soldQty / analysisDays);
      const supplierStats = [...purchaseContext.supplierProductMap.values()]
        .filter((entry) => entry.productId === product.id)
        .sort((left, right) => right.lastReceivedAt.getTime() - left.lastReceivedAt.getTime());
      const preferredSupplier = supplierStats[0] ?? null;
      const leadTimeDays = preferredSupplier
        ? Math.max(
            1,
            Math.round(
              preferredSupplier.leadTimes.reduce((sum, days) => sum + days, 0) /
                Math.max(preferredSupplier.leadTimes.length, 1)
            )
          )
        : 7;
      // Sell-through uses sold units against sold-plus-current-stock because the schema
      // does not yet retain a branch-wide received-stock snapshot for each reporting date.
      const sellThroughPercent =
        soldQty + product.stockQty > 0
          ? roundCurrency((soldQty / (soldQty + product.stockQty)) * 100)
          : 0;
      const dynamicReorderPoint = Math.ceil(avgDailySales * leadTimeDays + safetyStock);
      const reorderPoint = Math.max(product.reorderPoint, dynamicReorderPoint);
      const coverageDays = Math.max(leadTimeDays + 7, 14);
      const targetStock = Math.max(
        reorderPoint,
        Math.ceil(avgDailySales * coverageDays + safetyStock)
      );
      const suggestedQty = Math.max(0, targetStock - product.stockQty);
      const unitCost = preferredSupplier?.lastUnitCost ?? Number(product.cost);
      const suggestedCost = roundCurrency(suggestedQty * unitCost);

      return {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        currentStock: product.stockQty,
        avgDailySales,
        leadTimeDays,
        safetyStock,
        reorderPoint,
        targetStock,
        suggestedQty,
        unitCost,
        suggestedCost,
        supplierId: preferredSupplier?.supplierId ?? null,
        supplierName: preferredSupplier?.supplierName ?? 'No supplier history yet',
        stockoutEvents: stockoutMap.get(product.id) ?? 0,
        sellThroughPercent,
        baseUnitOfMeasureId: product.baseUnitOfMeasureId,
        baseUnitName: product.baseUnitOfMeasure?.name ?? product.baseUnitOfMeasure?.code ?? 'unit'
      };
    })
    .filter(
      (item) =>
        item.suggestedQty > 0 &&
        (item.currentStock <= item.reorderPoint ||
          item.stockoutEvents > 0 ||
          item.sellThroughPercent >= 55)
    )
    .sort(
      (left, right) =>
        right.stockoutEvents - left.stockoutEvents ||
        right.suggestedCost - left.suggestedCost ||
        right.sellThroughPercent - left.sellThroughPercent
    );

  const groups = items.reduce<
    Array<{
      supplierId: string | null;
      supplierName: string;
      totalUnits: number;
      totalCost: number;
      items: ReorderSuggestionItem[];
    }>
  >((summary, item) => {
    const existing = summary.find(
      (entry) =>
        entry.supplierId === item.supplierId && entry.supplierName === item.supplierName
    );
    if (existing) {
      existing.totalUnits += item.suggestedQty;
      existing.totalCost = roundCurrency(existing.totalCost + item.suggestedCost);
      existing.items.push(item);
      return summary;
    }

    return [
      ...summary,
      {
        supplierId: item.supplierId,
        supplierName: item.supplierName,
        totalUnits: item.suggestedQty,
        totalCost: item.suggestedCost,
        items: [item]
      }
    ];
  }, []);

  return {
    generatedAt: base.to.toISOString(),
    safetyStock,
    summary: {
      itemsNeedingAction: items.length,
      suppliersImpacted: groups.filter((group) => group.supplierId).length,
      projectedCost: roundCurrency(items.reduce((sum, item) => sum + item.suggestedCost, 0)),
      projectedUnits: items.reduce((sum, item) => sum + item.suggestedQty, 0)
    },
    items,
    groups
  };
}

export async function getSmartReorderSuggestions(shopId: string) {
  const base = await getAnalyticsBase(shopId);
  return computeSmartReorderSuggestions(base);
}

export async function getOwnerAnalyticsData(shopId: string) {
  const base = await getAnalyticsBase(shopId);
  const productMetrics = buildProductMetricMap(base);
  const stockoutMap = buildStockoutMap(base);
  const purchaseContext = buildPurchaseContext(base);
  const reorder = computeSmartReorderSuggestions(base);
  const dayOrder = [1, 2, 3, 4, 5, 6, 0];
  const heatmapMatrix = dayOrder.map((day) =>
    Array.from({ length: 24 }, (_value, hour) => ({
      day,
      hour,
      revenue: 0,
      count: 0
    }))
  );
  let heatmapMax = 0;

  for (const sale of base.sales) {
    const weekday = sale.createdAt.getDay();
    const rowIndex = dayOrder.indexOf(weekday);
    const hour = sale.createdAt.getHours();
    if (rowIndex < 0) {
      continue;
    }

    heatmapMatrix[rowIndex][hour].revenue = roundCurrency(
      heatmapMatrix[rowIndex][hour].revenue + Number(sale.totalAmount)
    );
    heatmapMatrix[rowIndex][hour].count += 1;
    heatmapMax = Math.max(heatmapMax, heatmapMatrix[rowIndex][hour].revenue);
  }

  const stockAging = base.products
    .filter((product) => product.stockQty > 0)
    .map((product) => {
      const lastInboundAt =
        purchaseContext.latestInboundByProduct.get(product.id) ?? product.createdAt;
      // Exact lot aging is not stored for every stock layer yet, so aging is based on the
      // latest inbound date we can prove from receipts, otherwise the product create date.
      const ageDays = daysBetween(lastInboundAt, base.to);
      return {
        productId: product.id,
        productName: product.name,
        stockQty: product.stockQty,
        ageDays,
        lastInboundAt
      };
    })
    .sort((left, right) => right.ageDays - left.ageDays || right.stockQty - left.stockQty);

  const weightedAgeDenominator = stockAging.reduce((sum, item) => sum + item.stockQty, 0);
  const weightedAgeNumerator = stockAging.reduce(
    (sum, item) => sum + item.ageDays * item.stockQty,
    0
  );

  const shrinkageMap = new Map<string, { label: string; qty: number; value: number }>();
  let totalShrinkageValue = 0;
  for (const movement of base.inventoryMovements) {
    if (
      movement.qtyChange >= 0 ||
      (movement.type !== 'MANUAL_ADJUSTMENT' && movement.type !== 'STOCK_COUNT_POSTED')
    ) {
      continue;
    }

    const product = base.products.find((entry) => entry.id === movement.productId);
    const valueLost = roundCurrency(Math.abs(movement.qtyChange) * Number(product?.cost ?? 0));
    const key = formatDateKey(movement.createdAt);
    const entry = shrinkageMap.get(key) ?? {
      label: shortLabel(movement.createdAt),
      qty: 0,
      value: 0
    };
    entry.qty += Math.abs(movement.qtyChange);
    entry.value = roundCurrency(entry.value + valueLost);
    shrinkageMap.set(key, entry);
    totalShrinkageValue = roundCurrency(totalShrinkageValue + valueLost);
  }

  const refundMap = new Map<string, { label: string; total: number; count: number }>();
  let totalRefunds = 0;
  for (const adjustment of base.adjustments) {
    if (adjustment.type !== 'REFUND' && adjustment.type !== 'EXCHANGE') {
      continue;
    }

    const key = formatDateKey(adjustment.createdAt);
    const entry = refundMap.get(key) ?? {
      label: shortLabel(adjustment.createdAt),
      total: 0,
      count: 0
    };
    const amount = Number(adjustment.totalAmount);
    entry.total = roundCurrency(entry.total + amount);
    entry.count += 1;
    refundMap.set(key, entry);
    totalRefunds = roundCurrency(totalRefunds + amount);
  }

  const leadTimeRows = [...purchaseContext.supplierLeadTimeMap.values()]
    .map((entry) => ({
      supplierId: entry.supplierId,
      supplierName: entry.supplierName,
      avgLeadTimeDays: roundCurrency(
        entry.leadTimes.reduce((sum, days) => sum + days, 0) / Math.max(entry.leadTimes.length, 1)
      ),
      receiptCount: entry.leadTimes.length,
      lastReceivedAt: entry.lastReceivedAt
    }))
    .sort((left, right) => right.avgLeadTimeDays - left.avgLeadTimeDays);

  const leakageRows = [...productMetrics.values()]
    .map((entry) => ({
      productId: entry.productId,
      productName: entry.name,
      discountLeak: entry.discountLeak,
      refundLeak: entry.refundLeak,
      marginSqueeze: entry.marginSqueeze,
      totalLeak: roundCurrency(entry.discountLeak + entry.refundLeak + entry.marginSqueeze),
      revenue: entry.revenue
    }))
    .filter((entry) => entry.totalLeak > 0)
    .sort((left, right) => right.totalLeak - left.totalLeak);

  const movers = base.products
    .map((product) => {
      const metric = productMetrics.get(product.id);
      const soldQty = metric?.soldQty ?? 0;
      return {
        productId: product.id,
        productName: product.name,
        currentStock: product.stockQty,
        soldQty,
        avgDailySales: roundCurrency(soldQty / Math.max(ANALYTICS_WINDOW_DAYS, 1))
      };
    })
    .sort((left, right) => right.avgDailySales - left.avgDailySales || right.soldQty - left.soldQty);

  const totalSoldQty = [...productMetrics.values()].reduce((sum, item) => sum + item.soldQty, 0);
  const totalOnHand = base.products.reduce((sum, product) => sum + product.stockQty, 0);

  return {
    periodLabel: `Last ${ANALYTICS_WINDOW_DAYS} days`,
    currencySymbol: base.settings?.currencySymbol ?? 'PHP ',
    summary: {
      sellThroughPercent:
        totalSoldQty + totalOnHand > 0
          ? roundCurrency((totalSoldQty / (totalSoldQty + totalOnHand)) * 100)
          : 0,
      averageStockAgeDays:
        weightedAgeDenominator > 0
          ? roundCurrency(weightedAgeNumerator / weightedAgeDenominator)
          : 0,
      totalShrinkageValue,
      totalRefunds,
      averageLeadTimeDays: leadTimeRows.length
        ? roundCurrency(
            leadTimeRows.reduce((sum, row) => sum + row.avgLeadTimeDays, 0) / leadTimeRows.length
          )
        : 0,
      stockoutEvents: [...stockoutMap.values()].reduce((sum, count) => sum + count, 0),
      reorderCount: reorder.summary.itemsNeedingAction,
      reorderCost: reorder.summary.projectedCost,
      marginLeakageValue: roundCurrency(
        leakageRows.reduce((sum, row) => sum + row.totalLeak, 0)
      )
    },
    heatmap: {
      maxRevenue: heatmapMax,
      hours: Array.from({ length: 24 }, (_value, hour) => ({
        hour,
        label: hourLabel(hour)
      })),
      rows: heatmapMatrix.map((row, rowIndex) => ({
        dayLabel: weekdayLabel(dayOrder[rowIndex] === 0 ? 6 : dayOrder[rowIndex] - 1),
        cells: row.map((cell) => ({
          ...cell,
          intensity: heatmapMax > 0 ? cell.revenue / heatmapMax : 0
        }))
      }))
    },
    fastMovers: movers.slice(0, 6),
    slowMovers: movers
      .filter((item) => item.currentStock > 0)
      .sort((left, right) => left.avgDailySales - right.avgDailySales || right.currentStock - left.currentStock)
      .slice(0, 6),
    stockAging: stockAging.slice(0, 6),
    marginLeakage: leakageRows.slice(0, 6),
    shrinkageTrend: [...shrinkageMap.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([key, value]) => ({ key, ...value })),
    refundTrend: [...refundMap.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([key, value]) => ({ key, ...value })),
    purchaseLeadTimes: leadTimeRows.slice(0, 6),
    stockoutFrequency: base.products
      .map((product) => ({
        productId: product.id,
        productName: product.name,
        stockoutEvents: stockoutMap.get(product.id) ?? 0,
        currentStock: product.stockQty,
        reorderPoint: product.reorderPoint
      }))
      .filter((item) => item.stockoutEvents > 0)
      .sort((left, right) => right.stockoutEvents - left.stockoutEvents || left.currentStock - right.currentStock)
      .slice(0, 6),
    reorderPreview: reorder.items.slice(0, 6)
  };
}
