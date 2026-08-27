# Office Performance Monitoring and Planning System

Prototype scaffold — React/Vite/TS frontend + Express/TS backend. Built incrementally; see chat history for the full architecture proposal, ERD, and phase plan.

## Project structure

```
office-performance-system/
├── client/   React + Vite + TypeScript + Tailwind CSS v4 + shadcn/ui
└── server/   Node + Express + TypeScript (Prisma + PostgreSQL coming next)
```

## Prerequisites (on your machine)

- Node.js 18+ (this was built/tested with Node 22)
- PostgreSQL 14+ (not yet wired up — coming in the next step)

## Setup

### 1. Frontend

```bash
cd client
npm install
npm run dev
```

Runs at `http://localhost:5173` (bound to `0.0.0.0`, so also reachable from other LAN devices at your machine's IP).

**Note on shadcn/ui:** `components.json` is already configured. This scaffold was built in a sandboxed environment without access to `ui.shadcn.com`, so only `Button` and `Card` were added by hand. On your machine, the CLI will work normally — add more components with:

```bash
npx shadcn@latest add <component-name>
```

### 2. Backend

```bash
cd server
npm install
cp .env.example .env   # already done in this package, but re-check values
npm run dev
```

Runs at `http://localhost:4000` (also bound to `0.0.0.0`). Verify it's alive:

```bash
curl http://localhost:4000/api/health
```

Other scripts:

- `npm run build` — compiles TypeScript to `dist/` (also rewrites `@/` path aliases via `tsc-alias`)
- `npm start` — runs the compiled build
- `npm run typecheck` — type-checks without emitting

### Environment variables (`server/.env`)

| Variable         | Purpose                              | Default                 |
| ---------------- | ------------------------------------ | ----------------------- |
| `NODE_ENV`       | environment name                     | `development`           |
| `PORT`           | API port                             | `4000`                  |
| `DATABASE_URL`   | Postgres connection string           | see `.env.example`      |
| `JWT_SECRET`     | JWT signing secret — **change this** | dev placeholder         |
| `JWT_EXPIRES_IN` | token lifetime                       | `8h`                    |
| `CORS_ORIGIN`    | allowed frontend origin              | `http://localhost:5173` |

## Status

- [x] Root project structure
- [x] Frontend: Vite + React + TS + Tailwind + shadcn/ui — builds and runs
- [x] Backend: Express + TS, layered structure, health check route — builds and runs
- [ ] PostgreSQL + Prisma schema (next step)
- [ ] Authentication + RBAC
- [ ] Core CRUD modules (offices, employees, plans, metrics, assignments)
- [ ] Dashboards & reports

## Next step

Set up PostgreSQL locally, then we'll add the Prisma schema (users, offices, employees, plans, plan_offices, plan_assignments, performance_metrics, performance_records, reports, audit_logs) and verify the DB connection.
