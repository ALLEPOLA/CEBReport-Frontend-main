import React, { useState, useRef, useEffect } from "react";
import { toast } from "react-toastify";
import { Eye, Search, RotateCcw } from "lucide-react";
import DateRangePicker from "../../components/utils/DateRangePicker";
import ReportViewer from "../../components/utils/ReportViewer";
import { useUser } from "../../contexts/UserContext";

interface CostCenter {
  CostCenterId: string;
  CostCenterName: string;
}

interface CcApplicationRow {
  ApplicationId: string;
  ApplicationNo: string;
  SubmitDate: string | null;
  ApprovedDate: string | null;
  ProjectNo: string;
  PivDate: string | null;
  ApplicationSubType: string;
  PaidDate: string | null;
  Piv2PaidDate: string | null;
  EnergizedDate: string | null;
  ExistingAccNo: string;
  CctName: string;
}

const today = new Date();
const formatLocalYmd = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

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

const buildApiUrl = (fromDate: string, toDate: string, costctr: string) => {
  const params = new URLSearchParams({
    fromDate,
    toDate,
    costctr,
  });
  return `/misapi/api/solarjobs/ccapplication/list?${params.toString()}`;
};

const columns = [
  "Application No",
  "App Submit_Date",
  "PIV1 Issued Date",
  "PIV1 Paid Date",
  "Estimate No",
  "Estimate App. Date",
  "PIV2 Paid Date",
  "Project No",
  "Engized Date",
  "Application Sub Type",
  "Existing Account No"
];

const CcApplicationProgress: React.FC = () => {
  const { user } = useUser();
  const epfNo = user?.Userno || "";
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Date state
  const [fromDate, setFromDate] = useState(defaultFromDate);
  const [toDate, setToDate] = useState(defaultToDate);

  // Cost centers state
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [filteredCostCenters, setFilteredCostCenters] = useState<CostCenter[]>([]);
  const [searchId, setSearchId] = useState("");
  const [searchName, setSearchName] = useState("");
  const [loadingCostCenters, setLoadingCostCenters] = useState(true);
  const [costCentersError, setCostCentersError] = useState<string | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const pageSize = 9;

  // Selected cost center & report state
  const [selectedCostCenter, setSelectedCostCenter] = useState<CostCenter | null>(null);
  const [reportData, setReportData] = useState<CcApplicationRow[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const maroon = "text-[#7A0000]";
  const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";

  // Fetch cost centers for logged-in user
  useEffect(() => {
    const fetchCostCenters = async () => {
      if (!epfNo) {
        setCostCentersError("No EPF number available. Please login again.");
        setLoadingCostCenters(false);
        return;
      }

      setLoadingCostCenters(true);
      setCostCentersError(null);
      try {
        const res = await fetch(`/misapi/api/incomeexpenditure/departments/${epfNo}`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

        const parsed = await res.json();
        let rawData = [];
        if (Array.isArray(parsed)) {
          rawData = parsed;
        } else if (parsed.data && Array.isArray(parsed.data)) {
          rawData = parsed.data;
        } else if (parsed.result && Array.isArray(parsed.result)) {
          rawData = parsed.result;
        } else if (parsed.departments && Array.isArray(parsed.departments)) {
          rawData = parsed.departments;
        }

        const final: CostCenter[] = rawData.map((item: any) => ({
          CostCenterId: item.DeptId?.toString() || item.deptId?.toString() || item.CostCenterId?.toString() || "",
          CostCenterName: item.DeptName?.toString().trim() || item.deptName?.toString().trim() || item.CostCenterName?.toString().trim() || "",
        }));

        setCostCenters(final);
        setFilteredCostCenters(final);
      } catch (err: any) {
        setCostCentersError(err.message);
      } finally {
        setLoadingCostCenters(false);
      }
    };

    fetchCostCenters();
  }, [epfNo]);

  // Filter cost centers
  useEffect(() => {
    const f = costCenters.filter(
      (c) =>
        (!searchId || c.CostCenterId.toLowerCase().includes(searchId.toLowerCase())) &&
        (!searchName || c.CostCenterName.toLowerCase().includes(searchName.toLowerCase()))
    );
    setFilteredCostCenters(f);
    setPage(1);
  }, [searchId, searchName, costCenters]);

  const paginatedCostCenters = filteredCostCenters.slice((page - 1) * pageSize, page * pageSize);

  const clearFilters = () => {
    setSearchId("");
    setSearchName("");
  };

  // Handle clicking "View" button for a Cost Center
  const handleSelectAndFetch = async (costCenter: CostCenter) => {
    if (!fromDate || !toDate) {
      toast.error("Please select Date Range");
      return;
    }

    if (new Date(toDate) < new Date(fromDate)) {
      toast.error("To Date cannot be earlier than From Date");
      return;
    }

    setSelectedCostCenter(costCenter);
    setReportLoading(true);
    setReportData([]);
    setShowReport(true);

    try {
      const url = buildApiUrl(fromDate, toDate, costCenter.CostCenterId.trim());
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const items: CcApplicationRow[] = Array.isArray(data)
        ? data
        : data.data || [];

      if (data.errorMessage) {
        throw new Error(data.errorMessage);
      }

      setReportData(items);
      items.length === 0
        ? toast.warn("No records found")
        : toast.success("Report loaded successfully");
    } catch (err: any) {
      toast.error("Failed to load report: " + err.message);
      setShowReport(false);
    } finally {
      setReportLoading(false);
    }
  };

  const closeReport = () => {
    setShowReport(false);
    setReportData([]);
    setSelectedCostCenter(null);
  };

  const handleDownloadCSV = () => {
    if (reportData.length === 0 || !selectedCostCenter) return;

    const cctName = selectedCostCenter.CostCenterName || reportData[0]?.CctName || "";
    const cctLabel = cctName ? ` / ${cctName}` : "";

    const csvRows: string[] = [
      `Solar Retail Roof-top Job Progress- From ${fromDate} To ${toDate}`,
      `Cost Centre : ${selectedCostCenter.CostCenterId}${cctLabel}`,
      "",
      columns.map(csvEscape).join(",")
    ];

    reportData.forEach((item) => {
      const row = [
        `="${item.ApplicationNo ?? ""}"`,
        formatDate(item.SubmitDate),
        formatDate(item.PivDate),
        formatDate(item.PaidDate),
        `="${item.ApplicationId ?? ""}"`,
        formatDate(item.ApprovedDate),
        formatDate(item.Piv2PaidDate),
        `="${item.ProjectNo ?? ""}"`,
        formatDate(item.EnergizedDate),
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
    link.download = `Cc_Application_Progress_${selectedCostCenter.CostCenterId}_${fromDate}_to_${toDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const printPDF = () => {
    if (reportData.length === 0 || !iframeRef.current || !selectedCostCenter) return;

    const cctName = selectedCostCenter.CostCenterName || reportData[0]?.CctName || "";
    const cctLabel = cctName ? ` / ${cctName}` : "";

    const tableStyle = `
        table { width: 100%; border-collapse: collapse; table-layout: auto; font-size: 10px; }
        th, td { border: 1px solid #000; padding: 5px; word-wrap: break-word; vertical-align: middle; }
        th { font-weight: bold; background-color: #f0f0f0; text-align: center; }
        td { text-align: left; }
        `;

    let html = `
        <html><head><title>Solar Retail Roof-top Job Progress</title>
        <style>${tableStyle}</style></head>
        <body>
        <h2 style="text-align: center; text-decoration: underline; margin-bottom: 4px;">Solar Retail Roof-top Job Progress- From ${fromDate} To ${toDate}</h2>
        <p style="text-align: center; font-weight: bold; margin-top: 0; margin-bottom: 12px;">Cost Centre : ${selectedCostCenter.CostCenterId}${cctLabel}</p>
        <table>
        <thead><tr>
        ${columns.map((c) => `<th>${c}</th>`).join("")}
        </tr></thead>
        <tbody>
        `;

    reportData.forEach((item) => {
      html += `<tr>
                <td>${escapeHtml(item.ApplicationNo)}</td>
                <td>${formatDate(item.SubmitDate)}</td>
                <td>${formatDate(item.PivDate)}</td>
                <td>${formatDate(item.PaidDate)}</td>
                <td>${escapeHtml(item.ApplicationId)}</td>
                <td>${formatDate(item.ApprovedDate)}</td>
                <td>${formatDate(item.Piv2PaidDate)}</td>
                <td>${escapeHtml(item.ProjectNo)}</td>
                <td>${formatDate(item.EnergizedDate)}</td>
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

  const cctName = selectedCostCenter?.CostCenterName || (reportData.length > 0 && reportData[0]?.CctName) || "";
  const costCenterHeader = selectedCostCenter
    ? cctName
      ? `${selectedCostCenter.CostCenterId} / ${cctName}`
      : selectedCostCenter.CostCenterId
    : "";

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white rounded-xl shadow border border-gray-200 text-sm font-sans">
      <iframe ref={iframeRef} style={{ display: "none" }} title="print-frame" />

      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h2 className={`text-xl font-bold ${maroon}`}>
          C/C Solar Application Progress
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

        {/* Search Controls */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3" />
            <input
              type="text"
              value={searchId}
              placeholder="Search by Cost Center ID"
              onChange={(e) => setSearchId(e.target.value)}
              className="pl-8 pr-3 py-1.5 w-44 rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#7A0000] transition text-sm"
              autoComplete="off"
            />
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3" />
            <input
              type="text"
              value={searchName}
              placeholder="Search by Name"
              onChange={(e) => setSearchName(e.target.value)}
              className="pl-8 pr-3 py-1.5 w-44 rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#7A0000] transition text-sm"
              autoComplete="off"
            />
          </div>

          {(searchId || searchName) && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm"
            >
              <RotateCcw className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Loading State */}
      {loadingCostCenters && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7A0000] mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading cost centers...</p>
        </div>
      )}

      {/* Error State */}
      {costCentersError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          Error: {costCentersError}
        </div>
      )}

      {/* No Results */}
      {!loadingCostCenters && !costCentersError && filteredCostCenters.length === 0 && (
        <div className="text-gray-600 bg-gray-100 p-4 rounded">No cost centers found.</div>
      )}

      {/* Cost Center Table */}
      {!loadingCostCenters && !costCentersError && filteredCostCenters.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <div className="max-h-[50vh] overflow-y-auto">
              <table className="w-full table-fixed text-left text-gray-700 text-sm">
                <thead className={`${maroonGrad} text-white sticky top-0`}>
                  <tr>
                    <th className="px-4 py-2 w-1/4">Cost Center ID</th>
                    <th className="px-4 py-2 w-1/2">Cost Center Name</th>
                    <th className="px-4 py-2 w-1/4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCostCenters.map((costCenter, i) => (
                    <tr
                      key={`${costCenter.CostCenterId}-${i}`}
                      className={`${i % 2 ? "bg-white" : "bg-gray-50"} ${
                        selectedCostCenter?.CostCenterId === costCenter.CostCenterId
                          ? "ring-2 ring-[#7A0000] ring-inset"
                          : ""
                      }`}
                    >
                      <td className="px-4 py-2 truncate font-mono">{costCenter.CostCenterId}</td>
                      <td className="px-4 py-2 truncate">{costCenter.CostCenterName}</td>
                      <td className="px-4 py-2 text-center">
                        <button
                          onClick={() => handleSelectAndFetch(costCenter)}
                          className={`px-3 py-1 ${
                            selectedCostCenter?.CostCenterId === costCenter.CostCenterId
                              ? "bg-green-600 text-white"
                              : maroonGrad + " text-white"
                          } rounded-md text-xs font-medium hover:brightness-110 transition shadow flex items-center justify-center gap-1 mx-auto`}
                        >
                          <Eye className="w-3 h-3" />
                          {selectedCostCenter?.CostCenterId === costCenter.CostCenterId ? "Viewing" : "View"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination Controls */}
          <div className="flex justify-end items-center gap-3 mt-3">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 border rounded bg-white text-gray-600 text-xs hover:bg-gray-100 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs text-gray-500">
              Page {page} of {Math.ceil(filteredCostCenters.length / pageSize)}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(Math.ceil(filteredCostCenters.length / pageSize), p + 1))}
              disabled={page >= Math.ceil(filteredCostCenters.length / pageSize)}
              className="px-3 py-1 border rounded bg-white text-gray-600 text-xs hover:bg-gray-100 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </>
      )}

      {/* Report Viewer Modal */}
      {showReport && selectedCostCenter && (
        <ReportViewer
          title={`Solar Retail Roof-top Job Progress- From ${fromDate} To ${toDate}`}
          subtitlebold="Cost Centre :"
          subtitlenormal={costCenterHeader}
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
                {reportData.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="p-2 border border-gray-300 whitespace-nowrap">{item.ApplicationNo}</td>
                    <td className="p-2 border border-gray-300 whitespace-nowrap">{formatDate(item.SubmitDate)}</td>
                    <td className="p-2 border border-gray-300 whitespace-nowrap">{formatDate(item.PivDate)}</td>
                    <td className="p-2 border border-gray-300 whitespace-nowrap">{formatDate(item.PaidDate)}</td>
                    <td className="p-2 border border-gray-300 whitespace-nowrap">{item.ApplicationId}</td>
                    <td className="p-2 border border-gray-300 whitespace-nowrap">{formatDate(item.ApprovedDate)}</td>
                    <td className="p-2 border border-gray-300 whitespace-nowrap">{formatDate(item.Piv2PaidDate)}</td>
                    <td className="p-2 border border-gray-300 whitespace-nowrap">{item.ProjectNo}</td>
                    <td className="p-2 border border-gray-300 whitespace-nowrap">{formatDate(item.EnergizedDate)}</td>
                    <td className="p-2 border border-gray-300 whitespace-nowrap">{item.ApplicationSubType}</td>
                    <td className="p-2 border border-gray-300 whitespace-nowrap">{item.ExistingAccNo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ReportViewer>
      )}
    </div>
  );
};

export default CcApplicationProgress;
