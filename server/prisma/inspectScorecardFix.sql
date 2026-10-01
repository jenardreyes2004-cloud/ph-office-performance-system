-- Read-only: the corrected entries, scoped to the offices the template seeds.
SELECT
  o.code,
  o.kind,
  o."archivedAt" IS NOT NULL AS archived,
  e.perspective,
  e.measure,
  e."weightPct",
  count(b.id) AS band_count
FROM scorecard_entries e
JOIN office_scorecards sc ON sc.id = e."officeScorecardId"
JOIN offices o ON o.id = sc."officeId"
LEFT JOIN scorecard_bands b ON b."entryId" = e.id
WHERE e.measure = 'Member Awareness Rating'
   OR e.measure = 'Total Amount of Premium Collection (Direct Contributors)'
GROUP BY 1, 2, 3, 4, 5, 6
ORDER BY o.kind, o.code;

SELECT
  b.grade,
  b."minPct",
  b."maxPct",
  b."rawLabel"
FROM scorecard_entries e
JOIN scorecard_bands b ON b."entryId" = e.id
JOIN office_scorecards sc ON sc.id = e."officeScorecardId"
JOIN offices o ON o.id = sc."officeId"
WHERE e.measure = 'Member Awareness Rating'
  AND o.code = 'NCR-C'
ORDER BY b."minPct" DESC NULLS FIRST;