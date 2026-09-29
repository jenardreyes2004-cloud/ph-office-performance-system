import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePermission } from "@/features/auth/usePermission";
import { CreateOfficeDialog } from "@/features/offices/CreateOfficeDialog";
import { OfficeTreeCard } from "@/features/offices/OfficeTreeCard";
import { useArchiveOffice, useOffices } from "@/features/offices/hooks";

export function OfficesPage() {
  const { data: offices, isLoading, isError } = useOffices();
  const archiveOffice = useArchiveOffice();
  const { can } = usePermission();

  // Only a Main Admin can change offices; anyone else who reaches this page
  // gets a plain read-only view with no action column.
  const canManage = can("offices.manage");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Offices</h1>
          <p className="text-sm text-muted-foreground">
            {canManage
              ? "The organizational hierarchy, and the offices and sub-units under it."
              : "The organizational structure and office directory."}
          </p>
        </div>
        {canManage && <CreateOfficeDialog />}
      </div>

      <OfficeTreeCard />

      <Card>
        <CardContent className="pt-6">
          {isLoading && (
            <p className="text-sm text-muted-foreground">Loading offices…</p>
          )}
          {isError && (
            <p className="text-sm text-destructive">
              Failed to load offices. Is the backend running?
            </p>
          )}
          {offices && offices.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {canManage
                ? "No offices yet. Create the first one above."
                : "No offices have been set up yet."}
            </p>
          )}
          {offices && offices.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Reports to</TableHead>
                  <TableHead>Employees</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {offices.map((office) => (
                  <TableRow key={office.id}>
                    <TableCell className="font-medium">
                      {office.name}
                      {office.isHeadOffice && (
                        <Badge variant="secondary" className="ml-2 text-[10px]">
                          Scored
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{office.code}</TableCell>
                    <TableCell>{office.parent?.name ?? "—"}</TableCell>
                    <TableCell>{office._count?.employees ?? 0}</TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={archiveOffice.isPending}
                          onClick={() => archiveOffice.mutate(office.id)}
                        >
                          Archive
                        </Button>
                      </TableCell>
                    )}
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
