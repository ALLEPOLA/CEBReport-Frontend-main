import React, { useState, useRef, useEffect } from 'react';
import { FaFileDownload, FaPrint } from 'react-icons/fa';
import { useReportScope } from '../../hooks/useReportScope';
import { useUser } from '../../contexts/UserContext';

interface HeadOfficePOSCollectionResult {
  AreaName?: string;
  Count?: number;
  SumTransAmt?: number;
  AreaCode?: string;
  areaName?: string;
  count?: number;
  sumTransAmt?: number;
  areaCode?: string;
}

const HeadOfficePOSCollection: React.FC = () => {
  const { level, locked } = useReportScope();
  const { user } = useUser();
  const [allowedAreaCodes, setAllowedAreaCodes] = useState<Set<string> | null>(null);
  const [scopeLoading, setScopeLoading] = useState(false);

  const [reportType, setReportType] = useState('Bulk');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<HeadOfficePOSCollectionResult[] | null>(null);

  const lockedRegionCode = locked["Region"]?.code;
  const lockedProvinceCode = locked["Province"]?.code;

  useEffect(() => {
    let active = true;
    const fetchScopeAreas = async () => {
      // Only fetch areas list if Province (60) or Region (70)
      if (level !== 60 && level !== 70) return;

      setScopeLoading(true);
      try {
        let url = "/misapi/api/ordinary/areas";
        if (level === 70 && lockedRegionCode) {
          url += `?regionCode=${encodeURIComponent(lockedRegionCode)}`;
        } else if (level === 60 && lockedProvinceCode) {
          url += `?provCode=${encodeURIComponent(lockedProvinceCode)}`;
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch areas for scope");
        const payload = await res.json();
        
        if (active && payload?.data) {
          const areaCodes = new Set<string>(
            payload.data.map((a: any) => String(a.AreaCode || a.areaCode || "").trim().toLowerCase())
          );
          setAllowedAreaCodes(areaCodes);
        }
      } catch (err) {
        console.error("Error fetching scope areas:", err);
      } finally {
        if (active) setScopeLoading(false);
      }
    };

    fetchScopeAreas();
    return () => {
      active = false;
    };
  }, [level, lockedRegionCode, lockedProvinceCode]);

  const printRef = useRef<HTMLDivElement>(null);

  const maroon = "text-[#7A0000]";
  const maroonBg = "bg-[#7A0000]";
  const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";

  const handleViewReport = async () => {
    if (!fromDate || !toDate) {
      setError("Please select both From Date and To Date.");
      return;
    }
    
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const payload = {
        FromDate: fromDate,
        ToDate: toDate,
        ReportType: reportType
      };

      const response = await fetch("/misapi/api/collection/headofficepos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const payload_response = await response.json();

      if (!response.ok || payload_response?.errorMessage) {
        throw new Error(payload_response?.errorMessage || "Failed to fetch report data");
      }

      const backendData = payload_response?.data;
      if (!backendData) {
        throw new Error("No data returned from server");
      }

      let filteredData = backendData;

      if (level < 60 && locked["Area"]?.code) {
        const targetArea = locked["Area"].code.trim().toLowerCase();
        filteredData = backendData.filter((r: any) => {
          const code = (r.AreaCode || r.areaCode || "").trim().toLowerCase();
          return code === targetArea;
        });
      } else if ((level === 60 || level === 70) && allowedAreaCodes) {
        filteredData = backendData.filter((r: any) => {
          const code = (r.AreaCode || r.areaCode || "").trim().toLowerCase();
          return allowedAreaCodes.has(code);
        });
      }

      setResults(filteredData);
    } catch (err: any) {
      setError(err.message || "Failed to fetch report");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open("", "_blank", "width=1200,height=800");
    if (!printWindow) return;

    const tableEl = printRef.current.querySelector("table");
    const tableHTML = tableEl ? tableEl.outerHTML : printRef.current.innerHTML;

    printWindow.document.write(`
      <html>
        <head>
          <title>Head Office POS Collection</title>
          <style>
            body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { padding: 6px 8px; border: 1px solid #d1d5db; text-align: left; }
            th { background-color: #f0f0f0; font-weight: bold; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .header { font-weight: bold; margin-bottom: 5px; color: #7A0000; font-size: 16px; }
            .subheader { margin-bottom: 12px; font-size: 12px; }
            @page {
              margin-bottom: 18mm;
              @bottom-left {
                content: "Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()} | Reporting@2026";
                font-size: 9px;
                color: #666;
                font-family: Arial;
              }
              @bottom-right {
                content: "Page " counter(page) " of " counter(pages);
                font-size: 9px;
                color: #666;
                font-family: Arial;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">Head Office POS Collection (${reportType})</div>
          <div class="subheader">
            From: <b>${fromDate}</b> &nbsp;&nbsp;&nbsp; To: <b>${toDate}</b>
          </div>
          ${tableHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const downloadCSV = () => {
    if (!results || results.length === 0) return;

    const rows: string[] = [];
    rows.push(`Head Office POS Collection (${reportType})`);
    rows.push(`From Date: ${fromDate}`);
    rows.push(`To Date: ${toDate}`);
    rows.push("");
    rows.push("Area Code,Area Name,No of Customers,Amount");

    let totalCount = 0;
    let totalAmt = 0;

    results.forEach((r) => {
      const areaName = r.AreaName || r.areaName || "";
      const areaCode = r.AreaCode || r.areaCode || "";
      const count = r.Count ?? r.count ?? 0;
      const sumTransAmt = r.SumTransAmt ?? r.sumTransAmt ?? 0;

      totalCount += count;
      totalAmt += sumTransAmt;
      rows.push(`${areaCode},"${areaName}",${count},"${sumTransAmt.toFixed(2)}"`);
    });

    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `HeadOfficePOSCollection_${reportType}_${fromDate}.csv`;
    a.click();
  };

  return (
    <div className="max-w-7xl mx-auto p-4 bg-white rounded-xl shadow border border-gray-200 text-sm font-sans max-h-[82vh] overflow-y-auto">
      {!results && (
        <>
          <h2 className={`text-xl font-bold mb-6 ${maroon}`}>
            Head Office POS Collection
          </h2>

          {/* Scope Status Banner */}
          {level < 80 && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-xs flex justify-between items-center">
              <span>
                <strong>Access Level Scoped:</strong> Viewing data restricted to{" "}
                {level === 70
                  ? `Region: ${user?.RegionCode || "N/A"}`
                  : level === 60
                  ? `Province: ${user?.ProvinceName || user?.ProvinceCode || "N/A"}`
                  : `Area: ${user?.AreaName || user?.AreaCode || "N/A"}`}
              </span>
              {scopeLoading && <span className="animate-pulse">Loading boundary data...</span>}
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-xs">{error}</p>
            </div>
          )}

      <div className="border border-gray-200 rounded-xl p-4 bg-white shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
          <div className="flex flex-col">
            <label className={`${maroon} text-xs font-medium mb-1`}>
              Report Type:
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent bg-white text-gray-800"
              disabled={loading}
            >
              <option value="Bulk">Bulk</option>
              <option value="Ordinary">Ordinary</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label className={`${maroon} text-xs font-medium mb-1`}>
              From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent bg-white text-gray-800"
              disabled={loading}
            />
          </div>

          <div className="flex flex-col">
            <label className={`${maroon} text-xs font-medium mb-1`}>
              To Date
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent bg-white text-gray-800"
              disabled={loading}
            />
          </div>
        </div>

        <div className="w-full mt-6 flex justify-end">
          <button 
            onClick={handleViewReport}
            disabled={loading || scopeLoading}
            className={`px-6 py-2 rounded-md font-medium transition-opacity duration-300 shadow ${maroonGrad} text-white ${(loading || scopeLoading) ? 'opacity-70 cursor-not-allowed' : 'hover:opacity-90'}`}
          >
            {loading ? "Loading..." : scopeLoading ? "Preparing Access..." : "View Report"}
          </button>
        </div>
      </div>
        </>
      )}

      {results && (
        <div ref={printRef} className="mt-4 p-4 rounded-xl shadow border border-gray-200 w-full bg-white">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className={`text-xl font-bold ${maroon} mb-2`}>	Head Office POS Payments</h2>
              <div className="text-sm text-gray-700 font-medium">
                Type: {reportType} | Date: {fromDate} to {toDate}
              </div>
            </div>
            <div className="flex gap-2 print:hidden">
              <button
                onClick={downloadCSV}
                className="flex items-center gap-1 px-3 py-1.5 border border-blue-400 text-blue-700 bg-white rounded-md text-xs font-medium shadow-sm hover:bg-blue-50 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-200 transition"
              >
                <FaFileDownload className="w-3 h-3" /> CSV
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-1 px-3 py-1.5 border border-green-400 text-green-700 bg-white rounded-md text-xs font-medium shadow-sm hover:bg-green-50 hover:text-green-800 focus:outline-none focus:ring-2 focus:ring-green-200 transition"
              >
                <FaPrint className="w-3 h-3" /> PDF
              </button>
              <button
                onClick={() => setResults(null)}
                className="px-4 py-1.5 bg-[#7A0000] hover:bg-[#A52A2A] text-xs rounded-md text-white flex items-center"
              >
                Back to Form
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-[#7A0000]">
                <tr className={`${maroonBg} text-white`}>
                  <th className="p-2 text-left font-semibold border-b border-gray-100">Area Code</th>
                  <th className="p-2 text-left font-semibold border-b border-gray-100">Area Name</th>
                  <th className="p-2 text-right font-semibold border-b border-gray-100">No of Customers</th>
                  <th className="p-2 text-right font-semibold border-b border-gray-100">Amount</th>
                </tr>
              </thead>
              <tbody>
                {results.length > 0 ? (
                  results.map((r, idx) => {
                    const areaName = r.AreaName || r.areaName || "";
                    const areaCode = r.AreaCode || r.areaCode || "";
                    const count = r.Count ?? r.count ?? 0;
                    const sumTransAmt = r.SumTransAmt ?? r.sumTransAmt ?? 0;
                    
                    return (
                      <tr key={`${areaCode}-${idx}`} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="p-2 border-b border-gray-100">{areaCode}</td>
                        <td className="p-2 border-b border-gray-100">{areaName}</td>
                        <td className="p-2 text-right border-b border-gray-100">{count}</td>
                        <td className="p-2 text-right font-semibold border-b border-gray-100">
                          {sumTransAmt.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-gray-500">
                      No records found for the selected criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-3 text-xs text-gray-600 print:hidden">{new Date().toLocaleString()}</div>
        </div>
      )}
    </div>
  );
};

export default HeadOfficePOSCollection;
