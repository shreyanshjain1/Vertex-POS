# Vertex POS 2.0

Vertex POS 2.0 is a production-minded point-of-sale, inventory, procurement, and shop management system rebuilt from the uploaded project into a more realistic operational product.

## Audit summary of the uploaded project

The uploaded project already had a useful base, but it still had several serious gaps for real-world use:

- shop-scoped pages were querying Prisma before an active shop was guaranteed
- onboarding stopped too early and did not configure enough business-critical data
- category management was incomplete and unsafe for real product catalogs
- product management lacked robust duplicate protection and archive behavior
- checkout was visually present but operationally shallow in several flows
- receipt flow and sale detail experience were incomplete
- inventory movement logic existed but was not surfaced as a proper operational page
- purchases and supplier handling were present but still lightweight for real store workflows
- reports were underpowered and did not reflect owner-level operational insight
- role behavior was not consistently enforced across routes and app pages
- settings were too basic for a real shop opening flow
- several pages had brittle null-shop assumptions and incomplete serialization

## What this rebuilt version includes

### Shop onboarding
- account registration
- shop creation
- business type selection
- shop profile fields
- tax and currency setup
- receipt header and footer setup
- low-stock threshold setup
- starter categories
- starter suppliers
- starter products with opening stock

### Operations
- dashboard with KPIs
- low-stock watch
- recent sales
- product CRUD with archive behavior
- category CRUD with safe delete rules
- inventory adjustment and stock movement history
- supplier CRUD
- purchase entry with draft or received flow
- checkout cart with oversell prevention
- sale creation with receipt and sale numbers
- sales history and sale detail / receipt view
- reports page with top sellers, low-stock products, and revenue summaries
- settings page for shop profile and operational defaults
- worker for low-stock scans and daily summaries

### Roles
- ADMIN
- MANAGER
- CASHIER

## Stack
- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Auth.js
- Prisma ORM
- PostgreSQL
- Zod
- bcryptjs

## Main routes

### Public
- `/`
- `/login`
- `/signup`
- `/onboard`

### Protected app
- `/dashboard`
- `/checkout`
- `/sales`
- `/sales/[id]`
- `/products`
- `/categories`
- `/inventory`
- `/suppliers`
- `/purchases`
- `/reports`
- `/settings`

## Environment variables

Create `.env` from `.env.example`.

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/vertex_pos?schema=public"
AUTH_SECRET="vertex-pos-local-dev-secret-very-long-and-stable-123456789"
AUTH_TRUST_HOST="true"
```

## Local setup

```bash
npm install
npx prisma generate
npx prisma migrate dev --name init_vertex_pos_2
npm run seed
npm run dev
```

Worker in another terminal:

```bash
npm run worker
```

## Docker PostgreSQL quick start

```bash
docker run --name vertex-pos-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=vertex_pos -p 5432:5432 -d postgres:16
```

## Seeded demo accounts

- owner@vertexpos.local / password123
- manager@vertexpos.local / password123
- cashier@vertexpos.local / password123

## Real-life user flow

1. A user signs up.
2. The user completes the onboarding wizard.
3. The system creates the shop, settings, starter categories, starter suppliers, and starter products.
4. The owner or manager refines categories and products.
5. The manager records incoming stock through purchases or manual adjustments.
6. The cashier opens checkout and processes a sale.
7. Stock is deducted automatically.
8. A sale record and receipt record are generated.
9. The sale appears in history.
10. Dashboard and reports update.
11. Low-stock products can be reviewed from dashboard, inventory, and reports.
12. Activity logs and worker notifications help the owner audit what happened.

## Final project structure

```text
app/
  (auth)/
  (app)/
  api/
components/
  categories/
  checkout/
  dashboard/
  inventory/
  layout/
  products/
  purchases/
  sales/
  settings/
  suppliers/
  ui/
lib/
  auth/
prisma/
worker/
auth.ts
proxy.ts
```

## Attribution

Original inspiration:
- Raymart-Leyson / pos-system

This release is an independently rebuilt and upgraded version based on the uploaded project, with substantial architecture, UX, flow, and business logic improvements.
