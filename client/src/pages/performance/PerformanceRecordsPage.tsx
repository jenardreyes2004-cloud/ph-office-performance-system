import { CreatePerformanceRecordDialog } from "@/features/performanceRecords/CreatePerformanceRecordDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Card, CardContent } from "@/components/ui/card";

import { usePerformanceRecords } from "@/features/performanceRecords/hooks";

export function PerformanceRecordsPage() {
  const { data, isLoading, isError } = usePerformanceRecords();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Performance Records</h1>

          <p className="text-sm text-muted-foreground">
            View employee performance scores and records.
          </p>
        </div>

        <CreatePerformanceRecordDialog />
      </div>
      <Card>
        <CardContent className="pt-6">
          {isLoading && (
            <p className="text-sm text-muted-foreground">
              Loading performance records…
            </p>
          )}

          {isError && (
            <p className="text-sm text-destructive">
              Failed to load performance records. Is the backend running?
            </p>
          )}

          {data && data.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No performance records yet.
            </p>
          )}

          {data && data.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Metric</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {data.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">
                      {record.employee
                        ? `${record.employee.firstName} ${record.employee.lastName}`
                        : record.employeeId}
                    </TableCell>

                    <TableCell>
                      {record.metric?.name ?? record.metricId}
                    </TableCell>

                    <TableCell>
                      {record.score}
                      {record.metric?.unit ? ` ${record.metric.unit}` : ""}
                    </TableCell>

                    <TableCell>
                      {new Date(record.periodStart).toLocaleDateString()} –{" "}
                      {new Date(record.periodEnd).toLocaleDateString()}
                    </TableCell>

                    <TableCell>{record.notes ?? "—"}</TableCell>
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
