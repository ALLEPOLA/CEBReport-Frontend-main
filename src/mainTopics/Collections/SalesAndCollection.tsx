import React, { useState, useEffect, useRef } from "react";
import { FaFileDownload, FaPrint } from "react-icons/fa";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface BillCycleOption {
  display: string; // "438 - Jan 2026"
  code: string;    // "438"
}

interface ProvinceOption {
  ProvinceCode: string;
  ProvinceName: string;
}

interface RegionOption {
  RegionCode: string;
  RegionName: string;
}

interface SalesAndCollectionRow {
  ProvinceCode: string;
  AreaName: string;
  OrdinarySupply: string;
  BulkSupply: string;
  TotalNetSales: string;
  OrdinaryCollection: string;
  BulkCollection: string;
  TotalCollections: string;
  CollectionPercentage: string;
  RawOrdinarySupply: number;
  RawBulkSupply: number;
  RawTotalNetSales: number;
  RawOrdinaryCollection: number;
  RawBulkCollection: number;
  RawTotalCollections: number;
  RawCollectionPercentage: number;
  ErrorMessage: string | null;
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
const SalesAndCollection: React.FC = () => {
  const maroon = "text-[#7A0000]";
  const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";

  // ── Form state ─────────────────────────────────────────────────────────────
  const [billCycle, setBillCycle] = useState<string>("");
  // reportType: "EntireCEB" | "Province" | "Region"
  const [reportType, setReportType] = useState<string>("EntireCEB");
  const [provinceName, setProvinceName] = useState<string>("");
  const [regionCode, setRegionCode] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // ── Dropdown data ──────────────────────────────────────────────────────────
  const [billCycleOptions, setBillCycleOptions] = useState<BillCycleOption[]>([]);
  const [provinces, setProvinces] = useState<ProvinceOption[]>([]);
  const [regions, setRegions] = useState<RegionOption[]>([]);

  // ── Loading / error states ─────────────────────────────────────────────────
  const [isLoadingDropdowns, setIsLoadingDropdowns] = useState(false);
  const [dropdownError, setDropdownError] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  // ── Report state ───────────────────────────────────────────────────────────
  const [reportData, setReportData] = useState<SalesAndCollectionRow[]>([]);
  const [reportVisible, setReportVisible] = useState(false);
  const [selectedBillCycleDisplay, setSelectedBillCycleDisplay] = useState<string>("");
  const [selectedSubLabel, setSelectedSubLabel] = useState<string>("");

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
        } catch {
          errorMsg = response.statusText;
        }
        throw new Error(errorMsg);
      }
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(`Expected JSON but got ${contentType}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Error fetching ${url}:`, error);
      throw error;
    }
  };

  // ── Fetch all dropdown data in one call on mount ───────────────────────────
  useEffect(() => {
    const fetchDropdowns = async () => {
      setIsLoadingDropdowns(true);
      setDropdownError(null);
      try {
        const response = await fetchWithErrorHandling(`/misapi/api/sales-collection/dropdowns`);
        console.log("Dropdowns response:", response);

        // Bill cycles
        const billCyclesArray = response?.billCycles ?? response?.data?.billCycles;
        const maxBillCycle = response?.maxBillCycle ?? response?.data?.maxBillCycle;
        if (billCyclesArray && Array.isArray(billCyclesArray) && maxBillCycle) {
          const maxCycleNum = parseInt(maxBillCycle, 10);
          const options: BillCycleOption[] = billCyclesArray.map((cycle: string, index: number) => ({
            display: `${maxCycleNum - index} - ${cycle}`,
            code: String(maxCycleNum - index),
          }));
          setBillCycleOptions(options);
        } else {
          setDropdownError("Invalid bill cycle data format");
        }

        // Provinces
        const provData = response?.provinces ?? response?.data?.provinces ?? [];
        setProvinces(provData);

        // Regions
        const regData = response?.regions ?? response?.data?.regions ?? [];
        setRegions(regData);
      } catch (err: any) {
        console.error("Error fetching dropdowns:", err);
        setDropdownError(err.message || "Failed to load dropdown data. Please try again.");
      } finally {
        setIsLoadingDropdowns(false);
      }
    };
    fetchDropdowns();
  }, []);

  // ── Reset sub-filters when reportType changes ──────────────────────────────
  useEffect(() => {
    setProvinceName("");
    setRegionCode("");
  }, [reportType]);

  // ── Submit guard ───────────────────────────────────────────────────────────
  const canSubmit = () => {
    if (!billCycle) return false;
    if (reportType === "Province" && !provinceName) return false;
    if (reportType === "Region" && !regionCode) return false;
    return true;
  };

  // ── Computed totals ────────────────────────────────────────────────────────
  const totalOrdSup     = reportData.reduce((s, r) => s + r.RawOrdinarySupply, 0);
  const totalBulkSup    = reportData.reduce((s, r) => s + r.RawBulkSupply, 0);
  const totalNetSales   = reportData.reduce((s, r) => s + r.RawTotalNetSales, 0);
  const totalOrdCol     = reportData.reduce((s, r) => s + r.RawOrdinaryCollection, 0);
  const totalBulkCol    = reportData.reduce((s, r) => s + r.RawBulkCollection, 0);
  const totalCollections = reportData.reduce((s, r) => s + r.RawTotalCollections, 0);
  const totalCollPct    = totalNetSales === 0 ? 0 : (totalCollections / totalNetSales) * 100;

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit()) return;
    setLoading(true);
    setReportError(null);

    try {
      let url = `/misapi/api/sales-collection/report?billCycle=${billCycle}&reportType=${reportType}`;
      if (reportType === "Province") url += `&provinceName=${encodeURIComponent(provinceName)}`;
      if (reportType === "Region") url += `&regionCode=${encodeURIComponent(regionCode)}`;

      console.log("Request URL:", url);
      const response = await fetchWithErrorHandling(url);
      console.log("API Response:", response);

      if (response.errorMessage) {
        setReportError(response.errorMessage);
        return;
      }

      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        setReportData(response.data);
        setReportVisible(true);

        // Bill cycle display
        const opt = billCycleOptions.find(o => o.code === billCycle);
        let bcDisplay = opt?.display ?? billCycle;
        if (opt) {
          const parts = opt.display.split(" - ");
          if (parts.length === 2) {
            const [mon, yr] = parts[1].split(" ");
            bcDisplay = `${parts[0]}-${mon} ${yr?.slice(2) ?? ""}`;
          }
        }
        setSelectedBillCycleDisplay(bcDisplay);

        // Sub-label
        if (reportType === "Province") {
          const prov = provinces.find(p => p.ProvinceName === provinceName);
          setSelectedSubLabel(prov?.ProvinceName ?? provinceName);
        } else if (reportType === "Region") {
          const reg = regions.find(r => r.RegionCode === regionCode);
          setSelectedSubLabel(reg ? `${reg.RegionCode} - ${reg.RegionName}` : regionCode);
        } else {
          setSelectedSubLabel("Entire CEB");
        }
      } else {
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

    const headers = [
      "Province Code", "Area",
      "Ordinary Supply (Net)", "Heavy Supply (Net)", "Total Net Sales (without Street Lights)",
      "Ordinary Supply (Collections)", "Bulk Supply (Collections)", "Collections on Sales (Without Street Lights)",
      "% of Collections on Sales (Without Street Lights)",
    ];

    const rows = reportData.map(r => [
      r.ProvinceCode, r.AreaName,
      r.OrdinarySupply, r.BulkSupply, r.TotalNetSales,
      r.OrdinaryCollection, r.BulkCollection, r.TotalCollections,
      r.CollectionPercentage,
    ]);

    const totalsRow = [
      "TOTAL", "",
      fmt(totalOrdSup), fmt(totalBulkSup), fmt(totalNetSales),
      fmt(totalOrdCol), fmt(totalBulkCol), fmt(totalCollections),
      totalCollPct.toFixed(2) + "%",
    ];

    const csv = [
      ["Sales & Collection – Region Wise"],
      ["Report Type:", selectedSubLabel],
      ["Bill Month:", selectedBillCycleDisplay],
      [],
      headers,
      ...rows,
      totalsRow,
    ].map(row => row.map(c => `"${c}"`).join(",")).join("\n");

    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    link.download = `SalesCollection_${billCycle}_${reportType}.csv`;
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
    w.document.write(`
      <html><head>
        <title>Sales & Collection – Region Wise</title>
        <style>
          body  { font-family: Arial, sans-serif; font-size: 10px; margin: 10mm; }
          h2    { color: #7A0000; font-size: 13px; margin-bottom: 6px; }
          .meta { font-size: 11px; margin-bottom: 12px; }
          .meta span { font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th    { background: #d3d3d3; font-weight: bold; text-align: center;
                  padding: 5px 4px; border: 1px solid #aaa; font-size: 10px; }
          td    { padding: 3px 4px; border: 1px solid #ccc; font-size: 10px; vertical-align: top; }
          tr:nth-child(even) { background: #f9f9f9; }
          .total-row td { background: #d3d3d3; font-weight: bold; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          @page { margin-bottom: 18mm;
            @bottom-left  { content: "Generated: ${new Date().toLocaleString()} | Reporting@2026";
                            font-size:9px; color:#666; font-family:Arial; }
            @bottom-right { content: "Page " counter(page) " of " counter(pages);
                            font-size:9px; color:#666; font-family:Arial; }
          }
        </style>
      </head><body>
        <h2>Sales &amp; Collection – Region Wise</h2>
        <div class="meta">
          Report Type : &nbsp;<span>${selectedSubLabel}</span><br>
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
      return (
        <div className="text-center py-10 text-gray-500 text-sm">
          No records found for the selected criteria.
        </div>
      );

    return (
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-gray-100 text-gray-800">
            <th className="border border-gray-300 px-2 py-2 text-center font-bold">Province<br/>Code</th>
            <th className="border border-gray-300 px-2 py-2 text-center font-bold">Area</th>
            <th className="border border-gray-300 px-2 py-2 text-center font-bold">Ordinary Supply<br/>(Net)</th>
            <th className="border border-gray-300 px-2 py-2 text-center font-bold">Heavy Supply<br/>(Net)</th>
            <th className="border border-gray-300 px-2 py-2 text-center font-bold">Total Net Sales<br/>(without Street Lights)</th>
            <th className="border border-gray-300 px-2 py-2 text-center font-bold">Ordinary Supply<br/>(Collections)</th>
            <th className="border border-gray-300 px-2 py-2 text-center font-bold">Bulk Supply<br/>(Collections)</th>
            <th className="border border-gray-300 px-2 py-2 text-center font-bold">Collections on Sales<br/>(Without Street Lights)</th>
            <th className="border border-gray-300 px-2 py-2 text-center font-bold">% of Collections on Sales<br/>(Without Street Lights)</th>
          </tr>
        </thead>
        <tbody>
          {reportData.map((r, i) => (
            <tr key={`${r.AreaName}-${i}`} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
              <td className="border border-gray-300 px-2 py-1 text-center">{r.ProvinceCode || "—"}</td>
              <td className="border border-gray-300 px-2 py-1 whitespace-nowrap">{r.AreaName}</td>
              <td className="border border-gray-300 px-2 py-1 text-right font-mono">{r.OrdinarySupply}</td>
              <td className="border border-gray-300 px-2 py-1 text-right font-mono">{r.BulkSupply}</td>
              <td className="border border-gray-300 px-2 py-1 text-right font-mono">{r.TotalNetSales}</td>
              <td className="border border-gray-300 px-2 py-1 text-right font-mono">{r.OrdinaryCollection}</td>
              <td className="border border-gray-300 px-2 py-1 text-right font-mono">{r.BulkCollection}</td>
              <td className="border border-gray-300 px-2 py-1 text-right font-mono">{r.TotalCollections}</td>
              <td className="border border-gray-300 px-2 py-1 text-right font-mono">{r.CollectionPercentage}</td>
            </tr>
          ))}

          {/* Totals row */}
          <tr className="bg-gray-200 font-bold">
            <td className="border border-gray-300 px-2 py-1 text-center font-bold" colSpan={2}>TOTAL</td>
            <td className="border border-gray-300 px-2 py-1 text-right font-mono font-bold">{fmt(totalOrdSup)}</td>
            <td className="border border-gray-300 px-2 py-1 text-right font-mono font-bold">{fmt(totalBulkSup)}</td>
            <td className="border border-gray-300 px-2 py-1 text-right font-mono font-bold">{fmt(totalNetSales)}</td>
            <td className="border border-gray-300 px-2 py-1 text-right font-mono font-bold">{fmt(totalOrdCol)}</td>
            <td className="border border-gray-300 px-2 py-1 text-right font-mono font-bold">{fmt(totalBulkCol)}</td>
            <td className="border border-gray-300 px-2 py-1 text-right font-mono font-bold">{fmt(totalCollections)}</td>
            <td className="border border-gray-300 px-2 py-1 text-right font-mono font-bold">{totalCollPct.toFixed(2)}%</td>
          </tr>
        </tbody>
      </table>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // JSX
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 bg-white rounded-lg shadow-sm">

      {/* ── FORM ────────────────────────────────────────────────────────────── */}
      {!reportVisible && (
        <>
          <h1 className={`text-xl font-bold ${maroon} mb-4`}>
            Sales &amp; Collection – Region Wise
          </h1>

          {dropdownError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {dropdownError}
            </div>
          )}

          <form onSubmit={handleSubmit}>

            {/* Row 1 — Bill Cycle */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col">
                <label className={`text-xs font-medium mb-1 ${maroon}`}>
                  Select Month:
                </label>
                {isLoadingDropdowns ? (
                  <div className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md bg-gray-50 text-gray-500">
                    Loading bill cycles...
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

              {/* Report Type */}
              <div className="flex flex-col">
                <label className={`text-xs font-medium mb-1 ${!billCycle ? "text-gray-400" : maroon}`}>
                  Report Type:
                </label>
                <select
                  value={reportType}
                  onChange={e => setReportType(e.target.value)}
                  disabled={!billCycle}
                  className={`w-full px-2 py-1.5 text-xs border rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent ${
                    !billCycle
                      ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                      : "border-gray-300"
                  }`}
                >
                  <option value="EntireCEB">Entire CEB</option>
                  <option value="Province">Province</option>
                  <option value="Region">Region</option>
                </select>
              </div>

              {/* Province / Region dropdown (conditional) */}
              {reportType !== "EntireCEB" && (
                <div className="flex flex-col">
                  {reportType === "Province" && (
                    <>
                      <label className={`text-xs font-medium mb-1 ${!billCycle ? "text-gray-400" : maroon}`}>
                        Select Province:
                      </label>
                      <select
                        value={provinceName}
                        onChange={e => setProvinceName(e.target.value)}
                        disabled={!billCycle || isLoadingDropdowns}
                        className={`w-full px-2 py-1.5 text-xs border rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent
                          ${(!billCycle || isLoadingDropdowns)
                            ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                            : "border-gray-300"}`}
                        required
                      >
                        <option value="">Select Province</option>
                        {provinces.map(p => (
                          <option key={p.ProvinceCode} value={p.ProvinceName}>
                            {p.ProvinceCode} - {p.ProvinceName}
                          </option>
                        ))}
                      </select>
                    </>
                  )}

                  {reportType === "Region" && (
                    <>
                      <label className={`text-xs font-medium mb-1 ${!billCycle ? "text-gray-400" : maroon}`}>
                        Select Region:
                      </label>
                      <select
                        value={regionCode}
                        onChange={e => setRegionCode(e.target.value)}
                        disabled={!billCycle || isLoadingDropdowns}
                        className={`w-full px-2 py-1.5 text-xs border rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent
                          ${(!billCycle || isLoadingDropdowns)
                            ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                            : "border-gray-300"}`}
                        required
                      >
                        <option value="">Select Region</option>
                        {regions.map(r => (
                          <option key={r.RegionCode} value={r.RegionCode}>
                            {r.RegionCode} - {r.RegionName}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                </div>
              )}
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
                  <span className="flex items-center">
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

      {/* ── REPORT ──────────────────────────────────────────────────────────── */}
      {reportVisible && (
        <div className="mt-2">

          {/* Report header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
            <div>
              <h2 className={`text-lg font-bold ${maroon}`}>
                Sales &amp; Collection – Region Wise
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {reportType === "EntireCEB" ? "Entire CEB" : selectedSubLabel}
                {" "}| Bill Month: {selectedBillCycleDisplay}
              </p>
            </div>
            <div className="flex space-x-2 mt-2 md:mt-0">
              <button
                onClick={downloadAsCSV}
                className="flex items-center gap-1 px-3 py-1.5 border border-blue-400 text-blue-700
                           bg-white rounded-md text-xs font-medium shadow-sm hover:bg-blue-50 hover:text-blue-800
                           focus:outline-none focus:ring-2 focus:ring-blue-200 transition">
                <FaFileDownload className="w-3 h-3" /> CSV
              </button>
              <button
                onClick={printPDF}
                className="flex items-center gap-1 px-3 py-1.5 border border-green-400 text-green-700
                           bg-white rounded-md text-xs font-medium shadow-sm hover:bg-green-50 hover:text-green-800
                           focus:outline-none focus:ring-2 focus:ring-green-200 transition">
                <FaPrint className="w-3 h-3" /> PDF
              </button>
              <button
                onClick={() => { setReportVisible(false); setReportError(null); }}
                className="px-4 py-1.5 bg-[#7A0000] hover:bg-[#A52A2A] text-xs rounded-md text-white">
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

export default SalesAndCollection;