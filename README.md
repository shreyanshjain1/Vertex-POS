# Vertex POS 2.0

Vertex POS 2.0 is a production-minded point-of-sale, inventory, procurement, and reporting system built with Next.js, TypeScript, Prisma, PostgreSQL, Auth.js, Zod, and Tailwind CSS.

## What is included

- shop onboarding with business details, tax, currency, starter categories, suppliers, and products
- cashier checkout with oversell protection, tax and discount summary, and printable receipts
- product, category, supplier, purchase, and inventory management with audit logging
- stock counts, refunds/returns, and manager-approved operational adjustments
- inventory reason codes, batch / expiry tracking, and FEFO-style visibility
- units of measure and pack-size support for buying larger packs and stocking smaller base units
- dashboard cards for sales, low stock, pending purchases, and recent stock movements
- activity log page for sales, stock adjustments, purchases, settings, and worker jobs
- inventory CSV export
- worker jobs for low-stock scans and daily summaries
- role-aware navigation for `ADMIN`, `MANAGER`, and `CASHIER`
- quick action launcher with `Ctrl+K`

## Local setup

1. Copy `.env.example` to `.env`
2. Start PostgreSQL
3. Install dependencies and run the database setup:

```bash
npm install
npx prisma generate
npx prisma migrate dev --name uom_pack_sizes
npm run seed
```

4. Start the app:

```bash
npm run dev
```

5. Start the worker in a second terminal:

```bash
npm run worker
```

## Demo accounts

- owner@vertexpos.local / password123
- manager@vertexpos.local / password123
- cashier@vertexpos.local / password123

## Core routes

- `/dashboard`
- `/checkout`
- `/sales`
- `/products`
- `/categories`
- `/inventory`
- `/suppliers`
- `/purchases`
- `/reports`
- `/activity`
- `/settings`

## Units of measure and pack sizes

Vertex POS can now keep a product in a base selling unit while receiving purchases in larger units.

Examples:

- buy `1 box` and convert it into `12 pieces`
- buy `1 carton` and convert it into `288 pieces`
- keep checkout on the base unit while purchases and stock receiving use pack units

How it works:

- each product has a base unit, usually `piece`
- products can define pack conversions such as `box`, `carton`, or `pack`
- purchase lines store the selected unit and conversion snapshot
- received stock is converted into the base stock quantity automatically
- inventory and product screens show the conversion summary so stock math stays traceable

Database additions:

- `UnitOfMeasure`
- `ProductUomConversion`

Setup notes:

- run the latest Prisma migration before using purchase UOMs
- existing products are backfilled to the default `piece` base unit during migration
- existing purchase items are backfilled with `piece` unit snapshots so draft/received history remains valid

## Useful commands

```bash
npm run typecheck
npm run lint
npm run build
npm run worker:once
```

## Environment variables

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/vertex_pos?schema=public"
AUTH_SECRET="vertex-pos-local-dev-secret-very-long-and-stable-123456789"
AUTH_TRUST_HOST="true"
```
