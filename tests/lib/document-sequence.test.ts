import { DocumentSequenceType } from '@prisma/client';
import { getNextDocumentNumber } from '../../lib/document-sequence';

describe('lib/document-sequence', () => {
  it('builds a padded document number using a sanitized prefix', async () => {
    const tx = {
      documentSequence: {
        upsert: vi.fn().mockResolvedValue({ value: 7 })
      }
    } as any;

    const result = await getNextDocumentNumber(tx, {
      shopId: 'shop_123',
      type: DocumentSequenceType.SALE,
      prefix: ' sale / branch #1 '
    });

    expect(tx.documentSequence.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          shopId_type_dateKey: expect.objectContaining({
            shopId: 'shop_123',
            type: DocumentSequenceType.SALE,
            dateKey: expect.stringMatching(/^\d{8}$/)
          })
        }
      })
    );
    expect(result).toMatch(/^SALEBRANCH-\d{8}-0007$/);
  });

  it('falls back to the type prefix when the provided prefix becomes empty', async () => {
    const tx = {
      documentSequence: {
        upsert: vi.fn().mockResolvedValue({ value: 1 })
      }
    } as any;

    const result = await getNextDocumentNumber(tx, {
      shopId: 'shop_456',
      type: DocumentSequenceType.RETURN,
      prefix: '!!!'
    });

    expect(result).toMatch(/^RET-\d{8}-0001$/);
  });
});
