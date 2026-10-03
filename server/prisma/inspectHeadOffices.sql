-- Read-only: what office is each seeded head actually attached to?
SELECT
  u.email,
  u.role,
  e."officeId" IS NOT NULL AS has_office,
  assigned.code AS office_code,
  assigned.kind AS office_kind,
  headed.code AS headed_code,
  headed.kind AS headed_kind
FROM users u
JOIN employees e ON e."userId" = u.id
LEFT JOIN offices assigned ON assigned.id = e."officeId"
LEFT JOIN offices headed ON headed.id = e."headedOfficeId"
ORDER BY u.email;

-- How many offices does each subtree actually contain?
WITH RECURSIVE subtree AS (
  SELECT id, code FROM offices WHERE code = 'MSD'
  UNION ALL
  SELECT o.id, o.code FROM offices o JOIN subtree s ON o."parentId" = s.id
)
SELECT 'MSD subtree' AS what, count(*)::text AS n FROM subtree;