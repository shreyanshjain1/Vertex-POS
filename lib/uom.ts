import { prisma } from '@/lib/prisma';

export const DEFAULT_UNITS_OF_MEASURE = [
  { code: 'PIECE', name: 'Piece', isBase: true },
  { code: 'BOX', name: 'Box', isBase: false },
  { code: 'CARTON', name: 'Carton', isBase: false },
  { code: 'PACK', name: 'Pack', isBase: false }
] as const;

export function normalizeUomCode(value: string) {
  return value.trim().toUpperCase();
}

export async function ensureUnitsOfMeasure(shopId: string) {
  await prisma.$transaction(
    DEFAULT_UNITS_OF_MEASURE.map((unit) =>
      prisma.unitOfMeasure.upsert({
        where: {
          shopId_code: {
            shopId,
            code: unit.code
          }
        },
        update: {
          name: unit.name,
          isBase: unit.isBase,
          isActive: true
        },
        create: {
          shopId,
          code: unit.code,
          name: unit.name,
          isBase: unit.isBase,
          isActive: true
        }
      })
    )
  );

  return prisma.unitOfMeasure.findMany({
    where: {
      shopId,
      isActive: true
    },
    orderBy: [{ isBase: 'desc' }, { name: 'asc' }]
  });
}

export function summarizeConversions(
  conversions: Array<{ unitName: string; ratioToBase: number }>,
  baseUnitName: string | null | undefined
) {
  if (!conversions.length || !baseUnitName) {
    return 'No pack conversions';
  }

  return conversions
    .map((conversion) => `1 ${conversion.unitName.toLowerCase()} = ${conversion.ratioToBase} ${baseUnitName.toLowerCase()}${conversion.ratioToBase === 1 ? '' : 's'}`)
    .join(' • ');
}
