// AreaTrialBalance.tsx
import React, { useState, useCallback } from "react";
import { Download, Printer, X } from "lucide-react";
import { useUser } from "../../contexts/UserContext";
import { toast } from "react-toastify";
import YearMonthDropdowns from "../../components/utils/YearMonthDropdowns";
import ReusableCompanyList from "../../components/utils/ReusableCompanyList";

type Company = {
  compId: string;
  CompName: string;
};

interface TrialBalanceItem {
  AccountCode: string | null;
  AccountName: string | null;
  TitleFlag: string | null;
  OpeningBalance: number | null;
  DebitAmount: number | null;
  CreditAmount: number | null;
  ClosingBalance: number | null;
  CompanyName: string | null;
}

/* ────── Formatting helpers ────── */
const formatNumber = (num: number | string | null | undefined): string => {
  const n = num === null || num === undefined ? NaN : Number(num);
  if (isNaN(n)) return "0.00";
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return n < 0 ? `(${formatted})` : formatted;
};

const csvEscape = (val: string | number | null | undefined): string => {
  if (val == null) return "";
  const str = String(val);
  if (/[,\n"]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
};

const getMonthName = (monthNum: number | null): string => {
  if (monthNum === null) return "";
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return monthNames[monthNum - 1] || "";
};

const AreaTrialBalance: React.FC = () => {
  const { user } = useUser();
  const epfNo = user?.Userno || "";

  /* ── Date Selection State ── */
  const [selectedYear, setSelectedYear] = useState<number | null>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(new Date().getMonth() + 1);

  /* ── Report State ── */
  const [selectedCompany, setSelectedCompany] = useState<{ id: string; name: string } | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportData, setReportData] = useState<TrialBalanceItem[]>([]);

  const maroon = "text-[#7A0000]";
  const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";

  /* ────── Fetch report data (no Jasper) ────── */
  const handleViewReport = async (company: Company) => {
    if (!selectedYear || !selectedMonth) {
      toast.error("Please select both Year and Month first.");
      return;
    }

    setSelectedCompany({ id: company.compId, name: company.CompName });
    setReportLoading(true);
    setReportData([]);
    setShowReport(true);

    try {
      const listUrl = `/misapi/api/areatrialbalance/list?companyId=${encodeURIComponent(
        company.compId
      )}&year=${selectedYear}&month=${selectedMonth}`;

      const res = await fetch(listUrl, {
        method: "GET",
        credentials: "include",
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }

      const json = await res.json();
      const items: TrialBalanceItem[] = Array.isArray(json) ? json : json.data || [];

      if (items.length === 0) {
        toast.warn("No trial balance records found for the selected period.");
        setShowReport(false);
        setSelectedCompany(null);
        return;
      }

      setReportData(items);
      toast.success("Report loaded successfully");
    } catch (err: any) {
      const msg = err.message?.includes("Failed to fetch")
        ? "Server unreachable. Please check your connection."
        : err.message || "Unknown error";
      toast.error("Failed to load report: " + msg);
      setShowReport(false);
      setSelectedCompany(null);
    } finally {
      setReportLoading(false);
    }
  };

  const closeReport = () => {
    setShowReport(false);
    setReportData([]);
    setSelectedCompany(null);
  };

  /* ────── Derived values ────── */
  const grandTotalOpening = reportData.reduce((s, r) => s + (r.OpeningBalance || 0), 0);
  const grandTotalDr = reportData.reduce((s, r) => s + (r.DebitAmount || 0), 0);
  const grandTotalCr = reportData.reduce((s, r) => s + (r.CreditAmount || 0), 0);
  const grandTotalClosing = reportData.reduce((s, r) => s + (r.ClosingBalance || 0), 0);

  const periodLabel = selectedYear ? `${getMonthName(selectedMonth)} ${selectedYear}` : "";

  /* ────── CSV download (client-side) ────── */
  const handleDownloadCSV = () => {
    if (reportData.length === 0 || !selectedCompany) {
      toast.error("No report data available to download as CSV.");
      return;
    }

    const titleRows = [
      `Area Trial Balance Summary - ${periodLabel}`,
      `Area: ${selectedCompany.id} | ${selectedCompany.name}`,
      "",
    ];

    const headers = [
      "No",
      "Account Code",
      "Account Name",
      "Opening Balance",
      "Debit",
      "Credit",
      "Closing Balance",
    ];
    const rows: string[] = [headers.join(",")];

    reportData.forEach((it, i) => {
      rows.push(
        [
          csvEscape(i + 1),
          csvEscape(it.AccountCode),
          csvEscape(it.AccountName),
          csvEscape(formatNumber(it.OpeningBalance)),
          csvEscape(formatNumber(it.DebitAmount)),
          csvEscape(formatNumber(it.CreditAmount)),
          csvEscape(formatNumber(it.ClosingBalance)),
        ].join(",")
      );
    });

    rows.push(
      `Grand Total,,,${csvEscape(formatNumber(grandTotalOpening))},${csvEscape(
        formatNumber(grandTotalDr)
      )},${csvEscape(formatNumber(grandTotalCr))},${csvEscape(formatNumber(grandTotalClosing))}`
    );

    const csv = [...titleRows, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Area_Trial_Balance_${selectedCompany.id}_${selectedYear}_${(selectedMonth || 0)
      .toString()
      .padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ────── PDF print (client-side, no Jasper) ────── */
  const printPDF = () => {
    if (reportData.length === 0 || !selectedCompany) return;

    let rows = "";
    reportData.forEach((it, i) => {
      rows += `
        <tr class="${i % 2 ? "bg-white" : "bg-gray-50"}">
          <td class="px-3 py-2 border-l border-r border-gray-300 text-center text-xs">${i + 1}</td>
          <td class="px-3 py-2 border-r border-gray-300 text-left text-xs font-mono">${it.AccountCode || ""}</td>
          <td class="px-3 py-2 border-r border-gray-300 text-left text-xs break-words">${it.AccountName || ""}</td>
          <td class="px-3 py-2 border-r border-gray-300 text-right text-xs font-mono">${formatNumber(
            it.OpeningBalance
          )}</td>
          <td class="px-3 py-2 border-r border-gray-300 text-right text-xs font-mono">${formatNumber(
            it.DebitAmount
          )}</td>
          <td class="px-3 py-2 border-r border-gray-300 text-right text-xs font-mono">${formatNumber(
            it.CreditAmount
          )}</td>
          <td class="px-3 py-2 border-r border-gray-300 text-right text-xs font-mono">${formatNumber(
            it.ClosingBalance
          )}</td>
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
      .title { margin: 10px 8px 20px; text-align:center; font-weight:bold; color:#7A0000; font-size:13px; }
      .info { margin:6px 8px; font-size:9px; display:flex; justify-content:space-between; }
      table { border-collapse:collapse; width:100%; font-size:8.5px; }
      th, td { border:1px solid #d1d5db; padding:6px 8px; word-wrap:break-word; }
      th { background:linear-gradient(to right,#7A0000,#A52A2A); color:white; text-align:center; font-weight:bold; }
      tfoot td { background:#d3d3d3; font-weight:bold; }
      .font-mono { font-family:monospace; }
      .text-right { text-align:right; }
      .text-center { text-align:center; }
      .text-left { text-align:left; }
      @page {
        @bottom-left  { content:"Printed on: ${new Date().toLocaleString("en-US", {
          timeZone: "Asia/Colombo",
        })}"; font-size:7px; color:gray; }
        @bottom-right { content:"Page " counter(page) " of " counter(pages); font-size:7px; color:gray; }
      }
    }
  </style>
</head>
<body>
  <div class="title">Area Trial Balance Summary - ${periodLabel}</div>
  <div class="info">
    <div><strong>Area:</strong> ${selectedCompany.id} / ${selectedCompany.name}</div>
    <div style="font-weight:600; color:#4B5563;">Currency : LKR</div>
  </div>
  <table style="width:100%; border-collapse:collapse; font-size:8.5px; border:1px solid #d1d5db;">
    <thead>
      <tr style="background:linear-gradient(to right,#7A0000,#A52A2A); color:white;">
        <th style="padding:6px 8px; width:5%;">No</th>
        <th style="padding:6px 8px; width:13%;">Account Code</th>
        <th style="padding:6px 8px; width:32%;">Account Name</th>
        <th style="padding:6px 8px; width:12%; text-align:right;">Opening Balance</th>
        <th style="padding:6px 8px; width:12%; text-align:right;">Debit</th>
        <th style="padding:6px 8px; width:12%; text-align:right;">Credit</th>
        <th style="padding:6px 8px; width:14%; text-align:right;">Closing Balance</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr>
        <td colspan="3" style="text-align:right; padding:6px 8px; border:1px solid #d1d5db;">Grand Total</td>
        <td style="text-align:right; padding:6px 8px; border:1px solid #d1d5db; font-family:monospace;">${formatNumber(
          grandTotalOpening
        )}</td>
        <td style="text-align:right; padding:6px 8px; border:1px solid #d1d5db; font-family:monospace;">${formatNumber(
          grandTotalDr
        )}</td>
        <td style="text-align:right; padding:6px 8px; border:1px solid #d1d5db; font-family:monospace;">${formatNumber(
          grandTotalCr
        )}</td>
        <td style="text-align:right; padding:6px 8px; border:1px solid #d1d5db; font-family:monospace;">${formatNumber(
          grandTotalClosing
        )}</td>
      </tr>
    </tfoot>
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
    <div className="max-w-[95%] mx-auto p-4 bg-white rounded-xl shadow border border-gray-200 font-sans">
      <h2 className={`text-lg md:text-xl font-bold mb-6 ${maroon}`}>Area Trial Balance Summary</h2>

      {/* Parameter Selection Controls */}
      <div className="flex flex-col md:flex-row gap-6 items-end mb-6">
        <YearMonthDropdowns
          selectedYear={selectedYear}
          setSelectedYear={setSelectedYear}
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
          className="gap-4"
        />
      </div>

      {/* ── Company List ── */}
      <div className="mt-6">
        <ReusableCompanyList
          fetchItems={useCallback(async () => {
            if (!epfNo) {
              toast.error("No EPF number available.");
              return [];
            }
            try {
              const res = await fetch(`/misapi/api/incomeexpenditure/Usercompanies/${epfNo}/50`);
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              const txt = await res.text();
              const parsed = JSON.parse(txt);
              const raw = Array.isArray(parsed) ? parsed : parsed.data || [];
              return raw.map((c: any) => ({
                id: c.CompId,
                name: c.CompName,
              }));
            } catch (e: any) {
              toast.error(e.message || "Failed to load companies");
              return [];
            }
          }, [epfNo])}
          onViewItem={(company: { id: string; name: string }) => {
            handleViewReport({
              compId: company.id,
              CompName: company.name,
            });
          }}
          idColumnTitle="Company Code"
          nameColumnTitle="Company Name"
          loadingMessage="Loading companies..."
          emptyMessage="No companies available for selection."
        />
      </div>

      {/* ────── REPORT MODAL ────── */}
      {showReport && selectedCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/90 print:static print:inset-auto print:p-0 print:bg-white">
          <div className="relative bg-white w-[95vw] sm:w-[90vw] md:w-[85vw] lg:w-[80vw] xl:w-[75vw] max-w-7xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden mt-20 md:mt-32 lg:mt-40 lg:ml-64 mx-auto print:relative print:w-full print:max-w-none print:rounded-none print:shadow-none print:border-none print:overflow-visible">
            {reportLoading && (
              <div className="absolute inset-0 bg-white/95 z-50 flex flex-col items-center justify-center gap-4">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#7A0000]"></div>
                <p className="text-xl font-bold text-[#7A0000]">Loading Report...</p>
                <p className="text-sm text-gray-600">Fetching trial balance details from server</p>
              </div>
            )}
            {!reportLoading && reportData.length > 0 && (
              <div className="p-2 md:p-2 max-h-[80vh] overflow-y-auto print:p-0 print:max-h-none print:overflow-visible print:mt-10 print:ml-12">
                <div className="flex justify-end gap-3 mb-6 md:mb-8 print:hidden">
                  <button
                    onClick={handleDownloadCSV}
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
                    onClick={closeReport}
                    className="flex items-center gap-1 px-3 py-1.5 border border-red-400 text-red-700 bg-white rounded-md text-xs font-medium shadow-sm hover:bg-red-50"
                  >
                    <X className="w-4 h-4" /> Close
                  </button>
                </div>

                <h2 className={`text-lg md:text-xl font-bold text-center md:mb-6 ${maroon}`}>
                  Area Trial Balance Summary - {periodLabel}
                </h2>
                <div className="flex justify-between text-sm mb-3 ml-5 mr-12">
                  <div>
                    <span className="font-bold">Area:</span> {selectedCompany.id} / {selectedCompany.name}
                  </div>
                  <div className="font-semibold text-gray-600">Currency : LKR</div>
                </div>

                <div className="ml-5 mt-1 mb-5 border border-gray-200 rounded-lg overflow-x-auto print:ml-12 print:mt-12 print:overflow-visible">
                  <div className="min-w-[1100px]">
                    <table className="w-full text-xs border-collapse">
                      <thead className={`${maroonGrad} text-white`}>
                        <tr>
                          <th className="px-4 py-2 border border-gray-300" style={{ width: "5%" }}>
                            No
                          </th>
                          <th className="px-4 py-2 border border-gray-300" style={{ width: "13%" }}>
                            Account Code
                          </th>
                          <th className="px-4 py-2 border border-gray-300" style={{ width: "32%" }}>
                            Account Name
                          </th>
                          <th className="px-4 py-2 border border-gray-300 text-right" style={{ width: "12%" }}>
                            Opening Balance
                          </th>
                          <th className="px-4 py-2 border border-gray-300 text-right" style={{ width: "12%" }}>
                            Debit
                          </th>
                          <th className="px-4 py-2 border border-gray-300 text-right" style={{ width: "12%" }}>
                            Credit
                          </th>
                          <th className="px-4 py-2 border border-gray-300 text-right" style={{ width: "14%" }}>
                            Closing Balance
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.map((it, i) => (
                          <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                            <td className="px-4 py-2 border-l border-r border-gray-300 text-center">{i + 1}</td>
                            <td className="px-4 py-2 font-mono border-r border-gray-300">{it.AccountCode || ""}</td>
                            <td className="px-4 py-2 border-r border-gray-300 break-words">{it.AccountName || ""}</td>
                            <td className="px-4 py-2 text-right font-mono border-r border-gray-300">
                              {formatNumber(it.OpeningBalance)}
                            </td>
                            <td className="px-4 py-2 text-right font-mono border-r border-gray-300">
                              {formatNumber(it.DebitAmount)}
                            </td>
                            <td className="px-4 py-2 text-right font-mono border-r border-gray-300">
                              {formatNumber(it.CreditAmount)}
                            </td>
                            <td className="px-4 py-2 text-right font-mono border-r border-gray-300">
                              {formatNumber(it.ClosingBalance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-[#d3d3d3] font-bold">
                          <td colSpan={3} className="px-4 py-2 text-right border border-gray-300">
                            Grand Total
                          </td>
                          <td className="px-4 py-2 text-right font-mono border border-gray-300">
                            {formatNumber(grandTotalOpening)}
                          </td>
                          <td className="px-4 py-2 text-right font-mono border border-gray-300">
                            {formatNumber(grandTotalDr)}
                          </td>
                          <td className="px-4 py-2 text-right font-mono border border-gray-300">
                            {formatNumber(grandTotalCr)}
                          </td>
                          <td className="px-4 py-2 text-right font-mono border border-gray-300">
                            {formatNumber(grandTotalClosing)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                    <p className="text-xs text-gray-500 mt-2 text-right px-2">
                      Total records: {reportData.length.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AreaTrialBalance;