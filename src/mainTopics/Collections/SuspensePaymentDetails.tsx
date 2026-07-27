import React, { useState, useCallback } from "react";
import { FaFileDownload, FaPrint } from "react-icons/fa";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface SuspenseRow {
  province: string;
  areaCode: string;
  areaName: string; // already "{code} - {name}" from backend
  accountNumber: string;
  billCycle: string;
  creditCode: string; // ordinary only
  suspenseAmount: number;
  transacDate: string;
  paymentDate: string;
  postDate: string; // ordinary only
  stubNo: string;
  counterNo: string;
}

interface GroupedArea {
  areaName: string;
  rows: SuspenseRow[];
  total: number;
}

interface GroupedProvince {
  province: string;
  areas: GroupedArea[];
  total: number;
  count: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
async function apiFetch<T>(url: string): Promise<{ data: T | null; errorMessage: string | null }> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) {
      if (res.status === 404) throw new Error("API endpoint not found (404). Please check if the backend is running.");
      if (res.status === 500) throw new Error("Database error (500). Please check your database connection.");
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) throw new Error(`Expected JSON but got ${contentType}`);
    return await res.json();
  } catch (err: any) {
    if (err.name === "AbortError") return { data: null, errorMessage: "Request timeout. Please check your connection." };
    if (err.message?.includes("Failed to fetch"))
      return { data: null, errorMessage: "Cannot connect to server. Please ensure the backend is running." };
    return { data: null, errorMessage: err.message };
  }
}

const parseNumber = (value: any): number => {
  if (value === undefined || value === null || value === "") return 0;
  if (typeof value === "number") return value;
  const num = parseFloat(String(value).replace(/,/g, ""));
  return isNaN(num) ? 0 : num;
};

const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const buildGroups = (rows: SuspenseRow[]): GroupedProvince[] => {
  const provMap = new Map<string, GroupedProvince>();

  for (const r of rows) {
    const provKey = r.province || "Unknown";
    let prov = provMap.get(provKey);
    if (!prov) {
      prov = { province: provKey, areas: [], total: 0, count: 0 };
      provMap.set(provKey, prov);
    }

    const areaKey = r.areaName || r.areaCode || "Unknown";
    let area = prov.areas.find((a) => a.areaName === areaKey);
    if (!area) {
      area = { areaName: areaKey, rows: [], total: 0 };
      prov.areas.push(area);
    }

    area.rows.push(r);
    area.total += r.suspenseAmount;
    prov.total += r.suspenseAmount;
    prov.count += 1;
  }

  return Array.from(provMap.values());
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
const SuspensePaymentDetails: React.FC = () => {
  const maroon = "text-[#7A0000]";
  const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";
  const selectCls =
    "w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent";

  // ── Form state ──────────────────────────────────────────────────────────
  const [billType, setBillType] = useState<"O" | "B">("B"); // Bulk selected by default, matches sample
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // ── Loading / errors ────────────────────────────────────────────────────
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  // ── Report state ────────────────────────────────────────────────────────
  const [reportData, setReportData] = useState<SuspenseRow[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [resolvedFromDate, setResolvedFromDate] = useState("");
  const [resolvedToDate, setResolvedToDate] = useState("");
  const [resolvedBillType, setResolvedBillType] = useState<"O" | "B">("B");

  const isOrdinary = resolvedBillType === "O";
  const preAmountCols = 2 + (isOrdinary ? 1 : 0); // Account No, Bill Cycle, [Credit Code]
  const postAmountCols = 4 + (isOrdinary ? 1 : 0); // Transac Date, Payment Date, [Post Date], Stub No, Counter No

  // ── Fetch report ─────────────────────────────────────────────────────────
  const fetchReport = useCallback(async () => {
    if (!fromDate || !toDate) return;

    setLoadingReport(true);
    setReportError(null);

    try {
      const isBulk = billType === "B";
      const url = `/misapi/api/suspense-payment-details?fromDate=${encodeURIComponent(
        fromDate
      )}&toDate=${encodeURIComponent(toDate)}&isBulk=${isBulk}`;

      const res = await apiFetch<any>(url);
      if (res.errorMessage) {
        setReportError(res.errorMessage);
        return;
      }

      const raw = res.data as any;
      const arr: any[] = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];

      if (!arr.length) {
        setReportError("No data found for the selected criteria.");
        return;
      }

      const rows: SuspenseRow[] = arr.map((item) => ({
        province: item.Province ?? item.province ?? "",
        areaCode: item.AreaCode ?? item.areaCode ?? "",
        areaName: item.AreaName ?? item.areaName ?? "",
        accountNumber: item.AccountNumber ?? item.accountNumber ?? "",
        billCycle: item.BillCycle ?? item.billCycle ?? "",
        creditCode: item.CreditCode ?? item.creditCode ?? "",
        suspenseAmount: parseNumber(item.SuspenseAmount ?? item.suspenseAmount),
        transacDate: item.TransacDate ?? item.transacDate ?? "",
        paymentDate: item.PaymentDate ?? item.paymentDate ?? "",
        postDate: item.PostDate ?? item.postDate ?? "",
        stubNo: item.StubNo ?? item.stubNo ?? "",
        counterNo: item.CounterNo ?? item.counterNo ?? "",
      }));

      setReportData(rows);
      setResolvedFromDate(fromDate);
      setResolvedToDate(toDate);
      setResolvedBillType(billType);
      setHasSearched(true);
    } catch (err: any) {
      setReportError(err.message || "Failed to fetch report data.");
    } finally {
      setLoadingReport(false);
    }
  }, [fromDate, toDate, billType]);

  const groups = buildGroups(reportData);
  const grandTotal = reportData.reduce((s, r) => s + r.suspenseAmount, 0);

  const handleBackToForm = () => {
    setHasSearched(false);
    setReportData([]);
    setReportError(null);
  };

  // ── Export helpers ──────────────────────────────────────────────────────
  const escapeCsv = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const handleExportCsv = () => {
    if (!reportData.length) {
      setReportError("No data to export.");
      return;
    }

    const metaRows: (string | number)[][] = [
      ["Suspense Payment Details (Online Payments)"],
      ["Customer Type :", isOrdinary ? "Ordinary" : "Bulk"],
      ["Date :", `${resolvedFromDate} to ${resolvedToDate}`],
      [],
    ];

    const header = [
      "Province",
      "Area",
      "Account Number",
      "Bill Cycle",
      ...(isOrdinary ? ["Credit Code"] : []),
      "Suspense Amount",
      "Transac Date",
      "Payment Date",
      ...(isOrdinary ? ["Post Date"] : []),
      "Stub No",
      "Counter No",
    ];

    const rows = reportData.map((r) => [
      r.province,
      r.areaName,
      r.accountNumber,
      r.billCycle,
      ...(isOrdinary ? [r.creditCode] : []),
      fmt(r.suspenseAmount),
      r.transacDate,
      r.paymentDate,
      ...(isOrdinary ? [r.postDate] : []),
      r.stubNo,
      r.counterNo,
    ]);

    const totalRow = [
      "Total",
      "",
      "",
      "",
      ...(isOrdinary ? [""] : []),
      fmt(grandTotal),
      "",
      "",
      ...(isOrdinary ? [""] : []),
      "",
      "",
    ];

    const csv = [...metaRows, header, ...rows, totalRow].map((row) => row.map(escapeCsv).join(",")).join("\r\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    link.download = `SuspensePaymentDetails_${isOrdinary ? "Ordinary" : "Bulk"}_${resolvedFromDate}_to_${resolvedToDate}.csv`;
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPdf = () => {
    if (!reportData.length) {
      setReportError("No data to export.");
      return;
    }

    const title = "Suspense Payment Details (Online Payments)";

    const rowsHtml = reportData
      .map(
        (r) => `<tr>
      <td style="border:1px solid #ccc;padding:3px 4px;text-align:left;font-size:9px">${escapeCsv(r.province)}</td>
      <td style="border:1px solid #ccc;padding:3px 4px;text-align:left;font-size:9px">${escapeCsv(r.areaName)}</td>
      <td style="border:1px solid #ccc;padding:3px 4px;text-align:center;font-size:9px">${escapeCsv(r.accountNumber)}</td>
      <td style="border:1px solid #ccc;padding:3px 4px;text-align:center;font-size:9px">${escapeCsv(r.billCycle)}</td>
      ${isOrdinary ? `<td style="border:1px solid #ccc;padding:3px 4px;text-align:center;font-size:9px">${escapeCsv(r.creditCode)}</td>` : ""}
      <td style="border:1px solid #ccc;padding:3px 4px;text-align:right;font-size:9px">${fmt(r.suspenseAmount)}</td>
      <td style="border:1px solid #ccc;padding:3px 4px;text-align:center;font-size:9px">${escapeCsv(r.transacDate)}</td>
      <td style="border:1px solid #ccc;padding:3px 4px;text-align:center;font-size:9px">${escapeCsv(r.paymentDate)}</td>
      ${isOrdinary ? `<td style="border:1px solid #ccc;padding:3px 4px;text-align:center;font-size:9px">${escapeCsv(r.postDate)}</td>` : ""}
      <td style="border:1px solid #ccc;padding:3px 4px;text-align:center;font-size:9px">${escapeCsv(r.stubNo)}</td>
      <td style="border:1px solid #ccc;padding:3px 4px;text-align:center;font-size:9px">${escapeCsv(r.counterNo)}</td>
    </tr>`
      )
      .join("");

    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title>
<style>
  body{font-family:Arial,sans-serif;margin:8mm;color:#111}
  h2{color:#7A0000;font-size:13px;margin-bottom:6px}
  .meta{font-size:11px;margin-bottom:10px}
  .meta span{font-weight:bold}
  table{width:100%;border-collapse:collapse;margin-top:6px}
  th{background:#d3d3d3;font-weight:bold;text-align:center;padding:4px 3px;border:1px solid #aaa;font-size:9px}
  td{padding:3px;border:1px solid #ccc;font-size:9px;vertical-align:top}
  tr:nth-child(even){background:#f9f9f9}
  .total-row td{background:#d3d3d3;font-weight:bold}
  @page{size:A4 landscape;margin:8mm}
</style>
</head><body>
<h2>${title}</h2>
<div class="meta">Customer Type : &nbsp;<span>${isOrdinary ? "Ordinary" : "Bulk"}</span> &nbsp;|&nbsp; Date : &nbsp;<span>${resolvedFromDate} to ${resolvedToDate}</span></div>
<table><thead><tr>
  <th>Province</th><th>Area</th><th>Account Number</th><th>Bill Cycle</th>
  ${isOrdinary ? "<th>Credit Code</th>" : ""}
  <th>Suspense Amount</th><th>Transac Date</th><th>Payment Date</th>
  ${isOrdinary ? "<th>Post Date</th>" : ""}
  <th>Stub No</th><th>Counter No</th>
</tr></thead>
<tbody>${rowsHtml}</tbody>
<tfoot><tr class="total-row">
  <td colspan="${isOrdinary ? 5 : 4}"><b>Total</b></td>
  <td style="text-align:right"><b>${fmt(grandTotal)}</b></td>
  <td colspan="${isOrdinary ? 5 : 4}"></td>
</tr></tfoot>
</table></body></html>`;

    const w = window.open("", "_blank");
    if (!w) {
      setReportError("Popup blocked. Please allow popups to export PDF.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => {
      w.print();
      setTimeout(() => w.close(), 500);
    }, 250);
  };

  const canSubmit = !!fromDate && !!toDate && !loadingReport;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-4 bg-white rounded-lg shadow-sm">
      {!hasSearched && (
        <>
          <h1 className={`text-xl font-bold ${maroon} mb-4`}>Suspense Payment Details (Online Payments)</h1>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Customer Type */}
            <div className="flex flex-col">
              <label className={`text-xs font-medium mb-1 ${maroon}`}>Customer Type:</label>
              <div className="flex items-center gap-6 mt-1.5">
                <label className="flex items-center gap-2 text-xs text-gray-700">
                  <input
                    type="radio"
                    name="billType"
                    checked={billType === "B"}
                    onChange={() => setBillType("B")}
                    className="accent-[#7A0000]"
                  />
                  Bulk
                </label>
                <label className="flex items-center gap-2 text-xs text-gray-700">
                  <input
                    type="radio"
                    name="billType"
                    checked={billType === "O"}
                    onChange={() => setBillType("O")}
                    className="accent-[#7A0000]"
                  />
                  Ordinary
                </label>
              </div>
            </div>

            {/* From Date */}
            <div className="flex flex-col">
              <label className={`text-xs font-medium mb-1 ${maroon}`}>From Date:</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={selectCls} />
            </div>

            {/* To Date */}
            <div className="flex flex-col">
              <label className={`text-xs font-medium mb-1 ${maroon}`}>To Date:</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={selectCls} />
            </div>
          </div>

          {/* Submit */}
          <div className="w-full mt-6 flex justify-end">
            <button
              onClick={fetchReport}
              disabled={!canSubmit}
              className={`px-6 py-2 rounded-md font-medium transition-opacity duration-300 shadow
                ${maroonGrad} text-white
                ${!canSubmit ? "opacity-70 cursor-not-allowed" : "hover:opacity-90"}`}
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

          {reportError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">{reportError}</div>
          )}
        </>
      )}

      {hasSearched && (
        <div className="mt-2">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
            <div>
              <h2 className={`text-lg font-bold ${maroon}`}>Suspense Payment Details (Online Payments)</h2>
              <p className="text-sm text-gray-600 mt-1">
                {isOrdinary ? "Ordinary" : "Bulk"} | {resolvedFromDate} to {resolvedToDate}
              </p>
            </div>

            <div className="flex space-x-2 mt-2 md:mt-0">
              <button
                onClick={handleExportCsv}
                disabled={!reportData.length}
                className={`flex items-center gap-1 px-3 py-1.5 border border-blue-400 rounded-md text-xs font-medium shadow-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-200 transition
                  ${!reportData.length ? "text-blue-300 bg-gray-50 cursor-not-allowed" : "text-blue-700 bg-white hover:bg-blue-50 hover:text-blue-800"}`}
              >
                <FaFileDownload className="w-3 h-3" /> CSV
              </button>
              <button
                onClick={handleExportPdf}
                disabled={!reportData.length}
                className={`flex items-center gap-1 px-3 py-1.5 border border-green-400 rounded-md text-xs font-medium shadow-sm
                  focus:outline-none focus:ring-2 focus:ring-green-200 transition
                  ${!reportData.length ? "text-green-300 bg-gray-50 cursor-not-allowed" : "text-green-700 bg-white hover:bg-green-50 hover:text-green-800"}`}
              >
                <FaPrint className="w-3 h-3" /> PDF
              </button>
              <button
                onClick={handleBackToForm}
                className="px-4 py-1.5 bg-[#7A0000] hover:bg-[#A52A2A] text-xs rounded-md text-white"
              >
                Back to Form
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[calc(100vh-250px)] border border-gray-300 rounded-lg">
            <div className="min-w-full py-4">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-100 text-gray-800 sticky top-0">
                    <th className="border border-gray-300 px-2 py-2 text-left font-bold">Province</th>
                    <th className="border border-gray-300 px-2 py-2 text-left font-bold">Area</th>
                    <th className="border border-gray-300 px-2 py-2 text-center font-bold">Account Number</th>
                    <th className="border border-gray-300 px-2 py-2 text-center font-bold">Bill Cycle</th>
                    {isOrdinary && <th className="border border-gray-300 px-2 py-2 text-center font-bold">Credit Code</th>}
                    <th className="border border-gray-300 px-2 py-2 text-right font-bold">Suspense Amount</th>
                    <th className="border border-gray-300 px-2 py-2 text-center font-bold">Transac Date</th>
                    <th className="border border-gray-300 px-2 py-2 text-center font-bold">Payment Date</th>
                    {isOrdinary && <th className="border border-gray-300 px-2 py-2 text-center font-bold">Post Date</th>}
                    <th className="border border-gray-300 px-2 py-2 text-center font-bold">Stub No</th>
                    <th className="border border-gray-300 px-2 py-2 text-center font-bold">Counter No</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((prov, pIdx) => {
                    const provRowSpan = prov.areas.reduce((s, a) => s + a.rows.length + 1, 0) + 1; // + province total row

                    return (
                      <React.Fragment key={`${prov.province}-${pIdx}`}>
                        {prov.areas.map((area, aIdx) => (
                          <React.Fragment key={`${area.areaName}-${aIdx}`}>
                            {area.rows.map((r, rIdx) => (
                              <tr key={`${area.areaName}-${rIdx}`} className={rIdx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                {aIdx === 0 && rIdx === 0 && (
                                  <td rowSpan={provRowSpan} className="border border-gray-300 px-2 py-1 text-left align-top font-medium">
                                    {prov.province}
                                  </td>
                                )}
                                {rIdx === 0 && (
                                  <td rowSpan={area.rows.length} className="border border-gray-300 px-2 py-1 text-left align-top">
                                    {area.areaName}
                                  </td>
                                )}
                                <td className="border border-gray-300 px-2 py-1 text-center font-mono">{r.accountNumber}</td>
                                <td className="border border-gray-300 px-2 py-1 text-center font-mono">{r.billCycle}</td>
                                {isOrdinary && <td className="border border-gray-300 px-2 py-1 text-center font-mono">{r.creditCode}</td>}
                                <td className="border border-gray-300 px-2 py-1 text-right font-mono">{fmt(r.suspenseAmount)}</td>
                                <td className="border border-gray-300 px-2 py-1 text-center font-mono">{r.transacDate}</td>
                                <td className="border border-gray-300 px-2 py-1 text-center font-mono">{r.paymentDate}</td>
                                {isOrdinary && <td className="border border-gray-300 px-2 py-1 text-center font-mono">{r.postDate}</td>}
                                <td className="border border-gray-300 px-2 py-1 text-center font-mono">{r.stubNo}</td>
                                <td className="border border-gray-300 px-2 py-1 text-center font-mono">{r.counterNo}</td>
                              </tr>
                            ))}

                            {/* Area subtotal */}
                            <tr className="bg-gray-100 font-semibold">
                              <td className="border border-gray-300 px-2 py-1"></td>
                              <td colSpan={preAmountCols} className="border border-gray-300 px-2 py-1 text-right font-mono">
                                {area.rows.length}
                              </td>
                              <td className="border border-gray-300 px-2 py-1 text-right font-mono">{fmt(area.total)}</td>
                              <td colSpan={postAmountCols} className="border border-gray-300 px-2 py-1"></td>
                            </tr>
                          </React.Fragment>
                        ))}

                        {/* Province total */}
                        <tr className="bg-gray-200 font-bold">
                          <td className="border border-gray-300 px-2 py-1 text-left">Province Total</td>
                          <td colSpan={preAmountCols} className="border border-gray-300 px-2 py-1 text-right font-mono">
                            {prov.count}
                          </td>
                          <td className="border border-gray-300 px-2 py-1 text-right font-mono">{fmt(prov.total)}</td>
                          <td colSpan={postAmountCols} className="border border-gray-300 px-2 py-1"></td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-300 font-bold sticky bottom-0">
                    <td colSpan={2 + preAmountCols} className="border border-gray-300 px-2 py-2 text-center font-bold">
                      GRAND TOTAL ({reportData.length.toLocaleString()} records)
                    </td>
                    <td className="border border-gray-300 px-2 py-2 text-right font-mono font-bold">{fmt(grandTotal)}</td>
                    <td colSpan={postAmountCols} className="border border-gray-300 px-2 py-2"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {reportError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">{reportError}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default SuspensePaymentDetails;
