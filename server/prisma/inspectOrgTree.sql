-- Read-only: the org tree as the migration actually left it, with kinds.
SELECT
  o.code,
  o.name,
  o.kind,
  p.code AS parent_code,
  o."archivedAt"
FROM offices o
LEFT JOIN offices p ON p.id = o."parentId"
ORDER BY
  CASE WHEN p.id IS NULL THEN 0 ELSE 1 END,
  p.code NULLS FIRST,
  o.code;