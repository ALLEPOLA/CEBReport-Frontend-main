import React, { useState, useEffect, useRef } from "react";
import { FaFileDownload, FaPrint } from "react-icons/fa";
import { useUser } from "../../contexts/UserContext";
import { useReportScope } from "../../hooks/useReportScope";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface Area {
  AreaCode: string;
  AreaName: string;
  ErrorMessage?: string | null;
}

interface Province {
  ProvinceCode: string;
  ProvinceName: string;
  ErrorMessage?: string | null;
}

interface BillCycleOption {
  display: string; // "438 - Jan 2026"
  code: string;    // "438"
}

interface CustomerRecord {
  AccountNumber: string;
  Name: string;
  Address: string;
  City: string;
  Tariff: string;
  ContractDemand: string;
  SecurityDeposit: string;
  TotalKWOUnits: string;
  TotalKWDUnits: string;
  TotalKWPUnits: string;
  KVA: string;
  MonthlyCharge: string;
  ProvinceCode: string | null;
  AreaCode: string;
  Province: string | null;
  Area: string | null;
  BillCycle: string;
  ErrorMessage: string;
  RawContractDemand: number;
  RawSecurityDeposit: number;
  RawTotalKWOUnits: number;
  RawTotalKWDUnits: number;
  RawTotalKWPUnits: number;
  RawKVA: number;
  RawMonthlyCharge: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const fmt = (num: number, decimals = 2) =>
  num.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
const SecurityDepositContractDemandBulk: React.FC = () => {
  const maroon = "text-[#7A0000]";
  const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";

  // ── Form state ─────────────────────────────────────────────────────────────
  const [billCycle, setBillCycle] = useState<string>("");
  const [reportCategory, setReportCategory] = useState<string>("Area");
  const [categoryValue, setCategoryValue] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // ── Dropdown data ──────────────────────────────────────────────────────────
  const [billCycleOptions, setBillCycleOptions] = useState<BillCycleOption[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);

  // ── Loading states ─────────────────────────────────────────────────────────
  const [isLoadingBillCycles, setIsLoadingBillCycles] = useState(false);
  const [isLoadingAreas, setIsLoadingAreas] = useState(false);
  const [isLoadingProvinces, setIsLoadingProvinces] = useState(false);

  // ── Error states ───────────────────────────────────────────────────────────
  const [billCycleError, setBillCycleError] = useState<string | null>(null);
  const [areaError, setAreaError] = useState<string | null>(null);
  const [provinceError, setProvinceError] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  // ── Report state ───────────────────────────────────────────────────────────
  const [reportData, setReportData] = useState<CustomerRecord[]>([]);
  const [reportVisible, setReportVisible] = useState(false);
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>("");
  const [selectedBillCycleDisplay, setSelectedBillCycleDisplay] = useState<string>("");

  const { user } = useUser();
  const { allowedCategories, locked } = useReportScope();

  const printRef = useRef<HTMLDivElement>(null);

  // ── Generic fetch helper ───────────────────────────────────────────────────
  const fetchWithErrorHandling = async (url: string) => {
    try {
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) {
        let errorMsg = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.errorMessage) errorMsg = errorData.errorMessage;
        } catch (e) {
          errorMsg = response.statusText;
        }
        throw new Error(errorMsg);
      }
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(`Expected JSON response but got ${contentType}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Error fetching ${url}:`, error);
      throw error;
    }
  };

  // ── 1. Fetch bill cycles on mount ──────────────────────────────────────────
  useEffect(() => {
    const fetchBillCycles = async () => {
      setIsLoadingBillCycles(true);
      setBillCycleError(null);
      try {
        const response = await fetchWithErrorHandling(`/misapi/api/bulk/mon_tot/billcycle/max`);
        console.log("Bill cycle response:", response);

        const billCyclesArray = response?.data?.BillCycles ?? response?.data?.billCycles;
        const maxBillCycle = response?.data?.MaxBillCycle ?? response?.data?.maxBillCycle;

        if (billCyclesArray && Array.isArray(billCyclesArray) && maxBillCycle) {
          const maxCycleNum = parseInt(maxBillCycle, 10);
          const options: BillCycleOption[] = billCyclesArray.map((cycle: string, index: number) => ({
            display: `${maxCycleNum - index} - ${cycle}`,
            code: String(maxCycleNum - index),
          }));
          console.log("Parsed bill cycle options:", options);
          setBillCycleOptions(options);
          if (options.length === 0) {
            setBillCycleError("No bill cycles available");
          }
        } else {
          console.error("Invalid bill cycle data structure:", response);
          setBillCycleError("Invalid bill cycle data format");
        }
      } catch (err: any) {
        console.error("Error fetching bill cycles:", err);
        setBillCycleError(err.message || "Failed to load bill cycles. Please try again later.");
      } finally {
        setIsLoadingBillCycles(false);
      }
    };
    fetchBillCycles();
  }, []);

  // ── 2. Fetch areas on mount ────────────────────────────────────────────────
  useEffect(() => {
    const fetchAreas = async () => {
      setIsLoadingAreas(true);
      setAreaError(null);
      try {
        let url = "/misapi/api/bulk/areas";
        if (locked["Region"]?.code) {
          url += `?regionCode=${locked["Region"].code}`;
        } else if (locked["Province"]?.code) {
          url += `?provCode=${locked["Province"].code}`;
        }
        const areaData = await fetchWithErrorHandling(url);
        setAreas(areaData.data || []);
      } catch (err: any) {
        console.error("Error fetching areas:", err);
        setAreaError(err.message || "Failed to load areas. Please try again later.");
      } finally {
        setIsLoadingAreas(false);
      }
    };
    fetchAreas();
  }, [user.Level, user.RegionCode, user.ProvinceCode]);

  // ── 3. Fetch provinces on mount ────────────────────────────────────────────
  useEffect(() => {
    const fetchProvinces = async () => {
      setIsLoadingProvinces(true);
      setProvinceError(null);
      try {
        let url = "/misapi/api/bulk/province";
        if (locked["Region"]?.code) {
          url += `?regionCode=${locked["Region"].code}`;
        }
        const provinceData = await fetchWithErrorHandling(url);
        setProvinces(provinceData.data || []);
      } catch (err: any) {
        console.error("Error fetching provinces:", err);
        setProvinceError(err.message || "Failed to load provinces. Please try again later.");
      } finally {
        setIsLoadingProvinces(false);
      }
    };
    fetchProvinces();
  }, [user.Level, user.RegionCode]);

  // ── Reset category value when report category changes ──────────────────────
  useEffect(() => {
    const lock = locked[reportCategory as keyof typeof locked];
    if (lock) {
      setCategoryValue(lock.code);
      setSelectedCategoryName(lock.name ? `${lock.code} - ${lock.name}` : lock.code);
    } else {
      setCategoryValue("");
      setSelectedCategoryName("");
    }
  }, [reportCategory, user.Level, user.RegionCode, user.ProvinceCode, user.ProvinceName, user.AreaCode, user.AreaName]);

  // ── Guards ─────────────────────────────────────────────────────────────────
  const isCategoryValueDisabled = () => {
    if (!billCycle) return true;
    if (reportCategory === "Area") return isLoadingAreas || areaError !== null;
    if (reportCategory === "Province") return isLoadingProvinces || provinceError !== null;
    return false;
  };

  const canSubmit = () => !!billCycle && !!categoryValue;

  // ── Summary totals ─────────────────────────────────────────────────────────
  const totalContractDemand = reportData.reduce((s, r) => s + r.RawContractDemand, 0);
  const totalSecurityDeposit = reportData.reduce((s, r) => s + r.RawSecurityDeposit, 0);
  const totalKWO = reportData.reduce((s, r) => s + r.RawTotalKWOUnits, 0);
  const totalKWD = reportData.reduce((s, r) => s + r.RawTotalKWDUnits, 0);
  const totalKWP = reportData.reduce((s, r) => s + r.RawTotalKWPUnits, 0);
  const totalKVA = reportData.reduce((s, r) => s + r.RawKVA, 0);
  const totalMonthlyCharge = reportData.reduce((s, r) => s + r.RawMonthlyCharge, 0);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit()) return;
    setLoading(true);
    setReportError(null);
    try {
      const url = reportCategory === "Province"
        ? `/misapi/api/contract-demand/bulk/province?billCycle=${billCycle}&provCode=${categoryValue}`
        : `/misapi/api/contract-demand/bulk/area?billCycle=${billCycle}&areaCode=${categoryValue}`;

      console.log("Request URL:", url);
      const data = await fetchWithErrorHandling(url);
      console.log("API Response:", data);

      if (data.data && Array.isArray(data.data) && data.data.length > 0) {
        setReportData(data.data);
        setReportVisible(true);

        if (reportCategory === "Area") {
          const selectedArea = areas.find((a) => a.AreaCode === categoryValue);
          setSelectedCategoryName(selectedArea?.AreaName ?? categoryValue);
        } else {
          const selectedProvince = provinces.find((p) => p.ProvinceCode === categoryValue);
          setSelectedCategoryName(selectedProvince?.ProvinceName ?? categoryValue);
        }

        // Bill month display — format like "450-Feb 26"
        const opt = billCycleOptions.find(o => o.code === billCycle);
        let billMonthDisplay = opt?.display ?? billCycle;
        if (opt) {
          const parts = opt.display.split(" - ");
          if (parts.length === 2) {
            const [mon, yr] = parts[1].split(" ");
            billMonthDisplay = `${parts[0]}-${mon} ${yr?.slice(2) ?? ""}`;
          }
        }
        setSelectedBillCycleDisplay(billMonthDisplay);
      } else {
        console.warn("Empty or invalid data received:", data);
        setReportError("No data available for the selected criteria.");
      }
    } catch (err: any) {
      console.error("Error fetching report:", err);
      setReportError(err.message || "Failed to generate report. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── CSV Export ─────────────────────────────────────────────────────────────
  const downloadAsCSV = () => {
    if (!reportData.length) return;

    const provinceHeaders = reportCategory === "Province" ? ["Province", "Area"] : [];
    const headers = [
      ...provinceHeaders,
      "Acct. Number", "Name", "Address", "City", "Tariff",
      "Contract Demand", "Security Deposit", "Total KWO Units",
      "Total KWD Units", "Total KWP Units", "KVA", "Monthly Charge",
    ];

    const rows = reportData.map(r => {
      const base = [
        r.AccountNumber, r.Name, r.Address, r.City, r.Tariff,
        r.ContractDemand, r.SecurityDeposit, r.TotalKWOUnits,
        r.TotalKWDUnits, r.TotalKWPUnits, r.KVA, r.MonthlyCharge,
      ];
      return reportCategory === "Province"
        ? [r.Province ?? r.ProvinceCode ?? "", r.Area ?? r.AreaCode, ...base]
        : base;
    });

    const totalsRow = [
      ...(reportCategory === "Province" ? ["", ""] : []),
      "TOTAL", "", "", "", "",
      fmt(totalContractDemand, 0), fmt(totalSecurityDeposit, 2),
      fmt(totalKWO, 0), fmt(totalKWD, 0), fmt(totalKWP, 0),
      fmt(totalKVA, 0), fmt(totalMonthlyCharge, 2),
    ];

    const locLabel = reportCategory === "Province" ? "Province" : "Area";
    const csv = [
      [`Comparision of Security Deposit and Contract Demand for a ${reportCategory}`],
      [`${locLabel} :`, selectedCategoryName],
      [`Bill Month :`, selectedBillCycleDisplay],
      [],
      headers,
      ...rows,
      totalsRow,
    ].map(row => row.map(c => `"${c}"`).join(",")).join("\n");

    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    link.download = `SecurityDeposit_${billCycle}_${reportCategory}.csv`;
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── Print PDF ──────────────────────────────────────────────────────────────
  const printPDF = () => {
    if (!printRef.current) return;
    const w = window.open("", "_blank");
    if (!w) return;
    const locLabel = reportCategory === "Province" ? "Province" : "Area";
    w.document.write(`
      <html><head>
        <title>Comparision of Security Deposit and Contract Demand</title>
        <style>
          body  { font-family: Arial, sans-serif; font-size: 10px; margin: 10mm; }
          h2    { color: #7A0000; font-size: 13px; margin-bottom: 6px; }
          .meta { font-size: 11px; margin-bottom: 12px; }
          .meta span { font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th    { background: #d3d3d3; font-weight: bold; text-align: center;
                  padding: 5px 4px; border: 1px solid #aaa; font-size: 10px; }
          td    { padding: 3px 4px; border: 1px solid #ccc; font-size: 10px;
                  vertical-align: top; }
          tr:nth-child(even) { background: #f5f5f5; }
          .total-row td { background: #d3d3d3; font-weight: bold; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .font-medium, .font-semibold, .font-bold { font-weight: bold !important; }
          @page { margin-bottom: 18mm;
            @bottom-left  { content: "Generated: ${new Date().toLocaleString()} | Reporting@2026";
                            font-size:9px; color:#666; font-family:Arial; }
            @bottom-right { content: "Page " counter(page) " of " counter(pages);
                            font-size:9px; color:#666; font-family:Arial; }
          }
        </style>
      </head><body>
        <h2>Comparision of Security Deposit and Contract Demand for a ${reportCategory}</h2>
        <div class="meta">
          ${locLabel} : &nbsp;<span>${selectedCategoryName}</span><br>
          Bill Month : &nbsp;<span>${selectedBillCycleDisplay}</span>
        </div>
        ${printRef.current.innerHTML}
      </body></html>
    `);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 500);
  };

  // ── Table ──────────────────────────────────────────────────────────────────
  const renderTable = () => {
    if (!reportData.length)
      return <div className="text-center py-10 text-gray-500 text-sm">No records found for the selected criteria.</div>;

    const showProvCols = reportCategory === "Province";

    return (
      <table className="w-full border-collapse text-xs">
        <thead className="bg-gray-100 sticky top-0">
          <tr>
            {showProvCols && (
              <>
                <th className="border border-gray-300 px-2 py-1 text-center">Province</th>
                <th className="border border-gray-300 px-2 py-1 text-center">Area</th>
              </>
            )}
            <th className="border border-gray-300 px-2 py-1 text-center">Acct.<br />Number</th>
            <th className="border border-gray-300 px-2 py-1 text-center">Name</th>
            <th className="border border-gray-300 px-2 py-1 text-center">Address</th>
            <th className="border border-gray-300 px-2 py-1 text-center">City</th>
            <th className="border border-gray-300 px-2 py-1 text-center">Tariff</th>
            <th className="border border-gray-300 px-2 py-1 text-center">Contract<br />Demand</th>
            <th className="border border-gray-300 px-2 py-1 text-center">Security<br />Deposit</th>
            <th className="border border-gray-300 px-2 py-1 text-center">Total KWO<br />Units</th>
            <th className="border border-gray-300 px-2 py-1 text-center">Total KWD<br />Units</th>
            <th className="border border-gray-300 px-2 py-1 text-center">Total<br />KWP<br />Units</th>
            <th className="border border-gray-300 px-2 py-1 text-center">KVA</th>
            <th className="border border-gray-300 px-2 py-1 text-center">Monthly<br />Charge</th>
          </tr>
        </thead>
        <tbody>
          {reportData.map((r, i) => (
            <tr key={`${r.AccountNumber}-${i}`}
              className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
              {showProvCols && (
                <>
                  <td className="border border-gray-300 px-2 py-1 whitespace-nowrap">
                    {r.Province ?? r.ProvinceCode ?? "—"}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 whitespace-nowrap">
                    {r.Area ?? r.AreaCode}
                  </td>
                </>
              )}
              <td className="border border-gray-300 px-2 py-1 font-mono whitespace-nowrap">{r.AccountNumber}</td>
              <td className="border border-gray-300 px-2 py-1 max-w-[140px] truncate" title={r.Name}>{r.Name}</td>
              <td className="border border-gray-300 px-2 py-1 max-w-[140px] truncate" title={r.Address}>{r.Address || "—"}</td>
              <td className="border border-gray-300 px-2 py-1 whitespace-nowrap">{r.City || "—"}</td>
              <td className="border border-gray-300 px-2 py-1 text-center">{r.Tariff}</td>
              <td className="border border-gray-300 px-2 py-1 text-right font-mono">{r.ContractDemand || "—"}</td>
              <td className="border border-gray-300 px-2 py-1 text-right font-mono">{r.SecurityDeposit || "—"}</td>
              <td className="border border-gray-300 px-2 py-1 text-right font-mono">{r.TotalKWOUnits || "—"}</td>
              <td className="border border-gray-300 px-2 py-1 text-right font-mono">{r.TotalKWDUnits || "—"}</td>
              <td className="border border-gray-300 px-2 py-1 text-right font-mono">{r.TotalKWPUnits || "—"}</td>
              <td className="border border-gray-300 px-2 py-1 text-right font-mono">{r.KVA || "—"}</td>
              <td className="border border-gray-300 px-2 py-1 text-right font-mono">{r.MonthlyCharge || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // JSX
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 bg-white rounded-lg shadow-sm">

      {/* ── FORM ──────────────────────────────────────────────────────────── */}
      {!reportVisible && (
        <>
          <h1 className={`text-xl font-bold ${maroon} mb-4`}>
            Security Deposit and Contract Demand - Bulk
          </h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* First Row - Bill Cycle + Report Category */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              {/* Bill Cycle */}
              <div className="flex flex-col">
                <label className={`text-xs font-medium mb-1 ${maroon}`}>
                  Select Month: <span className="text-red-600">*</span>
                </label>
                {isLoadingBillCycles ? (
                  <div className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md bg-gray-50 text-gray-500">
                    Loading bill cycles...
                  </div>
                ) : billCycleError ? (
                  <div className="w-full px-2 py-1.5 text-xs border border-red-300 rounded-md bg-red-50 text-red-600">
                    {billCycleError}
                  </div>
                ) : (
                  <select
                    value={billCycle}
                    onChange={e => setBillCycle(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent"
                    required
                  >
                    <option value="">Select Month</option>
                    {billCycleOptions.map(o => (
                      <option key={o.code} value={o.code}>{o.display}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Report Category */}
              <div className="flex flex-col">
                <label className={`text-xs font-medium mb-1 ${!billCycle ? "text-gray-400" : maroon}`}>
                  Select Report Category: <span className="text-red-600">*</span>
                </label>
                <select
                  value={reportCategory}
                  onChange={e => setReportCategory(e.target.value)}
                  disabled={!billCycle}
                  className={`w-full px-2 py-1.5 text-xs border rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent ${!billCycle ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed" : "border-gray-300"
                    }`}
                  required
                >
                  {allowedCategories
                    .filter((cat) => cat === "Area" || cat === "Province")
                    .map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                </select>
              </div>
            </div>

            {/* Second Row - Area / Province value */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col">
                <label className={`text-xs font-medium mb-1 ${isCategoryValueDisabled() ? "text-gray-400" : maroon}`}>
                  Select {reportCategory}: <span className="text-red-600">*</span>
                </label>

                {reportCategory === "Area" && (
                  <>
                    {locked["Area"] ? (
                      <select
                        disabled
                        value={locked["Area"].code}
                        className="w-full px-2 py-1.5 text-xs border rounded-md bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                      >
                        <option value={locked["Area"].code}>
                          {locked["Area"].name ? `${locked["Area"].code} - ${locked["Area"].name}` : locked["Area"].code}
                        </option>
                      </select>
                    ) : isLoadingAreas ? (
                      <div className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md bg-gray-50 text-gray-500">
                        Loading areas...
                      </div>
                    ) : areaError ? (
                      <div className="w-full px-2 py-1.5 text-xs border border-red-300 rounded-md bg-red-50 text-red-600">
                        {areaError}
                      </div>
                    ) : (
                      <select
                        value={categoryValue}
                        onChange={e => setCategoryValue(e.target.value)}
                        disabled={isCategoryValueDisabled()}
                        className={`w-full px-2 py-1.5 text-xs border rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent ${isCategoryValueDisabled() ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed" : "border-gray-300"
                          }`}
                        required
                      >
                        <option value="">Select Area</option>
                        {areas.map(a => (
                          <option key={a.AreaCode} value={a.AreaCode}>
                            {a.AreaCode} - {a.AreaName}
                          </option>
                        ))}
                      </select>
                    )}
                  </>
                )}

                {reportCategory === "Province" && (
                  <>
                    {locked["Province"] ? (
                      <select
                        disabled
                        value={locked["Province"].code}
                        className="w-full px-2 py-1.5 text-xs border rounded-md bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                      >
                        <option value={locked["Province"].code}>
                          {locked["Province"].name ? `${locked["Province"].code} - ${locked["Province"].name}` : locked["Province"].code}
                        </option>
                      </select>
                    ) : isLoadingProvinces ? (
                      <div className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md bg-gray-50 text-gray-500">
                        Loading provinces...
                      </div>
                    ) : provinceError ? (
                      <div className="w-full px-2 py-1.5 text-xs border border-red-300 rounded-md bg-red-50 text-red-600">
                        {provinceError}
                      </div>
                    ) : (
                      <select
                        value={categoryValue}
                        onChange={e => {
                          setCategoryValue(e.target.value);
                          const p = provinces.find(p => p.ProvinceCode === e.target.value);
                          setSelectedCategoryName(p ? p.ProvinceName : "");
                        }}
                        disabled={isCategoryValueDisabled()}
                        className={`w-full px-2 py-1.5 text-xs border rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent ${isCategoryValueDisabled() ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed" : "border-gray-300"
                          }`}
                        required
                      >
                        <option value="">Select Province</option>
                        {provinces.map(p => (
                          <option key={p.ProvinceCode} value={p.ProvinceCode}>
                            {p.ProvinceCode} - {p.ProvinceName}
                          </option>
                        ))}
                      </select>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Submit */}
            <div className="w-full mt-6 flex justify-end">
              <button
                type="submit"
                disabled={loading || !canSubmit()}
                className={`px-6 py-2 rounded-md font-medium transition-opacity duration-300 shadow
                  ${maroonGrad} text-white
                  ${loading || !canSubmit() ? "opacity-70 cursor-not-allowed" : "hover:opacity-90"}`}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Loading...
                  </span>
                ) : "Generate Report"}
              </button>
            </div>
          </form>

          {!reportVisible && reportError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {reportError}
            </div>
          )}
        </>
      )}

      {/* ── REPORT ────────────────────────────────────────────────────────── */}
      {reportVisible && (
        <div className="mt-6">

          {/* Report Header — title + buttons together */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
            <div>
              <h2 className={`text-lg font-bold ${maroon}`}>
                Comparision of Security Deposit and Contract Demand for a {reportCategory}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {reportCategory === "Province" ? "Province" : "Area"}: {selectedCategoryName}
                {" "}| Bill Month: {selectedBillCycleDisplay}
              </p>
            </div>
            <div className="flex space-x-2 mt-2 md:mt-0">
              <button onClick={downloadAsCSV}
                className="flex items-center gap-1 px-3 py-1.5 border border-blue-400 text-blue-700
                           bg-white rounded-md text-xs font-medium shadow-sm hover:bg-blue-50 hover:text-blue-800
                           focus:outline-none focus:ring-2 focus:ring-blue-200 transition">
                <FaFileDownload className="w-3 h-3" /> CSV
              </button>
              <button onClick={printPDF}
                className="flex items-center gap-1 px-3 py-1.5 border border-green-400 text-green-700
                           bg-white rounded-md text-xs font-medium shadow-sm hover:bg-green-50 hover:text-green-800
                           focus:outline-none focus:ring-2 focus:ring-green-200 transition">
                <FaPrint className="w-3 h-3" /> PDF
              </button>
              <button
                onClick={() => { setReportVisible(false); setReportError(null); }}
                className="px-4 py-1.5 bg-[#7A0000] hover:bg-[#A52A2A] text-xs rounded-md text-white flex items-center">
                Back to Form
              </button>
            </div>
          </div>

          {/* Scrollable table */}
          <div className="overflow-x-auto max-h-[calc(100vh-250px)] border border-gray-300 rounded-lg">
            <div ref={printRef} className="min-w-full py-4">
              {renderTable()}
              {reportData.length > 0 && (
                <p className="text-xs text-gray-500 mt-2 text-right px-2">
                  Total records: {reportData.length.toLocaleString()}
                </p>
              )}
            </div>
          </div>

          {reportError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {reportError}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SecurityDepositContractDemandBulk;