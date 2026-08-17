// CashSheetReport.tsx
import React, { useEffect, useState } from "react";
import { Search, RotateCcw, Eye, X, Download, Printer } from "lucide-react";
import { useUser } from "../../contexts/UserContext";
import { toast } from "react-toastify";

interface Department {
    DeptId: string;
    DeptName: string;
}

interface CashSheetItem {
    ChqRun: string | null;
    ChqDt: string | null;
    Payee: string | null;
    PymtDocNo: string | null;
    ChqAmt: number | null;
    ChqNo: string | null;
}

interface CashSheetSummary {
    repYear: string;
    repMonth: string;
    costCtr: string;
    totalRecords: number;
    totalAmount: number;
}

/* ────── Constants ────── */
const PAGE_SIZE = 9;
const FETCH_TIMEOUT_MS = 240000;

const MONTHS = [
    { value: "01", label: "January" },
    { value: "02", label: "February" },
    { value: "03", label: "March" },
    { value: "04", label: "April" },
    { value: "05", label: "May" },
    { value: "06", label: "June" },
    { value: "07", label: "July" },
    { value: "08", label: "August" },
    { value: "09", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
];

/* ────── Helpers ────── */
const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr?.trim()) return "";
    const dt = dateStr.trim();

    if (dt.includes("T")) {
        return dt.split("T")[0].replace(/-/g, "/");
    }

    if (/^\d{8}$/.test(dt)) {
        return `${dt.slice(0, 4)}/${dt.slice(4, 6)}/${dt.slice(6)}`;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(dt)) {
        return dt.replace(/-/g, "/");
    }

    return dt;
};

const csvEscape = (val: string | number | null | undefined): string => {
    if (val == null) return "";
    const str = String(val);
    return /[,\n"]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

const formatAmount = (amount: string | number | null | undefined): string => {
    if (amount == null || amount === "" || isNaN(Number(amount))) return "0.00";
    const num = parseFloat(String(amount));
    return num.toLocaleString("en-LK", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

/* ────── Table Modal Component ────── */
const CashSheetReportTable: React.FC<{
    data: CashSheetItem[];
    summary: CashSheetSummary | null;
    repYear: string;
    repMonth: string;
    costCenter: string;
    departmentName: string;
    onClose: () => void;
}> = ({ data, summary, repYear, repMonth, costCenter, departmentName, onClose }) => {
    const maroon = "text-[#7A0000]";

    const monthLabel = MONTHS.find((m) => m.value === repMonth)?.label || repMonth;
    const reportTitle = `Cash Sheet for the Month of ${monthLabel} ${repYear}`;

    // Sort by Cheque Run, Cheque No, Cheque Date
    const sortedData = [...data].sort((a, b) => {
        const runA = (a.ChqRun || "").trim().padStart(10, "0");
        const runB = (b.ChqRun || "").trim().padStart(10, "0");
        const runCmp = runA.localeCompare(runB);
        if (runCmp !== 0) return runCmp;

        const chqA = (a.ChqNo || "").trim().padStart(10, "0");
        const chqB = (b.ChqNo || "").trim().padStart(10, "0");
        const chqCmp = chqA.localeCompare(chqB);
        if (chqCmp !== 0) return chqCmp;

        const dateA = a.ChqDt || "";
        const dateB = b.ChqDt || "";
        return dateA.localeCompare(dateB);
    });

    const totalAmount = summary?.totalAmount ?? sortedData.reduce((sum, it) => sum + (Number(it.ChqAmt) || 0), 0);
    const totalRecords = summary?.totalRecords ?? sortedData.length;

    /* ────── CSV Download ────── */
    const downloadCSV = () => {
        const titleRows = [
            reportTitle,
            `Cost Center: ${costCenter}/${departmentName}`,
            `Total Records: ${totalRecords}`,
            `Total Amount (LKR): ${formatAmount(totalAmount)}`,
            "",
        ];
        const headers = [
            "Cheque Run",
            "Cheque No.",
            "Payslips No",
            "Cheque Date",
            "Payee",
            "Amount (LKR)",
        ];
        const rows = sortedData.map((it) =>
            [
                csvEscape(it.ChqRun),
                csvEscape(it.ChqNo),
                csvEscape(it.PymtDocNo),
                csvEscape(formatDate(it.ChqDt)),
                csvEscape(it.Payee),
                csvEscape(it.ChqAmt),
            ].join(",")
        );
        const totalRow = [
            "TOTAL",
            "",
            "",
            "",
            "",
            csvEscape(formatAmount(totalAmount)),
        ].join(",");
        const csv = [...titleRows, headers.join(","), ...rows, totalRow].join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `CashSheet_${costCenter}_${repYear}_${repMonth}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    /* ────── Print PDF ──────
       NOTE: the print window below only loads the inline <style> block defined in this
       function — it does NOT have Tailwind CSS available. Any Tailwind utility class
       (text-right, text-center, etc.) written directly into this HTML string is inert.
       Alignment inside this template must always be set via inline style="..." instead,
       which is why every td below carries an explicit text-align rather than a class. */
    const printPDF = () => {
        let rowsHTML = "";
        sortedData.forEach((it, i) => {
            rowsHTML += `
        <tr class="${i % 2 ? "bg-white" : "bg-gray-50"}">
          <td class="px-3 py-2 border-l border-r border-gray-300 text-xs" style="text-align:left;">${it.ChqRun || ""}</td>
          <td class="px-3 py-2 border-r border-gray-300 text-xs" style="text-align:left;">${it.ChqNo || ""}</td>
          <td class="px-3 py-2 border-r border-gray-300 text-xs" style="text-align:left;">${it.PymtDocNo || ""}</td>
          <td class="px-3 py-2 border-r border-gray-300 text-xs" style="text-align:center;">${formatDate(it.ChqDt)}</td>
          <td class="px-3 py-2 border-r border-gray-300 text-xs break-words" style="text-align:left;">${it.Payee || ""}</td>
          <td class="px-3 py-2 border-r border-gray-300 text-xs" style="text-align:right;">${formatAmount(it.ChqAmt)}</td>
        </tr>`;
        });

        // Add total row
        rowsHTML += `
        <tr style="background:#d3d3d3; font-weight:bold;">
          <td colspan="5" style="padding:6px 8px; border:1px solid #d1d5db; text-align:right; font-size:9px;">TOTAL</td>
          <td style="padding:6px 8px; border:1px solid #d1d5db; text-align:right; font-size:9px;">${formatAmount(totalAmount)}</td>
        </tr>
      `;

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
      th { background:#7A0000; color:#1f2937; text-align:center; font-weight:bold; }
      tr.bg-gray-50 { background:#f5f5f5; }
      @page {
        @bottom-left { content:"Printed on: ${new Date().toLocaleString("en-US", { timeZone: "Asia/Colombo" })}"; font-size:7px; color:gray; }
        @bottom-right { content:"Page " counter(page) " of " counter(pages); font-size:7px; color:gray; }
      }
    }
  </style>
</head>
<body>
  <div class="title">${reportTitle}</div>
  <div class="info">
    <div><strong>Cost Center:</strong> ${costCenter} / ${departmentName}</div>
    <div style="font-weight:600; color:#4B5563;">Currency : LKR</div>
  </div>
  <table style="width:100%; border-collapse:collapse; font-size:8.5px; border:1px solid #d1d5db;">
    <thead>
      <tr style="background:#7A0000; color:#1f2937;">
        <th style="padding:6px 8px; width:12%;">Cheque Run</th>
        <th style="padding:6px 8px; width:10%;">Cheque No.</th>
        <th style="padding:6px 8px; width:14%;">Payslips No</th>
        <th style="padding:6px 8px; width:12%;">Cheque Date</th>
        <th style="padding:6px 8px; width:30%;">Payee</th>
        <th style="padding:6px 8px; width:12%; text-align:right;">Amount (LKR)</th>
      </tr>
    </thead>
    <tbody>${rowsHTML}</tbody>
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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/90 print:static print:inset-auto print:p-0 print:bg-white">
            <div className="relative bg-white w-[95vw] sm:w-[90vw] md:w-[85vw] lg:w-[80vw] xl:w-[75vw] max-w-7xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden mt-20 md:mt-32 lg:mt-40 lg:ml-64 mx-auto print:relative print:w-full print:max-w-none print:rounded-none print:shadow-none print:border-none print:overflow-visible">
                <div className="p-4 max-h-[80vh] overflow-y-auto print:p-0 print:max-h-none print:overflow-visible print:mt-10 print:ml-12">
                    <div className="flex justify-end gap-3 mb-6 md:mb-8 print:hidden">
                        <button
                            onClick={downloadCSV}
                            className="flex items-center gap-1 px-3 py-1.5 border border-blue-400 text-blue-700 bg-white rounded-md text-xs font-medium shadow-sm hover:bg-blue-50 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-200 transition"
                        >
                            <Download className="w-3 h-3" /> CSV
                        </button>
                        <button
                            onClick={printPDF}
                            className="flex items-center gap-1 px-3 py-1.5 border border-green-400 text-green-700 bg-white rounded-md text-xs font-medium shadow-sm hover:bg-green-50 hover:text-green-800 focus:outline-none focus:ring-2 focus:ring-green-200 transition"
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
                    <h2 className={`text-lg md:text-xl font-bold text-center md:mb-6 ${maroon}`}>
                        {reportTitle}
                    </h2>
                    <div className="flex flex-col sm:flex-row justify-between text-sm mb-4 gap-2 px-2">
                        <div>
                            <span className="font-bold">Cost Center:</span> {costCenter} / {departmentName}
                        </div>
                        <div className="flex gap-4 font-semibold text-gray-600">
                            <div>Records: {totalRecords}</div>
                            <div>Total Amount: LKR {formatAmount(totalAmount)}</div>
                        </div>
                    </div>
                    <div className="mt-1 mb-5 border border-gray-200 rounded-lg overflow-x-auto print:ml-12 print:mt-12 print:overflow-visible">
                        <div className="min-w-[1000px]">
                            <table className="w-full text-xs border-collapse">
                                <thead>
                                    <tr className="bg-[#7A0000] text-white sticky top-0">
                                        <th className="px-4 py-2 border border-gray-300 text-center font-bold">Cheque Run</th>
                                        <th className="px-4 py-2 border border-gray-300 text-center font-bold">Cheque No.</th>
                                        <th className="px-4 py-2 border border-gray-300 text-center font-bold">Payslips No</th>
                                        <th className="px-4 py-2 border border-gray-300 text-center font-bold">Cheque Date</th>
                                        <th className="px-4 py-2 border border-gray-300 text-center font-bold">Payee</th>
                                        <th className="px-4 py-2 border border-gray-300 text-right font-bold">Amount (LKR)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedData.map((it, i) => (
                                        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                            <td className="px-4 py-2 border-l border-r border-gray-300 font-mono">{it.ChqRun}</td>
                                            <td className="px-4 py-2 border-r border-gray-300 font-mono">{it.ChqNo}</td>
                                            <td className="px-4 py-2 border-r border-gray-300 font-mono">{it.PymtDocNo}</td>
                                            <td className="px-4 py-2 text-center border-r border-gray-300 font-mono">{formatDate(it.ChqDt)}</td>
                                            <td className="px-4 py-2 border-r border-gray-300 break-words max-w-[250px]">{it.Payee}</td>
                                            <td className="px-4 py-2 text-right border-r border-gray-300 font-mono">{formatAmount(it.ChqAmt)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-[#d3d3d3] font-bold sticky bottom-0">
                                        <td colSpan={5} className="px-4 py-2 border border-gray-300 text-right">TOTAL</td>
                                        <td className="px-4 py-2 border border-gray-300 text-right font-mono">
                                            {formatAmount(totalAmount)}
                                        </td>
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
const CashSheetReport: React.FC = () => {
    const { user } = useUser();
    const [departments, setDepartments] = useState<Department[]>([]);
    const [filtered, setFiltered] = useState<Department[]>([]);
    const [searchId, setSearchId] = useState("");
    const [searchName, setSearchName] = useState("");
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const currentYear = new Date().getFullYear();
    const currentMonthVal = String(new Date().getMonth() + 1).padStart(2, "0");

    const [repYear, setRepYear] = useState(String(currentYear));
    const [repMonth, setRepMonth] = useState(currentMonthVal);

    const [selectedDept, setSelectedDept] = useState<Department | null>(null);
    const [reportData, setReportData] = useState<CashSheetItem[]>([]);
    const [reportSummary, setReportSummary] = useState<CashSheetSummary | null>(null);
    const [showReport, setShowReport] = useState(false);
    const [reportLoading, setReportLoading] = useState(false);

    const epfNo = user?.Userno || "";
    const maroon = "text-[#7A0000]";
    const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";

    // Generate list of years for selection (current year down to 10 years back)
    const yearsList = Array.from({ length: 11 }, (_, i) => String(currentYear - i));

    useEffect(() => {
        const fetchDepartments = async () => {
            if (!epfNo) {
                setError("No EPF number available.");
                toast.error("Login required.");
                setLoading(false);
                return;
            }
            setLoading(true);
            try {
                const res = await fetch(`/misapi/api/incomeexpenditure/departments/${epfNo}`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = await res.json();
                const raw = Array.isArray(json)
                    ? json
                    : json.data || json.result || json.departments || [];
                const deps: Department[] = raw.map((d: any) => ({
                    DeptId: String(d.DeptId || d.deptId || ""),
                    DeptName: String(d.DeptName || d.deptName || "").trim(),
                }));
                setDepartments(deps);
                setFiltered(deps);
            } catch (e: any) {
                setError(e.message);
                toast.error("Failed to load cost centers.");
            } finally {
                setLoading(false);
            }
        };

        fetchDepartments();
    }, [epfNo]);

    useEffect(() => {
        const f = departments.filter(
            (d) =>
                (!searchId || d.DeptId.toLowerCase().includes(searchId.toLowerCase())) &&
                (!searchName || d.DeptName.toLowerCase().includes(searchName.toLowerCase()))
        );
        setFiltered(f);
        setPage(1);
    }, [searchId, searchName, departments]);

    const fetchReport = async (dept: Department) => {
        if (!repYear.trim() || repYear.length !== 4 || isNaN(Number(repYear))) {
            toast.error("Please enter a valid 4-digit year.");
            return;
        }
        if (!repMonth) {
            toast.error("Please select a month.");
            return;
        }

        setReportLoading(true);
        setSelectedDept(dept);
        setReportData([]);
        setReportSummary(null);
        setShowReport(true);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

        try {
            const url = `/misapi/api/cashsheet/report?repYear=${repYear.trim()}&repMonth=${repMonth}&costCtr=${dept.DeptId}`;
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();

            if (!json.success) throw new Error(json.message || "No data");

            const items: CashSheetItem[] = json.data || [];
            if (items.length === 0) {
                toast.warn("No records found.");
                setShowReport(false);
                setSelectedDept(null);
                return;
            }

            setReportData(items);
            setReportSummary(json.summary || null);
            toast.success(`${items.length} records loaded.`);
        } catch (e: any) {
            toast.error(
                e.name === "AbortError"
                    ? "Request timed out."
                    : e.message.includes("Failed to fetch")
                        ? "Server unreachable."
                        : e.message
            );
            setReportData([]);
            setReportSummary(null);
            setShowReport(false);
            setSelectedDept(null);
        } finally {
            setReportLoading(false);
        }
    };

    const clearFilters = () => {
        setSearchId("");
        setSearchName("");
    };

    const closeReport = () => {
        setShowReport(false);
        setReportData([]);
        setReportSummary(null);
        setSelectedDept(null);
        setReportLoading(false);
    };

    const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    return (
        <div
            className="max-w-[95%] mx-auto p-6 bg-white rounded-lg shadow-md text-sm md:text-base relative ml-16 mt-8"
            style={{ marginLeft: "2rem" }}
        >
            <h2 className={`text-xl font-bold mb-4 ${maroon}`}>
                Cash Sheet Report
            </h2>

            {/* ────── Year / Month filters (widened, matches Price Variance Report style) ────── */}
            <div className="bg-gray-50 p-4 rounded-lg mb-4 border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <div className="flex items-center gap-2">
                        <label className={`text-xs font-bold ${maroon} whitespace-nowrap`}>
                            Year:
                        </label>
                        <select
                            value={repYear}
                            onChange={(e) => setRepYear(e.target.value)}
                            className="pl-3 pr-3 py-1.5 w-full rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#7A0000] transition text-sm"
                        >
                            {yearsList.map((y) => (
                                <option key={y} value={y}>
                                    {y}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <label className={`text-xs font-bold ${maroon} whitespace-nowrap`}>
                            Month:
                        </label>
                        <select
                            value={repMonth}
                            onChange={(e) => setRepMonth(e.target.value)}
                            className="pl-3 pr-3 py-1.5 w-full rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#7A0000] transition text-sm"
                        >
                            {MONTHS.map((m) => (
                                <option key={m.value} value={m.value}>
                                    {m.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                        type="text"
                        value={searchId}
                        placeholder="Search by ID"
                        onChange={(e) => setSearchId(e.target.value)}
                        className="pl-10 pr-3 py-1.5 w-40 rounded-md border border-gray-300 focus:ring-2 focus:ring-[#7A0000] focus:border-transparent text-xs"
                    />
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                        type="text"
                        value={searchName}
                        placeholder="Search by Name"
                        onChange={(e) => setSearchName(e.target.value)}
                        className="pl-10 pr-3 py-1.5 w-40 rounded-md border border-gray-300 focus:ring-2 focus:ring-[#7A0000] focus:border-transparent text-xs"
                    />
                </div>
                {(searchId || searchName) && (
                    <button
                        onClick={clearFilters}
                        className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-md bg-gray-100 hover:bg-gray-200 text-xs transition"
                    >
                        <RotateCcw className="w-3 h-3" /> Clear
                    </button>
                )}
            </div>

            {loading && (
                <div className="flex flex-col items-center justify-center py-12">
                    <svg className="animate-spin h-10 w-10 text-[#7A0000]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <p className="mt-3 text-gray-600 text-sm">Loading cost centers...</p>
                </div>
            )}

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4 text-sm">
                    {error}
                </div>
            )}

            {!loading && !error && filtered.length > 0 && (
                <>
                    <div className="overflow-x-auto rounded-lg border border-gray-300">
                        <div className="max-h-[50vh] overflow-y-auto">
                            <table className="w-full table-fixed text-left text-xs md:text-sm border-collapse">
                                <thead>
                                    <tr className="bg-[#7A0000] text-white sticky top-0">
                                        <th className="border border-gray-300 px-4 py-2 w-1/4 text-center font-bold">Cost Center Code</th>
                                        <th className="border border-gray-300 px-4 py-2 w-1/2 text-center font-bold">Cost Center Name</th>
                                        <th className="border border-gray-300 px-4 py-2 w-1/4 text-center font-bold">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginated.map((dept, i) => (
                                        <tr key={i} className={i % 2 ? "bg-white" : "bg-gray-50"}>
                                            <td className="border border-gray-300 px-4 py-2 truncate font-mono">{dept.DeptId}</td>
                                            <td className="border border-gray-300 px-4 py-2 truncate">{dept.DeptName}</td>
                                            <td className="border border-gray-300 px-4 py-2 text-center">
                                                <button
                                                    onClick={() => fetchReport(dept)}
                                                    className={`px-3 py-1 rounded-md text-xs font-medium hover:opacity-90 transition shadow-sm flex items-center gap-1 mx-auto
                            ${selectedDept?.DeptId === dept.DeptId
                                                            ? "bg-green-600 text-white"
                                                            : `${maroonGrad} text-white`
                                                        }`}
                                                >
                                                    <Eye className="w-3 h-3" />
                                                    {selectedDept?.DeptId === dept.DeptId ? "Viewing" : "View"}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="flex justify-end items-center gap-3 mt-3">
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-3 py-1 border border-gray-300 rounded-md bg-white text-gray-600 text-xs hover:bg-gray-100 disabled:opacity-40 transition"
                        >
                            Previous
                        </button>
                        <span className="text-xs text-gray-600">
                            Page {page} of {Math.ceil(filtered.length / PAGE_SIZE)}
                        </span>
                        <button
                            onClick={() =>
                                setPage((p) =>
                                    Math.min(Math.ceil(filtered.length / PAGE_SIZE), p + 1)
                                )
                            }
                            disabled={page >= Math.ceil(filtered.length / PAGE_SIZE)}
                            className="px-3 py-1 border border-gray-300 rounded-md bg-white text-gray-600 text-xs hover:bg-gray-100 disabled:opacity-40 transition"
                        >
                            Next
                        </button>
                    </div>
                </>
            )}

            {showReport && selectedDept && (
                <div className="fixed inset-0 z-50 bg-transparent flex items-center justify-center p-4">
                    <div className="relative bg-white w-full max-w-[95vw] sm:max-w-4xl md:max-w-6xl lg:max-w-7xl rounded-2xl shadow-2xl overflow-hidden">
                        {reportLoading && (
                            <div className="absolute inset-0 bg-white/95 z-50 flex flex-col items-center justify-center gap-4">
                                <svg className="animate-spin h-14 w-14 text-[#7A0000]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                <p className="text-xl font-bold text-[#7A0000]">Loading Report...</p>
                                <p className="text-sm text-gray-600">Fetching cash sheet details from server</p>
                            </div>
                        )}
                        {!reportLoading && reportData.length > 0 && (
                            <CashSheetReportTable
                                data={reportData}
                                summary={reportSummary}
                                repYear={repYear}
                                repMonth={repMonth}
                                costCenter={selectedDept.DeptId}
                                departmentName={selectedDept.DeptName}
                                onClose={closeReport}
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CashSheetReport;