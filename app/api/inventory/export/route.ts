import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { getStockLevel, stockLevelLabel } from '@/lib/inventory';
import { prisma } from '@/lib/prisma';

function csvCell(value: string | number | null | undefined) {
  const normalized = value == null ? '' : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
}

export async function GET() {
  try {
    const { shopId, shop } = await requirePermission('VIEW_PURCHASE_COSTS');
    const settings = await prisma.shopSetting.findUnique({ where: { shopId } });
    const products = await prisma.product.findMany({
      where: { shopId },
      include: {
        category: {
          select: {
            name: true
          }
        }
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }]
    });

    const threshold = settings?.lowStockThreshold ?? 5;
    const header = [
      'Product Name',
      'SKU',
      'Barcode',
      'Category',
      'Price',
      'Cost',
      'Stock Qty',
      'Reorder Point',
      'Status',
      'Low Stock',
      'Archived'
    ];
    const rows = products.map((product) => {
      const level = getStockLevel(product.stockQty, product.reorderPoint, threshold);
      return [
        product.name,
        product.sku,
        product.barcode,
        product.category?.name ?? 'Uncategorized',
        product.price.toString(),
        product.cost.toString(),
        product.stockQty,
        product.reorderPoint,
        stockLevelLabel(level),
        level === 'LOW_STOCK' || level === 'OUT_OF_STOCK' ? 'Yes' : 'No',
        product.isActive ? 'No' : 'Yes'
      ];
    });

    const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
    const fileName = `${shop.slug}-inventory-export.csv`;

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`
      }
    });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to export inventory.');
  }
}
