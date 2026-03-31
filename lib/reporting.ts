import { Prisma } from '@prisma/client';
import { PAYMENT_METHODS } from '@/lib/payments';
import { prisma } from '@/lib/prisma';
import { roundCurrency } from '@/lib/inventory';

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
  const [salesAggregate, productValuationRows, adjustmentRows, profitRows] = await Promise.all([
    prisma.sale.aggregate({
      where: {
        shopId,
        status: 'COMPLETED',
        createdAt: { gte: filters.from, lte: filters.to }
      },
      _sum: { totalAmount: true },
      _count: true
    }),
    prisma.product.findMany({
      where: { shopId, isActive: true },
      select: {
        stockQty: true,
        cost: true
      }
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
    }),
    prisma.saleItem.findMany({
      where: {
        sale: {
          shopId,
          status: 'COMPLETED',
          createdAt: { gte: filters.from, lte: filters.to }
        }
      },
      select: {
        qty: true,
        lineTotal: true,
        sale: {
          select: {
            subtotal: true,
            discountAmount: true
          }
        },
        product: {
          select: {
            cost: true
          }
        }
      }
    })
  ]);

  const inventoryValuation = roundCurrency(
    productValuationRows.reduce(
      (sum, product) => sum + product.stockQty * Number(product.cost.toString()),
      0
    )
  );

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

  // Profit uses the current product cost because the app does not yet snapshot cost at sale time.
  const grossProfit = roundCurrency(
    profitRows.reduce((sum, item) => {
      const lineSubtotal = Number(item.lineTotal.toString());
      const saleSubtotal = Number(item.sale.subtotal.toString());
      const saleDiscount = Number(item.sale.discountAmount.toString());
      const allocatedDiscount = saleSubtotal > 0 ? (lineSubtotal / saleSubtotal) * saleDiscount : 0;
      const revenue = roundCurrency(lineSubtotal - allocatedDiscount);
      const cost = roundCurrency(item.qty * Number(item.product.cost.toString()));
      return sum + revenue - cost;
    }, 0)
  );

  return {
    revenue: roundCurrency(Number(salesAggregate._sum.totalAmount ?? 0)),
    transactionCount: salesAggregate._count,
    inventoryValuation,
    refundTotal,
    voidTotal,
    grossProfit
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

  const [products, saleItems] = await Promise.all([
    prisma.product.findMany({
      where: productWhere,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        stockQty: true,
        reorderPoint: true,
        cost: true,
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

  const salesByProduct = new Map<string, { qty: number; revenue: number }>();

  for (const item of saleItems) {
    const current = salesByProduct.get(item.productId) ?? { qty: 0, revenue: 0 };
    current.qty += item.qty;
    current.revenue += Number(item.lineTotal.toString());
    salesByProduct.set(item.productId, current);
  }

  const productRows = products.map((product) => {
    const sold = salesByProduct.get(product.id) ?? { qty: 0, revenue: 0 };
    const valuation = roundCurrency(product.stockQty * Number(product.cost.toString()));

    return {
      id: product.id,
      name: product.name,
      categoryName: product.category?.name ?? 'Uncategorized',
      stockQty: product.stockQty,
      reorderPoint: product.reorderPoint,
      soldQty: sold.qty,
      soldRevenue: roundCurrency(sold.revenue),
      valuation,
      unitCost: Number(product.cost.toString())
    };
  });

  return {
    summary: {
      inventoryValuation: roundCurrency(productRows.reduce((sum, product) => sum + product.valuation, 0)),
      activeProducts: productRows.length,
      lowMovementCount: productRows.filter(
        (product) => product.soldQty > 0 && product.soldQty <= LOW_MOVEMENT_QTY_THRESHOLD
      ).length,
      deadStockCount: productRows.filter((product) => product.soldQty === 0 && product.stockQty > 0).length
    },
    valuationRows: productRows
      .filter((product) => product.stockQty > 0)
      .sort((left, right) => right.valuation - left.valuation)
      .slice(0, 20),
    lowMovement: productRows
      .filter((product) => product.soldQty > 0 && product.soldQty <= LOW_MOVEMENT_QTY_THRESHOLD)
      .sort((left, right) => left.soldQty - right.soldQty || left.soldRevenue - right.soldRevenue)
      .slice(0, 20),
    deadStock: productRows
      .filter((product) => product.soldQty === 0 && product.stockQty > 0)
      .sort((left, right) => right.valuation - left.valuation)
      .slice(0, 20)
  };
}

export async function getProfitReportData(shopId: string, filters: ReportFilters) {
  const saleItems = await prisma.saleItem.findMany({
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
      productName: true,
      qty: true,
      lineTotal: true,
      sale: {
        select: {
          createdAt: true,
          subtotal: true,
          discountAmount: true
        }
      },
      product: {
        select: {
          cost: true,
          category: {
            select: {
              name: true
            }
          }
        }
      }
    }
  });

  const dailyMap = new Map<string, { label: string; revenue: number; cost: number; profit: number }>();
  const monthlyMap = new Map<string, { label: string; revenue: number; cost: number; profit: number }>();
  const itemMap = new Map<string, { name: string; categoryName: string; qty: number; revenue: number; cost: number; profit: number }>();

  let totalRevenue = 0;
  let totalCost = 0;

  for (const item of saleItems) {
    const lineSubtotal = Number(item.lineTotal.toString());
    const saleSubtotal = Number(item.sale.subtotal.toString());
    const saleDiscount = Number(item.sale.discountAmount.toString());
    const allocatedDiscount = saleSubtotal > 0 ? (lineSubtotal / saleSubtotal) * saleDiscount : 0;
    const revenue = roundCurrency(lineSubtotal - allocatedDiscount);
    const cost = roundCurrency(item.qty * Number(item.product.cost.toString()));
    const profit = roundCurrency(revenue - cost);

    totalRevenue += revenue;
    totalCost += cost;

    const saleDayKey = dayKey(item.sale.createdAt);
    const saleMonthKey = monthKey(item.sale.createdAt);

    const dayEntry = dailyMap.get(saleDayKey) ?? {
      label: dayLabel(item.sale.createdAt),
      revenue: 0,
      cost: 0,
      profit: 0
    };
    dayEntry.revenue += revenue;
    dayEntry.cost += cost;
    dayEntry.profit += profit;
    dailyMap.set(saleDayKey, dayEntry);

    const monthEntry = monthlyMap.get(saleMonthKey) ?? {
      label: monthLabel(item.sale.createdAt),
      revenue: 0,
      cost: 0,
      profit: 0
    };
    monthEntry.revenue += revenue;
    monthEntry.cost += cost;
    monthEntry.profit += profit;
    monthlyMap.set(saleMonthKey, monthEntry);

    const itemEntry = itemMap.get(item.productId) ?? {
      name: item.productName,
      categoryName: item.product.category?.name ?? 'Uncategorized',
      qty: 0,
      revenue: 0,
      cost: 0,
      profit: 0
    };
    itemEntry.qty += item.qty;
    itemEntry.revenue += revenue;
    itemEntry.cost += cost;
    itemEntry.profit += profit;
    itemMap.set(item.productId, itemEntry);
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
    topProfitableItems: [...itemMap.entries()]
      .map(([productId, value]) => ({ productId, ...value }))
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

  const [sales, adjustments] = await Promise.all([
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
    })
  ]);

  const cashierMap = new Map<string, { cashierId: string; cashierName: string; revenue: number; transactions: number }>();

  for (const sale of sales) {
    const cashierId = sale.cashierUser?.id ?? 'unknown';
    const current = cashierMap.get(cashierId) ?? {
      cashierId,
      cashierName: cashierLabel(sale.cashierUser),
      revenue: 0,
      transactions: 0
    };
    current.revenue += Number(sale.totalAmount.toString());
    current.transactions += 1;
    cashierMap.set(cashierId, current);
  }

  const refunds = adjustments
    .filter((entry) => entry.type === 'REFUND' || entry.type === 'EXCHANGE')
    .map((entry) => ({
      id: entry.id,
      adjustmentNumber: entry.adjustmentNumber,
      type: entry.type,
      reason: entry.reason,
      totalAmount: Number(entry.totalAmount.toString()),
      createdAt: entry.createdAt,
      saleNumber: entry.sale.saleNumber,
      cashierName: cashierLabel(entry.createdByUser),
      approvedByName: cashierLabel(entry.approvedByUser)
    }));

  const voids = adjustments
    .filter((entry) => entry.type === 'VOID')
    .map((entry) => ({
      id: entry.id,
      adjustmentNumber: entry.adjustmentNumber,
      reason: entry.reason,
      totalAmount: Number(entry.totalAmount.toString()),
      createdAt: entry.createdAt,
      saleNumber: entry.sale.saleNumber,
      cashierName: cashierLabel(entry.createdByUser),
      approvedByName: cashierLabel(entry.approvedByUser)
    }));

  return {
    summary: {
      totalRevenue: roundCurrency(sales.reduce((sum, sale) => sum + Number(sale.totalAmount.toString()), 0)),
      totalTransactions: sales.length,
      refundTotal: roundCurrency(refunds.reduce((sum, entry) => sum + entry.totalAmount, 0)),
      voidTotal: roundCurrency(voids.reduce((sum, entry) => sum + entry.totalAmount, 0))
    },
    topCashiers: [...cashierMap.values()]
      .sort((left, right) => right.revenue - left.revenue)
      .map((entry) => ({
        ...entry,
        averageTicket: entry.transactions ? roundCurrency(entry.revenue / entry.transactions) : 0
      })),
    refunds,
    voids
  };
}
