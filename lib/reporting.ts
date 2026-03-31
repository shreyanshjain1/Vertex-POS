import { Prisma } from '@prisma/client';
import { getStockLevel, roundCurrency } from '@/lib/inventory';
import { PAYMENT_METHODS } from '@/lib/payments';
import { prisma } from '@/lib/prisma';

export type ReportFilters = {
  from: Date;
  to: Date;
  fromValue: string;
  toValue: string;
  cashierId: string;
  categoryId: string;
  paymentMethod: string;
  productId: string;
};

const LOW_MOVEMENT_QTY_THRESHOLD = 5;

type ReportSearchParams = Promise<Record<string, string | string[] | undefined>>;

type CostHistoryPoint = {
  effectiveDate: Date;
  previousCost: number;
  newCost: number;
};

type CostTimeline = {
  fallbackCost: number;
  history: CostHistoryPoint[];
};

function readSingleParam(
  query: Record<string, string | string[] | undefined>,
  key: string
) {
  const value = query[key];
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

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

function isValidDate(value: Date) {
  return !Number.isNaN(value.getTime());
}

function formatDateInputValue(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dayKey(value: Date) {
  return formatDateInputValue(value);
}

function monthKey(value: Date) {
  return `${value.getFullYear()}-${`${value.getMonth() + 1}`.padStart(2, '0')}`;
}

function monthLabel(value: Date) {
  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'short'
  }).format(value);
}

function dayLabel(value: Date) {
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: '2-digit'
  }).format(value);
}

function hourLabel(hour: number) {
  const base = new Date(2026, 0, 1, hour, 0, 0, 0);
  return new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric'
  }).format(base);
}

function cashierLabel(cashier: { name: string | null; email: string | null } | null | undefined) {
  return cashier?.name ?? cashier?.email ?? 'Unknown cashier';
}

function toNumber(value: Prisma.Decimal | number | string | null | undefined) {
  return Number(value ?? 0);
}

function buildCostTimelineMap(
  products: Array<{
    id: string;
    cost: Prisma.Decimal;
    costHistory: Array<{
      effectiveDate: Date;
      previousCost: Prisma.Decimal;
      newCost: Prisma.Decimal;
    }>;
  }>
) {
  return new Map<string, CostTimeline>(
    products.map((product) => [
      product.id,
      {
        fallbackCost: toNumber(product.cost),
        history: product.costHistory.map((entry) => ({
          effectiveDate: entry.effectiveDate,
          previousCost: toNumber(entry.previousCost),
          newCost: toNumber(entry.newCost)
        }))
      }
    ])
  );
}

function resolveCostAtDate(
  timelines: Map<string, CostTimeline>,
  productId: string,
  atDate: Date
) {
  const timeline = timelines.get(productId);
  if (!timeline) {
    return 0;
  }

  if (!timeline.history.length) {
    return timeline.fallbackCost;
  }

  // Cost is not snapshotted directly on each sale item yet, so reporting uses
  // the best available historical source: the latest cost change effective on
  // or before the sale date, otherwise the earliest previous cost, then current cost.
  if (atDate < timeline.history[0].effectiveDate) {
    return timeline.history[0].previousCost;
  }

  let resolvedCost = timeline.history[timeline.history.length - 1].newCost;

  for (const point of timeline.history) {
    if (point.effectiveDate <= atDate) {
      resolvedCost = point.newCost;
      continue;
    }

    break;
  }

  return resolvedCost;
}

function allocateLineDiscount(lineSubtotal: number, saleSubtotal: number, saleDiscount: number) {
  if (saleSubtotal <= 0 || saleDiscount <= 0 || lineSubtotal <= 0) {
    return 0;
  }

  return roundCurrency((lineSubtotal / saleSubtotal) * saleDiscount);
}

function calculateNetLineRevenue({
  lineSubtotal,
  saleSubtotal,
  saleDiscount
}: {
  lineSubtotal: number;
  saleSubtotal: number;
  saleDiscount: number;
}) {
  return roundCurrency(lineSubtotal - allocateLineDiscount(lineSubtotal, saleSubtotal, saleDiscount));
}

export async function parseReportFilters(searchParams: ReportSearchParams): Promise<ReportFilters> {
  const query = await searchParams;
  const today = new Date();
  const defaultTo = startOfDay(today);
  const defaultFrom = addDays(defaultTo, -29);

  const fromValue = readSingleParam(query, 'from') || formatDateInputValue(defaultFrom);
  const toValue = readSingleParam(query, 'to') || formatDateInputValue(defaultTo);
  const parsedFrom = startOfDay(new Date(fromValue));
  const parsedTo = endOfDay(new Date(toValue));

  const from = isValidDate(parsedFrom) ? parsedFrom : defaultFrom;
  const to = isValidDate(parsedTo) ? parsedTo : endOfDay(defaultTo);

  if (from > to) {
    return {
      from: startOfDay(defaultFrom),
      to: endOfDay(defaultTo),
      fromValue: formatDateInputValue(defaultFrom),
      toValue: formatDateInputValue(defaultTo),
      cashierId: '',
      categoryId: '',
      paymentMethod: '',
      productId: ''
    };
  }

  return {
    from,
    to,
    fromValue: formatDateInputValue(from),
    toValue: formatDateInputValue(to),
    cashierId: readSingleParam(query, 'cashierId'),
    categoryId: readSingleParam(query, 'categoryId'),
    paymentMethod: readSingleParam(query, 'paymentMethod'),
    productId: readSingleParam(query, 'productId')
  };
}

export async function getReportFilterOptions(shopId: string) {
  const [settings, categories, products, cashiers] = await Promise.all([
    prisma.shopSetting.findUnique({ where: { shopId } }),
    prisma.category.findMany({
      where: { shopId, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true }
    }),
    prisma.product.findMany({
      where: { shopId, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true }
    }),
    prisma.userShop.findMany({
      where: { shopId, isActive: true },
      orderBy: [{ role: 'desc' }, { assignedAt: 'asc' }],
      select: {
        userId: true,
        role: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })
  ]);

  const seenCashiers = new Set<string>();
  const cashierOptions = cashiers
    .filter((membership) => {
      if (seenCashiers.has(membership.userId)) {
        return false;
      }

      seenCashiers.add(membership.userId);
      return true;
    })
    .map((membership) => ({
      value: membership.user.id,
      label: `${membership.user.name ?? membership.user.email} (${membership.role})`
    }));

  return {
    currencySymbol: settings?.currencySymbol ?? 'PHP ',
    categories: categories.map((category) => ({ value: category.id, label: category.name })),
    products: products.map((product) => ({ value: product.id, label: product.name })),
    cashiers: cashierOptions,
    paymentMethods: [...PAYMENT_METHODS, 'Customer Credit'].map((method) => ({
      value: method,
      label: method
    }))
  };
}

export async function getReportsOverviewData(shopId: string, filters: Pick<ReportFilters, 'from' | 'to'>) {
  const [salesAggregate, inventoryReport, profitReport, adjustmentRows] = await Promise.all([
    prisma.sale.aggregate({
      where: {
        shopId,
        status: 'COMPLETED',
        createdAt: { gte: filters.from, lte: filters.to }
      },
      _sum: { totalAmount: true },
      _count: true
    }),
    getInventoryReportData(shopId, {
      from: filters.from,
      to: filters.to,
      fromValue: formatDateInputValue(filters.from),
      toValue: formatDateInputValue(filters.to),
      cashierId: '',
      categoryId: '',
      paymentMethod: '',
      productId: ''
    }),
    getProfitReportData(shopId, {
      from: filters.from,
      to: filters.to,
      fromValue: formatDateInputValue(filters.from),
      toValue: formatDateInputValue(filters.to),
      cashierId: '',
      categoryId: '',
      paymentMethod: '',
      productId: ''
    }),
    prisma.saleAdjustment.findMany({
      where: {
        shopId,
        createdAt: { gte: filters.from, lte: filters.to }
      },
      select: {
        type: true,
        totalAmount: true
      }
    })
  ]);

  const refundTotal = roundCurrency(
    adjustmentRows
      .filter((entry) => entry.type === 'REFUND' || entry.type === 'EXCHANGE')
      .reduce((sum, entry) => sum + Number(entry.totalAmount.toString()), 0)
  );

  const voidTotal = roundCurrency(
    adjustmentRows
      .filter((entry) => entry.type === 'VOID')
      .reduce((sum, entry) => sum + Number(entry.totalAmount.toString()), 0)
  );

  return {
    revenue: roundCurrency(Number(salesAggregate._sum.totalAmount ?? 0)),
    transactionCount: salesAggregate._count,
    inventoryValuation: inventoryReport.summary.costValue,
    refundTotal,
    voidTotal,
    grossProfit: profitReport.summary.grossProfit
  };
}

export async function getSalesReportData(shopId: string, filters: ReportFilters) {
  const saleWhere: Prisma.SaleWhereInput = {
    shopId,
    status: 'COMPLETED',
    createdAt: { gte: filters.from, lte: filters.to }
  };

  if (filters.cashierId) {
    saleWhere.cashierUserId = filters.cashierId;
  }

  if (filters.paymentMethod === 'Customer Credit') {
    saleWhere.isCreditSale = true;
  } else if (filters.paymentMethod) {
    saleWhere.payments = {
      some: {
        method: filters.paymentMethod
      }
    };
  }

  const sales = await prisma.sale.findMany({
    where: saleWhere,
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      createdAt: true,
      totalAmount: true,
      isCreditSale: true,
      cashierUser: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      items: {
        select: {
          productId: true,
          productName: true,
          qty: true,
          lineTotal: true,
          product: {
            select: {
              category: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      },
      payments: {
        select: {
          method: true,
          amount: true
        }
      }
    }
  });

  const dailyMap = new Map<string, { label: string; total: number; count: number }>();
  const monthlyMap = new Map<string, { label: string; total: number; count: number }>();
  const hourlyMap = new Map<number, { label: string; total: number; count: number }>();
  const paymentMethodMap = new Map<string, number>();
  const itemMap = new Map<string, { name: string; qty: number; revenue: number }>();
  const categoryMap = new Map<string, { name: string; qty: number; revenue: number }>();

  for (let hour = 0; hour < 24; hour += 1) {
    hourlyMap.set(hour, {
      label: hourLabel(hour),
      total: 0,
      count: 0
    });
  }

  for (const sale of sales) {
    const total = Number(sale.totalAmount.toString());
    const saleDayKey = dayKey(sale.createdAt);
    const saleMonthKey = monthKey(sale.createdAt);
    const saleHour = sale.createdAt.getHours();

    const dayEntry = dailyMap.get(saleDayKey) ?? {
      label: dayLabel(sale.createdAt),
      total: 0,
      count: 0
    };
    dayEntry.total += total;
    dayEntry.count += 1;
    dailyMap.set(saleDayKey, dayEntry);

    const monthEntry = monthlyMap.get(saleMonthKey) ?? {
      label: monthLabel(sale.createdAt),
      total: 0,
      count: 0
    };
    monthEntry.total += total;
    monthEntry.count += 1;
    monthlyMap.set(saleMonthKey, monthEntry);

    const hourEntry = hourlyMap.get(saleHour)!;
    hourEntry.total += total;
    hourEntry.count += 1;

    if (sale.isCreditSale) {
      paymentMethodMap.set(
        'Customer Credit',
        roundCurrency((paymentMethodMap.get('Customer Credit') ?? 0) + total)
      );
    }

    for (const payment of sale.payments) {
      paymentMethodMap.set(
        payment.method,
        roundCurrency((paymentMethodMap.get(payment.method) ?? 0) + Number(payment.amount.toString()))
      );
    }

    for (const item of sale.items) {
      const lineRevenue = Number(item.lineTotal.toString());
      const itemEntry = itemMap.get(item.productId) ?? {
        name: item.productName,
        qty: 0,
        revenue: 0
      };
      itemEntry.qty += item.qty;
      itemEntry.revenue += lineRevenue;
      itemMap.set(item.productId, itemEntry);

      const categoryName = item.product.category?.name ?? 'Uncategorized';
      const categoryEntry = categoryMap.get(categoryName) ?? {
        name: categoryName,
        qty: 0,
        revenue: 0
      };
      categoryEntry.qty += item.qty;
      categoryEntry.revenue += lineRevenue;
      categoryMap.set(categoryName, categoryEntry);
    }
  }

  const totalRevenue = roundCurrency(sales.reduce((sum, sale) => sum + Number(sale.totalAmount.toString()), 0));
  const transactionCount = sales.length;

  return {
    summary: {
      revenue: totalRevenue,
      transactionCount,
      averageTicket: transactionCount ? roundCurrency(totalRevenue / transactionCount) : 0,
      creditSales: roundCurrency(
        sales
          .filter((sale) => sale.isCreditSale)
          .reduce((sum, sale) => sum + Number(sale.totalAmount.toString()), 0)
      )
    },
    dailySales: [...dailyMap.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([key, value]) => ({ key, ...value })),
    monthlySales: [...monthlyMap.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([key, value]) => ({ key, ...value })),
    hourlySales: [...hourlyMap.entries()]
      .sort((left, right) => left[0] - right[0])
      .map(([hour, value]) => ({ hour, ...value })),
    paymentMethodTotals: [...paymentMethodMap.entries()]
      .map(([method, total]) => ({ method, total }))
      .sort((left, right) => right.total - left.total),
    topItems: [...itemMap.entries()]
      .map(([productId, value]) => ({ productId, ...value }))
      .sort((left, right) => right.qty - left.qty || right.revenue - left.revenue)
      .slice(0, 12),
    topCategories: [...categoryMap.entries()]
      .map(([key, value]) => ({ key, ...value }))
      .sort((left, right) => right.revenue - left.revenue)
      .slice(0, 10),
    topCashiers: sales.reduce<Array<{ cashierId: string; cashierName: string; total: number; count: number }>>((summary, sale) => {
      const cashierId = sale.cashierUser?.id ?? 'unknown';
      const existing = summary.find((entry) => entry.cashierId === cashierId);
      const amount = Number(sale.totalAmount.toString());

      if (existing) {
        existing.total += amount;
        existing.count += 1;
        return summary;
      }

      return [
        ...summary,
        {
          cashierId,
          cashierName: cashierLabel(sale.cashierUser),
          total: amount,
          count: 1
        }
      ];
    }, []).sort((left, right) => right.total - left.total)
  };
}

export async function getInventoryReportData(shopId: string, filters: ReportFilters) {
  const productWhere: Prisma.ProductWhereInput = {
    shopId,
    isActive: true
  };

  if (filters.categoryId) {
    productWhere.categoryId = filters.categoryId;
  }

  if (filters.productId) {
    productWhere.id = filters.productId;
  }

  const [settings, products, saleItems] = await Promise.all([
    prisma.shopSetting.findUnique({
      where: { shopId },
      select: {
        lowStockThreshold: true
      }
    }),
    prisma.product.findMany({
      where: productWhere,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        stockQty: true,
        reorderPoint: true,
        cost: true,
        price: true,
        category: {
          select: {
            name: true
          }
        }
      }
    }),
    prisma.saleItem.findMany({
      where: {
        sale: {
          shopId,
          status: 'COMPLETED',
          createdAt: { gte: filters.from, lte: filters.to }
        },
        ...(filters.categoryId ? { product: { categoryId: filters.categoryId } } : {}),
        ...(filters.productId ? { productId: filters.productId } : {})
      },
      select: {
        productId: true,
        qty: true,
        lineTotal: true
      }
    })
  ]);

  const lowStockThreshold = settings?.lowStockThreshold ?? 5;
  const salesByProduct = new Map<string, { qty: number; revenue: number }>();

  for (const item of saleItems) {
    const current = salesByProduct.get(item.productId) ?? { qty: 0, revenue: 0 };
    current.qty += item.qty;
    current.revenue += Number(item.lineTotal.toString());
    salesByProduct.set(item.productId, current);
  }

  const productRows = products.map((product) => {
    const sold = salesByProduct.get(product.id) ?? { qty: 0, revenue: 0 };
    const costValue = roundCurrency(product.stockQty * Number(product.cost.toString()));
    const sellValue = roundCurrency(product.stockQty * Number(product.price.toString()));
    const stockLevel = getStockLevel(product.stockQty, product.reorderPoint, lowStockThreshold);
    const isLowStock = stockLevel !== 'IN_STOCK';

    return {
      id: product.id,
      name: product.name,
      categoryName: product.category?.name ?? 'Uncategorized',
      stockQty: product.stockQty,
      reorderPoint: product.reorderPoint,
      stockLevel,
      isLowStock,
      soldQty: sold.qty,
      soldRevenue: roundCurrency(sold.revenue),
      costValue,
      sellValue,
      unitCost: Number(product.cost.toString()),
      unitPrice: Number(product.price.toString())
    };
  });

  return {
    summary: {
      inventoryValuation: roundCurrency(productRows.reduce((sum, product) => sum + product.costValue, 0)),
      activeProducts: productRows.length,
      lowMovementCount: productRows.filter(
        (product) => product.soldQty > 0 && product.soldQty <= LOW_MOVEMENT_QTY_THRESHOLD
      ).length,
      deadStockCount: productRows.filter((product) => product.soldQty === 0 && product.stockQty > 0).length,
      totalUnitsOnHand: productRows.reduce((sum, product) => sum + product.stockQty, 0),
      costValue: roundCurrency(productRows.reduce((sum, product) => sum + product.costValue, 0)),
      sellValue: roundCurrency(productRows.reduce((sum, product) => sum + product.sellValue, 0)),
      lowStockValueAtRisk: roundCurrency(
        productRows
          .filter((product) => product.isLowStock)
          .reduce((sum, product) => sum + product.sellValue, 0)
      )
    },
    valuationRows: productRows
      .filter((product) => product.stockQty > 0)
      .sort((left, right) => right.costValue - left.costValue)
      .slice(0, 20),
    lowStockRisk: productRows
      .filter((product) => product.isLowStock && product.stockQty > 0)
      .sort((left, right) => right.sellValue - left.sellValue)
      .slice(0, 20),
    lowMovement: productRows
      .filter((product) => product.soldQty > 0 && product.soldQty <= LOW_MOVEMENT_QTY_THRESHOLD)
      .sort((left, right) => left.soldQty - right.soldQty || left.soldRevenue - right.soldRevenue)
      .slice(0, 20),
    deadStock: productRows
      .filter((product) => product.soldQty === 0 && product.stockQty > 0)
      .sort((left, right) => right.costValue - left.costValue)
      .slice(0, 20)
  };
}

export async function getProfitReportData(shopId: string, filters: ReportFilters) {
  const saleItemWhere: Prisma.SaleItemWhereInput = {
    sale: {
      shopId,
      status: 'COMPLETED',
      createdAt: { gte: filters.from, lte: filters.to }
    }
  };

  if (filters.categoryId) {
    saleItemWhere.product = { categoryId: filters.categoryId };
  }

  if (filters.productId) {
    saleItemWhere.productId = filters.productId;
  }

  const returnItemWhere: Prisma.SaleAdjustmentItemWhereInput = {
    itemType: 'RETURN',
    saleAdjustment: {
      shopId,
      type: { in: ['REFUND', 'EXCHANGE'] },
      createdAt: { gte: filters.from, lte: filters.to }
    }
  };

  if (filters.categoryId) {
    returnItemWhere.product = { categoryId: filters.categoryId };
  }

  if (filters.productId) {
    returnItemWhere.productId = filters.productId;
  }

  const [saleItems, returnItems] = await Promise.all([
    prisma.saleItem.findMany({
      where: saleItemWhere,
      select: {
        saleId: true,
        productId: true,
        productName: true,
        qty: true,
        lineTotal: true,
        sale: {
          select: {
            saleNumber: true,
            createdAt: true,
            subtotal: true,
            discountAmount: true
          }
        },
        product: {
          select: {
            category: {
              select: {
                name: true
              }
            }
          }
        }
      }
    }),
    prisma.saleAdjustmentItem.findMany({
      where: returnItemWhere,
      select: {
        productId: true,
        qty: true,
        disposition: true,
        saleAdjustment: {
          select: {
            adjustmentNumber: true,
            createdAt: true,
            sale: {
              select: {
                id: true,
                saleNumber: true,
                createdAt: true
              }
            }
          }
        },
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
        },
        product: {
          select: {
            category: {
              select: {
                name: true
              }
            }
          }
        }
      }
    })
  ]);

  const productIds = [...new Set([
    ...saleItems.map((item) => item.productId),
    ...returnItems.map((item) => item.productId).filter((productId): productId is string => Boolean(productId))
  ])];

  const products = productIds.length
    ? await prisma.product.findMany({
        where: {
          shopId,
          id: { in: productIds }
        },
        select: {
          id: true,
          cost: true,
          costHistory: {
            select: {
              effectiveDate: true,
              previousCost: true,
              newCost: true
            },
            orderBy: { effectiveDate: 'asc' }
          }
        }
      })
    : [];
  const costTimelines = buildCostTimelineMap(products);

  const dailyMap = new Map<string, { label: string; revenue: number; cost: number; profit: number }>();
  const monthlyMap = new Map<string, { label: string; revenue: number; cost: number; profit: number }>();
  const saleMap = new Map<string, {
    saleId: string;
    saleNumber: string;
    saleDate: Date;
    lastActivityAt: Date;
    revenue: number;
    cost: number;
    profit: number;
    qty: number;
    returnCount: number;
  }>();
  const itemMap = new Map<string, {
    productId: string;
    name: string;
    categoryName: string;
    qty: number;
    revenue: number;
    cost: number;
    profit: number;
  }>();
  const categoryMap = new Map<string, {
    name: string;
    qty: number;
    revenue: number;
    cost: number;
    profit: number;
  }>();

  let totalRevenue = 0;
  let totalCost = 0;

  const applyContribution = ({
    saleId,
    saleNumber,
    saleDate,
    activityAt,
    productId,
    productName,
    categoryName,
    qtyDelta,
    revenueDelta,
    costDelta,
    countsAsReturn
  }: {
    saleId: string;
    saleNumber: string;
    saleDate: Date;
    activityAt: Date;
    productId: string;
    productName: string;
    categoryName: string;
    qtyDelta: number;
    revenueDelta: number;
    costDelta: number;
    countsAsReturn: boolean;
  }) => {
    const profitDelta = roundCurrency(revenueDelta - costDelta);
    totalRevenue = roundCurrency(totalRevenue + revenueDelta);
    totalCost = roundCurrency(totalCost + costDelta);

    const saleDayKey = dayKey(activityAt);
    const saleMonthKey = monthKey(activityAt);

    const dayEntry = dailyMap.get(saleDayKey) ?? {
      label: dayLabel(activityAt),
      revenue: 0,
      cost: 0,
      profit: 0
    };
    dayEntry.revenue = roundCurrency(dayEntry.revenue + revenueDelta);
    dayEntry.cost = roundCurrency(dayEntry.cost + costDelta);
    dayEntry.profit = roundCurrency(dayEntry.profit + profitDelta);
    dailyMap.set(saleDayKey, dayEntry);

    const monthEntry = monthlyMap.get(saleMonthKey) ?? {
      label: monthLabel(activityAt),
      revenue: 0,
      cost: 0,
      profit: 0
    };
    monthEntry.revenue = roundCurrency(monthEntry.revenue + revenueDelta);
    monthEntry.cost = roundCurrency(monthEntry.cost + costDelta);
    monthEntry.profit = roundCurrency(monthEntry.profit + profitDelta);
    monthlyMap.set(saleMonthKey, monthEntry);

    const saleEntry = saleMap.get(saleId) ?? {
      saleId,
      saleNumber,
      saleDate,
      lastActivityAt: activityAt,
      revenue: 0,
      cost: 0,
      profit: 0,
      qty: 0,
      returnCount: 0
    };
    saleEntry.lastActivityAt = saleEntry.lastActivityAt > activityAt ? saleEntry.lastActivityAt : activityAt;
    saleEntry.revenue = roundCurrency(saleEntry.revenue + revenueDelta);
    saleEntry.cost = roundCurrency(saleEntry.cost + costDelta);
    saleEntry.profit = roundCurrency(saleEntry.profit + profitDelta);
    saleEntry.qty += qtyDelta;
    saleEntry.returnCount += countsAsReturn ? 1 : 0;
    saleMap.set(saleId, saleEntry);

    const itemEntry = itemMap.get(productId) ?? {
      productId,
      name: productName,
      categoryName,
      qty: 0,
      revenue: 0,
      cost: 0,
      profit: 0
    };
    itemEntry.qty += qtyDelta;
    itemEntry.revenue = roundCurrency(itemEntry.revenue + revenueDelta);
    itemEntry.cost = roundCurrency(itemEntry.cost + costDelta);
    itemEntry.profit = roundCurrency(itemEntry.profit + profitDelta);
    itemMap.set(productId, itemEntry);

    const categoryEntry = categoryMap.get(categoryName) ?? {
      name: categoryName,
      qty: 0,
      revenue: 0,
      cost: 0,
      profit: 0
    };
    categoryEntry.qty += qtyDelta;
    categoryEntry.revenue = roundCurrency(categoryEntry.revenue + revenueDelta);
    categoryEntry.cost = roundCurrency(categoryEntry.cost + costDelta);
    categoryEntry.profit = roundCurrency(categoryEntry.profit + profitDelta);
    categoryMap.set(categoryName, categoryEntry);
  };

  for (const item of saleItems) {
    const lineSubtotal = toNumber(item.lineTotal);
    const saleSubtotal = toNumber(item.sale.subtotal);
    const saleDiscount = toNumber(item.sale.discountAmount);
    const revenue = calculateNetLineRevenue({
      lineSubtotal,
      saleSubtotal,
      saleDiscount
    });
    const unitCost = resolveCostAtDate(costTimelines, item.productId, item.sale.createdAt);
    const cost = roundCurrency(item.qty * unitCost);

    applyContribution({
      saleId: item.saleId,
      saleNumber: item.sale.saleNumber,
      saleDate: item.sale.createdAt,
      activityAt: item.sale.createdAt,
      productId: item.productId,
      productName: item.productName,
      categoryName: item.product.category?.name ?? 'Uncategorized',
      qtyDelta: item.qty,
      revenueDelta: revenue,
      costDelta: cost,
      countsAsReturn: false
    });
  }

  for (const item of returnItems) {
    if (!item.productId || !item.saleItem) {
      continue;
    }

    const originalLineSubtotal = toNumber(item.saleItem.lineTotal);
    const originalSaleSubtotal = toNumber(item.saleItem.sale.subtotal);
    const originalSaleDiscount = toNumber(item.saleItem.sale.discountAmount);
    const originalLineNetRevenue = calculateNetLineRevenue({
      lineSubtotal: originalLineSubtotal,
      saleSubtotal: originalSaleSubtotal,
      saleDiscount: originalSaleDiscount
    });
    const returnedRevenue =
      item.saleItem.qty > 0
        ? roundCurrency((originalLineNetRevenue / item.saleItem.qty) * item.qty)
        : 0;
    const unitCost = resolveCostAtDate(costTimelines, item.productId, item.saleAdjustment.sale.createdAt);
    const returnedCost = roundCurrency(item.qty * unitCost);
    const costDelta = item.disposition === 'RESTOCK' ? roundCurrency(returnedCost * -1) : 0;

    applyContribution({
      saleId: item.saleAdjustment.sale.id,
      saleNumber: item.saleAdjustment.sale.saleNumber,
      saleDate: item.saleAdjustment.sale.createdAt,
      activityAt: item.saleAdjustment.createdAt,
      productId: item.productId,
      productName: item.saleItem.productName,
      categoryName: item.product?.category?.name ?? 'Uncategorized',
      qtyDelta: item.qty * -1,
      revenueDelta: roundCurrency(returnedRevenue * -1),
      costDelta,
      countsAsReturn: true
    });
  }

  const roundedRevenue = roundCurrency(totalRevenue);
  const roundedCost = roundCurrency(totalCost);
  const roundedProfit = roundCurrency(roundedRevenue - roundedCost);

  return {
    summary: {
      revenue: roundedRevenue,
      costOfGoods: roundedCost,
      grossProfit: roundedProfit,
      grossMarginPercent: roundedRevenue > 0 ? roundCurrency((roundedProfit / roundedRevenue) * 100) : 0
    },
    dailyProfit: [...dailyMap.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([key, value]) => ({ key, ...value })),
    monthlyProfit: [...monthlyMap.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([key, value]) => ({ key, ...value })),
    profitPerSale: [...saleMap.values()]
      .map((entry) => ({
        ...entry,
        marginPercent: entry.revenue > 0 ? roundCurrency((entry.profit / entry.revenue) * 100) : 0
      }))
      .sort((left, right) => right.lastActivityAt.getTime() - left.lastActivityAt.getTime())
      .slice(0, 25),
    profitPerItem: [...itemMap.values()]
      .map((entry) => ({
        ...entry,
        marginPercent: entry.revenue > 0 ? roundCurrency((entry.profit / entry.revenue) * 100) : 0
      }))
      .sort((left, right) => right.profit - left.profit)
      .slice(0, 15),
    profitPerCategory: [...categoryMap.values()]
      .map((entry) => ({
        ...entry,
        marginPercent: entry.revenue > 0 ? roundCurrency((entry.profit / entry.revenue) * 100) : 0
      }))
      .sort((left, right) => right.profit - left.profit),
    topProfitableItems: [...itemMap.values()]
      .map((entry) => ({
        ...entry,
        marginPercent: entry.revenue > 0 ? roundCurrency((entry.profit / entry.revenue) * 100) : 0
      }))
      .sort((left, right) => right.profit - left.profit)
      .slice(0, 15)
  };
}

export async function getCashierReportData(shopId: string, filters: ReportFilters) {
  const salesWhere: Prisma.SaleWhereInput = {
    shopId,
    status: 'COMPLETED',
    createdAt: { gte: filters.from, lte: filters.to }
  };

  if (filters.cashierId) {
    salesWhere.cashierUserId = filters.cashierId;
  }

  const adjustmentsWhere: Prisma.SaleAdjustmentWhereInput = {
    shopId,
    createdAt: { gte: filters.from, lte: filters.to }
  };

  if (filters.cashierId) {
    adjustmentsWhere.createdByUserId = filters.cashierId;
  }

  const cashSessionWhere: Prisma.CashSessionWhereInput = {
    shopId,
    openedAt: { gte: filters.from, lte: filters.to }
  };

  if (filters.cashierId) {
    cashSessionWhere.userId = filters.cashierId;
  }

  const [sales, adjustments, cashSessions] = await Promise.all([
    prisma.sale.findMany({
      where: salesWhere,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        totalAmount: true,
        cashierUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        items: {
          select: {
            qty: true
          }
        }
      }
    }),
    prisma.saleAdjustment.findMany({
      where: adjustmentsWhere,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        adjustmentNumber: true,
        type: true,
        reason: true,
        totalAmount: true,
        createdAt: true,
        sale: {
          select: {
            saleNumber: true
          }
        },
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        approvedByUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    }),
    prisma.cashSession.findMany({
      where: cashSessionWhere,
      orderBy: [{ openedAt: 'desc' }],
      select: {
        id: true,
        openedAt: true,
        closedAt: true,
        status: true,
        openingFloat: true,
        closingExpected: true,
        closingActual: true,
        variance: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })
  ]);

  const cashierMap = new Map<string, {
    cashierId: string;
    cashierName: string;
    salesCount: number;
    revenueHandled: number;
    totalItems: number;
    refundCount: number;
    voidCount: number;
    shiftCount: number;
    shiftExpected: number;
    shiftActual: number;
    shiftVariance: number;
  }>();

  const ensureCashierEntry = (cashier: { id: string; name: string | null; email: string | null } | null | undefined) => {
    const cashierId = cashier?.id ?? 'unknown';
    const existing = cashierMap.get(cashierId);
    if (existing) {
      return existing;
    }

    const created = {
      cashierId,
      cashierName: cashierLabel(cashier),
      salesCount: 0,
      revenueHandled: 0,
      totalItems: 0,
      refundCount: 0,
      voidCount: 0,
      shiftCount: 0,
      shiftExpected: 0,
      shiftActual: 0,
      shiftVariance: 0
    };
    cashierMap.set(cashierId, created);
    return created;
  };

  for (const sale of sales) {
    const entry = ensureCashierEntry(sale.cashierUser);
    entry.salesCount += 1;
    entry.revenueHandled = roundCurrency(entry.revenueHandled + Number(sale.totalAmount.toString()));
    entry.totalItems += sale.items.reduce((sum, item) => sum + item.qty, 0);
  }

  const refunds = adjustments
    .filter((entry) => entry.type === 'REFUND' || entry.type === 'EXCHANGE')
    .map((entry) => {
      const cashierEntry = ensureCashierEntry(entry.createdByUser);
      cashierEntry.refundCount += 1;

      return {
        id: entry.id,
        adjustmentNumber: entry.adjustmentNumber,
        type: entry.type,
        reason: entry.reason,
        totalAmount: Number(entry.totalAmount.toString()),
        createdAt: entry.createdAt,
        saleNumber: entry.sale.saleNumber,
        cashierName: cashierLabel(entry.createdByUser),
        approvedByName: cashierLabel(entry.approvedByUser)
      };
    });

  const voids = adjustments
    .filter((entry) => entry.type === 'VOID')
    .map((entry) => {
      const cashierEntry = ensureCashierEntry(entry.createdByUser);
      cashierEntry.voidCount += 1;

      return {
        id: entry.id,
        adjustmentNumber: entry.adjustmentNumber,
        reason: entry.reason,
        totalAmount: Number(entry.totalAmount.toString()),
        createdAt: entry.createdAt,
        saleNumber: entry.sale.saleNumber,
        cashierName: cashierLabel(entry.createdByUser),
        approvedByName: cashierLabel(entry.approvedByUser)
      };
    });

  const shiftSessions = cashSessions.map((session) => {
    const cashierEntry = ensureCashierEntry(session.user);
    cashierEntry.shiftCount += 1;
    cashierEntry.shiftExpected = roundCurrency(cashierEntry.shiftExpected + toNumber(session.closingExpected));
    cashierEntry.shiftActual = roundCurrency(cashierEntry.shiftActual + toNumber(session.closingActual));
    cashierEntry.shiftVariance = roundCurrency(cashierEntry.shiftVariance + toNumber(session.variance));

    return {
      id: session.id,
      cashierId: session.user.id,
      cashierName: cashierLabel(session.user),
      openedAt: session.openedAt,
      closedAt: session.closedAt,
      status: session.status,
      openingFloat: toNumber(session.openingFloat),
      closingExpected: toNumber(session.closingExpected),
      closingActual: toNumber(session.closingActual),
      variance: toNumber(session.variance)
    };
  });

  return {
    summary: {
      totalRevenue: roundCurrency(sales.reduce((sum, sale) => sum + Number(sale.totalAmount.toString()), 0)),
      totalTransactions: sales.length,
      refundTotal: roundCurrency(refunds.reduce((sum, entry) => sum + entry.totalAmount, 0)),
      voidTotal: roundCurrency(voids.reduce((sum, entry) => sum + entry.totalAmount, 0)),
      refundCount: refunds.length,
      voidCount: voids.length,
      shiftCount: shiftSessions.length
    },
    topCashiers: [...cashierMap.values()]
      .sort((left, right) => right.revenueHandled - left.revenueHandled)
      .map((entry) => ({
        ...entry,
        averageTicket: entry.salesCount ? roundCurrency(entry.revenueHandled / entry.salesCount) : 0,
        averageBasketSize: entry.salesCount ? roundCurrency(entry.totalItems / entry.salesCount) : 0
      })),
    shiftSessions,
    refunds,
    voids
  };
}
