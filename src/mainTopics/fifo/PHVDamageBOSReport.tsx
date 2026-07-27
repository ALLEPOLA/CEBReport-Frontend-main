// PHVDamageBOSReport.tsx
import React, { useEffect, useState } from "react";
import { Download, Printer, X, RotateCcw, Eye, Search } from "lucide-react";
import { toast } from "react-toastify";
import { useUser } from "../../contexts/UserContext";

interface CostCentre {
  DeptId: string;
  DeptName: string;
}

interface Warehouse {
  WarehouseCode: string;
  CostCenterId?: string;
}

interface DamageBOSItem {
  DocNo: string | null;
  MatCd: string | null;
  MatNm: string | null;
  GradeCd: string | null;
  DamageCount: number | null;
  BatchId: string | null;
  QtyOnHand: number | null;
  UnitPrice: number | null;
  StockBook: number | null;
  Reason: string | null;
  CctName: string | null;
}

/* ────── Constants ────── */
const MAX_RECORDS = 5000;
const FETCH_TIMEOUT_MS = 120000;
const PAGE_SIZE = 9;

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

const parseApiResponse = (response: any): any[] => {
  if (Array.isArray(response)) return response;
  if (response.data && Array.isArray(response.data)) return response.data;
  if (response.result && Array.isArray(response.result)) return response.result;
  if (response.departments && Array.isArray(response.departments)) return response.departments;
  if (response.Data && Array.isArray(response.Data)) return response.Data;
  if (response.warehouses && Array.isArray(response.warehouses)) return response.warehouses;
  console.warn("Unexpected API response format:", response);
  return [];
};

/* ────── MAIN COMPONENT ────── */
const PHVDamageBOSReport: React.FC = () => {
  const { user } = useUser();
  const epfNo = user?.Userno || "";

  const maroon = "text-[#7A0000]";
  const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 11 }, (_, i) => currentYear - i);

  /* ── Cost Center list state ── */
  const [data, setData] = useState<CostCentre[]>([]);
  const [filtered, setFiltered] = useState<CostCentre[]>([]);
  const [searchId, setSearchId] = useState("");
  const [searchName, setSearchName] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ── Selection state ── */
  const [selectedDept, setSelectedDept] = useState<CostCentre | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [warehouseLoading, setWarehouseLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  /* ── Report state ── */
  const [reportData, setReportData] = useState<DamageBOSItem[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [showReport, setShowReport] = useState(false);

  /* ────── Fetch Departments ────── */
  useEffect(() => {
    const fetchDepartments = async () => {
      if (!epfNo) {
        setError("No EPF number available. Please login again.");
        toast.error("No EPF number available. Please login again.");
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(
          `/misapi/api/incomeexpenditure/departments/${encodeURIComponent(epfNo)}`,
          {
            method: "GET",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            credentials: "include",
          }
        );

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`HTTP error! status: ${res.status}, message: ${errorText}`);
        }

        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          const text = await res.text();
          throw new Error(`Expected JSON but got ${contentType}. Response: ${text.substring(0, 100)}`);
        }

        const parsed = await res.json();
        const rawData = parseApiResponse(parsed);

        const final: CostCentre[] = rawData.map((item: any) => ({
          DeptId: item.DeptId?.toString() || "",
          DeptName: item.DeptName?.toString().trim() || "",
        }));

        setData(final);
        setFiltered(final);
      } catch (e: any) {
        console.error("Cost Center Fetch Error:", e);
        const errorMessage = e.message.includes("JSON.parse")
          ? "Invalid data format received from server."
          : e.message.includes("Failed to fetch")
            ? "Failed to connect to the server. Please check if the server is running."
            : e.message;
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchDepartments();
  }, [epfNo]);

  /* ────── Filter Departments ────── */
  useEffect(() => {
    const f = data.filter(
      (d) =>
        (!searchId || d.DeptId.toLowerCase().includes(searchId.toLowerCase())) &&
        (!searchName || d.DeptName.toLowerCase().includes(searchName.toLowerCase()))
    );
    setFiltered(f);
    setPage(1);
  }, [searchId, searchName, data]);

  /* ────── Fetch Warehouses when department changes ────── */
  useEffect(() => {
    const fetchWarehouses = async () => {
      setWarehouses([]);
      setSelectedWarehouse("");

      if (!selectedDept || !epfNo) return;

      setWarehouseLoading(true);
      try {
        const url = `/misapi/api/inventoryaverageconsumption/warehouses/${encodeURIComponent(
          epfNo
        )}?costCenterId=${encodeURIComponent(selectedDept.DeptId)}&t=${Date.now()}`;

        const response = await fetch(url, {
          method: "GET",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          credentials: "include",
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          const text = await response.text();
          throw new Error(`Expected JSON but got ${contentType}. Response: ${text.substring(0, 100)}`);
        }

        const result = await response.json();
        const rawData = parseApiResponse(result);
        const warehousesData: Warehouse[] = rawData.map((item: any) => ({
          WarehouseCode: item.WarehouseCode?.toString().trim() || "",
          CostCenterId: item.CostCenterId?.toString().trim() || "",
        }));

        const filteredData = warehousesData.filter(
          (item) => !item.CostCenterId || item.CostCenterId === selectedDept.DeptId
        );

        setWarehouses(filteredData);
        if (filteredData.length === 0) {
          toast.warn(`No warehouses found for cost center ${selectedDept.DeptId}.`);
        } else if (filteredData.length === 1) {
          setSelectedWarehouse(filteredData[0].WarehouseCode);
        }
      } catch (error: any) {
        console.error("Warehouse Fetch Error Details:", error);
        const errorMessage = error.message.includes("Failed to fetch")
          ? "Failed to connect to the server. Please verify the warehouse endpoint exists."
          : error.message;
        toast.error(`Failed to fetch warehouses: ${errorMessage}`);
      } finally {
        setWarehouseLoading(false);
      }
    };

    fetchWarehouses();
  }, [selectedDept, epfNo]);

  /* ────── Input validation ────── */
  const validateInputs = (): boolean => {
    if (!selectedDept) {
      toast.error("Please select a cost center.");
      return false;
    }
    if (!selectedWarehouse) {
      toast.error("Please select a warehouse code.");
      return false;
    }
    if (!selectedYear) {
      toast.error("Please select a year.");
      return false;
    }
    return true;
  };

  /* ────── Fetch report data ──────
     Matches PHVDamageBOSController.GetReport(repYear, whCode) exactly --
     the cost center is only used client-side to filter the warehouse list;
     it is not sent to the endpoint, since the SQL itself doesn't filter by it. */
  const handleViewReport = async () => {
    if (!validateInputs()) return;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    setReportLoading(true);
    setReportData([]);
    setShowReport(true);

    try {
      const repYearParam = selectedYear.toString();
      const whCodeParam = encodeURIComponent(selectedWarehouse);
      const url = `/misapi/api/phvdamagebos/report/${repYearParam}/${whCodeParam}`;

      const res = await fetch(url, {
        credentials: "include",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }

      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Failed to load data");

      const items: DamageBOSItem[] = json.data || [];

      if (items.length > MAX_RECORDS) {
        throw new Error(`Too many records (${items.length}). Please refine your search.`);
      }

      if (items.length === 0) {
        toast.warn("No records found for the selected criteria.");
        setShowReport(false);
        setReportData([]);
        return;
      }

      setReportData(items);
      toast.success(`${items.length} records loaded successfully.`);
    } catch (err: any) {
      if (err.name === "AbortError") {
        toast.error("Request timed out.");
      } else {
        const msg = err.message.includes("Failed to fetch")
          ? "Server unreachable. Please check your connection."
          : err.message;
        toast.error(msg);
      }
      setReportData([]);
      setShowReport(false);
    } finally {
      setReportLoading(false);
    }
  };

  const closeReport = () => {
    setShowReport(false);
    setReportData([]);
    setReportLoading(false);
  };

  const clearFilters = () => {
    setSearchId("");
    setSearchName("");
  };

  const clearAll = () => {
    setSearchId("");
    setSearchName("");
    setSelectedDept(null);
    setSelectedWarehouse("");
    setSelectedYear(currentYear);
    setShowReport(false);
    setReportData([]);
    toast.info("Filters cleared.");
  };

  /* ────── Single flat table, sorted per SQL: doc_no, mat_cd ────── */
  const sortedData = [...reportData].sort(
    (a, b) =>
      (a.DocNo || "").localeCompare(b.DocNo || "") ||
      (a.MatCd || "").localeCompare(b.MatCd || "")
  );

  const grandTotalStockBook = reportData.reduce((s, r) => s + (r.StockBook || 0), 0);
  const costCtrIdDisplay = selectedDept?.DeptId || "";
  const costCtrNameDisplay = selectedDept?.DeptName || "";

  /* ────── CSV download ────── */
  const downloadCSV = () => {
    if (reportData.length === 0) return;

    const titleRows = [
      `Board of Survey Recommendation for Damaged Stock Items - Annual Verification of the Year-${selectedYear}`,
      `Cost Center: ${costCtrIdDisplay} / : ${costCtrNameDisplay}`,
      `Warehouse : ${selectedWarehouse}`,
      "",
    ];

    const headers = [
      "Serial",
      "Code No",
      "Description",
      "Sheet No",
      "Batch Id",
      "Recommendation of BOS (S/D)",
      "Quantity",
      "Unit Price",
      "Minimum Selling Price of Quantity",
      "Total (Rs.)",
    ];
    const rows: string[] = [headers.join(",")];

    sortedData.forEach((it, i) => {
      rows.push(
        [
          csvEscape(i + 1),
          csvEscape(it.MatCd),
          csvEscape(it.MatNm),
          csvEscape(it.DocNo),
          csvEscape(it.BatchId),
          "",
          csvEscape(formatNumber(it.QtyOnHand)),
          csvEscape(formatNumber(it.UnitPrice)),
          "",
          csvEscape(formatNumber(it.StockBook)),
        ].join(",")
      );
    });

    rows.push(`Total,,,,,,,,,${csvEscape(formatNumber(grandTotalStockBook))}`);

    const csv = [...titleRows, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PHV_Damage_BOS_${selectedDept?.DeptId}_${selectedWarehouse}_${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ────── PDF print — single continuous document. Company name + topic
     appear once at the top (no per-page repetition, no generated timestamp).
     Table headers repeat automatically via CSS if the table spans pages. ────── */
  const printPDF = () => {
    if (reportData.length === 0) return;

    const rowsHtml = sortedData
      .map(
        (it, i) => `
          <tr class="${i % 2 ? "bg-white" : "bg-gray-50"}">
            <td class="cell center">${i + 1}</td>
            <td class="cell">${it.MatCd || ""}</td>
            <td class="cell">${it.MatNm || ""}</td>
            <td class="cell mono">${it.DocNo || ""}</td>
            <td class="cell mono">${it.BatchId || ""}</td>
            <td class="cell center">&nbsp;</td>
            <td class="cell right mono">${formatNumber(it.QtyOnHand)}</td>
            <td class="cell right mono">${formatNumber(it.UnitPrice)}</td>
            <td class="cell center">&nbsp;</td>
            <td class="cell right mono">${formatNumber(it.StockBook)}</td>
          </tr>`
      )
      .join("");

    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Board of Survey Recommendation for Damaged Stock Items - ${selectedYear}</title>
  <style>
    @media print {
      @page { margin: 10mm 8mm 14mm 8mm; }
      body { margin:0; font-family:Arial,Helvetica,sans-serif; font-size:9.5px; color:#111; }
      .company, .topic { text-align:center; font-weight:bold; }
      .company { font-size:13px; }
      .topic { font-size:11px; margin-top:4px; margin-bottom:10px; }
      .cost-center-row { font-size:9.5px; margin-bottom:12px; }
      .cost-center-row div { margin-bottom:2px; }
      table { border-collapse:collapse; width:100%; font-size:8px; }
      thead { display: table-header-group; }
      tr { page-break-inside: avoid; }
      .cell { border:1px solid #000; padding:4px 5px; word-wrap:break-word; }
      .center { text-align:center; }
      .right { text-align:right; }
      .mono { font-family:monospace; }
      thead th { background:#e5e5e5; border:1px solid #000; padding:4px 5px; font-weight:bold; text-align:center; }
      .certified-title { text-align:center; font-weight:bold; font-size:10px; margin-top:18px; margin-bottom:4px; page-break-inside:avoid; }
      .cert-row { display:flex; justify-content:space-between; margin-top:10px; font-size:8.5px; text-align:center; page-break-inside:avoid; }
      .cert-col { width:24%; }
      .sig-space { height:26px; }
      .board-title { text-align:center; font-weight:bold; font-size:10.5px; margin:18px 0 6px; page-break-inside:avoid; }
      .bos-note { font-size:8.5px; text-align:justify; margin-bottom:10px; }
      .signed-by { font-size:8.5px; margin-bottom:8px; }
      .member-row { display:flex; align-items:baseline; font-size:8.5px; margin-bottom:8px; page-break-inside:avoid; }
      .member-num { width:22%; }
      .member-label { width:33%; }
      .member-sig { width:45%; text-align:right; }
      .final-date { font-size:8.5px; margin-top:4px; margin-bottom:12px; }
      hr { border:none; border-top:1px solid #000; margin:10px 0; }
      .approval-row { display:flex; justify-content:space-between; font-size:8.5px; padding:4px 0; page-break-inside:avoid; }
    }
  </style>
</head>
<body>
  <div class="topic">Board of Survey Recommendation for Damaged Stock Items - Annual Verification of the Year-${selectedYear}</div>
  <div class="cost-center-row">
    <div><strong>Cost Center:</strong> ${costCtrIdDisplay} / : ${costCtrNameDisplay}</div>
    <div><strong>Warehouse :</strong> ${selectedWarehouse}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th rowspan="2" style="width:4%;">Serial<br/>No</th>
        <th rowspan="2" style="width:9%;">Code No</th>
        <th rowspan="2" style="width:17%;">Description</th>
        <th rowspan="2" style="width:11%;">Sheet No</th>
        <th rowspan="2" style="width:10%;">Batch Id</th>
        <th style="width:12%;">Recommendation of BOS</th>
        <th colspan="3" style="width:31%;">Quantity / Value</th>
        <th rowspan="2" style="width:6%;">&nbsp;</th>
      </tr>
      <tr>
        <th style="width:12%; font-size:7.5px;">S - Sold &nbsp; D - Destroyed</th>
        <th style="width:9%;">STOCK Qty</th>
        <th style="width:11%;">Unit Price</th>
        <th style="width:11%;">Min. Selling Price</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>

  <div class="certified-title">Certified Correct</div>
  <div class="cert-row">
    <div class="cert-col">
      <div class="sig-space"></div>
      <div>.......................................</div>
      <div>Date</div>
    </div>
    <div class="cert-col">
      <div class="sig-space"></div>
      <div>.......................................</div>
      <div>Store keeper/E.S.</div>
    </div>
    <div class="cert-col">
      <div class="sig-space"></div>
      <div>.......................................</div>
      <div>Enginer in Charge</div>
    </div>
    <div class="cert-col">
      <div class="sig-space"></div>
      <div>.......................................</div>
      <div>Unit head</div>
    </div>
  </div>

  <div class="board-title">Recommendation of Board Survey</div>
  <div class="bos-note">
    We the member ofthe Board Survey which made a thorough inspection of the items mentioned in this document
    recommended the items aganist which the letter " S" has been marked as being beyound economic repairs and
    should therefore to be sold the items aganist which the letter " D" has been marked should be destroyed the
    items aganist which the letter " R" has been marked should to berepaired and used as it is advantageous
    economailly to do so
  </div>
  <div class="signed-by">Singed by</div>

  <div class="member-row">
    <div class="cert-col">
      <div class="sig-space"></div>
      <div>(1).......................................</div>
      <div>Chairman - BOS(Name)</div>
    </div>
    <div class="cert-col">
      <div class="sig-space"></div>
      <div>.......................................</div>
      <div>Signature</div>
    </div>
  </div>

  <div class="member-row">
    <div class="cert-col">
      <div class="sig-space"></div>
      <div>(2).......................................</div>
      <div>Member - BOS(Name)</div>
    </div>
    <div class="cert-col">
      <div class="sig-space"></div>
      <div>.......................................</div>
      <div>Signature</div>
    </div>
  </div>

  <div class="member-row">
    <div class="cert-col">
      <div class="sig-space"></div>
      <div>(3).......................................</div>
      <div>Member - BOS(Name)</div>
    </div>
    <div class="cert-col">
      <div class="sig-space"></div>
      <div>.......................................</div>
      <div>Signature</div>
    </div>
  </div>

  <div class="member-row">
    <div class="cert-col">
      <div class="sig-space"></div>
      <div>(4).......................................</div>
      <div>Observer - BOS(Name)</div>
    </div>
    <div class="cert-col">
      <div class="sig-space"></div>
      <div>.......................................</div>
      <div>Signature</div>
    </div>
  </div>
  <div class="final-date">Date &nbsp; : ..................................</div>

  <hr/>
  <div class="approval-row">
    <div>Date &nbsp; : ..................................</div>
    <div>Director &nbsp;&nbsp; ..............................</div>
  </div>
  <hr/>
  <div class="approval-row">
    <div>Date &nbsp; : ..................................</div>
    <div>Cheif Operative Officer  &nbsp;&nbsp; ..............................</div>
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

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  /* ────── RENDER ────── */
  return (
    <div className="max-w-7xl mx-auto p-6 bg-white rounded-xl shadow border border-gray-200 text-sm font-sans">
      <div className="flex justify-between items-center mb-4">
        <h2 className={`text-xl font-bold ${maroon}`}>
          5. Physical Verification Damage BOS - AV/7B/BOS
        </h2>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg mb-4 border border-gray-200">
        <div className="flex flex-col md:flex-row flex-wrap gap-4 items-end">
          <div className="flex flex-col">
            <label className={`text-xs font-bold ${maroon} mb-1`}>Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="pl-3 pr-3 py-1.5 w-full md:w-32 rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#7A0000] transition text-sm"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className={`text-xs font-bold ${maroon} mb-1`}>Warehouse Code</label>
            <select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              className="pl-3 pr-3 py-1.5 w-full md:w-40 rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#7A0000] transition text-sm"
              disabled={!selectedDept || warehouseLoading}
            >
              <option value="">Select Warehouse</option>
              {warehouses.map((wh) => (
                <option key={wh.WarehouseCode} value={wh.WarehouseCode}>
                  {wh.WarehouseCode}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleViewReport}
            disabled={!selectedDept || !selectedWarehouse || warehouseLoading}
            className={`flex items-center gap-1 px-3 py-1.5 ${maroonGrad} text-white rounded-md text-sm font-medium hover:brightness-110 transition shadow ${!selectedDept || !selectedWarehouse || warehouseLoading
                ? "opacity-50 cursor-not-allowed"
                : ""
              }`}
          >
            <Eye className="w-4 h-4" /> View
          </button>
        </div>

        <div className="flex justify-end mt-4">
          <button
            onClick={clearAll}
            className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm"
          >
            <RotateCcw className="w-3 h-3" /> Clear All
          </button>
        </div>
      </div>

      {/* ────── Cost Center List ────── */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            value={searchId}
            placeholder="Search by ID"
            onChange={(e) => setSearchId(e.target.value)}
            className="pl-10 pr-3 py-1.5 w-40 rounded border border-gray-300 focus:ring-2 focus:ring-[#7A0000] text-sm"
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
            className="pl-10 pr-3 py-1.5 w-40 rounded border border-gray-300 focus:ring-2 focus:ring-[#7A0000] text-sm"
            autoComplete="off"
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

      {loading && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#7A0000]"></div>
          <p className="mt-3 text-gray-600 text-sm">Loading cost centers...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="text-gray-600 bg-gray-100 p-4 rounded text-sm">No cost centers found.</div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <div className="max-h-[50vh] overflow-y-auto">
              <table className="w-full table-fixed text-left text-gray-700 text-xs md:text-sm">
                <thead className={`${maroonGrad} text-white sticky top-0`}>
                  <tr>
                    <th className="px-4 py-2 w-1/2">Cost Center Code</th>
                    <th className="px-4 py-2 w-1/2">Cost Center Name</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((department, i) => (
                    <tr
                      key={`${department.DeptId}-${i}`}
                      onClick={() => setSelectedDept(department)}
                      className={`cursor-pointer ${selectedDept?.DeptId === department.DeptId
                          ? "bg-[#7A0000] text-white"
                          : i % 2
                            ? "bg-white hover:bg-gray-100"
                            : "bg-gray-50 hover:bg-gray-100"
                        }`}
                    >
                      <td className="px-4 py-2 truncate min-w-0">{department.DeptId}</td>
                      <td className="px-4 py-2 truncate min-w-0">{department.DeptName}</td>
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
              className="px-3 py-1 border rounded bg-white text-gray-600 text-xs hover:bg-gray-100 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs text-gray-600">
              Page {page} of {Math.ceil(filtered.length / PAGE_SIZE)}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(Math.ceil(filtered.length / PAGE_SIZE), p + 1))}
              disabled={page >= Math.ceil(filtered.length / PAGE_SIZE)}
              className="px-3 py-1 border rounded bg-white text-gray-600 text-xs hover:bg-gray-100 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </>
      )}

      {/* ────── REPORT MODAL ────── */}
      {showReport && selectedDept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/90 print:static print:inset-auto print:p-0 print:bg-white">
          <div className="relative bg-white w-[95vw] sm:w-[90vw] md:w-[85vw] lg:w-[80vw] xl:w-[75vw] max-w-7xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden mt-20 md:mt-32 lg:mt-40 lg:ml-64 mx-auto print:relative print:w-full print:max-w-none print:rounded-none print:shadow-none print:border-none print:overflow-visible">
            {reportLoading && (
              <div className="absolute inset-0 bg-white/95 z-50 flex flex-col items-center justify-center gap-4">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#7A0000]"></div>
                <p className="text-xl font-bold text-[#7A0000]">Loading Report...</p>
                <p className="text-sm text-gray-600">Fetching damaged stock records from server</p>
              </div>
            )}
            {!reportLoading && reportData.length > 0 && (
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
                    onClick={closeReport}
                    className="flex items-center gap-1 px-3 py-1.5 border border-red-400 text-red-700 bg-white rounded-md text-xs font-medium shadow-sm hover:bg-red-50"
                  >
                    <X className="w-4 h-4" /> Close
                  </button>
                </div>

                <div className={`text-center font-bold ${maroon} mt-1`}>
                  Board of Survey Recommendation for Damaged Stock Items - Annual Verification of the Year-{selectedYear}
                </div>
                <div className="text-sm mb-4 ml-5 mr-12 mt-3 space-y-1">
                  <div>
                    <span className="font-bold">Cost Center:</span> {costCtrIdDisplay} / {costCtrNameDisplay}
                  </div>
                  <div>
                    <span className="font-bold">Warehouse :</span> {selectedWarehouse}
                  </div>
                </div>

                <div className="ml-5 mt-1 mb-5 border border-gray-200 rounded-lg overflow-x-auto print:ml-12 print:mt-12 print:overflow-visible">
                  <div className="min-w-[1300px]">
                    <table className="w-full text-xs border-collapse">
                      <thead className={`${maroonGrad} text-white`}>
                        <tr>
                          <th className="px-3 py-2 border border-gray-300" style={{ width: "4%" }}>
                            Serial No
                          </th>
                          <th className="px-3 py-2 border border-gray-300" style={{ width: "9%" }}>
                            Code No
                          </th>
                          <th className="px-3 py-2 border border-gray-300" style={{ width: "18%" }}>
                            Description
                          </th>
                          <th className="px-3 py-2 border border-gray-300" style={{ width: "11%" }}>
                            Sheet No
                          </th>
                          <th className="px-3 py-2 border border-gray-300" style={{ width: "10%" }}>
                            Batch Id
                          </th>
                          <th className="px-3 py-2 border border-gray-300" style={{ width: "12%" }}>
                            Recommendation of BOS (S/D)
                          </th>
                          <th className="px-3 py-2 border border-gray-300 text-right" style={{ width: "9%" }}>
                            Quantity
                          </th>
                          <th className="px-3 py-2 border border-gray-300 text-right" style={{ width: "10%" }}>
                            Unit Price
                          </th>
                          <th className="px-3 py-2 border border-gray-300" style={{ width: "11%" }}>
                            Min. Selling Price of Quantity
                          </th>
                          <th className="px-3 py-2 border border-gray-300 text-right" style={{ width: "10%" }}>
                            Total (Rs.)
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedData.map((it, i) => (
                          <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                            <td className="px-3 py-2 border-l border-r border-gray-300 text-center">{i + 1}</td>
                            <td className="px-3 py-2 border-r border-gray-300">{it.MatCd || ""}</td>
                            <td className="px-3 py-2 border-r border-gray-300 break-words">{it.MatNm || ""}</td>
                            <td className="px-3 py-2 font-mono border-r border-gray-300">{it.DocNo || ""}</td>
                            <td className="px-3 py-2 font-mono border-r border-gray-300">{it.BatchId || ""}</td>
                            <td className="px-3 py-2 border-r border-gray-300"></td>
                            <td className="px-3 py-2 text-right font-mono border-r border-gray-300">
                              {formatNumber(it.QtyOnHand)}
                            </td>
                            <td className="px-3 py-2 text-right font-mono border-r border-gray-300">
                              {formatNumber(it.UnitPrice)}
                            </td>
                            <td className="px-3 py-2 border-r border-gray-300"></td>
                            <td className="px-3 py-2 text-right font-mono border-r border-gray-300">
                              {formatNumber(it.StockBook)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-[#d3d3d3] font-bold">
                          <td colSpan={9} className="px-3 py-2 text-right border border-gray-300">
                            Total
                          </td>
                          <td className="px-3 py-2 text-right font-mono border border-gray-300">
                            {formatNumber(grandTotalStockBook)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                    <p className="text-xs text-gray-500 mt-2 text-right px-2">
                      Total records: {reportData.length.toLocaleString()}
                    </p>
                  </div>
                </div>

                <p className={`text-center font-bold mt-6 ${maroon}`}>Certified Correct</p>
                <div className="flex justify-between text-center text-xs md:text-sm mt-3 ml-5 mr-12">
                  <div className="w-1/4">
                    <div className="h-8"></div>
                    <div>.......................................</div>
                    <div>Date</div>
                  </div>
                  <div className="w-1/4">
                    <div className="h-8"></div>
                    <div>.......................................</div>
                    <div>Store keeper/E.S.</div>
                  </div>
                  <div className="w-1/4">
                    <div className="h-8"></div>
                    <div>.......................................</div>
                    <div>Enginer in Charge</div>
                  </div>
                  <div className="w-1/4">
                    <div className="h-8"></div>
                    <div>.......................................</div>
                    <div>Unit head</div>
                  </div>
                </div>

                <div className="ml-5 mr-12 mt-6 text-xs md:text-sm">
                  <p className={`text-center font-bold mb-2 ${maroon}`}>Recommendation of Board Survey</p>
                  <p className="text-justify">
                    We the member ofthe Board Survey which made a thorough inspection of the items mentioned in this
                    document recommended the items aganist which the letter " S" has been marked as being beyound
                    economic repairs and should therefore to be sold the items aganist which the letter " D" has been
                    marked should be destroyed the items aganist which the letter " R" has been marked should to
                    berepaired and used as it is advantageous economailly to do so
                  </p>
                  <p className="mt-2">Singed by</p>

                  <div className="mt-3 space-y-2">
                    {[
                      { n: 1, label: "Chairman - BOS(Name)" },
                      { n: 2, label: "Member - BOS(Name)" },
                      { n: 3, label: "Member - BOS(Name)" },
                      { n: 4, label: "Observer - BOS(Name)" },
                    ].map((m) => (
                      <div key={m.n} className="flex justify-between text-gray-600">
                        <span className="w-[10%]">({m.n})</span>
                        <div className="w-1/2">
                          <div className="h-8"></div>
                          <div>.......................................</div>
                          <div>{m.label}</div>
                        </div>
                        <div className="w-1/2">
                          <div className="h-8"></div>
                          <div>.......................................</div>
                          <div>Signature</div>
                        </div>
                      </div>

                    ))}
                  </div>
                  <div className="mt-3">Date &nbsp; : ..................................</div>

                  <hr className="my-4 border-gray-400" />
                  <div className="flex justify-between">
                    <span>Date &nbsp; : ..................................</span>
                    <span>Director &nbsp;&nbsp; ..............................</span>
                  </div>
                  <hr className="my-4 border-gray-400" />
                  <div className="flex justify-between mb-2">
                    <span>Date &nbsp; : ..................................</span>
                    <span>Cheif Operative Officer &nbsp;&nbsp; ..............................</span>
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

export default PHVDamageBOSReport;