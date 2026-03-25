import { DocumentSequenceType, Prisma } from '@prisma/client';

function formatDateKey(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('');
}

function sanitizePrefix(prefix: string, fallback: string) {
  const normalized = prefix.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  return normalized || fallback;
}

export async function getNextDocumentNumber(
  tx: Prisma.TransactionClient,
  {
    shopId,
    type,
    prefix
  }: {
    shopId: string;
    type: DocumentSequenceType;
    prefix: string;
  }
) {
  const safePrefix = sanitizePrefix(prefix, type.slice(0, 3));
  const dateKey = formatDateKey();

  const sequence = await tx.documentSequence.upsert({
    where: {
      shopId_type_dateKey: {
        shopId,
        type,
        dateKey
      }
    },
    update: {
      value: {
        increment: 1
      }
    },
    create: {
      shopId,
      type,
      dateKey,
      value: 1
    },
    select: {
      value: true
    }
  });

  return `${safePrefix}-${dateKey}-${String(sequence.value).padStart(4, '0')}`;
}
