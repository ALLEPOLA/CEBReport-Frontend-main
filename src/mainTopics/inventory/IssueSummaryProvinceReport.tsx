// IssueSummaryProvinceReport.tsx

import React, { useEffect, useMemo, useState } from "react";
import { Download, Printer, Loader2, Search, RotateCcw, Eye } from "lucide-react";
import { toast } from "react-toastify";
import { useUser } from "../../contexts/UserContext";

/* ────── Types ────── */
interface Company {
    compId: string;
    CompName: string;
}

interface IssueSummaryItem {
    MatCd: string | null;
    MatNm: string | null;
    DeptCompName: string | null; // "c8" -- the area/unit group name for this dept_id
    DeptId: string | null;
    CommitedQty: number | null; // actually a summed transaction quantity
    CompName: string | null; // top-level province/company name
}

interface IssueSummarySummary {
    fromDate: string;
    toDate: string;
    compId: string;
    matCode: string;
    totalRecords: number;
    totalCommitedQty: number;
}

interface PivotRow {
    matCd: string;
    matNm: string;
    values: Record<string, number>; // deptId -> qty
}

interface PivotResult {
    areaOrder: string[];
    areaDepts: Record<string, string[]>;
    rows: PivotRow[];
}

/* ────── Constants ────── */
const FETCH_TIMEOUT_MS = 240000;
const PAGE_SIZE = 9;
const NOTE_TEXT =
    "Note : Consider Issue/ Isse Cancellation /Return/ Return Cancellation -('ISSUE' , 'IS_CAN', 'RTV','RTV-CL'). CSC Consider only Job Issues";

/* ────── Helpers ────── */
const formatQty = (val: number | null | undefined): string => {
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

/* Build the area/dept pivot structure and per-material row values from the flat backend list */
function buildPivot(data: IssueSummaryItem[]): PivotResult {
    const areaDepts: Record<string, string[]> = {};

    data.forEach((it) => {
        const area = (it.DeptCompName || "UNSPECIFIED").trim();
        const dept = (it.DeptId || "").trim();
        if (!dept) return;
        if (!areaDepts[area]) areaDepts[area] = [];
        if (!areaDepts[area].includes(dept)) areaDepts[area].push(dept);
    });

    const areaOrder = Object.keys(areaDepts).sort((a, b) => a.localeCompare(b));
    areaOrder.forEach((a) =>
        areaDepts[a].sort((x, y) => x.localeCompare(y, undefined, { numeric: true }))
    );

    const matMap = new Map<string, { matNm: string; values: Record<string, number> }>();
    data.forEach((it) => {
        const key = (it.MatCd || "").trim();
        if (!key) return;
        if (!matMap.has(key)) matMap.set(key, { matNm: (it.MatNm || "").trim(), values: {} });
        const row = matMap.get(key)!;
        const dept = (it.DeptId || "").trim();
        row.values[dept] = (row.values[dept] || 0) + (it.CommitedQty || 0);
    });

    const rows: PivotRow[] = Array.from(matMap.entries())
        .map(([matCd, v]) => ({ matCd, matNm: v.matNm, values: v.values }))
        .sort((a, b) => a.matCd.localeCompare(b.matCd));

    return { areaOrder, areaDepts, rows };
}

const areaUnitTotal = (row: PivotRow, deptIds: string[]): number =>
    deptIds.reduce((sum, d) => sum + (row.values[d] || 0), 0);

const provincialTotal = (row: PivotRow, areaOrder: string[], areaDepts: Record<string, string[]>): number =>
    areaOrder.reduce((sum, area) => sum + areaUnitTotal(row, areaDepts[area]), 0);

/* ────── Report Table Component ────── */
const IssueSummaryProvinceTable: React.FC<{
    data: IssueSummaryItem[];
    summary: IssueSummarySummary | null;
    fromDate: string;
    toDate: string;
    compId: string;
    onClose: () => void;
}> = ({ data, summary, fromDate, toDate, compId, onClose }) => {
    const maroon = "text-[#7A0000]";
    const compName = data[0]?.CompName || summary?.compId || compId;

    const pivot = useMemo(() => buildPivot(data), [data]);
    const { areaOrder, areaDepts, rows } = pivot;

    /* ────── CSV Download ────── */
    const downloadCSV = () => {
        const headerRow1: (string | number)[] = ["Mat Code", "Material Name"];
        const headerRow2: (string | number)[] = ["", ""];
        areaOrder.forEach((area) => {
            const depts = areaDepts[area];
            headerRow1.push(area, ...Array(depts.length).fill(""));
            headerRow2.push(...depts, `UNIT TOTAL - ${area}`);
        });
        headerRow1.push("Provincial Total");
        headerRow2.push("");

        const dataRows = rows.map((row) => {
            const cells: (string | number)[] = [row.matCd, row.matNm];
            areaOrder.forEach((area) => {
                const depts = areaDepts[area];
                depts.forEach((d) => cells.push(formatQty(row.values[d] || 0)));
                cells.push(formatQty(areaUnitTotal(row, depts)));
            });
            cells.push(formatQty(provincialTotal(row, areaOrder, areaDepts)));
            return cells;
        });

        const csv = [headerRow1, headerRow2, ...dataRows]
            .map((r) => r.map(csvEscape).join(","))
            .join("\n");

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `IssueSummaryProvince_${compId}_${fromDate}_${toDate}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    /* ────── Print PDF ────── */
    const printPDF = () => {
        let headRow1 = `<th rowspan="2">Mat_cd</th><th rowspan="2">Material Name</th>`;
        areaOrder.forEach((area) => {
            const depts = areaDepts[area];
            headRow1 += `<th colspan="${depts.length + 1}">${area}</th>`;
        });
        headRow1 += `<th rowspan="2">Provincial Total</th>`;

        let headRow2 = "";
        areaOrder.forEach((area) => {
            areaDepts[area].forEach((d) => (headRow2 += `<th>${d}</th>`));
            headRow2 += `<th>UNIT TOTAL -<br/>${area}</th>`;
        });

        let bodyRows = "";
        rows.forEach((row, i) => {
            bodyRows += `<tr class="${i % 2 ? "bg-white" : "bg-gray-50"}">`;
            bodyRows += `<td style="text-align:left;">${row.matCd}</td>`;
            bodyRows += `<td style="text-align:left;">${row.matNm}</td>`;
            areaOrder.forEach((area) => {
                const depts = areaDepts[area];
                depts.forEach((d) => {
                    bodyRows += `<td style="text-align:right;">${formatQty(row.values[d] || 0)}</td>`;
                });
                bodyRows += `<td style="text-align:right;font-weight:bold;">${formatQty(
                    areaUnitTotal(row, depts)
                )}</td>`;
            });
            bodyRows += `<td style="text-align:right;font-weight:bold;">${formatQty(
                provincialTotal(row, areaOrder, areaDepts)
            )}</td>`;
            bodyRows += `</tr>`;
        });

        const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    @media print {
      @page { size: landscape; margin: 6mm 4mm 10mm 4mm; }
      body { margin:0; font-family:Arial,Helvetica,sans-serif; }
      .title { margin: 6px 6px 2px; text-align:center; font-weight:bold; color:#7A0000; font-size:12px; }
      .subtitle { margin: 0 6px 4px; text-align:center; font-weight:bold; color:#7A0000; font-size:11px; }
      .note { margin: 0 6px 8px; font-size:7px; color:#444; }
      table { border-collapse:collapse; width:100%; font-size:6.5px; table-layout:fixed; }
      th, td { border:1px solid #d1d5db; padding:2px 3px; word-wrap:break-word; }
      th { background:#7A0000; color:#fff; text-align:center; font-weight:bold; }
      tr.bg-gray-50 { background:#f5f5f5; }
      @page {
        @bottom-left { content:"Date & time of the Report Generated : ${new Date().toLocaleString(
            "en-GB",
            { timeZone: "Asia/Colombo" }
        )}"; font-size:7px; color:gray; }
        @bottom-right { content:"Page " counter(page) " of " counter(pages); font-size:7px; color:gray; }
      }
    }
  </style>
</head>
<body>
  <div class="title">Province : ${compId} / ${compName}</div>
  <div class="subtitle">Issue Summary - From ${fromDate} To ${toDate}</div>
  <div class="note">${NOTE_TEXT}</div>
  <table>
    <thead>
      <tr>${headRow1}</tr>
      <tr>${headRow2}</tr>
    </thead>
    <tbody>${bodyRows}</tbody>
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
            <div className="relative bg-white w-[95vw] lg:w-[80vw] max-w-[1800px] rounded-2xl shadow-2xl border border-gray-200 overflow-hidden mt-10 lg:ml-64 mx-auto print:relative print:w-full print:max-w-none print:rounded-none print:shadow-none print:border-none print:overflow-visible print:ml-0">
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
                            className="px-4 py-1.5 bg-[#7A0000] hover:bg-[#A52A2A] text-xs rounded-md text-white transition"
                        >
                            Close
                        </button>
                    </div>

                    <h2 className={`text-base md:text-lg font-bold text-center ${maroon}`}>
                        Province : {compId} / {compName}
                    </h2>
                    <h3 className={`text-sm md:text-base font-semibold text-center mb-1 ${maroon}`}>
                        Issue Summary - From {fromDate} To {toDate}
                    </h3>
                    <p className="text-center text-[11px] text-gray-500 mb-4">{NOTE_TEXT}</p>

                    <div className="border border-gray-200 rounded-lg overflow-x-auto">
                        <table className="border-collapse text-[10px]" style={{ minWidth: "100%" }}>
                            <thead>
                                <tr className="bg-[#7A0000] text-white">
                                    <th
                                        rowSpan={2}
                                        className="sticky left-0 z-10 bg-[#7A0000] px-2 py-1.5 border border-gray-300 min-w-[90px]"
                                    >
                                        Mat_cd
                                    </th>
                                    <th
                                        rowSpan={2}
                                        className="sticky left-[90px] z-10 bg-[#7A0000] px-2 py-1.5 border border-gray-300 min-w-[220px] text-left"
                                    >
                                        Material Name
                                    </th>
                                    {areaOrder.map((area) => (
                                        <th
                                            key={area}
                                            colSpan={areaDepts[area].length + 1}
                                            className="px-2 py-1.5 border border-gray-300"
                                        >
                                            {area}
                                        </th>
                                    ))}
                                    <th rowSpan={2} className="px-2 py-1.5 border border-gray-300 min-w-[100px]">
                                        Provincial Total
                                    </th>
                                </tr>
                                <tr className="bg-[#A52A2A] text-white">
                                    {areaOrder.map((area) =>
                                        [
                                            ...areaDepts[area].map((d) => (
                                                <th key={`${area}-${d}`} className="px-1.5 py-1 border border-gray-300 min-w-[55px]">
                                                    {d}
                                                </th>
                                            )),
                                            <th key={`${area}-unit`} className="px-1.5 py-1 border border-gray-300 min-w-[70px]">
                                                UNIT TOTAL
                                                <br />- {area}
                                            </th>,
                                        ]
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, i) => (
                                    <tr key={row.matCd} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                        <td className="sticky left-0 z-10 bg-inherit px-2 py-1 border border-gray-300 font-mono">
                                            {row.matCd}
                                        </td>
                                        <td className="sticky left-[90px] z-10 bg-inherit px-2 py-1 border border-gray-300">
                                            {row.matNm}
                                        </td>
                                        {areaOrder.map((area) => {
                                            const depts = areaDepts[area];
                                            return (
                                                <React.Fragment key={area}>
                                                    {depts.map((d) => (
                                                        <td key={d} className="px-1.5 py-1 border border-gray-300 text-right font-mono">
                                                            {formatQty(row.values[d] || 0)}
                                                        </td>
                                                    ))}
                                                    <td className="px-1.5 py-1 border border-gray-300 text-right font-mono font-semibold">
                                                        {formatQty(areaUnitTotal(row, depts))}
                                                    </td>
                                                </React.Fragment>
                                            );
                                        })}
                                        <td className="px-2 py-1 border border-gray-300 text-right font-mono font-bold">
                                            {formatQty(provincialTotal(row, areaOrder, areaDepts))}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-3 text-xs text-gray-500 text-right">
                        Total Records: {summary?.totalRecords ?? data.length}
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ────── MAIN COMPONENT ────── */
const IssueSummaryProvinceReport: React.FC = () => {
    const { user } = useUser();
    const epfNo = user?.Userno || "";

    const maroon = "text-[#7A0000]";
    const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";

    const todayStr = new Date().toISOString().slice(0, 10);
    const firstOfMonthStr = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString()
        .slice(0, 10);

    /* ── Province/company picker state (same pattern as ProvincePeriodStatusReport) ── */
    const [companies, setCompanies] = useState<Company[]>([]);
    const [filteredCompanies, setFilteredCompanies] = useState<Company[]>([]);
    const [searchId, setSearchId] = useState("");
    const [searchName, setSearchName] = useState("");
    const [page, setPage] = useState(1);
    const [companyLoading, setCompanyLoading] = useState(true);
    const [companyError, setCompanyError] = useState<string | null>(null);
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

    /* ── Filter state ── */
    const [fromDate, setFromDate] = useState(firstOfMonthStr);
    const [toDate, setToDate] = useState(todayStr);
    const [matCode, setMatCode] = useState("");

    /* ── Report state ── */
    const [reportData, setReportData] = useState<IssueSummaryItem[]>([]);
    const [reportSummary, setReportSummary] = useState<IssueSummarySummary | null>(null);
    const [showReport, setShowReport] = useState(false);
    const [loading, setLoading] = useState(false);

    /* ────── Fetch Provinces/Companies ────── */
    useEffect(() => {
        const fetchCompanies = async () => {
            if (!epfNo) {
                setCompanyError("No EPF number available. Please login again.");
                setCompanyLoading(false);
                return;
            }

            setCompanyLoading(true);
            try {
                const res = await fetch(
                    `/misapi/api/incomeexpenditure/Usercompanies/${epfNo}/60`
                );
                if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

                const contentType = res.headers.get("content-type");
                if (!contentType || !contentType.includes("application/json")) {
                    const text = await res.text();
                    throw new Error(
                        `Expected JSON but got ${contentType}. Response: ${text.substring(0, 100)}`
                    );
                }

                const parsed = await res.json();

                let rawData = [];
                if (Array.isArray(parsed)) {
                    rawData = parsed;
                } else if (parsed.data && Array.isArray(parsed.data)) {
                    rawData = parsed.data;
                } else {
                    rawData = [];
                }

                const companiesData: Company[] = rawData.map((item: any) => ({
                    compId: item.CompId,
                    CompName: item.CompName,
                }));

                setCompanies(companiesData);
                setFilteredCompanies(companiesData);
            } catch (e: any) {
                console.error("API Error:", e);
                setCompanyError(
                    e.message.includes("JSON.parse")
                        ? "Invalid data format received from server. Please check if the API is returning valid JSON."
                        : e.message
                );
            } finally {
                setCompanyLoading(false);
            }
        };
        fetchCompanies();
    }, [epfNo]);

    /* ────── Filter Provinces ────── */
    useEffect(() => {
        const f = companies.filter(
            (p) =>
                (!searchId || p.compId.toLowerCase().includes(searchId.toLowerCase())) &&
                (!searchName || p.CompName.toLowerCase().includes(searchName.toLowerCase()))
        );
        setFilteredCompanies(f);
        setPage(1);
    }, [searchId, searchName, companies]);

    const clearFilters = () => {
        setSearchId("");
        setSearchName("");
    };

    const selectCompany = (company: Company) => {
        setSelectedCompany(company);
    };

    /* ────── Fetch report ────── */
    const fetchReport = async () => {
        if (!selectedCompany) {
            toast.error("Please select a Company / Province from the list.");
            return;
        }
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
            const url = `/misapi/api/issuesummaryprovince/report?fromDate=${fromDate}&toDate=${toDate}&compId=${encodeURIComponent(
                selectedCompany.compId
            )}&matCode=${encodeURIComponent(matCode.trim())}`;
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();

            if (!json.success) throw new Error(json.message || "No data");

            const items: IssueSummaryItem[] = json.data || [];
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

    const paginated = filteredCompanies.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const totalPages = Math.max(1, Math.ceil(filteredCompanies.length / PAGE_SIZE));

    return (
        <div className="max-w-7xl mx-auto p-6 bg-white rounded-xl shadow border border-gray-200 text-sm font-sans">
            <div className="flex justify-between items-center mb-4">
                <h2 className={`text-xl font-bold ${maroon}`}>Issue Summary - Province Report</h2>
            </div>

            {/* ────── Date range + material filter ────── */}
            <div className="bg-gray-50 p-4 rounded-lg mb-4 border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
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

                    <div className="flex flex-col gap-1">
                        <label className={`text-xs font-bold ${maroon}`}>Material Code (optional):</label>
                        <input
                            type="text"
                            value={matCode}
                            placeholder="leave blank for all"
                            onChange={(e) => setMatCode(e.target.value)}
                            className="px-3 py-1.5 rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#7A0000] transition text-sm"
                        />
                    </div>
                </div>

                <div className="mt-4 flex justify-end">
                    <button
                        onClick={fetchReport}
                        disabled={loading || !selectedCompany}
                        className={`flex items-center gap-2 px-5 py-2 rounded-md text-white text-sm font-medium shadow-sm hover:opacity-90 transition disabled:opacity-50 ${maroonGrad}`}
                    >
                        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                        Generate Report
                    </button>
                </div>
            </div>

            {/* ────── Province / Company Picker (same pattern as Province Period Status Report) ────── */}
            <div className="bg-gray-50 p-4 rounded-lg mb-4 border border-gray-200">
                <div className="flex flex-wrap items-end gap-2 mb-1">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            value={searchId}
                            placeholder="Search by ID"
                            onChange={(e) => setSearchId(e.target.value)}
                            className="pl-10 pr-3 py-1.5 w-40 md:w-48 rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#7A0000] transition text-sm"
                        />
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            value={searchName}
                            placeholder="Search by Name"
                            onChange={(e) => setSearchName(e.target.value)}
                            className="pl-10 pr-3 py-1.5 w-40 md:w-48 rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#7A0000] transition text-sm"
                        />
                    </div>
                    {(searchId || searchName) && (
                        <button
                            onClick={clearFilters}
                            className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm"
                        >
                            <RotateCcw className="w-3 h-3" /> Clear
                        </button>
                    )}
                    {selectedCompany && (
                        <div className="ml-auto text-xs md:text-sm">
                            <span className="font-bold text-gray-600">Selected:</span>{" "}
                            <span className={`font-bold ${maroon}`}>
                                {selectedCompany.compId} / {selectedCompany.CompName}
                            </span>
                        </div>
                    )}
                </div>

                {companyLoading && (
                    <div className="flex flex-col items-center justify-center py-10">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-[#7A0000]"></div>
                        <p className="mt-3 text-gray-600 text-sm">Loading provinces...</p>
                    </div>
                )}

                {companyError && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-2 text-sm">
                        {companyError}
                    </div>
                )}

                {!companyLoading && !companyError && filteredCompanies.length > 0 && (
                    <>
                        <div className="overflow-x-auto rounded-lg border border-gray-200 mt-2">
                            <div className="max-h-[40vh] overflow-y-auto">
                                <table className="w-full table-fixed text-left text-xs md:text-sm">
                                    <thead className={`${maroonGrad} text-white sticky top-0`}>
                                        <tr>
                                            <th className="px-4 py-2 w-1/4">Province Code</th>
                                            <th className="px-4 py-2 w-1/2">Province Name</th>
                                            <th className="px-4 py-2 w-1/4 text-center">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginated.map((company, i) => (
                                            <tr key={i} className={i % 2 ? "bg-white" : "bg-gray-50"}>
                                                <td className="px-4 py-2 truncate">{company.compId}</td>
                                                <td className="px-4 py-2 truncate">{company.CompName}</td>
                                                <td className="px-4 py-2 text-center">
                                                    <button
                                                        onClick={() => selectCompany(company)}
                                                        className={`px-3 py-1 rounded text-xs font-medium hover:brightness-110 transition shadow flex items-center gap-1 mx-auto
                            ${selectedCompany?.compId === company.compId ? "bg-green-600 text-white" : `${maroonGrad} text-white`}`}
                                                    >
                                                        <Eye className="w-3 h-3" />
                                                        {selectedCompany?.compId === company.compId ? "Selected" : "Select"}
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
                                className="px-3 py-1 border rounded bg-white text-gray-600 text-xs hover:bg-gray-100 disabled:opacity-40"
                            >
                                Previous
                            </button>
                            <span className="text-xs text-gray-600">
                                Page {page} of {totalPages}
                            </span>
                            <button
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={page >= totalPages}
                                className="px-3 py-1 border rounded bg-white text-gray-600 text-xs hover:bg-gray-100 disabled:opacity-40"
                            >
                                Next
                            </button>
                        </div>
                    </>
                )}
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

            {showReport && reportData.length > 0 && selectedCompany && (
                <IssueSummaryProvinceTable
                    data={reportData}
                    summary={reportSummary}
                    fromDate={fromDate}
                    toDate={toDate}
                    compId={selectedCompany.compId}
                    onClose={closeReport}
                />
            )}
        </div>
    );
};

export default IssueSummaryProvinceReport;