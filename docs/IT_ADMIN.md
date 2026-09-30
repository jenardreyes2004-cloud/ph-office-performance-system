# IT Administrator

A **systems function, not a rung on the hierarchy.** The IT admin sits outside
the organizational tree entirely and is carried by `isItAdmin` rather than a
headship. It is deliberately separate from the IT Management Section in the org
chart: heading that office would make you an *office head*, which is a
different thing with a different scope.

Account type: `IT_ADMIN`. Hierarchy level: `EMPLOYEE` — and that is honest,
not a demotion. It holds no authority over projects, people in the org sense,
or reporting.

## What it can do today

| Capability | Endpoint / screen |
|---|---|
| Read the whole employee roster | `GET /employees` |
| Add, edit, deactivate, reactivate employees | `POST/PATCH /employees`, `/deactivate`, `/reactivate` |
| Read the **system log** | `/system-log` + the System Log screen |
| Read the **audit log** | `/audit-log` + the Audit Log screen |
| Send notifications | `POST /notifications` |
| See its own permissions | `/access` |

## What it explicitly cannot do

- **No plan or project authority.** `planWhere()` returns "matches nothing" for
  it. A project is a management artefact, not an infrastructure one.
- **No reporting authority.** No performance records, no scorecards, no
  monthly updates.
- **No org restructuring.** Only the super admin creates or moves departments,
  offices and sub-units.
- **No tagging.** Super admin only.

The whole roster is visible to it, which is the one deliberate exception: an
account administrator must be able to see every account to manage it.

## The two logs

These are separate models with separate authors, and the split is the point.

| | Audit log | System log |
|---|---|---|
| Question | Who changed what? | Is it healthy, and who is hitting it? |
| Written by | A user's action | The server |
| Contains | Actor, action, entity, field names touched | Level, category, message, method, path, status, duration, IP |
| Does **not** contain | Request *values* — scores and plan text would become a second unprotected store | Routine successful reads, in production |

Neither stores request values. Passwords are redacted before they reach either
table.

Categories actually written: `auth`, `http`, `routing`, `unhandled`.
`requestLogger` records 4xx/5xx and anything slower than 2s; `logAuthEvent`
records login success, login failure *with the reason* (which the login
response deliberately hides from the caller), logout, and invalidated sessions.

### Severity classification

| Level | Meaning |
|---|---|
| `DEBUG` | Successful routine request (development only) |
| `INFO` | Login success, logout, ordinary activity |
| `WARN` | 4xx, slow request, unmatched route, failed login |
| `ERROR` | 5xx |
| `CRITICAL` | An exception that was **not** an `AppError` or a `ZodError` — i.e. a genuine server fault. Stack trace attached. |

That last distinction matters, and it was wrong at first. The classification
initially treated only `AppError` as handled, so every schema-validation
rejection logged as CRITICAL — 54 of them in one afternoon, all of them ordinary
client mistakes, which buried the signal. `ZodError` is now recognised as
handled and a 422 logs as WARN.
