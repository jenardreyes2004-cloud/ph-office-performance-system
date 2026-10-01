-- Read-only: what security alerts currently exist, and against whom?
SELECT
  "createdAt",
  message,
  "recipientId"
FROM notifications
WHERE message LIKE '%failed sign-in attempts%'
   OR message LIKE '%credential stuffing%'
ORDER BY "createdAt" DESC;

SELECT "createdAt", category, message, context
FROM system_logs
WHERE category = 'security'
ORDER BY "createdAt" DESC
LIMIT 10;