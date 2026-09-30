-- Archives the throwaway offices created during manual UI testing, so the
-- Organization page shows only the real PhilHealth structure.
--
-- They are archived rather than deleted: the employees and plan links created
-- against them still reference those rows, and archiving keeps that history
-- intact while removing them from the tree.

UPDATE offices
SET "archivedAt" = NOW()
WHERE code IN ('pmmo', '123', '1234', 'TEST-OFC')
  AND "archivedAt" IS NULL;

-- Report what moved.
SELECT o.code, o.name, o.kind, o."archivedAt" IS NOT NULL AS archived,
       (SELECT count(*) FROM employees e WHERE e."officeId" = o.id) AS staff,
       (SELECT count(*) FROM plan_offices po WHERE po."officeId" = o.id) AS plan_links
FROM offices o
WHERE o.code IN ('pmmo', '123', '1234', 'TEST-OFC')
ORDER BY o.code;
