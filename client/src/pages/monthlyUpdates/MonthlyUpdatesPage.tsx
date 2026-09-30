import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePermission } from "@/features/auth/usePermission";
import { CreateMonthlyUpdateDialog } from "@/features/monthlyUpdates/CreateMonthlyUpdateDialog";
import { useMonthlyUpdates } from "@/features/monthlyUpdates/hooks";

const STATUS_VARIANT = {
  ON_TIME: "success",
  LATE: "warning",
  MISSING: "destructive",
} as const;

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function MonthlyUpdatesPage() {
  const { data: updates, isLoading, isError } = useMonthlyUpdates();
  const { can } = usePermission();

  // The server filters this list to the caller's office, so an Office Admin
  // only ever sees their own submissions here.
  const canSubmit = can("monthlyUpdates.manage");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Monthly Updates</h1>
          <p className="text-sm text-muted-foreground">
            {canSubmit
              ? "Progress submitted by each office for the month."
              : "Progress submitted for your office."}
          </p>
        </div>
        {canSubmit && <CreateMonthlyUpdateDialog />}
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading && (
            <p className="text-sm text-muted-foreground">Loading updates…</p>
          )}
          {isError && (
            <p className="text-sm text-destructive">
              Failed to load updates. Is the backend running?
            </p>
          )}
          {updates && updates.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {canSubmit
                ? "No updates submitted yet."
                : "Your office has not submitted an update yet."}
            </p>
          )}
          {updates && updates.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Office</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Update</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {updates.map((update) => (
                  <TableRow key={update.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(update.monthStartDate)} –{" "}
                      {formatDate(update.monthEndDate)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {update.office?.name ?? update.officeId}
                    </TableCell>
                    <TableCell>{update.plan?.title ?? "—"}</TableCell>
                    <TableCell className="max-w-md">
                      <p className="text-sm whitespace-pre-wrap">
                        {update.content}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[update.status]}>
                        {update.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {update.submittedBy?.name ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
