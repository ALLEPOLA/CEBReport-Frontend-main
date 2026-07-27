import React, { useState, useCallback } from "react";
import { Download, Printer, X, RotateCcw, Eye } from "lucide-react";
import { toast } from "react-toastify";

interface IssuesRaisedForJobsItem {
  MatCd: string | null;
  MatNm: string | null;
  NoOfIssues: number | null;
  Qty: number | null;
}

async function apiFetch<T>(
  url: string
): Promise<{ data: T | null; errorMessage: string | null }> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      credentials: "include",
      signal: AbortSignal.timeout(120000),
    });
    if (!res.ok) {
      if (res.status === 404)
        throw new Error("API endpoint not found (404). Please check if the backend is running.");
      if (res.status === 500)
        throw new Error("Database error (500). Please check your database connection.");
      const txt = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${res.statusText}${txt ? " - " + txt : ""}`);
    }
    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json"))
      throw new Error(`Expected JSON but got ${contentType}`);
    return await res.json();
  } catch (err: any) {
    if (err.name === "AbortError" || err.name === "TimeoutError")
      return { data: null, errorMessage: "Request timeout. Please check your connection." };
    if (err.message.includes("Failed to fetch"))
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

const formatQty = (v: any): string =>
  parseNumber(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const today = new Date();
const currentYear = today.getFullYear();
const currentMonth = String(today.getMonth() + 1).padStart(2, "0");
const currentDay = String(today.getDate()).padStart(2, "0");
const maxDate = `${currentYear}-${currentMonth}-${currentDay}`;
const minDate = `${currentYear - 20}-${currentMonth}-${currentDay}`;

/* ────── Formatting helpers ────── */

const csvEscape = (val: string | number | null | undefined): string => {
  if (val == null) return "";
  const str = String(val);
  if (/[,\n"]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
};

const IssuesRaisedForJobsReport: React.FC = () => {
  const maroon = "text-[#7A0000]";
  const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [matCodeInput, setMatCodeInput] = useState("");

  const [loadingReport, setLoadingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const [reportData, setReportData] = useState<IssuesRaisedForJobsItem[]>([]);
  const [resolvedFromDate, setResolvedFromDate] = useState("");
  const [resolvedToDate, setResolvedToDate] = useState("");
  const [resolvedMatCode, setResolvedMatCode] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  /* ────── Fetch report ────── */
  const fetchReport = useCallback(async () => {
    setReportError(null);

    if (!fromDate) { 
      toast.error("Please select 'From Date'");
      return; 
    }
    if (!toDate) { 
      toast.error("Please select 'To Date'");
      return; 
    }
    if (new Date(toDate) < new Date(fromDate)) {
      toast.error("'To Date' cannot be earlier than 'From Date'");
      return;
    }

    const fromSnapshot = fromDate;
    const toSnapshot = toDate;
    const matCodeSnapshot = matCodeInput.trim().toUpperCase();

    setLoadingReport(true);

    try {
      const url = matCodeSnapshot
        ? `/misapi/api/issuesraisedforjobs/report/${fromSnapshot}/${toSnapshot}/${encodeURIComponent(matCodeSnapshot)}`
        : `/misapi/api/issuesraisedforjobs/report/${fromSnapshot}/${toSnapshot}`;

      const response = await apiFetch<any>(url);

      if (response.errorMessage) {
        toast.error(response.errorMessage);
        return;
      }

      const raw: any = response;
      if (!raw || raw.success === false) {
        toast.error(raw?.message || "No data returned from server.");
        return;
      }

      const rows: any[] = Array.isArray(raw.data) ? raw.data : [];
      if (rows.length === 0) {
        toast.warn("No records found for the selected criteria.");
        return;
      }

      const trimStr = (v: any): string | null => {
        if (v === undefined || v === null) return null;
        const s = String(v).trim();
        return s.length ? s : null;
      };

      const mapped: IssuesRaisedForJobsItem[] = rows.map((item: any) => ({
        MatCd: trimStr(item.MatCd),
        MatNm: trimStr(item.MatNm),
        NoOfIssues: item.NoOfIssues !== undefined && item.NoOfIssues !== null ? Number(item.NoOfIssues) : null,
        Qty: item.Qty !== undefined && item.Qty !== null ? Number(item.Qty) : null,
      }));

      mapped.sort((a, b) =>
        (a.MatCd || "").localeCompare(b.MatCd || "", undefined, { numeric: true, sensitivity: "base" })
      );

      setReportData(mapped);
      setResolvedFromDate(fromSnapshot);
      setResolvedToDate(toSnapshot);
      setResolvedMatCode(matCodeSnapshot);
      setHasSearched(true);
      toast.success(`${mapped.length} records loaded successfully.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch report data. Please try again.");
    } finally {
      setLoadingReport(false);
    }
  }, [fromDate, toDate, matCodeInput]);

  /* ────── Derived totals ────── */
  const totalIssues = reportData.reduce((s, r) => s + (r.NoOfIssues || 0), 0);
  const totalQty = reportData.reduce((s, r) => s + (r.Qty || 0), 0);

  const clearFilters = () => {
    setFromDate("");
    setToDate("");
    setMatCodeInput("");
    setReportError(null);
    toast.info("Filters cleared.");
  };

  const closeReport = () => {
    setHasSearched(false);
    setReportData([]);
    setReportError(null);
  };

  /* ────── Export helpers ────── */
  const handleExportCsv = () => {
    if (!reportData.length) { 
      toast.error("No data to export.");
      return; 
    }

    const titleRows = [
      `All (Issues) Raised by EDL for Jobs & Maintenance`,
      `From ${resolvedFromDate} To ${resolvedToDate}`,
      `Material Code Filter: ${resolvedMatCode || "(All Materials)"}`,
      "",
    ];

    const headers = ["No", "Material Code", "Material Name", "No of Issues", "Quantity"];
    const rows: string[] = [headers.join(",")];

    reportData.forEach((r, i) => {
      // Force material code to be treated as text in Excel
      const matCode = r.MatCd ? `="${r.MatCd}"` : "";
      rows.push(
        [
          csvEscape(i + 1),
          csvEscape(matCode),
          csvEscape(r.MatNm || ""),
          csvEscape(r.NoOfIssues ?? 0),
          csvEscape(formatQty(r.Qty)),
        ].join(",")
      );
    });

    rows.push(
      `Grand Total,,,,${csvEscape(totalIssues)},${csvEscape(formatQty(totalQty))}`
    );

    const csv = [...titleRows, ...rows].join("\n");
    const blob = new Blob([csv], {type: "text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `IssuesRaisedForJobs_${resolvedFromDate}_${resolvedToDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    if (!reportData.length) { 
      toast.error("No data to export.");
      return; 
    }

    let rows = "";
    reportData.forEach((r, i) => {
      rows += `
        <tr class="${i % 2 ? "bg-white" : "bg-gray-50"}">
          <td class="px-3 py-2 border-l border-r border-gray-300 text-center text-xs">${i + 1}</td>
          <td class="px-3 py-2 border-r border-gray-300 text-center text-xs font-mono">${r.MatCd || ""}</td>
          <td class="px-3 py-2 border-r border-gray-300 text-left text-xs break-words">${r.MatNm || ""}</td>
          <td class="px-3 py-2 border-r border-gray-300 text-right text-xs font-mono">${r.NoOfIssues ?? 0}</td>
          <td class="px-3 py-2 border-r border-gray-300 text-right text-xs font-mono">${formatQty(r.Qty)}</td>
        </tr>`;
    });

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    @media print {
      @page { margin: 8mm 5mm 10mm 5mm; }
      body { margin:0; font-family:Arial,Helvetica,sans-serif; }
      .title { margin: 10px 8px 20px; text-align:center; font-weight:bold; color:#7A0000; font-size:13px; }
      .info { margin:6px 8px; font-size:9px; display:flex; justify-content:space-between; }
      table { border-collapse:collapse; width:100%; font-size:8.5px; }
      th, td { border:1px solid #d1d5db; padding:6px 8px; word-wrap:break-word; }
      th { background:linear-gradient(to right,#7A0000,#A52A2A); color:white; text-align:center; font-weight:bold; }
      tfoot td { background:#d3d3d3; font-weight:bold; }
      .font-mono { font-family:monospace; }
      @page {
        @bottom-left  { content:"Printed on: ${new Date().toLocaleString(
          "en-US",
          {timeZone: "Asia/Colombo"}
        )}"; font-size:7px; color:gray; }
        @bottom-right { content:"Page " counter(page) " of " counter(pages); font-size:7px; color:gray; }
      }
    }
  </style>
</head>
<body>
  <div class="title">All (Issues) Raised by EDL for Jobs & Maintenance</div>
  <div class="info">
    <div><strong>From:</strong> ${resolvedFromDate} <strong>To:</strong> ${resolvedToDate}</div>
    <div><strong>Material Code Filter:</strong> ${resolvedMatCode || "(All Materials)"}</div>
  </div>
  <table style="width:100%; border-collapse:collapse; font-size:8.5px; border:1px solid #d1d5db;">
    <thead>
      <tr style="background:linear-gradient(to right,#7A0000,#A52A2A); color:white;">
        <th style="padding:6px 8px; width:6%;">No</th>
        <th style="padding:6px 8px; width:18%;">Material Code</th>
        <th style="padding:6px 8px; width:46%;">Material Name</th>
        <th style="padding:6px 8px; width:15%; text-align:right;">No of Issues</th>
        <th style="padding:6px 8px; width:15%; text-align:right;">Quantity</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr>
        <td colspan="3" style="text-align:right; padding:6px 8px; border:1px solid #d1d5db;">Grand Total</td>
        <td style="text-align:right; padding:6px 8px; border:1px solid #d1d5db; font-family:monospace;">${totalIssues.toLocaleString("en-US")}</td>
        <td style="text-align:right; padding:6px 8px; border:1px solid #d1d5db; font-family:monospace;">${formatQty(totalQty)}</td>
      </tr>
    </tfoot>
  </table>

  <div style="margin-top:20px; display:flex; justify-content:space-between; padding:0 15px; font-size:9px;">
    <div>Prepared By: ____________________</div>
    <div>Checked By: ____________________</div>
  </div>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (!win) {
      toast.error("Popup blocked. Please allow popups.");
      return;
    }
    win.document.write(html);
    win.document.close();
    win.onload = () => win.print();
    win.onafterprint = () => win.close();
  };

  /* ────── Render ────── */
  return (
    <div className="max-w-7xl mx-auto p-6 bg-white rounded-xl shadow border border-gray-200 text-sm font-sans">
      <div className="flex justify-between items-center mb-4">
        <h2 className={`text-xl font-bold ${maroon}`}>
          All (Issues) Raised by EDL for Jobs & Maintenance
        </h2>
      </div>

      {/* ── FORM SECTION ─────────────────────────────────────────────── */}
      {!hasSearched && (
        <>
          <div className="bg-gray-50 p-4 rounded-lg mb-4 border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="flex flex-col">
                <label className={`text-xs font-bold ${maroon} mb-1`}>
                  From Date: <span className="text-red-600">*</span>
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  min={minDate}
                  max={maxDate}
                  className="pl-3 pr-3 py-1.5 w-full rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#7A0000] transition text-sm"
                />
              </div>

              <div className="flex flex-col">
                <label className={`text-xs font-bold ${maroon} mb-1`}>
                  To Date: <span className="text-red-600">*</span>
                </label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  min={minDate}
                  max={maxDate}
                  className="pl-3 pr-3 py-1.5 w-full rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#7A0000] transition text-sm"
                />
              </div>

              <div className="flex flex-col">
                <label className={`text-xs font-bold ${maroon} mb-1`}>
                  Material Code:
                </label>
                <input
                  type="text"
                  value={matCodeInput}
                  placeholder="Leave blank for all materials"
                  onChange={(e) => setMatCodeInput(e.target.value)}
                  className="pl-3 pr-3 py-1.5 w-full rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#7A0000] transition text-sm uppercase placeholder:normal-case"
                />
              </div>
            </div>

            <div className="flex justify-end mt-4 gap-2">
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm"
              >
                <RotateCcw className="w-3 h-3" /> Clear All
              </button>
              <button
                onClick={fetchReport}
                disabled={loadingReport}
                className={`px-6 py-1.5 rounded-md font-medium transition shadow disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2
                  ${maroonGrad} text-white hover:brightness-110`}
              >
                {loadingReport ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Loading...
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4" /> View
                  </>
                )}
              </button>
            </div>
          </div>

          {reportError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 text-sm">
              {reportError}
            </div>
          )}
        </>
      )}

      {/* ── REPORT SECTION ───────────────────────────────────────────── */}
      {hasSearched && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/90 print:static print:inset-auto print:p-0 print:bg-white">
          <div className="relative bg-white w-[95vw] sm:w-[90vw] md:w-[85vw] lg:w-[80vw] xl:w-[75vw] max-w-7xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden mt-20 md:mt-32 lg:mt-40 lg:ml-64 mx-auto print:relative print:w-full print:max-w-none print:rounded-none print:shadow-none print:border-none print:overflow-visible">
            {loadingReport && (
              <div className="absolute inset-0 bg-white/95 z-50 flex flex-col items-center justify-center gap-4">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#7A0000]"></div>
                <p className="text-xl font-bold text-[#7A0000]">Loading Report...</p>
                <p className="text-sm text-gray-600">Fetching issues data from server</p>
              </div>
            )}

            {!loadingReport && reportData.length > 0 && (
              <div className="p-2 md:p-2 max-h-[80vh] overflow-y-auto print:p-0 print:max-h-none print:overflow-visible print:mt-10 print:ml-12">
                <div className="flex justify-end gap-3 mb-6 md:mb-8 print:hidden">
                  <button
                    onClick={handleExportCsv}
                    className="flex items-center gap-1 px-3 py-1.5 border border-blue-400 text-blue-700 bg-white rounded-md text-xs font-medium shadow-sm hover:bg-blue-50"
                  >
                    <Download className="w-4 h-4" /> CSV
                  </button>
                  <button
                    onClick={handleExportPdf}
                    className="flex items-center gap-1 px-3 py-1.5 border border-green-400 text-green-700 bg-white rounded-md text-xs font-medium shadow-sm hover:bg-green-50"
                  >
                    <Printer className="w-4 h-4" /> PDF
                  </button>
                  <button
                    onClick={closeReport}
                    className="flex items-center gap-1 px-3 py-1.5 border border-red-400 text-red-700 bg-white rounded-md text-xs font-medium shadow-sm hover:bg-red-50"
                  >
                    <X className="w-4 h-4" /> Close
                  </button>
                </div>

                <h2 className={`text-lg md:text-xl font-bold text-center md:mb-6 ${maroon}`}>
                  All (Issues) Raised by EDL for Jobs & Maintenance
                </h2>
                <div className="flex justify-between text-sm mb-3 ml-5 mr-12">
                  <div>
                    <span className="font-bold">From:</span> {resolvedFromDate} <span className="font-bold ml-2">To:</span> {resolvedToDate}
                  </div>
                  <div className="font-semibold text-gray-600">
                    Material Code: {resolvedMatCode || "(All Materials)"}
                  </div>
                </div>

                <div className="ml-5 mt-1 mb-5 border border-gray-200 rounded-lg overflow-x-auto print:ml-12 print:mt-12 print:overflow-visible">
                  <div className="min-w-[900px]">
                    <table className="w-full text-xs border-collapse">
                      <thead className={`${maroonGrad} text-white`}>
                        <tr>
                          <th className="px-4 py-2 border border-gray-300" style={{width: "6%"}}>No</th>
                          <th className="px-4 py-2 border border-gray-300" style={{width: "18%"}}>Material Code</th>
                          <th className="px-4 py-2 border border-gray-300" style={{width: "46%"}}>Material Name</th>
                          <th className="px-4 py-2 border border-gray-300 text-right" style={{width: "15%"}}>No of Issues</th>
                          <th className="px-4 py-2 border border-gray-300 text-right" style={{width: "15%"}}>Quantity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.map((r, i) => (
                          <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                            <td className="px-4 py-2 border-l border-r border-gray-300 text-center">{i + 1}</td>
                            <td className="px-4 py-2 text-center font-mono border-r border-gray-300">{r.MatCd || ""}</td>
                            <td className="px-4 py-2 border-r border-gray-300 break-words">{r.MatNm || ""}</td>
                            <td className="px-4 py-2 text-right font-mono border-r border-gray-300">{r.NoOfIssues ?? 0}</td>
                            <td className="px-4 py-2 text-right font-mono border-r border-gray-300">{formatQty(r.Qty)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-[#d3d3d3] font-bold">
                          <td colSpan={3} className="px-4 py-2 text-right border border-gray-300">Grand Total</td>
                          <td className="px-4 py-2 text-right font-mono border border-gray-300">{totalIssues.toLocaleString("en-US")}</td>
                          <td className="px-4 py-2 text-right font-mono border border-gray-300">{formatQty(totalQty)}</td>
                        </tr>
                      </tfoot>
                    </table>
                    <p className="text-xs text-gray-500 mt-2 text-right px-2">
                      Total records: {reportData.length.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {reportError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                {reportError}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default IssuesRaisedForJobsReport;