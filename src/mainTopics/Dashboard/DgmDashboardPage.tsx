import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  RefreshCw,
  Package,
  BarChart3,
  Table,
  Search,
  ArrowUpDown,
  Info,
  ChevronDown,
  ChevronUp,
  Calendar,
  Building,
  Activity,
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
  Legend,

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

// Custom Tooltip component for side-by-side grouped details
const CustomTooltip = ({ active, payload, label }: any) => {
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
            Dept: {label}
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
                    <span>Given: {connVal}</span>
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

const DgmDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const activeDashboard = "dgm";
  const { user } = useUser();
  const epfNo = user?.Userno || "";

  const [pivTotal, setPivTotal] = useState<{ date: string; amount: number }[]>([]);
  const [stockValue, setStockValue] = useState<number | null>(null);
  const [appCounts, setAppCounts] = useState<{ deptId: string; description: string; appType: string; noOfApplications: number }[]>([]);
  const [connectionsGiven, setConnectionsGiven] = useState<{ deptId: string; description: string; appType: string; noOfConnections: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [fetchCount, setFetchCount] = useState(0);

  // Year and Company Selection States (Defaulting to 2026)
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [companies, setCompanies] = useState<{ compId: string; compName: string }[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("WPN");

  // Custom Date Period PIV Collection States (Defaulting to past 30 days)
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
  const [customPivError, setCustomPivError] = useState<string | null>(null);

  // UX Interactive States
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "apps-desc" | "conns-desc" | "pending-desc">("name");
  const [viewMode, setViewMode] = useState<"chart" | "table">("chart");
  const [expandedDepts, setExpandedDepts] = useState<Record<string, boolean>>({});

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

  // Fetch authorized companies list on mount
  useEffect(() => {
    const fetchCompanies = async () => {
      if (!epfNo) return;
      try {
        const res = await fetch(`/misapi/api/incomeexpenditure/Usercompanies/${epfNo}/60`);
        if (!res.ok) throw new Error("Failed to fetch companies");
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
          // Set initial selected company to WPN if it is available, otherwise the first in the list
          const hasWPN = final.some(c => c.compId.toUpperCase() === "WPN");
          setSelectedCompanyId(hasWPN ? "WPN" : final[0].compId);
        } else {
          setCompanies([{ compId: "WPN", compName: "WPN" }]);
          setSelectedCompanyId("WPN");
        }
      } catch (err) {
        console.error("Failed to load authorized companies:", err);
        setCompanies([{ compId: "WPN", compName: "WPN" }]);
        setSelectedCompanyId("WPN");
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
        const [r1, r2, r3, r4] = await Promise.all([
          fetch(`/misapi/api/dgm/piv-total${queryBase}`, {
            headers: { Accept: "application/json" },
          }),
          fetch(`/misapi/api/dgm/stock-value${queryBase}`, {
            headers: { Accept: "application/json" },
          }),
          fetch(`/misapi/api/dgm/application-count${queryAppConn}`, {
            headers: { Accept: "application/json" },
          }),
          fetch(`/misapi/api/dgm/connections-given${queryAppConn}`, {
            headers: { Accept: "application/json" },
          }),
        ]);
        if (!r1.ok || !r2.ok || !r3.ok || !r4.ok) {
          throw new Error("Failed to fetch DGM dashboard data");
        }
        const [pivData, stockData, appData, connData] = await Promise.all([
          r1.json(),
          r2.json(),
          r3.json(),
          r4.json(),
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

        // Track latest FetchedAt
        const latestTime = new Date(Math.max(
          new Date(getAt(pivData) || 0).getTime(),
          new Date(getAt(stockData) || 0).getTime(),
          new Date(getAt(appData) || 0).getTime(),
          new Date(getAt(connData) || 0).getTime()
        ));
        setLastUpdated(latestTime.getTime() > 0 ? latestTime.toLocaleTimeString() : null);
      } catch (err: any) {
        setError(err.message || "Failed to load DGM dashboard data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [fetchCount, selectedYear, selectedCompanyId]);

  // Separate independent useEffect to fetch PIV range collections on demand
  useEffect(() => {
    const fetchCustomPivData = async () => {
      if (!selectedCompanyId) return;
      setCustomPivLoading(true);
      setCustomPivError(null);
      try {
        const queryBase = `?companyId=${selectedCompanyId}&startDate=${customPivStart}&endDate=${customPivEnd}${fetchCount > 0 ? "&refresh=true" : ""}`;
        const res = await fetch(`/misapi/api/dgm/piv-period-summary${queryBase}`, {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error("Failed to fetch custom PIV collections");
        const data = await res.json();

        const getVal = (obj: any) => obj?.Value ?? obj?.value;
        const valObj = getVal(data) || data;
        const sum = typeof valObj?.pivCollection === "number" ? valObj.pivCollection : 0;
        setCustomPivTotalAmount(sum);
      } catch (err: any) {
        console.error("Custom PIV fetch error:", err);
        setCustomPivError(err.message || "Failed to load custom PIV data");
        setCustomPivTotalAmount(0);
      } finally {
        setCustomPivLoading(false);
      }
    };
    fetchCustomPivData();
  }, [fetchCount, selectedCompanyId, customPivStart, customPivEnd]);

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

  // Unified data processing: Group both apps & connections given side-by-side
  const applicationChartData = useMemo(() => {
    const deptMap: Record<string, { name: string; totalApps: number; totalConns: number; completionRate: number;[key: string]: any }> = {};

    // 1. Group Applications Submitted
    appCounts.forEach((item) => {
      const deptKey = item.deptId || "Other";
      if (!deptMap[deptKey]) {
        deptMap[deptKey] = { name: deptKey, totalApps: 0, totalConns: 0, completionRate: 0 };
      }
      const typeLabel = item.description || "Unknown Type";
      const key = `${typeLabel} (App)`;
      deptMap[deptKey][key] = (deptMap[deptKey][key] || 0) + item.noOfApplications;
      deptMap[deptKey].totalApps += item.noOfApplications;
    });

    // 2. Group Connections Given
    connectionsGiven.forEach((item) => {
      const deptKey = item.deptId || "Other";
      if (!deptMap[deptKey]) {
        deptMap[deptKey] = { name: deptKey, totalApps: 0, totalConns: 0, completionRate: 0 };
      }
      const typeLabel = item.description || "Unknown Type";
      const key = `${typeLabel} (Conn)`;
      deptMap[deptKey][key] = (deptMap[deptKey][key] || 0) + item.noOfConnections;
      deptMap[deptKey].totalConns += item.noOfConnections;
    });

    // 3. Compute Completion Rate & Pending
    Object.values(deptMap).forEach((dept) => {
      dept.completionRate = dept.totalApps > 0 ? (dept.totalConns / dept.totalApps) * 100 : 0;
      dept.pending = Math.max(0, dept.totalApps - dept.totalConns);
    });

    return Object.values(deptMap);
  }, [appCounts, connectionsGiven]);

  // Filter based on Search Term
  const filteredApplicationData = useMemo(() => {
    if (!searchTerm.trim()) return applicationChartData;
    const term = searchTerm.toLowerCase().trim();
    return applicationChartData.filter((item) => item.name.toLowerCase().includes(term));
  }, [applicationChartData, searchTerm]);

  // Sort based on Sort option selected
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

  // Extract unique types for Recharts mapping (Warm palette for apps, Cool palette for connections)
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

  // Combined unique clean types list for table breakdown rendering
  const allCleanTypes = useMemo(() => {
    const set = new Set<string>();
    appCounts.forEach(it => { if (it.description) set.add(it.description); });
    connectionsGiven.forEach(it => { if (it.description) set.add(it.description); });
    return Array.from(set).sort();
  }, [appCounts, connectionsGiven]);

  const toggleDeptExpand = (name: string) => {
    setExpandedDepts((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  // Dynamic color palettes
  const appColors = ["#813405", "#d45113", "#f9a03f", "#f8dda4", "#a04006", "#bd5008"];
  const connColors = ["#10b981", "#059669", "#06b6d4", "#3b82f6", "#6366f1", "#4f46e5"];

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="flex">
        <DashboardSelector
          activeDashboard={activeDashboard}
          onSelectDashboard={(dashboard) => navigate(`/dashboard/${dashboard}`)}
        />
        <div className="flex-1 min-w-0">
          <DashboardHeader title="Construction Progress Dashboard" />

          {/* Action / Refresh Bar (Glassmorphic) */}
          <div className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-20 shadow-sm">
            <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-[color:var(--ceb-maroon,#813405)]/80" />
                  {companies.find(c => c.compId === selectedCompanyId)?.compName || selectedCompanyId}
                </span>

                {/* Global Company Selector */}
                {companies.length > 0 && (
                  <div className="relative" ref={companyDropdownRef}>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCompanyDropdownOpen(!isCompanyDropdownOpen);
                        setCompanySearchQuery("");
                      }}
                      className="px-3.5 py-2 w-56 text-left text-xs font-bold bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-[color:var(--ceb-maroon,#813405)]/10 text-slate-700 flex items-center justify-between shadow-sm hover:bg-slate-50 transition-all"
                    >
                      <span className="truncate flex items-center gap-2">
                        <Building className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        {selectedCompanyId} - {companies.find(c => c.compId === selectedCompanyId)?.compName || ""}
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 ml-1 flex-shrink-0 text-slate-400" />
                    </button>

                    {isCompanyDropdownOpen && (
                      <div className="absolute left-0 mt-2 w-72 bg-white border border-slate-200/80 rounded-2xl shadow-xl z-50 p-2.5 space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                          <input
                            type="text"
                            value={companySearchQuery}
                            onChange={(e) => setCompanySearchQuery(e.target.value)}
                            placeholder="Search company..."
                            className="w-full pl-8 pr-2.5 py-2 text-xs border border-slate-100 rounded-xl focus:outline-none focus:ring-4 focus:ring-[color:var(--ceb-maroon,#813405)]/10 bg-slate-50/50 font-medium"
                            autoFocus
                          />
                        </div>
                        <div className="max-h-48 overflow-y-auto divide-y divide-slate-50 pr-1 scrollbar-thin">
                          {filteredCompanies.length === 0 ? (
                            <div className="text-[10px] text-slate-400 p-2.5 text-center font-bold">
                              No companies found
                            </div>
                          ) : (
                            filteredCompanies.map((c) => (
                              <button
                                key={c.compId}
                                type="button"
                                onClick={() => {
                                  setSelectedCompanyId(c.compId);
                                  setIsCompanyDropdownOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2.5 text-[11px] font-bold transition-colors hover:bg-slate-50 block truncate ${selectedCompanyId === c.compId
                                  ? "text-[color:var(--ceb-maroon,#813405)] bg-[color:var(--ceb-maroon,#813405)]/5"
                                  : "text-slate-600"
                                  }`}
                              >
                                <span className="font-mono">{c.compId}</span> - {c.compName}
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                {lastUpdated && (
                  <span className="text-xs text-slate-500 bg-slate-100/80 border border-slate-200/60 rounded-xl px-3.5 py-2 font-semibold">
                    Updated: {lastUpdated}
                  </span>
                )}
                <button
                  onClick={() => setFetchCount((c) => c + 1)}
                  disabled={loading}
                  className="flex items-center justify-center gap-2 text-sm font-semibold text-white bg-[color:var(--ceb-maroon,#813405)] hover:bg-opacity-95 hover:shadow-md active:scale-95 rounded-xl px-4 py-2 transition-all duration-200 shadow-sm disabled:opacity-50 disabled:pointer-events-none"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          <div className="p-6 max-w-7xl mx-auto space-y-6">
            {error && (
              <div className="flex items-center gap-3 p-4 bg-red-50/70 border border-red-200/80 rounded-2xl text-sm text-red-700 shadow-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600" />
                <span>
                  <strong>Error:</strong> {error} — check that the backend service is active.
                </span>
              </div>
            )}

            {/* Top Row Widgets */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch mb-12">

              {/* Left Column: Stacked Stock Value & PIV Period Summary */}
              <div className="lg:col-span-1 flex flex-col gap-6 h-full">
                {/* Stock Value Widget Card (Premium Light Theme) */}
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
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">NEW items</p>
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

                {/* Custom PIV Period Lookup Card */}
                <Reveal delay={50} className="flex-1">
                  <div className="bg-gradient-to-br from-white via-white to-amber-50/15 rounded-3xl p-6 shadow-sm border border-slate-200/60 hover:border-amber-400/25 hover:shadow-lg hover:shadow-amber-500/5 transform hover:-translate-y-1 transition-all duration-300 relative overflow-hidden h-full flex flex-col justify-between min-h-[220px] group">
                    <div className="absolute top-0 right-0 w-36 h-36 bg-amber-500/5 rounded-full blur-3xl group-hover:bg-amber-500/10 transition-all duration-500 pointer-events-none" />

                    <div>
                      {/* Card Header */}
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-amber-50 border border-amber-100 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                          <Calendar className="w-6 h-6 text-amber-600" />
                        </div>
                        <div>
                          <h2 className="text-base font-extrabold text-slate-800">PIV Period Summary</h2>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Custom Date range</p>
                        </div>
                      </div>

                      {/* Date Inputs Form */}
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

                      {/* Calculation Value Display */}
                      {customPivLoading ? (
                        <div className="my-5 space-y-3">
                          <div className="h-8 w-44 bg-slate-100 rounded-xl animate-pulse" />
                          <div className="h-3 w-32 bg-slate-100 rounded-xl animate-pulse" />
                        </div>
                      ) : customPivError ? (
                        <div className="my-5 text-[11px] text-red-500 font-bold bg-red-50/50 p-3 border border-red-100 rounded-xl">
                          {customPivError}
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

              {/* Right Column: Daily PIV Breakdown (Taking 2 columns and full height) */}
              <Reveal delay={100} className="lg:col-span-2 h-full">
                <div className="bg-gradient-to-br from-white via-white to-orange-50/10 rounded-3xl p-6 shadow-sm border border-slate-200/60 hover:border-orange-400/25 hover:shadow-lg hover:shadow-orange-500/5 transform hover:-translate-y-1 transition-all duration-300 relative overflow-hidden h-full flex flex-col justify-between min-h-[460px] group">
                  <div className="absolute top-0 right-0 w-36 h-36 bg-orange-500/5 rounded-full blur-3xl group-hover:bg-orange-500/10 transition-all duration-500 pointer-events-none" />

                  <div className="flex flex-col h-full justify-between gap-4">
                    {/* Header Controls */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-orange-50 border border-orange-100 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                          <Activity className="w-5 h-5 text-orange-600 animate-pulse" />
                        </div>
                        <div>
                          <h3 className="text-base font-extrabold text-slate-800">
                            Daily PIV Breakdown
                          </h3>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Collections status</p>
                        </div>
                      </div>
                    </div>

                    {/* 30-Day Sum Stats Block */}
                    {!loading && breakdownData.length > 0 && (
                      <div className="bg-gradient-to-r from-orange-50/50 to-amber-50/30 border border-orange-100/50 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm">
                        <div>
                          <span className="text-[9px] font-black text-orange-800/80 uppercase tracking-widest">Total 30-Day Collections</span>
                          <p className="text-2xl font-black text-slate-800 tracking-tight mt-1 flex items-baseline gap-1.5">
                            <span className="text-xs font-bold text-slate-400">LKR</span>
                            {total30DayCollection.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div className="text-right">

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

                        {/* Clean Scrollable List View of progress bars in a 2-column grid */}
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
                                    {/* Calendar-style badge */}
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
            </div>            {/* Bottom Row - Connection applications & Completed Connections Given (Merged) */}
            <Reveal delay={200}>
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/60 hover:shadow-lg transition-all duration-300 w-full">

                {/* Header Controls */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-6">
                  <div className="flex items-center gap-3.5">
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                      <BarChart3 className="w-6 h-6 text-emerald-600 animate-pulse" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-slate-900 tracking-tight">Construction Progress Monitoring</h2>
                      <p className="text-xs text-slate-400 font-semibold mt-0.5">
                        Side-by-side comparison of Applications Submitted vs Connections Given ({selectedCompanyId} - {selectedYear})
                      </p>
                    </div>
                  </div>

                  {/* Interactivity Bar */}
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Search Field */}
                    <div className="relative">
                      <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search Dept ID..."
                        className="pl-10 pr-3.5 py-2 w-44 text-xs font-semibold rounded-2xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-[color:var(--ceb-maroon,#813405)]/10 focus:border-[color:var(--ceb-maroon,#813405)] transition-all bg-slate-50/50"
                      />
                    </div>


                    {/* Year Selector */}
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

                    {/* Sort Selector */}
                    <div className="flex items-center gap-1.5 relative">
                      <ArrowUpDown className="absolute left-2.5 text-slate-400 w-3.5 h-3.5 pointer-events-none" />
                      <select
                        value={sortBy}
                        onChange={(e: any) => setSortBy(e.target.value)}
                        className="pl-8 pr-8 py-2 text-xs font-bold bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-[color:var(--ceb-maroon,#813405)]/10 text-slate-700 appearance-none cursor-pointer animate-none"
                      >
                        <option value="name">Sort: Dept Code</option>
                        <option value="apps-desc">Sort: Applications (High-Low)</option>
                        <option value="conns-desc">Sort: Connections Given (High-Low)</option>
                        <option value="pending-desc">Sort: Pending (High-Low)</option>
                      </select>
                      <ChevronDown className="absolute right-2.5 text-slate-400 w-3.5 h-3.5 pointer-events-none" />
                    </div>

                    {/* View Switcher Toggles (Chart vs Table) */}
                    <div className="flex items-center bg-slate-100 rounded-2xl p-0.5 border border-slate-200/40">
                      <button
                        onClick={() => setViewMode("chart")}
                        className={`p-2 rounded-xl transition-all ${viewMode === "chart" ? "bg-white text-[color:var(--ceb-maroon,#813405)] shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                        title="Chart View"
                      >
                        <BarChart3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setViewMode("table")}
                        className={`p-2 rounded-xl transition-all ${viewMode === "table" ? "bg-white text-[color:var(--ceb-maroon,#813405)] shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                        title="Table View"
                      >
                        <Table className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Main Content Area (Chart or Table) */}
                {loading ? (
                  <div className="h-80 w-full bg-slate-50 rounded-2xl animate-pulse flex items-center justify-center">
                    <span className="text-sm font-semibold text-slate-400 animate-bounce">Loading data...</span>
                  </div>
                ) : sortedApplicationData.length === 0 ? (
                  <div className="h-80 flex flex-col items-center justify-center text-slate-400 gap-2">
                    <BarChart3 className="w-10 h-10 opacity-20" />
                    <span className="text-sm font-bold">No records match search criteria</span>
                  </div>
                ) : viewMode === "chart" ? (
                  /* Combined Side-by-Side Stacked Bar Chart */
                  <div className="h-96 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sortedApplicationData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b", fontWeight: 600 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />

                        {/* Custom Tooltip mapping cleaner name format */}
                        <Tooltip
                          content={<CustomTooltip />}
                          cursor={{ fill: "rgba(0,0,0,0.02)" }}
                        />

                        {/* Interactive Legend with color-meaning tooltips on hover */}
                        <Legend
                          content={() => (
                            <div className="flex items-center justify-center gap-8 pt-3 pb-1">
                              {/* Applications Submitted legend item */}
                              <div className="relative group/apps cursor-pointer">
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-amber-50 transition-colors duration-200">
                                  <span className="w-3 h-3 rounded-full bg-[#813405] ring-2 ring-[#813405]/20" />
                                  <span className="text-[11px] font-bold text-slate-700">Applications Submitted</span>
                                </div>
                                {/* Tooltip popup */}
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

                              {/* Connections Given legend item */}
                              <div className="relative group/conns cursor-pointer">
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors duration-200">
                                  <span className="w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
                                  <span className="text-[11px] font-bold text-slate-700">Connections Given</span>
                                </div>
                                {/* Tooltip popup */}
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

                        {/* Stacking applications (Warm colors, stack apps) */}
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

                        {/* Stacking connections given (Cool colors, stack conns) */}
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
                  </div>
                ) : (
                  /* Custom Performance Table with Expandable side-by-side comparable type breakdowns */
                  <div className="overflow-x-auto rounded-2xl border border-slate-200/80 shadow-sm max-h-[460px] overflow-y-auto pr-1">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider sticky top-0 border-b border-slate-200 z-10">
                        <tr>
                          <th className="px-6 py-4 bg-slate-50 w-12"></th>
                          <th className="px-6 py-4">Dept / Cost Center</th>
                          <th className="px-6 py-4 text-right">Total Applications</th>
                          <th className="px-6 py-4 text-right">Total Connections Given</th>
                          <th className="px-6 py-4 text-right text-red-600/90 font-extrabold">Pending Connections</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sortedApplicationData.map((row, i) => {
                          const isExpanded = !!expandedDepts[row.name];

                          return (
                            <React.Fragment key={row.name}>
                              <tr
                                onClick={() => toggleDeptExpand(row.name)}
                                className={`cursor-pointer hover:bg-slate-50/80 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-slate-50/10"}`}
                              >
                                <td className="px-6 py-3.5 text-center text-slate-400">
                                  {isExpanded ? <ChevronUp className="w-4 h-4 text-[color:var(--ceb-maroon,#813405)] font-bold" /> : <ChevronDown className="w-4 h-4" />}
                                </td>
                                <td className="px-6 py-3.5 font-extrabold text-slate-800 font-mono tracking-tight text-sm">{row.name}</td>
                                <td className="px-6 py-3.5 text-right font-bold text-slate-700 font-mono">
                                  {row.totalApps}
                                </td>
                                <td className="px-6 py-3.5 text-right font-bold text-emerald-600 font-mono">
                                  {row.totalConns}
                                </td>
                                <td className="px-6 py-3.5 text-right font-mono">
                                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold inline-block ${row.pending > 0
                                    ? "bg-red-50 text-red-600 border border-red-100"
                                    : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                                    }`}>
                                    {row.pending}
                                  </span>
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr className="bg-slate-50/30">
                                  <td colSpan={5} className="px-6 sm:px-12 py-4 border-t border-b border-slate-200/50">
                                    <div className="max-w-3xl bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-3.5">
                                      <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <Info className="w-4 h-4 text-indigo-500" />
                                        Comparable Type Breakdowns for {row.name}
                                      </p>
                                      <div className="overflow-x-auto rounded-xl border border-slate-100">
                                        <table className="w-full text-left text-xs text-slate-700">
                                          <thead className="bg-slate-50/80 text-[9px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                            <tr>
                                              <th className="px-4 py-3">Connection Type</th>
                                              <th className="px-4 py-3 text-right">Applications Submitted</th>
                                              <th className="px-4 py-3 text-right">Connections Given</th>
                                              <th className="px-4 py-3 text-right text-red-600/90 font-extrabold">Pending</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-100">
                                            {allCleanTypes.map((type) => {
                                              const appKey = `${type} (App)`;
                                              const connKey = `${type} (Conn)`;
                                              const typeApps = row[appKey] || 0;
                                              const typeConns = row[connKey] || 0;

                                              if (typeApps === 0 && typeConns === 0) return null;

                                              const typePending = Math.max(0, typeApps - typeConns);

                                              return (
                                                <tr key={type} className="hover:bg-slate-50/50 transition-colors">
                                                  <td className="px-4 py-2.5 font-bold text-slate-700">{type}</td>
                                                  <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-600">{typeApps}</td>
                                                  <td className="px-4 py-2.5 text-right font-mono font-semibold text-emerald-600">{typeConns}</td>
                                                  <td className="px-4 py-2.5 text-right font-mono">
                                                    <span className={typePending > 0 ? "font-bold text-red-600" : "font-semibold text-slate-400"}>
                                                      {typePending}
                                                    </span>
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
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

export default DgmDashboardPage;
