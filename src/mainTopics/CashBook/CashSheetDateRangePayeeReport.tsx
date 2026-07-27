// CashSheetDateRangePayeeReport.tsx
import React, { useEffect, useState } from "react";
import { Search, RotateCcw, Eye, X, Download, Printer } from "lucide-react";
import { useUser } from "../../contexts/UserContext";
import { toast } from "react-toastify";

interface Department {
  DeptId: string;
  DeptName: string;
}

interface CashSheetDateRangePayeeItem {
  ChqRun: string | null;
  ChqDt: string | null;
  Payee: string | null;
  PymtDocNo: string | null;
  ChqAmt: number | null;
  ChqNo: string | null;
  CctName: string | null;
}

/* ────── Constants ────── */
const REPORT_NAME = "Cash Sheet Within Date Range for Selected Payee";
const PAGE_SIZE = 9;
const FETCH_TIMEOUT_MS = 240000;

const today = new Date();
const currentYear = today.getFullYear();
const currentMonth = String(today.getMonth() + 1).padStart(2, "0");
const currentDay = String(today.getDate()).padStart(2, "0");
const maxDate = `${currentYear}-${currentMonth}-${currentDay}`;
const minDate = `${currentYear - 20}-${currentMonth}-${currentDay}`;

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
const CashSheetDateRangePayeeReportTable: React.FC<{
  data: CashSheetDateRangePayeeItem[];
  fromDate: string;
  toDate: string;
  payee: string;
  costCenter: string;
  departmentName: string;
  onClose: () => void;
}> = ({ data, fromDate, toDate, payee, costCenter, departmentName, onClose }) => {
  const maroon = "text-[#7A0000]";
  const reportTitle = `${REPORT_NAME} From ${formatDate(fromDate)} To ${formatDate(toDate)}`;

  // Sort by Payee, Cheque Date, Cheque No (matches backend ORDER BY)
  const sortedData = [...data].sort((a, b) => {
    const payeeCmp = (a.Payee || "").localeCompare(b.Payee || "");
    if (payeeCmp !== 0) return payeeCmp;

    const dateA = a.ChqDt || "";
    const dateB = b.ChqDt || "";
    const dateCmp = dateA.localeCompare(dateB);
    if (dateCmp !== 0) return dateCmp;

    const chqA = (a.ChqNo || "").trim().padStart(10, "0");
    const chqB = (b.ChqNo || "").trim().padStart(10, "0");
    return chqA.localeCompare(chqB);
  });

  const totalAmount = sortedData.reduce((sum, it) => sum + (Number(it.ChqAmt) || 0), 0);

  // ── Group by Payee ──
  type Group = {
    payee: string;
    items: CashSheetDateRangePayeeItem[];
    total: number;
  };

  const groups: Group[] = [];
  let currentPayee = "";
  let currentItems: CashSheetDateRangePayeeItem[] = [];
  let currentTotal = 0;

  for (const item of sortedData) {
    const p = item.Payee || "";
    if (p !== currentPayee) {
      if (currentItems.length > 0) {
        groups.push({ payee: currentPayee, items: currentItems, total: currentTotal });
      }
      currentPayee = p;
      currentItems = [];
      currentTotal = 0;
    }
    currentItems.push(item);
    currentTotal += Number(item.ChqAmt) || 0;
  }
  if (currentItems.length > 0) {
    groups.push({ payee: currentPayee, items: currentItems, total: currentTotal });
  }

  /* ────── CSV Download (grouped, with Payee subtotals + month total) ────── */
  const downloadCSV = () => {
    const titleRows = [
      reportTitle,
      `Cost Center: ${costCenter}/${departmentName}`,
      `Payee: ${payee || "All"}`,
      `Total Records: ${sortedData.length}`,
      `Total Amount (LKR): ${formatAmount(totalAmount)}`,
      "",
    ];
    const headers = [
      "Cheque Run",
      "Cheque Date",
      "Payslips No",
      "Cheque No.",
      "Payee",
      "Amount (LKR)",
    ];

    const rows: string[] = [];
    groups.forEach((group) => {
      group.items.forEach((it) => {
        rows.push(
          [
            csvEscape(it.ChqRun),
            csvEscape(formatDate(it.ChqDt)),
            csvEscape(it.PymtDocNo),
            csvEscape(it.ChqNo),
            csvEscape(it.Payee),
            csvEscape(it.ChqAmt),
          ].join(",")
        );
      });
      rows.push(`,,,,Total for ${group.payee},${csvEscape(formatAmount(group.total))}`);
    });
    rows.push(`,,,,Total for the Month,${csvEscape(formatAmount(totalAmount))}`);

    const csv = [...titleRows, headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CashSheetWithinDateRangeForSelectedPayee_${costCenter}_${fromDate}_${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ────── Print PDF (grouped) ────── */
  const printPDF = () => {
    let rowsHTML = "";

    groups.forEach((group) => {
      // Group header
      rowsHTML += `
        <tr style="background:#f0f0f0; font-weight:bold;">
          <td colspan="6" style="padding:6px 8px; border:1px solid #d1d5db; text-align:left; font-size:9px; color:#7A0000;">
            Payee Name : ${group.payee}
          </td>
        </tr>
      `;

      // Detail rows
      group.items.forEach((it, i) => {
        rowsHTML += `
          <tr class="${i % 2 ? "bg-white" : "bg-gray-50"}">
            <td class="px-3 py-2 border-l border-r border-gray-300 text-left text-xs">${it.ChqRun || ""}</td>
            <td class="px-3 py-2 border-r border-gray-300 text-center text-xs">${formatDate(it.ChqDt)}</td>
            <td class="px-3 py-2 border-r border-gray-300 text-left text-xs">${it.PymtDocNo || ""}</td>
            <td class="px-3 py-2 border-r border-gray-300 text-center text-xs">${it.ChqNo || ""}</td>
            <td class="px-3 py-2 border-r border-gray-300 text-left text-xs break-words">${it.Payee || ""}</td>
            <td class="px-3 py-2 border-r border-gray-300 text-right text-xs">${formatAmount(it.ChqAmt)}</td>
          </tr>
        `;
      });

      // Group total
      rowsHTML += `
        <tr style="background:#e6f0f5; font-weight:bold;">
          <td colspan="5" style="padding:6px 8px; border:1px solid #d1d5db; text-align:right; font-size:9px;">
            Total for Payee
          </td>
          <td style="padding:6px 8px; border:1px solid #d1d5db; text-align:right; font-size:9px;">
            ${formatAmount(group.total)}
          </td>
        </tr>
      `;
    });

    // Month total (last row of the report)
    rowsHTML += `
      <tr style="background:#d3d3d3; font-weight:bold;">
        <td colspan="5" style="padding:6px 8px; border:1px solid #d1d5db; text-align:right; font-size:9px;">
          Total for the Month
        </td>
        <td style="padding:6px 8px; border:1px solid #d1d5db; text-align:right; font-size:9px;">
          ${formatAmount(totalAmount)}
        </td>
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
      th { background:white; color:#1f2937; text-align:center; font-weight:bold; }
      th.amount-col { text-align:right; }
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
    <div><strong>Payee:</strong> ${payee || "All"}</div>
    <div style="font-weight:600; color:#4B5563;">Currency : LKR</div>
  </div>
  <table style="width:100%; border-collapse:collapse; font-size:8.5px; border:1px solid #d1d5db;">
    <thead>
      <tr style="background:white; color:#1f2937;">
        <th style="padding:6px 8px; width:12%;">Cheque Run</th>
        <th style="padding:6px 8px; width:12%;">Cheque Date</th>
        <th style="padding:6px 8px; width:14%;">Payslips No</th>
        <th style="padding:6px 8px; width:10%;">Cheque No.</th>
        <th style="padding:6px 8px; width:32%;">Payee</th>
        <th class="amount-col" style="padding:6px 8px; width:20%; text-align:right;">Amount (LKR)</th>
        <th style="padding:6px 8px; width:44%;">Cost Center Name</th>
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
              {payee ? (
                <>
                  {" "}
                  &nbsp;|&nbsp; <span className="font-bold">Payee:</span> {payee}
                </>
              ) : null}
            </div>
            <div className="flex gap-4 font-semibold text-gray-600">
              <div>Records: {sortedData.length}</div>
              <div>Total Amount: LKR {formatAmount(totalAmount)}</div>
            </div>
          </div>
          <div className="mt-1 mb-5 border border-gray-200 rounded-lg overflow-x-auto print:ml-12 print:mt-12 print:overflow-visible">
            <div className="min-w-[900px]">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-[#7A0000] text-white sticky top-0">
                    <th className="px-4 py-2 border border-gray-300 text-center font-bold">Cheque Run</th>
                    <th className="px-4 py-2 border border-gray-300 text-center font-bold">Cheque Date</th>
                    <th className="px-4 py-2 border border-gray-300 text-center font-bold">Payslips No</th>
                    <th className="px-4 py-2 border border-gray-300 text-center font-bold">Cheque No.</th>
                    <th className="px-4 py-2 border border-gray-300 text-center font-bold">Payee</th>
                    <th className="px-4 py-2 border border-gray-300 text-right font-bold">Amount (LKR)</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group, gi) => (
                    <React.Fragment key={gi}>
                      {/* Group header row */}
                      <tr className="bg-gray-100 font-bold">
                        <td colSpan={6} className="px-4 py-2 border border-gray-300 text-left text-[#7A0000]">
                          Payee Name : {group.payee}
                        </td>
                      </tr>
                      {/* Detail rows */}
                      {group.items.map((it, i) => (
                        <tr key={`${gi}-${i}`} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <td className="px-4 py-2 border-l border-r border-gray-300 font-mono">{it.ChqRun}</td>
                          <td className="px-4 py-2 text-center border-r border-gray-300 font-mono">{formatDate(it.ChqDt)}</td>
                          <td className="px-4 py-2 border-r border-gray-300 font-mono">{it.PymtDocNo}</td>
                          <td className="px-4 py-2 text-center border-r border-gray-300 font-mono">{it.ChqNo}</td>
                          <td className="px-4 py-2 border-r border-gray-300 break-words max-w-[220px]">{it.Payee}</td>
                          <td className="px-4 py-2 text-right border-r border-gray-300 font-mono">{formatAmount(it.ChqAmt)}</td>
                        </tr>
                      ))}
                      {/* Group total row */}
                      <tr className="bg-[#e6f0f5] font-bold">
                        <td colSpan={5} className="px-4 py-2 border border-gray-300 text-right">
                          Total for Payee
                        </td>
                        <td className="px-4 py-2 border border-gray-300 text-right font-mono">
                          {formatAmount(group.total)}
                        </td>
                      </tr>
                    </React.Fragment>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#d3d3d3] font-bold sticky bottom-0">
                    <td colSpan={5} className="px-4 py-2 border border-gray-300 text-right">Total for the Month</td>
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
const CashSheetDateRangePayeeReport: React.FC = () => {
  const { user } = useUser();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [filtered, setFiltered] = useState<Department[]>([]);
  const [searchId, setSearchId] = useState("");
  const [searchName, setSearchName] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Specific to this report: date range + payee instead of year/month
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [payee, setPayee] = useState("");

  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [reportData, setReportData] = useState<CashSheetDateRangePayeeItem[]>([]);
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
      toast.error("Please select From Date.");
      return;
    }
    if (!toDate) {
      toast.error("Please select To Date.");
      return;
    }
    if (new Date(toDate) < new Date(fromDate)) {
      toast.error("To Date cannot be before From Date.");
      return;
    }
    if (!payee.trim()) {
      toast.error("Please enter Payee.");
      return;
    }

    setReportLoading(true);
    setSelectedDept(dept);
    setReportData([]);
    setShowReport(true);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const url = `/misapi/api/cashsheetdaterangepayee?costCtr=${encodeURIComponent(
        dept.DeptId
      )}&fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(
        toDate
      )}&payee=${encodeURIComponent(payee.trim())}`;

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      if (!Array.isArray(json)) throw new Error("Unexpected response format");

      const items: CashSheetDateRangePayeeItem[] = json;
      if (items.length === 0) {
        toast.warn("No records found.");
        setShowReport(false);
        setSelectedDept(null);
        return;
      }

      setReportData(items);
      toast.success(`${items.length} records loaded.`);
    } catch (e: any) {
      toast.error(
        e.name === "AbortError"
          ? "Request timed out."
          : e.message?.includes("Failed to fetch")
          ? "Server unreachable."
          : e.message
      );
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
      className="max-w-[95%] mx-auto p-6 bg-white rounded-lg shadow-md text-sm md:text-base relative ml-16 mt-8"
      style={{ marginLeft: "2rem" }}
    >
      <h2 className={`text-xl font-bold mb-4 ${maroon}`}>
        {REPORT_NAME}
      </h2>
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
        {/* From Date */}
        <div className="w-full md:flex-1 min-w-[150px]">
          <label className="block text-xs font-bold text-[#7A0000] mb-1">
            From Date
          </label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            min={minDate}
            max={maxDate}
            className="w-full px-3 py-1.5 rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#7A0000] focus:border-transparent transition text-sm"
          />
        </div>

        {/* To Date */}
        <div className="w-full md:flex-1 min-w-[150px]">
          <label className="block text-xs font-bold text-[#7A0000] mb-1">
            To Date
          </label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            min={minDate}
            max={maxDate}
            className="w-full px-3 py-1.5 rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#7A0000] focus:border-transparent transition text-sm"
          />
        </div>

        {/* Payee */}
        <div className="w-full md:flex-[2] min-w-[180px]">
          <label className="block text-xs font-bold text-[#7A0000] mb-1">
            Payee
          </label>
          <input
            type="text"
            value={payee}
            onChange={(e) => setPayee(e.target.value)}
            placeholder="Payee name"
            className="w-full px-3 py-1.5 rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#7A0000] focus:border-transparent transition text-sm uppercase placeholder:normal-case"
          />
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
              <CashSheetDateRangePayeeReportTable
                data={reportData}
                fromDate={fromDate}
                toDate={toDate}
                payee={payee}
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

export default CashSheetDateRangePayeeReport;