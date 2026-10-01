-- Read-only: what the server actually recorded for recent sign-ins?
SELECT
  "createdAt",
  category,
  message,
  level,
  context
FROM system_logs
ORDER BY "createdAt" DESC
LIMIT 15;