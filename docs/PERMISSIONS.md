# Role permissions and verification

Four roles, defined by `UserRole` in `server/prisma/schema.prisma`:

| Role | Code | Seed account |
|---|---|---|
| Main Administrator | `MAIN_ADMIN` | `main.admin@test.local` |
| Office Administrator | `OFFICE_ADMIN` | `office.admin@test.local` |
| IT Administrator | `IT_ADMIN` | `it.admin@test.local` |
| Employee | `EMPLOYEE` | `employee@test.local` |

All seed accounts use the password `Test@1234`.

## The two layers

1. **Server** — `requireRole(...)` in `server/src/routes/*.routes.ts`. This is
   the real boundary. Every mutating endpoint is guarded.
2. **Client** — `client/src/lib/permissions.ts`, a mirror of those guards. The
   client hides what a user cannot do, but it is not a security boundary. A
   request that bypasses the UI is still refused by the server.

The two are duplicated deliberately so the UI can be correct without a round
trip. **If you change a `requireRole` guard, change `permissions.ts` to match,
or the menus will drift from the API.**

## What each role can do

### Main Administrator — full access
Everything. Offices, employee roster, metrics, plans, monthly updates,
performance records, notifications, and scorecards including finalization.

### Office Administrator — runs their office
| Can | Cannot |
|---|---|
| Create/edit/archive plans, attach offices, assign employees | Manage offices |
| Submit and amend monthly updates | Manage the employee roster |
| Start a scorecard and submit results per measure | Manage metric definitions |
| View performance records | Finalize a scorecard (Main Admin signs off) |
| Send notifications | Create a new scorecard period |

### IT Administrator — owns the roster
| Can | Cannot |
|---|---|
| Add, edit, deactivate, reactivate employees | See plans, offices, metrics, reports, or monthly updates |
| Send notifications | — |
| Read the audit log | — |

### Employee — read-only
| Can | Cannot |
|---|---|
| View plans and their own assignments | Create, edit, or archive anything |
| View performance records | Any administrative action |
| See their own notifications | — |

## Verification status

Checked on 2026-09-30 against a live server and client.

### Server enforcement — PASS
188 probes (35 mutating + 12 read endpoints × 4 roles). Mutations were probed
with an empty body so Zod rejects at validation and nothing is written.
**Zero mismatches**: every role was allowed or refused exactly as its
`requireRole` guard specifies.

### UI controls — PASS
Verified by logging in as each role and reading the rendered page.

| Page | Control | Main | Office | IT | Employee |
|---|---|:--:|:--:|:--:|:--:|
| /offices | New Office, Archive | yes | — | — | — |
| /employees | New Employee, Deactivate | yes | — | yes | — |
| /plans | New Plan | yes | yes | — | — |
| /plans/:id | Archive, Unassign, Remove | yes | yes | — | — |
| /performance | New Metric, Archive | yes | — | — | — |
| /performance/records | New Performance Record | yes | — | — | — |
| /monthly-updates | New Monthly Update | yes | yes | — | — |
| /reports | New Period | yes | — | — | — |
| /reports | Start Scorecard | yes | yes | — | — |
| /notifications | Send Notification | yes | yes | yes | — |
| /audit-log | (read-only view) | yes | — | yes | — |

`—` means either the page redirects to /dashboard, or the control is absent
from the page.

Notes on two non-obvious results:
- **Unarchive** is absent on /performance because the only metric is active.
  It is not a permission effect.
- **Start Scorecard** appears only on offices that have no scorecard for the
  selected period (currently NCR South). Offices that already have one show
  "View report" instead.

### Navigation — PASS
| Role | Sections |
|---|---|
| Main Administrator | Dashboard, Plans, My Performance, Monthly Updates, Reports, Performance Metrics, Employees, Offices, Notifications, Audit Log, My Access |
| Office Administrator | Dashboard, Plans, My Performance, Monthly Updates, Reports, Notifications, My Access |
| IT Administrator | Dashboard, Employees, Notifications, Audit Log, My Access |
| Employee | Dashboard, Plans, My Performance, My Access |

### Route guards — PASS
Each role typing a URL it lacks permission for is redirected to /dashboard
rather than shown a page with no working controls. Confirmed for all four.

### Read-only rendering — PASS
On the employee plan detail page there are zero `<select>` and zero `<input>`
elements. Assignment status renders as the text "In Progress" and progress as
"0%". An Office Admin on the same page gets a dropdown and a number field.

## Read scoping — PASS (added after the original audit)

`requireRole` answers "may this role do this action?". It cannot answer "whose
data is this?" — that needs the caller's own office, which is only known at
runtime. `server/src/lib/scope.ts` supplies that half, and every list endpoint
now filters through it.

| Resource | MAIN_ADMIN | OFFICE_ADMIN | IT_ADMIN | EMPLOYEE |
|---|---|---|---|---|
| Plans | all | plans covering their office subtree | none | plans they are assigned to, or covering their office |
| Performance records | all | employees in their office subtree | none | only their own |
| Employees | all active | their office subtree | all active | only themselves |
| Monthly updates | all | their office subtree | 403 | 403 |
| Plan writes | any plan | any plan in their subtree | 403 | 403 |

A caller who reaches for a record outside their scope gets **404, not 403** —
a 403 would confirm the record exists and let them enumerate the database by
id.

`lib/officeTree.ts` resolves "my office plus everything beneath it", so an
Office Admin heading Management Services Division sees FMS, AS, Comptrollership,
Cashiering, Budget, GSU and Motorpool — not just the division node.

### Still unscoped

- **Scorecards** are readable by any role with `scorecards.view`. A finalized
  rating is treated as a published document rather than private data, which is
  defensible but is a decision, not an oversight.
- **Notifications** are already own-only; that was correct from the start.
- **Offices** list and tree are readable by any authenticated user, which the
  org chart implies is fine.

## Re-running these checks

```powershell
powershell -File docs\probe-rbac.ps1          # 188 HTTP probes
cd server; npx tsx prisma\checkReadScoping.ts # read-filtering assertions
```

`probe-rbac.ps1` covers 35 mutating endpoints and 12 read endpoints across all
four roles. Mutations are probed with an empty body so Zod rejects at
validation and nothing is written; reads are checked for the status a role
should get.

`checkReadScoping.ts` covers what the HTTP probe cannot see: whether a 200
response was correctly *filtered*. It resolves each seed account and asserts
what its list queries return — for example that an IT Admin sees the whole
roster but zero plans, and that an Employee's performance records are exactly
the ones that are theirs.

The UI checks were done manually in a browser, because they depend on rendered
output.
