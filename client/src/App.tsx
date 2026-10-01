import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";

import { AuthProvider } from "@/features/auth/AuthContext";
import { AppLayout } from "@/layouts/AppLayout";
import { AccessPage } from "@/pages/access/AccessPage";
import { AuditLogPage } from "@/pages/auditLog/AuditLogPage";
import { LoginPage } from "@/pages/auth/LoginPage";
import { DashboardPage } from "@/pages/dashboard/DashboardPage";
import { EmployeesPage } from "@/pages/employees/EmployeesPage";
import { MonthlyUpdatesPage } from "@/pages/monthlyUpdates/MonthlyUpdatesPage";
import { MyWorkPage } from "@/pages/myWork/MyWorkPage";
import { NotificationsPage } from "@/pages/notifications/NotificationsPage";
import { OrganizationPage } from "@/pages/organization/OrganizationPage";
import { PerformancePage } from "@/pages/performance/PerformancePage";
import { PerformanceRecordsPage } from "@/pages/performance/PerformanceRecordsPage";
import { PlanDetailPage } from "@/pages/plans/PlanDetailPage";
import { PlansPage } from "@/pages/plans/PlansPage";
import { OfficeScorecardPage } from "@/pages/reports/OfficeScorecardPage";
import { ReportsPage } from "@/pages/reports/ReportsPage";
import { SystemLogPage } from "@/pages/systemLog/SystemLogPage";
import { ItOpsPage } from "@/pages/itOps/ItOpsPage";
import { ROUTE_REDIRECTS } from "@/lib/navigation";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { RequirePermission } from "@/routes/RequirePermission";

const queryClient = new QueryClient();

/**
 * Four spines, matching the sidebar groups:
 *   Structure — Organization, People
 *   Work      — Projects, My Work, Monthly Updates
 *   Results   — Scorecards, Performance Scores, Metrics
 *   System    — Notifications, Audit Log, System Log, My Access
 *
 * Each page repeats the permission its nav entry uses, so a hidden page cannot
 * be reached by typing its URL.
 */
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

                {/* ----- Structure ----- */}
                <Route element={<RequirePermission anyOf={["offices.view"]} />}>
                  <Route path="/organization" element={<OrganizationPage />} />
                </Route>
                <Route element={<RequirePermission anyOf={["employees.view"]} />}>
                  <Route path="/employees" element={<EmployeesPage />} />
                </Route>

                {/* ----- Work ----- */}
                <Route element={<RequirePermission anyOf={["plans.view"]} />}>
                  <Route path="/projects" element={<PlansPage />} />
                  <Route path="/projects/:id" element={<PlanDetailPage />} />
                  <Route path="/my-work" element={<MyWorkPage />} />
                </Route>
                <Route
                  element={<RequirePermission anyOf={["monthlyUpdates.view"]} />}
                >
                  <Route path="/monthly-updates" element={<MonthlyUpdatesPage />} />
                </Route>

                {/* ----- Results ----- */}
                <Route element={<RequirePermission anyOf={["scorecards.view"]} />}>
                  <Route path="/scorecards" element={<ReportsPage />} />
                  <Route path="/scorecards/:id" element={<OfficeScorecardPage />} />
                </Route>
                <Route element={<RequirePermission anyOf={["performance.view"]} />}>
                  <Route
                    path="/performance-scores"
                    element={<PerformanceRecordsPage />}
                  />
                </Route>
                <Route element={<RequirePermission anyOf={["metrics.view"]} />}>
                  <Route path="/metrics" element={<PerformancePage />} />
                </Route>

                {/* ----- System ----- */}
                <Route
                  element={<RequirePermission anyOf={["notifications.view"]} />}
                >
                  <Route path="/notifications" element={<NotificationsPage />} />
                </Route>
                <Route element={<RequirePermission anyOf={["auditLog.view"]} />}>
                  <Route path="/audit-log" element={<AuditLogPage />} />
                </Route>
                <Route element={<RequirePermission anyOf={["itOps.view"]} />}>
                  <Route path="/it-ops" element={<ItOpsPage />} />
                </Route>
                <Route element={<RequirePermission anyOf={["systemLog.view"]} />}>
                  <Route path="/system-log" element={<SystemLogPage />} />
                </Route>
                <Route element={<RequirePermission anyOf={["access.view"]} />}>
                  <Route path="/access" element={<AccessPage />} />
                </Route>

                {/* Old paths, so bookmarks and shared links keep working. */}
                {ROUTE_REDIRECTS.map(({ from, to }) => (
                  <Route key={from} path={from} element={<Navigate to={to} replace />} />
                ))}
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
