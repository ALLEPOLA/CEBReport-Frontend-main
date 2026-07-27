import React, { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useRoleBasedSubtopics } from "../hooks/useRoleBasedSubtopics";
import { ShieldAlert, RefreshCw } from "lucide-react";

import DefaultDashboardPage from "../mainTopics/Dashboard/DefaultDashboardPage";
import AnalyticsDashboardPage from "../mainTopics/Dashboard/AnalyticsDashboardPage";
import FinancialDashboardPage from "../mainTopics/Dashboard/FinancialDashboardPage";
import DgmDashboardPage from "../mainTopics/Dashboard/DgmDashboardPage";
import OperationsDashboardPage from "../mainTopics/Dashboard/OperationsDashboardPage";
import SolarDashboardPage from "../mainTopics/Dashboard/SolarDashboardPage";
import CollectionsDashboardPage from "../mainTopics/Dashboard/CollectionsDashboardPage";
import ExecutiveDashboardPage from "../mainTopics/Dashboard/ExecutiveDashboardPage";
import InventoryDashboardPage from "../mainTopics/Dashboard/InventoryDashboardPage";

const secondaryDashboardPages: Record<string, React.ComponentType> = {
  analytics: AnalyticsDashboardPage,
  financial: FinancialDashboardPage,
  dgm: DgmDashboardPage,
  operations: OperationsDashboardPage,
  solar: SolarDashboardPage,
  collections: CollectionsDashboardPage,
  executive: ExecutiveDashboardPage,
  inventory: InventoryDashboardPage,
};

const getDashboardKey = (name: string): string => {
  const norm = name.toLowerCase();
  if (norm.includes("financial")) return "financial";
  if (norm.includes("dgm") || norm.includes("construction")) return "dgm";
  if (norm.includes("operations") || norm.includes("field")) return "operations";
  if (norm.includes("analytics")) return "analytics";
  if (norm.includes("solar")) return "solar";
  if (norm.includes("collections") || norm.includes("payment")) return "collections";
  if (norm.includes("executive") || norm.includes("kpi")) return "executive";
  if (norm.includes("inventory") || norm.includes("procurement")) return "inventory";
  return "default";
};

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { dashboardId } = useParams<{ dashboardId?: string }>();

  const { subtopics, loading } = useRoleBasedSubtopics([
    "Dashboard",
    "DashBoard",
    "Main Dashboard",
    "DB-Dashboard",
    "DB-DASHBOARD",
    "Dashboards",
  ]);

  useEffect(() => {
    if (loading || subtopics.length === 0) return;

    const allowedKeys = subtopics.map((s) => getDashboardKey(s.name));
    const firstAllowedKey = allowedKeys[0];

    // If no dashboardId in URL, OR if the URL dashboardId is no longer allowed for this role:
    if (!dashboardId || !allowedKeys.includes(dashboardId)) {
      navigate(`/dashboard/${firstAllowedKey}`, { replace: true });
    }
  }, [dashboardId, subtopics, loading, navigate]);

  // Render smooth spinner while checking permissions
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-stone-200/80 bg-white/80 px-8 py-6 shadow-sm backdrop-blur">
          <RefreshCw className="h-8 w-8 animate-spin text-[#7A0000]" />
          <p className="text-sm font-medium text-stone-600">Loading authorized dashboards...</p>
        </div>
      </div>
    );
  }

  // Render modern empty state if no dashboards assigned
  if (subtopics.length === 0) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-8">
        <div className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-lg shadow-stone-200/50">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-100">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-stone-900">No Dashboard Assigned</h2>
          <p className="mt-2 text-sm text-stone-600">
            Your role currently does not have permission to view any dashboard.
          </p>
          <div className="mt-6 rounded-xl border border-stone-100 bg-stone-50 p-4 text-left text-xs text-stone-500 space-y-1">
            <p className="font-semibold text-stone-700">How to enable access:</p>
            <p>1. Open <span className="font-medium text-stone-800">Admin Panel → Role Report Form</span></p>
            <p>2. Select your role and assign dashboard items under <span className="font-medium text-stone-800">DB-Dashboard</span></p>
          </div>
        </div>
      </div>
    );
  }

  const allowedKeys = subtopics.map((s) => getDashboardKey(s.name));
  const activeDashboard = (dashboardId && allowedKeys.includes(dashboardId)) 
    ? dashboardId 
    : allowedKeys[0];

  const SecondaryDashboardPage = secondaryDashboardPages[activeDashboard];

  if (activeDashboard === "default") {
    return <DefaultDashboardPage />;
  }

  if (SecondaryDashboardPage) {
    return <SecondaryDashboardPage />;
  }

  return (
    <div className="p-8">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Dashboard Not Found</h1>
        <p className="text-gray-500 mb-4">The selected dashboard is not available.</p>
        <button
          onClick={() => navigate("/dashboard")}
          className="px-4 py-2 rounded-lg bg-[var(--ceb-maroon)] text-white text-sm font-medium"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
};

export default Dashboard;
