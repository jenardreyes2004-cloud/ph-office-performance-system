# Office Performance Monitoring and Planning System

Office performance monitoring and planning: React/Vite/TS frontend + Express/TS
backend on Prisma/PostgreSQL. Built incrementally; see chat history for the full
architecture proposal, ERD, and phase plan.

## Project structure

```
office-performance-system/
├── client/   React + Vite + TypeScript + Tailwind CSS v4 + shadcn/ui
├── server/   Node + Express + TypeScript + Prisma (PostgreSQL)
└── docs/     Original requirements document (.docx)
```

## Prerequisites (on your machine)

- Node.js 18+ (this was built/tested with Node 22)
- PostgreSQL 14+ (required — the API connects via `DATABASE_URL` in `server/.env`)

Apply migrations and seed data after the first `npm install`:

```bash
cd server
npx prisma migrate deploy   # or: npm run prisma:migrate
npx prisma db seed
```

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

Backend and client both typecheck and build clean, and the API answers on
`http://localhost:4000` against a live Postgres.

- [x] Root project structure
- [x] Frontend: Vite + React + TS + Tailwind + shadcn/ui — builds and runs
- [x] Backend: Express + TS, layered structure, health check route — builds and runs
- [x] PostgreSQL + Prisma schema (v7, driver-adapter based via `@prisma/adapter-pg`) — migrated
- [x] Authentication + RBAC — JWT in httpOnly cookie, `authenticate` + `requireRole` applied consistently across all mutating routes, and `lib/scope.ts` filtering every list endpoint to the caller's own office (see `docs/PERMISSIONS.md`)
- [x] Audit log — every successful mutation recorded with actor, action, entity and touched fields; readable by MAIN_ADMIN and IT_ADMIN
- [x] System log — operational view for the IT admin: auth events, 4xx/5xx, slow requests, unmatched routes, unhandled errors with stack traces
- [x] **Six-level access hierarchy** — access derived from position in the org tree rather than a role label: `Employee.headedOfficeId` + `Office.kind` (DEPARTMENT / OFFICE / SUB_UNIT) resolve the caller's level in `lib/access.ts`. Team lead is a per-project relation, not a level. See `docs/ACCESS_HIERARCHY.md`
- [x] Dashboard stats — `GET /api/dashboard/stats`, scoped per role and office
- [x] Monthly updates UI, notifications UI (with send + mark read), audit log viewer
- [x] Schema in place for tagging, transfers, teams/leads and quotas (services and UI still to build)
- [x] Core CRUD modules: offices, employees, plans (+ plan-office links, plan assignments), metrics, performance records
- [x] Office hierarchy — self-relation (`parentId`), the full PhilHealth structure as 29 offices across 3 levels, `isHeadOffice` flag marking the 4 that run scorecards, collapsible tree view, cycle-safe re-parenting, and a guard against archiving a parent with active sub-units
- [x] Monthly updates (office/plan progress submissions)
- [x] Notifications — own-list, mark read, mark all read, admin-create
- [x] Office Balanced Scorecards (PhilHealth SPMS format): periods, per-office scorecards, entries, grading bands, results, finalize rollup, print view
- [x] Frontend wired for auth, offices, employees, plans, metrics, performance records, and scorecard reports

Still open:

- [ ] `JWT_SECRET` and the database password are in public git history — rotate both
- [ ] `Report` model has no API (the scorecard report view covers the reporting need for now)
- [ ] Scorecard template gaps: weights total 92.5% not 100%, and one measure's bands were cut off in the source photo
- [ ] No automated test suite — verification is currently two scripts (`docs/probe-rbac.ps1`, `server/prisma/checkReadScoping.ts`)
- [ ] No pagination on any list endpoint
- [ ] No error boundary or loading skeleton in the client

## Verification

```powershell
powershell -File docs\probe-rbac.ps1            # 188 HTTP probes across 4 roles
cd server
npm run check:access        # each account resolves to its intended hierarchy level
npm run check:scoping       # read-filtering assertions
npm run check:hierarchy     # no cycles in the office tree
```

`docs/PERMISSIONS.md` records what each role can do, how it was verified, and
what is deliberately still unscoped.

## Seed accounts

`npx prisma db seed` creates four accounts, all with password `Test@1234`:
`main.admin@test.local`, `office.admin@test.local`, `it.admin@test.local`,
`employee@test.local`.

## Organizational structure

`npm run db:seed:org` (in `server/`) seeds the PhilHealth org chart as 29
offices across three levels, transcribed in
`prisma/seedOrganizationStructure.ts`. It upserts by code, so it is safe to
re-run — useful after changing the hierarchy by hand in the UI.

- **Office of the Vice President** is the only root; the three NCR regional
  offices (North, Central, South) hang directly off it.
- Sub-divisions, sections, and units (Comptrollership Unit, Motorpool, Records
  Library, etc.) are first-class offices, so employees and plans can be
  assigned to a specific unit.
- `isHeadOffice = true` marks the OVP and the three NCRs. These are the only
  offices that get a Balanced Scorecard — the SPMS form is filled out at the
  head-office level, not per sub-unit.

`npx tsx prisma/checkOfficeHierarchy.ts` walks every office's parent chain and
reports any cycle. The API rejects re-parenting that would create one, but
this is the check to run if you ever edit parent links by hand in the database.
