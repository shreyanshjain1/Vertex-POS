export type CashDrawerKickPayload = {
  source: 'receipt-print' | 'print-test';
  saleId: string;
  receiptNumber: string;
  triggeredAt: string;
  printerName?: string | null;
};

export type CashDrawerKickResult =
  | { ok: true; mode: 'window-bridge' | 'http-bridge' | 'browser-event'; message: string }
  | { ok: false; mode: 'http-bridge' | 'browser-event'; message: string };

declare global {
  interface Window {
    VertexPOS?: {
      openCashDrawer?: (payload: CashDrawerKickPayload) => Promise<unknown> | unknown;
    };
    __VERTEX_POS_BRIDGE__?: {
      openCashDrawer?: (payload: CashDrawerKickPayload) => Promise<unknown> | unknown;
    };
  }
}

function dispatchFallbackEvent(payload: CashDrawerKickPayload) {
  window.dispatchEvent(
    new CustomEvent('vertex-pos:cash-drawer-kick', {
      detail: {
        mode: 'browser-event',
        ...payload
      }
    })
  );
}

function getHttpBridgeConfig() {
  const bridgeUrl = process.env.NEXT_PUBLIC_CASH_DRAWER_BRIDGE_URL?.trim();
  const bridgeToken = process.env.NEXT_PUBLIC_CASH_DRAWER_BRIDGE_TOKEN?.trim();

  if (!bridgeUrl) {
    return null;
  }

  return { bridgeUrl, bridgeToken };
}

export async function openCashDrawer(payload: CashDrawerKickPayload): Promise<CashDrawerKickResult> {
  if (typeof window === 'undefined') {
    return {
      ok: false,
      mode: 'browser-event',
      message: 'Cash drawer can only be triggered from a browser register session.'
    };
  }

  const browserBridge = window.VertexPOS?.openCashDrawer ?? window.__VERTEX_POS_BRIDGE__?.openCashDrawer;

  if (browserBridge) {
    await browserBridge(payload);
    return {
      ok: true,
      mode: 'window-bridge',
      message: 'Cash drawer command sent through the local register bridge.'
    };
  }

  const httpBridge = getHttpBridgeConfig();

  if (httpBridge) {
    try {
      const response = await fetch(httpBridge.bridgeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(httpBridge.bridgeToken
            ? { Authorization: `Bearer ${httpBridge.bridgeToken}` }
            : {})
        },
        body: JSON.stringify({
          action: 'open-cash-drawer',
          ...payload
        }),
        cache: 'no-store'
      });

      const data = await response
        .json()
        .catch(() => ({ ok: response.ok, message: response.ok ? null : 'Bridge returned an unreadable response.' }));

      if (!response.ok || data?.ok === false) {
        return {
          ok: false,
          mode: 'http-bridge',
          message: data?.message || 'Cash drawer bridge rejected the request.'
        };
      }

      return {
        ok: true,
        mode: 'http-bridge',
        message: data?.message || 'Cash drawer command sent to the local hardware bridge.'
      };
    } catch (error) {
      return {
        ok: false,
        mode: 'http-bridge',
        message:
          error instanceof Error
            ? `Cash drawer bridge is unreachable: ${error.message}`
            : 'Cash drawer bridge is unreachable.'
      };
    }
  }

  dispatchFallbackEvent(payload);
  return {
    ok: true,
    mode: 'browser-event',
    message:
      'Fallback browser event dispatched. Add a local bridge or set NEXT_PUBLIC_CASH_DRAWER_BRIDGE_URL for live hardware.'
  };
}
