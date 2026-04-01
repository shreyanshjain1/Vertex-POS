import { DocumentSequenceType } from '@prisma/client';
import { NextResponse } from 'next/server';
import { saleSchema } from '@/lib/auth/validation';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { logActivity } from '@/lib/activity';
import { getCustomerLoyaltyBalance } from '@/lib/customer-operations';
import {
  calculateLoyaltyDiscount,
  calculatePointsEarned,
  getCustomerDisplayName
} from '@/lib/customers';
import { getNextDocumentNumber } from '@/lib/document-sequence';
import { collapseSaleItems, normalizeText, roundCurrency } from '@/lib/inventory';
import {
  getSalePaymentSummaryLabel,
  validatePaymentsForSale
} from '@/lib/payments';
import { buildVariantLabel } from '@/lib/product-merchandising';
import { prisma } from '@/lib/prisma';
import { CASH_PAYMENT_METHOD, getActiveCashSession } from '@/lib/register';
import { calculateTaxBreakdown } from '@/lib/shop-settings';

type SaleConflict = {
  type: 'INSUFFICIENT_STOCK' | 'PRICE_CHANGED' | 'PRODUCT_UNAVAILABLE';
  productId: string;
  variantId: string | null;
  productName: string;
  message: string;
  requestedQty?: number;
  availableQty?: number;
  queuedPrice?: number | null;
  currentPrice?: number | null;
};

function parseOptionalDateInput(value?: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function serializeSale<T extends {
  createdAt: Date;
  subtotal: { toString(): string };
  taxAmount: { toString(): string };
  discountAmount: { toString(): string };
  totalAmount: { toString(): string };
  changeDue: { toString(): string };
}>(sale: T) {
  return {
    ...sale,
    subtotal: sale.subtotal.toString(),
    taxAmount: sale.taxAmount.toString(),
    discountAmount: sale.discountAmount.toString(),
    totalAmount: sale.totalAmount.toString(),
    changeDue: sale.changeDue.toString(),
    createdAt: sale.createdAt.toISOString()
  };
}

function conflictResponse(error: string, conflicts: SaleConflict[]) {
  return NextResponse.json(
    {
      error,
      code: 'OFFLINE_SYNC_CONFLICT',
      conflicts
    },
    { status: 409 }
  );
}

export async function GET() {
  try {
    const { shopId } = await requireRole('CASHIER');
    const sales = await prisma.sale.findMany({
      where: { shopId },
      include: { items: true },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      sales: sales.map((sale) => ({
        ...serializeSale(sale),
        items: sale.items.map((item) => ({
          ...item,
          unitPrice: item.unitPrice.toString(),
          lineTotal: item.lineTotal.toString()
        }))
      }))
    });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to load sales.');
  }
}

export async function POST(request: Request) {
  try {
    const { shopId, userId, session } = await requireRole('CASHIER');
    const body = await request.json();
    const parsed = saleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid sale payload.' },
        { status: 400 }
      );
    }

    const occurredAt = parseOptionalDateInput(parsed.data.occurredAt) ?? new Date();
    if (parsed.data.occurredAt && !parseOptionalDateInput(parsed.data.occurredAt)) {
      return NextResponse.json(
        { error: 'Enter a valid sale timestamp.' },
        { status: 400 }
      );
    }

    const clientRequestId = normalizeText(parsed.data.clientRequestId);
    if (clientRequestId) {
      const existingSale = await prisma.sale.findFirst({
        where: {
          shopId,
          clientRequestId
        },
        include: {
          items: true
        }
      });

      if (existingSale) {
        return NextResponse.json({
          sale: {
            ...serializeSale(existingSale),
            items: existingSale.items.map((item) => ({
              ...item,
              unitPrice: item.unitPrice.toString(),
              lineTotal: item.lineTotal.toString()
            }))
          },
          alreadySynced: true
        });
      }
    }

    const rawPayments = parsed.data.payments.map((payment) => ({
      method: payment.method,
      amount: Number(payment.amount),
      referenceNumber: payment.referenceNumber ?? null
    }));
    const isCreditSale = parsed.data.isCreditSale;
    const creditDueDate = parseOptionalDateInput(parsed.data.creditDueDate);
    const loyaltyPointsToRedeem = parsed.data.loyaltyPointsToRedeem ?? 0;
    const loyaltyDiscountAmount = calculateLoyaltyDiscount(loyaltyPointsToRedeem);

    if (isCreditSale && !creditDueDate) {
      return NextResponse.json(
        { error: 'Enter a valid credit due date.' },
        { status: 400 }
      );
    }

    const hasCashPayment = !isCreditSale && rawPayments.some((payment) => payment.method === CASH_PAYMENT_METHOD);

    if (hasCashPayment) {
      if (parsed.data.cashSessionId?.trim()) {
        const referencedSession = await prisma.cashSession.findFirst({
          where: {
            id: parsed.data.cashSessionId.trim(),
            shopId,
            userId
          }
        });

        if (!referencedSession) {
          return NextResponse.json(
            { error: 'The referenced cash session was not found for this cashier.' },
            { status: 409 }
          );
        }

        const closesAt = referencedSession.closedAt ?? occurredAt;
        if (occurredAt < referencedSession.openedAt || occurredAt > closesAt) {
          return NextResponse.json(
            { error: 'The sale timestamp falls outside the referenced cash session.' },
            { status: 409 }
          );
        }
      } else {
        const activeCashSession = await getActiveCashSession(prisma, shopId, userId);
        if (!activeCashSession) {
          return NextResponse.json(
            { error: 'Open a register session before accepting cash sales.' },
            { status: 409 }
          );
        }
      }
    }

    const items = collapseSaleItems(parsed.data.items);
    const [settings, products, customer] = await Promise.all([
      prisma.shopSetting.findUnique({ where: { shopId } }),
      prisma.product.findMany({
        where: {
          shopId,
          id: { in: items.map((item) => item.productId) }
        },
        include: {
          variants: true
        }
      }),
      parsed.data.customerId
        ? prisma.customer.findFirst({
            where: {
              id: parsed.data.customerId,
              shopId,
              isActive: true
            }
          })
        : Promise.resolve(null)
    ]);

    if (parsed.data.customerId && !customer) {
      return NextResponse.json(
        { error: 'Selected customer was not found or is archived.' },
        { status: 404 }
      );
    }

    const productMap = new Map(products.map((product) => [product.id, product]));
    const productQtyTotals = new Map<string, number>();
    const conflicts: SaleConflict[] = [];

    for (const item of items) {
      const product = productMap.get(item.productId);

      if (!product || !product.isActive) {
        conflicts.push({
          type: 'PRODUCT_UNAVAILABLE',
          productId: item.productId,
          variantId: item.variantId ?? null,
          productName: product?.name ?? 'Archived product',
          message: product
            ? `${product.name} is archived and cannot be sold.`
            : 'One queued item no longer exists in the branch catalog.'
        });
        continue;
      }

      const variant = item.variantId
        ? product.variants.find((entry) => entry.id === item.variantId)
        : null;

      if (item.variantId && (!variant || !variant.isActive)) {
        conflicts.push({
          type: 'PRODUCT_UNAVAILABLE',
          productId: item.productId,
          variantId: item.variantId,
          productName: product.name,
          message: `A selected variant for ${product.name} is no longer available.`
        });
        continue;
      }

      const currentUnitPrice = Number(variant?.priceOverride ?? product.price);
      if (item.priceSnapshot !== null && item.priceSnapshot !== undefined) {
        const queuedPrice = roundCurrency(Number(item.priceSnapshot));
        if (queuedPrice !== roundCurrency(currentUnitPrice)) {
          conflicts.push({
            type: 'PRICE_CHANGED',
            productId: item.productId,
            variantId: item.variantId ?? null,
            productName: product.name,
            queuedPrice,
            currentPrice: roundCurrency(currentUnitPrice),
            message: `${product.name} changed price while this sale was queued offline.`
          });
        }
      }

      productQtyTotals.set(item.productId, (productQtyTotals.get(item.productId) ?? 0) + item.qty);
    }

    for (const [productId, qty] of productQtyTotals) {
      const product = productMap.get(productId);
      if (!product) continue;

      if (product.stockQty < qty) {
        conflicts.push({
          type: 'INSUFFICIENT_STOCK',
          productId,
          variantId: null,
          productName: product.name,
          requestedQty: qty,
          availableQty: product.stockQty,
          message: `${product.name} has only ${product.stockQty} item(s) available.`
        });
      }
    }

    if (conflicts.length) {
      return conflictResponse(
        'One or more queued sale lines need cashier review before sync can continue.',
        conflicts
      );
    }

    const saleLines = items.map((item) => {
      const product = productMap.get(item.productId)!;
      const variant = item.variantId ? product.variants.find((entry) => entry.id === item.variantId) ?? null : null;
      const unitPrice = Number(variant?.priceOverride ?? product.price);

      return {
        ...item,
        product,
        variant,
        unitPrice,
        lineTotal: roundCurrency(unitPrice * item.qty)
      };
    });

    const subtotal = roundCurrency(
      saleLines.reduce((sum, line) => sum + line.lineTotal, 0)
    );
    const manualDiscountAmount = roundCurrency(Number(parsed.data.discountAmount ?? 0));
    const discountAmount = roundCurrency(manualDiscountAmount + loyaltyDiscountAmount);
    const taxBreakdown = calculateTaxBreakdown({
      subtotal,
      discountAmount,
      taxRate: Number(settings?.taxRate ?? 0),
      taxMode: settings?.taxMode ?? 'EXCLUSIVE'
    });

    if (discountAmount > subtotal + taxBreakdown.taxAmount) {
      return NextResponse.json(
        { error: 'Discount cannot exceed the sale total.' },
        { status: 400 }
      );
    }

    const taxAmount = taxBreakdown.taxAmount;
    const totalAmount = taxBreakdown.totalAmount;
    const paymentValidation = isCreditSale
      ? {
          ok: true as const,
          payments: [],
          summary: {
            totalPaid: 0,
            remainingAmount: totalAmount,
            changeDue: 0,
            cashReceived: 0,
            hasCashPayment: false
          }
        }
      : validatePaymentsForSale(totalAmount, rawPayments);

    if (!paymentValidation.ok) {
      return NextResponse.json(
        { error: paymentValidation.error },
        { status: 400 }
      );
    }

    const paymentMethodSummary = isCreditSale
      ? 'Customer Credit'
      : getSalePaymentSummaryLabel(paymentValidation.payments);
    const pointsEarned = customer ? calculatePointsEarned(totalAmount) : 0;

    const sale = await prisma.$transaction(async (tx) => {
      const currentLoyaltyBalance = customer ? await getCustomerLoyaltyBalance(tx, customer.id) : 0;

      if (loyaltyPointsToRedeem > currentLoyaltyBalance) {
        throw new Error('LOYALTY_BALANCE_EXCEEDED');
      }

      const saleNumber = await getNextDocumentNumber(tx, {
        shopId,
        type: DocumentSequenceType.SALE,
        prefix: settings?.salePrefix ?? 'SAL'
      });
      const receiptNumber = await getNextDocumentNumber(tx, {
        shopId,
        type: DocumentSequenceType.RECEIPT,
        prefix: settings?.receiptPrefix ?? 'RCP'
      });

      const saleRecord = await tx.sale.create({
        data: {
          shopId,
          cashierUserId: userId,
          customerId: customer?.id ?? null,
          saleNumber,
          receiptNumber,
          clientRequestId,
          createdAt: occurredAt,
          customerName: normalizeText(parsed.data.customerName) ?? (customer ? getCustomerDisplayName(customer) : null),
          customerPhone: normalizeText(parsed.data.customerPhone) ?? normalizeText(customer?.phone),
          subtotal,
          taxAmount,
          discountAmount,
          totalAmount,
          changeDue: paymentValidation.summary.changeDue,
          paymentMethod: paymentMethodSummary,
          isCreditSale,
          loyaltyPointsEarned: pointsEarned,
          loyaltyPointsRedeemed: loyaltyPointsToRedeem,
          loyaltyDiscountAmount,
          notes: normalizeText(parsed.data.notes),
          cashierName: session.user.name || session.user.email || 'Cashier',
          items: {
            create: saleLines.map((line) => ({
              productId: line.productId,
              productVariantId: line.variant?.id ?? null,
              productName: line.product.name,
              variantLabel: line.variant ? buildVariantLabel(line.variant) || null : null,
              variantSkuSnapshot: line.variant?.sku ?? null,
              variantBarcodeSnapshot: line.variant?.barcode ?? null,
              qty: line.qty,
              unitPrice: line.unitPrice,
              lineTotal: line.lineTotal
            }))
          },
          payments: paymentValidation.payments.length
            ? {
                create: paymentValidation.payments.map((payment) => ({
                  method: payment.method,
                  amount: payment.amount,
                  referenceNumber: normalizeText(payment.referenceNumber),
                  createdAt: occurredAt
                }))
              }
            : undefined
        },
        include: { items: true }
      });

      if (customer) {
        let nextBalance = currentLoyaltyBalance;

        if (loyaltyPointsToRedeem > 0) {
          nextBalance -= loyaltyPointsToRedeem;
          await tx.customerLoyaltyLedger.create({
            data: {
              shopId,
              customerId: customer.id,
              saleId: saleRecord.id,
              type: 'REDEEMED',
              points: loyaltyPointsToRedeem,
              balanceAfter: nextBalance,
              note: `Redeemed for sale ${saleRecord.saleNumber}.`,
              createdAt: occurredAt
            }
          });
        }

        if (pointsEarned > 0) {
          nextBalance += pointsEarned;
          await tx.customerLoyaltyLedger.create({
            data: {
              shopId,
              customerId: customer.id,
              saleId: saleRecord.id,
              type: 'EARNED',
              points: pointsEarned,
              balanceAfter: nextBalance,
              note: `Earned from sale ${saleRecord.saleNumber}.`,
              createdAt: occurredAt
            }
          });
        }

        if (isCreditSale && creditDueDate) {
          await tx.customerCreditLedger.create({
            data: {
              shopId,
              customerId: customer.id,
              saleId: saleRecord.id,
              dueDate: creditDueDate,
              originalAmount: totalAmount,
              balance: totalAmount,
              status: creditDueDate < new Date() ? 'OVERDUE' : 'OPEN',
              createdAt: occurredAt
            }
          });
        }
      }

      for (const [productId, qty] of productQtyTotals) {
        const product = productMap.get(productId)!;
        await tx.product.update({
          where: { id: product.id },
          data: {
            stockQty: {
              decrement: qty
            }
          }
        });

        await tx.inventoryMovement.create({
          data: {
            shopId,
            productId: product.id,
            type: 'SALE_COMPLETED',
            qtyChange: qty * -1,
            referenceId: saleRecord.id,
            userId,
            notes: `Sale ${saleRecord.saleNumber}`,
            createdAt: occurredAt
          }
        });
      }

      await logActivity({
        tx,
        shopId,
        userId,
        action: clientRequestId ? 'SALE_SYNCED_FROM_OFFLINE_QUEUE' : 'SALE_COMPLETED',
        entityType: 'Sale',
        entityId: saleRecord.id,
        description: clientRequestId
          ? `Synced offline sale ${saleRecord.saleNumber}.`
          : `Completed sale ${saleRecord.saleNumber}.`,
        metadata: {
          customerId: customer?.id ?? null,
          customerName: customer ? getCustomerDisplayName(customer) : normalizeText(parsed.data.customerName),
          itemCount: saleLines.reduce((sum, line) => sum + line.qty, 0),
          variantLineCount: saleLines.filter((line) => line.variant).length,
          paymentMethod: paymentMethodSummary,
          paymentCount: paymentValidation.payments.length,
          isCreditSale,
          creditDueDate: creditDueDate?.toISOString() ?? null,
          loyaltyPointsRedeemed: loyaltyPointsToRedeem,
          loyaltyPointsEarned: pointsEarned,
          totalAmount,
          totalPaid: paymentValidation.summary.totalPaid,
          changeDue: paymentValidation.summary.changeDue,
          clientRequestId,
          occurredAt: occurredAt.toISOString()
        }
      });

      return saleRecord;
    });

    return NextResponse.json(
      {
        sale: {
          ...serializeSale(sale),
          items: sale.items.map((item) => ({
            ...item,
            unitPrice: item.unitPrice.toString(),
            lineTotal: item.lineTotal.toString()
          }))
        }
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'LOYALTY_BALANCE_EXCEEDED') {
      return NextResponse.json(
        { error: 'Customer does not have enough loyalty points for this redemption.' },
        { status: 400 }
      );
    }

    return apiErrorResponse(error, 'Unable to complete sale.');
  }
}
