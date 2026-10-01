-- Read-only inspection of accounts and any headship they hold.
SELECT
  u.email,
  u.role,
  u."isActive",
  e."headedOfficeId",
  o.kind AS headed_kind
FROM users u
LEFT JOIN employees e ON e."userId" = u.id
LEFT JOIN offices o ON o.id = e."headedOfficeId"
ORDER BY u.role, u.email;