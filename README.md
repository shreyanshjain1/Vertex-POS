# Vertex-POS

Vertex-POS is a modern point-of-sale and retail operations platform built for real store workflows, not just checkout demos. It combines sales, register operations, inventory control, purchasing, supplier management, customer history, loyalty, receivables, reporting, multi-branch readiness, and audit-aware staff controls in a single full-stack Next.js application.

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=for-the-badge&logo=prisma)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Auth.js](https://img.shields.io/badge/Auth.js-NextAuth-000000?style=for-the-badge)
![Zod](https://img.shields.io/badge/Zod-Validation-3E67B1?style=for-the-badge)

## Project Description

Vertex-POS is a business-ready POS and operations system for retail environments that need more than simple sales entry. The app supports day-to-day store execution across checkout, receipts, register open/close, inventory movements, product and catalog management, purchasing, supplier returns, customer management, loyalty and receivables, reporting, branch transfers, notifications, and staff/security controls.

The codebase is structured as a production-minded full-stack application with server-side authorization, Prisma-backed domain models, role and permission enforcement, operational audit trails, worker-driven notifications, and practical store setup flows.

## Feature Breakdown

### Core POS and Checkout

- Barcode-first checkout with product search by name, SKU, and barcode
- Split payments and sale payment breakdowns
- Parked/held sales with resume and cancel flows
- Offline-ready checkout with local cart draft persistence
- Local pending-sales queue with reconnect sync and idempotent replay through `clientRequestId`
- Unsynced sales status, offline receipt preview/printing, and cashier conflict recovery for queued sales
- Branch stale-stock warning / lock controls for offline selling
- Printable sales receipts and refund/adjustment receipts
- Reprint flow from sales history and sale detail
- Refund, exchange, and void workflows with approval controls
- Tax, discount, and receivable-aware sale processing

### Inventory and Product Management

- Product catalog with categories, active/archive state, and stock levels
- Product variants with variant-level SKU and barcode support
- Product images, barcode preview, and printable barcode labels
- Batch, expiry, FEFO-style inventory support, and batch management
- Units of measure and pack-to-base conversions for purchasing and stock receipt
- Inventory movement history with reason-coded stock corrections
- Stock counts with blind counting, approval, posting, and variance trails
- Inventory export and low-stock monitoring
- Smart reorder suggestions using recent sales velocity, supplier lead-time history, safety stock, and stockout pressure
- Supplier-grouped replenishment queue with one-click draft PO creation from recommendations

### Purchasing and Supplier Operations

- Purchase order creation and lifecycle tracking
- Partial and full receiving with stock updates
- Supplier invoices, supplier payments, and accounts payable visibility
- Supplier directory and supplier-level operational records
- Supplier return workflow with draft, posting, cancellation, and credit memo tracking

### Staff and Access Control

- `ADMIN`, `MANAGER`, and `CASHIER` roles
- Permission matrix for sensitive actions such as reports, product editing, refunds, voids, inventory adjustments, purchase cost visibility, and staff management
- Staff directory, role assignment, shop assignment, and access activation/deactivation
- Forced password reset and cashier PIN support

### Register and Cash Session Operations

- Register open flow with opening float controls
- Register close flow with denomination counting, expected cash, actual cash, and over/short variance tracking
- Payout, cash drop, and petty cash recording tied to the active cash session
- Cash movement timeline showing opening float, cash sales, refunds, non-sale movements, and closing count
- Manager review / approval after closeout and manager-only shift reopen with audit trail notes
- Printable Z-read / end-of-shift summary for closed register sessions
- Register history and cashier shift/session reporting
- Override close flow for higher-authority users

### Reporting and Analytics

- Sales reporting: daily, monthly, hourly, top items, top categories, payment totals
- Inventory reporting: cost valuation, sell valuation, low movement, dead stock, low-stock value at risk
- Profit reporting: revenue, estimated gross profit, margin %, profit by sale, item, category, day, and month
- Cashier reporting: sales count, revenue handled, refund count, void count, average basket size, shift totals
- Advanced owner dashboard analytics: sales heatmap by hour and weekday, sell-through, stock aging, fast/slow movers, margin leakage, shrinkage trend, refund trend, purchase lead-time, and stockout frequency
- Reorder recommendation preview wired into the dashboard and inventory workflow
- Report filtering by date range and operational dimensions where implemented

### Customer and Growth Features

- Customer directory for individual and business customers
- Customer attachment to sales
- Customer purchase history, last purchase date, total spend, and top customers
- Loyalty ledger for points earned and redeemed
- Customer credit sales, due dates, balances, receivable payments, and aging summaries

### Multi-branch / Shop Operations

- Multi-shop membership and active branch switching
- Branch-aware dashboard, checkout, inventory, purchases, and reports
- Stock transfers between branches with draft, in-transit, received, and cancelled states
- Receiving confirmation that prevents double-posting and keeps branch stock accurate

### Security and Auditability

- Auth.js credentials-based authentication
- Email verification and password reset token flows
- Failed login tracking and temporary lockout
- Force-password-reset support for staff accounts
- Session/auth activity visibility
- Operational activity logs and auth audit logs
- Server-side route protection with role and permission guards

### Quality-of-life Features

- Notification center with unread/read state
- Low-stock alerts and daily summary notifications
- Command palette
- Guided first-run and empty-state UX across key modules
- Thermal receipt settings for 58mm / 80mm paper, printer-safe browser output, brand-mark toggle, drawer placeholder trigger, scanner notes, and operational defaults
- Offline stock max-age and strict-lock settings for branches that need tighter offline checkout safeguards

## Screens / Modules

Key app modules currently present in the repository:

- `/dashboard` - branch dashboard, alerts, quick actions, owner analytics, and reorder pressure signals
- `/checkout` - cashier checkout, barcode flow, held sales, offline queue/sync, conflict review, and receipt generation
- `/sales` - sales history, sale detail, refund, void, and reprint flows
- `/returns` - return and adjustment history
- `/products` - products, variants, images, pricing/cost history, and labels
- `/categories` - category management
- `/inventory` - stock corrections, smart reorder suggestions, batches, movement history, and export
- `/stock-counts` - stock count creation, review, approval, and posting
- `/suppliers` - supplier directory, invoices, balances, and supplier returns
- `/purchases` - purchase orders, receiving, supplier invoices, and payments
- `/customers` - customer directory, loyalty, credit balances, and receivable payments
- `/transfers` - branch transfer creation, dispatch, and receiving
- `/reports` - sales, inventory, profit, and cashier reports
- `/register/open`, `/register/close`, `/register/history` - cash drawer/session workflows, reconciliation, review, and reopen controls
- `/print/receipt/test` - thermal printer test page for width checks, printer-safe layout review, barcode output, and drawer placeholder validation
- `/print/register-z-read/[id]` - printable register Z-read / end-of-shift summary
- `/staff` - staff directory, permissions, and security controls
- `/activity` - operational activity and audit visibility
- `/settings` - branch identity, tax, receipt, numbering, payment, and inventory defaults
- `/onboard` - initial business and branch setup

## Tech Stack

- **Frontend:** Next.js App Router, React 19, TypeScript
- **Backend:** Next.js route handlers and server components
- **Database:** PostgreSQL via Prisma ORM
- **Auth:** Auth.js / NextAuth credentials provider with JWT sessions
- **Validation:** Zod
- **Styling:** Tailwind CSS, Framer Motion
- **Background jobs / worker:** custom TypeScript worker for low-stock scans and daily summary jobs

## Data / Domain Highlights

The Prisma schema already models a fairly complete retail operations domain, including:

- shops and shop memberships
- users and role assignments
- shop settings and document sequences
- categories
- products
- product variants
- product images
- product price and cost history
- units of measure and product UOM conversions
- product batches
- customers
- sales
- sale items
- sale payments
- sale adjustments and refund payments
- cash sessions
- cash movements
- parked sales
- inventory movements and inventory reasons
- stock counts
- suppliers
- purchase orders, receipts, invoices, supplier payments, and accounts payable
- supplier returns
- stock transfers
- loyalty ledgers
- customer credit ledgers and receivable payments
- notifications
- activity logs
- auth audit logs
- password reset and email verification tokens
- worker jobs

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy the example file and update values for your local database and auth secret:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

### 3. Generate Prisma client

```bash
npm run prisma:generate
```

### 4. Run database migrations

For local development:

```bash
npm run prisma:migrate
```

For deployed environments:

```bash
npm run prisma:deploy
```

The latest migrations add register reconciliation fields, cash movement tracking, sale replay idempotency, offline checkout stock-safety settings, thermal receipt settings, and smart reorder safety-stock settings.

### 5. Seed sample data (optional, useful for local evaluation)

```bash
npm run seed
```

The seed script creates sample shops, staff accounts, catalog data, customers, purchases, sales, and related operational records for local testing.

### 6. Start the app

```bash
npm run dev
```

### 7. Start the worker

In a second terminal:

```bash
npm run worker
```

Run a single worker cycle if needed:

```bash
npm run worker:once
```

### 8. Optional validation commands

```bash
npm run typecheck
npm run lint
npm run build
```

## Environment Variables

The repository currently includes the following environment variables in [.env.example](./.env.example):

```env
DATABASE_URL=
AUTH_SECRET=
AUTH_TRUST_HOST=
```

What they are used for:

- `DATABASE_URL` - Prisma database connection string
- `AUTH_SECRET` - Auth.js secret used for signing/auth security
- `AUTH_TRUST_HOST` - enables trusted-host behavior for Auth.js in local/deployed environments where needed

## Project Structure

```text
app/          App Router pages, layouts, and API routes
components/   UI, domain, and workflow components
lib/          Business logic, auth, serializers, permissions, and helpers
prisma/       Prisma schema, migrations, and seed script
worker/       Background worker for queued operational jobs
types/        Shared TypeScript type augmentation
auth.ts       Auth.js configuration
proxy.ts      App-level proxy/middleware entry
```

## Role-Based Access Summary

- **Admin**: full system access, staff management, sensitive reports, security controls
- **Manager**: operational management across inventory, purchases, suppliers, settings, transfers, and most day-to-day back-office workflows
- **Cashier**: checkout, sales, register operations, and only the business data needed for front-of-house work

Permissions are also enforced beyond role names for actions such as reports, refunds, voids, product editing, inventory adjustments, purchase-cost visibility, and staff management.

## Receipt and Printing Summary

- Printable sales receipts
- Printable refund/adjustment receipts
- Printable register Z-read closeout summaries
- Offline receipt preview/print support for queued sales before sync completes
- Receipt reprint flow from sales history and sale detail
- Configurable receipt header/footer, 58mm/80mm width settings, and branch brand-mark toggle
- Printer-safe / ESC-POS-friendly browser print mode for thermal layouts
- Receipt barcode based on the current receipt identifier
- Print test page for thermal alignment, barcode validation, and width checks
- Browser-side cash drawer trigger placeholder event for hardware bridge integration
- Barcode label printing for products and variants

## Offline Checkout Notes

- Offline checkout is intentionally scoped to the checkout flow and uses browser `localStorage` for draft carts and the queued-sales replay store.
- No service worker or full PWA install is required for this pass.
- The branch settings screen exposes `offlineStockStrict` and `offlineStockMaxAgeMinutes` so managers can choose whether stale stock blocks offline selling or only warns.
- Queued sales replay through the normal `/api/sales` route with `clientRequestId` idempotency so reconnect sync does not create duplicate sales.
- If queued replay hits insufficient stock, price changes, or archived products, checkout surfaces the queue item for cashier review and can pull it back into live checkout using the current catalog state.

## Reporting Summary

- Sales trends and item/category performance
- Inventory valuation and stock movement insights
- Profit and margin reporting using the best available cost basis in the current architecture
- Cashier performance, refunds, voids, and shift/session totals
- Owner analytics for demand heatmaps, sell-through, stock aging, margin leakage, shrinkage, refunds, lead times, stockouts, and reorder pressure

## Reorder Suggestions Notes

- Smart reorder suggestions are generated from the current inventory position, the last 30 days of completed sales, recent supplier receiving lead times, and the branch safety stock setting.
- The inventory screen groups recommendations by supplier and can create draft purchase orders directly through the existing purchase-order API flow.
- Products without supplier receiving history remain visible in the recommendation queue but are not draftable until supplier history exists.

## Current Status

Vertex-POS already demonstrates a broad retail operations surface area:

- full-stack Next.js architecture with Prisma-backed domain modeling
- operational workflows beyond checkout, including purchasing, stock counts, receivables, and branch transfers
- role and permission enforcement with audit-aware business actions
- business-oriented reporting and notification flows
- production-minded setup, settings, and security controls

In portfolio terms, this project shows the ability to design and ship a serious business application with real workflow depth, not just a CRUD storefront or a simple cash register UI.


## Product image uploads

- Product images can be uploaded through `/api/uploads/products`.
- Local uploads are stored in `public/uploads/products/`.
- Removed or replaced local product images are cleaned up automatically when a product is updated.
- Control the upload size with `MAX_PRODUCT_IMAGE_UPLOAD_MB`.


## Quality checks

Run the main quality checks locally before pushing:

```bash
npm run lint
npm run typecheck
npm test
```

Optional test commands:

```bash
npm run test:watch
npm run test:coverage
```

GitHub Actions runs the same install, Prisma client generation, lint, typecheck, and test steps on pushes and pull requests.
