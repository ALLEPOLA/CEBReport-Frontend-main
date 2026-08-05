import React, { useEffect, useState, useRef } from "react";
import { useUser } from "../../contexts/UserContext";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Zap,
  DollarSign,
  PieChart,
  Sun,
  Battery,
  Eye,
  EyeOff,
  X,
  ShieldAlert,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
  AreaChart,
  Area,
} from "recharts";
import DashboardSelector from "../../components/mainTopics/Dashboard/DashboardSelector";
import KpiCard from "../../components/mainTopics/Dashboard/KpiCard";
import DashboardHeader from "../../components/mainTopics/Dashboard/DashboardHeader";
import TopCustomersList, { TopCustomerItem } from "../../components/mainTopics/Dashboard/TopCustomersList";

const SOLAR_ORDINARY_COLOR = "#0f4c81";
const SOLAR_BULK_COLOR = "#f59e0b";
const SOLAR_NET_TYPE_COLORS = [
  "#813405",
  "#d45113   ",
  "#f9a03f   ",
  "#f8dda4   ",
];

// CEB customer-details theme (used in Customer Information / Billing form)
const CEB_MAROON_VAR = "var(--ceb-maroon)"; // defined in index.css
const CEB_MAROON_TEXT = `text-[${CEB_MAROON_VAR}]`;
const CEB_MAROON_BG = `bg-[${CEB_MAROON_VAR}]/10`;

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface CustomerCounts {
  ordinary: number;
  bulk: number;
  solar: {
    netMetering: number;
    netAccounting: number;
    netPlus: number;
    netPlusPlus: number;
  };
  zeroConsumption: number;
}

interface MonthlySalesData {
  month: string;
  ordinary: number;
  bulk: number;
}

interface SalesCollectionRecord {
  Date: string;
  Amount: number;
  ErrorMessage: string;
}

interface SalesCollectionApiResponse {
  data: {
    records: SalesCollectionRecord[];
  } | null;
  errorMessage: string | null;
  errorDetails?: string;
}

interface KioskCollectionRecord {
  TransDate: string;
  CollectionAmount: number;
  ErrorMessage: string;
}

interface KioskCollectionApiResponse {
  data: {
    userId: string;
    fromDate: string;
    toDate: string;
    records: KioskCollectionRecord[];
  } | null;
  errorMessage: string | null;
  errorDetails?: string;
}

interface SolarGenerationCapacityApiRecord {
  NetType?: string;
  AccountsCount?: number;
  CapacityKw?: number;
  netType?: string;
  accountsCount?: number;
  capacityKw?: number;
}

interface SolarGenerationCapacityApiData {
  SelectedBillCycle?: string;
  AvailableBillCycles?: string[];
  Records?: SolarGenerationCapacityApiRecord[];
  selectedBillCycle?: string;
  availableBillCycles?: string[];
  records?: SolarGenerationCapacityApiRecord[];
}

interface SolarGenerationCapacityApiResponse {
  data: SolarGenerationCapacityApiData | null;
  errorMessage?: string | null;
}

interface SolarCapacityComparisonRow {
  netType: string;
  ordinaryCapacity: number;
  bulkCapacity: number;
  ordinaryCount: number;
  bulkCount: number;
}

interface TopCustomersApiRecord {
  AccountNumber?: string;
  Name?: string;
  Kwh?: number | string;
  TotalAmount?: number | string;
  accountNumber?: string;
  name?: string;
  kwh?: number | string;
  totalAmount?: number | string;
}

interface TopCustomersApiData {
  BillCycle?: string;
  Records?: TopCustomersApiRecord[];
  billCycle?: string;
  records?: TopCustomersApiRecord[];
}

interface TopCustomersApiResponse {
  data: TopCustomersApiData | null;
  errorMessage?: string | null;
  errorDetails?: string;
}

// ─── useInView Hook ───────────────────────────────────────────────────────────
// Returns inView (boolean) and triggerCount (increments each time element enters
// viewport). Use triggerCount to replay animations on re-entry.

function useInView(
  ref: React.RefObject<Element>,
  options?: IntersectionObserverInit
): { inView: boolean; triggerCount: number } {
  const [inView, setInView] = useState(false);
  const [triggerCount, setTriggerCount] = useState(0);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          setTriggerCount((c) => c + 1);
        } else {
          setInView(false);
        }
      },
      { threshold: 0.2, ...options }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);

  return { inView, triggerCount };
}

// ─── useCountUp Hook ──────────────────────────────────────────────────────────
// Accepts a `trigger` param — increments cause the count to replay from 0.

function useCountUp(
  target: number,
  duration = 1400,
  active = true,
  trigger = 0
): number {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!active || target === 0) {
      setDisplay(target);
      return;
    }
    setDisplay(0);
    const start = performance.now();
    let raf: number;
    const step = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(eased * target));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, active, trigger]);

  return display;
}

// ─── DrawingLineChart ─────────────────────────────────────────────────────────
// SVG line chart that draws left-to-right. Re-animates every time it scrolls
// back into view (uses useInView internally).

// ─── SalesAreaChart (Modern SaaS Style) ───────────────────────────────────────
interface SalesAreaChartProps {
  data: { month: string; ordinary: number; bulk: number }[];
  formatCurrency: (n: number) => string;
  formatCompact: (n: number) => string;
  formatDateLabel: (value: string) => string;
}

const SalesAreaChart: React.FC<SalesAreaChartProps> = ({
  data,
  formatCurrency,
  formatCompact,
  formatDateLabel,
}) => {
  return (
    <div style={{ width: "100%", height: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorOrdinary" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--ceb-maroon)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--ceb-maroon)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorBulk" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
          <XAxis 
            dataKey="month" 
            tickFormatter={formatDateLabel} 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 11, fill: '#6b7280', fontWeight: 500 }} 
            dy={10} 
          />
          <YAxis 
            tickFormatter={(v) => formatCompact(Number(v))} 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 11, fill: '#6b7280', fontWeight: 500 }} 
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="bg-white/90 backdrop-blur-md p-4 rounded-xl shadow-lg border border-gray-100/80">
                    <p className="text-sm font-bold text-gray-900 mb-3">{formatDateLabel(label)}</p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-6">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-[var(--ceb-maroon)]" />
                          <span className="text-xs font-medium text-gray-500">Ordinary</span>
                        </div>
                        <span className="text-sm font-bold text-gray-900">{formatCurrency(Number(payload[0].value))}</span>
                      </div>
                      <div className="flex items-center justify-between gap-6">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                          <span className="text-xs font-medium text-gray-500">Bulk</span>
                        </div>
                        <span className="text-sm font-bold text-gray-900">{formatCurrency(Number(payload[1].value))}</span>
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
          <Legend 
            iconType="circle" 
            wrapperStyle={{ fontSize: '12px', fontWeight: 500, paddingTop: '10px' }} 
          />
          <Area 
            type="monotone" 
            dataKey="ordinary" 
            name="Ordinary" 
            stroke="var(--ceb-maroon)" 
            strokeWidth={3} 
            fillOpacity={1} 
            fill="url(#colorOrdinary)" 
            activeDot={{ r: 6, strokeWidth: 0, fill: "var(--ceb-maroon)" }} 
          />
          <Area 
            type="monotone" 
            dataKey="bulk" 
            name="Bulk" 
            stroke="#f59e0b" 
            strokeWidth={3} 
            fillOpacity={1} 
            fill="url(#colorBulk)" 
            activeDot={{ r: 6, strokeWidth: 0, fill: "#f59e0b" }} 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── Reveal wrapper ───────────────────────────────────────────────────────────
// Fades + slides up when the element first enters the viewport.

interface RevealProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

const Reveal: React.FC<RevealProps> = ({ children, delay = 0, className = "" }) => {
  const ref = useRef<HTMLDivElement>(null);
  const { inView } = useInView(ref as React.RefObject<Element>, { threshold: 0.12 });
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity:    inView ? 1 : 0,
        transform:  inView ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
};

// ─── SolarCapacityChart ───────────────────────────────────────────────────────
// Grouped bars show ordinary vs bulk capacity per net type.

interface SolarCapacityChartProps {
  data: SolarCapacityComparisonRow[];
  formatCompact: (n: number) => string;
  formatKW:      (n: number) => string;
}

const SolarCapacityChart: React.FC<SolarCapacityChartProps> = ({
  data, formatCompact, formatKW,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const { inView } = useInView(ref as React.RefObject<Element>, { threshold: 0.2 });

  return (
    <div ref={ref} className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }} barCategoryGap="22%">
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
          <XAxis dataKey="netType" tick={{ fontSize: 11 }} interval={0} tickMargin={8} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompact(Number(v))} width={44} />
          <Tooltip
            formatter={(value: any, name: any) => {
              const n = Number(value) || 0;

              if (name === "Ordinary") {
                return [formatKW(n), "Ordinary Capacity"];
              }

              if (name === "Bulk") {
                return [formatKW(n), "Bulk Capacity"];
              }

              return [String(value), String(name)];
            }}
            labelStyle={{ fontWeight: 600 }}
          />
          <Legend />
          <Bar dataKey="ordinaryCapacity" name="Ordinary" fill={SOLAR_ORDINARY_COLOR} radius={[6,6,0,0]}
            isAnimationActive={inView} animationDuration={900} animationEasing="ease-out" animationBegin={0}>
            <LabelList dataKey="ordinaryCapacity" position="top" formatter={(v: any) => formatCompact(Number(v) || 0)} style={{ fontSize: 10, fill: "#6b7280" }} />
          </Bar>
          <Bar dataKey="bulkCapacity" name="Bulk" fill={SOLAR_BULK_COLOR} radius={[6,6,0,0]}
            isAnimationActive={inView} animationDuration={900} animationEasing="ease-out" animationBegin={250}>
            <LabelList dataKey="bulkCapacity" position="top" formatter={(v: any) => formatCompact(Number(v) || 0)} style={{ fontSize: 10, fill: "#6b7280" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── Component ────────────────────────────────────────────────────────────────

const DefaultDashboardPage: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const activeDashboard = "default";

  if (!user?.Level || user.Level < 60) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-8">
        <div className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-lg shadow-stone-200/50">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-100">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-stone-900">Access Denied</h2>
          <p className="mt-2 text-sm text-stone-600">
            You do not have permission to view the default dashboard.
          </p>
          <button
            onClick={() => navigate("/home")}
            className="mt-6 px-5 py-2.5 rounded-xl bg-[#7A0000] text-white text-xs font-semibold hover:bg-[#600000] transition-colors shadow-sm"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const getProvinceDivision = (provinceCode?: string): string | null => {
    if (!provinceCode) return null;
    const code = provinceCode.trim().toUpperCase();
    const d1 = ["1", "3", "8", "D"];
    const d2 = ["5", "7", "A", "E"];
    const d3 = ["2", "6", "9", "C"];
    const d4 = ["4", "B", "F"];
    
    if (d1.includes(code)) return "d1";
    if (d2.includes(code)) return "d2";
    if (d3.includes(code)) return "d3";
    if (d4.includes(code)) return "d4";
    return null;
  };

  const [selectedDivision, setSelectedDivision] = useState(() => {
    if (user?.Level !== 80) {
      if (user?.RegionCode) {
        const match = /^R(\d+)$/i.exec(user.RegionCode.trim());
        if (match) {
          return `d${match[1]}`.toLowerCase();
        }
      }
      if (user?.ProvinceCode) {
        const div = getProvinceDivision(user.ProvinceCode);
        if (div) return div;
      }
    }
    return "all";
  });

  const [selectedProvince, setSelectedProvince] = useState(() => {
    if (user?.Level === 60 && user?.ProvinceCode) {
      return user.ProvinceCode;
    }
    return "";
  });

  const handleProvinceChange = (code: string) => {
    setSelectedProvince(code);
    if (code) {
      const div = getProvinceDivision(code);
      if (div) {
        setSelectedDivision(div);
      }
    } else {
      if (user?.Level !== 80) {
        if (user?.RegionCode) {
          const match = /^R(\d+)$/i.exec(user.RegionCode.trim());
          if (match) {
            setSelectedDivision(`d${match[1]}`.toLowerCase());
            return;
          }
        }
        if (user?.ProvinceCode) {
          const div = getProvinceDivision(user.ProvinceCode);
          if (div) {
            setSelectedDivision(div);
            return;
          }
        }
      }
      setSelectedDivision("all");
    }
  };
  const toRegion = (division: string) => {
    const match = /^d(\d+)$/i.exec(division || "");
    return match ? `R${match[1]}` : null;
  };
  const selectedRegion = toRegion(selectedDivision);
  const withRegion = (url: string) => {
    if (!selectedRegion) return url;
    const joiner = url.includes("?") ? "&" : "?";
    return `${url}${joiner}region=${encodeURIComponent(selectedRegion)}`;
  };

  // ── UI state ──────────────────────────────────────────────────────────────
  const [isLoaded, setIsLoaded]               = useState(false);
  const [activeSolarPieChart, setActiveSolarPieChart] = useState<string | null>(null);
  const [showMoreCards, setShowMoreCards]     = useState(false);
  const [visibleCards, setVisibleCards]       = useState<string[]>([
    "totalCustomers", "solarCustomers", /* "zeroConsumption", */ "kioskCollection",
  ]);
  const [draggedCardId, setDraggedCardId]   = useState<string | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);

  // ── Scroll-trigger refs ───────────────────────────────────────────────────
  const kpiRef             = useRef<HTMLDivElement>(null);
  const solarPieRef        = useRef<HTMLDivElement>(null);
  const kioskTrendRef      = useRef<HTMLDivElement>(null);

  const { triggerCount: kpiTrigger }        = useInView(kpiRef        as React.RefObject<Element>, { threshold: 0.15 });
  const { triggerCount: solarPieTrigger }   = useInView(solarPieRef   as React.RefObject<Element>, { threshold: 0.3 });
  const { inView: kioskTrendInView, triggerCount: kioskTrendTrigger } = useInView(kioskTrendRef as React.RefObject<Element>, { threshold: 0.35 });

  // Pie chart animation keys — new key = new @keyframe names = animation replays
  const [solarPieAnimKey,   setSolarPieAnimKey]   = useState(0);

  useEffect(() => { setSolarPieAnimKey((k)   => k + 1); }, [solarPieTrigger]);

  // ── Customer counts ────────────────────────────────────────────────────────
  const [customerCounts, setCustomerCounts] = useState<CustomerCounts>({
    ordinary: 0, bulk: 0,
    solar: { netMetering: 0, netAccounting: 0, netPlus: 0, netPlusPlus: 0 },
    zeroConsumption: 1234,
  });
  const [bulkSolarCustomers, setBulkSolarCustomers] = useState({
    netMetering: 0, netAccounting: 0, netPlus: 0, netPlusPlus: 0,
  });
  const [customerCountsLoading, setCustomerCountsLoading] = useState(true);
  const [, setCustomerCountsError]     = useState<string | null>(null);
  const [solarLoading, setSolarLoading]                   = useState(true);
  const [bulkSolarLoading, setBulkSolarLoading]           = useState(true);
  const [, setSolarError]                       = useState<string | null>(null);
  const [bulkCountLoading, setBulkCountLoading]           = useState(true);
  const [, setBulkCountError]               = useState<string | null>(null);

  // ── Sales / Collection ────────────────────────────────────────────────────
  const [monthlySalesData, setMonthlySalesData]         = useState<MonthlySalesData[]>([]);
  const [salesCollectionLoading, setSalesCollectionLoading] = useState(true);
  const [salesCollectionError, setSalesCollectionError]     = useState<string | null>(null);
  const [, setSalesChartKey]                   = useState(0);
  const [kioskWeeklyTotal, setKioskWeeklyTotal]             = useState(0);
  const [kioskDateRange, setKioskDateRange]                 = useState({ fromDate: "", toDate: "" });
  const [kioskDailyRecords, setKioskDailyRecords]           = useState<KioskCollectionRecord[]>([]);
  const [kioskLoading, setKioskLoading]                     = useState(true);
  const [kioskError, setKioskError]                         = useState<string | null>(null);

  const [selectedSolarBillCycle, setSelectedSolarBillCycle] = useState<string>("");
  const [availableSolarBillCycles, setAvailableSolarBillCycles] = useState<string[]>([]);
  const [solarCapacityChartData, setSolarCapacityChartData] = useState<SolarCapacityComparisonRow[]>([]);
  const [solarCapacityLoading, setSolarCapacityLoading] = useState<boolean>(true);
  const [solarCapacityError, setSolarCapacityError] = useState<string | null>(null);
  const [solarCapacityInitialized, setSolarCapacityInitialized] = useState(false);
  const [topCustomers, setTopCustomers] = useState<TopCustomerItem[]>([]);
  const [topCustomersLoading, setTopCustomersLoading] = useState(true);
  const [topCustomersError, setTopCustomersError] = useState<string | null>(null);
  const [topCustomersBillCycle, setTopCustomersBillCycle] = useState<string>("");

  // ── Dashboard card config ─────────────────────────────────────────────────
  const cardConfig = [
    { id: "totalCustomers",      title: "Total Customers",     default: true,  category: "customer"    },
    { id: "solarCustomers",      title: "Solar Customers",     default: true,  category: "solar"       },
    // { id: "zeroConsumption",     title: "Zero Consumption",    default: true,  category: "consumption" },
    { id: "kioskCollection",     title: "Kiosk Collection",    default: true,  category: "collection"  },
    { id: "salesCollectionDistribution", title: "Sales & Collection Distribution", default: false, category: "collection" },
    { id: "solarCapacity",       title: "Solar Generation Capacity (kW)", default: false, category: "solar"       },
  ].sort((a, b) => a.title.localeCompare(b.title));

  const toggleCardVisibility = (cardId: string) =>
    setVisibleCards((prev) =>
      prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]
    );

  // ── Drag-and-drop handlers ────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, cardId: string) => {
    setDraggedCardId(cardId);
    e.dataTransfer.effectAllowed = "move";
    const ghost = document.createElement("div");
    ghost.style.position = "fixed";
    ghost.style.top = "-9999px";
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
  };

  const handleDragEnter = (cardId: string) => {
    if (cardId !== draggedCardId) setDragOverCardId(cardId);
  };

  const handleDragEnd = () => {
    if (draggedCardId && dragOverCardId && draggedCardId !== dragOverCardId) {
      setVisibleCards((prev) => {
        const next = [...prev];
        const fi = next.indexOf(draggedCardId);
        const ti = next.indexOf(dragOverCardId);
        if (fi !== -1 && ti !== -1) { next.splice(fi, 1); next.splice(ti, 0, draggedCardId); }
        return next;
      });
    }
    setDraggedCardId(null);
    setDragOverCardId(null);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let active = true;
    const fetchOrdinaryCount = async () => {
      setCustomerCountsLoading(true);
      setCustomerCountsError(null);
      setCustomerCounts((p) => ({ ...p, ordinary: 0 }));
      try {
        const res  = await fetch(withRegion(`/misapi/api/dashboard/ordinary-customers-summary?billCycle=0`), { headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
        const json = await res.json();
        if (!active) return;
        setCustomerCounts((p) => ({ ...p, ordinary: json?.data?.TotalCount ?? 0 }));

      } catch (err: any) {
        if (!active) return;
        setCustomerCountsError(err.message || "Failed to load ordinary customer count");
      }
      finally {
        if (active) {
          setCustomerCountsLoading(false);
        }
      }
    };
    fetchOrdinaryCount();
    return () => { active = false; };
  }, [selectedRegion]);

  useEffect(() => {
    let active = true;
    const fetchBulkCount = async () => {
      setBulkCountLoading(true);
      setBulkCountError(null);
      setCustomerCounts((p) => ({ ...p, bulk: 0 }));
      try {
        const res  = await fetch(withRegion("/misapi/api/dashboard/customers/active-count"), { headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
        const json = await res.json();
        if (!active) return;
        setCustomerCounts((p) => ({ ...p, bulk: json?.data?.activeCustomerCount ?? 0 }));
      } catch (err: any) {
        if (!active) return;
        setBulkCountError(err.message || "Failed to load bulk customer count");
      }
      finally {
        if (active) {
          setBulkCountLoading(false);
        }
      }
    };
    fetchBulkCount();
    return () => { active = false; };
  }, [selectedRegion]);

  useEffect(() => {
    let active = true;
    const fetchSolarCustomerData = async () => {
      setSolarLoading(true);
      setSolarError(null);
      setCustomerCounts((p) => ({
        ...p,
        solar: { netMetering: 0, netAccounting: 0, netPlus: 0, netPlusPlus: 0 },
      }));
      try {
        const maxRes = await fetch(`/misapi/api/dashboard/solar-ordinary-customers/billcycle/max`, { headers: { Accept: "application/json" } });
        if (!maxRes.ok) throw new Error(`Failed to fetch max bill cycle`);
        const [r1, r2, r3, r4] = await Promise.all([
          fetch(withRegion(`/misapi/api/dashboard/solar-ordinary-customers/count/net-type-1`), { headers: { Accept: "application/json" } }),
          fetch(withRegion(`/misapi/api/dashboard/solar-ordinary-customers/count/net-type-2`), { headers: { Accept: "application/json" } }),
          fetch(withRegion(`/misapi/api/dashboard/solar-ordinary-customers/count/net-type-3`), { headers: { Accept: "application/json" } }),
          fetch(withRegion(`/misapi/api/dashboard/solar-ordinary-customers/count/net-type-4`), { headers: { Accept: "application/json" } }),
        ]);
        if (!r1.ok || !r2.ok || !r3.ok || !r4.ok) throw new Error("Failed to fetch one or more net-type counts");
        const [d1, d2, d3, d4] = await Promise.all([r1.json(), r2.json(), r3.json(), r4.json()]);
        if (!active) return;
        setCustomerCounts((p) => ({
          ...p,
          solar: {
            netMetering:   d1?.data?.CustomersCount ?? 0,
            netAccounting: d2?.data?.CustomersCount ?? 0,
            netPlus:       d3?.data?.CustomersCount ?? 0,
            netPlusPlus:   d4?.data?.CustomersCount ?? 0,
          },
        }));
      } catch (err: any) {
        if (!active) return;
        setSolarError(err.message || "Failed to load solar customer data");
        console.error("Solar data fetch error:", err);
      }
      finally {
        if (active) {
          setSolarLoading(false);
        }
      }
    };
    fetchSolarCustomerData();
    return () => { active = false; };
  }, [selectedRegion]);

  useEffect(() => {
    let active = true;
    const fetchBulkSolarCustomerData = async () => {
      setBulkSolarLoading(true);
      setBulkSolarCustomers({ netMetering: 0, netAccounting: 0, netPlus: 0, netPlusPlus: 0 });
      try {
        const [r1, r2, r3, r4] = await Promise.all([
          fetch(withRegion(`/misapi/api/dashboard/solar-bulk-customers/count/net-type-1`), { headers: { Accept: "application/json" } }),
          fetch(withRegion(`/misapi/api/dashboard/solar-bulk-customers/count/net-type-2`), { headers: { Accept: "application/json" } }),
          fetch(withRegion(`/misapi/api/dashboard/solar-bulk-customers/count/net-type-3`), { headers: { Accept: "application/json" } }),
          fetch(withRegion(`/misapi/api/dashboard/solar-bulk-customers/count/net-type-4`), { headers: { Accept: "application/json" } }),
        ]);
        if (!r1.ok || !r2.ok || !r3.ok || !r4.ok) throw new Error("Failed to fetch bulk solar net-type counts");
        const [d1, d2, d3, d4] = await Promise.all([r1.json(), r2.json(), r3.json(), r4.json()]);
        if (!active) return;
        setBulkSolarCustomers({
          netMetering:   d1?.data?.CustomersCount ?? 0,
          netAccounting: d2?.data?.CustomersCount ?? 0,
          netPlus:       d3?.data?.CustomersCount ?? 0,
          netPlusPlus:   d4?.data?.CustomersCount ?? 0,
        });
      } catch (err: any) {
        if (!active) return;
        console.error("Bulk solar data fetch error:", err);
      }
      finally {
        if (active) {
          setBulkSolarLoading(false);
        }
      }
    };
    fetchBulkSolarCustomerData();
    return () => { active = false; };
  }, [selectedRegion]);

  useEffect(() => {
    let active = true;
    const fetchSalesCollection = async () => {
      setSalesCollectionLoading(true);
      setSalesCollectionError(null);
      setMonthlySalesData([]);
      try {
        const normalizeSalesRecords = (records: any[] = []): SalesCollectionRecord[] => {
          return records
            .map((rec) => ({
              Date: String(rec?.Date ?? rec?.date ?? ""),
              Amount: Number(rec?.Amount ?? rec?.amount ?? 0),
              ErrorMessage: String(rec?.ErrorMessage ?? rec?.errorMessage ?? ""),
            }))
            .filter((rec) => rec.Date);
        };

        const [ordinaryRecords, bulkRecords] = await Promise.all([
          (async () => {
            const res = await fetch(withRegion("/misapi/api/dashboard/salesCollection/range/ordinary"), {
              headers: { Accept: "application/json" },
            });
            if (!res.ok) throw new Error(`Ordinary sales/collection fetch failed: ${res.status}`);

            const json: SalesCollectionApiResponse = await res.json();
            if (json?.errorMessage) {
              const details = json?.errorDetails ? ` (${json.errorDetails})` : "";
              throw new Error(`Ordinary sales/collection API error: ${json.errorMessage}${details}`);
            }

            if (!json?.data?.records || !Array.isArray(json.data.records)) {
              throw new Error("Ordinary sales/collection API returned an invalid response format.");
            }

            return normalizeSalesRecords(json.data.records);
          })(),
          (async () => {
            const res = await fetch(withRegion("/misapi/api/dashboard/salesCollection/range/bulk"), {
              headers: { Accept: "application/json" },
            });
            if (!res.ok) throw new Error(`Bulk sales/collection fetch failed: ${res.status}`);

            const json: SalesCollectionApiResponse = await res.json();
            if (json?.errorMessage) {
              const details = json?.errorDetails ? ` (${json.errorDetails})` : "";
              throw new Error(`Bulk sales/collection API error: ${json.errorMessage}${details}`);
            }

            if (!json?.data?.records || !Array.isArray(json.data.records)) {
              throw new Error("Bulk sales/collection API returned an invalid response format.");
            }

            return normalizeSalesRecords(json.data.records);
          })(),
        ]);

        if (!active) return;
        const ordinaryByDate = new Map(ordinaryRecords.map((rec) => [rec.Date, Number(rec.Amount) || 0]));
        const bulkByDate = new Map(bulkRecords.map((rec) => [rec.Date, Number(rec.Amount) || 0]));
        const allDates = Array.from(new Set([...ordinaryByDate.keys(), ...bulkByDate.keys()]));

        const merged: MonthlySalesData[] = allDates.map((date) => ({
          month: date,
          ordinary: ordinaryByDate.get(date) ?? 0,
          bulk: bulkByDate.get(date) ?? 0,
        }));

        if (merged.length === 0) {
          throw new Error("Sales & collection API returned no records for the selected 7-day range.");
        }

        setMonthlySalesData([...merged].sort((a, b) =>
          new Date(a.month).getTime() - new Date(b.month).getTime()
        ));
        setSalesChartKey((k) => k + 1);
      } catch (err: any) {
        if (!active) return;
        console.error("Error fetching sales/collection data:", err);
        setSalesCollectionError(err.message || "Failed to load sales data.");
      }
      finally {
        if (active) {
          setSalesCollectionLoading(false);
        }
      }
    };
    fetchSalesCollection();
    return () => { active = false; };
  }, [selectedRegion]);

  useEffect(() => {
    let active = true;
    const normalizeRecords = (records: SolarGenerationCapacityApiRecord[] = []) =>
      records.map((record) => ({
        netType: String(record.NetType ?? record.netType ?? ""),
        capacityKw: Number(record.CapacityKw ?? record.capacityKw ?? 0),
        accountsCount: Number(record.AccountsCount ?? record.accountsCount ?? 0),
      }));

    const fetchCapacityByEndpoint = async (endpoint: string, billCycle: string) => {
      const url = billCycle
        ? withRegion(`${endpoint}?billCycle=${encodeURIComponent(billCycle)}`)
        : withRegion(endpoint);

      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) {
        throw new Error(`Solar capacity fetch failed: ${res.status}`);
      }

      const json: SolarGenerationCapacityApiResponse = await res.json();
      if (json?.errorMessage) {
        throw new Error(json.errorMessage);
      }

      const data = json?.data;
      return {
        selectedBillCycle: String(data?.SelectedBillCycle ?? data?.selectedBillCycle ?? billCycle ?? ""),
        availableBillCycles: (data?.AvailableBillCycles ?? data?.availableBillCycles ?? []).map(String),
        records: normalizeRecords(data?.Records ?? data?.records ?? []),
      };
    };

    const fetchSolarCapacityGraph = async () => {
      setSolarCapacityLoading(true);
      setSolarCapacityError(null);
      setSolarCapacityChartData([]);

      try {
        const ordinaryEndpoint = "/misapi/api/dashboard/solar-ordinary-customers/generation-capacity";
        const bulkEndpoint = "/misapi/api/dashboard/solar-bulk-customers/generation-capacity";

        const ordinaryData = await fetchCapacityByEndpoint(ordinaryEndpoint, selectedSolarBillCycle);

        if (!active) return;
        const resolvedBillCycles = ordinaryData.availableBillCycles;
        const latestBillCycle = resolvedBillCycles[0] || ordinaryData.selectedBillCycle || selectedSolarBillCycle;

        setAvailableSolarBillCycles(resolvedBillCycles);

        if (!solarCapacityInitialized) {
          setSolarCapacityInitialized(true);
          if (latestBillCycle && latestBillCycle !== selectedSolarBillCycle) {
            setSelectedSolarBillCycle(latestBillCycle);
            return;
          }
        }

        const resolvedBillCycle = selectedSolarBillCycle || latestBillCycle;
        if (resolvedBillCycle && resolvedBillCycle !== selectedSolarBillCycle) {
          setSelectedSolarBillCycle(resolvedBillCycle);
        }

        const bulkData = await fetchCapacityByEndpoint(bulkEndpoint, resolvedBillCycle);

        if (!active) return;
        const rows = new Map<string, SolarCapacityComparisonRow>();
        const addRow = (item: SolarGenerationCapacityApiRecord, isOrdinary: boolean) => {
          const netType = String(item.NetType ?? item.netType ?? "");
          if (!netType) return;

          if (!rows.has(netType)) {
            rows.set(netType, {
              netType,
              ordinaryCapacity: 0,
              bulkCapacity: 0,
              ordinaryCount: 0,
              bulkCount: 0,
            });
          }

          const row = rows.get(netType)!;
          if (isOrdinary) {
            row.ordinaryCapacity += Number(item.CapacityKw ?? item.capacityKw ?? 0);
            row.ordinaryCount += Number(item.AccountsCount ?? item.accountsCount ?? 0);
          } else {
            row.bulkCapacity += Number(item.CapacityKw ?? item.capacityKw ?? 0);
            row.bulkCount += Number(item.AccountsCount ?? item.accountsCount ?? 0);
          }
        };

        ordinaryData.records.forEach((item) => addRow(item, true));
        bulkData.records.forEach((item) => addRow(item, false));

        const ordered = ["Net Metering", "Net Accounting", "Net Plus", "Net Plus Plus"];
        const chartRows = ordered
          .filter((netType) => rows.has(netType))
          .map((netType) => rows.get(netType)!);

        setSolarCapacityChartData(chartRows);
      } catch (err: any) {
        if (!active) return;
        console.error("Solar capacity graph fetch error:", err);
        setSolarCapacityError(err?.message || "Failed to load solar capacity graph data.");
        setSolarCapacityChartData([]);
      } finally {
        if (active) {
          setSolarCapacityLoading(false);
        }
      }
    };

    fetchSolarCapacityGraph();
    return () => { active = false; };
  }, [selectedSolarBillCycle, solarCapacityInitialized, selectedRegion]);

  const loggedUserId = (user?.Userno || "").trim().toUpperCase();
  const kioskUserId = loggedUserId.startsWith("KIOS") ? loggedUserId : "KIOS00";

  useEffect(() => {
    let active = true;
    const fetchKioskWeeklyCollection = async () => {
      setKioskLoading(true);
      setKioskError(null);
      setKioskWeeklyTotal(0);
      setKioskDailyRecords([]);
      setKioskDateRange({ fromDate: "", toDate: "" });

      try {
        const res = await fetch(
          withRegion(`/misapi/api/dashboard/kiosk-collection?userId=${encodeURIComponent(kioskUserId)}`),
          { headers: { Accept: "application/json" } }
        );

        if (!res.ok) {
          throw new Error(`Kiosk collection fetch failed: ${res.status}`);
        }

        const json: KioskCollectionApiResponse = await res.json();
        if (!active) return;

        if (json?.errorMessage) {
          const details = json?.errorDetails ? ` (${json.errorDetails})` : "";
          throw new Error(`${json.errorMessage}${details}`);
        }

        const records = json?.data?.records ?? [];
        const trendRecords = records.slice(-7);
        const weeklyTotal = records.reduce(
          (sum, row) => sum + (Number(row.CollectionAmount) || 0),
          0
        );

        setKioskWeeklyTotal(weeklyTotal);
        setKioskDailyRecords(records);
        setKioskDateRange({
          fromDate: trendRecords[0]?.TransDate ?? json?.data?.fromDate ?? "",
          toDate: trendRecords[trendRecords.length - 1]?.TransDate ?? json?.data?.toDate ?? "",
        });
      } catch (err: any) {
        if (!active) return;
        console.error("Error fetching kiosk collection data:", err);
        setKioskError(err?.message || "Failed to load kiosk collection data.");
        setKioskWeeklyTotal(0);
      } finally {
        if (active) {
          setKioskLoading(false);
        }
      }
    };

    fetchKioskWeeklyCollection();
    return () => { active = false; };
  }, [kioskUserId, selectedRegion]);

  useEffect(() => {
    let active = true;
    const fetchTopCustomers = async () => {
      setTopCustomersLoading(true);
      setTopCustomersError(null);
      setTopCustomers([]);

      try {
        const res = await fetch(withRegion("/misapi/api/dashboard/top-customers/list"), {
          headers: { Accept: "application/json" },
        });

        if (!res.ok) {
          throw new Error(`Top customers fetch failed: ${res.status}`);
        }

        const json: TopCustomersApiResponse = await res.json();
        if (!active) return;

        if (json?.errorMessage) {
          const details = json?.errorDetails ? ` (${json.errorDetails})` : "";
          throw new Error(`${json.errorMessage}${details}`);
        }

        const records = json?.data?.Records ?? json?.data?.records ?? [];
        const billCycle = String(json?.data?.BillCycle ?? json?.data?.billCycle ?? "");

        const normalized: TopCustomerItem[] = records
          .map((record) => ({
            accountNumber: String(record.AccountNumber ?? record.accountNumber ?? "").trim(),
            name: String(record.Name ?? record.name ?? "").trim(),
            kwh: Number(record.Kwh ?? record.kwh ?? 0),
          }))
          .filter((record) => record.name && record.accountNumber)
          .sort((a, b) => b.kwh - a.kwh)
          .slice(0, 10)
          .map((record, index) => ({
            ...record,
            rank: index + 1,
          }));

        setTopCustomers(normalized);
        setTopCustomersBillCycle(billCycle);
      } catch (err: any) {
        if (!active) return;
        console.error("Top customers fetch error:", err);
        setTopCustomersError(err?.message || "Failed to load top customers.");
        setTopCustomers([]);
      } finally {
        if (active) {
          setTopCustomersLoading(false);
        }
      }
    };

    fetchTopCustomers();
    return () => { active = false; };
  }, [selectedRegion]);

  // ── Formatters ────────────────────────────────────────────────────────────

  const formatNumber   = (n: number) => new Intl.NumberFormat("en-US").format(n);
  const formatCurrency = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "LKR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
  const formatCompact  = (n: number) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
  const formatCompactCurrency = (n: number) => `LKR ${formatCompact(n)}`;
  const formatKW       = (n: number) => `${formatCompact(n)} kW`;
  const formatSolarBillCycle = (billCycle: string) => {
    const cycleNumber = Number(String(billCycle).trim());

    if (!Number.isFinite(cycleNumber)) {
      return billCycle;
    }

    const monthIndex = (cycleNumber - 100) % 12;
    let year = 97 + Math.floor((cycleNumber - 100) / 12);
    let resolvedMonth = monthIndex;

    if (monthIndex === 0) {
      year -= 1;
      resolvedMonth = 12;
    }

    const monthNames = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];

    const monthName = monthNames[resolvedMonth - 1];
    if (!monthName) {
      return billCycle;
    }

    return `${1900 + year} - ${monthName}`;
  };
  const formatIsoDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getLast7DaysRangeLabel = () => {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 1);

    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - 6);

    return `${formatIsoDate(startDate)} to ${formatIsoDate(endDate)}`;
  };
  // Sales dates are now in dd-MM-yy format (consistent with BillCalculation)
  const formatSalesDateLabel = (date: string) => String(date);  // Already formatted by backend as dd-MM-yy

  // ── Derived values ────────────────────────────────────────────────────────

  const totalOrdinarySales = monthlySalesData.reduce((s, d) => s + d.ordinary, 0);
  const totalBulkSales     = monthlySalesData.reduce((s, d) => s + d.bulk, 0);

  const salesLineData = monthlySalesData
    .map((item) => ({ month: item.month, ordinary: item.ordinary, bulk: item.bulk, total: item.ordinary + item.bulk }))
    .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());

  const kioskTrendData = kioskDailyRecords.slice(-7);
  const kioskPeakDailyCollection = kioskTrendData.reduce(
    (max, row) => Math.max(max, Number(row.CollectionAmount) || 0),
    0
  );

  const salesCollectionDateRange = salesLineData.length
    ? `(${salesLineData[0].month} to ${salesLineData[salesLineData.length - 1].month})`
    : "";

  const totalOrdinarySolar = customerCounts.solar.netMetering + customerCounts.solar.netAccounting + customerCounts.solar.netPlus + customerCounts.solar.netPlusPlus;
  const totalBulkSolar     = bulkSolarCustomers.netMetering   + bulkSolarCustomers.netAccounting   + bulkSolarCustomers.netPlus   + bulkSolarCustomers.netPlusPlus;
  const totalSolarCustomers = totalOrdinarySolar + totalBulkSolar;

  const pct = (n: number, total: number) => (total > 0 ? (n / total) * 100 : 0);

  const ordSolarNetMeteringPct   = pct(customerCounts.solar.netMetering,   totalOrdinarySolar);
  const ordSolarNetAccountingPct = pct(customerCounts.solar.netAccounting, totalOrdinarySolar);
  const ordSolarNetPlusPct       = pct(customerCounts.solar.netPlus,       totalOrdinarySolar);
  const ordSolarNetPlusPlusPct   = pct(customerCounts.solar.netPlusPlus,   totalOrdinarySolar);

  const bulkSolarNetMeteringPct   = pct(bulkSolarCustomers.netMetering,   totalBulkSolar);
  const bulkSolarNetAccountingPct = pct(bulkSolarCustomers.netAccounting, totalBulkSolar);
  const bulkSolarNetPlusPct       = pct(bulkSolarCustomers.netPlus,       totalBulkSolar);
  const bulkSolarNetPlusPlusPct   = pct(bulkSolarCustomers.netPlusPlus,   totalBulkSolar);

  const C = 502.4;
  const createArcDasharray = (s: number, e: number) => { const arc = ((e - s) / 100) * C; return `${arc} ${C - arc}`; };

  const ordinarySolarCapacityKw = solarCapacityChartData.reduce((sum, item) => sum + item.ordinaryCapacity, 0);
  const bulkSolarCapacityKw = solarCapacityChartData.reduce((sum, item) => sum + item.bulkCapacity, 0);
  const totalSolarCapacityKw = ordinarySolarCapacityKw + bulkSolarCapacityKw;
  const solarCapacityWeekRange = getLast7DaysRangeLabel();
  const selectedSolarBillCycleLabel = selectedSolarBillCycle ? formatSolarBillCycle(selectedSolarBillCycle) : "";

  //const additionalCardIds = ["solarCapacity"];
  //const hasAdditionalCards = additionalCardIds.some((id) => visibleCards.includes(id));

  // ── Animated values ───────────────────────────────────────────────────────

  const animatedTotal       = useCountUp(customerCounts.ordinary + customerCounts.bulk, 1400, !customerCountsLoading && !bulkCountLoading, kpiTrigger);
  const animatedOrdinary    = useCountUp(customerCounts.ordinary,      1400, !customerCountsLoading, kpiTrigger);
  const animatedBulk        = useCountUp(customerCounts.bulk,          1400, !bulkCountLoading,      kpiTrigger);
  const animatedSolar       = useCountUp(totalSolarCustomers,          1400, !solarLoading && !bulkSolarLoading, kpiTrigger);
  const animatedZero        = useCountUp(customerCounts.zeroConsumption, 1400, true, kpiTrigger);
  const animatedKiosk       = useCountUp(kioskWeeklyTotal,             1400, !kioskLoading, kpiTrigger);
  const animatedSalesCollectionTotal = useCountUp(totalOrdinarySales + totalBulkSales, 1400, !salesCollectionLoading, kpiTrigger);
  const animatedSalesOrdinary = useCountUp(totalOrdinarySales, 1400, !salesCollectionLoading, kpiTrigger);
  const animatedSalesBulk = useCountUp(totalBulkSales, 1400, !salesCollectionLoading, kpiTrigger);
  const animatedSolarCap    = useCountUp(totalSolarCapacityKw, 1400, !solarCapacityLoading, kpiTrigger);

  // Solar pie — animated counts for each net type (ordinary + bulk), replay on solarPieTrigger
  const animatedOrdNetMetering   = useCountUp(customerCounts.solar.netMetering,   1200, !solarLoading, solarPieTrigger);
  const animatedOrdNetAccounting = useCountUp(customerCounts.solar.netAccounting, 1200, !solarLoading, solarPieTrigger);
  const animatedOrdNetPlus       = useCountUp(customerCounts.solar.netPlus,       1200, !solarLoading, solarPieTrigger);
  const animatedOrdNetPlusPlus   = useCountUp(customerCounts.solar.netPlusPlus,   1200, !solarLoading, solarPieTrigger);
  const animatedOrdSolarTotal    = useCountUp(totalOrdinarySolar,                 1200, !solarLoading, solarPieTrigger);

  const animatedBulkNetMetering   = useCountUp(bulkSolarCustomers.netMetering,   1200, true, solarPieTrigger);
  const animatedBulkNetAccounting = useCountUp(bulkSolarCustomers.netAccounting, 1200, true, solarPieTrigger);
  const animatedBulkNetPlus       = useCountUp(bulkSolarCustomers.netPlus,       1200, true, solarPieTrigger);
  const animatedBulkNetPlusPlus   = useCountUp(bulkSolarCustomers.netPlusPlus,   1200, true, solarPieTrigger);
  const animatedBulkSolarTotal    = useCountUp(totalBulkSolar,                   1200, true, solarPieTrigger);

  // ── Pie chart CSS animation strings ──────────────────────────────────────

  const solarPieStyles = `
    @keyframes solarOrdNetMeteringLoad_${solarPieAnimKey}    { 0% { stroke-dasharray: 0 ${C}; stroke-dashoffset: 0; } 100% { stroke-dasharray: ${createArcDasharray(0, ordSolarNetMeteringPct).split(" ")[0]} ${C}; stroke-dashoffset: 0; } }
    @keyframes solarOrdNetAccountingLoad_${solarPieAnimKey}  { 0% { stroke-dasharray: 0 ${C}; stroke-dashoffset: ${-((ordSolarNetMeteringPct / 100) * C)}; } 100% { stroke-dasharray: ${createArcDasharray(ordSolarNetMeteringPct, ordSolarNetMeteringPct + ordSolarNetAccountingPct).split(" ")[0]} ${C}; stroke-dashoffset: ${-((ordSolarNetMeteringPct / 100) * C)}; } }
    @keyframes solarOrdNetPlusLoad_${solarPieAnimKey}        { 0% { stroke-dasharray: 0 ${C}; stroke-dashoffset: ${-(((ordSolarNetMeteringPct + ordSolarNetAccountingPct) / 100) * C)}; } 100% { stroke-dasharray: ${createArcDasharray(ordSolarNetMeteringPct + ordSolarNetAccountingPct, ordSolarNetMeteringPct + ordSolarNetAccountingPct + ordSolarNetPlusPct).split(" ")[0]} ${C}; stroke-dashoffset: ${-(((ordSolarNetMeteringPct + ordSolarNetAccountingPct) / 100) * C)}; } }
    @keyframes solarOrdNetPlusPlusLoad_${solarPieAnimKey}    { 0% { stroke-dasharray: 0 ${C}; stroke-dashoffset: ${-(((ordSolarNetMeteringPct + ordSolarNetAccountingPct + ordSolarNetPlusPct) / 100) * C)}; } 100% { stroke-dasharray: ${createArcDasharray(ordSolarNetMeteringPct + ordSolarNetAccountingPct + ordSolarNetPlusPct, 100).split(" ")[0]} ${C}; stroke-dashoffset: ${-(((ordSolarNetMeteringPct + ordSolarNetAccountingPct + ordSolarNetPlusPct) / 100) * C)}; } }
    @keyframes solarBulkNetMeteringLoad_${solarPieAnimKey}   { 0% { stroke-dasharray: 0 ${C}; stroke-dashoffset: 0; } 100% { stroke-dasharray: ${createArcDasharray(0, bulkSolarNetMeteringPct).split(" ")[0]} ${C}; stroke-dashoffset: 0; } }
    @keyframes solarBulkNetAccountingLoad_${solarPieAnimKey} { 0% { stroke-dasharray: 0 ${C}; stroke-dashoffset: ${-((bulkSolarNetMeteringPct / 100) * C)}; } 100% { stroke-dasharray: ${createArcDasharray(bulkSolarNetMeteringPct, bulkSolarNetMeteringPct + bulkSolarNetAccountingPct).split(" ")[0]} ${C}; stroke-dashoffset: ${-((bulkSolarNetMeteringPct / 100) * C)}; } }
    @keyframes solarBulkNetPlusLoad_${solarPieAnimKey}       { 0% { stroke-dasharray: 0 ${C}; stroke-dashoffset: ${-(((bulkSolarNetMeteringPct + bulkSolarNetAccountingPct) / 100) * C)}; } 100% { stroke-dasharray: ${createArcDasharray(bulkSolarNetMeteringPct + bulkSolarNetAccountingPct, bulkSolarNetMeteringPct + bulkSolarNetAccountingPct + bulkSolarNetPlusPct).split(" ")[0]} ${C}; stroke-dashoffset: ${-(((bulkSolarNetMeteringPct + bulkSolarNetAccountingPct) / 100) * C)}; } }
    @keyframes solarBulkNetPlusPlusLoad_${solarPieAnimKey}   { 0% { stroke-dasharray: 0 ${C}; stroke-dashoffset: ${-(((bulkSolarNetMeteringPct + bulkSolarNetAccountingPct + bulkSolarNetPlusPct) / 100) * C)}; } 100% { stroke-dasharray: ${createArcDasharray(bulkSolarNetMeteringPct + bulkSolarNetAccountingPct + bulkSolarNetPlusPct, 100).split(" ")[0]} ${C}; stroke-dashoffset: ${-(((bulkSolarNetMeteringPct + bulkSolarNetAccountingPct + bulkSolarNetPlusPct) / 100) * C)}; } }
    .solar-ord-metering-${solarPieAnimKey}    { animation: solarOrdNetMeteringLoad_${solarPieAnimKey}    0.9s ease-out forwards; animation-delay: 0.3s; }
    .solar-ord-accounting-${solarPieAnimKey}  { animation: solarOrdNetAccountingLoad_${solarPieAnimKey}  0.9s ease-out forwards; animation-delay: 1.2s; }
    .solar-ord-plus-${solarPieAnimKey}        { animation: solarOrdNetPlusLoad_${solarPieAnimKey}        0.9s ease-out forwards; animation-delay: 2.1s; }
    .solar-ord-plusplus-${solarPieAnimKey}    { animation: solarOrdNetPlusPlusLoad_${solarPieAnimKey}    0.9s ease-out forwards; animation-delay: 3.0s; }
    .solar-bulk-metering-${solarPieAnimKey}   { animation: solarBulkNetMeteringLoad_${solarPieAnimKey}   0.9s ease-out forwards; animation-delay: 0.3s; }
    .solar-bulk-accounting-${solarPieAnimKey} { animation: solarBulkNetAccountingLoad_${solarPieAnimKey} 0.9s ease-out forwards; animation-delay: 1.2s; }
    .solar-bulk-plus-${solarPieAnimKey}       { animation: solarBulkNetPlusLoad_${solarPieAnimKey}       0.9s ease-out forwards; animation-delay: 2.1s; }
    .solar-bulk-plusplus-${solarPieAnimKey}   { animation: solarBulkNetPlusPlusLoad_${solarPieAnimKey}   0.9s ease-out forwards; animation-delay: 3.0s; }
  `;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        <DashboardSelector
          activeDashboard={activeDashboard}
          onSelectDashboard={(dashboard) => navigate(`/dashboard/${dashboard}`)}
        />

        <div className="flex-1">

          <>
              <DashboardHeader
                title="Dashboard"
                selectedDivision={selectedDivision}
                onDivisionChange={setSelectedDivision}
                selectedProvince={selectedProvince}
                onProvinceChange={handleProvinceChange}
              />

              <div className="max-w-7xl mx-auto px-4 py-6">

                {/* ── KPI Cards ─────────────────────────────────────────────── */}
                <div ref={kpiRef} className={`transition-all duration-1000 delay-200 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-4">
                    {visibleCards.map((cardId) => {
                      const isDragging = draggedCardId === cardId;
                      const isDragOver = dragOverCardId === cardId;

                      if (cardId === "totalCustomers") {
                        return (
                          <KpiCard
                            key={cardId}
                            cardId={cardId}
                            title="Total Customers"
                            value={customerCountsLoading && bulkCountLoading ? "Loading..." : formatNumber(animatedTotal)}
                            details={[
                              <span key="ord">Ordinary: {customerCountsLoading ? "..." : formatNumber(animatedOrdinary)}</span>,
                              <span key="bulk">Bulk: {bulkCountLoading ? "..." : formatNumber(animatedBulk)}</span>,
                            ]}
                            icon={<Users className={`w-5 h-5 ${CEB_MAROON_TEXT}`} />}
                            iconBgClass={CEB_MAROON_BG}
                            isDragging={isDragging}
                            isDragOver={isDragOver}
                            onDragStart={(e) => handleDragStart(e, cardId)}
                            onDragEnter={() => handleDragEnter(cardId)}
                            onDragOver={handleDragOver}
                            onDragEnd={handleDragEnd}
                          />
                        );
                      }

                      if (cardId === "solarCustomers") {
                        return (
                          <KpiCard
                            key={cardId}
                            cardId={cardId}
                            title="Solar Customers"
                            value={solarLoading || bulkSolarLoading ? "Loading..." : formatNumber(animatedSolar)}
                            details={[
                              <span key="ord">Ordinary: {solarLoading ? "..." : formatNumber(animatedOrdSolarTotal)}</span>,
                              <span key="bulk">Bulk: {bulkSolarLoading ? "..." : formatNumber(animatedBulkSolarTotal)}</span>,
                            ]}
                            icon={<Sun className={`w-5 h-5 ${CEB_MAROON_TEXT}`} />}
                            iconBgClass={CEB_MAROON_BG}
                            isDragging={isDragging}
                            isDragOver={isDragOver}
                            onDragStart={(e) => handleDragStart(e, cardId)}
                            onDragEnter={() => handleDragEnter(cardId)}
                            onDragOver={handleDragOver}
                            onDragEnd={handleDragEnd}
                          />
                        );
                      }

                      if (cardId === "zeroConsumption") {
                        return (
                          <KpiCard
                            key={cardId}
                            cardId={cardId}
                            title="Zero Consumption"
                            value={formatNumber(animatedZero)}
                            subtitle="Last 3 months"
                            icon={<Zap className={`w-5 h-5 ${CEB_MAROON_TEXT}`} />}
                            iconBgClass={CEB_MAROON_BG}
                            isDragging={isDragging}
                            isDragOver={isDragOver}
                            onDragStart={(e) => handleDragStart(e, cardId)}
                            onDragEnter={() => handleDragEnter(cardId)}
                            onDragOver={handleDragOver}
                            onDragEnd={handleDragEnd}
                          />
                        );
                      }

                      if (cardId === "kioskCollection") {
                        return (
                          <KpiCard
                            key={cardId}
                            cardId={cardId}
                            title="Kiosk Collection"
                            value={kioskLoading ? "Loading..." : formatCurrency(animatedKiosk)}
                            subtitle={
                              kioskError
                                ? kioskError
                                : `${kioskDateRange.fromDate || "-"} to ${kioskDateRange.toDate || "-"}`
                            }
                            icon={<DollarSign className={`w-5 h-5 ${CEB_MAROON_TEXT}`} />}
                            iconBgClass={CEB_MAROON_BG}
                            isDragging={isDragging}
                            isDragOver={isDragOver}
                            onDragStart={(e) => handleDragStart(e, cardId)}
                            onDragEnter={() => handleDragEnter(cardId)}
                            onDragOver={handleDragOver}
                            onDragEnd={handleDragEnd}
                          />
                        );
                      }

                      if (cardId === "solarCapacity") {
                        return (
                          <KpiCard
                            key={cardId}
                            cardId={cardId}
                            title="Solar Generation Capacity"
                            value={
                              solarCapacityLoading
                                ? "Loading..."
                                : solarCapacityError
                                  ? "Unavailable"
                                  : `${formatCompact(animatedSolarCap)} kW`
                            }
                            details={
                              solarCapacityLoading || solarCapacityError
                                ? undefined
                                : (
                                  <>
                                    <span>Ordinary: {formatKW(ordinarySolarCapacityKw)}</span>
                                    <span>Bulk: {formatKW(bulkSolarCapacityKw)}</span>
                                  </>
                                )
                            }
                            subtitle={
                              solarCapacityError
                                ? solarCapacityError
                                : solarCapacityWeekRange
                            }
                            icon={<Battery className={`w-5 h-5 ${CEB_MAROON_TEXT}`} />}
                            iconBgClass={CEB_MAROON_BG}
                            isDragging={isDragging}
                            isDragOver={isDragOver}
                            onDragStart={(e) => handleDragStart(e, cardId)}
                            onDragEnter={() => handleDragEnter(cardId)}
                            onDragOver={handleDragOver}
                            onDragEnd={handleDragEnd}
                          />
                        );
                      }

                      if (cardId === "salesCollectionDistribution") {
                        return (
                          <KpiCard
                            key={cardId}
                            cardId={cardId}
                            title="Sales & Collection Distribution"
                            value={
                              salesCollectionLoading && salesLineData.length === 0
                                ? "Loading..."
                                : salesCollectionError && salesLineData.length === 0
                                  ? "Unavailable"
                                  : formatCompactCurrency(animatedSalesCollectionTotal)
                            }
                            details={
                              salesCollectionLoading && salesLineData.length === 0
                                ? undefined
                                : (
                                  <>
                                    <span>Ordinary: {formatCompactCurrency(animatedSalesOrdinary)}</span>
                                    <span>Bulk: {formatCompactCurrency(animatedSalesBulk)}</span>
                                  </>
                                )
                            }
                            subtitle={
                              salesCollectionError && salesLineData.length === 0
                                ? salesCollectionError
                                : salesLineData.length > 0
                                  ? `${salesLineData[0].month} to ${salesLineData[salesLineData.length - 1].month}`
                                  : "Last 7 days"
                            }
                            icon={<PieChart className="w-5 h-5 text-violet-600" />}
                            iconBgClass="bg-violet-100"
                            isDragging={isDragging}
                            isDragOver={isDragOver}
                            onDragStart={(e) => handleDragStart(e, cardId)}
                            onDragEnter={() => handleDragEnter(cardId)}
                            onDragOver={handleDragOver}
                            onDragEnd={handleDragEnd}
                          />
                        );
                      }

                      return null;
                    })}
                  </div>

                 {/* Customize button */}
                  <div className="flex justify-end mb-6">
                    <button onClick={() => setShowMoreCards(!showMoreCards)}
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                      {showMoreCards ? <><EyeOff className="w-4 h-4" /> Hide Cards</> : <><Eye className="w-4 h-4" /> Show More Cards</>}
                    </button>
                  </div>

                  {/* Card selection panel */}
                  {showMoreCards && (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200 mb-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">Customize Your Dashboard</h3>
                          <p className="text-sm text-gray-600 mt-1">Select cards to display on your dashboard</p>
                        </div>
                        <button onClick={() => setShowMoreCards(false)} className="p-1 hover:bg-white rounded-lg transition-colors">
                          <X className="w-5 h-5 text-gray-600" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {cardConfig.map((card) => (
                          <div key={card.id} onClick={() => toggleCardVisibility(card.id)}
                            className={`p-4 rounded-lg cursor-pointer transition-all border-2 ${visibleCards.includes(card.id) ? "bg-white border-blue-500 shadow-md" : "bg-white border-gray-200 hover:border-gray-300"}`}>
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="font-medium text-gray-900 text-sm">{card.title}</p>
                                <p className="text-xs text-gray-500 mt-1 capitalize">{card.category}</p>
                              </div>
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${visibleCards.includes(card.id) ? "bg-blue-500 border-blue-500" : "border-gray-300"}`}>
                                {visibleCards.includes(card.id) && (
                                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Sales Chart ───────────────────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 auto-rows-fr">

                  <Reveal delay={0} className="h-full">
                    <div className="bg-white rounded-[24px] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] border border-gray-100/80 p-6 h-full flex flex-col hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.06)] transition-all duration-300 relative overflow-hidden group">
                      {/* Decorative gradient */}
                      <div className="absolute -right-10 -top-10 w-40 h-40 bg-gradient-to-bl from-orange-50 to-transparent rounded-full opacity-60 pointer-events-none group-hover:scale-110 transition-transform duration-500" />

                      <div className="flex items-center justify-between mb-6 relative z-10">
                        <div>
                          <h3 className="font-bold text-[15px] text-gray-900 tracking-tight">Kiosk Daily Collection Trend</h3>
                          <p className="text-[13px] text-gray-500 font-medium mt-1">
                            Daily collection amounts for the week {kioskDateRange.fromDate && kioskDateRange.toDate ? `(${kioskDateRange.fromDate} to ${kioskDateRange.toDate})` : ""}
                          </p>
                        </div>
                      </div>
                      <div ref={kioskTrendRef} className="mb-6 flex-1">
                        {kioskLoading ? (
                          <div className="h-64 flex items-center justify-center text-gray-400 text-sm">Loading...</div>
                        ) : kioskError ? (
                          <div className="h-64 flex items-center justify-center text-red-400 text-sm">{kioskError}</div>
                        ) : kioskDailyRecords.length === 0 ? (
                          <div className="h-64 flex items-center justify-center text-gray-400 text-sm">No kiosk collection data for this week.</div>
                        ) : (
                          <div
                            key={`kiosk-trend-${kioskTrendTrigger}`}
                            className="h-full min-h-[28rem] grid gap-3 pr-1"
                            style={{ gridTemplateRows: `repeat(${Math.max(kioskTrendData.length, 1)}, minmax(0, 1fr))` }}
                          >
                            {kioskTrendData.map((item, index) => {
                              const amount = Number(item.CollectionAmount) || 0;
                              const widthPercent = kioskPeakDailyCollection > 0
                                ? Math.max((amount / kioskPeakDailyCollection) * 100, 8)
                                : 0;

                              return (
                                <div key={`${item.TransDate}-${index}`} className="flex items-center justify-between gap-4 text-xs min-h-0 group/row hover:bg-gray-50/80 p-2 -mx-2 rounded-lg transition-colors cursor-default relative z-10">
                                  <span className="min-w-[72px] font-semibold text-gray-500 group-hover/row:text-gray-900 transition-colors">{String(item.TransDate)}</span>
                                  <div className="flex-1 h-2.5 rounded-full bg-orange-100/50 overflow-hidden shadow-inner">
                                    <div
                                      className="h-full rounded-full bg-gradient-to-r from-[var(--ceb-maroon)] to-orange-500 transition-all duration-700 ease-out"
                                      style={{
                                        width: `${kioskTrendInView ? widthPercent : 0}%`,
                                        transitionDelay: `${index * 70}ms`,
                                      }}
                                    />
                                  </div>
                                  <span className="min-w-[88px] text-right font-bold text-gray-900 group-hover/row:text-[var(--ceb-maroon)] transition-colors">
                                    {formatCurrency(amount)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </Reveal>

                  {/* Solar customers — dual pie charts */}
                  <Reveal delay={120} className="h-full">
                    <div ref={solarPieRef} className="bg-white rounded-[24px] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] border border-gray-100/80 p-6 h-full flex flex-col hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.06)] transition-all duration-300 relative overflow-hidden group">
                      {/* Decorative gradient */}
                      <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-gradient-to-tr from-amber-50 to-transparent rounded-full opacity-60 pointer-events-none group-hover:scale-110 transition-transform duration-500" />
                      <style key={solarPieAnimKey}>{solarPieStyles}</style>
                      <div className="flex items-center justify-between mb-6 relative z-10">
                        <div>
                          <h3 className="font-bold text-[15px] text-gray-900 tracking-tight">Solar Customers by Net Type</h3>
                          <p className="text-[13px] text-gray-500 font-medium mt-1">Breakdown by connection category</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        {[
                          { label: "Ordinary Solar", total: animatedOrdSolarTotal,
                            animatedCounts: [animatedOrdNetMetering, animatedOrdNetAccounting, animatedOrdNetPlus, animatedOrdNetPlusPlus],
                            pcts: [ordSolarNetMeteringPct, ordSolarNetAccountingPct, ordSolarNetPlusPct, ordSolarNetPlusPlusPct],
                            classes: [`solar-ord-metering-${solarPieAnimKey}`, `solar-ord-accounting-${solarPieAnimKey}`, `solar-ord-plus-${solarPieAnimKey}`, `solar-ord-plusplus-${solarPieAnimKey}`],
                            keys: ["ordinaryNetMetering","ordinaryNetAccounting","ordinaryNetPlus","ordinaryNetPlusPlus"] },
                          { label: "Bulk Solar", total: animatedBulkSolarTotal,
                            animatedCounts: [animatedBulkNetMetering, animatedBulkNetAccounting, animatedBulkNetPlus, animatedBulkNetPlusPlus],
                            pcts: [bulkSolarNetMeteringPct, bulkSolarNetAccountingPct, bulkSolarNetPlusPct, bulkSolarNetPlusPlusPct],
                            classes: [`solar-bulk-metering-${solarPieAnimKey}`, `solar-bulk-accounting-${solarPieAnimKey}`, `solar-bulk-plus-${solarPieAnimKey}`, `solar-bulk-plusplus-${solarPieAnimKey}`],
                            keys: ["bulkNetMetering","bulkNetAccounting","bulkNetPlus","bulkNetPlusPlus"] },
                        ].map(({ label, total, animatedCounts, pcts, classes, keys }) => {
                          const colors    = SOLAR_NET_TYPE_COLORS;
                          const netLabels = ["Net Metering", "Net Accounting", "Net Plus", "Net Plus Plus"];
                          let offset = 0;
                          return (
                            <div key={label} className="flex flex-col items-center">
                              <h4 className="text-sm font-medium text-gray-900 mb-4">{label}</h4>
                              <div className="relative w-40 h-40">
                                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 200 200">
                                  <circle cx="100" cy="100" r="80" fill="none" stroke="#f3f4f6" strokeWidth="30" />
                                  {classes.map((cls, i) => {
                                    const isActive = activeSolarPieChart === keys[i];
                                    const isAnyActive = !!activeSolarPieChart;
                                    const el = (
                                      <circle key={i} cx="100" cy="100" r="80" fill="none" stroke={colors[i]} 
                                        strokeDasharray={`0 ${C}`} strokeDashoffset={i === 0 ? 0 : -((offset / 100) * C)}
                                        className={`${cls} transition-all duration-300 cursor-pointer`}
                                        style={{
                                          strokeWidth: isActive ? 36 : 30,
                                          opacity: isAnyActive && !isActive ? 0.3 : 1,
                                        }}
                                        onMouseEnter={() => setActiveSolarPieChart(keys[i])}
                                        onMouseLeave={() => setActiveSolarPieChart(null)} />
                                    );
                                    offset += pcts[i];
                                    return el;
                                  })}
                                </svg>
                                {activeSolarPieChart && keys.includes(activeSolarPieChart) ? (
                                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="bg-gray-900 text-white px-3 py-2 rounded-lg text-center shadow-lg">
                                      <p className="text-xs font-semibold">{netLabels[keys.indexOf(activeSolarPieChart)]}</p>
                                      <p className="text-sm font-bold mt-1">{formatNumber(animatedCounts[keys.indexOf(activeSolarPieChart)])}</p>
                                      <p className="text-xs text-gray-300 mt-0.5">{pcts[keys.indexOf(activeSolarPieChart)].toFixed(1)}%</p>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="text-center">
                                      <p className="text-xl font-bold text-gray-900">{formatNumber(total)}</p>
                                      <p className="text-xs text-gray-500">Total</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="space-y-1.5 w-full max-w-[180px] mx-auto mt-4 pl-2">
                                {netLabels.map((nl, i) => {
                                  const isActive = activeSolarPieChart === keys[i];
                                  return (
                                    <div 
                                      key={nl} 
                                      className={`flex items-center gap-3 p-2 rounded-xl transition-all duration-300 cursor-pointer ${
                                        isActive 
                                          ? "bg-gray-50 ring-1 ring-gray-200/60 scale-[1.02] shadow-sm" 
                                          : "hover:bg-gray-50/50"
                                      }`}
                                      onMouseEnter={() => setActiveSolarPieChart(keys[i])}
                                      onMouseLeave={() => setActiveSolarPieChart(null)}
                                    >
                                      <div 
                                        className={`w-3 h-3 rounded-full flex-shrink-0 transition-transform duration-300 ${isActive ? 'scale-125 ring-2 ring-offset-2 ring-gray-200' : ''}`} 
                                        style={{ backgroundColor: colors[i] }} 
                                      />
                                      <div className="flex-1 min-w-0">
                                        <p className={`text-[13px] font-bold leading-none transition-colors duration-300 ${isActive ? 'text-gray-900' : 'text-gray-700'}`}>{nl}</p>
                                        <p className="text-[11px] font-medium text-gray-500 mt-1 truncate">
                                          {formatNumber(animatedCounts[i])} <span className="opacity-70">({pcts[i].toFixed(1)}%)</span>
                                        </p>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </Reveal>
                </div>

                {/* ── Sales & Collection Distribution ──────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 auto-rows-fr">
                  <Reveal delay={240} className="h-full">
                    <div className="bg-white rounded-[24px] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] border border-gray-100/80 p-6 h-full flex flex-col hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.06)] transition-all duration-300 relative overflow-hidden group">
                      <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-gradient-to-tl from-indigo-50 to-transparent rounded-full opacity-60 pointer-events-none group-hover:scale-110 transition-transform duration-500" />
                      <div className="flex items-center justify-between mb-6 relative z-10">
                        <div>
                          <h3 className="font-bold text-[15px] text-gray-900 tracking-tight">Sales & Collection Distribution</h3>
                          <p className="text-[13px] text-gray-500 font-medium mt-1">Daily Collection Trend by Customer Type {salesCollectionDateRange}
                          </p>
                        </div>
                        <PieChart className="w-5 h-5 text-gray-400" />
                      </div>
                      <div className="mb-6 flex-1 min-h-[16rem]">
                        {salesCollectionLoading && salesLineData.length === 0 ? (
                          <div className="h-64 flex items-center justify-center text-gray-400 text-sm">Loading...</div>
                        ) : salesCollectionError && salesLineData.length === 0 ? (
                          <div className="h-64 flex items-center justify-center text-red-400 text-sm">{salesCollectionError}</div>
                        ) : (
                          <div className="h-full flex flex-col">
                            <SalesAreaChart data={salesLineData} formatCurrency={formatCurrency} formatCompact={formatCompact} formatDateLabel={formatSalesDateLabel} />
                          </div>
                        )}
                      </div>
                      <div className="mt-auto pt-4 border-t border-gray-100">
                        <p className="text-xs text-gray-500 mb-2">Daily Average (Last 7 Days)</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-gray-500">Ordinary</p>
                            <p className="text-sm font-semibold text-gray-900">{formatCurrency(totalOrdinarySales / (monthlySalesData.length || 7))} / day</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Bulk</p>
                            <p className="text-sm font-semibold text-gray-900">{formatCurrency(totalBulkSales / (monthlySalesData.length || 7))} / day</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Reveal>

                  <Reveal delay={300} className="h-full">
                    <div className="bg-white rounded-[24px] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] border border-gray-100/80 p-6 h-full flex flex-col hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.06)] transition-all duration-300 relative overflow-hidden group">
                      <div className="absolute -left-10 -top-10 w-40 h-40 bg-gradient-to-br from-emerald-50 to-transparent rounded-full opacity-60 pointer-events-none group-hover:scale-110 transition-transform duration-500" />
                      <div className="flex items-center justify-between mb-4 relative z-10">
                        <div>
                          <h3 className="font-bold text-[15px] text-gray-900 tracking-tight">Solar Generation Capacity</h3>
                          <p className="text-[13px] text-gray-500 font-medium mt-1">
                            Capacity (kW) 
                            {selectedSolarBillCycleLabel ? ` - ${selectedSolarBillCycleLabel}` : ""}
                          </p>
                        </div>
                        <span className="text-[color:var(--ceb-navy)] text-[11px] font-bold tracking-widest bg-slate-50 px-2 py-1 rounded-md">GRAPH</span>
                      </div>

                      <div className="mb-3">
                        <label className="block text-xs text-gray-500 mb-1">Bill Cycle</label>
                        <select
                          value={selectedSolarBillCycle}
                          onChange={(e) => setSelectedSolarBillCycle(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[color:var(--ceb-maroon)]"
                          disabled={solarCapacityLoading || availableSolarBillCycles.length === 0}
                        >
                          {availableSolarBillCycles.map((cycle) => (
                            <option key={cycle} value={cycle}>
                              {formatSolarBillCycle(cycle)}
                            </option>
                          ))}
                        </select>
                      </div>

                      {solarCapacityLoading ? (
                        <div className="h-56 flex items-center justify-center text-sm text-gray-400">Loading solar capacity graph...</div>
                      ) : solarCapacityError ? (
                        <div className="h-56 flex items-center justify-center text-sm text-red-500">{solarCapacityError}</div>
                      ) : solarCapacityChartData.length === 0 ? (
                        <div className="h-56 flex items-center justify-center text-sm text-gray-400">No solar capacity data available.</div>
                      ) : (
                        <SolarCapacityChart data={solarCapacityChartData} formatCompact={formatCompact} formatKW={formatKW} />
                      )}
                    </div>
                  </Reveal>

                </div>

                {/* ── Top Customers ─────────────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 auto-rows-fr">
                  <Reveal delay={360} className="h-full">
                    <TopCustomersList
                      items={topCustomers}
                      loading={topCustomersLoading}
                      error={topCustomersError}
                      billCycle={topCustomersBillCycle}
                    />
                  </Reveal>
                  <div className="hidden lg:block" aria-hidden="true" />
                </div>
              </div>
          </>

        </div>
      </div>
    </div>
  );
};

export default DefaultDashboardPage;
