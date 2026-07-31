import React, { useState, useCallback } from "react";
import { Eye } from "lucide-react";

interface MaterialMasterRow {
  matCd: string;
  matNm: string;
  majUom: string;
  unitPrice: string;
  status: string;
}

async function apiFetch<T>(
  url: string
): Promise<{ data: T | null; errorMessage: string | null }> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      if (res.status === 404)
        throw new Error("API endpoint not found (404). Please check if the backend is running.");
      if (res.status === 500)
        throw new Error("Database error (500). Please check your database connection.");
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json"))
      throw new Error(`Expected JSON but got ${contentType}`);
    const json = await res.json();

    return {
      data: json,
      errorMessage: null,
    };
  } catch (err: any) {
    if (err.name === "AbortError")
      return { data: null, errorMessage: "Request timeout. Please check your connection." };
    if (err.message.includes("Failed to fetch"))
      return {
        data: null,
        errorMessage: "Cannot connect to server. Please ensure the backend is running on port 44381.",
      };
    return { data: null, errorMessage: err.message };
  }
}

const parseNumber = (value: any): number => {
  if (value === undefined || value === null || value === "") return 0;
  if (typeof value === "number") return value;
  const num = parseFloat(String(value).replace(/,/g, ""));
  return isNaN(num) ? 0 : num;
};

const MaterialMasterAI: React.FC = () => {
  const maroon = "text-[#7A0000]";
  const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";

  const [matCodeInput, setMatCodeInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<number | null>(null); // null = Both, 2 = Active, 3 = Inactive
  const [searchedMatCode, setSearchedMatCode] = useState("");
  const [searchedStatus, setSearchedStatus] = useState<string>("");

  const [loadingReport, setLoadingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const [reportData, setReportData] = useState<MaterialMasterRow[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const inputCls =
    "w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent";

  // ── Fetch report ────────────────────────────────────────────────────────────
  const fetchReport = useCallback(async () => {
    const matCodeSnapshot = matCodeInput.trim();
    const statusSnapshot = statusFilter;

    setLoadingReport(true);
    setReportError(null);

    try {
      // Build query parameters
      const params = new URLSearchParams();
      if (matCodeSnapshot) {
        params.append("matCode", matCodeSnapshot);
      }
      if (statusSnapshot !== null) {
        params.append("status", statusSnapshot.toString());
      }

      const queryString = params.toString();
      const url = `/misapi/api/materialmaster/report${queryString ? `?${queryString}` : ""}`;

      const reportResponse = await apiFetch<any>(url);

      if (reportResponse.errorMessage) {
        setReportError(reportResponse.errorMessage);
        return;
      }

      const raw = reportResponse.data as any;

      const rows = raw?.data ?? [];

      if (!rows || rows.length === 0) {
        let errorMsg = "No material master data available.";
        if (matCodeSnapshot && statusSnapshot !== null) {
          const statusLabel = statusSnapshot === 2 ? "Active" : "Inactive";
          errorMsg = `No ${statusLabel} materials found matching "${matCodeSnapshot}".`;
        } else if (matCodeSnapshot) {
          errorMsg = `No materials found matching "${matCodeSnapshot}".`;
        } else if (statusSnapshot !== null) {
          const statusLabel = statusSnapshot === 2 ? "Active" : "Inactive";
          errorMsg = `No ${statusLabel} materials available.`;
        }
        setReportError(errorMsg);
        return;
      }

      const mappedRows: MaterialMasterRow[] = rows.map((item: any) => ({
        matCd: String(item.MatCd ?? item.matCd ?? ""),
        matNm: String(item.MatNm ?? item.matNm ?? ""),
        majUom: String(item.MajUom ?? item.majUom ?? ""),
        unitPrice: String(item.UnitPrice ?? item.unitPrice ?? "0.00"),
        status: String(item.Status ?? item.status ?? ""),
      }));

      setReportData(mappedRows);
      setSearchedMatCode(raw.summary?.matCode ?? matCodeSnapshot ?? "(all)");
      setSearchedStatus(raw.summary?.status ?? "Both");

      setHasSearched(true);
    } catch (err: any) {
      setReportError(err.message || "Failed to fetch report data. Please try again.");
    } finally {
      setLoadingReport(false);
    }
  }, [matCodeInput, statusFilter]);

  const handleBackToForm = () => {
    setHasSearched(false);
    setReportData([]);
    setReportError(null);
  };

  const statusBadgeCls = (status: string) => {
    const s = status.toLowerCase();
    if (s === "active")
      return "inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700";
    if (s === "inactive")
      return "inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-200 text-gray-600";
    return "inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-yellow-100 text-yellow-700";
  };

  // ── Export helpers ─────────────────────────────────────────────────────────
  const escapeCsv = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const handleExportCsv = () => {
    if (!reportData.length) { setReportError("No data to export."); return; }

    const metaRows: (string | number)[][] = [
      ["Material Master Report"],
      ["Material Code Filter :", searchedMatCode || "(all)"],
      ["Status Filter :", searchedStatus],
      [],
    ];

    const header = ["Material Code", "Material Name", "UOM", "Unit Price", "Status"];
    const rows = reportData.map((r) => [`="${r.matCd}"`, r.matNm, r.majUom, r.unitPrice, r.status]);

    const csv = [...metaRows, header, ...rows]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\r\n");

    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    link.download = `MaterialMaster_${searchedMatCode || "all"}_${searchedStatus}.csv`;
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 bg-white rounded-lg shadow-md">

      {/* ── FORM ──────────────────────────────────────────────────────────── */}
      {!hasSearched && (
        <>
          <div className="mb-6">
            <h2 className={`text-xl font-bold ${maroon}`}>
              Material Master – Active and Inactive
            </h2>
          </div>

          <div className="space-y-4">

            {/* Row 1 – Material Code */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col">
                <label className={`text-xs font-medium mb-1 ${maroon}`}>
                  Material Code:
                </label>
                <input
                  type="text"
                  value={matCodeInput}
                  onChange={(e) => {
                    setMatCodeInput(e.target.value);
                    setReportError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !loadingReport) fetchReport();
                  }}
                  placeholder="Leave blank for all materials"
                  className={inputCls}
                />
              </div>

              {/* Status Dropdown */}
              <div className="flex flex-col">
                <label className={`text-xs font-medium mb-1 ${maroon}`}>
                  Status:
                </label>
                <select
                  value={statusFilter === null ? "" : statusFilter.toString()}
                  onChange={(e) => {
                    const value = e.target.value;
                    setStatusFilter(value === "" ? null : parseInt(value, 10));
                    setReportError(null);
                  }}
                  className={inputCls}
                >
                  <option value="">Both (Active & Inactive)</option>
                  <option value="2">Active</option>
                  <option value="3">Inactive</option>
                </select>
              </div>
            </div>

            {/* Submit */}
            <div className="w-full mt-6 flex justify-end">
              <button
                onClick={fetchReport}
                disabled={loadingReport}
                className={`px-6 py-2 rounded-md font-medium transition-opacity duration-300 shadow
    ${maroonGrad} text-white
    ${loadingReport
                    ? "opacity-70 cursor-not-allowed"
                    : "hover:opacity-90"
                  }`}
              >
                {loadingReport ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="animate-spin h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Loading...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    View
                  </span>
                )}
              </button>
            </div>
          </div>

          {reportError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {reportError}
            </div>
          )}
        </>
      )}

      {/* ── REPORT ────────────────────────────────────────────────────────── */}
      {hasSearched && (
        <div className="mt-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
            <div>
              <h2 className={`text-lg md:text-xl font-bold ${maroon}`}>
                Material Master – Active and Inactive
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Material Code Filter: <strong>{searchedMatCode || "(all)"}</strong>
              </p>
              <p className="text-sm text-gray-600">
                Status Filter: <strong>{searchedStatus}</strong>
              </p>
            </div>

            <div className="flex space-x-2 mt-2 md:mt-0">
              {/* CSV */}
              <button
                onClick={handleExportCsv}
                disabled={!reportData.length}
                className={`flex items-center gap-1 px-3 py-1.5 border border-blue-400 rounded-md text-xs font-medium shadow-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-200 transition
                  ${!reportData.length
                    ? "text-blue-300 bg-gray-50 cursor-not-allowed"
                    : "text-blue-700 bg-white hover:bg-blue-50 hover:text-blue-800"}`}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5l2 2h5a2 2 0 012 2v12a2 2 0 01-2 2z" />
                </svg>
                CSV
              </button>

              {/* Back */}
              <button
                onClick={handleBackToForm}
                className="px-4 py-1.5 bg-[#7A0000] hover:bg-[#A52A2A] text-xs rounded-md text-white flex items-center"
              >
                Back to Form
              </button>
            </div>
          </div>

          {/* Report Table - Scrollable container */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto max-h-[calc(100vh-300px)] overflow-y-auto">
              <div className="min-w-full">
                <table className="w-full text-xs border-collapse">
                  <thead className={`${maroonGrad} text-white sticky top-0 z-10`}>
                    <tr>
                      <th className="px-4 py-2 border border-gray-300 text-center font-bold whitespace-nowrap">
                        Material Code
                      </th>
                      <th className="px-4 py-2 border border-gray-300 text-left font-bold whitespace-nowrap">
                        Material Name
                      </th>
                      <th className="px-4 py-2 border border-gray-300 text-center font-bold whitespace-nowrap">
                        UOM
                      </th>
                      <th className="px-4 py-2 border border-gray-300 text-right font-bold whitespace-nowrap">
                        Unit Price
                      </th>
                      <th className="px-4 py-2 border border-gray-300 text-center font-bold whitespace-nowrap">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((r, i) => (
                      <tr
                        key={`${r.matCd}-${i}`}
                        className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}
                      >
                        <td className="px-4 py-2 border-l border-r border-gray-300 text-center font-mono whitespace-nowrap">
                          {r.matCd}
                        </td>
                        <td className="px-4 py-2 border-r border-gray-300">
                          {r.matNm}
                        </td>
                        <td className="px-4 py-2 border-r border-gray-300 text-center whitespace-nowrap">
                          {r.majUom}
                        </td>
                        <td className="px-4 py-2 border-r border-gray-300 text-right font-mono whitespace-nowrap">
                          {parseNumber(r.unitPrice).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-2 border-r border-gray-300 text-center whitespace-nowrap">
                          <span className={statusBadgeCls(r.status)}>{r.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {reportData.length > 0 && (
                  <p className="text-xs text-gray-500 py-2 text-right px-4">
                    Total records: {reportData.length.toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </div>

          {reportError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {reportError}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MaterialMasterAI;