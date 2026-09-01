import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreateEmployeeDialog } from "@/features/employees/CreateEmployeeDialog";
import { useDeactivateEmployee, useEmployees } from "@/features/employees/hooks";

export function EmployeesPage() {
  const { data: employees, isLoading, isError } = useEmployees();
  const deactivateEmployee = useDeactivateEmployee();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Employees</h1>
          <p className="text-sm text-muted-foreground">
            Employee profiles, office assignment, and performance history.
          </p>
        </div>
        <CreateEmployeeDialog />
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading && (
            <p className="text-sm text-muted-foreground">Loading employees…</p>
          )}
          {isError && (
            <p className="text-sm text-destructive">
              Failed to load employees. Is the backend running?
            </p>
          )}
          {employees && employees.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No employees yet. Add the first one above.
            </p>
          )}
          {employees && employees.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Office</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium">
                      {employee.lastName}, {employee.firstName}
                    </TableCell>
                    <TableCell>{employee.position ?? "—"}</TableCell>
                    <TableCell>
                      {employee.office
                        ? `${employee.office.name} (${employee.office.code})`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={deactivateEmployee.isPending}
                        onClick={() => deactivateEmployee.mutate(employee.id)}
                      >
                        Deactivate
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
