import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  RefreshCw,
  Package,
  BarChart3,
  Table,
  Search,
  ChevronDown,
  ChevronUp,
  Calendar,
  Building,
  Activity,
  Layers,
  MapPin,
  ArrowUpDown
} from "lucide-react";
import DashboardHeader from "../../components/mainTopics/Dashboard/DashboardHeader";
import DashboardSelector from "../../components/mainTopics/Dashboard/DashboardSelector";
import { useUser } from "../../contexts/UserContext";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from "recharts";

// Scroll reveal transition hook
function useInView(
  ref: React.RefObject<Element>,
  options?: IntersectionObserverInit
): { inView: boolean } {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
      },
      { threshold: 0.05, ...options }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);

  return { inView };
}

// Reveal animation container component
const Reveal: React.FC<{ children: React.ReactNode; delay?: number; className?: string }> = ({
  children,
  delay = 0,
  className = "",
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const { inView } = useInView(ref as React.RefObject<Element>);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
};

// Custom Tooltip component for construction progress
const ConstructionTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const grouped: Record<string, { app?: number; conn?: number }> = {};
    let totalApps = 0;
    let totalConns = 0;

    payload.forEach((item: any) => {
      const nameStr = item.name || "";
      const isApp = nameStr.endsWith(" (App)");
      const cleanName = nameStr.replace(" (App)", "").replace(" (Conn)", "");
      const val = Number(item.value) || 0;

      if (!grouped[cleanName]) {
        grouped[cleanName] = {};
      }

      if (isApp) {
        grouped[cleanName].app = val;
        totalApps += val;
      } else {
        grouped[cleanName].conn = val;
        totalConns += val;
      }
    });

    const totalPending = Math.max(0, totalApps - totalConns);

    return (
      <div className="bg-white/95 backdrop-blur-md p-4 border border-slate-200/80 shadow-xl rounded-2xl text-xs space-y-3 font-sans min-w-[280px]">
        <div className="border-b border-slate-100 pb-2">
          <div className="font-extrabold text-slate-800 text-sm font-mono">
            Area/ Dept: {label}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Apps</span>
              <span className="text-xs font-extrabold text-[#813405] font-mono">{totalApps}</span>
            </div>
            <div className="flex flex-col border-l border-slate-200/60 pl-2">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Conns</span>
              <span className="text-xs font-extrabold text-emerald-600 font-mono">{totalConns}</span>
            </div>
            <div className="flex flex-col border-l border-slate-200/60 pl-2">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Pending</span>
              <span className="text-xs font-extrabold text-red-600 font-mono">{totalPending}</span>
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Type Breakdown</div>
          {Object.entries(grouped).map(([typeName, values]) => {
            const appVal = values.app || 0;
            const connVal = values.conn || 0;
            const pendingVal = Math.max(0, appVal - connVal);

            return (
              <div key={typeName} className="flex flex-col gap-1 border-b border-slate-100/50 pb-2 last:border-0 last:pb-0">
                <span className="font-bold text-slate-700 text-[11px]">{typeName}</span>
                <div className="flex items-center justify-between gap-4 text-[10px]">
                  <div className="flex items-center gap-1 text-orange-700 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                    <span>Applied: {appVal}</span>
                  </div>
                  <div className="flex items-center gap-1 text-emerald-700 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Given / Job Closed: {connVal}</span>
                  </div>
                  <div className="flex items-center gap-1 text-red-600 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    <span>Pending: {pendingVal}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
};

// Data interfaces
interface AreaQtyItem {
  areaId: string;
  areaName: string;
  qtyOnHand: number;
  stockValue: number;
}

interface AreaEngineerMaterialMasterItem {
  matCd: string;
  matNm: string;
  uomCd: string;
  unitPrice: number;
  provinceQtyOnHand: number;
  provinceStockValue: number;
  areaBreakdown: AreaQtyItem[];
}

interface AreaEngineerMaterialMasterSummaryModel {
  areaId: string;
  areaName: string;
  totalProvinceQtyOnHand: number;
  totalProvinceStockValue: number;
  areaTotals: AreaQtyItem[];
  materials: AreaEngineerMaterialMasterItem[];
}

// Color palette matching the Default Dashboard Solar Customers chart
const SOLAR_NET_TYPE_COLORS = [
  "#813405",
  "#d45113",
  "#f9a03f",
  "#f8dda4",
  "#8B5E3C",
];

const AreaEngineerDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const activeDashboard = "areaengineer";
  const { user } = useUser();
  const epfNo = user?.Userno || "";

  // Core Data States
  const [pivTotal, setPivTotal] = useState<{ date: string; amount: number }[]>([]);
  const [stockValue, setStockValue] = useState<number | null>(null);
  const [appCounts, setAppCounts] = useState<{ deptId: string; description: string; appType: string; noOfApplications: number }[]>([]);
  const [connectionsGiven, setConnectionsGiven] = useState<{ deptId: string; description: string; appType: string; noOfConnections: number }[]>([]);
  const [pendingApplications, setPendingApplications] = useState<{ deptId: string; description: string; appType: string; applicationNo: string }[]>([]);
  const [materialMasterData, setMaterialMasterData] = useState<AreaEngineerMaterialMasterSummaryModel | null>(null);

  const [loading, setLoading] = useState(false);
  const [materialLoading, setMaterialLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [fetchCount, setFetchCount] = useState(0);

  // Active hover slice state for Material Master Donut chart
  const [activeMaterialPieIndex, setActiveMaterialPieIndex] = useState<number | null>(null);

  // Area Selection States (Level No = 50 for Area Engineer)
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [companies, setCompanies] = useState<{ compId: string; compName: string }[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("WPN");

  // Custom Date Period PIV Collection States
  const [customPivStart, setCustomPivStart] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [customPivEnd, setCustomPivEnd] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  });
  const [customPivTotalAmount, setCustomPivTotalAmount] = useState<number | null>(null);
  const [customPivLoading, setCustomPivLoading] = useState(false);

  // Interactive UI States
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "apps-desc" | "conns-desc" | "pending-desc">("name");
  const [viewMode, setViewMode] = useState<"chart" | "table" | "pending">("chart");

  const companyDropdownRef = useRef<HTMLDivElement>(null);
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);
  const [companySearchQuery, setCompanySearchQuery] = useState("");

  // Close dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (companyDropdownRef.current && !companyDropdownRef.current.contains(e.target as Node)) {
        setIsCompanyDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const filteredCompanies = useMemo(() => {
    return companies.filter(
      (c) =>
        c.compId.toLowerCase().includes(companySearchQuery.toLowerCase()) ||
        c.compName.toLowerCase().includes(companySearchQuery.toLowerCase())
    );
  }, [companies, companySearchQuery]);

  // Fetch authorized Area list for Area Engineer (Level No = 50)
  useEffect(() => {
    const fetchCompanies = async () => {
      if (!epfNo) return;
      try {
        const res = await fetch(`/misapi/api/incomeexpenditure/Usercompanies/${epfNo}/50`);
        if (!res.ok) throw new Error("Failed to fetch Area Engineer areas");
        const parsed = await res.json();
        let rawData: any[] = [];
        if (Array.isArray(parsed)) {
          rawData = parsed;
        } else if (parsed.data && Array.isArray(parsed.data)) {
          rawData = parsed.data;
        } else if (parsed.result && Array.isArray(parsed.result)) {
          rawData = parsed.result;
        }

        const final = rawData
          .map((item: any) => ({
            compId: (item.CompId ?? item.compId ?? item.COMP_ID ?? "").toString().trim(),
            compName: (item.CompNm ?? item.CompName ?? item.compNm ?? item.compName ?? item.COMP_NM ?? "").toString().trim(),
          }))
          .filter((item) => item.compId !== "");

        if (final.length > 0) {
          setCompanies(final);
          const hasWPN = final.some(c => c.compId.toUpperCase() === "WPN");
          setSelectedCompanyId(hasWPN ? "WPN" : final[0].compId);
        } 
      } catch (err) {
        console.error("Failed to load Area Engineer authorized areas:", err);
      }
    };
    fetchCompanies();
  }, [epfNo]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const queryBase = `?companyId=${selectedCompanyId}${fetchCount > 0 ? "&refresh=true" : ""}`;
        const queryAppConn = `?companyId=${selectedCompanyId}&year=${selectedYear}${fetchCount > 0 ? "&refresh=true" : ""}`;

        const [r1, r2, r3, r4, r5] = await Promise.all([
          fetch(`/misapi/api/areaengineer/piv-total${queryBase}`, { headers: { Accept: "application/json" } }),
          fetch(`/misapi/api/areaengineer/stock-value${queryBase}`, { headers: { Accept: "application/json" } }),
          fetch(`/misapi/api/areaengineer/application-count${queryAppConn}`, { headers: { Accept: "application/json" } }),
          fetch(`/misapi/api/areaengineer/connections-given${queryAppConn}`, { headers: { Accept: "application/json" } }),
          fetch(`/misapi/api/areaengineer/pending-applications${queryAppConn}`, { headers: { Accept: "application/json" } }),
        ]);

        if (!r1.ok || !r2.ok || !r3.ok || !r4.ok || !r5.ok) {
          throw new Error("Failed to fetch Area Engineer dashboard data");
        }

        const [pivData, stockData, appData, connData, pendingData] = await Promise.all([
          r1.json(),
          r2.json(),
          r3.json(),
          r4.json(),
          r5.json(),
        ]);

        const getVal = (obj: any) => obj?.Value ?? obj?.value;
        const getAt = (obj: any) => obj?.FetchedAt ?? obj?.fetchedAt;

        // 1. PIV Data
        const list = Array.isArray(getVal(pivData)) ? getVal(pivData) : Array.isArray(pivData) ? pivData : [];
        const sortedList = [...list].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setPivTotal(sortedList);

        // 2. Stock Value Data
        const stockObj = getVal(stockData);
        setStockValue(typeof stockObj?.stockValue === "number" ? stockObj.stockValue : 0);

        // 3. Application Counts Data
        const appList = Array.isArray(getVal(appData)) ? getVal(appData) : Array.isArray(appData) ? appData : [];
        setAppCounts(appList);

        // 4. Connections Given Data
        const connList = Array.isArray(getVal(connData)) ? getVal(connData) : Array.isArray(connData) ? connData : [];
        setConnectionsGiven(connList);

        // 5. Pending Applications Data
        const pendingList = Array.isArray(getVal(pendingData)) ? getVal(pendingData) : Array.isArray(pendingData) ? pendingData : [];
        setPendingApplications(pendingList);

        const latestTime = new Date(Math.max(
          new Date(getAt(pivData) || 0).getTime(),
          new Date(getAt(stockData) || 0).getTime(),
          new Date(getAt(appData) || 0).getTime(),
          new Date(getAt(connData) || 0).getTime(),
          new Date(getAt(pendingData) || 0).getTime()
        ));
        setLastUpdated(latestTime.getTime() > 0 ? latestTime.toLocaleTimeString() : new Date().toLocaleTimeString());
      } catch (err: any) {
        setError(err.message || "Failed to load Area Engineer dashboard data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [fetchCount, selectedYear, selectedCompanyId]);

  // Fetch PIV Period Summary
  useEffect(() => {
    const fetchCustomPivData = async () => {
      if (!selectedCompanyId) return;
      setCustomPivLoading(true);
      try {
        const queryBase = `?companyId=${selectedCompanyId}&startDate=${customPivStart}&endDate=${customPivEnd}${fetchCount > 0 ? "&refresh=true" : ""}`;
        const res = await fetch(`/misapi/api/areaengineer/piv-period-summary${queryBase}`, {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error("Failed to fetch PIV period summary");
        const data = await res.json();
        const getVal = (obj: any) => obj?.Value ?? obj?.value;
        const valObj = getVal(data) || data;
        const sum = typeof valObj?.pivCollection === "number" ? valObj.pivCollection : 0;
        setCustomPivTotalAmount(sum);
      } catch (err: any) {
        console.error("PIV period fetch error:", err);
        setCustomPivTotalAmount(0);
      } finally {
        setCustomPivLoading(false);
      }
    };
    fetchCustomPivData();
  }, [fetchCount, selectedCompanyId, customPivStart, customPivEnd]);

  // Fetch Material Master Data
  useEffect(() => {
    const fetchMaterialMaster = async () => {
      if (!selectedCompanyId) return;
      setMaterialLoading(true);
      try {
        const queryBase = `?companyId=${selectedCompanyId}${fetchCount > 0 ? "&refresh=true" : ""}`;
        const res = await fetch(`/misapi/api/areaengineer/material-master${queryBase}`, {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error("Failed to fetch material master summary");
        const data = await res.json();
        const getVal = (obj: any) => obj?.Value ?? obj?.value;
        const valObj = getVal(data) || data;
        setMaterialMasterData(valObj);
      } catch (err: any) {
        console.error("Material master fetch error:", err);
        setMaterialMasterData(null);
      } finally {
        setMaterialLoading(false);
      }
    };
    fetchMaterialMaster();
  }, [fetchCount, selectedCompanyId]);

  // Calculations for PIV 30-Day Collections
  const total30DayCollection = useMemo(() => {
    return pivTotal.reduce((sum, item) => sum + (item.amount || 0), 0);
  }, [pivTotal]);

  const breakdownData = useMemo(() => {
    return [...pivTotal].reverse().map((item) => ({
      ...item,
      label: new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric", weekday: "short" }),
    }));
  }, [pivTotal]);

  // Data processing for Material Master SVG Donut Donut Chart (Styled like Solar Customers by Net Type)
  const materialPieChartItems = useMemo(() => {
    if (!materialMasterData?.materials) return [];
    const top = materialMasterData.materials
      .filter(m => m.provinceQtyOnHand > 0)
      .slice(0, 5);

    const totalStockVal = top.reduce((sum, m) => {
      const stockVal = (m.provinceStockValue !== undefined && m.provinceStockValue !== null && !isNaN(m.provinceStockValue) && m.provinceStockValue > 0)
        ? m.provinceStockValue
        : (m.unitPrice || 0) * (m.provinceQtyOnHand || 0);
      return sum + stockVal;
    }, 0);

    if (totalStockVal === 0) return [];

    return top.map(m => {
      const stockVal = (m.provinceStockValue !== undefined && m.provinceStockValue !== null && !isNaN(m.provinceStockValue) && m.provinceStockValue > 0)
        ? m.provinceStockValue
        : (m.unitPrice || 0) * (m.provinceQtyOnHand || 0);
      return {
        matCd: m.matCd,
        matNm: m.matNm,
        qty: m.provinceQtyOnHand,
        stockValue: stockVal,
        pct: (stockVal / totalStockVal) * 100
      };
    });
  }, [materialMasterData]);

  const totalMaterialDonutStockValue = useMemo(() => {
    return materialPieChartItems.reduce((sum, item) => sum + item.stockValue, 0);
  }, [materialPieChartItems]);

  // Data processing for Construction Progress
  const applicationChartData = useMemo(() => {
    const deptMap: Record<string, { name: string; totalApps: number; totalConns: number; completionRate: number; [key: string]: any }> = {};

    appCounts.forEach((item) => {
      const deptKey = item.deptId || "Other Area";
      if (!deptMap[deptKey]) {
        deptMap[deptKey] = { name: deptKey, totalApps: 0, totalConns: 0, completionRate: 0 };
      }
      const typeLabel = item.description || "Unknown Type";
      const key = `${typeLabel} (App)`;
      deptMap[deptKey][key] = (deptMap[deptKey][key] || 0) + item.noOfApplications;
      deptMap[deptKey].totalApps += item.noOfApplications;
    });

    connectionsGiven.forEach((item) => {
      const deptKey = item.deptId || "Other Area";
      if (!deptMap[deptKey]) {
        deptMap[deptKey] = { name: deptKey, totalApps: 0, totalConns: 0, completionRate: 0 };
      }
      const typeLabel = item.description || "Unknown Type";
      const key = `${typeLabel} (Conn)`;
      deptMap[deptKey][key] = (deptMap[deptKey][key] || 0) + item.noOfConnections;
      deptMap[deptKey].totalConns += item.noOfConnections;
    });

    Object.values(deptMap).forEach((dept) => {
      dept.completionRate = dept.totalApps > 0 ? (dept.totalConns / dept.totalApps) * 100 : 0;
      dept.pending = Math.max(0, dept.totalApps - dept.totalConns);
    });

    return Object.values(deptMap);
  }, [appCounts, connectionsGiven]);

  const filteredApplicationData = useMemo(() => {
    if (!searchTerm.trim()) return applicationChartData;
    const term = searchTerm.toLowerCase().trim();
    return applicationChartData.filter((item) => item.name.toLowerCase().includes(term));
  }, [applicationChartData, searchTerm]);

  const sortedApplicationData = useMemo(() => {
    const data = [...filteredApplicationData];
    if (sortBy === "name") {
      data.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "apps-desc") {
      data.sort((a, b) => b.totalApps - a.totalApps);
    } else if (sortBy === "conns-desc") {
      data.sort((a, b) => b.totalConns - a.totalConns);
    } else if (sortBy === "pending-desc") {
      data.sort((a, b) => b.pending - a.pending);
    }
    return data;
  }, [filteredApplicationData, sortBy]);

  const appTypesList = useMemo(() => {
    const types = new Set<string>();
    appCounts.forEach((item) => {
      types.add(`${item.description || "Unknown Type"} (App)`);
    });
    return Array.from(types);
  }, [appCounts]);

  const connTypesList = useMemo(() => {
    const types = new Set<string>();
    connectionsGiven.forEach((item) => {
      types.add(`${item.description || "Unknown Type"} (Conn)`);
    });
    return Array.from(types);
  }, [connectionsGiven]);

  // Group pending applications by deptId
  const groupedPendingApplications = useMemo(() => {
    let filtered = pendingApplications;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(
        (app) =>
          app.deptId.toLowerCase().includes(term) ||
          app.applicationNo.toLowerCase().includes(term) ||
          app.description.toLowerCase().includes(term)
      );
    }
    const grouped: Record<string, typeof pendingApplications> = {};
    filtered.forEach((app) => {
      if (!grouped[app.deptId]) {
        grouped[app.deptId] = [];
      }
      grouped[app.deptId].push(app);
    });
    return grouped;
  }, [pendingApplications, searchTerm]);

  const [expandedPendingDepts, setExpandedPendingDepts] = useState<Record<string, boolean>>({});

  const togglePendingDeptExpand = (deptId: string) => {
    setExpandedPendingDepts((prev) => ({
      ...prev,
      [deptId]: !prev[deptId],
    }));
  };

  const appColors = ["#813405", "#d45113", "#f9a03f", "#f8dda4", "#a04006", "#bd5008"];
  const connColors = ["#10b981", "#059669", "#06b6d4", "#3b82f6", "#6366f1", "#4f46e5"];

  // SVG Circumference constant for Donut Chart (r=80 -> 2 * PI * 80 = 502.65)
  const C = 502.65;

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="flex">
        <DashboardSelector
          activeDashboard={activeDashboard}
          onSelectDashboard={(dashboard) => navigate(`/dashboard/${dashboard}`)}
        />
        <div className="flex-1 min-w-0">
          <DashboardHeader title="Area Engineer Dashboard" />

          {/* Action / Refresh Bar (Glassmorphic) */}
          <div className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-20 shadow-sm">
            <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[color:var(--ceb-maroon,#813405)]/80" />
                  Area: {companies.find(c => c.compId === selectedCompanyId)?.compName || selectedCompanyId}
                </span>

                {/* Global Area Engineer Area Selector (Level No = 50) */}
                {companies.length > 0 && (
                  <div className="relative" ref={companyDropdownRef}>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCompanyDropdownOpen(!isCompanyDropdownOpen);
                        setCompanySearchQuery("");
                      }}
                      className="px-3.5 py-2 w-64 text-left text-xs font-bold bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-[color:var(--ceb-maroon,#813405)]/10 text-slate-700 flex items-center justify-between shadow-sm hover:bg-slate-50 transition-all"
                    >
                      <span className="truncate flex items-center gap-2">
                        <Building className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        {selectedCompanyId} - {companies.find(c => c.compId === selectedCompanyId)?.compName || ""}
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 ml-1 flex-shrink-0 text-slate-400" />
                    </button>

                    {isCompanyDropdownOpen && (
                      <div className="absolute left-0 mt-2 w-80 bg-white border border-slate-200/80 rounded-2xl shadow-xl z-50 p-2.5 space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            placeholder="Search Area..."
                            value={companySearchQuery}
                            onChange={(e) => setCompanySearchQuery(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[color:var(--ceb-maroon,#813405)]/20 text-slate-800 placeholder-slate-400 font-medium"
                          />
                        </div>

                        <div className="max-h-60 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                          {filteredCompanies.length > 0 ? (
                            filteredCompanies.map((comp) => {
                              const isSelected = comp.compId === selectedCompanyId;
                              return (
                                <button
                                  key={comp.compId}
                                  type="button"
                                  onClick={() => {
                                    setSelectedCompanyId(comp.compId);
                                    setIsCompanyDropdownOpen(false);
                                  }}
                                  className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                                    isSelected
                                      ? "bg-[color:var(--ceb-maroon,#813405)] text-white font-bold"
                                      : "hover:bg-slate-100 text-slate-700 font-medium"
                                  }`}
                                >
                                  <span className="truncate">{comp.compId} - {comp.compName}</span>
                                  {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white ml-2 flex-shrink-0" />}
                                </button>
                              );
                            })
                          ) : (
                            <div className="text-[11px] text-slate-400 text-center py-3 font-medium">
                              No matching areas found
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                {lastUpdated && (
                  <span className="text-[11px] font-medium text-slate-400">
                    Updated: {lastUpdated}
                  </span>
                )}
                <button
                  onClick={() => setFetchCount((c) => c + 1)}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-[color:var(--ceb-maroon,#813405)] text-white text-xs font-bold rounded-2xl shadow-md hover:bg-[color:var(--ceb-maroon,#813405)]/90 active:scale-95 transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
            {error && (
              <div className="p-4 bg-red-50/80 backdrop-blur border border-red-200/80 rounded-2xl flex items-center gap-3 text-red-700 text-sm font-medium shadow-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            {/* TOP SUMMARY SECTION (MATCHING THE DGM DASHBOARD CARD STYLES) */}
            <Reveal>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch mb-12">
                <div className="lg:col-span-1 flex flex-col gap-6 h-full">
                  <Reveal delay={0} className="flex-1">
                    <div className="bg-gradient-to-br from-white via-white to-blue-50/20 rounded-3xl p-6 shadow-sm border border-slate-200/60 hover:border-blue-400/30 hover:shadow-lg hover:shadow-blue-500/5 transform hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group h-full flex flex-col justify-between min-h-[220px]">
                      <div className="absolute top-0 right-0 w-36 h-36 bg-blue-500/5 rounded-full blur-3xl group-hover:bg-blue-500/10 transition-all duration-500 pointer-events-none" />

                      <div>
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-3">
                            <div className="p-3 bg-blue-50 border border-blue-100 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                              <Package className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                              <h2 className="text-base font-extrabold text-slate-800">Stock Value</h2>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Area stock valuation</p>
                            </div>
                          </div>
                        </div>

                        {loading ? (
                          <div className="space-y-3 my-5">
                            <div className="h-10 w-48 bg-slate-100 rounded-xl animate-pulse" />
                            <div className="h-4 w-32 bg-slate-100 rounded-xl animate-pulse" />
                          </div>
                        ) : (
                          <div className="my-4">
                            <p className="text-4xl font-black text-slate-900 tracking-tight flex items-baseline gap-1.5">
                              <span className="text-sm font-extrabold text-slate-400">LKR</span>
                              {stockValue !== null ? (stockValue / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
                              <span className="text-xl font-black text-blue-600">M</span>
                            </p>
                            <p className="text-xs text-slate-500 font-semibold mt-2">
                              Full Sum: LKR {stockValue?.toLocaleString("en-US", { minimumFractionDigits: 2 }) ?? "0.00"}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </Reveal>

                  <Reveal delay={50} className="flex-1">
                    <div className="bg-gradient-to-br from-white via-white to-amber-50/15 rounded-3xl p-6 shadow-sm border border-slate-200/60 hover:border-amber-400/25 hover:shadow-lg hover:shadow-amber-500/5 transform hover:-translate-y-1 transition-all duration-300 relative overflow-hidden h-full flex flex-col justify-between min-h-[220px] group">
                      <div className="absolute top-0 right-0 w-36 h-36 bg-amber-500/5 rounded-full blur-3xl group-hover:bg-amber-500/10 transition-all duration-500 pointer-events-none" />

                      <div>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-3 bg-amber-50 border border-amber-100 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                            <Calendar className="w-6 h-6 text-amber-600" />
                          </div>
                          <div>
                            <h2 className="text-base font-extrabold text-slate-800">PIV Period Summary</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Custom date range</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5 my-3">
                          <div className="flex flex-col gap-1">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest pl-1">Start Date</span>
                            <input
                              type="date"
                              value={customPivStart}
                              onChange={(e) => setCustomPivStart(e.target.value)}
                              className="w-full px-2 py-1.5 text-[11px] border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 font-bold text-slate-600 transition-all font-mono"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest pl-1">End Date</span>
                            <input
                              type="date"
                              value={customPivEnd}
                              onChange={(e) => setCustomPivEnd(e.target.value)}
                              className="w-full px-2 py-1.5 text-[11px] border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 font-bold text-slate-600 transition-all font-mono"
                            />
                          </div>
                        </div>

                        {customPivLoading ? (
                          <div className="my-5 space-y-3">
                            <div className="h-8 w-44 bg-slate-100 rounded-xl animate-pulse" />
                            <div className="h-3 w-32 bg-slate-100 rounded-xl animate-pulse" />
                          </div>
                        ) : (
                          <div className="my-4 bg-gradient-to-r from-amber-50/40 to-orange-50/20 border border-amber-100/50 rounded-2xl p-3.5 shadow-sm">
                            <span className="text-[9px] font-black text-amber-800/80 uppercase tracking-widest">Total Collected</span>
                            <p className="text-xl font-black text-slate-800 tracking-tight mt-1 flex items-baseline gap-1">
                              <span className="text-xs font-bold text-slate-400 font-mono">LKR</span>
                              {customPivTotalAmount !== null ? customPivTotalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </Reveal>
                </div>

                <Reveal delay={100} className="lg:col-span-2 h-full">
                  <div className="bg-gradient-to-br from-white via-white to-orange-50/10 rounded-3xl p-6 shadow-sm border border-slate-200/60 hover:border-orange-400/25 hover:shadow-lg hover:shadow-orange-500/5 transform hover:-translate-y-1 transition-all duration-300 relative overflow-hidden h-full flex flex-col justify-between min-h-[460px] group">
                    <div className="absolute top-0 right-0 w-36 h-36 bg-orange-500/5 rounded-full blur-3xl group-hover:bg-orange-500/10 transition-all duration-500 pointer-events-none" />

                    <div className="flex flex-col h-full justify-between gap-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-orange-50 border border-orange-100 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                            <Activity className="w-5 h-5 text-orange-600 animate-pulse" />
                          </div>
                          <div>
                            <h3 className="text-base font-extrabold text-slate-800">Daily PIV Breakdown</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Collections status</p>
                          </div>
                        </div>
                      </div>

                      {!loading && breakdownData.length > 0 && (
                        <div className="bg-gradient-to-r from-orange-50/50 to-amber-50/30 border border-orange-100/50 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm">
                          <div>
                            <span className="text-[9px] font-black text-orange-800/80 uppercase tracking-widest">Total 30-Day Collections</span>
                            <p className="text-2xl font-black text-slate-800 tracking-tight mt-1 flex items-baseline gap-1.5">
                              <span className="text-xs font-bold text-slate-400">LKR</span>
                              {total30DayCollection.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>
                        </div>
                      )}

                      {loading ? (
                        <div className="space-y-4 py-2">
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="space-y-1">
                              <div className="flex justify-between"><div className="h-4 w-24 bg-slate-100 rounded animate-pulse" /><div className="h-4 w-32 bg-slate-100 rounded animate-pulse" /></div>
                              <div className="h-2 w-full bg-slate-100 rounded animate-pulse" />
                            </div>
                          ))}
                          </div>
                      ) : breakdownData.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 text-sm font-semibold">
                          No collection details available for this period.
                        </div>
                      ) : (
                        <div className="space-y-3 flex-1 flex flex-col justify-end">
                          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 pl-1">Recent 7 Days Activity</div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1.5 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent font-sans">
                            {(() => {
                              const recent7 = breakdownData.slice(0, 7);
                              const sum7 = recent7.reduce((s, it) => s + (it.amount || 0), 0);
                              return recent7.map((item) => {
                                const pct = sum7 > 0 ? (item.amount / sum7) * 100 : 0;
                                const itemDate = new Date(item.date);
                                return (
                                  <div key={item.date} className="flex items-center justify-between p-2.5 rounded-2xl border border-slate-100/80 hover:border-orange-200/60 hover:bg-orange-50/5 transition-all duration-200 group/item bg-white shadow-sm hover:shadow">
                                    <div className="flex items-center gap-3">
                                      <div className="flex flex-col items-center justify-center w-11 h-11 rounded-xl bg-slate-50 border border-slate-100 text-center flex-shrink-0 group-hover/item:bg-orange-50 group-hover/item:border-orange-100 transition-colors">
                                        <span className="text-[9px] font-extrabold text-slate-400 group-hover/item:text-orange-500 uppercase tracking-wider font-mono">
                                          {itemDate.toLocaleDateString("en-US", { weekday: "short" })}
                                        </span>
                                        <span className="text-xs font-black text-slate-700 group-hover/item:text-slate-900 font-mono -mt-0.5">
                                          {itemDate.toLocaleDateString("en-US", { day: "numeric" })}
                                        </span>
                                      </div>

                                      <div className="flex flex-col min-w-0">
                                        <span className="text-[11px] font-extrabold text-slate-700 group-hover/item:text-slate-900 transition-colors">
                                          {itemDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                                        </span>
                                        <div className="w-24 h-1 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                                          <div
                                            className="h-full bg-gradient-to-r from-[color:var(--ceb-maroon,#813405)] to-orange-500 rounded-full transition-all duration-500"
                                            style={{ width: `${pct > 0 ? Math.max(pct, 2) : 0}%` }}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <span className="font-mono font-bold text-slate-800 text-[11px] group-hover/item:text-slate-900 transition-colors">
                                        LKR {item.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </span>
                                    </div>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Reveal>
              </div>
            </Reveal>

            {/* SECTION 2 — MATERIAL MASTER (MATCHING DEFAULT DASHBOARD "Solar Customers by Net Type — Breakdown by connection category" DONUT PIE CHART EXACTLY) */}
            <Reveal delay={100}>
              <div className="bg-white rounded-[24px] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] border border-gray-100/80 p-6 flex flex-col hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.06)] transition-all duration-300 relative overflow-hidden group">
                <div className="flex items-center justify-between mb-6 relative z-10 border-b border-gray-100 pb-3">
                  <div>
                    <h3 className="font-bold text-[15px] text-gray-900 tracking-tight flex items-center gap-2">
                      <Layers className="w-5 h-5 text-[color:var(--ceb-maroon,#813405)]" />
                      Material Master
                    </h3>
                    <p className="text-[13px] text-gray-500 font-medium mt-1">
                      Top Material Items Stock Breakdown (Breakdown by connection category style)
                    </p>
                  </div>
                </div>

                {materialLoading ? (
                  <div className="h-64 flex items-center justify-center">
                    <RefreshCw className="w-6 h-6 animate-spin text-[color:var(--ceb-maroon,#813405)]" />
                  </div>
                ) : materialPieChartItems.length > 0 ? (
                  <div className="flex flex-col md:flex-row items-center justify-around gap-8 py-4">
                    {/* SVG Donut Chart with center total callout & slice hover callout */}
                    <div className="relative w-56 h-56 flex-shrink-0 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 200 200">
                        <circle cx="100" cy="100" r="80" fill="none" stroke="#f3f4f6" strokeWidth="30" />
                        {(() => {
                          let currentOffset = 0;
                          return materialPieChartItems.map((item, i) => {
                            const isActive = activeMaterialPieIndex === i;
                            const isAnyActive = activeMaterialPieIndex !== null;
                            const color = SOLAR_NET_TYPE_COLORS[i % SOLAR_NET_TYPE_COLORS.length];
                            const strokeDash = `${(item.pct / 100) * C} ${C}`;
                            const strokeOff = -((currentOffset / 100) * C);
                            currentOffset += item.pct;

                            return (
                              <circle
                                key={item.matCd}
                                cx="100"
                                cy="100"
                                r="80"
                                fill="none"
                                stroke={color}
                                strokeDasharray={strokeDash}
                                strokeDashoffset={strokeOff}
                                className="transition-all duration-300 cursor-pointer"
                                style={{
                                  strokeWidth: isActive ? 36 : 30,
                                  opacity: isAnyActive && !isActive ? 0.3 : 1,
                                }}
                                onMouseEnter={() => setActiveMaterialPieIndex(i)}
                                onMouseLeave={() => setActiveMaterialPieIndex(null)}
                              />
                            );
                          });
                        })()}
                      </svg>

                      {/* Center Callout Overlay */}
                      {activeMaterialPieIndex !== null && materialPieChartItems[activeMaterialPieIndex] ? (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="bg-gray-900 text-white px-3.5 py-2.5 rounded-xl text-center shadow-xl border border-gray-700/60 max-w-[170px]">
                            <p className="text-[11px] font-semibold truncate text-gray-200">
                              {materialPieChartItems[activeMaterialPieIndex].matCd}
                            </p>
                            <p className="text-xs font-extrabold mt-0.5 text-white font-mono">
                              LKR {materialPieChartItems[activeMaterialPieIndex].stockValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                            <p className="text-[11px] text-emerald-400 font-mono mt-0.5">
                              {materialPieChartItems[activeMaterialPieIndex].pct.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="text-center px-2">
                            <p className="text-xs font-black text-gray-900 font-mono">
                              LKR {totalMaterialDonutStockValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">Total Stock Value</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Donut Legend List */}
                    <div className="space-y-2.5 w-full max-w-md">
                      {materialPieChartItems.map((item, i) => {
                        const isActive = activeMaterialPieIndex === i;
                        const color = SOLAR_NET_TYPE_COLORS[i % SOLAR_NET_TYPE_COLORS.length];
                        return (
                          <div
                            key={item.matCd}
                            onMouseEnter={() => setActiveMaterialPieIndex(i)}
                            onMouseLeave={() => setActiveMaterialPieIndex(null)}
                            className={`flex items-center justify-between p-2.5 rounded-xl transition-all duration-300 cursor-pointer ${
                              isActive
                                ? "bg-slate-100 ring-1 ring-slate-300 scale-[1.02] shadow-xs"
                                : "hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span
                                className="w-3.5 h-3.5 rounded-full flex-shrink-0 shadow-2xs"
                                style={{ backgroundColor: color }}
                              />
                              <div className="truncate">
                                <span className="text-xs font-bold text-slate-800 font-mono mr-2">{item.matCd}</span>
                                <span className="text-xs text-slate-600 truncate font-medium">{item.matNm}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                              <span className="text-xs font-extrabold text-slate-900 font-mono">
                                LKR {item.stockValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-bold text-slate-600 font-mono">
                                {item.pct.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-xs text-slate-400 font-medium">
                    No material stock breakdown available
                  </div>
                )}
              </div>
            </Reveal>

            {/* SECTION 4 — CONSTRUCTION PROGRESS MONITORING */}
            <Reveal delay={200}>
              <div className="bg-white rounded-[24px] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] border border-slate-200/80 p-6 hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.06)] transition-all duration-300 w-full">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-6">
                  <div className="flex items-center gap-3.5">
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                      <BarChart3 className="w-6 h-6 text-emerald-600 animate-pulse" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-slate-900 tracking-tight">Area Job Progress Monitoring</h2>
                      <p className="text-xs text-slate-400 font-semibold mt-0.5">
                        Applications submitted vs Connections given / Job closed by Area ({selectedCompanyId} - {selectedYear})
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative">
                      <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input
                        type="text"
                        placeholder="Search Area / Dept..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-3.5 py-2 w-44 text-xs font-semibold rounded-2xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-[color:var(--ceb-maroon,#813405)]/10 focus:border-[color:var(--ceb-maroon,#813405)] transition-all bg-slate-50/50"
                      />
                    </div>

                    <div className="flex items-center gap-1.5 relative">
                      <Calendar className="absolute left-2.5 text-slate-400 w-3.5 h-3.5 pointer-events-none" />
                      <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="pl-8 pr-8 py-2 text-xs font-bold bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-[color:var(--ceb-maroon,#813405)]/10 text-slate-700 appearance-none cursor-pointer"
                      >
                        {[2026, 2025, 2024, 2023, 2022, 2021, 2020].map((yr) => (
                          <option key={yr} value={yr}>
                            {yr}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2.5 text-slate-400 w-3.5 h-3.5 pointer-events-none" />
                    </div>

                    <div className="flex items-center gap-1.5 relative">
                      <ArrowUpDown className="absolute left-2.5 text-slate-400 w-3.5 h-3.5 pointer-events-none" />
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as "name" | "apps-desc" | "conns-desc" | "pending-desc")}
                        className="pl-8 pr-8 py-2 text-xs font-bold bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-[color:var(--ceb-maroon,#813405)]/10 text-slate-700 appearance-none cursor-pointer"
                      >
                        <option value="name">Sort: Dept Code</option>
                        <option value="apps-desc">Sort: Applications (High-Low)</option>
                        <option value="conns-desc">Sort: Connections Given / Job Closed (High-Low)</option>
                        <option value="pending-desc">Sort: Pending (High-Low)</option>
                      </select>
                      <ChevronDown className="absolute right-2.5 text-slate-400 w-3.5 h-3.5 pointer-events-none" />
                    </div>

                    <div className="flex items-center bg-slate-100 rounded-2xl p-0.5 border border-slate-200/40">
                      <button
                        onClick={() => setViewMode("chart")}
                        className={`p-1.5 rounded-xl transition ${viewMode === "chart" ? "bg-white text-[color:var(--ceb-maroon,#813405)] shadow-xs" : "text-slate-500"}`}
                        title="Chart View"
                      >
                        <BarChart3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setViewMode("table")}
                        className={`p-1.5 rounded-xl transition ${viewMode === "table" ? "bg-white text-[color:var(--ceb-maroon,#813405)] shadow-xs" : "text-slate-500"}`}
                        title="Table View"
                      >
                        <Table className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setViewMode("pending")}
                        className={`p-1.5 rounded-xl transition ${viewMode === "pending" ? "bg-white text-[color:var(--ceb-maroon,#813405)] shadow-xs" : "text-slate-500"}`}
                        title="Pending List"
                      >
                        <Activity className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {viewMode === "chart" && (
                  <div className="h-96 w-full">
                    {loading ? (
                      <div className="h-full flex items-center justify-center">
                        <RefreshCw className="w-6 h-6 animate-spin text-[color:var(--ceb-maroon,#813405)]" />
                      </div>
                    ) : sortedApplicationData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={sortedApplicationData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b", fontWeight: 600 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                          <Tooltip content={<ConstructionTooltip />} cursor={{ fill: "rgba(0,0,0,0.02)" }} />
                          <Legend
                            content={() => (
                              <div className="flex items-center justify-center gap-8 pt-3 pb-1">
                                <div className="relative group/apps cursor-pointer">
                                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-amber-50 transition-colors duration-200">
                                    <span className="w-3 h-3 rounded-full bg-[#813405] ring-2 ring-[#813405]/20" />
                                    <span className="text-[11px] font-bold text-slate-700">Applications Submitted</span>
                                  </div>
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 pointer-events-none group-hover/apps:opacity-100 group-hover/apps:pointer-events-auto transition-all duration-300 z-50">
                                    <div className="bg-white border border-slate-200 shadow-xl rounded-xl p-3 min-w-[200px]">
                                      <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2 border-b border-slate-100 pb-1.5">Color Meanings — Applications</p>
                                      <div className="space-y-1.5">
                                        {appTypesList.map((type, index) => (
                                          <div key={type} className="flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: appColors[index % appColors.length] }} />
                                            <span className="text-[10px] font-semibold text-slate-600 truncate">{type.replace(" (App)", "")}</span>
                                          </div>
                                        ))}
                                      </div>
                                      <div className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-3 h-3 bg-white border-r border-b border-slate-200 rotate-45" />
                                    </div>
                                  </div>
                                </div>

                                <div className="relative group/conns cursor-pointer">
                                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors duration-200">
                                    <span className="w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
                                    <span className="text-[11px] font-bold text-slate-700">Connections Given / Job Closed</span>
                                  </div>
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 pointer-events-none group-hover/conns:opacity-100 group-hover/conns:pointer-events-auto transition-all duration-300 z-50">
                                    <div className="bg-white border border-slate-200 shadow-xl rounded-xl p-3 min-w-[200px]">
                                      <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2 border-b border-slate-100 pb-1.5">Color Meanings — Connections</p>
                                      <div className="space-y-1.5">
                                        {connTypesList.map((type, index) => (
                                          <div key={type} className="flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: connColors[index % connColors.length] }} />
                                            <span className="text-[10px] font-semibold text-slate-600 truncate">{type.replace(" (Conn)", "")}</span>
                                          </div>
                                        ))}
                                      </div>
                                      <div className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-3 h-3 bg-white border-r border-b border-slate-200 rotate-45" />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          />
                          {appTypesList.map((type, index) => (
                            <Bar
                              key={type}
                              dataKey={type}
                              stackId="apps"
                              fill={appColors[index % appColors.length]}
                              maxBarSize={16}
                              radius={index === appTypesList.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                              legendType="none"
                              isAnimationActive
                              animationDuration={800}
                            />
                          ))}
                          {connTypesList.map((type, index) => (
                            <Bar
                              key={type}
                              dataKey={type}
                              stackId="conns"
                              fill={connColors[index % connColors.length]}
                              maxBarSize={16}
                              radius={index === connTypesList.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                              legendType="none"
                              isAnimationActive
                              animationDuration={800}
                            />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-slate-400 font-medium">
                        No construction application data available for the selected year and Area
                      </div>
                    )}
                  </div>
                )}

                {viewMode === "table" && (
                  <div className="border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
                    <div className="max-h-96 overflow-y-auto">
                      <table className="w-full text-left text-xs font-sans">
                        <thead className="bg-slate-800 text-slate-100 sticky top-0 font-bold uppercase tracking-wider text-[10px]">
                          <tr>
                            <th className="px-4 py-3">Area / Dept ID</th>
                            <th className="px-4 py-3 text-center">Applied</th>
                            <th className="px-4 py-3 text-center">Connections Given / Job Closed</th>
                            <th className="px-4 py-3 text-center">Pending</th>
                            <th className="px-4 py-3 text-right">Completion Rate</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                          {sortedApplicationData.map((row) => (
                            <tr key={row.name} className="hover:bg-slate-50 font-medium">
                              <td className="px-4 py-2.5 font-bold font-mono text-slate-900">{row.name}</td>
                              <td className="px-4 py-2.5 text-center font-bold font-mono text-[#813405]">{row.totalApps}</td>
                              <td className="px-4 py-2.5 text-center font-bold font-mono text-emerald-600">{row.totalConns}</td>
                              <td className="px-4 py-2.5 text-center font-bold font-mono text-red-600">{row.pending}</td>
                              <td className="px-4 py-2.5 text-right font-bold font-mono text-blue-600">
                                {row.completionRate.toFixed(1)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {viewMode === "pending" && (
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {Object.keys(groupedPendingApplications).length > 0 ? (
                      Object.entries(groupedPendingApplications).map(([deptId, apps]) => {
                        const isExpanded = expandedPendingDepts[deptId];
                        return (
                          <div key={deptId} className="border border-slate-200/80 rounded-2xl overflow-hidden bg-white shadow-sm">
                            <button
                              onClick={() => togglePendingDeptExpand(deptId)}
                              className="w-full px-4 py-3 bg-slate-50 flex items-center justify-between text-xs font-bold text-slate-800 hover:bg-slate-100 transition"
                            >
                              <span className="font-mono text-sm text-[color:var(--ceb-maroon,#813405)]">
                                Area/Dept: {deptId} ({apps.length} Pending Applications)
                              </span>
                              {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                            </button>
                            {isExpanded && (
                              <div className="p-4 space-y-2 border-t border-slate-100">
                                {apps.map((app, i) => (
                                  <div key={i} className="flex justify-between items-center text-xs p-2 bg-slate-50/70 rounded-xl border border-slate-100">
                                    <div>
                                      <span className="font-bold text-slate-800 font-mono">{app.applicationNo}</span>
                                      <span className="text-slate-500 ml-2 font-medium">({app.description})</span>
                                    </div>
                                    <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-lg text-[10px] font-bold">Pending</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-8 text-xs text-slate-400 font-medium">
                        No pending applications found
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AreaEngineerDashboardPage;
