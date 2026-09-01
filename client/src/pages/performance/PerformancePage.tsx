import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreateMetricDialog } from "@/features/metrics/CreateMetricDialog";
import { useArchiveMetric, useMetrics, useUnarchiveMetric } from "@/features/metrics/hooks";

export function PerformancePage() {
  const { data, isLoading, isError } = useMetrics();
  const archiveMetric = useArchiveMetric();
  const unarchiveMetric = useUnarchiveMetric();

  const remainingWeight = data ? Math.max(0, 100 - data.totalWeight) : 100;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Performance Metrics</h1>
          <p className="text-sm text-muted-foreground">
            Define the metrics used to score employee performance. Active metric weights must sum
            to 100% or less.
          </p>
        </div>
        <CreateMetricDialog remainingWeight={remainingWeight} />
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading && <p className="text-sm text-muted-foreground">Loading metrics…</p>}
          {isError && (
            <p className="text-sm text-destructive">
              Failed to load metrics. Is the backend running?
            </p>
          )}
          {data && data.metrics.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No metrics yet. Create the first one above.
            </p>
          )}
          {data && data.metrics.length > 0 && (
            <>
              <div className="mb-4 flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Active weight total:</span>
                <Badge variant={data.totalWeight === 100 ? "success" : "warning"}>
                  {data.totalWeight.toFixed(2)}% / 100%
                </Badge>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Weight</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.metrics.map((metric) => (
                    <TableRow key={metric.id}>
                      <TableCell className="font-medium">{metric.name}</TableCell>
                      <TableCell>{metric.unit ?? "—"}</TableCell>
                      <TableCell>{Number(metric.weightPct).toFixed(2)}%</TableCell>
                      <TableCell>
                        <Badge variant={metric.archivedAt ? "outline" : "success"}>
                          {metric.archivedAt ? "Archived" : "Active"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {metric.archivedAt ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={unarchiveMetric.isPending}
                            onClick={() => unarchiveMetric.mutate(metric.id)}
                          >
                            Unarchive
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={archiveMetric.isPending}
                            onClick={() => archiveMetric.mutate(metric.id)}
                          >
                            Archive
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
