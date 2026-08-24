// RegionSMCAllPIVReport.tsx
import React, { useState, useCallback } from "react";
import { Download, Printer, X } from "lucide-react";
import { useUser } from "../../contexts/UserContext";
import { toast } from "react-toastify";
import ReusableCompanyList from "../../components/utils/ReusableCompanyList";

/* ────── Types ────── */
interface RegionSMCAllPIVItem {
    DeptId: string | null;
    IdNo: string | null;
    ApplicationNo: string | null;
    Name: string | null;
    Address: string | null;
    SubmitDate: string | null;
    Description: string | null;
    PivNo: string | null;
    PaidDate: string | null;
    PivAmount: number | null;
    TariffCode: string | null;
    Phase: string | null;
    ChequeNo: string | null;
    ChequeNo1: string | null;
    Area: string | null;
    Province: string | null;
    CctName: string | null;
    CompNm: string | null;
}

interface RegionSMCAllPIVSummary {
    fromDate: string;
    toDate: string;
    compId: string;
    totalRecords: number;
    totalPivAmount: number;
}

/* ────── Constants ────── */
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

/* ────── Report Table Component ────── */
const RegionSMCAllPIVTable: React.FC<{
    data: RegionSMCAllPIVItem[];
    summary: RegionSMCAllPIVSummary | null;
    fromDate: string;
    toDate: string;
    compId: string;
    onClose: () => void;
}> = ({ data, summary, fromDate, toDate, compId, onClose }) => {
    const maroon = "text-[#7A0000]";
    const fromLabel = formatDate(fromDate);
    const toLabel = formatDate(toDate);
    const divisionLabel = data[0]?.CompNm || compId;
    const reportTitle = `Divisional SMC All Details (without EA) PIV Paid Date From ${fromLabel} To ${toLabel}`;

    const sortedData = [...data]; // already ordered from backend (ORDER BY dept_id)
    const totalRecords = summary?.totalRecords ?? sortedData.length;
    const totalPivAmount = summary?.totalPivAmount ?? sortedData.reduce((s, it) => s + (it.PivAmount || 0), 0);

    /* ────── CSV Download ────── */
    const downloadCSV = () => {
        const titleRows = [
            reportTitle,
            COMPANY_NAME,
            `Division: ${divisionLabel}`,
            `Total Records: ${totalRecords}`,
            "",
        ];
        const headers = [
            "Item",
            "Province",
            "Area",
            "Dept Id",
            "Application No",
            "Applicant Name",
            "Applicant Address",
            "NIC No",
            "Submit Date",
            "Cost Center Name",
            "Tariff",
            "Phase",
            "PIV No",
            "PIV Paid Date",
            "Cheque No (Old)",
            "Cheque No (New)",
            "PIV Amount",
        ];
        const rows = sortedData.map((it, i) =>
            [
                csvEscape(i + 1),
                csvEscape(it.Province),
                csvEscape(it.Area),
                csvEscape(it.DeptId),
                csvEscape(it.ApplicationNo),
                csvEscape(it.Name),
                csvEscape(it.Address),
                csvEscape(it.IdNo),
                csvEscape(formatDate(it.SubmitDate)),
                csvEscape(it.CctName),
                csvEscape(it.TariffCode),
                csvEscape(it.Phase),
                csvEscape(it.PivNo),
                csvEscape(formatDate(it.PaidDate)),
                csvEscape(it.ChequeNo),
                csvEscape(it.ChequeNo1),
                csvEscape(formatAmount(it.PivAmount)),
            ].join(",")
        );
        const totalRow: (string | number)[] = Array(16).fill("");
        totalRow[0] = "TOTAL";
        totalRow.push(formatAmount(totalPivAmount));
        const csv = [...titleRows, headers.join(","), ...rows, totalRow.map(csvEscape).join(",")].join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `RegionSMCAllPIV_${compId}_${fromDate}_${toDate}.csv`;
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
          <td>${it.Province || ""}</td>
          <td>${it.Area || ""}</td>
          <td>${it.DeptId || ""}</td>
          <td>${it.ApplicationNo || ""}</td>
          <td>${it.Name || ""}</td>
          <td>${it.Address || ""}</td>
          <td>${it.IdNo || ""}</td>
          <td style="text-align:center;">${formatDate(it.SubmitDate)}</td>
          <td>${it.CctName || ""}</td>
          <td style="text-align:center;">${it.TariffCode || ""}</td>
          <td style="text-align:center;">${it.Phase || ""}</td>
          <td>${it.PivNo || ""}</td>
          <td style="text-align:center;">${formatDate(it.PaidDate)}</td>
          <td>${it.ChequeNo || ""}</td>
          <td>${it.ChequeNo1 || ""}</td>
          <td style="text-align:right;">${formatAmount(it.PivAmount)}</td>
        </tr>`;
        });

        rowsHTML += `
        <tr style="background:#d3d3d3; font-weight:bold;">
          <td colspan="16" style="text-align:right;">TOTAL</td>
          <td style="text-align:right;">${formatAmount(totalPivAmount)}</td>
        </tr>
      `;

        const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    @media print {
      @page { size: landscape; margin: 6mm 4mm 10mm 4mm; }
      body { margin:0; font-family:Arial,Helvetica,sans-serif; }
      .title { margin: 8px 6px 2px; text-align:center; font-weight:bold; color:#7A0000; font-size:11.5px; }
      .company { margin: 2px 6px 4px; text-align:center; font-weight:bold; color:#7A0000; font-size:12px; }
      .info { margin:6px 6px 8px; font-size:9px; }
      table { border-collapse:collapse; width:100%; font-size:7.5px; table-layout:fixed; }
      th, td { border:1px solid #d1d5db; padding:3px 4px; word-wrap:break-word; }
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
  <div class="info"><strong>Division:</strong> ${divisionLabel} &nbsp;&nbsp; <strong>Records:</strong> ${totalRecords}</div>
  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th>Province</th>
        <th>Area</th>
        <th>Dept Id</th>
        <th>Application No</th>
        <th>Applicant Name</th>
        <th>Applicant Address</th>
        <th>NIC No</th>
        <th>Submit Date</th>
        <th>Cost Center Name</th>
        <th>Tariff</th>
        <th>Phase</th>
        <th>PIV No</th>
        <th>PIV Paid Date</th>
        <th>Cheque No (Old)</th>
        <th>Cheque No (New)</th>
        <th style="text-align:right;">PIV Amount</th>
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
            <div className="relative bg-white w-[97vw] max-w-[1800px] rounded-2xl shadow-2xl border border-gray-200 overflow-hidden mt-20 md:mt-24 lg:mt-28 lg:ml-64 mx-auto print:relative print:w-full print:max-w-none print:rounded-none print:shadow-none print:border-none print:overflow-visible">
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

                    <h2 className={`text-sm md:text-base font-bold text-center mb-1 ${maroon}`}>{reportTitle}</h2>
                    <h3 className={`text-base md:text-lg font-semibold text-center mb-1 ${maroon}`}>{COMPANY_NAME}</h3>
                    <div className="text-sm mb-4 px-2 text-gray-700 text-center">
                        <span className="font-bold">Division:</span> {divisionLabel}
                        <span className="ml-4 text-gray-500">Records: {totalRecords}</span>
                    </div>

                    <div className="border border-gray-200 rounded-lg overflow-x-auto">
                        <div className="min-w-[1950px]">
                            <table className="w-full text-xs border-collapse">
                                <thead>
                                    <tr className="bg-[#7A0000] text-white sticky top-0">
                                        <th className="px-2 py-1.5 border border-gray-300 font-bold">Item</th>
                                        <th className="px-2 py-1.5 border border-gray-300 font-bold">Province</th>
                                        <th className="px-2 py-1.5 border border-gray-300 font-bold">Area</th>
                                        <th className="px-2 py-1.5 border border-gray-300 font-bold">Dept Id</th>
                                        <th className="px-2 py-1.5 border border-gray-300 font-bold">Application No</th>
                                        <th className="px-2 py-1.5 border border-gray-300 font-bold">Applicant Name</th>
                                        <th className="px-2 py-1.5 border border-gray-300 font-bold">Applicant Address</th>
                                        <th className="px-2 py-1.5 border border-gray-300 font-bold">NIC No</th>
                                        <th className="px-2 py-1.5 border border-gray-300 font-bold">Submit Date</th>
                                        <th className="px-2 py-1.5 border border-gray-300 font-bold">Cost Center Name</th>
                                        <th className="px-2 py-1.5 border border-gray-300 font-bold">Tariff</th>
                                        <th className="px-2 py-1.5 border border-gray-300 font-bold">Phase</th>
                                        <th className="px-2 py-1.5 border border-gray-300 font-bold">PIV No</th>
                                        <th className="px-2 py-1.5 border border-gray-300 font-bold">PIV Paid Date</th>
                                        <th className="px-2 py-1.5 border border-gray-300 font-bold">Cheque No (Old)</th>
                                        <th className="px-2 py-1.5 border border-gray-300 font-bold">Cheque No (New)</th>
                                        <th className="px-2 py-1.5 border border-gray-300 font-bold text-right">PIV Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedData.map((it, i) => (
                                        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                            <td className="px-2 py-1 border-l border-r border-gray-300 text-center font-mono">{i + 1}</td>
                                            <td className="px-2 py-1 border-r border-gray-300">{it.Province}</td>
                                            <td className="px-2 py-1 border-r border-gray-300">{it.Area}</td>
                                            <td className="px-2 py-1 border-r border-gray-300 font-mono">{it.DeptId}</td>
                                            <td className="px-2 py-1 border-r border-gray-300 font-mono">{it.ApplicationNo}</td>
                                            <td className="px-2 py-1 border-r border-gray-300 break-words max-w-[160px]">{it.Name}</td>
                                            <td className="px-2 py-1 border-r border-gray-300 break-words max-w-[220px]">{it.Address}</td>
                                            <td className="px-2 py-1 border-r border-gray-300 font-mono">{it.IdNo}</td>
                                            <td className="px-2 py-1 border-r border-gray-300 text-center font-mono">{formatDate(it.SubmitDate)}</td>
                                            <td className="px-2 py-1 border-r border-gray-300">{it.CctName}</td>
                                            <td className="px-2 py-1 border-r border-gray-300 text-center">{it.TariffCode}</td>
                                            <td className="px-2 py-1 border-r border-gray-300 text-center">{it.Phase}</td>
                                            <td className="px-2 py-1 border-r border-gray-300 font-mono">{it.PivNo}</td>
                                            <td className="px-2 py-1 border-r border-gray-300 text-center font-mono">{formatDate(it.PaidDate)}</td>
                                            <td className="px-2 py-1 border-r border-gray-300 font-mono">{it.ChequeNo}</td>
                                            <td className="px-2 py-1 border-r border-gray-300 font-mono">{it.ChequeNo1}</td>
                                            <td className="px-2 py-1 border-r border-gray-300 text-right font-mono">{formatAmount(it.PivAmount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-[#d3d3d3] font-bold sticky bottom-0">
                                        <td colSpan={16} className="px-2 py-1.5 border border-gray-300 text-right">TOTAL</td>
                                        <td className="px-2 py-1.5 border border-gray-300 text-right font-mono">
                                            {formatAmount(totalPivAmount)}
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
const RegionSMCAllPIVReport: React.FC = () => {
    const { user } = useUser();
    const epfNo = user?.Userno || "";

    const maroon = "text-[#7A0000]";

    const todayStr = new Date().toISOString().slice(0, 10);
    const firstOfMonthStr = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString()
        .slice(0, 10);

    const [fromDate, setFromDate] = useState(firstOfMonthStr);
    const [toDate, setToDate] = useState(todayStr);

    const [selectedCompany, setSelectedCompany] = useState<{ id: string; name: string } | null>(null);
    const [reportData, setReportData] = useState<RegionSMCAllPIVItem[]>([]);
    const [reportSummary, setReportSummary] = useState<RegionSMCAllPIVSummary | null>(null);
    const [showReport, setShowReport] = useState(false);
    const [reportLoading, setReportLoading] = useState(false);

    /* ────── Fetch report for the selected division/company ────── */
    const handleViewReport = async (company: { id: string; name: string }) => {
        if (!fromDate || !toDate) {
            toast.error("Please select both From Date and To Date.");
            return;
        }
        if (new Date(toDate) < new Date(fromDate)) {
            toast.error("To date cannot be earlier than from date.");
            return;
        }

        setSelectedCompany(company);
        setReportLoading(true);
        setReportData([]);
        setReportSummary(null);
        setShowReport(true);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

        try {
            const url = `/misapi/api/regionsmcallpiv/report?fromDate=${fromDate}&toDate=${toDate}&compId=${encodeURIComponent(
                company.id
            )}`;
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();

            if (!json.success) throw new Error(json.message || "No data");

            const items: RegionSMCAllPIVItem[] = json.data || [];
            if (items.length === 0) {
                toast.warn("No records found.");
                setShowReport(false);
                setSelectedCompany(null);
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
            setSelectedCompany(null);
        } finally {
            setReportLoading(false);
        }
    };

    const closeReport = () => {
        setShowReport(false);
        setReportData([]);
        setReportSummary(null);
        setSelectedCompany(null);
        setReportLoading(false);
    };

    return (
        <div
            className="max-w-[95%] mx-auto p-6 bg-white rounded-lg shadow-md text-sm md:text-base relative ml-16 mt-8"
            style={{ marginLeft: "2rem" }}
        >
            <h2 className={`text-xl font-bold mb-4 ${maroon}`}>Divisional SMC All Details (without EA) PIV Paid Date Report</h2>

            {/* ────── Date range filters ────── */}
            <div className="bg-gray-50 p-4 rounded-lg mb-4 border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end max-w-xl">
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
            </div>

            {/* ────── Division / Company List ────── */}
            <div className="mt-6">
                <ReusableCompanyList
                    fetchItems={useCallback(async () => {
                        if (!epfNo) {
                            toast.error("No EPF number available.");
                            return [];
                        }
                        try {
                            const res = await fetch(`/misapi/api/incomeexpenditure/Usercompanies/${epfNo}/70`);
                            if (!res.ok) throw new Error(`HTTP ${res.status}`);
                            const txt = await res.text();
                            const parsed = JSON.parse(txt);
                            const raw = Array.isArray(parsed) ? parsed : parsed.data || [];
                            return raw.map((c: any) => ({
                                id: c.CompId,
                                name: c.CompName,
                            }));
                        } catch (e: any) {
                            toast.error(e.message || "Failed to load divisions");
                            return [];
                        }
                    }, [epfNo])}
                    onViewItem={(company: { id: string; name: string }) => handleViewReport(company)}
                    idColumnTitle="Division Code"
                    nameColumnTitle="Division Name"
                    loadingMessage="Loading divisions..."
                    emptyMessage="No divisions available for selection."
                />
            </div>

            {/* ────── REPORT MODAL ────── */}
            {showReport && selectedCompany && (
                <div className="fixed inset-0 z-50 bg-transparent flex items-center justify-center p-4">
                    <div className="relative bg-white w-full max-w-[95vw] sm:max-w-4xl md:max-w-6xl lg:max-w-7xl rounded-2xl shadow-2xl overflow-hidden">
                        {reportLoading && (
                            <div className="absolute inset-0 bg-white/95 z-50 flex flex-col items-center justify-center gap-4">
                                <svg className="animate-spin h-14 w-14 text-[#7A0000]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                <p className="text-xl font-bold text-[#7A0000]">Loading Report...</p>
                                <p className="text-sm text-gray-600">Fetching PIV details from server</p>
                            </div>
                        )}
                        {!reportLoading && reportData.length > 0 && (
                            <RegionSMCAllPIVTable
                                data={reportData}
                                summary={reportSummary}
                                fromDate={fromDate}
                                toDate={toDate}
                                compId={selectedCompany.id}
                                onClose={closeReport}
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default RegionSMCAllPIVReport;