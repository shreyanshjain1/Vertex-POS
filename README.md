# Vertex POS 2.0

Vertex POS 2.0 is a production-minded point-of-sale, inventory, procurement, and reporting system built with Next.js, TypeScript, Prisma, PostgreSQL, Auth.js, Zod, and Tailwind CSS.

## What is included

- shop onboarding with business details, tax, currency, starter categories, suppliers, and products
- cashier checkout with oversell protection, tax and discount summary, and printable receipts
- product, category, supplier, purchase, and inventory management with audit logging
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
npx prisma migrate dev --name hardening_ops
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
