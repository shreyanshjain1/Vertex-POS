import { Prisma, PrismaClient } from '@prisma/client';
import { logActivity } from '@/lib/activity';

type DbClient = PrismaClient | Prisma.TransactionClient;

export class StockTransferOperationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'StockTransferOperationError';
    this.status = status;
  }
}

export const stockTransferDetailInclude = {
  fromShop: {
    select: {
      id: true,
      name: true
    }
  },
  toShop: {
    select: {
      id: true,
      name: true
    }
  },
  createdByUser: {
    select: {
      id: true,
      name: true,
      email: true
    }
  },
  receivedByUser: {
    select: {
      id: true,
      name: true,
      email: true
    }
  },
  items: {
    include: {
      fromProduct: {
        select: {
          id: true,
          name: true,
          stockQty: true,
          sku: true,
          barcode: true
        }
      },
      toProduct: {
        select: {
          id: true,
          name: true,
          stockQty: true,
          sku: true,
          barcode: true
        }
      }
    },
    orderBy: [{ createdAt: 'asc' }]
  }
} satisfies Prisma.StockTransferInclude;

type StockTransferDetail = Prisma.StockTransferGetPayload<{
  include: typeof stockTransferDetailInclude;
}>;

export async function getStockTransferDetailOrThrow(
  db: DbClient,
  stockTransferId: string,
  shopId: string
) {
  const stockTransfer = await db.stockTransfer.findFirst({
    where: {
      id: stockTransferId,
      OR: [{ fromShopId: shopId }, { toShopId: shopId }]
    },
    include: stockTransferDetailInclude
  });

  if (!stockTransfer) {
    throw new StockTransferOperationError('Stock transfer not found.', 404);
  }

  return stockTransfer;
}

export async function sendStockTransfer({
  tx,
  stockTransfer,
  userId
}: {
  tx: Prisma.TransactionClient;
  stockTransfer: StockTransferDetail;
  userId: string;
}) {
  if (stockTransfer.status === 'IN_TRANSIT') {
    throw new StockTransferOperationError('This transfer is already in transit.');
  }

  if (stockTransfer.status === 'RECEIVED') {
    throw new StockTransferOperationError('Received transfers cannot be sent again.');
  }

  if (stockTransfer.status === 'CANCELLED') {
    throw new StockTransferOperationError('Cancelled transfers cannot be sent.');
  }

  const sourceProducts = await tx.product.findMany({
    where: {
      id: { in: stockTransfer.items.map((item) => item.fromProductId) },
      shopId: stockTransfer.fromShopId
    },
    select: {
      id: true,
      name: true,
      stockQty: true
    }
  });
  const sourceProductMap = new Map(sourceProducts.map((product) => [product.id, product]));

  for (const item of stockTransfer.items) {
    const sourceProduct = sourceProductMap.get(item.fromProductId);
    if (!sourceProduct) {
      throw new StockTransferOperationError(`Source product ${item.productNameSnapshot} is no longer available.`, 404);
    }

    if (item.qty > sourceProduct.stockQty) {
      throw new StockTransferOperationError(
        `Cannot send more than available stock for ${item.productNameSnapshot}.`
      );
    }
  }

  for (const item of stockTransfer.items) {
    await tx.product.update({
      where: { id: item.fromProductId },
      data: {
        stockQty: {
          decrement: item.qty
        }
      }
    });

    await tx.inventoryMovement.create({
      data: {
        shopId: stockTransfer.fromShopId,
        productId: item.fromProductId,
        type: 'TRANSFER_OUT',
        qtyChange: item.qty * -1,
        referenceId: stockTransfer.id,
        userId,
        notes: `Transfer ${stockTransfer.transferNumber} to ${stockTransfer.toShop.name}`
      }
    });
  }

  const updatedTransfer = await tx.stockTransfer.update({
    where: { id: stockTransfer.id },
    data: {
      status: 'IN_TRANSIT',
      sentAt: new Date()
    }
  });

  await logActivity({
    tx,
    shopId: stockTransfer.fromShopId,
    userId,
    action: 'STOCK_TRANSFER_SENT',
    entityType: 'StockTransfer',
    entityId: stockTransfer.id,
    description: `Sent stock transfer ${stockTransfer.transferNumber} to ${stockTransfer.toShop.name}.`,
    metadata: {
      itemCount: stockTransfer.items.length
    }
  });

  return updatedTransfer;
}

export async function receiveStockTransfer({
  tx,
  stockTransfer,
  userId
}: {
  tx: Prisma.TransactionClient;
  stockTransfer: StockTransferDetail;
  userId: string;
}) {
  if (stockTransfer.status === 'RECEIVED') {
    throw new StockTransferOperationError('This transfer has already been received.');
  }

  if (stockTransfer.status !== 'IN_TRANSIT') {
    throw new StockTransferOperationError('Only in-transit transfers can be received.');
  }

  for (const item of stockTransfer.items) {
    await tx.product.update({
      where: { id: item.toProductId },
      data: {
        stockQty: {
          increment: item.qty
        }
      }
    });

    await tx.inventoryMovement.create({
      data: {
        shopId: stockTransfer.toShopId,
        productId: item.toProductId,
        type: 'TRANSFER_IN',
        qtyChange: item.qty,
        referenceId: stockTransfer.id,
        userId,
        notes: `Transfer ${stockTransfer.transferNumber} received from ${stockTransfer.fromShop.name}`
      }
    });
  }

  const updatedTransfer = await tx.stockTransfer.update({
    where: { id: stockTransfer.id },
    data: {
      status: 'RECEIVED',
      receivedAt: new Date(),
      receivedByUserId: userId
    }
  });

  await logActivity({
    tx,
    shopId: stockTransfer.toShopId,
    userId,
    action: 'STOCK_TRANSFER_RECEIVED',
    entityType: 'StockTransfer',
    entityId: stockTransfer.id,
    description: `Received stock transfer ${stockTransfer.transferNumber} from ${stockTransfer.fromShop.name}.`,
    metadata: {
      itemCount: stockTransfer.items.length
    }
  });

  return updatedTransfer;
}

export async function cancelStockTransfer({
  tx,
  stockTransfer,
  userId
}: {
  tx: Prisma.TransactionClient;
  stockTransfer: StockTransferDetail;
  userId: string;
}) {
  if (stockTransfer.status !== 'DRAFT') {
    throw new StockTransferOperationError('Only draft transfers can be cancelled.');
  }

  const updatedTransfer = await tx.stockTransfer.update({
    where: { id: stockTransfer.id },
    data: {
      status: 'CANCELLED'
    }
  });

  await logActivity({
    tx,
    shopId: stockTransfer.fromShopId,
    userId,
    action: 'STOCK_TRANSFER_CANCELLED',
    entityType: 'StockTransfer',
    entityId: stockTransfer.id,
    description: `Cancelled stock transfer ${stockTransfer.transferNumber}.`
  });

  return updatedTransfer;
}
