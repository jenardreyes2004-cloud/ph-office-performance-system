import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuditLog } from "@/features/auditLog/hooks";
import { ROLE_LABELS } from "@/lib/permissions";
import type { UserRole } from "@/types";

/** CREATE/UPDATE/DELETE read as destructive in a different colour. */
const ACTION_TONE = (action: string) => {
  if (action.startsWith("DELETE")) return "destructive" as const;
  if (action.startsWith("CREATE")) return "success" as const;
  return "secondary" as const;
};

function when(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function AuditLogPage() {
  const { data: entries, isLoading, isError } = useAuditLog();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Audit Log</h1>
        <p className="text-sm text-muted-foreground">
          Every successful change made through the API, and who made it.
          Request values are not stored — only the fields a request touched.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading && (
            <p className="text-sm text-muted-foreground">Loading audit trail…</p>
          )}
          {isError && (
            <p className="text-sm text-destructive">
              Failed to load the audit trail.
            </p>
          )}
          {entries && entries.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nothing recorded yet. Changes appear here as they happen.
            </p>
          )}

          {entries && entries.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Who</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Fields touched</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => {
                  const fields = e.metadata?.fields;
                  const fieldNames =
                    fields && typeof fields === "object" && !Array.isArray(fields)
                      ? Object.keys(fields)
                      : [];
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {when(e.createdAt)}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">
                          {e.user?.name ?? "anonymous"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {e.user ? ROLE_LABELS[e.user.role as UserRole] ?? e.user.role : "—"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={ACTION_TONE(e.action)}>{e.action}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {e.entity}
                        {e.entityId && (
                          <span className="block font-mono text-[10px] text-muted-foreground">
                            {e.entityId.slice(0, 8)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {fieldNames.length > 0 ? fieldNames.join(", ") : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
