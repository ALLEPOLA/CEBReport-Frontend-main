// JobSummaryAllReport.tsx
import React, { useState } from "react";
import { Download, Printer, X, Loader2 } from "lucide-react";
import { toast } from "react-toastify";

/* ────── Types ────── */
interface JobSummaryItem {
    DeptId: string | null;
    EstimateNo: string | null;
    ProjectNo: string | null;
    Phase: string | null;
    ConnectionType: string | null;
    StdCost: number | null;
    ActualCost: number | null;
    Descr: string | null;
}

interface JobSummarySummary {
    fromDate: string;
    toDate: string;
    totalRecords: number;
    totalStdCost: number;
    totalActualCost: number;
}

/* ────── Constants ────── */
const FETCH_TIMEOUT_MS = 240000;
const COMPANY_NAME = "Electricity Distribution Lanka (Pvt) Ltd";

/* ────── Helpers ────── */
const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr?.trim()) return "";
    const dt = dateStr.trim();
    if (dt.includes("T")) return dt.split("T")[0].replace(/-/g, "/");
    if (/^\d{8}$/.test(dt)) return `${dt.slice(0, 4)}/${dt.slice(4, 6)}/${dt.slice(6)}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dt)) return dt.replace(/-/g, "/");
    return dt;
};

const formatAmount = (val: number | null | undefined): string => {
    if (val == null || isNaN(Number(val))) return "0.00";
    return Number(val).toLocaleString("en-LK", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

const csvEscape = (val: string | number | null | undefined): string => {
    if (val == null) return "";
    const str = String(val);
    return /[,\n"]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

// Variation isn't returned by the backend -- computed client-side as Actual - Estimated.
const variation = (it: JobSummaryItem): number => (it.ActualCost || 0) - (it.StdCost || 0);

/* ────── Report Table Component ────── */
const JobSummaryAllTable: React.FC<{
    data: JobSummaryItem[];
    summary: JobSummarySummary | null;
    fromDate: string;
    toDate: string;
    onClose: () => void;
}> = ({ data, summary, fromDate, toDate, onClose }) => {
    const maroon = "text-[#7A0000]";
    const fromLabel = formatDate(fromDate);
    const toLabel = formatDate(toDate);
    const reportTitle = `Job Summary (New Connection) - EDL Report From ${fromLabel} To ${toLabel}`;

    const sortedData = [...data]; // already ordered by backend (dept_id)
    const totalRecords = summary?.totalRecords ?? sortedData.length;
    const totalStdCost = summary?.totalStdCost ?? sortedData.reduce((s, it) => s + (it.StdCost || 0), 0);
    const totalActualCost = summary?.totalActualCost ?? sortedData.reduce((s, it) => s + (it.ActualCost || 0), 0);
    const totalVariation = totalActualCost - totalStdCost;

    /* ────── CSV Download ────── */
    const downloadCSV = () => {
        const titleRows = [reportTitle, COMPANY_NAME, `Total Records: ${totalRecords}`, ""];
        const headers = [
            "Item",
            "Dept Id",
            "Job No",
            "Estimate_no",
            "Phase",
            "Connection Type",
            "Estimated Cost",
            "Actual Cost",
            "Variation",
            "Description",
        ];
        const rows = sortedData.map((it, i) =>
            [
                csvEscape(i + 1),
                csvEscape(it.DeptId),
                csvEscape(it.ProjectNo),
                csvEscape(it.EstimateNo),
                csvEscape(it.Phase),
                csvEscape(it.ConnectionType),
                csvEscape(formatAmount(it.StdCost)),
                csvEscape(formatAmount(it.ActualCost)),
                csvEscape(formatAmount(variation(it))),
                csvEscape(it.Descr),
            ].join(",")
        );
        const totalRow = [
            "", "", "", "", "", "TOTAL",
            csvEscape(formatAmount(totalStdCost)),
            csvEscape(formatAmount(totalActualCost)),
            csvEscape(formatAmount(totalVariation)),
            "",
        ].join(",");
        const csv = [...titleRows, headers.join(","), ...rows, totalRow].join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `JobSummaryAll_${fromDate}_${toDate}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    /* ────── Print PDF ────── */
    const printPDF = () => {
        let rowsHTML = "";
        sortedData.forEach((it, i) => {
            rowsHTML += `
        <tr class="${i % 2 ? "bg-white" : "bg-gray-50"}">
          <td style="text-align:center;">${i + 1}</td>
          <td>${it.DeptId || ""}</td>
          <td>${it.ProjectNo || ""}</td>
          <td>${it.EstimateNo || ""}</td>
          <td style="text-align:center;">${it.Phase || ""}</td>
          <td style="text-align:center;">${it.ConnectionType || ""}</td>
          <td style="text-align:right;">${formatAmount(it.StdCost)}</td>
          <td style="text-align:right;">${formatAmount(it.ActualCost)}</td>
          <td style="text-align:right;">${formatAmount(variation(it))}</td>
          <td>${it.Descr || ""}</td>
        </tr>`;
        });

        rowsHTML += `
        <tr style="background:#d3d3d3; font-weight:bold;">
          <td colspan="6" style="text-align:right;">TOTAL</td>
          <td style="text-align:right;">${formatAmount(totalStdCost)}</td>
          <td style="text-align:right;">${formatAmount(totalActualCost)}</td>
          <td style="text-align:right;">${formatAmount(totalVariation)}</td>
          <td></td>
        </tr>
      `;

        const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    @media print {
      @page { size: landscape; margin: 8mm 5mm 10mm 5mm; }
      body { margin:0; font-family:Arial,Helvetica,sans-serif; }
      .title { margin: 10px 8px 2px; text-align:center; font-weight:bold; color:#7A0000; font-size:12.5px; }
      .company { margin: 2px 8px 8px; text-align:center; font-weight:bold; color:#7A0000; font-size:13px; }
      .info { margin:6px 8px 10px; font-size:9px; }
      table { border-collapse:collapse; width:100%; font-size:8px; }
      th, td { border:1px solid #d1d5db; padding:5px 6px; word-wrap:break-word; }
      th { background:#7A0000; color:#fff; text-align:center; font-weight:bold; }
      tr.bg-gray-50 { background:#f5f5f5; }
      @page {
        @bottom-left { content:"Printed on: ${new Date().toLocaleString("en-US", { timeZone: "Asia/Colombo" })}"; font-size:7px; color:gray; }
        @bottom-right { content:"Page " counter(page) " of " counter(pages); font-size:7px; color:gray; }
      }
    }
  </style>
</head>
<body>
  <div class="company">${COMPANY_NAME}</div>
  <div class="title">${reportTitle}</div>
  <div class="info"><strong>Records:</strong> ${totalRecords}</div>
  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th>Dept Id</th>
        <th>Job No</th>
        <th>Estimate_no</th>
        <th>Phase</th>
        <th>Connection Type</th>
        <th>Estimated Cost</th>
        <th>Actual Cost</th>
        <th>Variation</th>
        <th>Description</th>
      </tr>
    </thead>
    <tbody>${rowsHTML}</tbody>
  </table>
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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/90 print:static print:inset-auto print:p-0 print:bg-white">
            <div className="relative bg-white w-[97vw] max-w-[1500px] rounded-2xl shadow-2xl border border-gray-200 overflow-hidden mt-20 md:mt-24 lg:mt-28 lg:ml-64 mx-auto print:relative print:w-full print:max-w-none print:rounded-none print:shadow-none print:border-none print:overflow-visible">
                <div className="p-4 max-h-[85vh] overflow-y-auto print:p-0 print:max-h-none print:overflow-visible">
                    <div className="flex justify-end gap-3 mb-4 print:hidden">
                        <button
                            onClick={downloadCSV}
                            className="flex items-center gap-1 px-3 py-1.5 border border-blue-400 text-blue-700 bg-white rounded-md text-xs font-medium shadow-sm hover:bg-blue-50 hover:text-blue-800 transition"
                        >
                            <Download className="w-3 h-3" /> CSV
                        </button>
                        <button
                            onClick={printPDF}
                            className="flex items-center gap-1 px-3 py-1.5 border border-green-400 text-green-700 bg-white rounded-md text-xs font-medium shadow-sm hover:bg-green-50 hover:text-green-800 transition"
                        >
                            <Printer className="w-3 h-3" /> PDF
                        </button>
                        <button
                            onClick={onClose}
                            className="px-4 py-1.5 bg-[#7A0000] hover:bg-[#A52A2A] text-xs rounded-md text-white flex items-center gap-1 transition"
                        >
                            <X className="w-3 h-3" /> Close
                        </button>
                    </div>

                    <h2 className={`text-base md:text-lg font-bold text-center ${maroon}`}>{COMPANY_NAME}</h2>
                    <h3 className={`text-sm md:text-base font-semibold text-center mb-4 ${maroon}`}>{reportTitle}</h3>
                    <div className="text-sm mb-4 px-2 text-gray-600">Records: {totalRecords}</div>

                    <div className="border border-gray-200 rounded-lg overflow-x-auto">
                        <div className="min-w-[1200px]">
                            <table className="w-full text-xs border-collapse">
                                <thead>
                                    <tr className="bg-[#7A0000] text-white sticky top-0">
                                        <th className="px-3 py-2 border border-gray-300 font-bold">Item</th>
                                        <th className="px-3 py-2 border border-gray-300 font-bold">Dept Id</th>
                                        <th className="px-3 py-2 border border-gray-300 font-bold">Job No</th>
                                        <th className="px-3 py-2 border border-gray-300 font-bold">Estimate_no</th>
                                        <th className="px-3 py-2 border border-gray-300 font-bold">Phase</th>
                                        <th className="px-3 py-2 border border-gray-300 font-bold">Connection Type</th>
                                        <th className="px-3 py-2 border border-gray-300 font-bold text-right">Estimated Cost</th>
                                        <th className="px-3 py-2 border border-gray-300 font-bold text-right">Actual Cost</th>
                                        <th className="px-3 py-2 border border-gray-300 font-bold text-right">Variation</th>
                                        <th className="px-3 py-2 border border-gray-300 font-bold">Description</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedData.map((it, i) => (
                                        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                            <td className="px-3 py-2 border-l border-r border-gray-300 text-center font-mono">{i + 1}</td>
                                            <td className="px-3 py-2 border-r border-gray-300 font-mono">{it.DeptId}</td>
                                            <td className="px-3 py-2 border-r border-gray-300 font-mono">{it.ProjectNo}</td>
                                            <td className="px-3 py-2 border-r border-gray-300 font-mono">{it.EstimateNo}</td>
                                            <td className="px-3 py-2 border-r border-gray-300 text-center">{it.Phase}</td>
                                            <td className="px-3 py-2 border-r border-gray-300 text-center">{it.ConnectionType}</td>
                                            <td className="px-3 py-2 border-r border-gray-300 text-right font-mono">{formatAmount(it.StdCost)}</td>
                                            <td className="px-3 py-2 border-r border-gray-300 text-right font-mono">{formatAmount(it.ActualCost)}</td>
                                            <td className="px-3 py-2 border-r border-gray-300 text-right font-mono">{formatAmount(variation(it))}</td>
                                            <td className="px-3 py-2 border-r border-gray-300 break-words max-w-[240px]">{it.Descr}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-[#d3d3d3] font-bold sticky bottom-0">
                                        <td colSpan={6} className="px-3 py-2 border border-gray-300 text-right">TOTAL</td>
                                        <td className="px-3 py-2 border border-gray-300 text-right font-mono">{formatAmount(totalStdCost)}</td>
                                        <td className="px-3 py-2 border border-gray-300 text-right font-mono">{formatAmount(totalActualCost)}</td>
                                        <td className="px-3 py-2 border border-gray-300 text-right font-mono">{formatAmount(totalVariation)}</td>
                                        <td className="px-3 py-2 border border-gray-300"></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ────── MAIN COMPONENT ────── */
const JobSummaryAllReport: React.FC = () => {
    const maroon = "text-[#7A0000]";
    const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";

    const todayStr = new Date().toISOString().slice(0, 10);
    const firstOfMonthStr = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString()
        .slice(0, 10);

    const [fromDate, setFromDate] = useState(firstOfMonthStr);
    const [toDate, setToDate] = useState(todayStr);

    const [reportData, setReportData] = useState<JobSummaryItem[]>([]);
    const [reportSummary, setReportSummary] = useState<JobSummarySummary | null>(null);
    const [showReport, setShowReport] = useState(false);
    const [loading, setLoading] = useState(false);

    const fetchReport = async () => {
        if (!fromDate || !toDate) {
            toast.error("Please select both From Date and To Date.");
            return;
        }
        if (new Date(toDate) < new Date(fromDate)) {
            toast.error("To date cannot be earlier than from date.");
            return;
        }

        setLoading(true);
        setReportData([]);
        setReportSummary(null);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

        try {
            const url = `/misapi/api/jobsummaryall/report?fromDate=${fromDate}&toDate=${toDate}`;
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();

            if (!json.success) throw new Error(json.message || "No data");

            const items: JobSummaryItem[] = json.data || [];
            if (items.length === 0) {
                toast.warn("No records found.");
                return;
            }

            setReportData(items);
            setReportSummary(json.summary || null);
            setShowReport(true);
            toast.success(`${items.length} records loaded.`);
        } catch (e: any) {
            toast.error(
                e.name === "AbortError"
                    ? "Request timed out."
                    : e.message.includes("Failed to fetch")
                        ? "Server unreachable."
                        : e.message
            );
        } finally {
            setLoading(false);
        }
    };

    const closeReport = () => {
        setShowReport(false);
        setReportData([]);
        setReportSummary(null);
    };

    return (
        <div
            className="max-w-[95%] mx-auto p-6 bg-white rounded-lg shadow-md text-sm md:text-base relative ml-16 mt-8"
            style={{ marginLeft: "2rem" }}
        >
            <h2 className={`text-xl font-bold mb-4 ${maroon}`}>Job Summary (New Connection) - EDL</h2>

            <div className="bg-gray-50 p-4 rounded-lg mb-4 border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <div className="flex flex-col gap-1">
                        <label className={`text-xs font-bold ${maroon}`}>From Date:</label>
                        <input
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            className="px-3 py-1.5 rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#7A0000] transition text-sm"
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className={`text-xs font-bold ${maroon}`}>To Date:</label>
                        <input
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            className="px-3 py-1.5 rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#7A0000] transition text-sm"
                        />
                    </div>
                </div>

                <div className="mt-4 flex justify-end">
                    <button
                        onClick={fetchReport}
                        disabled={loading}
                        className={`flex items-center gap-2 px-5 py-2 rounded-md text-white text-sm font-medium shadow-sm hover:opacity-90 transition disabled:opacity-50 ${maroonGrad}`}
                    >
                        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                        Generate Report
                    </button>
                </div>
            </div>

            {loading && (
                <div className="flex flex-col items-center justify-center py-12">
                    <svg className="animate-spin h-10 w-10 text-[#7A0000]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <p className="mt-3 text-gray-600 text-sm">Loading report...</p>
                </div>
            )}

            {showReport && reportData.length > 0 && (
                <JobSummaryAllTable
                    data={reportData}
                    summary={reportSummary}
                    fromDate={fromDate}
                    toDate={toDate}
                    onClose={closeReport}
                />
            )}
        </div>
    );
};

export default JobSummaryAllReport;