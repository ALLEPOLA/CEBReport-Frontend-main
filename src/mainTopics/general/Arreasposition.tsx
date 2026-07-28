import React, { useState, useEffect, useCallback } from "react";
import { useUser } from "../../contexts/UserContext";
import { useReportScope } from "../../hooks/useReportScope";

interface Area {
  areaCode: string;
  areaName: string;
}

interface AreasPositionRow {
  readerCode: string;
  monthlyBill: string;
  totalBalance: string;
  ratio: string;
  noOfAccounts: string;
}

async function apiFetch<T>(
  url: string
): Promise<{ data: T | null; errorMessage: string | null }> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      if (res.status === 404)
        throw new Error("API endpoint not found (404). Please check if the backend is running.");
      if (res.status === 500)
        throw new Error("Database error (500). Please check your database connection.");
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json"))
      throw new Error(`Expected JSON but got ${contentType}`);
    return await res.json();
  } catch (err: any) {
    if (err.name === "AbortError")
      return { data: null, errorMessage: "Request timeout. Please check your connection." };
    if (err.message.includes("Failed to fetch"))
      return {
        data: null,
        errorMessage: "Cannot connect to server. Please ensure the backend is running on port 44381.",
      };
    return { data: null, errorMessage: err.message };
  }
}

const parseNumber = (value: any): number => {
  if (value === undefined || value === null || value === "") return 0;
  if (typeof value === "number") return value;
  const num = parseFloat(String(value).replace(/,/g, ""));
  return isNaN(num) ? 0 : num;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const billCycleToLabel = (cycle: number): string => {
  const baseYear = 1988;
  const baseMonth = 8;
  const totalMonths = baseMonth + (cycle - 1);
  const year = baseYear + Math.floor(totalMonths / 12);
  const month = totalMonths % 12;
  const yy = String(year).slice(-2);
  return `${cycle} - ${MONTHS[month]} ${yy}`;
};

// Short label used in report exports (CSV / PDF), e.g. "452-Apr"
const billCycleToShortLabel = (cycle: number): string => {
  const baseMonth = 8;
  const totalMonths = baseMonth + (cycle - 1);
  const month = totalMonths % 12;
  return `${cycle}-${MONTHS[month]}`;
};

const AreasPosition: React.FC = () => {
  const maroon = "text-[#7A0000]";
  const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";

  const [areas, setAreas] = useState<Area[]>([]);
  const [billCycleOptions, setBillCycleOptions] = useState<string[]>([]);

  const [selectedArea, setSelectedArea] = useState("");
  const [selectedBillCycle, setSelectedBillCycle] = useState("");

  const [loadingAreas, setLoadingAreas] = useState(false);
  const [loadingCycles, setLoadingCycles] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);

  const [areaError, setAreaError] = useState<string | null>(null);
  const [cycleError, setCycleError] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  const [reportData, setReportData] = useState<AreasPositionRow[]>([]);
  const [resolvedBillCycle, setResolvedBillCycle] = useState("");
  const [selectedAreaName, setSelectedAreaName] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const { user } = useUser();
  const { locked } = useReportScope();

  const selectCls =
    "w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent";

  // ── 1. Fetch areas on mount ────────────────────────────────────────────────
  useEffect(() => {
    const fetchAreas = async () => {
      setLoadingAreas(true);
      setAreaError(null);
      try {
        let url = "/misapi/api/ordinary/areas";
        if (locked["Region"]?.code) {
          url += `?regionCode=${locked["Region"].code}`;
        } else if (locked["Province"]?.code) {
          url += `?provCode=${locked["Province"].code}`;
        }
        const response = await apiFetch<any[]>(url);
        if (response.errorMessage) {
          setAreaError(response.errorMessage);
        } else if (response.data && Array.isArray(response.data)) {
          setAreas(
            response.data.map((item: any) => ({
              areaCode: item.AreaCode || item.areaCode || "",
              areaName: item.AreaName || item.areaName || "",
            }))
          );
        } else {
          setAreaError("No areas data received from server.");
        }
      } catch (err: any) {
        setAreaError(err.message || "Failed to load areas.");
      } finally {
        setLoadingAreas(false);
      }
    };
    fetchAreas();
  }, [user.Level, user.RegionCode, user.ProvinceCode]);

  // ── 2. Fetch max bill cycle when area changes ──────────────────────────────
  useEffect(() => {
    if (!selectedArea) {
      setBillCycleOptions([]);
      setSelectedBillCycle("");
      setCycleError(null);
      return;
    }

    const fetchMaxCycle = async () => {
      setLoadingCycles(true);
      setCycleError(null);
      setSelectedBillCycle("");
      setBillCycleOptions([]);

      try {
        const response = await apiFetch<any>(
          `/misapi/api/billsmry/areas/arrears-position/billcycle/max?areaCode=${encodeURIComponent(selectedArea)}`
        );

        if (response.errorMessage) {
          setCycleError(response.errorMessage);
          return;
        }

        const raw = response.data as any;
        const maxCycle: string | undefined =
          typeof raw === "string" || typeof raw === "number"
            ? String(raw)
            : raw?.maxBillCycle ?? raw?.MaxBillCycle ?? raw?.billCycle ?? raw?.BillCycle ?? undefined;

        if (!maxCycle) {
          setCycleError("No bill cycle data found for this area.");
          return;
        }

        const max = parseInt(maxCycle, 10);
        if (isNaN(max)) {
          setCycleError("Invalid bill cycle value returned from server.");
          return;
        }

        const options: string[] = [];
        for (let i = 0; i < 24; i++) options.push(String(max - i));
        setBillCycleOptions(options);
        setSelectedBillCycle(options[0]);
      } catch (err: any) {
        setCycleError(err.message || "Failed to load bill cycles.");
      } finally {
        setLoadingCycles(false);
      }
    };

    fetchMaxCycle();
  }, [selectedArea]);

  useEffect(() => {
    if (locked["Area"]) {
      setSelectedArea(locked["Area"].code);
      setSelectedAreaName(
        locked["Area"].name ? `${locked["Area"].code} - ${locked["Area"].name}` : locked["Area"].code
      );
    }
  }, [user.Level, user.AreaCode, user.AreaName]);

  // ── 3. Fetch report ────────────────────────────────────────────────────────
  const fetchReport = useCallback(async () => {
    if (!selectedArea || !selectedBillCycle) return;

    const areaCodeSnapshot = selectedArea;
    const billCycleSnapshot = selectedBillCycle;
    const areaObj = areas.find((a) => a.areaCode === areaCodeSnapshot);
    const areaNameSnapshot = areaObj?.areaName ?? areaCodeSnapshot;

    setLoadingReport(true);
    setReportError(null);

    try {
      const reportResponse = await apiFetch<any>(
        `/misapi/api/arrears-position/report?billCycle=${encodeURIComponent(billCycleSnapshot)}&areaCode=${encodeURIComponent(areaCodeSnapshot)}`
      );

      if (reportResponse.errorMessage) {
        setReportError(reportResponse.errorMessage);
        return;
      }

      const raw = reportResponse.data as any;

      let rows: any[] = [];
      let returnedCycle: string = billCycleSnapshot;

      if (Array.isArray(raw)) {
        rows = raw;
      } else if (raw && Array.isArray(raw.data)) {
        rows = raw.data;
        returnedCycle = raw.billCycle ?? raw.BillCycle ?? billCycleSnapshot;
      } else if (raw && Array.isArray(raw.rows)) {
        rows = raw.rows;
        returnedCycle = raw.billCycle ?? raw.BillCycle ?? billCycleSnapshot;
      } else if (raw && Array.isArray(raw.result)) {
        rows = raw.result;
        returnedCycle = raw.billCycle ?? raw.BillCycle ?? billCycleSnapshot;
      } else if (raw && Array.isArray(raw.Results)) {
        rows = raw.Results;
        returnedCycle = raw.billCycle ?? raw.BillCycle ?? billCycleSnapshot;
      }

      if (!rows || rows.length === 0) {
        setReportError("No data available for the selected area and bill cycle.");
        return;
      }

      const mappedRows: AreasPositionRow[] = rows
        .map((item: any) => ({
          readerCode: String(item.ReaderCode ?? item.readerCode ?? ""),
          monthlyBill: String(item.Charge ?? item.charge ?? "0.00"),
          totalBalance: String(item.CrntBalance ?? item.crntBalance ?? item.CurrentBalance ?? item.currentBalance ?? "0.00"),
          ratio: String(item.Ratio ?? item.ratio ?? "0.00"),
          noOfAccounts: String(item.ReaderCount ?? item.readerCount ?? "0"),
        }))
        // Defensive filter: drop phantom reader groups with zero charge AND
        // zero balance (e.g. unassigned reader codes '0' / '01'). The backend
        // already excludes these via a HAVING clause, but this client-side
        // check guards against any dataset where that filter doesn't apply.
        .filter((row) => parseNumber(row.monthlyBill) !== 0 || parseNumber(row.totalBalance) !== 0);

      if (mappedRows.length === 0) {
        setReportError("No data available for the selected area and bill cycle.");
        return;
      }

      setReportData(mappedRows);
      setResolvedBillCycle(returnedCycle);
      setSelectedAreaName(areaNameSnapshot);
      setHasSearched(true);
    } catch (err: any) {
      setReportError(err.message || "Failed to fetch report data. Please try again.");
    } finally {
      setLoadingReport(false);
    }
  }, [selectedArea, selectedBillCycle, areas]);

  // ── Derived totals ─────────────────────────────────────────────────────────
  const totalMonthlyBill = reportData.reduce((s, r) => s + parseNumber(r.monthlyBill), 0);
  const totalBalance = reportData.reduce((s, r) => s + parseNumber(r.totalBalance), 0);
  const totalAccounts = reportData.reduce((s, r) => s + parseNumber(r.noOfAccounts), 0);

  // Short bill-cycle label used in exports, e.g. "452-Apr"
  const resolvedBillCycleShort = resolvedBillCycle
    ? billCycleToShortLabel(parseInt(resolvedBillCycle, 10))
    : "";

  const handleBackToForm = () => {
    setHasSearched(false);
    setReportData([]);
    setReportError(null);
    setResolvedBillCycle("");
  };

  // ── Export helpers ─────────────────────────────────────────────────────────
  const escapeCsv = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const handleExportCsv = () => {
    if (!reportData.length) { setReportError("No data to export."); return; }

    const metaRows: (string | number)[][] = [
      ["Arrears Position - Meter Reader Wise"],
      ["Area :", selectedAreaName],
      ["Bill Cycle :", resolvedBillCycleShort],
      [],
    ];

    const header = ["Reader Code", "Charge (Monthly Bill)", "Current Balance", "Ratio", "Reader Count"];
    const rows = reportData.map((r) => [r.readerCode, r.monthlyBill, r.totalBalance, r.ratio, r.noOfAccounts]);
    const totalRow = ["Total", totalMonthlyBill.toFixed(2), totalBalance.toFixed(2), "", totalAccounts.toString()];

    const csv = [...metaRows, header, ...rows, totalRow]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\r\n");

    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    link.download = `ArrearsPosition_${selectedArea}_${resolvedBillCycleShort || resolvedBillCycle}.csv`;
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPdf = () => {
    if (!reportData.length) { setReportError("No data to export."); return; }
    const title = "Arrears Position \u2013 Meter Reader Wise";
    const rowsHtml = reportData.map((r) => `<tr>
      <td style="border:1px solid #ddd;padding:4px 6px;text-align:center;font-size:10px">${escapeCsv(r.readerCode)}</td>
      <td style="border:1px solid #ddd;padding:4px 6px;text-align:right;font-size:10px">${r.monthlyBill}</td>
      <td style="border:1px solid #ddd;padding:4px 6px;text-align:right;font-size:10px">${r.totalBalance}</td>
      <td style="border:1px solid #ddd;padding:4px 6px;text-align:right;font-size:10px">${r.ratio}</td>
      <td style="border:1px solid #ddd;padding:4px 6px;text-align:right;font-size:10px">${r.noOfAccounts}</td>
    </tr>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title>
<style>
  body{font-family:Arial,sans-serif;margin:10mm;font-size:10px;color:#111}
  .header{font-weight:bold;color:#7A0000;font-size:12px;margin-bottom:5px}
  .subheader{font-size:11px;margin-bottom:2px}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  th{background:#d3d3d3;font-weight:bold;text-align:center;padding:4px 6px;border:1px solid #ddd;font-size:10px}
  td{padding:4px 6px;border:1px solid #ddd;font-size:10px;vertical-align:top}
  tr:nth-child(even){background:#f9f9f9}
  .total-row td{background:#e8e8e8;font-weight:bold}
  @page{size:A4 landscape;margin:12mm}
</style>
</head><body>
<div class="header">${title}</div>
<div class="subheader"><strong>Area: ${selectedAreaName}</strong></div>
<div class="subheader"><strong>Bill Cycle: ${resolvedBillCycleShort}</strong></div>
<br/>
<table><thead><tr>
  <th>Reader Code</th>
  <th style="text-align:right">Charge (Monthly Bill)</th>
  <th style="text-align:right">Current Balance</th>
  <th style="text-align:right">Ratio</th>
  <th style="text-align:right">Reader Count</th>
</tr></thead>
<tbody>${rowsHtml}</tbody>
<tfoot><tr class="total-row">
  <td><b>Total</b></td>
  <td style="text-align:right"><b>${totalMonthlyBill.toLocaleString("en-US", { minimumFractionDigits: 2 })}</b></td>
  <td style="text-align:right"><b>${totalBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}</b></td>
  <td></td>
  <td style="text-align:right"><b>${totalAccounts.toLocaleString("en-US")}</b></td>
</tr></tfoot>
</table></body></html>`;
    const w = window.open("", "_blank");
    if (!w) { setReportError("Popup blocked. Please allow popups to export PDF."); return; }
    w.document.open(); w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => { w.print(); setTimeout(() => w.close(), 500); }, 250);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 bg-white rounded-lg shadow-sm">

      {/* ── FORM ──────────────────────────────────────────────────────────── */}
      {!hasSearched && (
        <>
          <h1 className={`text-xl font-bold ${maroon} mb-4`}>
            Arrears Position – Meter Reader Wise
          </h1>

          <div className="space-y-4">

            {/* Row 1 – Area */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col">
                <label className={`text-xs font-medium mb-1 ${maroon}`}>
                  Select Area: <span className="text-red-600">*</span>
                </label>
                {loadingAreas ? (
                  <div className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md bg-gray-50 text-gray-500">
                    Loading areas...
                  </div>
                ) : areaError ? (
                  <div className="w-full px-2 py-1.5 text-xs border border-red-300 rounded-md bg-red-50 text-red-600">
                    {areaError}
                  </div>
                ) : locked["Area"] ? (
                  <select
                    disabled
                    value={locked["Area"].code}
                    className="w-full px-2 py-1.5 text-xs border rounded-md bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                  >
                    <option value={locked["Area"].code}>
                      {locked["Area"].name ? `${locked["Area"].code} - ${locked["Area"].name}` : locked["Area"].code}
                    </option>
                  </select>
                ) : (
                  <select
                    value={selectedArea}
                    onChange={(e) => {
                      setSelectedArea(e.target.value);
                      setReportError(null);
                    }}
                    className={selectCls}
                  >
                    <option value="">Select Area</option>
                    {areas.map((area) => (
                      <option key={area.areaCode} value={area.areaCode}>
                        {area.areaCode} – {area.areaName}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Row 1 – Bill Cycle (aligned alongside Area, mirroring RoofTop layout) */}
              <div className="flex flex-col">
                <label className={`text-xs font-medium mb-1 ${!selectedArea ? "text-gray-400" : maroon}`}>
                  Select Bill Cycle: <span className="text-red-600">*</span>
                </label>
                {!selectedArea ? (
                  <div className="w-full px-2 py-1.5 text-xs border rounded-md bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed">
                    Please select an area first
                  </div>
                ) : loadingCycles ? (
                  <div className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md bg-gray-50 text-gray-500">
                    Loading bill cycles...
                  </div>
                ) : cycleError ? (
                  <div className="w-full px-2 py-1.5 text-xs border border-red-300 rounded-md bg-red-50 text-red-600">
                    {cycleError}
                  </div>
                ) : billCycleOptions.length === 0 ? (
                  <div className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md bg-gray-50 text-gray-500">
                    No bill cycles available for selected area
                  </div>
                ) : (
                  <select
                    value={selectedBillCycle}
                    onChange={(e) => setSelectedBillCycle(e.target.value)}
                    disabled={!selectedArea}
                    className={`w-full px-2 py-1.5 text-xs border rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent ${!selectedArea ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed" : "border-gray-300"
                      }`}
                  >
                    {billCycleOptions.map((cycle) => (
                      <option key={cycle} value={cycle}>
                        {billCycleToLabel(parseInt(cycle, 10))}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Submit */}
            <div className="w-full mt-6 flex justify-end">
              <button
                onClick={fetchReport}
                disabled={loadingReport || !selectedArea || !selectedBillCycle}
                className={`px-6 py-2 rounded-md font-medium transition-opacity duration-300 shadow
                  ${maroonGrad} text-white
                  ${loadingReport || !selectedArea || !selectedBillCycle
                    ? "opacity-70 cursor-not-allowed"
                    : "hover:opacity-90"}`}
              >
                {loadingReport ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Loading...
                  </span>
                ) : (
                  "Generate Report"
                )}
              </button>
            </div>
          </div>

          {reportError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {reportError}
            </div>
          )}
        </>
      )}

      {/* ── REPORT ────────────────────────────────────────────────────────── */}
      {hasSearched && (
        <div className="mt-2">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
            <div>
              <h2 className={`text-lg font-bold ${maroon}`}>
                Arrears Position – Meter Reader Wise
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Area: {selectedAreaName}
                {resolvedBillCycleShort && (
                  <> | Bill Cycle: {resolvedBillCycleShort}</>
                )}
              </p>
            </div>

            <div className="flex space-x-2 mt-2 md:mt-0">
              {/* CSV */}
              <button
                onClick={handleExportCsv}
                disabled={!reportData.length}
                className={`flex items-center gap-1 px-3 py-1.5 border border-blue-400 rounded-md text-xs font-medium shadow-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-200 transition
                  ${!reportData.length
                    ? "text-blue-300 bg-gray-50 cursor-not-allowed"
                    : "text-blue-700 bg-white hover:bg-blue-50 hover:text-blue-800"}`}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5l2 2h5a2 2 0 012 2v12a2 2 0 01-2 2z" />
                </svg>
                CSV
              </button>

              {/* PDF */}
              <button
                onClick={handleExportPdf}
                disabled={!reportData.length}
                className={`flex items-center gap-1 px-3 py-1.5 border border-green-400 rounded-md text-xs font-medium shadow-sm
                  focus:outline-none focus:ring-2 focus:ring-green-200 transition
                  ${!reportData.length
                    ? "text-green-300 bg-gray-50 cursor-not-allowed"
                    : "text-green-700 bg-white hover:bg-green-50 hover:text-green-800"}`}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                PDF
              </button>

              {/* Back */}
              <button
                onClick={handleBackToForm}
                className="px-4 py-1.5 bg-[#7A0000] hover:bg-[#A52A2A] text-xs rounded-md text-white flex items-center"
              >
                Back to Form
              </button>
            </div>
          </div>

          {/* Scrollable table */}
          <div className="overflow-x-auto max-h-[calc(100vh-250px)] border border-gray-300 rounded-lg">
            <div className="min-w-full py-4">
              <table className="w-full border-collapse text-xs">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="border border-gray-300 px-2 py-1 text-center">Reader Code</th>
                    <th className="border border-gray-300 px-2 py-1 text-center">Charge (Monthly Bill)</th>
                    <th className="border border-gray-300 px-2 py-1 text-center">Current Balance</th>
                    <th className="border border-gray-300 px-2 py-1 text-center">Ratio</th>
                    <th className="border border-gray-300 px-2 py-1 text-center">Reader Count</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((r, i) => (
                    <tr key={`${r.readerCode}-${i}`} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="border border-gray-300 px-2 py-1 text-center">{r.readerCode}</td>
                      <td className="border border-gray-300 px-2 py-1 text-right">{r.monthlyBill}</td>
                      <td className="border border-gray-300 px-2 py-1 text-right">{r.totalBalance}</td>
                      <td className="border border-gray-300 px-2 py-1 text-right">{r.ratio}</td>
                      <td className="border border-gray-300 px-2 py-1 text-right">{r.noOfAccounts}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-200 font-bold sticky bottom-0">
                    <td className="border border-gray-300 px-2 py-1 text-center">TOTAL</td>
                    <td className="border border-gray-300 px-2 py-1 text-right">
                      {totalMonthlyBill.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-right">
                      {totalBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-right">—</td>
                    <td className="border border-gray-300 px-2 py-1 text-right">
                      {totalAccounts.toLocaleString("en-US")}
                    </td>
                  </tr>
                </tfoot>
              </table>
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

export default AreasPosition;