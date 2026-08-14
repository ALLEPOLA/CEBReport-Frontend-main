// JobRegCCNCReport.tsx
import React, { useEffect, useState } from "react";
import { Search, RotateCcw, Eye, X, Download, Printer } from "lucide-react";
import { useUser } from "../../contexts/UserContext";
import { toast } from "react-toastify";

interface Department {
    DeptId: string;
    DeptName: string;
}

/* ────── Types (mirrors JobRegCCNCModel.cs) ────── */
interface JobRegCCNCReportItem {
    ApplicationNo: string | null;
    PivReceiptNo: string | null;
    PivNo: string | null;
    PivAmount: number | null;
    AccountCode: string | null;
    Amount: number | null;
    Name: string | null;
    StreetAddress: string | null;
    Suburb: string | null;
    City: string | null;
    PaidDate: string | null;
    TariffCatCode: string | null;
    Phase: string | null;
    ConnectionType: string | null;
    ProjectNo: string | null;
    AllocatedDate: string | null;
    ContractorId: string | null;
    FinishedDate: string | null;
    ContractorName: string | null;
    ConfDt: string | null;
    AccNo: string | null;
    AccDate: string | null;
    CctName: string | null;
}

interface JobRegCCNCReportSummary {
    fromDate: string;
    toDate: string;
    costCtr: string;
    totalRecords: number;
    totalPivAmount: number;
    totalAmount: number;
}

interface JobRow {
    key: string;
    applicationNo: string;
    projectNo: string;
    name: string;
    address: string;
    tariffCatCode: string;
    phase: string;
    connectionType: string;
    contractorName: string;
    allocatedDate: string;
    finishedDate: string;
    pivReceiptNo: string;
    pivNo: string;
    pivAmount: number;
    amounts: Record<string, number>; // Account_code -> Amount
}

/* ────── Constants ────── */
const PAGE_SIZE = 9;
const FETCH_TIMEOUT_MS = 240000;
const COMPANY_NAME = "Electricity Distribution Lanka Private Limited";

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

const todayISO = (): string => new Date().toISOString().split("T")[0];

const firstOfMonthISO = (): string => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
};

/* ────── Table Modal Component ────── */
const JobRegCCNCReportTable: React.FC<{
    data: JobRegCCNCReportItem[];
    summary: JobRegCCNCReportSummary | null;
    fromDate: string;
    toDate: string;
    costCenter: string;
    departmentName: string;
    onClose: () => void;
}> = ({ data, summary, fromDate, toDate, costCenter, departmentName, onClose }) => {
    const maroon = "text-[#7A0000]";

    const reportTitle = `New Connection Job Register From ${formatDate(fromDate)} To ${formatDate(
        toDate
    )}`;
    const costCenterLine = `Cost Center : ${costCenter}${departmentName ? " - " + departmentName : ""}`;

    /* Unique sorted account codes -> dynamic columns */
    const accountCodes = Array.from(
        new Set(
            data
                .map((i) => (i.AccountCode || "").trim())
                .filter((c) => c.length > 0)
        )
    ).sort();

    /* One row per job (Application No). Every Account_code found for that job's
       PIV becomes an amount under the matching dynamic column. */
    const jobRows: JobRow[] = (() => {
        const map = new Map<string, JobRow>();

        data.forEach((item) => {
            const key =
                (item.ApplicationNo || item.ProjectNo || item.PivNo || "").trim() ||
                `row-${map.size}`;

            if (!map.has(key)) {
                const address = [item.StreetAddress, item.Suburb, item.City]
                    .filter(Boolean)
                    .join(", ");
                map.set(key, {
                    key,
                    applicationNo: item.ApplicationNo || "",
                    projectNo: item.ProjectNo || "",
                    name: item.Name || "",
                    address,
                    tariffCatCode: item.TariffCatCode || "",
                    phase: item.Phase || "",
                    connectionType: item.ConnectionType || "",
                    contractorName: item.ContractorName || "",
                    allocatedDate: item.AllocatedDate || "",
                    finishedDate: item.FinishedDate || "",
                    pivReceiptNo: item.PivReceiptNo || "",
                    pivNo: item.PivNo || "",
                    pivAmount: item.PivAmount || 0,
                    amounts: {},
                });
            }

            const row = map.get(key)!;
            const code = (item.AccountCode || "").trim();
            if (code) {
                row.amounts[code] = (row.amounts[code] || 0) + (item.Amount || 0);
            }
        });

        return Array.from(map.values()).sort((a, b) =>
            a.applicationNo.localeCompare(b.applicationNo)
        );
    })();

    const rowTotal = (row: JobRow) =>
        Object.values(row.amounts).reduce((a, b) => a + b, 0);

    const columnTotals: Record<string, number> = {};
    accountCodes.forEach((code) => {
        columnTotals[code] = jobRows.reduce((sum, r) => sum + (r.amounts[code] || 0), 0);
    });

    const grandTotal =
        summary?.totalAmount ?? Object.values(columnTotals).reduce((a, b) => a + b, 0);
    const totalRecords = summary?.totalRecords ?? jobRows.length;
    const totalPivAmount =
        summary?.totalPivAmount ?? jobRows.reduce((sum, r) => sum + r.pivAmount, 0);

    /* ────── CSV Download ────── */
    const downloadCSV = () => {
        const titleRows = [
            csvEscape(COMPANY_NAME),
            csvEscape(reportTitle),
            csvEscape(costCenterLine),
            `Total Jobs: ${totalRecords}`,
            `Total PIV Amount (LKR): ${formatAmount(totalPivAmount)}`,
            `Total Amount (LKR): ${formatAmount(grandTotal)}`,
            "",
        ];
        const headers = [
            "Job No",
            "Project No",
            "Applicant Name & Address",
            "Tariff Cat",
            "Phase",
            "Connection Type",
            "Contractor",
            "Contractor Allocated Date",
            "Job Finished Date",
            "PIV No",
            "PIV Amount",
            ...accountCodes,
            "Total",
        ];
        const rows = jobRows.map((row) =>
            [
                csvEscape(row.applicationNo),
                csvEscape(row.projectNo),
                csvEscape([row.name, row.address].filter(Boolean).join(" - ")),
                csvEscape(row.tariffCatCode),
                csvEscape(row.phase),
                csvEscape(row.connectionType),
                csvEscape(row.contractorName),
                csvEscape(formatDate(row.allocatedDate)),
                csvEscape(formatDate(row.finishedDate)),
                csvEscape(row.pivNo),
                csvEscape(formatAmount(row.pivAmount)),
                ...accountCodes.map((code) => csvEscape(formatAmount(row.amounts[code] || 0))),
                csvEscape(formatAmount(rowTotal(row))),
            ].join(",")
        );
        const totalRow = [
            "GRAND TOTAL", "", "", "", "", "", "", "", "", "", "",
            ...accountCodes.map((code) => csvEscape(formatAmount(columnTotals[code] || 0))),
            csvEscape(formatAmount(grandTotal)),
        ].join(",");
        const csv = [...titleRows, headers.join(","), ...rows, totalRow].join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `JobRegCCNCReport_${costCenter}_${fromDate}_${toDate}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    /* ────── Print PDF ────── */
    const printPDF = () => {
        const totalColumns = 11 + accountCodes.length + 1;
        let fontSize = "8.5px";
        let padding = "6px 8px";
        if (totalColumns > 24) {
            fontSize = "6px";
            padding = "2px 3px";
        } else if (totalColumns > 16) {
            fontSize = "7.5px";
            padding = "4px 5px";
        }

        let rowsHTML = "";
        jobRows.forEach((row, i) => {
            rowsHTML += `
        <tr class="${i % 2 ? "bg-white" : "bg-gray-50"}">
          <td style="padding:${padding}; border:1px solid #d1d5db; text-align:left;">${row.applicationNo}</td>
          <td style="padding:${padding}; border:1px solid #d1d5db; text-align:left;">${row.projectNo}</td>
          <td style="padding:${padding}; border:1px solid #d1d5db; text-align:left;">${row.name}${
                row.address ? `<br/><span style="color:#555;">${row.address}</span>` : ""
            }</td>
          <td style="padding:${padding}; border:1px solid #d1d5db; text-align:center;">${row.tariffCatCode}</td>
          <td style="padding:${padding}; border:1px solid #d1d5db; text-align:center;">${row.phase}</td>
          <td style="padding:${padding}; border:1px solid #d1d5db; text-align:center;">${row.connectionType}</td>
          <td style="padding:${padding}; border:1px solid #d1d5db; text-align:left;">${row.contractorName}</td>
          <td style="padding:${padding}; border:1px solid #d1d5db; text-align:center;">${formatDate(row.allocatedDate)}</td>
          <td style="padding:${padding}; border:1px solid #d1d5db; text-align:center;">${formatDate(row.finishedDate)}</td>
          <td style="padding:${padding}; border:1px solid #d1d5db; text-align:left;">${row.pivNo}</td>
          <td style="padding:${padding}; border:1px solid #d1d5db; text-align:right;">${formatAmount(row.pivAmount)}</td>
          ${accountCodes
                .map(
                    (code) =>
                        `<td style="padding:${padding}; border:1px solid #d1d5db; text-align:right;">${formatAmount(
                            row.amounts[code] || 0
                        )}</td>`
                )
                .join("")}
          <td style="padding:${padding}; border:1px solid #d1d5db; text-align:right; font-weight:bold;">${formatAmount(rowTotal(row))}</td>
        </tr>`;
        });

        rowsHTML += `
        <tr style="background:#d3d3d3; font-weight:bold;">
          <td colspan="11" style="padding:${padding}; border:1px solid #d1d5db; text-align:right; font-size:9px;">GRAND TOTAL</td>
          ${accountCodes
                .map(
                    (code) =>
                        `<td style="padding:${padding}; border:1px solid #d1d5db; text-align:right; font-size:9px;">${formatAmount(
                            columnTotals[code] || 0
                        )}</td>`
                )
                .join("")}
          <td style="padding:${padding}; border:1px solid #d1d5db; text-align:right; font-size:9px;">${formatAmount(grandTotal)}</td>
        </tr>
      `;

        /* Fixed (non-currency) header cells stay center-aligned via the global `th` rule.
           PIV Amount / account-code / Total headers are currency columns, so they get an
           explicit text-align:right override to line up with their right-aligned data cells. */
        const fixedHeaderCells = [
            "Job No", "Project No", "Applicant Name &amp; Address", "Tariff Cat", "Phase",
            "Connection Type", "Contractor", "Contractor Allocated Date", "Job Finished Date", "PIV No",
        ];

        const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    @media print {
      @page { size: A3 landscape; margin: 8mm 5mm 10mm 5mm; }
      body { margin:0; font-family:Arial,Helvetica,sans-serif; }
      .company { margin: 10px 8px 2px; text-align:center; font-weight:bold; color:#1f2937; font-size:14px; letter-spacing:0.5px; }
      .title { margin: 2px 8px 6px; text-align:center; font-weight:bold; color:#7A0000; font-size:12px; }
      .costcenter { margin: 0 8px 14px; text-align:center; font-weight:600; color:#374151; font-size:10px; }
      .info { margin:6px 8px; font-size:9px; display:flex; justify-content:flex-end; }
      table { border-collapse:collapse; width:100%; font-size:${fontSize}; table-layout:fixed; }
      th { background:#7A0000; color:#ffffff; text-align:center; font-weight:bold; padding:${padding}; border:1px solid #d1d5db; word-wrap:break-word; }
      th.numeric { text-align:right; }
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
  <div class="costcenter">${costCenterLine}</div>
  <div class="info">
    <div style="font-weight:600; color:#4B5563;">Currency : LKR</div>
  </div>
  <table>
    <thead>
      <tr>
        ${fixedHeaderCells.map((h) => `<th>${h}</th>`).join("")}
        <th class="numeric">PIV Amount</th>
        ${accountCodes.map((c) => `<th class="numeric">${c}</th>`).join("")}
        <th class="numeric">Total</th>
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

    const tableMinWidth = 1150 + accountCodes.length * 100;

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

                    {/* ────── Report Header Block ────── */}
                    <div className="text-center mb-4">
                        <h1 className="text-base md:text-lg font-bold text-gray-800 tracking-wide">
                            {COMPANY_NAME}
                        </h1>
                        <h2 className={`text-sm md:text-base font-bold mt-1 ${maroon}`}>
                            {reportTitle}
                        </h2>
                        <p className="text-xs md:text-sm font-semibold text-gray-700 mt-1">
                            {costCenterLine}
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-end text-sm mb-4 gap-2 px-2">
                        <div className="flex gap-4 font-semibold text-gray-600">
                            <div>Jobs: {totalRecords}</div>
                            <div>Total PIV Amount: LKR {formatAmount(totalPivAmount)}</div>
                            <div>Total Amount: LKR {formatAmount(grandTotal)}</div>
                        </div>
                    </div>

                    <div className="mt-1 mb-5 border border-gray-200 rounded-lg overflow-x-auto print:ml-12 print:mt-12 print:overflow-visible">
                        <div style={{ minWidth: `${tableMinWidth}px` }}>
                            <table className="w-full text-xs border-collapse">
                                <thead>
                                    <tr className="bg-[#7A0000] text-white sticky top-0">
                                        <th className="px-3 py-2 border border-gray-300 text-center font-bold">Job No</th>
                                        <th className="px-3 py-2 border border-gray-300 text-center font-bold">Project No</th>
                                        <th className="px-3 py-2 border border-gray-300 text-center font-bold">Applicant Name &amp; Address</th>
                                        <th className="px-3 py-2 border border-gray-300 text-center font-bold">Tariff Cat</th>
                                        <th className="px-3 py-2 border border-gray-300 text-center font-bold">Phase</th>
                                        <th className="px-3 py-2 border border-gray-300 text-center font-bold">Connection Type</th>
                                        <th className="px-3 py-2 border border-gray-300 text-center font-bold">Contractor</th>
                                        <th className="px-3 py-2 border border-gray-300 text-center font-bold">Contractor Allocated Date</th>
                                        <th className="px-3 py-2 border border-gray-300 text-center font-bold">Job Finished Date</th>
                                        <th className="px-3 py-2 border border-gray-300 text-center font-bold">PIV No</th>
                                        <th className="px-3 py-2 border border-gray-300 text-right font-bold">PIV Amount</th>
                                        {accountCodes.map((code) => (
                                            <th key={code} className="px-3 py-2 border border-gray-300 text-right font-bold">
                                                {code}
                                            </th>
                                        ))}
                                        <th className="px-3 py-2 border border-gray-300 text-right font-bold">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {jobRows.map((row, i) => (
                                        <tr key={row.key} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                            <td className="px-3 py-2 border-l border-r border-gray-300 font-mono">{row.applicationNo}</td>
                                            <td className="px-3 py-2 border-r border-gray-300 font-mono">{row.projectNo}</td>
                                            <td className="px-3 py-2 border-r border-gray-300 break-words max-w-[240px]">
                                                <div className="font-medium">{row.name}</div>
                                                {row.address && <div className="text-gray-500 text-[11px]">{row.address}</div>}
                                            </td>
                                            <td className="px-3 py-2 text-center border-r border-gray-300 font-mono">{row.tariffCatCode}</td>
                                            <td className="px-3 py-2 text-center border-r border-gray-300 font-mono">{row.phase}</td>
                                            <td className="px-3 py-2 text-center border-r border-gray-300 font-mono">{row.connectionType}</td>
                                            <td className="px-3 py-2 border-r border-gray-300">{row.contractorName}</td>
                                            <td className="px-3 py-2 text-center border-r border-gray-300 font-mono">{formatDate(row.allocatedDate)}</td>
                                            <td className="px-3 py-2 text-center border-r border-gray-300 font-mono">{formatDate(row.finishedDate)}</td>
                                            <td className="px-3 py-2 border-r border-gray-300 font-mono">{row.pivNo}</td>
                                            <td className="px-3 py-2 text-right border-r border-gray-300 font-mono">{formatAmount(row.pivAmount)}</td>
                                            {accountCodes.map((code) => (
                                                <td key={code} className="px-3 py-2 text-right border-r border-gray-300 font-mono">
                                                    {formatAmount(row.amounts[code] || 0)}
                                                </td>
                                            ))}
                                            <td className="px-3 py-2 text-right border-r border-gray-300 font-mono font-bold">
                                                {formatAmount(rowTotal(row))}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-[#d3d3d3] font-bold sticky bottom-0">
                                        <td colSpan={11} className="px-3 py-2 border border-gray-300 text-right">GRAND TOTAL</td>
                                        {accountCodes.map((code) => (
                                            <td key={code} className="px-3 py-2 border border-gray-300 text-right font-mono">
                                                {formatAmount(columnTotals[code] || 0)}
                                            </td>
                                        ))}
                                        <td className="px-3 py-2 border border-gray-300 text-right font-mono">
                                            {formatAmount(grandTotal)}
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
const JobRegCCNCReport: React.FC = () => {
    const { user } = useUser();
    const [departments, setDepartments] = useState<Department[]>([]);
    const [filtered, setFiltered] = useState<Department[]>([]);
    const [searchId, setSearchId] = useState("");
    const [searchName, setSearchName] = useState("");
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [fromDate, setFromDate] = useState(firstOfMonthISO());
    const [toDate, setToDate] = useState(todayISO());

    const [selectedDept, setSelectedDept] = useState<Department | null>(null);
    const [reportData, setReportData] = useState<JobRegCCNCReportItem[]>([]);
    const [reportSummary, setReportSummary] = useState<JobRegCCNCReportSummary | null>(null);
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
            const fromParam = fromDate.replace(/-/g, "/");
            const toParam = toDate.replace(/-/g, "/");
            const url = `/misapi/api/jobregccnc/report?fromDate=${fromParam}&toDate=${toParam}&costCtr=${dept.DeptId}`;
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();

            if (!json.success) throw new Error(json.message || "No data");

            const items: JobRegCCNCReportItem[] = json.data || [];
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
                New Connection Job Register
            </h2>

            {/* ────── Date range filters ────── */}
            <div className="bg-gray-50 p-4 rounded-lg mb-4 border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <div className="flex items-center gap-2">
                        <label className={`text-xs font-bold ${maroon} whitespace-nowrap`}>
                            From:
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
                            To:
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
                                <p className="text-sm text-gray-600">Fetching new connection job register details from server</p>
                            </div>
                        )}
                        {!reportLoading && reportData.length > 0 && (
                            <JobRegCCNCReportTable
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

export default JobRegCCNCReport;