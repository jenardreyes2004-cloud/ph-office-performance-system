-- Lists every login account with the hierarchy level it resolves to.
-- Read-only; nothing is modified.
SELECT
  u.email,
  u.role,
  u."isActive" AS active,
  COALESCE(e."accessLevel"::text, '-') AS level,
  COALESCE(o.code, '-') AS office
FROM users u
LEFT JOIN employees e ON e."userId" = u.id
LEFT JOIN offices  o ON o.id = e."officeId"
ORDER BY
  CASE u.role
    WHEN 'MAIN_ADMIN' THEN 1
    WHEN 'OFFICE_ADMIN' THEN 2
    WHEN 'IT_ADMIN' THEN 3
    ELSE 4
  END,
  u.email;
