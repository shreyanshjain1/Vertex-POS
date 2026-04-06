# Cash drawer bridge example

Vertex POS can now try live cash-drawer opening in this order:

1. `window.VertexPOS.openCashDrawer(...)`
2. `window.__VERTEX_POS_BRIDGE__.openCashDrawer(...)`
3. `POST` to `NEXT_PUBLIC_CASH_DRAWER_BRIDGE_URL`
4. fallback browser event: `vertex-pos:cash-drawer-kick`

## Example local helper contract

Listen on a local URL such as `http://127.0.0.1:17481/open-cash-drawer` and accept:

```json
{
  "action": "open-cash-drawer",
  "source": "receipt-print",
  "saleId": "sale_123",
  "receiptNumber": "RCP-0001",
  "triggeredAt": "2026-04-06T11:00:00.000Z"
}
```

Return:

```json
{
  "ok": true,
  "message": "Drawer command sent to printer ESC/POS port."
}
```

## Notes

- Keep the helper local to the register machine.
- Restrict the endpoint to localhost or the branch LAN only.
- If you set `NEXT_PUBLIC_CASH_DRAWER_BRIDGE_TOKEN`, the browser sends it as `Authorization: Bearer <token>`.
- If no bridge is available, Vertex POS still dispatches the browser event for custom listeners.
