import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Navigate,
  Route,
  BrowserRouter as Router,
  Routes,
} from "react-router-dom";

import { AuthProvider } from "@/features/auth/AuthContext";
import { AppLayout } from "@/layouts/AppLayout";
import { AccessPage } from "@/pages/access/AccessPage";
import { LoginPage } from "@/pages/auth/LoginPage";
import { DashboardPage } from "@/pages/dashboard/DashboardPage";
import { EmployeesPage } from "@/pages/employees/EmployeesPage";
import { OfficesPage } from "@/pages/offices/OfficesPage";
import { PerformancePage } from "@/pages/performance/PerformancePage";
import { PerformanceRecordsPage } from "@/pages/performance/PerformanceRecordsPage";
import { PlanDetailPage } from "@/pages/plans/PlanDetailPage";
import { PlansPage } from "@/pages/plans/PlansPage";
import { OfficeScorecardPage } from "@/pages/reports/OfficeScorecardPage";
import { ReportsPage } from "@/pages/reports/ReportsPage";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { RequirePermission } from "@/routes/RequirePermission";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<DashboardPage />} />

                {/* Each page repeats the permission its nav entry uses, so a
                    user cannot reach a hidden page by typing its URL. */}
                <Route
                  element={
                    <RequirePermission anyOf={["plans.view"]} />
                  }
                >
                  <Route path="/plans" element={<PlansPage />} />
                  <Route path="/plans/:id" element={<PlanDetailPage />} />
                </Route>

                {/* Readable by anyone who may see performance data; the "Record
                    performance" action inside is gated separately. */}
                <Route
                  element={<RequirePermission anyOf={["performance.view"]} />}
                >
                  <Route
                    path="/performance/records"
                    element={<PerformanceRecordsPage />}
                  />
                </Route>

                {/* Metric definitions are reference data — a Main Admin
                    configures them, so only they get this page. */}
                <Route element={<RequirePermission anyOf={["metrics.view"]} />}>
                  <Route path="/performance" element={<PerformancePage />} />
                </Route>

                <Route
                  element={
                    <RequirePermission anyOf={["scorecards.view"]} />
                  }
                >
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route
                    path="/reports/office-scorecards/:id"
                    element={<OfficeScorecardPage />}
                  />
                </Route>

                <Route
                  element={
                    <RequirePermission anyOf={["employees.view"]} />
                  }
                >
                  <Route path="/employees" element={<EmployeesPage />} />
                </Route>

                <Route
                  element={<RequirePermission anyOf={["offices.view"]} />}
                >
                  <Route path="/offices" element={<OfficesPage />} />
                </Route>

                <Route
                  element={<RequirePermission anyOf={["access.view"]} />}
                >
                  <Route path="/access" element={<AccessPage />} />
                </Route>
              </Route>
            </Route>

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
