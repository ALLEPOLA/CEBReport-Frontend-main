// ChequeDetailsExpRegion.tsx
import React, { useEffect, useState } from "react";
import { Search, RotateCcw, Eye, X, Download, Printer } from "lucide-react";
import { useUser } from "../../contexts/UserContext";
import { toast } from "react-toastify";

/* ---------- interfaces ---------- */
interface DivisionRegion {
  CompId: string;
  CompName: string;
}

interface ChqExpRegionRow {
  DeptId: string | null;
  ChqDt: string | null;
  ChqNo: string | null;
  PymtDocNo: string | null;
  ExpCd: string | null;
  DrAmt: number | null;
  ChqAmt: number | null;
  Payee: string | null;
  Remarks: string | null;
  ChqRun: string | null;
  RunDt: string | null;
  CctName: string | null;
}

/* ---------- constants ---------- */
const ROWS_PER_PAGE = 9;
const FETCH_TIMEOUT_MS = 180000;

/* ---------- formatting helpers ---------- */
// Preserves sign - the amount column mixes debits (+) and credits (-), and
// the grand total must reflect that, not an absolute-value sum.
const formatAmountLKR = (num: number | string | null | undefined): string => {
  const n = num === null || num === undefined || num === "" ? NaN : Number(num);
  if (isNaN(n)) return "0.00";
  const abs = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return n < 0 ? `-${abs}` : abs;
};

const formatDisplayDate = (dateStr: string | null): string => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const csvEscapeVal = (val: string | number | null | undefined): string => {
  if (val == null) return "";
  const str = String(val);
  if (/[,\n"]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
};

const getReportTimestamp = (): string =>
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

/* ---------- date boundaries for the picker ---------- */
const todayNow = new Date();
const maxPickDate = `${todayNow.getFullYear()}-${String(todayNow.getMonth() + 1).padStart(2, "0")}-${String(
  todayNow.getDate()
).padStart(2, "0")}`;
const minPickDate = `${todayNow.getFullYear() - 20}-${String(todayNow.getMonth() + 1).padStart(2, "0")}-${String(
  todayNow.getDate()
).padStart(2, "0")}`;

/* ---------- column widths (12 columns, sums to 100%) ---------- */
const COL_WIDTH = {
  no: "3%",
  deptId: "6%",
  chqDt: "7%",
  chqNo: "7%",
  pymtDocNo: "9%",
  expCd: "7%",
  drAmt: "8%",
  chqAmt: "8%",
  chqRun: "6%",
  runDt: "7%",
  payee: "15%",
  remarks: "17%",
};

/* ---------- Report Modal ---------- */
const ChequeExpRegionDetailsTable: React.FC<{
  rows: ChqExpRegionRow[];
  fromDate: string;
  toDate: string;
  regionId: string;
  regionName: string;
  acctCode: string;
  onClose: () => void;
}> = ({ rows, fromDate, toDate, regionId, regionName, acctCode, onClose }) => {
  const maroon = "text-[#7A0000]";
  const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";

  const sortedRows = [...rows].sort((a, b) => {
    const dept = (a.DeptId || "").localeCompare(b.DeptId || "");
    if (dept !== 0) return dept;
    const exp = (a.ExpCd || "").localeCompare(b.ExpCd || "");
    if (exp !== 0) return exp;
    return (a.ChqNo || "").localeCompare(b.ChqNo || "");
  });

  // Grand total is a straight sum (debits positive, credits negative) - never abs().
  const grandTotalDrAmt = sortedRows.reduce((sum, r) => sum + (Number(r.DrAmt) || 0), 0);

  const generatedOn = getReportTimestamp();

  /* ---------- CSV download ---------- */
  const downloadCSV = () => {
    const titleRows = [
      `Cheque Details with ExpCode (Region) Report From ${fromDate} To ${toDate}`,
      `Division (Region): ${regionId} / ${regionName}`,
      `Account Code: ${acctCode || "All"}`,
      `Currency: LKR`,
      `Generated On: ${generatedOn}`,
      "",
    ];

    const headers = [
      "No",
      "Department Id",
      "Cheque Date",
      "Cheque No",
      "Payslip No",
      "Account Code",
      "Amount (LKR)",
      "Total Cheque",
      "Cheque Run",
      "Payment Plan Date",
      "Payee",
      "Remarks",
    ];

    const dataRows = sortedRows.map((r, idx) =>
      [
        csvEscapeVal(idx + 1),
        csvEscapeVal(r.DeptId),
        csvEscapeVal(formatDisplayDate(r.ChqDt)),
        csvEscapeVal(r.ChqNo),
        csvEscapeVal(r.PymtDocNo),
        csvEscapeVal(r.ExpCd),
        csvEscapeVal(formatAmountLKR(r.DrAmt)),
        csvEscapeVal(formatAmountLKR(r.ChqAmt)),
        csvEscapeVal(r.ChqRun),
        csvEscapeVal(formatDisplayDate(r.RunDt)),
        csvEscapeVal(r.Payee),
        csvEscapeVal(r.Remarks),
      ].join(",")
    );

    const footerRows = [
      "",
      `Grand Total,,,,,,${csvEscapeVal(formatAmountLKR(grandTotalDrAmt))},,,,,`,
      "",
      "Report Generated By,,,Report Certified By,,,Report Approved By,,",
    ];

    const csv = [...titleRows, headers.join(","), ...dataRows, ...footerRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ChequeDetailsExpRegion_${regionId}_${fromDate}_${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ---------- PDF print ---------- */
const printPDF = () => {
  let bodyRows = "";
  sortedRows.forEach((r, i) => {
    const amtNegative = (Number(r.DrAmt) || 0) < 0;
    bodyRows += `
      <tr class="${i % 2 ? "bg-white" : "bg-gray-50"}">
        <td style="text-align:center;">${i + 1}</td>
        <td style="text-align:center;">${r.DeptId || ""}</td>
        <td style="text-align:center;">${formatDisplayDate(r.ChqDt)}</td>
        <td style="text-align:center;" class="font-mono">${r.ChqNo || ""}</td>
        <td style="text-align:left;">${r.PymtDocNo || ""}</td>
        <td style="text-align:center;">${r.ExpCd || ""}</td>
        <td style="text-align:right;${amtNegative ? "color:#B91C1C;" : ""}" class="font-mono" nowrap>${formatAmountLKR(r.DrAmt)}</td>
        <td style="text-align:right;" class="font-mono" nowrap>${formatAmountLKR(r.ChqAmt)}</td>
        <td style="text-align:center;">${r.ChqRun || ""}</td>
        <td style="text-align:center;">${formatDisplayDate(r.RunDt)}</td>
        <td style="text-align:left;">${r.Payee || ""}</td>
        <td style="text-align:left;">${r.Remarks || ""}</td>
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
      .title { margin: 10px 8px 4px; text-align:center; font-weight:bold; color:#7A0000; font-size:13px; }
      .generated { margin: 0 8px 16px; text-align:center; font-size:8px; color:#6b7280; }
      .info  { margin:6px 8px; font-size:9px; display:flex; justify-content:space-between; }
      .regionInfo { font-size: 11px; margin-left: 0px; font-weight: 500; }
      table { border-collapse:collapse; width:100%; table-layout:fixed; font-size:8.5px; }
      th, td { border:1px solid #d1d5db; padding:6px 8px; word-wrap:break-word; overflow-wrap:break-word; }
      th { background:linear-gradient(to right,#7A0000,#A52A2A); color:white; text-align:center; font-weight:bold; }
      .font-mono { font-family:monospace; white-space:nowrap; }
      .signatures { margin-top:36px; display:flex; justify-content:space-between; padding:0 15px; font-size:9px; }
      .signatures div { width:30%; text-align:center; }
      .signatures .line { border-top:1px solid #374151; margin-bottom:6px; padding-top:26px; }
      @page {
        @bottom-left  { content:"Printed on: ${new Date().toLocaleString("en-US", { timeZone: "Asia/Colombo" })}"; font-size:7px; color:gray; }
        @bottom-right { content:"Page " counter(page) " of " counter(pages); font-size:7px; color:gray; }
      }
    }
  </style>
</head>
<body>
  <div class="title">Cheque Details with ExpCode (Region) Report From ${fromDate} To ${toDate}</div>
  <div class="generated">Report Generated On: ${generatedOn}</div>
  <div class="info">
    <div class="regionInfo">
      <strong>Division (Region):</strong> ${regionId} / ${regionName}<br/>
      <strong>Account Code:</strong> ${acctCode || "All"}
    </div>
    <div style="font-weight:600; color:#4B5563;">Currency : LKR</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:${COL_WIDTH.no};">No</th>
        <th style="width:${COL_WIDTH.deptId};">Department Id</th>
        <th style="width:${COL_WIDTH.chqDt};">Cheque Date</th>
        <th style="width:${COL_WIDTH.chqNo};">Cheque No</th>
        <th style="width:${COL_WIDTH.pymtDocNo};">Payslip No</th>
        <th style="width:${COL_WIDTH.expCd};">Account Code</th>
        <th style="width:10%; text-align:right;">Amount (LKR)</th>
        <th style="width:10%; text-align:right;">Total Cheque</th>
        <th style="width:${COL_WIDTH.chqRun};">Cheque Run</th>
        <th style="width:${COL_WIDTH.runDt};">Payment Plan Date</th>
        <th style="width:${COL_WIDTH.payee};">Payee</th>
        <th style="width:${COL_WIDTH.remarks};">Remarks</th>
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
    <tfoot>
      <tr style="background:#f3f4f6; font-weight:bold; font-size:9px;">
        <td colspan="6" style="text-align:right; padding:6px 8px;">Grand Total</td>
        <td style="text-align:right; padding:6px 8px; ${grandTotalDrAmt < 0 ? "color:#B91C1C;" : ""}" class="font-mono" nowrap>${formatAmountLKR(grandTotalDrAmt)}</td>
        <td colspan="5" style="padding:6px 8px;"></td>
      </tr>
    </tfoot>
  </table>

  <div class="signatures">
    <div><div class="line">Report Generated By</div></div>
    <div><div class="line">Report Certified By</div></div>
    <div><div class="line">Report Approved By</div></div>
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
            Cheque Details with ExpCode (Region) Report From {fromDate} To {toDate}
          </h2>
          <p className="text-center text-[11px] text-gray-500 mb-4">
            Report Generated On: {generatedOn}
          </p>
          <div className="flex justify-between text-sm mb-3 ml-5 mr-12">
            <div>
              <span className="font-bold">Division (Region):</span> {regionId} / {regionName}<br />
              <span className="font-bold">Account Code:</span> {acctCode || "All"}
            </div>
            <div className="font-semibold text-gray-600">Currency : LKR</div>
          </div>

          <div className="ml-5 mt-1 border border-gray-200 rounded-lg overflow-x-auto print:ml-12 print:mt-12 print:overflow-visible">
            <div className="min-w-[1500px]">
              <table className="w-full table-fixed text-xs border-collapse">
                <thead className={`${maroonGrad} text-white`}>
                  <tr>
                    <th className="px-2 py-3 text-center border border-gray-300" style={{ width: COL_WIDTH.no }}>No</th>
                    <th className="px-2 py-3 text-center border border-gray-300" style={{ width: COL_WIDTH.deptId }}>Department Id</th>
                    <th className="px-2 py-3 text-center border border-gray-300" style={{ width: COL_WIDTH.chqDt }}>Cheque Date</th>
                    <th className="px-2 py-3 text-center border border-gray-300" style={{ width: COL_WIDTH.chqNo }}>Cheque No</th>
                    <th className="px-2 py-3 text-center border border-gray-300" style={{ width: COL_WIDTH.pymtDocNo }}>Payslip No</th>
                    <th className="px-2 py-3 text-center border border-gray-300" style={{ width: COL_WIDTH.expCd }}>Account Code</th>
                    <th className="px-2 py-3 text-right border border-gray-300" style={{ width: COL_WIDTH.drAmt }}>Amount (LKR)</th>
                    <th className="px-2 py-3 text-right border border-gray-300" style={{ width: COL_WIDTH.chqAmt }}>Total Cheque</th>
                    <th className="px-2 py-3 text-center border border-gray-300" style={{ width: COL_WIDTH.chqRun }}>Cheque Run</th>
                    <th className="px-2 py-3 text-center border border-gray-300" style={{ width: COL_WIDTH.runDt }}>Payment Plan Date</th>
                    <th className="px-3 py-3 text-left border border-gray-300" style={{ width: COL_WIDTH.payee }}>Payee</th>
                    <th className="px-3 py-3 text-left border border-gray-300" style={{ width: COL_WIDTH.remarks }}>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((r, i) => {
                    const isNegative = (Number(r.DrAmt) || 0) < 0;
                    return (
                      <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="px-2 py-2.5 text-center border-l border-r border-gray-300">{i + 1}</td>
                        <td className="px-2 py-2.5 text-center border-r border-gray-300 break-words">{r.DeptId || ""}</td>
                        <td className="px-2 py-2.5 text-center border-r border-gray-300 break-words">{formatDisplayDate(r.ChqDt)}</td>
                        <td className="px-2 py-2.5 text-center font-mono border-r border-gray-300 break-words">{r.ChqNo || ""}</td>
                        <td className="px-2 py-2.5 text-left border-r border-gray-300 break-words">{r.PymtDocNo || ""}</td>
                        <td className="px-2 py-2.5 text-center border-r border-gray-300 break-words">{r.ExpCd || ""}</td>
                        <td className={`px-2 py-2.5 text-right font-mono border-r border-gray-300 ${isNegative ? "text-red-600" : ""}`}>
                          {formatAmountLKR(r.DrAmt)}
                        </td>
                        <td className="px-2 py-2.5 text-right font-mono border-r border-gray-300">{formatAmountLKR(r.ChqAmt)}</td>
                        <td className="px-2 py-2.5 text-center border-r border-gray-300 break-words">{r.ChqRun || ""}</td>
                        <td className="px-2 py-2.5 text-center border-r border-gray-300 break-words">{formatDisplayDate(r.RunDt)}</td>
                        <td className="px-3 py-2.5 text-left border-r border-gray-300 break-words">{r.Payee || ""}</td>
                        <td className="px-3 py-2.5 text-left border-r border-gray-300 break-words whitespace-pre-line">{r.Remarks || ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100 font-bold">
                    <td colSpan={6} className="px-4 py-2.5 text-right border border-gray-300">
                      Grand Total
                    </td>
                    <td className={`px-4 py-2.5 text-right font-mono border border-gray-300 ${grandTotalDrAmt < 0 ? "text-red-600" : ""}`}>
                      {formatAmountLKR(grandTotalDrAmt)}
                    </td>
                    <td colSpan={5} className="px-4 py-2.5 border border-gray-300"></td>
                  </tr>
                </tfoot>
              </table>

              {/* Signature block */}
              <div className="flex justify-between px-10 mt-10 mb-6 text-xs text-gray-700">
                <div className="w-1/3 text-center">
                  <div className="border-t border-gray-400 pt-2">Report Generated By</div>
                </div>
                <div className="w-1/3 text-center">
                  <div className="border-t border-gray-400 pt-2">Report Certified By</div>
                </div>
                <div className="w-1/3 text-center">
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
const ChequeDetailsExpRegionReport: React.FC = () => {
  const { user } = useUser();
  const [regions, setRegions] = useState<DivisionRegion[]>([]);
  const [filteredRegions, setFilteredRegions] = useState<DivisionRegion[]>([]);
  const [searchId, setSearchId] = useState("");
  const [searchName, setSearchName] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [acctCode, setAcctCode] = useState(""); // optional
  const [selectedRegion, setSelectedRegion] = useState<DivisionRegion | null>(null);
  const [reportRows, setReportRows] = useState<ChqExpRegionRow[]>([]);
  const [showReport, setShowReport] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);

  const epfNo = user?.Userno || "";
  const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";

  /* ---------- Fetch Divisions/Regions ---------- */
  useEffect(() => {
    const fetchRegions = async () => {
      if (!epfNo) {
        setError("No EPF number available.");
        toast.error("Login required.");
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        // NOTE: adjust this path to your actual divisions/regions endpoint.
        const res = await fetch(`/misapi/api/incomeexpenditure/usercompanies/${epfNo}/70`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const raw = Array.isArray(json) ? json : json.data || json.result || json.divisions || [];
        const list: DivisionRegion[] = raw.map((d: any) => ({
          CompId: String(d.CompId || d.compId || ""),
          CompName: String(d.CompName || d.compName || "").trim(),
        }));
        setRegions(list);
        setFilteredRegions(list);
      } catch (e: any) {
        setError(e.message);
        toast.error("Failed to load divisions.");
      } finally {
        setLoading(false);
      }
    };
    fetchRegions();
  }, [epfNo]);

  /* ---------- Filter Divisions/Regions ---------- */
  useEffect(() => {
    const f = regions.filter(
      (d) =>
        (!searchId || d.CompId.toLowerCase().includes(searchId.toLowerCase())) &&
        (!searchName || d.CompName.toLowerCase().includes(searchName.toLowerCase()))
    );
    setFilteredRegions(f);
    setPage(1);
  }, [searchId, searchName, regions]);

  /* ---------- Fetch Report ---------- */
  const fetchReport = async (region: DivisionRegion) => {
    if (!fromDate || !toDate) {
      toast.error("Select date range.");
      return;
    }
    if (new Date(toDate) < new Date(fromDate)) {
      toast.error("'To Date' cannot be earlier than 'From Date'.");
      return;
    }
    // acctCode is optional - blank means "all accounts", so no validation here.

    setReportLoading(true);
    setSelectedRegion(region);
    setReportRows([]);
    setShowReport(true);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const params = new URLSearchParams({
        fromDate, // already yyyy-MM-dd from the date input
        toDate,
        compId: region.CompId.trim()
      });
      if (acctCode.trim()) params.append("glCode", acctCode.trim());

      const url = `/misapi/api/chqdetailsexpregion/report?${params.toString()}`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "No data");

      const rows: ChqExpRegionRow[] = json.data || [];
      if (rows.length === 0) {
        toast.warn(json.message || "No records found.");
        setShowReport(false);
        setSelectedRegion(null);
        return;
      }

      setReportRows(rows);
      toast.success(`${rows.length} records loaded.`);
    } catch (e: any) {
      if (e.name === "AbortError") {
        toast.error("Request timed out.");
      } else {
        const msg = e.message.includes("Failed to fetch") ? "Server unreachable." : e.message;
        toast.error(msg);
      }
      setReportRows([]);
      setShowReport(false);
      setSelectedRegion(null);
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
    setReportRows([]);
    setSelectedRegion(null);
    setReportLoading(false);
  };

  const paginatedRegions = filteredRegions.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

  return (
    <div
      className="max-w-[95%] mx-auto p-2 md:p-4 bg-white rounded-xl shadow border border-gray-200 text-sm md:text-base font-sans relative ml-16 mt-8"
      style={{ marginLeft: "2rem" }}
    >
      <h2 className="text-lg md:text-xl font-bold mb-4 text-[#7A0000]">
        Cheque Details with ExpCode (Region) Report
      </h2>

      {/* Filters: From Date, To Date, Account Code (optional) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div>
          <label className="block text-xs font-bold text-[#7A0000] mb-1">
            From Date
          </label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            min={minPickDate}
            max={maxPickDate}
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
            min={minPickDate}
            max={maxPickDate}
            className="pl-3 pr-3 py-1.5 w-full rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#7A0000] transition text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-[#7A0000] mb-1">
            Account Code <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <input
            type="text"
            value={acctCode}
            placeholder="Leave blank for all accounts"
            onChange={(e) => setAcctCode(e.target.value.toUpperCase())}
            className="pl-3 pr-3 py-1.5 w-full rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#7A0000] transition text-sm uppercase placeholder:normal-case"
          />
        </div>
      </div>

      {/* Search boxes for divisions/regions */}
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
          <p className="mt-3 text-gray-600 text-sm">Loading divisions...</p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Divisions/Regions table */}
      {!loading && !error && filteredRegions.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <div className="max-h-[50vh] overflow-y-auto">
              <table className="w-full table-fixed text-left text-xs md:text-sm">
                <thead className={`${maroonGrad} text-white sticky top-0`}>
                  <tr>
                    <th className="px-4 py-2 w-1/4">Division (Region) Code</th>
                    <th className="px-4 py-2 w-1/2">Division (Region) Name</th>
                    <th className="px-4 py-2 w-1/4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRegions.map((region, i) => (
                    <tr key={i} className={i % 2 ? "bg-white" : "bg-gray-50"}>
                      <td className="px-4 py-2 truncate">{region.CompId}</td>
                      <td className="px-4 py-2 truncate">{region.CompName}</td>
                      <td className="px-4 py-2 text-center">
                        <button
                          onClick={() => fetchReport(region)}
                          disabled={!fromDate || !toDate}
                          className={`mx-auto px-3 py-1 rounded text-xs font-medium hover:brightness-110 transition shadow disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1
                            ${
                              selectedRegion?.CompId === region.CompId
                                ? "bg-green-600 text-white"
                                : `${maroonGrad} text-white`
                            }`}
                        >
                          <Eye className="w-3 h-3" />
                          {selectedRegion?.CompId === region.CompId && reportLoading
                            ? "Viewing"
                            : selectedRegion?.CompId === region.CompId
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
              Page {page} of {Math.ceil(filteredRegions.length / ROWS_PER_PAGE)}
            </span>
            <button
              onClick={() =>
                setPage((p) => Math.min(Math.ceil(filteredRegions.length / ROWS_PER_PAGE), p + 1))
              }
              disabled={page >= Math.ceil(filteredRegions.length / ROWS_PER_PAGE)}
              className="px-3 py-1 border rounded bg-white text-gray-600 text-xs hover:bg-gray-100 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </>
      )}

      {/* Report Modal with loading overlay */}
      {showReport && selectedRegion && (
        <div className="fixed inset-0 z-50 bg-transparent flex items-center justify-center p-4">
          <div className="relative bg-white w-full max-w-[95vw] sm:max-w-4xl md:max-w-6xl lg:max-w-7xl rounded-2xl shadow-2xl overflow-hidden">
            {reportLoading && (
              <div className="absolute inset-0 bg-white/95 z-50 flex flex-col items-center justify-center gap-4">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#7A0000]"></div>
                <p className="text-xl font-bold text-[#7A0000]">Loading Report...</p>
                <p className="text-sm text-gray-600">Fetching cheque expense details from server</p>
              </div>
            )}
            {!reportLoading && reportRows.length > 0 && (
              <ChequeExpRegionDetailsTable
                rows={reportRows}
                fromDate={fromDate}
                toDate={toDate}
                regionId={selectedRegion.CompId}
                regionName={selectedRegion.CompName}
                acctCode={acctCode.trim()}
                onClose={closeReport}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChequeDetailsExpRegionReport;