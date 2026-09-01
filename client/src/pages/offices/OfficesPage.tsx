import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreateOfficeDialog } from "@/features/offices/CreateOfficeDialog";
import { useArchiveOffice, useOffices } from "@/features/offices/hooks";

export function OfficesPage() {
  const { data: offices, isLoading, isError } = useOffices();
  const archiveOffice = useArchiveOffice();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Offices</h1>
          <p className="text-sm text-muted-foreground">
            Create, edit, and archive offices; assign Office Admins.
          </p>
        </div>
        <CreateOfficeDialog />
      </div>

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
              No offices yet. Create the first one above.
            </p>
          )}
          {offices && offices.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Employees</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {offices.map((office) => (
                  <TableRow key={office.id}>
                    <TableCell className="font-medium">{office.name}</TableCell>
                    <TableCell>{office.code}</TableCell>
                    <TableCell>{office._count?.employees ?? 0}</TableCell>
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
