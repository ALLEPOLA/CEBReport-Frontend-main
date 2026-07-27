import React, { useState } from "react";
import {
  BarChart3, Menu, X, Home, DollarSign, Users,
  Briefcase, Sun, CreditCard, Target, Package
} from "lucide-react";
import { useRoleBasedSubtopics } from "../../../hooks/useRoleBasedSubtopics";

interface DashboardSelectorProps {
  activeDashboard: string;
  onSelectDashboard: (dashboard: string) => void;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  default: Home,
  financial: DollarSign,
  dgm: Users,
  operations: Briefcase,
  analytics: BarChart3,
  solar: Sun,
  collections: CreditCard,
  executive: Target,
  inventory: Package,
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

const DashboardSelector: React.FC<DashboardSelectorProps> = ({
  activeDashboard,
  onSelectDashboard,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const { subtopics, loading } = useRoleBasedSubtopics([
    "Dashboard",
    "DashBoard",
    "Main Dashboard",
    "DB-Dashboard",
    "DB-DASHBOARD",
    "Dashboards",
  ]);

  // Dynamically map assigned dashboards from Admin Panel ONLY
  const seenKeys = new Set<string>();
  const dashboards = subtopics
    .map((subtopic) => {
      const key = getDashboardKey(subtopic.name);
      return {
        id: key,
        label: subtopic.name,
        icon: iconMap[key] || BarChart3,
      };
    })
    .filter((item) => {
      if (seenKeys.has(item.id)) return false;
      seenKeys.add(item.id);
      return true;
    });

  if (!loading && dashboards.length === 0) {
    return null;
  }

  return (
    <div className={`${isOpen ? 'w-64' : 'w-16'} bg-white border-r border-gray-200 shadow-sm transition-all duration-300 h-screen flex flex-col z-20`}>

      {/* HEADER: Toggle Button */}
      <div className={`p-4 border-b border-gray-200 flex items-center ${isOpen ? 'justify-between' : 'justify-center'}`}>
        {isOpen && (
          <div className="flex items-center gap-3 overflow-hidden">
            <BarChart3 className="w-5 h-5 text-[color:var(--ceb-maroon)] flex-shrink-0" />
            <h2 className="text-sm font-bold text-gray-900 truncate tracking-wide">Dashboards</h2>
          </div>
        )}

        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex items-center justify-center text-gray-600 focus:outline-none"
          title={isOpen ? "Collapse Menu" : "Expand Menu"}
        >
          {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* NAVIGATION */}
      <nav className="p-2 space-y-1.5 flex-1 overflow-y-auto">
        {isOpen && (
          <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            Assigned Dashboards
          </div>
        )}

        {dashboards.map((dashboard) => {
          const Icon = dashboard.icon;
          const isActive = activeDashboard === dashboard.id;
          return (
            <button
              key={dashboard.id}
              onClick={() => onSelectDashboard(dashboard.id)}
              className={`w-full rounded-xl text-sm transition-all duration-200 flex items-center ${
                isOpen ? 'px-3.5 py-2.5 gap-3 justify-start' : 'p-3 justify-center'
              } ${
                isActive
                  ? "bg-[color:var(--ceb-maroon)] text-white shadow-sm font-medium"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100/80 font-normal"
              }`}
              title={!isOpen ? dashboard.label : ""}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {isOpen && <span className="truncate tracking-wide text-xs">{dashboard.label}</span>}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default DashboardSelector;