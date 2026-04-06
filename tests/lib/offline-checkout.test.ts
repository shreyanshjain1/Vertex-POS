import {
  buildOfflineCheckoutDraftStorageKey,
  buildOfflineSalesQueueStorageKey,
  createOfflineClientRequestId,
  createOfflineReceiptNumber,
  getStockSnapshotAgeMinutes,
  readLocalStorageValue,
  removeLocalStorageValue,
  writeLocalStorageValue
} from '@/lib/offline-checkout';

describe('offline checkout helpers', () => {
  it('builds stable storage keys per shop and user', () => {
    expect(buildOfflineCheckoutDraftStorageKey('shop-1', 'user-1')).toBe(
      'vertex-pos:checkout-draft:shop-1:user-1'
    );
    expect(buildOfflineSalesQueueStorageKey('shop-1', 'user-1')).toBe(
      'vertex-pos:sales-queue:shop-1:user-1'
    );
  });

  it('creates offline receipt numbers with date stamp and unique suffix', () => {
    const value = new Date('2026-04-06T13:45:20+08:00');
    const receipt = createOfflineReceiptNumber(value);

    expect(receipt).toMatch(/^OFF-20260406-134520-[A-Z0-9]{8}$/);
  });

  it('creates client request ids with sanitized shop and user parts', () => {
    const value = new Date('2026-04-06T13:45:20+08:00');
    const id = createOfflineClientRequestId('shop-001/main', 'cashier#1', value);

    expect(id).toMatch(/^OFFSYNC-SHOP001MAI-CASHIER1-20260406134520-[A-Z0-9]{8}$/);
  });

  it('computes stock snapshot age in minutes and handles invalid values', () => {
    const now = new Date('2026-04-06T14:00:00+08:00').getTime();

    expect(getStockSnapshotAgeMinutes('2026-04-06T13:45:00+08:00', now)).toBe(15);
    expect(getStockSnapshotAgeMinutes('not-a-date', now)).toBe(Number.POSITIVE_INFINITY);
  });

  it('reads, writes, and removes localStorage values in browser-like environments', () => {
    const store = new Map<string, string>();
    const localStorageMock = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      }
    };

    Object.defineProperty(globalThis, 'window', {
      value: { localStorage: localStorageMock },
      configurable: true,
      writable: true
    });

    const key = buildOfflineCheckoutDraftStorageKey('shop-1', 'user-1');

    expect(readLocalStorageValue(key, { ok: false })).toEqual({ ok: false });

    writeLocalStorageValue(key, { ok: true, count: 2 });
    expect(readLocalStorageValue(key, { ok: false })).toEqual({ ok: true, count: 2 });

    removeLocalStorageValue(key);
    expect(readLocalStorageValue(key, { ok: false })).toEqual({ ok: false });

    // @ts-expect-error cleanup for test environment
    delete globalThis.window;
  });
});
