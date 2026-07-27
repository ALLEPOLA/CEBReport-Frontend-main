// ChequeDetailsExp.tsx
import React, { useEffect, useState } from "react";
import { Search, RotateCcw, Eye, X, Download, Printer } from "lucide-react";
import { useUser } from "../../contexts/UserContext";
import { toast } from "react-toastify";

/* ---------- interfaces ---------- */
interface Department {
  DeptId: string;
  DeptName: string;
}

interface ChequeExpItem {
  ChqDt: string | null;        // comes as ISO string? Actually API returns date, we'll map to string
  ChqNo: string | null;
  PymtDocNo: string | null;
  ExpCd: string | null;
  DrAmt: number | null;
  ChqAmt: number | null;
  Payee: string | null;
  Remarks: string | null;
  Ref1: string | null;
  Ref2: string | null;
  Ref3: string | null;
  Ref4: string | null;
  CctName: string | null;
}

/* ---------- constants ---------- */
const PAGE_SIZE = 9;
const FETCH_TIMEOUT_MS = 180000;

/* ---------- formatting helpers ---------- */
const formatNumber = (num: number | string | null | undefined): string => {
  const n = num === null || num === undefined ? NaN : Number(num);
  if (isNaN(n)) return "0.00";
  return Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const csvEscape = (val: string | number | null | undefined): string => {
  if (val == null) return "";
  const str = String(val);
  if (/[,\n"]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
};

/* Report generation timestamp, formatted for Asia/Colombo */
const getGeneratedOn = (): string =>
  new Date().toLocaleString("en-US", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

/* ---------- Date boundaries ---------- */
const today = new Date();
const currentYear = today.getFullYear();
const currentMonth = String(today.getMonth() + 1).padStart(2, "0");
const currentDay = String(today.getDate()).padStart(2, "0");
const maxDate = `${currentYear}-${currentMonth}-${currentDay}`;
const minYear = currentYear - 20;
const minDate = `${minYear}-${currentMonth}-${currentDay}`;

/* ---------- Report Modal (grouped by Expense Code) ---------- */
const ChequeExpDetailsTable: React.FC<{
  data: ChequeExpItem[];
  fromDate: string;
  toDate: string;
  costCenter: string;
  departmentName: string;
  acctCode: string;
  totalDrAmt: number;
  onClose: () => void;
}> = ({ data, fromDate, toDate, costCenter, departmentName, acctCode, totalDrAmt, onClose }) => {
  const maroon = "text-[#7A0000]";
  const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";

  // group by Expense Code (normalized, preserving original for display)
  const grouped = data.reduce((acc, cur) => {
    const key = (cur.ExpCd || "UNKNOWN").trim().toUpperCase();
    if (!acc[key]) acc[key] = { display: cur.ExpCd || "UNKNOWN", items: [] };
    acc[key].items.push(cur);
    return acc;
  }, {} as Record<string, { display: string; items: ChequeExpItem[] }>);

  const sortedCodes = Object.keys(grouped).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base", numeric: true })
  );

  const sortedGrouped = sortedCodes.reduce((acc, key) => {
    acc[key] = {
      display: grouped[key].display,
      items: grouped[key].items.sort((a, b) =>
        (a.ChqDt || "").localeCompare(b.ChqDt || "")
      ),
    };
    return acc;
  }, {} as Record<string, { display: string; items: ChequeExpItem[] }>);

  const generatedOn = getGeneratedOn();

  /* ---------- CSV download ---------- */
  const downloadCSV = () => {
    const titleRows = [
      `Cheque Expense Details From ${fromDate} To ${toDate}`,
      `Cost Center: ${costCenter} / ${departmentName}`,
      `Account Code: ${acctCode}`,
      `Currency: LKR`,
      `Generated On: ${generatedOn}`,
      "",
    ];

    const headers = [
      "No",
      "Cheque Date",
      "Cheque No",
      "Payslip No",
      "Account Code",
      "Amount (LKR)",
      "Total Cheque",
      "Ref 1",
      "Ref 2",
      "Ref 3",
      "Ref 4",
      "Payee",
      "Remarks",
    ];

    const rows: string[] = [];
    sortedCodes.forEach((key) => {
      const { display, items } = sortedGrouped[key];
      const expTotalDr = items.reduce((s, r) => s + (r.DrAmt || 0), 0);
      rows.push(headers.join(","));
      items.forEach((it, idx) => {
        rows.push(
          [
            csvEscape(idx + 1),
            csvEscape(formatDate(it.ChqDt)),
            csvEscape(it.ChqNo),
            csvEscape(it.PymtDocNo),
            csvEscape(it.ExpCd || display),
            csvEscape(formatNumber(it.DrAmt)),
            csvEscape(formatNumber(it.ChqAmt)),
            csvEscape(it.Ref1),
            csvEscape(it.Ref2),
            csvEscape(it.Ref3),
            csvEscape(it.Ref4),
            csvEscape(it.Payee),
            csvEscape(it.Remarks),
          ].join(",")
        );
      });
      rows.push(`Total,,,,,${csvEscape(formatNumber(expTotalDr))},,,,,,,`);
      rows.push("");
    });
    rows.push(`Grand Total Amount,,,,,${csvEscape(formatNumber(totalDrAmt))},,,,,,,`);
    rows.push("");
    rows.push("Report Generated By,,,Report Certified By,,,Report Approved By,,");

    const csv = [...titleRows, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ChequeExpDetails_${costCenter}_${fromDate}_${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ---------- PDF print ---------- */
  const printPDF = () => {
    let tablesHTML = "";
    sortedCodes.forEach((key) => {
      const { display, items } = sortedGrouped[key];
      const expTotalDr = items.reduce((s, r) => s + (r.DrAmt || 0), 0);
      let rows = "";
      items.forEach((it, i) => {
        rows += `
          <tr class="${i % 2 ? "bg-white" : "bg-gray-50"}">
            <td style="text-align:center;">${i + 1}</td>
            <td style="text-align:center;">${formatDate(it.ChqDt)}</td>
            <td style="text-align:center;" class="font-mono">${it.ChqNo || ""}</td>
            <td style="text-align:left;">${it.PymtDocNo || ""}</td>
            <td style="text-align:center;">${it.ExpCd || display}</td>
            <td style="text-align:right;" class="font-mono">${formatNumber(it.DrAmt)}</td>
            <td style="text-align:right;" class="font-mono">${formatNumber(it.ChqAmt)}</td>
            <td style="text-align:center;">${it.Ref1 || ""}</td>
            <td style="text-align:center;">${it.Ref2 || ""}</td>
            <td style="text-align:center;">${it.Ref3 || ""}</td>
            <td style="text-align:center;">${it.Ref4 || ""}</td>
            <td style="text-align:left;">${it.Payee || ""}</td>
            <td style="text-align:left;">${it.Remarks || ""}</td>
          </tr>`;
      });

      tablesHTML += `
        <div style="margin-bottom:22px;">
          <table style="width:100%; table-layout:fixed; border-collapse:collapse; font-size:8.5px; border:1px solid #d1d5db;">
            <thead>
              <tr style="background:linear-gradient(to right,#7A0000,#A52A2A); color:white;">
                <th style="width:3%;">No</th>
                <th style="width:8%;">Cheque Date</th>
                <th style="width:7%;">Cheque No</th>
                <th style="width:8%;">Payslip No</th>
                <th style="width:7%;">Account Code</th>
                <th style="width:8%; text-align:right;">Amount (LKR)</th>
                <th style="width:8%; text-align:right;">Total Cheque</th>
                <th style="width:6%;">Ref 1</th>
                <th style="width:6%;">Ref 2</th>
                <th style="width:6%;">Ref 3</th>
                <th style="width:6%;">Ref 4</th>
                <th style="width:13%;">Payee</th>
                <th style="width:14%;">Remarks</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot>
              <tr style="background:#f3f4f6; font-weight:bold; font-size:9px;">
                <td colspan="5" style="text-align:right; padding:6px 8px;">Total</td>
                <td style="text-align:right; padding:6px 8px;" class="font-mono">${formatNumber(expTotalDr)}</td>
                <td colspan="7" style="padding:6px 8px;"></td>
              </tr>
            </tfoot>
          </table>
        </div>`;
    });

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    @media print {
      @page { margin: 8mm 5mm 10mm 5mm; }
      body { margin:0; font-family:Arial,Helvetica,sans-serif; }
      .title { margin: 10px 8px 4px; text-align:center; font-weight:bold; color:#7A0000; font-size:13px; }
      .generated { margin: 0 8px 16px; text-align:center; font-size:8px; color:#6b7280; }
      .info  { margin:6px 8px; font-size:9px; display:flex; justify-content:space-between; }
      .costCenter { font-size: 11px; margin-left: 0px; font-weight: 500; } 
      table { border-collapse:collapse; width:100%; table-layout:fixed; font-size:8.5px; }
      th, td { border:1px solid #d1d5db; padding:6px 8px; word-wrap:break-word; overflow-wrap:break-word; }
      th { background:linear-gradient(to right,#7A0000,#A52A2A); color:white; text-align:center; font-weight:bold; }
      .font-mono { font-family:monospace; }
      .signatures { margin-top:36px; display:flex; justify-content:space-between; padding:0 15px; font-size:9px; }
      .signatures div { width:30%; text-align:center; }
      .signatures .line { border-top:1px solid #374151; margin-bottom:6px; padding-top:26px; }
      @page {
        @bottom-left  { content:"Printed on: ${new Date().toLocaleString("en-US", {timeZone: "Asia/Colombo"})}"; font-size:7px; color:gray; }
        @bottom-right { content:"Page " counter(page) " of " counter(pages); font-size:7px; color:gray; }
      }
    }
  </style>
</head>
<body>
  <div class="title">Cheque Expense Details From ${fromDate} To ${toDate}</div>
  <div class="generated">Report Generated On: ${generatedOn}</div>
  <div class="info">
    <div class="costCenter">
      <strong>Cost Center:</strong> ${costCenter} / ${departmentName}<br/>
      <strong>Account Code:</strong> ${acctCode}
    </div>
    <div style="font-weight:600; color:#4B5563;">Currency : LKR</div>
  </div>

  ${tablesHTML}

  <div style="margin-top:20px; padding:8px 15px; background:#e5e7eb; font-weight:bold; font-size:10px; text-align:left;">
    Grand Total Amount &nbsp;&nbsp; ${formatNumber(totalDrAmt)}
  </div>

  <div class="signatures">
    <div><div class="line"></div>Report Generated By</div>
    <div><div class="line"></div>Report Certified By</div>
    <div><div class="line"></div>Report Approved By</div>
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
        <div className="p-2 md:p-2 max-h-[80vh] overflow-y-auto print:p-0 print:max-h-none print:overflow-visible print:mt-10 print:ml-12">
          <div className="flex justify-end gap-3 mb-6 md:mb-8 print:hidden">
            <button
              onClick={downloadCSV}
              className="flex items-center gap-1 px-3 py-1.5 border border-blue-400 text-blue-700 bg-white rounded-md text-xs font-medium shadow-sm hover:bg-blue-50"
            >
              <Download className="w-4 h-4" /> CSV
            </button>
            <button
              onClick={printPDF}
              className="flex items-center gap-1 px-3 py-1.5 border border-green-400 text-green-700 bg-white rounded-md text-xs font-medium shadow-sm hover:bg-green-50"
            >
              <Printer className="w-4 h-4" /> PDF
            </button>
            <button
              onClick={onClose}
              className="flex items-center gap-1 px-3 py-1.5 border border-red-400 text-red-700 bg-white rounded-md text-xs font-medium shadow-sm hover:bg-red-50"
            >
              <X className="w-4 h-4" /> Close
            </button>
          </div>

          <h2 className={`text-lg md:text-xl font-bold text-center ${maroon}`}>
            Cheque Expense Details From {fromDate} To {toDate}
          </h2>
          <p className="text-center text-[11px] text-gray-500 mb-4">
            Report Generated On: {generatedOn}
          </p>
          <div className="flex justify-between text-sm mb-3 ml-5 mr-12">
            <div>
              <span className="font-bold">Cost Center:</span> {costCenter} / {departmentName}<br />
              <span className="font-bold">Account Code:</span> {acctCode}
            </div>
            <div className="font-semibold text-gray-600">Currency : LKR</div>
          </div>

          <div className="ml-5 mt-1 border border-gray-200 rounded-lg overflow-x-auto print:ml-12 print:mt-12 print:overflow-visible">
            <div className="min-w-[1400px]">
              {sortedCodes.map((key) => {
                const { display, items } = sortedGrouped[key];
                const expTotalDr = items.reduce((s, r) => s + (r.DrAmt || 0), 0);
                return (
                  <div key={key} className="mb-6 last:mb-0">
                    <table className="w-full table-fixed text-xs border-collapse">
                      <thead className={`${maroonGrad} text-white`}>
                        <tr>
                          <th className="px-2 py-3 text-center border border-gray-300" style={{ width: "3%" }}>No</th>
                          <th className="px-2 py-3 text-center border border-gray-300" style={{ width: "8%" }}>Cheque Date</th>
                          <th className="px-2 py-3 text-center border border-gray-300" style={{ width: "7%" }}>Cheque No</th>
                          <th className="px-2 py-3 text-center border border-gray-300" style={{ width: "8%" }}>Payslip No</th>
                          <th className="px-2 py-3 text-center border border-gray-300" style={{ width: "7%" }}>Account Code</th>
                          <th className="px-2 py-3 text-right border border-gray-300" style={{ width: "8%" }}>Amount (LKR)</th>
                          <th className="px-2 py-3 text-right border border-gray-300" style={{ width: "8%" }}>Total Cheque</th>
                          <th className="px-1 py-3 text-center border border-gray-300" style={{ width: "6%" }}>Ref 1</th>
                          <th className="px-1 py-3 text-center border border-gray-300" style={{ width: "6%" }}>Ref 2</th>
                          <th className="px-1 py-3 text-center border border-gray-300" style={{ width: "6%" }}>Ref 3</th>
                          <th className="px-1 py-3 text-center border border-gray-300" style={{ width: "6%" }}>Ref 4</th>
                          <th className="px-3 py-3 text-left border border-gray-300" style={{ width: "13%" }}>Payee</th>
                          <th className="px-3 py-3 text-left border border-gray-300" style={{ width: "14%" }}>Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((it, i) => (
                          <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                            <td className="px-2 py-2.5 text-center border-l border-r border-gray-300">{i + 1}</td>
                            <td className="px-2 py-2.5 text-center border-r border-gray-300 break-words">{formatDate(it.ChqDt)}</td>
                            <td className="px-2 py-2.5 text-center font-mono border-r border-gray-300 break-words">{it.ChqNo || ""}</td>
                            <td className="px-2 py-2.5 text-left border-r border-gray-300 break-words">{it.PymtDocNo || ""}</td>
                            <td className="px-2 py-2.5 text-center border-r border-gray-300 break-words">{it.ExpCd || display}</td>
                            <td className="px-2 py-2.5 text-right font-mono border-r border-gray-300">{formatNumber(it.DrAmt)}</td>
                            <td className="px-2 py-2.5 text-right font-mono border-r border-gray-300">{formatNumber(it.ChqAmt)}</td>
                            <td className="px-1 py-2.5 text-center border-r border-gray-300 break-words">{it.Ref1 || ""}</td>
                            <td className="px-1 py-2.5 text-center border-r border-gray-300 break-words">{it.Ref2 || ""}</td>
                            <td className="px-1 py-2.5 text-center border-r border-gray-300 break-words">{it.Ref3 || ""}</td>
                            <td className="px-1 py-2.5 text-center border-r border-gray-300 break-words">{it.Ref4 || ""}</td>
                            <td className="px-3 py-2.5 text-left border-r border-gray-300 break-words">{it.Payee || ""}</td>
                            <td className="px-3 py-2.5 text-left border-r border-gray-300 break-words whitespace-pre-line">{it.Remarks || ""}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-100 font-bold">
                          <td colSpan={5} className="px-4 py-2.5 text-right border border-gray-300">
                            Total
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono border border-gray-300">{formatNumber(expTotalDr)}</td>
                          <td colSpan={7} className="px-4 py-2.5 border border-gray-300"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                );
              })}
              <div className="w-full mt-5 mb-5 p-3 bg-gradient-to-r from-gray-200 to-gray-100 rounded-lg font-bold text-right text-sm border border-gray-300">
                Grand Total Amount: &nbsp;&nbsp; {formatNumber(totalDrAmt)}
              </div>

              {/* Signature block */}
              <div className="flex justify-between px-6 mt-10 mb-6 text-xs text-gray-700">
                <div className="w-1/4 text-center">
                  <div className="border-t border-gray-400 pt-2">Report Generated By</div>
                </div>
                <div className="w-1/4 text-center">
                  <div className="border-t border-gray-400 pt-2">Report Certified By</div>
                </div>
                <div className="w-1/4 text-center">
                  <div className="border-t border-gray-400 pt-2">Report Approved By</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ---------- Main Component ---------- */
const ChequeExpDetailsReport: React.FC = () => {
  const { user } = useUser();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [filtered, setFiltered] = useState<Department[]>([]);
  const [searchId, setSearchId] = useState("");
  const [searchName, setSearchName] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [acctCode, setAcctCode] = useState("");
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [reportData, setReportData] = useState<ChequeExpItem[]>([]);
  const [reportSummary, setReportSummary] = useState<{ totalDrAmt: number }>({ totalDrAmt: 0 });
  const [showReport, setShowReport] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);

  const epfNo = user?.Userno || "";
  const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";

  /* ---------- Fetch Departments ---------- */
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
        const raw = Array.isArray(json) ? json : json.data || json.result || json.departments || [];
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

  /* ---------- Filter Departments ---------- */
  useEffect(() => {
    const f = departments.filter(
      (d) =>
        (!searchId || d.DeptId.toLowerCase().includes(searchId.toLowerCase())) &&
        (!searchName || d.DeptName.toLowerCase().includes(searchName.toLowerCase()))
    );
    setFiltered(f);
    setPage(1);
  }, [searchId, searchName, departments]);

  /* ---------- Fetch Report ---------- */
  const fetchReport = async (dept: Department) => {
    if (!fromDate || !toDate) {
      toast.error("Select date range.");
      return;
    }
    if (new Date(toDate) < new Date(fromDate)) {
      toast.error("'To Date' cannot be earlier than 'From Date'.");
      return;
    }
    if (!acctCode.trim()) {
      toast.error("Account Code is required.");
      return;
    }

    setReportLoading(true);
    setSelectedDept(dept);
    setReportData([]);
    setShowReport(true);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const params = new URLSearchParams({
        costCtr: dept.DeptId,
        acctCode: acctCode.trim(),
        fromDate: fromDate.replace(/-/g, "/"),
        toDate: toDate.replace(/-/g, "/"),
      });
      const url = `/misapi/api/chequedetailsexp/report?${params.toString()}`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "No data");

      const items: ChequeExpItem[] = json.data || [];
      if (items.length === 0) {
        toast.warn("No records found.");
        setShowReport(false);
        setSelectedDept(null);
        return;
      }

      setReportData(items);
      setReportSummary({ totalDrAmt: json.summary?.totalDrAmt ?? 0 });
      toast.success(`${items.length} records loaded.`);
    } catch (e: any) {
      if (e.name === "AbortError") {
        toast.error("Request timed out.");
      } else {
        const msg = e.message.includes("Failed to fetch") ? "Server unreachable." : e.message;
        toast.error(msg);
      }
      setReportData([]);
      setShowReport(false);
      setSelectedDept(null);
    } finally {
      setReportLoading(false);
    }
  };

  const clearFilters = () => {
    setSearchId("");
    setSearchName("");
    setAcctCode("");
    setFromDate("");
    setToDate("");
  };

  const closeReport = () => {
    setShowReport(false);
    setReportData([]);
    setSelectedDept(null);
    setReportLoading(false);
  };

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div
      className="max-w-[95%] mx-auto p-2 md:p-4 bg-white rounded-xl shadow border border-gray-200 text-sm md:text-base font-sans relative ml-16 mt-8"
      style={{ marginLeft: "2rem" }}
    >
      <h2 className="text-lg md:text-xl font-bold mb-4 text-[#7A0000]">
        Cheque Expense Details Report
      </h2>

      {/* Filters: Account Code, Date Range */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div>
          <label className="block text-xs font-bold text-[#7A0000] mb-1">
            Account Code
          </label>
          <input
            type="text"
            value={acctCode}
            placeholder="e.g. 5010"
            onChange={(e) => setAcctCode(e.target.value.toUpperCase())}
            className="pl-3 pr-3 py-1.5 w-full rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#7A0000] transition text-sm uppercase placeholder:normal-case"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-[#7A0000] mb-1">
            From Date
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
        <div>
          <label className="block text-xs font-bold text-[#7A0000] mb-1">
            To Date
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
      </div>

      {/* Search boxes for cost centers */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            value={searchId}
            placeholder="Search by ID"
            onChange={(e) => setSearchId(e.target.value)}
            className="pl-10 pr-3 py-1.5 w-40 rounded border border-gray-300 focus:ring-2 focus:ring-[#7A0000] text-sm"
          />
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            value={searchName}
            placeholder="Search by Name"
            onChange={(e) => setSearchName(e.target.value)}
            className="pl-10 pr-3 py-1.5 w-40 rounded border border-gray-300 focus:ring-2 focus:ring-[#7A0000] text-sm"
          />
        </div>
        {(searchId || searchName) && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 px-3 py-1.5 border rounded bg-gray-100 hover:bg-gray-200 text-xs"
          >
            <RotateCcw className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {/* Loading spinner */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#7A0000]"></div>
          <p className="mt-3 text-gray-600 text-sm">Loading cost centers...</p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Cost centers table */}
      {!loading && !error && filtered.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <div className="max-h-[50vh] overflow-y-auto">
              <table className="w-full table-fixed text-left text-xs md:text-sm">
                <thead className={`${maroonGrad} text-white sticky top-0`}>
                  <tr>
                    <th className="px-4 py-2 w-1/4">Cost Center Code</th>
                    <th className="px-4 py-2 w-1/2">Cost Center Name</th>
                    <th className="px-4 py-2 w-1/4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((dept, i) => (
                    <tr key={i} className={i % 2 ? "bg-white" : "bg-gray-50"}>
                      <td className="px-4 py-2 truncate">{dept.DeptId}</td>
                      <td className="px-4 py-2 truncate">{dept.DeptName}</td>
                      <td className="px-4 py-2 text-center">
                        <button
                          onClick={() => fetchReport(dept)}
                          disabled={!fromDate || !toDate || !acctCode.trim()}
                          className={`px-3 py-1 rounded text-xs font-medium hover:brightness-110 transition shadow disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1
                            ${
                              selectedDept?.DeptId === dept.DeptId && reportLoading
                                ? "bg-green-600 text-white"
                                : selectedDept?.DeptId === dept.DeptId
                                ? "bg-green-600 text-white"
                                : `${maroonGrad} text-white`
                            }`}
                        >
                          <Eye className="w-3 h-3" />
                          {selectedDept?.DeptId === dept.DeptId && reportLoading
                            ? "Viewing"
                            : selectedDept?.DeptId === dept.DeptId
                            ? "Viewing"
                            : "View"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex justify-end items-center gap-3 mt-3">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 border rounded bg-white text-gray-600 text-xs hover:bg-gray-100 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs text-gray-600">
              Page {page} of {Math.ceil(filtered.length / PAGE_SIZE)}
            </span>
            <button
              onClick={() =>
                setPage((p) => Math.min(Math.ceil(filtered.length / PAGE_SIZE), p + 1))
              }
              disabled={page >= Math.ceil(filtered.length / PAGE_SIZE)}
              className="px-3 py-1 border rounded bg-white text-gray-600 text-xs hover:bg-gray-100 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </>
      )}

      {/* Report Modal with loading overlay */}
      {showReport && selectedDept && (
        <div className="fixed inset-0 z-50 bg-transparent flex items-center justify-center p-4">
          <div className="relative bg-white w-full max-w-[95vw] sm:max-w-4xl md:max-w-6xl lg:max-w-7xl rounded-2xl shadow-2xl overflow-hidden">
            {reportLoading && (
              <div className="absolute inset-0 bg-white/95 z-50 flex flex-col items-center justify-center gap-4">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#7A0000]"></div>
                <p className="text-xl font-bold text-[#7A0000]">Loading Report...</p>
                <p className="text-sm text-gray-600">Fetching cheque expense details from server</p>
              </div>
            )}
            {!reportLoading && reportData.length > 0 && (
              <ChequeExpDetailsTable
                data={reportData}
                fromDate={fromDate}
                toDate={toDate}
                costCenter={selectedDept.DeptId}
                departmentName={selectedDept.DeptName}
                acctCode={acctCode.trim()}
                totalDrAmt={reportSummary.totalDrAmt}
                onClose={closeReport}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChequeExpDetailsReport;