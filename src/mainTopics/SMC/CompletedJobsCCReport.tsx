// CompletedJobsCCReport.tsx
import React, { useEffect, useState } from "react";
import { Search, RotateCcw, Eye, X, Download, Printer } from "lucide-react";
import { useUser } from "../../contexts/UserContext";
import { toast } from "react-toastify";

interface Department {
    DeptId: string;
    DeptName: string;
}

interface CompletedJobsCCItem {
    ApplicationType: string | null;
    ApplicationNo: string | null;
    PivNo: string | null;
    PivNo3: string | null;
    PivDate3: string | null;
    PivAmount3: string | null;
    PivDate: string | null;
    PivAmount: string | null;
    ConfirmedDate: string | null;
    SubmitDate: string | null;
    ProjectNo: string | null;
    FirstName: string | null;
    LastName: string | null;
    Amount: string | null;
    FinishedDate: string | null;
    ContractorName: string | null;
    MeterNo1: string | null;
    InitReading1: string | null;
    MeterNo2: string | null;
    InitReading2: string | null;
    MeterNo3: string | null;
    InitReading3: string | null;
    NeighboursAccNo: string | null;
    Phase: string | null;
    ConnectionType: string | null;
    TariffCatCode: string | null;
    TariffCode: string | null;
    TotalLength: string | null;
    Sin: string | null;
    WiringType: string | null;
    ConnectedDate: string | null;
    ServiceStreetAddress: string | null;
    ServiceSuburb: string | null;
    ServiceCity: string | null;
    AccountNo: string | null;
    AccCreatedDate: string | null;
    PivReceiptNo: string | null;
    CctName: string | null;
}

interface CompletedJobsCCSummary {
    fromDate: string;
    toDate: string;
    costCtr: string;
    totalRecords: number;
}

/* ────── Constants ────── */
const PAGE_SIZE = 9;
const FETCH_TIMEOUT_MS = 240000;
const COMPANY_NAME = "Electricity Distribution Lanka Private Limited";

/* ────── Helpers ────── */
const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr?.trim()) return "";
    const dt = dateStr.trim();
    if (dt.includes("T")) return dt.split("T")[0].replace(/-/g, "/");
    if (/^\d{8}$/.test(dt)) return `${dt.slice(0, 4)}/${dt.slice(4, 6)}/${dt.slice(6)}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dt)) return dt.replace(/-/g, "/");
    return dt;
};

const csvEscape = (val: string | number | null | undefined): string => {
    if (val == null) return "";
    const str = String(val);
    return /[,\n"]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

/* ────── Table Modal Component ────── */
const CompletedJobsCCTable: React.FC<{
    data: CompletedJobsCCItem[];
    summary: CompletedJobsCCSummary | null;
    fromDate: string;
    toDate: string;
    costCenter: string;
    departmentName: string;
    onClose: () => void;
}> = ({ data, summary, fromDate, toDate, costCenter, departmentName, onClose }) => {
    const maroon = "text-[#7A0000]";
    const fromLabel = formatDate(fromDate);
    const toLabel = formatDate(toDate);
    const reportTitle = `Cost center wise completed jobs From ${fromLabel} To ${toLabel}`;

    const sortedData = [...data]; // already ordered by backend (application_type desc, project_no asc)
    const totalRecords = summary?.totalRecords ?? sortedData.length;

    const columns: { key: keyof CompletedJobsCCItem; label: string; isDate?: boolean }[] = [
        { key: "ApplicationType", label: "App Type" },
        { key: "ApplicationNo", label: "App No" },
        { key: "ProjectNo", label: "Project No" },
        { key: "FirstName", label: "First Name" },
        { key: "LastName", label: "Last Name" },
        { key: "ContractorName", label: "Contractor Name" },
        { key: "Amount", label: "Amount" },
        { key: "FinishedDate", label: "Finished Date", isDate: true },
        { key: "PivNo", label: "PIV No" },
        { key: "PivDate", label: "PIV Date", isDate: true },
        { key: "PivAmount", label: "PIV Amount" },
        { key: "PivNo3", label: "PIV No (P)" },
        { key: "PivDate3", label: "PIV Date (P)", isDate: true },
        { key: "PivAmount3", label: "PIV Amount (P)" },
        { key: "PivReceiptNo", label: "PIV Receipt No" },
        { key: "ConfirmedDate", label: "Confirmed Date", isDate: true },
        { key: "SubmitDate", label: "Submit Date", isDate: true },
        { key: "AccountNo", label: "Account No" },
        { key: "AccCreatedDate", label: "Acc Created Date", isDate: true },
        { key: "MeterNo1", label: "Meter No 1" },
        { key: "InitReading1", label: "Init Reading 1" },
        { key: "MeterNo2", label: "Meter No 2" },
        { key: "InitReading2", label: "Init Reading 2" },
        { key: "MeterNo3", label: "Meter No 3" },
        { key: "InitReading3", label: "Init Reading 3" },
        { key: "ConnectedDate", label: "Connected Date", isDate: true },
        { key: "NeighboursAccNo", label: "Neighbours Acc No" },
        { key: "Phase", label: "Phase" },
        { key: "ConnectionType", label: "Connection Type" },
        { key: "TariffCatCode", label: "Tariff Cat Code" },
        { key: "TariffCode", label: "Tariff Code" },
        { key: "WiringType", label: "Wiring Type" },
        { key: "TotalLength", label: "Total Length" },
        { key: "Sin", label: "SIN" },
        { key: "ServiceStreetAddress", label: "Service Street Address" },
        { key: "ServiceSuburb", label: "Service Suburb" },
        { key: "ServiceCity", label: "Service City" },
    ];

    const cellValue = (it: CompletedJobsCCItem, col: (typeof columns)[number]) => {
        const raw = it[col.key];
        return col.isDate ? formatDate(raw) : raw ?? "";
    };

    /* ────── CSV Download ────── */
    const downloadCSV = () => {
        const titleRows = [
            reportTitle,
            COMPANY_NAME,
            `Cost Center: ${costCenter} / ${departmentName}`,
            `Total Records: ${totalRecords}`,
            "",
        ];
        const headers = ["Item", ...columns.map((c) => c.label)];
        const rows = sortedData.map((it, i) =>
            [csvEscape(i + 1), ...columns.map((c) => csvEscape(cellValue(it, c)))].join(",")
        );
        const csv = [...titleRows, headers.join(","), ...rows].join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `CompletedJobsCC_${costCenter}_${fromDate}_${toDate}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    /* ────── Print PDF ────── */
    const printPDF = () => {
        let rowsHTML = "";
        sortedData.forEach((it, i) => {
            const cells = columns
                .map((c) => `<td>${cellValue(it, c) || ""}</td>`)
                .join("");
            rowsHTML += `
        <tr class="${i % 2 ? "bg-white" : "bg-gray-50"}">
          <td style="text-align:center;">${i + 1}</td>
          ${cells}
        </tr>`;
        });

        const headCells = columns.map((c) => `<th>${c.label}</th>`).join("");

        const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    @media print {
      @page { margin: 8mm 5mm 10mm 5mm; size: landscape; }
      body { margin:0; font-family:Arial,Helvetica,sans-serif; }
      .title { margin: 10px 8px 2px; text-align:center; font-weight:bold; color:#7A0000; font-size:12.5px; }
      .company { margin: 2px 8px 6px; text-align:center; font-weight:bold; color:#7A0000; font-size:13px; }
      .info { margin:6px 8px 10px; font-size:9px; }
      table { border-collapse:collapse; width:100%; font-size:7.5px; }
      th, td { border:1px solid #d1d5db; padding:4px 6px; word-wrap:break-word; }
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
  <div class="title">${reportTitle}</div>
  <div class="company">${COMPANY_NAME}</div>
  <div class="info"><strong>Cost Center:</strong> ${costCenter} / ${departmentName} &nbsp;&nbsp; <strong>Records:</strong> ${totalRecords}</div>
  <table>
    <thead>
      <tr>
        <th>Item</th>
        ${headCells}
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

                    <h2 className={`text-base md:text-lg font-bold text-center ${maroon}`}>
                        {reportTitle}
                    </h2>
                    <h3 className={`text-sm md:text-base font-semibold text-center mb-1 ${maroon}`}>
                        {COMPANY_NAME}
                    </h3>
                    <div className="text-sm mb-4 px-2">
                        <span className="font-bold">Cost Center:</span> {costCenter} / {departmentName}
                        <span className="ml-4 text-gray-500">Records: {totalRecords}</span>
                    </div>

                    <div className="mt-1 mb-5 border border-gray-200 rounded-lg overflow-x-auto print:ml-12 print:mt-12 print:overflow-visible">
                        <div style={{ minWidth: `${(columns.length + 1) * 130}px` }}>
                            <table className="w-full text-xs border-collapse">
                                <thead>
                                    <tr className="bg-[#7A0000] text-white sticky top-0">
                                        <th className="px-3 py-2 border border-gray-300 font-bold">Item</th>
                                        {columns.map((c) => (
                                            <th key={c.key} className="px-3 py-2 border border-gray-300 font-bold whitespace-nowrap">
                                                {c.label}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedData.map((it, i) => (
                                        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                            <td className="px-3 py-2 border-l border-r border-gray-300 text-center font-mono">{i + 1}</td>
                                            {columns.map((c) => (
                                                <td
                                                    key={c.key}
                                                    className={`px-3 py-2 border-r border-gray-300 font-mono ${
                                                        c.isDate ? "text-center" : ""
                                                    }`}
                                                >
                                                    {cellValue(it, c)}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ────── MAIN COMPONENT ────── */
const CompletedJobsCCReport: React.FC = () => {
    const { user } = useUser();
    const [departments, setDepartments] = useState<Department[]>([]);
    const [filtered, setFiltered] = useState<Department[]>([]);
    const [searchId, setSearchId] = useState("");
    const [searchName, setSearchName] = useState("");
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const todayStr = new Date().toISOString().slice(0, 10);
    const firstOfMonthStr = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString()
        .slice(0, 10);

    const [fromDate, setFromDate] = useState(firstOfMonthStr);
    const [toDate, setToDate] = useState(todayStr);

    const [selectedDept, setSelectedDept] = useState<Department | null>(null);
    const [reportData, setReportData] = useState<CompletedJobsCCItem[]>([]);
    const [reportSummary, setReportSummary] = useState<CompletedJobsCCSummary | null>(null);
    const [showReport, setShowReport] = useState(false);
    const [reportLoading, setReportLoading] = useState(false);

    const epfNo = user?.Userno || "";
    const maroon = "text-[#7A0000]";
    const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";

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
        if (!fromDate) {
            toast.error("Please select a from date.");
            return;
        }
        if (!toDate) {
            toast.error("Please select a to date.");
            return;
        }
        if (new Date(toDate) < new Date(fromDate)) {
            toast.error("To date cannot be earlier than from date.");
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
            const url = `/misapi/api/completedjobscc/report?fromDate=${fromDate}&toDate=${toDate}&costCtr=${dept.DeptId}`;
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();

            if (!json.success) throw new Error(json.message || "No data");

            const items: CompletedJobsCCItem[] = json.data || [];
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
                Cost Center Wise Completed Jobs
            </h2>

            {/* ────── From / To date filters ────── */}
            <div className="bg-gray-50 p-4 rounded-lg mb-4 border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <div className="flex items-center gap-2">
                        <label className={`text-xs font-bold ${maroon} whitespace-nowrap`}>
                            From Date:
                        </label>
                        <input
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            className="pl-3 pr-3 py-1.5 w-full rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#7A0000] transition text-sm"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <label className={`text-xs font-bold ${maroon} whitespace-nowrap`}>
                            To Date:
                        </label>
                        <input
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            className="pl-3 pr-3 py-1.5 w-full rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#7A0000] transition text-sm"
                        />
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
                                <p className="text-sm text-gray-600">Fetching completed job records from server</p>
                            </div>
                        )}
                        {!reportLoading && reportData.length > 0 && (
                            <CompletedJobsCCTable
                                data={reportData}
                                summary={reportSummary}
                                fromDate={fromDate}
                                toDate={toDate}
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

export default CompletedJobsCCReport;