# Access hierarchy

The system uses a **hierarchy of access levels** rather than a flat set of
roles. A person's authority comes from *where they sit in the organizational
tree*, not from a role label attached to their account.

## The six levels

| Level | Who | Sees | Can change |
|---|---|---|---|
| 1 `HIERARCHY_HEAD` | Super admin | Everything | Everything, plus org structure and tags |
| 2 `DEPARTMENT_HEAD` | Department head | Their department subtree | Assign projects within it, form teams, appoint leads, set quotas, grade |
| 3 `OFFICE_HEAD` | Office head | Their office subtree | Same as above, narrower |
| 4 `SUB_UNIT_HEAD` | Sub-unit head | Their sub-unit subtree | Same as above, narrower |
| 5 `TEAM_LEAD` | Team lead | The project their team is on | Update team progress, grade their team, set team quotas |
| 6 `EMPLOYEE` | Employee | Own assignments and own quotas | Submit own progress and quota attainment |

Levels 3 and 4 carry identical capabilities and differ only in scope, exactly as
specified.

## The two ideas that carry the model

**1. Level is derived from headship, not assigned.**
`Employee.headedOfficeId` points at the node a person is responsible for; that
node's `kind` decides their level. Restructuring the org therefore changes what
people can do without anyone editing a role field. `Employee.accessLevel` is
denormalised for querying only — `resolveAccess()` recomputes it from the tree.

**2. Team lead is not a level.**
A lead holds that position *for one project only*. The same person can lead a
team on one plan and be an ordinary contributor on another, so it is a
relation — `ProjectTeam.leadEmployeeId`, mirrored into `ProjectTeamLead` for
history — not a value in the access enum. Level 5 is therefore evaluated per
project, via `leadsTeam()` / `ledPlanIds()`.

## The tree

```
OVP                                   HIERARCHY_HEAD
├── DEPARTMENTS
│   ├── MSD                           DEPARTMENT_HEAD
│   │   ├── ASS                       OFFICE_HEAD
│   │   │   └── GSU                   SUB_UNIT_HEAD
│   │   └── FMS
│   ├── HCDMD
│   └── SBAC
└── Offices under no department
    ├── LEGAL  (team leads assigned per project)
    ├── PAU
    ├── PMMO
    └── NCR-N / NCR-C / NCR-S
```

NCR North, Central and South are retained from the original org chart and sit
under no department. They are the offices that carry Balanced Scorecards.

`Office.kind` is `DEPARTMENT | OFFICE | SUB_UNIT`. It replaced the earlier
`isHeadOffice` boolean, which could not say "this is a department". Offices are
the scored units; departments and sub-units are not scored on their own.

## IT admin is not a level

The IT admin holds a **systems function** — accounts, database, system
configuration — and is carried by `isItAdmin`, outside the tree entirely. It is
a peer of the hierarchy, never a rung on it, and is deliberately separate from
the IT Management Section in the org chart: heading that office would make you
an office head, which is a different thing entirely.

The IT admin has no plan or reporting authority. It does hold the roster
system-wide and both logs.

## The two logs

| | Audit log | System log |
|---|---|---|
| Question | "Who changed what?" | "Is the system healthy, and who is hitting it?" |
| Written by | A user's action | The server |
| Contains | Actor, action, entity, field names touched | Level, category, message, method, path, status, duration, IP |
| Read by | Super admin, IT admin | Super admin, IT admin |
| Excludes | Request *values* — scores and plan text are the sensitive payload, and copying them would make this a second unprotected store | Successful routine reads, in production |

Request bodies are deliberately not stored in either. The audit log records
which fields a request touched and nothing more; passwords are redacted before
they reach the table.

The system log records `auth` (login success and failure, session invalidation),
`http` (4xx/5xx and any request slower than 2s), `routing` (unmatched routes)
and `unhandled` (anything that reaches the error handler that was not a
deliberate `AppError`, with a stack trace).

## Verifying

```powershell
cd server
npm run check:access    # each account resolves to its intended level
npm run check:scoping   # read filtering still holds
```

`check:access` asserts more than the level: that a department head's scope
*contains* their sub-unit head's scope, that the IT admin sees zero plans and
the whole active roster, and that no level sees more than it should.

## Not yet built

The schema and access resolver are in place and tested. The following still
need their service, route and UI layers:

- **Tagging** — `Tag` / `OfficeTag` exist; only a super admin may apply one
  (`canTagOrgNodes`).
- **Transfers** — `TransferRequest` exists with the `PENDING → APPROVED →
  CPS_VERIFIED → COMPLETED` flow. Only a super admin approves, and `COMPLETED`
  is unreachable without a recorded CPS verification, so the in-person
  paperwork is structurally required.
- **Teams and leads** — `ProjectTeam` / `TeamMember` exist; `canFormTeam` is
  true for levels 1 to 4.
- **Quotas** — `Quota` exists with `targetValue` and `actualValue` as separate
  columns precisely so the API can return the target to an employee and never
  the actual. That split is the whole point and must be enforced in the
  service, not the UI.
