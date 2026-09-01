import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/AuthContext";

function MainAdminDashboard() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {["Total Offices", "Total Employees", "Active Plans", "Overall Performance"].map(
        (label) => (
          <Card key={label}>
            <CardHeader>
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-2xl">—</CardTitle>
            </CardHeader>
          </Card>
        )
      )}
    </div>
  );
}

function OfficeAdminDashboard() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {["Assigned Plans", "Employees", "Office Performance"].map((label) => (
        <Card key={label}>
          <CardHeader>
            <CardDescription>{label}</CardDescription>
            <CardTitle className="text-2xl">—</CardTitle>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

function ItAdminDashboard() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {["Total Employees", "Active Assignments", "Employees Needing Attention"].map(
        (label) => (
          <Card key={label}>
            <CardHeader>
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-2xl">—</CardTitle>
            </CardHeader>
          </Card>
        )
      )}
    </div>
  );
}

function EmployeeDashboard() {
  return (
    <div className="grid grid-cols-2 gap-4">
      {["My Assigned Plans", "My Performance Status"].map((label) => (
        <Card key={label}>
          <CardHeader>
            <CardDescription>{label}</CardDescription>
            <CardTitle className="text-2xl">—</CardTitle>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back{user?.name ? `, ${user.name}` : ""}. Data below is
          placeholder until the dashboard API endpoints are built.
        </p>
      </div>

      {user?.role === "MAIN_ADMIN" && <MainAdminDashboard />}
      {user?.role === "OFFICE_ADMIN" && <OfficeAdminDashboard />}
      {user?.role === "IT_ADMIN" && <ItAdminDashboard />}
      {user?.role === "EMPLOYEE" && <EmployeeDashboard />}
    </div>
  );
}
