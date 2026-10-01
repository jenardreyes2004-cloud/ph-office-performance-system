-- Inspection query, used while verifying the security alerting end to end.
-- Read-only.
SELECT
  'login_failure events' AS what,
  count(*)::text AS detail
FROM system_logs
WHERE category = 'auth' AND message = 'login_failure'

UNION ALL
SELECT
  'security alerts',
  count(*)::text
FROM notifications
WHERE message LIKE '%failed sign-in attempts%' OR message LIKE '%credential stuffing%'

UNION ALL
SELECT
  'security-category logs',
  count(*)::text
FROM system_logs
WHERE category = 'security'

UNION ALL
SELECT
  'all notifications',
  count(*)::text
FROM notifications;
