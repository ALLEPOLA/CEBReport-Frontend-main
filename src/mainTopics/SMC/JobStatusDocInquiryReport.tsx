// JobStatusDocInquiryReport.tsx
import React, { useEffect, useState } from "react";
import { Search, RotateCcw, Eye, X, Download, Printer } from "lucide-react";
import { useUser } from "../../contexts/UserContext";
import { toast } from "react-toastify";

interface Department {
    DeptId: string;
    DeptName: string;
}

interface AppSubType {
    Code: string;
    Description: string;
}

interface JobStatusDocInquiryItem {
    Status: string | null;
    FundId: string | null;
    ApplicationId: string | null;
    ProjectNo: string | null;
    EstimateNo: string | null;
    CatCd: string | null;
    StdCost: number | null;
    TotalCost: number | null;
    Name: string | null;
    Address: string | null;
    TranStatus: string | null;
    CctName: string | null;
}

interface JobStatusDocInquirySummary {
    fromDate: string;
    toDate: string;
    costCtr: string;
    appSubType: string;
    totalRecords: number;
}

interface StatusGroup {
    status: string;
    items: JobStatusDocInquiryItem[];
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

// Normalizes a raw dictionary row from /appsubtypes (unknown real column names) into a
// { Code, Description } pair by trying common key variants.
const normalizeAppSubType = (row: Record<string, any>): AppSubType => {
    const pick = (keys: string[]): string => {
        for (const k of keys) {
            if (row[k] !== undefined && row[k] !== null) return String(row[k]).trim();
        }
        return "";
    };
    const code = pick(["APPSUBTYPE", "AppSubType", "CODE", "Code", "SUB_TYPE_CODE", "ID"]);
    const description = pick(["DESCRIPTION", "Description", "DESCR", "NAME"]);
    return {
        Code: code || Object.values(row)[0]?.toString().trim() || "",
        Description: description || Object.values(row)[1]?.toString().trim() || code,
    };
};

// Groups the (already status-ordered) rows by TranStatus, preserving first-seen order of
// each status label, and numbering items 1..n within each group - matching the screenshot's
// per-status Item numbering.
const groupByStatus = (items: JobStatusDocInquiryItem[]): StatusGroup[] => {
    const order: string[] = [];
    const map = new Map<string, JobStatusDocInquiryItem[]>();
    items.forEach((it) => {
        const status = it.TranStatus?.trim() || "Unspecified";
        if (!map.has(status)) {
            map.set(status, []);
            order.push(status);
        }
        map.get(status)!.push(it);
    });
    return order.map((status) => ({ status, items: map.get(status)! }));
};

/* ────── Table Modal Component ────── */
const JobStatusDocInquiryTable: React.FC<{
    data: JobStatusDocInquiryItem[];
    summary: JobStatusDocInquirySummary | null;
    fromDate: string;
    toDate: string;
    costCenter: string;
    departmentName: string;
    onClose: () => void;
}> = ({ data, summary, fromDate, toDate, costCenter, departmentName, onClose }) => {
    const maroon = "text-[#7A0000]";
    const fromLabel = formatDate(fromDate);
    const toLabel = formatDate(toDate);
    const reportTitle = `Job Status Document Inquiry (Application Sub Type Wise) - From ${fromLabel} To ${toLabel}`;
    const costCenterLine = `Cost Centre : ${costCenter}${departmentName ? " / " + departmentName : ""}`;
    const categoryLabel = data[0]?.CatCd || "";

    const groups = groupByStatus(data);
    const totalRecords = summary?.totalRecords ?? data.length;

    /* ────── CSV Download ────── */
    const downloadCSV = () => {
        const titleRows = [
            csvEscape(COMPANY_NAME),
            csvEscape(reportTitle),
            csvEscape(costCenterLine),
            `Total Records: ${totalRecords}`,
            "",
        ];
        const headers = [
            "Item",
            "Application No",
            "Estimate No",
            "Project No",
            "Detail Cost (Rs.)",
            "Standard Cost (Rs.)",
            "Name",
            "Address",
        ];
        const lines: string[] = [...titleRows, csvEscape(categoryLabel), "", headers.join(",")];
        groups.forEach((g) => {
            lines.push(csvEscape(g.status));
            g.items.forEach((it, i) => {
                lines.push(
                    [
                        csvEscape(i + 1),
                        csvEscape(it.ApplicationId),
                        csvEscape(it.EstimateNo),
                        csvEscape(it.ProjectNo),
                        csvEscape(formatAmount(it.StdCost)),
                        csvEscape(formatAmount(it.TotalCost)),
                        csvEscape(it.Name),
                        csvEscape(it.Address),
                    ].join(",")
                );
            });
            lines.push(csvEscape(`No of Records : ${g.status} ${g.items.length}`));
            lines.push("");
        });
        const csv = lines.join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `JobStatusDocInquiry_${costCenter}_${fromDate}_${toDate}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    /* ────── Print PDF ────── */
    const printPDF = () => {
        let bodyHTML = "";
        groups.forEach((g) => {
            bodyHTML += `<tr><td colspan="8" style="background:#e5e7eb; font-weight:bold; text-align:left;">${g.status}</td></tr>`;
            g.items.forEach((it, i) => {
                bodyHTML += `
        <tr class="${i % 2 ? "bg-white" : "bg-gray-50"}">
          <td style="text-align:center;">${i + 1}</td>
          <td>${it.ApplicationId || ""}</td>
          <td>${it.EstimateNo || ""}</td>
          <td>${it.ProjectNo || ""}</td>
          <td style="text-align:right;">${formatAmount(it.StdCost)}</td>
          <td style="text-align:right;">${formatAmount(it.TotalCost)}</td>
          <td>${it.Name || ""}</td>
          <td>${it.Address || ""}</td>
        </tr>`;
            });
            bodyHTML += `<tr><td colspan="8" style="text-align:left; font-style:italic;">No of Records &nbsp;: ${g.status} &nbsp; ${g.items.length}</td></tr>`;
        });

        const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    @media print {
      @page { margin: 8mm 5mm 10mm 5mm; size: landscape; }
      body { margin:0; font-family:Arial,Helvetica,sans-serif; }
      .title { margin: 10px 8px 2px; text-align:center; font-weight:bold; color:#000; font-size:14px; }
      .info { margin:2px 8px 10px; text-align:center; font-weight:bold; font-size:11px; }
      .category { margin:6px 8px 4px; font-weight:bold; font-size:11px; }
      table { border-collapse:collapse; width:100%; font-size:9px; }
      th, td { border:1px solid #d1d5db; padding:5px 7px; word-wrap:break-word; }
      th { background:#e5e7eb; text-align:center; font-weight:bold; }
      tr.bg-gray-50 { background:#f9fafb; }
      @page {
        @bottom-left { content:"Printed on: ${new Date().toLocaleString("en-US", { timeZone: "Asia/Colombo" })}"; font-size:7px; color:gray; }
        @bottom-right { content:"Page " counter(page) " of " counter(pages); font-size:7px; color:gray; }
      }
    }
  </style>
</head>
<body>
  <div class="title">${reportTitle}</div>
  <div class="info">${costCenterLine}</div>
  <div class="category">${categoryLabel}</div>
  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th>Application No</th>
        <th>Estimate No</th>
        <th>Project No</th>
        <th>Detail Cost (Rs.)</th>
        <th>Standard Cost (Rs.)</th>
        <th>Name</th>
        <th>Address</th>
      </tr>
    </thead>
    <tbody>${bodyHTML}</tbody>
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

                    <h2 className="text-base md:text-lg font-bold text-center text-gray-900">
                        {reportTitle}
                    </h2>
                    <p className="text-sm md:text-base font-semibold text-center mb-1 text-gray-800">
                        {costCenterLine}
                    </p>

                    <div className="mt-2 mb-5 border border-gray-200 rounded-lg overflow-x-auto print:ml-12 print:mt-12 print:overflow-visible">
                        <div className="min-w-[1000px]">
                            <table className="w-full text-xs border-collapse">
                                <thead>
                                    <tr className="bg-gray-200 text-gray-900 sticky top-0">
                                        <th className="px-3 py-2 border border-gray-300 font-bold">Item</th>
                                        <th className="px-3 py-2 border border-gray-300 font-bold">Application No</th>
                                        <th className="px-3 py-2 border border-gray-300 font-bold">Estimate No</th>
                                        <th className="px-3 py-2 border border-gray-300 font-bold">Project No</th>
                                        <th className="px-3 py-2 border border-gray-300 font-bold text-right">Detail Cost (Rs.)</th>
                                        <th className="px-3 py-2 border border-gray-300 font-bold text-right">Standard Cost (Rs.)</th>
                                        <th className="px-3 py-2 border border-gray-300 font-bold">Name</th>
                                        <th className="px-3 py-2 border border-gray-300 font-bold">Address</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td colSpan={8} className="px-3 py-2 border border-gray-300 font-bold bg-gray-100">
                                            {categoryLabel}
                                        </td>
                                    </tr>
                                    {groups.map((g, gi) => (
                                        <React.Fragment key={gi}>
                                            <tr>
                                                <td colSpan={8} className="px-3 py-1.5 border border-gray-300 font-semibold bg-gray-50 text-gray-700">
                                                    {g.status}
                                                </td>
                                            </tr>
                                            {g.items.map((it, i) => (
                                                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                                    <td className="px-3 py-1.5 border-l border-r border-gray-300 text-center font-mono">{i + 1}</td>
                                                    <td className="px-3 py-1.5 border-r border-gray-300 font-mono">{it.ApplicationId}</td>
                                                    <td className="px-3 py-1.5 border-r border-gray-300 font-mono">{it.EstimateNo}</td>
                                                    <td className="px-3 py-1.5 border-r border-gray-300 font-mono">{it.ProjectNo}</td>
                                                    <td className="px-3 py-1.5 border-r border-gray-300 text-right font-mono">{formatAmount(it.StdCost)}</td>
                                                    <td className="px-3 py-1.5 border-r border-gray-300 text-right font-mono">{formatAmount(it.TotalCost)}</td>
                                                    <td className="px-3 py-1.5 border-r border-gray-300">{it.Name}</td>
                                                    <td className="px-3 py-1.5 border-r border-gray-300">{it.Address}</td>
                                                </tr>
                                            ))}
                                            <tr>
                                                <td colSpan={8} className="px-3 py-1.5 border border-gray-300 italic text-gray-600">
                                                    No of Records &nbsp;: {g.status} &nbsp; {g.items.length}
                                                </td>
                                            </tr>
                                        </React.Fragment>
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
const JobStatusDocInquiryReport: React.FC = () => {
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

    const [appSubTypes, setAppSubTypes] = useState<AppSubType[]>([]);
    const [appSubType, setAppSubType] = useState("");
    const [appSubTypesLoading, setAppSubTypesLoading] = useState(true);

    const [selectedDept, setSelectedDept] = useState<Department | null>(null);
    const [reportData, setReportData] = useState<JobStatusDocInquiryItem[]>([]);
    const [reportSummary, setReportSummary] = useState<JobStatusDocInquirySummary | null>(null);
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
        const fetchAppSubTypes = async () => {
            setAppSubTypesLoading(true);
            try {
                const res = await fetch(`/misapi/api/jobstatusdocinquiry/appsubtypes`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = await res.json();
                const raw = Array.isArray(json) ? json : json.data || [];
                const types: AppSubType[] = raw.map((r: any) => normalizeAppSubType(r));
                setAppSubTypes(types);
                if (types.length > 0) setAppSubType(types[0].Code);
            } catch (e: any) {
                toast.error("Failed to load application sub types.");
            } finally {
                setAppSubTypesLoading(false);
            }
        };

        fetchAppSubTypes();
    }, []);

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
        if (!appSubType) {
            toast.error("Please select an application sub type.");
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
            const url = `/misapi/api/jobstatusdocinquiry/report?fromDate=${fromDate}&toDate=${toDate}&costCtr=${dept.DeptId}&appSubType=${appSubType}`;
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();

            if (!json.success) throw new Error(json.message || "No data");

            const items: JobStatusDocInquiryItem[] = json.data || [];
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
                Job Status Document Inquiry (Application Sub Type Wise)
            </h2>

            {/* ────── Date range / Application Sub Type filters ────── */}
            <div className="bg-gray-50 p-4 rounded-lg mb-4 border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
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

                    <div className="flex items-center gap-2">
                        <label className={`text-xs font-bold ${maroon} whitespace-nowrap`}>
                            Sub Type:
                        </label>
                        <select
                            value={appSubType}
                            onChange={(e) => setAppSubType(e.target.value)}
                            disabled={appSubTypesLoading || appSubTypes.length === 0}
                            className="pl-3 pr-3 py-1.5 w-full rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#7A0000] transition text-sm disabled:opacity-50"
                        >
                            {appSubTypesLoading && <option>Loading...</option>}
                            {!appSubTypesLoading && appSubTypes.length === 0 && <option>No sub types found</option>}
                            {appSubTypes.map((st) => (
                                <option key={st.Code} value={st.Code}>
                                    {st.Description ? `${st.Code} - ${st.Description}` : st.Code}
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
                                <p className="text-sm text-gray-600">Fetching job status details from server</p>
                            </div>
                        )}
                        {!reportLoading && reportData.length > 0 && (
                            <JobStatusDocInquiryTable
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

export default JobStatusDocInquiryReport;