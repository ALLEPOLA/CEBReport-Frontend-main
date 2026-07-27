import React, { useState, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface TopCustomerRecord {
  accountNumber: string;
  name: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  kwh: number;
  totalAmount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
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

const fmt = (n: number, decimals = 2) =>
  n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const extractBillCycle = (payload: any): string => {
  const data = payload?.data ?? payload ?? {};
  return String(
    data?.BillCycle ?? data?.billCycle ?? data?.bill_cycle ??
    data?.MaxBillCycle ?? data?.maxBillCycle ?? ""
  ).trim();
};

const extractRecords = (payload: any): any[] => {
  const data = payload?.data ?? payload ?? {};
  return data?.records ?? data?.Records ?? [];
};

const escapeCsv = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const downloadTextFile = (filename: string, content: string, mime = "text/plain;charset=utf-8") => {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
const TopCustomers: React.FC = () => {
  const maroon     = "text-[#7A0000]";
  const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";

  // ── Form state ──────────────────────────────────────────────────────────────
  const [takeCount, setTakeCount] = useState<number>(100);

  // ── Loading / error ─────────────────────────────────────────────────────────
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportError, setReportError]     = useState("");

  // ── Report state ─────────────────────────────────────────────────────────────
  const [reportData, setReportData]               = useState<TopCustomerRecord[]>([]);
  const [resolvedBillCycle, setResolvedBillCycle] = useState("");
  const [hasSearched, setHasSearched]             = useState(false);

  // ── Search / filter ──────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");

  // ── Fetch report — always uses max bill cycle from the backend ────────────────
  const fetchReport = useCallback(async () => {
    const takeSnapshot = takeCount <= 0 ? 100 : takeCount;

    setLoadingReport(true);
    setReportError("");

    try {
      const response = await apiFetch<any>(
        `/misapi/api/dashboard/top-customers/list?take=${takeSnapshot}`
      );

      if (response.errorMessage) {
        setReportError(response.errorMessage);
        return;
      }

      const records = extractRecords(response.data);
      if (!Array.isArray(records) || records.length === 0) {
        setReportError("No data available for the current bill cycle.");
        return;
      }

      const mapped: TopCustomerRecord[] = records.map((item: any) => ({
        accountNumber: item.AccountNumber ?? item.accountNumber ?? "",
        name:          item.Name          ?? item.name          ?? "",
        addressLine1:  item.AddressLine1  ?? item.addressLine1  ?? "",
        addressLine2:  item.AddressLine2  ?? item.addressLine2  ?? "",
        city:          item.City          ?? item.city          ?? "",
        kwh:           Number(item.Kwh    ?? item.kwh           ?? 0),
        totalAmount:   Number(item.TotalAmount ?? item.totalAmount ?? 0),
      }));

      setReportData(mapped);
      setResolvedBillCycle(extractBillCycle(response.data) || "—");
      setHasSearched(true);
      setSearchQuery("");
    } catch (err: any) {
      setReportError(err.message || "Failed to fetch report data. Please try again.");
    } finally {
      setLoadingReport(false);
    }
  }, [takeCount]);

  // ── Filtered rows ─────────────────────────────────────────────────────────────
  const filteredData = searchQuery.trim()
    ? reportData.filter((r) => {
        const q = searchQuery.toLowerCase();
        return (
          r.accountNumber.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q) ||
          r.city.toLowerCase().includes(q) ||
          r.addressLine1.toLowerCase().includes(q)
        );
      })
    : reportData;

  // ── Shared UI helpers ─────────────────────────────────────────────────────────
  const spinnerIcon = (
    <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );

  const handleBackToForm = () => {
    setHasSearched(false);
    setReportData([]);
    setReportError("");
    setResolvedBillCycle("");
    setSearchQuery("");
  };

  // ── Export CSV ────────────────────────────────────────────────────────────────
  const handleExportCsv = () => {
    if (!reportData.length) { setReportError("No data to export."); return; }

    const totalKwh    = reportData.reduce((s, r) => s + r.kwh, 0);
    const totalAmount = reportData.reduce((s, r) => s + r.totalAmount, 0);

    const metaRows: (string | number)[][] = [
      ["Largest 100 Customers - Consumption Wise"],
      ["Bill Cycle :", resolvedBillCycle],
      ["Customer Count :", reportData.length],
      [],
    ];

    const header = ["Acct. Number", "Name", "Address Line 1", "Address Line 2", "City", "Total KWH", "Total Amount"];

    const rows = reportData.map((r) => [
      r.accountNumber,
      r.name,
      r.addressLine1,
      r.addressLine2,
      r.city,
      r.kwh.toFixed(0),
      r.totalAmount.toFixed(2),
    ]);

    const totalRow = ["", "", "", "", "Total :", totalKwh.toFixed(0), totalAmount.toFixed(2)];

    const csv = [...metaRows, header, ...rows, totalRow]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\r\n");

    downloadTextFile(
      `top-customers_cycle-${resolvedBillCycle}_${new Date().toISOString().slice(0, 10)}.csv`,
      csv,
      "text/csv;charset=utf-8"
    );
  };

  // ── Export PDF ────────────────────────────────────────────────────────────────
  const handleExportPdf = () => {
    if (!reportData.length) { setReportError("No data to export."); return; }
    const title    = "Largest 100 Customers by Consumption";
    const subtitle = `Bill Cycle: ${resolvedBillCycle} &nbsp;|&nbsp; Top ${reportData.length} Customers`;
    const totalKwh    = reportData.reduce((s, r) => s + r.kwh, 0);
    const totalAmount = reportData.reduce((s, r) => s + r.totalAmount, 0);

    const rowsHtml = reportData.map((r, i) => `<tr>
      <td style="border:1px solid #ddd;padding:4px 6px;text-align:center;font-size:10px">${i + 1}</td>
      <td style="border:1px solid #ddd;padding:4px 6px;font-size:10px">${escapeCsv(r.accountNumber)}</td>
      <td style="border:1px solid #ddd;padding:4px 6px;font-size:10px">${escapeCsv(r.name)}</td>
      <td style="border:1px solid #ddd;padding:4px 6px;font-size:10px">${escapeCsv(r.addressLine1)}${r.addressLine2 ? ", " + escapeCsv(r.addressLine2) : ""}</td>
      <td style="border:1px solid #ddd;padding:4px 6px;font-size:10px">${escapeCsv(r.city)}</td>
      <td style="border:1px solid #ddd;padding:4px 6px;text-align:right;font-size:10px">${fmt(r.kwh, 0)}</td>
      <td style="border:1px solid #ddd;padding:4px 6px;text-align:right;font-size:10px">${fmt(r.totalAmount)}</td>
    </tr>`).join("");

    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title>
<style>
  body{font-family:Arial,sans-serif;margin:10mm;font-size:10px;color:#111}
  .header{font-weight:bold;color:#7A0000;font-size:12px;margin-bottom:5px}
  .subheader{font-size:11px;margin-bottom:2px}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  th{background:#d3d3d3;font-weight:bold;text-align:center;padding:4px 6px;border:1px solid #ddd;font-size:10px}
  th.r,td.r{text-align:right}
  td{padding:4px 6px;border:1px solid #ddd;font-size:10px;vertical-align:top}
  tr:nth-child(even){background:#f9f9f9}
  tfoot td{font-weight:bold;background:#e8e8e8}
  @page{size:A4 landscape;margin:12mm}
</style>
</head><body>
<div class="header">${title}</div>
<div class="subheader"><strong>${subtitle}</strong></div>
<br/>
<table>
  <thead><tr>
    <th style="width:28px">#</th><th>Account No.</th><th>Customer Name</th>
    <th>Address</th><th>City</th>
    <th class="r">Consumption (kWh)</th><th class="r">Total Amount</th>
  </tr></thead>
  <tbody>${rowsHtml}</tbody>
  <tfoot><tr>
    <td colspan="5" style="text-align:right">Total</td>
    <td class="r">${fmt(totalKwh, 0)}</td>
    <td class="r">${fmt(totalAmount)}</td>
  </tr></tfoot>
</table></body></html>`;

    const w = window.open("", "_blank");
    if (!w) { setReportError("Popup blocked. Please allow popups to export PDF."); return; }
    w.document.open(); w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => { w.print(); setTimeout(() => w.close(), 500); }, 250);
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 bg-white rounded-lg shadow-md">

      {/* ── FORM (unchanged) ─────────────────────────────────────────────────── */}
      {!hasSearched && (
        <>
          <div className="mb-6">
            <h2 className={`text-xl font-bold ${maroon}`}>
              Largest 100 Customers – Consumption Wise
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Displays top customers for the latest bill cycle
            </p>
          </div>

          <div className="space-y-5">

            {/* ── Number of Customers ─────────────────────────────────────────── */}
            <div className="flex flex-col">
              <label className={`text-xs font-medium mb-2 ${maroon}`}>
                Number of Top Customers:
              </label>
              <div className="flex flex-wrap items-center gap-4">
                {[10, 25, 50, 100].map((n) => (
                  <label key={n} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="takeCount"
                      value={n}
                      checked={takeCount === n}
                      onChange={() => setTakeCount(n)}
                      className="accent-[#7A0000]"
                    />
                    <span className="text-xs text-gray-700">{n}</span>
                  </label>
                ))}
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="takeCount"
                    checked={![10, 25, 50, 100].includes(takeCount)}
                    onChange={() => setTakeCount(0)}
                    className="accent-[#7A0000]"
                  />
                  <span className="text-xs text-gray-700">Custom:</span>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={![10, 25, 50, 100].includes(takeCount) && takeCount > 0 ? takeCount : ""}
                    onChange={(e) => setTakeCount(Number(e.target.value))}
                    onFocus={() => { if ([10, 25, 50, 100].includes(takeCount)) setTakeCount(0); }}
                    placeholder="e.g. 200"
                    className="w-20 px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent"
                  />
                </label>
              </div>
            </div>

            {/* ── Submit button ───────────────────────────────────────────────── */}
            <div>
              <button
                onClick={fetchReport}
                disabled={loadingReport || takeCount <= 0}
                className={`px-5 py-1.5 rounded-md font-medium text-xs shadow transition-opacity
                  ${maroonGrad} text-white
                  ${loadingReport || takeCount <= 0
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:opacity-90"}`}
              >
                {loadingReport
                  ? <span className="flex items-center gap-2">{spinnerIcon} Loading...</span>
                  : "Generate Report"}
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

      {/* ── REPORT (restyled to match RoofTopSolarInputData) ────────────────── */}
      {hasSearched && (
        <div className="mt-2">

          {/* Report header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-2">
            <div>
              <h2 className={`text-lg font-bold ${maroon}`}>
                Largest Customers – Consumption Wise
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Bill Cycle: {resolvedBillCycle} | Top {reportData.length} Customers
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {/* Search filter */}
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, acc, city…"
                className="px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent w-44"
              />

              {/* CSV */}
              <button
                onClick={handleExportCsv}
                disabled={!reportData.length}
                className={`flex items-center gap-1 px-3 py-1.5 border border-blue-400 rounded-md text-xs font-medium shadow-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-200 transition
                  ${!reportData.length ? "text-blue-300 bg-gray-50 cursor-not-allowed" : "text-blue-700 bg-white hover:bg-blue-50 hover:text-blue-800"}`}
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
                  ${!reportData.length ? "text-green-300 bg-gray-50 cursor-not-allowed" : "text-green-700 bg-white hover:bg-green-50 hover:text-green-800"}`}
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
                className="px-4 py-1.5 bg-[#7A0000] hover:bg-[#A52A2A] text-xs rounded-md text-white"
              >
                Back to Form
              </button>
            </div>
          </div>

          {/* Search result count */}
          {searchQuery.trim() && (
            <p className="text-xs text-gray-500 mb-2">
              Showing {filteredData.length} of {reportData.length} results for &ldquo;{searchQuery}&rdquo;
            </p>
          )}

          {/* Table */}
          <div className="overflow-x-auto max-h-[calc(100vh-350px)] border border-gray-300 rounded-lg">
            <div className="min-w-full py-4">
              <table className="w-full border-collapse text-xs">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="border border-gray-300 px-2 py-1 text-center w-10">#</th>
                    <th className="border border-gray-300 px-2 py-1 text-center">Account No.</th>
                    <th className="border border-gray-300 px-2 py-1 text-center">Customer Name</th>
                    <th className="border border-gray-300 px-2 py-1 text-center">Address Line 1</th>
                    <th className="border border-gray-300 px-2 py-1 text-center">Address Line 2</th>
                    <th className="border border-gray-300 px-2 py-1 text-center">City</th>
                    <th className="border border-gray-300 px-2 py-1 text-center">Consumption (kWh)</th>
                    <th className="border border-gray-300 px-2 py-1 text-center">Total Amount</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredData.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="border border-gray-300 px-2 py-6 text-center text-gray-400">
                        No records match your search.
                      </td>
                    </tr>
                  ) : (
                    filteredData.map((r, i) => (
                      <tr key={`${r.accountNumber}-${i}`} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="border border-gray-300 px-2 py-1 text-center text-gray-400">
                          {reportData.indexOf(r) + 1}
                        </td>
                        <td className="border border-gray-300 px-2 py-1">{r.accountNumber}</td>
                        <td className="border border-gray-300 px-2 py-1">{r.name}</td>
                        <td className="border border-gray-300 px-2 py-1">{r.addressLine1}</td>
                        <td className="border border-gray-300 px-2 py-1">{r.addressLine2}</td>
                        <td className="border border-gray-300 px-2 py-1">{r.city}</td>
                        <td className="border border-gray-300 px-2 py-1 text-right">{fmt(r.kwh, 0)}</td>
                        <td className="border border-gray-300 px-2 py-1 text-right">{fmt(r.totalAmount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {filteredData.length > 0 && (
                <p className="text-xs text-gray-500 mt-2 text-right px-2">
                  Total records: {filteredData.length.toLocaleString()}
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

export default TopCustomers;