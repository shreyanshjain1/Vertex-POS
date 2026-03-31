import AppHeader from '@/components/layout/AppHeader';
import CheckoutClient from '@/components/checkout/CheckoutClient';
import { getActiveShopContext } from '@/lib/auth/get-active-shop';
import { hasRole } from '@/lib/authz';
import {
  cleanupExpiredParkedSales,
  serializeParkedSale
} from '@/lib/parked-sales';
import { buildVariantLabel } from '@/lib/product-merchandising';
import { prisma } from '@/lib/prisma';
import { getActiveCashSession } from '@/lib/register';

type CheckoutProduct = {
  id: string;
  productId: string;
  variantId: string | null;
  name: string;
  variantLabel: string | null;
  barcode: string | null;
  sku: string | null;
  price: string;
  stockQty: number;
  categoryId: string | null;
  imageUrl: string | null;
  category: {
    id: string;
    name: string;
  } | null;
};

type CheckoutCustomer = {
  id: string;
  type: string;
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  loyaltyBalance: number;
  receivableBalance: string;
  lastPurchaseAt: string | null;
};

export default async function CheckoutPage() {
  const { shopId, session, role, userId } = await getActiveShopContext();

  await cleanupExpiredParkedSales(prisma, shopId);

  const [products, categories, customers, settings, activeCashSession, parkedSales] = await Promise.all([
    prisma.product.findMany({
      where: { shopId, isActive: true },
      orderBy: { name: 'asc' },
      include: {
        category: {
          select: {
            id: true,
            name: true
          }
        },
        variants: {
          where: { isActive: true },
          orderBy: { createdAt: 'asc' }
        },
        images: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          take: 1
        }
      }
    }),
    prisma.category.findMany({
      where: { shopId, isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true
      }
    }),
    prisma.customer.findMany({
      where: { shopId, isActive: true },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        type: true,
        firstName: true,
        lastName: true,
        businessName: true,
        contactPerson: true,
        phone: true,
        email: true,
        loyaltyLedger: {
          select: {
            balanceAfter: true
          },
          orderBy: [{ createdAt: 'desc' }],
          take: 1
        },
        creditLedgers: {
          where: {
            status: {
              not: 'VOIDED'
            }
          },
          select: {
            balance: true
          }
        },
        sales: {
          where: {
            status: 'COMPLETED'
          },
          select: {
            createdAt: true
          },
          orderBy: [{ createdAt: 'desc' }],
          take: 1
        }
      }
    }),
    prisma.shopSetting.findUnique({
      where: { shopId }
    }),
    getActiveCashSession(prisma, shopId, session.user.id),
    prisma.parkedSale.findMany({
      where: {
        shopId,
        status: 'HELD',
        expiresAt: {
          gt: new Date()
        },
        ...(hasRole(role, 'MANAGER') ? {} : { cashierUserId: userId })
      },
      include: {
        cashier: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        items: {
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    })
  ]);

  return (
    <div className="space-y-6">
      <AppHeader
        title="Checkout"
        subtitle="Process sales quickly, prevent overselling, and generate receipt-ready transactions."
      />

      <CheckoutClient
        products={products.flatMap<CheckoutProduct>((product) => {
          if (product.variants.length) {
            return product.variants.map((variant) => ({
              id: variant.id,
              productId: product.id,
              variantId: variant.id,
              name: product.name,
              variantLabel: buildVariantLabel(variant) || null,
              barcode: variant.barcode,
              sku: variant.sku,
              price: variant.priceOverride?.toString() ?? product.price.toString(),
              stockQty: product.stockQty,
              categoryId: product.categoryId,
              imageUrl: product.images[0]?.imageUrl ?? null,
              category: product.category
                ? {
                    id: product.category.id,
                    name: product.category.name
                  }
                : null
            }));
          }

          return [{
            id: product.id,
            productId: product.id,
            variantId: null,
            name: product.name,
            variantLabel: null,
            barcode: product.barcode,
            sku: product.sku,
            price: product.price.toString(),
            stockQty: product.stockQty,
            categoryId: product.categoryId,
            imageUrl: product.images[0]?.imageUrl ?? null,
            category: product.category
              ? {
                  id: product.category.id,
                  name: product.category.name
                }
              : null
          }];
        })}
        categories={categories}
        customers={customers.map<CheckoutCustomer>((customer) => ({
          id: customer.id,
          type: customer.type,
          firstName: customer.firstName,
          lastName: customer.lastName,
          businessName: customer.businessName,
          contactPerson: customer.contactPerson,
          phone: customer.phone,
          email: customer.email,
          loyaltyBalance: customer.loyaltyLedger[0]?.balanceAfter ?? 0,
          receivableBalance: customer.creditLedgers
            .reduce((sum, ledger) => sum + Number(ledger.balance.toString()), 0)
            .toString(),
          lastPurchaseAt: customer.sales[0]?.createdAt.toISOString() ?? null
        }))}
        taxRate={Number(settings?.taxRate ?? 12)}
        currencySymbol={settings?.currencySymbol ?? '₱'}
        cashierName={session.user.name ?? 'Cashier'}
        hasActiveCashSession={Boolean(activeCashSession)}
        initialParkedSales={parkedSales.map(serializeParkedSale)}
      />
    </div>
  );
}
