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

| Variable | Purpose | Default |
|---|---|---|
| `NODE_ENV` | environment name | `development` |
| `PORT` | API port | `4000` |
| `DATABASE_URL` | Postgres connection string | see `.env.example` |
| `JWT_SECRET` | JWT signing secret — **change this** | dev placeholder |
| `JWT_EXPIRES_IN` | token lifetime | `8h` |
| `CORS_ORIGIN` | allowed frontend origin | `http://localhost:5173` |

## Status

- [x] Root project structure
- [x] Frontend: Vite + React + TS + Tailwind + shadcn/ui — builds and runs
- [x] Backend: Express + TS, layered structure, health check route — builds and runs
- [x] PostgreSQL + Prisma schema (v7, driver-adapter based via `@prisma/adapter-pg`) — migrated
- [x] Authentication + RBAC — JWT in httpOnly cookie, `authenticate` + `requireRole` applied consistently across all mutating routes
- [x] Core CRUD modules: offices, employees, plans (+ plan-office links, plan assignments), metrics, performance records
- [x] Monthly updates (office/plan progress submissions)
- [ ] Notifications (DB table + model exist, no API yet)
- [ ] Reports (DB table + model exist, no API yet — natural next step once the above have real data)
- [ ] Audit log writes (table exists, not yet wired into mutating actions)
- [ ] Frontend integration (auth screens + API calls — still just the initial scaffold)

## Next step

Build the `Notification` module (list own notifications, mark read, admin-create) following the same schema → service → controller → route pattern as `monthlyUpdate`. Then `Reports`, then an audit-logging pass across existing mutations, then start wiring the frontend.
