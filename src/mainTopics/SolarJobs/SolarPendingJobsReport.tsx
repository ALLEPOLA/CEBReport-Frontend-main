import React, { useEffect, useState, useRef } from "react";
import { Search, RotateCcw, Eye } from "lucide-react";
import { useUser } from "../../contexts/UserContext";
import { toast } from "react-toastify";
import DateRangePicker from "../../components/utils/DateRangePicker";
import ReportViewer from "../../components/utils/ReportViewer";

interface Province {
  ProvinceId: string;
  ProvinceName: string;
}

interface SolarPendingRow {
  ApplicationId: string;
  ApplicationNo: string;
  SubmitDate: string | null;
  ProjectNo: string;
  PivDate: string | null;
  ApplicationSubType: string;
  PaidDate: string | null;
  Piv2PaidDate: string | null;
  ExistingAccNo: string;
  Status: string;
  DeptId: string;
  CctName: string;
  ProvinceName: string;
}

const formatLocalYmd = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const today = new Date();
const defaultFromDate = formatLocalYmd(new Date(today.getFullYear(), today.getMonth(), 1));
const defaultToDate = formatLocalYmd(today);

const formatDate = (date: string | null): string => {
  if (!date) return "";
  const dateObj = new Date(date);
  if (Number.isNaN(dateObj.getTime())) return date;
  return dateObj.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

const csvEscape = (val: string | number | null | undefined): string => {
  if (val == null) return '""';
  const str = String(val);
  if (/[,\n"']/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
};

const columns = [
  "Dept_id",
  "Application No",
  "App Submit_Date",
  "PIV1 Issued Date",
  "PIV1 Paid Date",
  "Estimate No",
  "PIV2 Paid Date",
  "Project No",
  "Status",
  "Application Sub Type",
  "Existing Account No"
];

const SolarPendingJobsReport: React.FC = () => {
  const { user } = useUser();
  const epfNo = user?.Userno || "";
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Province list state
  const [data, setData] = useState<Province[]>([]);
  const [filtered, setFiltered] = useState<Province[]>([]);
  const [searchId, setSearchId] = useState("");
  const [searchName, setSearchName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 9;

  // Date range
  const [fromDate, setFromDate] = useState(defaultFromDate);
  const [toDate, setToDate] = useState(defaultToDate);

  // Report modal state
  const [selectedProvince, setSelectedProvince] = useState<Province | null>(null);
  const [reportData, setReportData] = useState<SolarPendingRow[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const maroon = "text-[#7A0000]";
  const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";
  const shadedMaroon = "bg-[#A52A2A]/40";

  // Load provinces (Usercompanies)
  useEffect(() => {
    const run = async () => {
      if (!epfNo) {
        setError("No EPF number available. Please login again.");
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/misapi/api/incomeexpenditure/Usercompanies/${encodeURIComponent(epfNo)}/60`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const parsed = await res.json();
        let raw: any[] = [];
        if (Array.isArray(parsed)) raw = parsed;
        else if (parsed.data) raw = parsed.data;
        else if (parsed.result) raw = parsed.result;

        const final: Province[] = (raw || [])
          .map((it: any) => ({
            ProvinceId: (it.CompId ?? it.compId ?? "").toString().trim(),
            ProvinceName: (it.CompNm ?? it.CompName ?? "").toString().trim(),
          }))
          .filter((p) => p.ProvinceId !== "");

        setData(final);
        setFiltered(final);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [epfNo]);

  // Filter provinces
  useEffect(() => {
    const f = data.filter(
      (d) =>
        (!searchId || d.ProvinceId.toLowerCase().includes(searchId.toLowerCase())) &&
        (!searchName || d.ProvinceName.toLowerCase().includes(searchName.toLowerCase()))
    );
    setFiltered(f);
    setPage(1);
  }, [searchId, searchName, data]);

  // View Report (JSON data API)
  const handleViewReport = async (prov: Province) => {
    if (!fromDate || !toDate) {
      toast.error("Please select a valid date range before viewing.");
      return;
    }

    setSelectedProvince(prov);
    setReportLoading(true);
    setReportData([]);
    setShowReport(true);

    try {
      const params = new URLSearchParams({
        fromDate: fromDate,
        toDate: toDate,
        provinceId: prov.ProvinceId,
      });
      const url = `/misapi/api/solarjobs/pending-jobs/list?${params.toString()}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();
      const items: SolarPendingRow[] = Array.isArray(json)
        ? json
        : json.data || [];

      if (json.errorMessage) {
        throw new Error(json.errorMessage);
      }

      setReportData(items);
      items.length === 0
        ? toast.warn("No records found")
        : toast.success("Report loaded successfully");
    } catch (err: any) {
      toast.error("Failed to load report: " + (err.message || "Unknown error"));
      setShowReport(false);
    } finally {
      setReportLoading(false);
    }
  };

  const closeReport = () => {
    setShowReport(false);
    setReportData([]);
    setSelectedProvince(null);
  };

  const handleDownloadCSV = () => {
    if (reportData.length === 0 || !selectedProvince) return;

    const provLabel = `${selectedProvince.ProvinceId} / ${selectedProvince.ProvinceName}`;

    const csvRows: string[] = [
      `Solar Retail Rooftop Pending Jobs after PIV2 Paid- From ${fromDate} To ${toDate}`,
      `Province : ${provLabel}`,
      "",
      columns.map(csvEscape).join(",")
    ];

    reportData.forEach((item) => {
      const cctInfo = item.DeptId ? (item.CctName ? `${item.DeptId} - ${item.CctName}` : item.DeptId) : "";
      const row = [
        `="${cctInfo}"`,
        `="${item.ApplicationNo ?? ""}"`,
        formatDate(item.SubmitDate),
        formatDate(item.PivDate),
        formatDate(item.PaidDate),
        `="${item.ApplicationId ?? ""}"`,
        formatDate(item.Piv2PaidDate),
        `="${item.ProjectNo ?? ""}"`,
        item.Status || "",
        item.ApplicationSubType || "",
        `="${item.ExistingAccNo ?? ""}"`
      ];
      csvRows.push(row.map(csvEscape).join(","));
    });

    const csvContent = csvRows.join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Solar_Pending_Jobs_${selectedProvince.ProvinceId}_${fromDate}_to_${toDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const printPDF = () => {
    if (reportData.length === 0 || !iframeRef.current || !selectedProvince) return;

    const provLabel = `${selectedProvince.ProvinceId} / ${selectedProvince.ProvinceName}`;

    const tableStyle = `
        table { width: 100%; border-collapse: collapse; table-layout: auto; font-size: 10px; }
        th, td { border: 1px solid #000; padding: 5px; word-wrap: break-word; vertical-align: middle; }
        th { font-weight: bold; background-color: #f0f0f0; text-align: center; }
        td { text-align: left; }
        `;

    let html = `
        <html><head><title>Solar Retail Rooftop Pending Jobs after PIV2 Paid</title>
        <style>${tableStyle}</style></head>
        <body>
        <h2 style="text-align: center; text-decoration: underline; margin-bottom: 4px;">Solar Retail Rooftop Pending Jobs after PIV2 Paid- From ${fromDate} To ${toDate}</h2>
        <p style="text-align: center; font-weight: bold; margin-top: 0; margin-bottom: 12px;">Province : ${provLabel}</p>
        <table>
        <thead><tr>
        ${columns.map((c) => `<th>${c}</th>`).join("")}
        </tr></thead>
        <tbody>
        `;

    reportData.forEach((item) => {
      const cctInfo = item.DeptId ? (item.CctName ? `${item.DeptId} - ${item.CctName}` : item.DeptId) : "";
      html += `<tr>
                <td>${escapeHtml(cctInfo)}</td>
                <td>${escapeHtml(item.ApplicationNo)}</td>
                <td>${formatDate(item.SubmitDate)}</td>
                <td>${formatDate(item.PivDate)}</td>
                <td>${formatDate(item.PaidDate)}</td>
                <td>${escapeHtml(item.ApplicationId)}</td>
                <td>${formatDate(item.Piv2PaidDate)}</td>
                <td>${escapeHtml(item.ProjectNo)}</td>
                <td>${escapeHtml(item.Status)}</td>
                <td>${escapeHtml(item.ApplicationSubType)}</td>
                <td>${escapeHtml(item.ExistingAccNo)}</td>
            </tr>`;
    });

    html += "</tbody></table></body></html>";

    const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();

      setTimeout(() => {
        iframeRef.current?.contentWindow?.focus();
        iframeRef.current?.contentWindow?.print();
      }, 500);
    }
  };

  const escapeHtml = (text: string | null | undefined): string => {
    if (text == null) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  };

  const paginatedProvinces = filtered.slice((page - 1) * pageSize, page * pageSize);

  const provHeader = selectedProvince
    ? `${selectedProvince.ProvinceId} / ${selectedProvince.ProvinceName}`
    : "";

  return (
    <div className="w-full p-6 bg-white rounded-xl shadow border border-gray-200 text-sm font-sans relative">
      <iframe ref={iframeRef} style={{ display: "none" }} title="print-frame" />

      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h2 className={`text-xl font-bold ${maroon}`}>
          Solar Retail Rooftop Pending Jobs after PIV2 Paid
        </h2>
      </div>

      {/* Filter and Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        {/* Date Range Picker */}
        <DateRangePicker
          fromDate={fromDate}
          toDate={toDate}
          onFromChange={setFromDate}
          onToChange={setToDate}
        />

        {/* Search Inputs */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={searchId}
              placeholder="Search by ID"
              onChange={(e) => setSearchId(e.target.value)}
              className="pl-10 pr-4 py-1.5 w-44 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#7A0000] transition text-sm"
              autoComplete="off"
            />
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={searchName}
              placeholder="Search by Name"
              onChange={(e) => setSearchName(e.target.value)}
              className="pl-10 pr-4 py-1.5 w-44 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#7A0000] transition text-sm"
              autoComplete="off"
            />
          </div>

          {(searchId || searchName) && (
            <button
              onClick={() => {
                setSearchId("");
                setSearchName("");
              }}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-gray-100 hover:bg-gray-200 rounded border text-xs font-medium"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Provinces list */}
      {loading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7A0000] mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading provinces...</p>
        </div>
      )}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          Error: {error}
        </div>
      )}
      {!loading && !error && filtered.length === 0 && (
        <div className="text-gray-600 bg-gray-100 p-4 rounded">No provinces found.</div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <div className="max-h-[50vh] overflow-y-auto">
              <table className="w-full table-fixed text-left text-gray-700 text-sm">
                <thead className={`${maroonGrad} text-white sticky top-0`}>
                  <tr>
                    <th className="px-4 py-2 w-1/4">Province Code</th>
                    <th className="px-4 py-2 w-1/2">Province Name</th>
                    <th className="px-4 py-2 w-1/4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedProvinces.map((d, i) => (
                    <tr
                      key={`${d.ProvinceId}-${i}`}
                      className={`${i % 2 ? "bg-white" : "bg-gray-50"} ${
                        selectedProvince?.ProvinceId === d.ProvinceId ? "ring-2 ring-[#7A0000] ring-inset" : ""
                      }`}
                    >
                      <td className="px-4 py-2 truncate font-mono">{d.ProvinceId}</td>
                      <td className="px-4 py-2 truncate">{d.ProvinceName}</td>
                      <td className="px-4 py-2 text-center">
                        <button
                          onClick={() => handleViewReport(d)}
                          disabled={!(fromDate && toDate)}
                          className={`px-3 py-1 rounded-md text-xs font-medium shadow transition-all flex items-center justify-center mx-auto gap-1 ${
                            fromDate && toDate
                              ? `${maroonGrad} text-white hover:brightness-110`
                              : `${shadedMaroon} text-white cursor-not-allowed`
                          }`}
                        >
                          <Eye className="w-3 h-3" />
                          {selectedProvince?.ProvinceId === d.ProvinceId ? "Viewing" : "View"}
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
            <span className="text-xs text-gray-500">
              Page {page} of {Math.ceil(filtered.length / pageSize) || 1}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(Math.ceil(filtered.length / pageSize), p + 1))}
              disabled={page >= Math.ceil(filtered.length / pageSize) || filtered.length === 0}
              className="px-3 py-1 border rounded bg-white text-gray-600 text-xs hover:bg-gray-100 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </>
      )}

      {/* Report Viewer Modal */}
      {showReport && selectedProvince && (
        <ReportViewer
          title={`Solar Retail Rooftop Pending Jobs after PIV2 Paid- From ${fromDate} To ${toDate}`}
          subtitlebold="Province :"
          subtitlenormal={provHeader}
          loading={reportLoading}
          hasData={reportData.length > 0}
          handleDownloadCSV={handleDownloadCSV}
          printPDF={printPDF}
          closeReport={closeReport}
          currency=""
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs whitespace-nowrap min-w-max border border-gray-300">
              <thead className="bg-[#f0f0f0] sticky top-0 z-10">
                <tr className="text-gray-900 font-bold text-[11px]">
                  {columns.map((c, i) => (
                    <th key={i} className="p-2 border border-gray-300 text-center">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white">
                {reportData.map((item, idx) => {
                  const cctInfo = item.DeptId ? (item.CctName ? `${item.DeptId} - ${item.CctName}` : item.DeptId) : "";
                  return (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="p-2 border border-gray-300 whitespace-nowrap">{cctInfo}</td>
                      <td className="p-2 border border-gray-300 whitespace-nowrap">{item.ApplicationNo}</td>
                      <td className="p-2 border border-gray-300 whitespace-nowrap">{formatDate(item.SubmitDate)}</td>
                      <td className="p-2 border border-gray-300 whitespace-nowrap">{formatDate(item.PivDate)}</td>
                      <td className="p-2 border border-gray-300 whitespace-nowrap">{formatDate(item.PaidDate)}</td>
                      <td className="p-2 border border-gray-300 whitespace-nowrap">{item.ApplicationId}</td>
                      <td className="p-2 border border-gray-300 whitespace-nowrap">{formatDate(item.Piv2PaidDate)}</td>
                      <td className="p-2 border border-gray-300 whitespace-nowrap">{item.ProjectNo}</td>
                      <td className="p-2 border border-gray-300 whitespace-nowrap">{item.Status}</td>
                      <td className="p-2 border border-gray-300 whitespace-nowrap">{item.ApplicationSubType}</td>
                      <td className="p-2 border border-gray-300 whitespace-nowrap">{item.ExistingAccNo}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ReportViewer>
      )}
    </div>
  );
};

export default SolarPendingJobsReport;
