-- Read-only: are people attached to the offices they head?
SELECT
  o.code,
  o.kind,
  count(e.id) AS staff_attached,
  count(h.id) AS heads_of_this_node
FROM offices o
LEFT JOIN employees e ON e."officeId" = o.id
LEFT JOIN employees h ON h."headedOfficeId" = o.id AND h.id <> e.id
WHERE o."archivedAt" IS NULL
GROUP BY o.code, o.kind
ORDER BY o.kind, o.code;