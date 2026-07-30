import React, { useState, useEffect, useCallback } from "react";
import { useUser } from "../../contexts/UserContext";
import { useReportScope } from "../../hooks/useReportScope";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface Area {
  areaCode: string;
  areaName: string;
}

interface Department {
  departmentCode: string;
  departmentName: string;
}

interface GovernmentAccount {
  accountNumber: string;
  customerName: string;
  address: string;
  currentBalance: string;
  kwhCharge: string;
  averageConsumption: string;
  areaName: string;
  departmentName: string;
  billCycle: string;
}

type ReportMode = "area" | "department" | null;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const parseNumber = (value: any): number => {
  if (value === undefined || value === null || value === "") return 0;
  if (typeof value === "number") return value;
  const num = parseFloat(String(value).replace(/,/g, ""));
  return isNaN(num) ? 0 : num;
};

const formatCurrency = (value: any): string =>
  parseNumber(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatKwh = (value: any): string =>
  parseNumber(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatConsumption = (value: any): string =>
  Math.floor(parseNumber(value)).toLocaleString("en-US");

// ─────────────────────────────────────────────────────────────────────────────
// API base — all requests go through /misapi
// ─────────────────────────────────────────────────────────────────────────────
const API = {
  areas: () => `/misapi/api/ordinary/areas`,
  departments: () => `/misapi/api/government-accounts/departments`,
  maxBillCycle: (areaCode: string) =>
    `/misapi/api/billsmry/prn_dat_1/billcycle/max?areaCode=${encodeURIComponent(areaCode)}`,
  reportByArea: (billCycle: string, areaCode: string) =>
    `/misapi/api/government-accounts/area?billCycle=${encodeURIComponent(billCycle)}&areaCode=${encodeURIComponent(areaCode)}`,
  reportByDept: (billCycle: string, areaCode: string, departmentCode: string) =>
    `/misapi/api/government-accounts/department?billCycle=${encodeURIComponent(billCycle)}&areaCode=${encodeURIComponent(areaCode)}&departmentCode=${encodeURIComponent(departmentCode)}`,
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
const ListOfGovernmentAccounts: React.FC = () => {
  const maroon = "text-[#7A0000]";
  const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";

  // ── Data ───────────────────────────────────────────────────────────────────
  const [areas, setAreas] = useState<Area[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  // ── Form ───────────────────────────────────────────────────────────────────
  const [selectedArea, setSelectedArea] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");

  // ── Loading ────────────────────────────────────────────────────────────────
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [loadingMode, setLoadingMode] = useState<ReportMode>(null);

  // ── Errors ─────────────────────────────────────────────────────────────────
  const [areaError, setAreaError] = useState("");
  const [deptError, setDeptError] = useState("");
  const [reportError, setReportError] = useState("");

  // ── Report ─────────────────────────────────────────────────────────────────
  const [reportData, setReportData] = useState<GovernmentAccount[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeReportMode, setActiveReportMode] = useState<ReportMode>(null);
  const [selectedAreaName, setSelectedAreaName] = useState("");
  const [selectedDeptName, setSelectedDeptName] = useState("");

  const { user } = useUser();
  const { locked } = useReportScope();

  // ── 1. Fetch areas ─────────────────────────────────────────────────────────
  useEffect(() => {
    const run = async () => {
      setLoadingAreas(true);
      setAreaError("");
      try {
        let url = API.areas();
        if (locked["Region"]?.code) {
          url += `?regionCode=${locked["Region"].code}`;
        } else if (locked["Province"]?.code) {
          url += `?provCode=${locked["Province"].code}`;
        }
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        const json = await res.json();
        const data = json?.data ?? json?.Data ?? json ?? [];
        if (!Array.isArray(data) || data.length === 0) {
          setAreaError("No areas returned from server."); return;
        }
        setAreas(data.map((item: any) => ({
          areaCode: item.AreaCode ?? item.areaCode ?? "",
          areaName: item.AreaName ?? item.areaName ?? "",
        })));
      } catch (err: any) {
        setAreaError(err.message ?? "Failed to load areas.");
      } finally {
        setLoadingAreas(false);
      }
    };
    run();
  }, [user.Level, user.RegionCode, user.ProvinceCode]);

  useEffect(() => {
    if (locked["Area"]) {
      setSelectedArea(locked["Area"].code);
      setSelectedAreaName(
        locked["Area"].name ? `${locked["Area"].code} - ${locked["Area"].name}` : locked["Area"].code
      );
    }
  }, [user.Level, user.AreaCode, user.AreaName]);

  // ── 2. Fetch departments ───────────────────────────────────────────────────
  useEffect(() => {
    const run = async () => {
      setLoadingDepts(true);
      setDeptError("");
      try {
        const res = await fetch(API.departments(), { headers: { Accept: "application/json" } });
        const json = await res.json();
        const data = json?.data ?? json?.Data ?? json ?? [];
        if (!Array.isArray(data) || data.length === 0) {
          setDeptError("No departments returned from server."); return;
        }
        setDepartments(data.map((item: any) => ({
          departmentCode:
            item.DepartmentCode ?? item.departmentCode ??
            item.Code ?? item.code ??
            item.DeptCode ?? item.deptCode ?? "",
          departmentName:
            item.DepartmentName ?? item.departmentName ??
            item.Name ?? item.name ??
            item.DeptName ?? item.deptName ?? "",
        })));
      } catch (err: any) {
        setDeptError(err.message ?? "Failed to load departments.");
      } finally {
        setLoadingDepts(false);
      }
    };
    run();
  }, []);

  // ── 3. Resolve max bill cycle ──────────────────────────────────────────────
  //  Uses only: /misapi/api/billsmry/prn_dat_1/billcycle/max?areaCode=...
  const resolveMaxBillCycle = async (areaCode: string): Promise<string> => {
    const url = API.maxBillCycle(areaCode);
    try {
      const r = await fetch(url, { headers: { Accept: "application/json" } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      const n = j?.data ?? j?.Data ?? j ?? null;
      const bc = String(
        n?.billCycle ?? n?.BillCycle ??
        n?.MaxBillCycle ?? n?.maxBillCycle ?? n ?? ""
      ).trim();
      if (bc) return bc;
      throw new Error("Empty bill cycle in response");
    } catch (e: any) {
      console.warn(`[GOV] bill cycle fetch error ${url}:`, e);
      throw new Error(`Could not determine the current bill cycle: ${e.message}`);
    }
  };

  // ── 4. Fetch report ────────────────────────────────────────────────────────
  const fetchReport = useCallback(async (mode: ReportMode) => {
    if (!selectedArea || !mode) return;
    if (mode === "department" && !selectedDepartment) return;

    const areaSnap = selectedArea;
    const deptSnap = selectedDepartment;
    const areaNameSnap = areas.find(a => a.areaCode === areaSnap)?.areaName ?? areaSnap;
    const deptNameSnap =
      mode === "department"
        ? (departments.find(d => d.departmentCode === deptSnap)?.departmentName ?? deptSnap)
        : "";

    setLoadingReport(true);
    setLoadingMode(mode);
    setReportError("");

    try {
      // Step 1 — bill cycle via the single designated endpoint
      const maxBillCycle = await resolveMaxBillCycle(areaSnap);

      // Step 2 — report rows via the designated area or department endpoint
      const reportUrl =
        mode === "area"
          ? API.reportByArea(maxBillCycle, areaSnap)
          : API.reportByDept(maxBillCycle, areaSnap, deptSnap);

      console.log("[GOV] fetching report:", reportUrl);

      const res = await fetch(reportUrl, { headers: { Accept: "application/json" } });

      let json: any;
      try {
        json = await res.json();
      } catch {
        throw new Error(`Server returned non-JSON response (HTTP ${res.status})`);
      }

      console.log("[GOV] report response:", json);

      // ── Extract rows first ──────────────────────────────────────────────────
      // Do this BEFORE checking errorMessage — some backends return a warning
      // message in the envelope even when valid data rows are present.
      let rows: any[] = [];
      if (Array.isArray(json)) rows = json;
      else if (Array.isArray(json?.data)) rows = json.data;
      else if (Array.isArray(json?.Data)) rows = json.Data;
      else if (Array.isArray(json?.data?.records)) rows = json.data.records;
      else if (Array.isArray(json?.records)) rows = json.records;
      else if (Array.isArray(json?.result)) rows = json.result;
      else if (Array.isArray(json?.Result)) rows = json.Result;

      console.log("[GOV] rows:", rows.length, rows[0] ? Object.keys(rows[0]) : "—");

      // ── Only treat errorMessage as fatal when there are no rows ────────────
      if (rows.length === 0) {
        const backendErr = json?.errorMessage ?? json?.ErrorMessage ?? null;
        if (backendErr) {
          const detail = json?.errorDetails ?? json?.ErrorDetails ?? "";
          setReportError(detail ? `${backendErr} — ${detail}` : backendErr);
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        setReportError("No records found for the selected criteria.");
        return;
      }

      const mapped: GovernmentAccount[] = rows.map((item: any) => ({
        accountNumber:
          String(item.AccountNumber ?? item.accountNumber ??
            item.AccountNo ?? item.accountNo ?? ""),
        customerName:
          String(item.CustomerName ?? item.customerName ??
            item.Customer ?? item.customer ?? ""),
        address:
          String(
            item.Address ?? item.address ??
            [item.Address1, item.Address2, item.Address3].filter(Boolean).join(", ") ?? ""
          ),
        currentBalance: formatCurrency(
          item.CurrentBalance ?? item.currentBalance ??
          item.CurrentCharge ?? item.currentCharge ??
          item["Current Balance"] ?? 0
        ),
        kwhCharge: formatKwh(
          item.KwhCharge ?? item.kwhCharge ??
          item.KWHCharge ?? item["kWh Charge"] ?? 0
        ),
        averageConsumption: formatConsumption(
          item.AverageConsumption ?? item.averageConsumption ??
          item.AvgConsumption ?? item["Average Consumption"] ?? 0
        ),
        areaName: item.AreaName ?? item.areaName ?? areaNameSnap,
        departmentName: item.DepartmentName ?? item.departmentName ?? deptNameSnap,
        billCycle: item.BillCycle ?? item.billCycle ?? maxBillCycle,
      }));

      setReportData(mapped);
      setSelectedAreaName(areaNameSnap);
      setSelectedDeptName(deptNameSnap);
      setActiveReportMode(mode);
      setHasSearched(true);

    } catch (err: any) {
      console.error("[GOV] fetchReport error:", err);
      setReportError(err.message ?? "Failed to fetch report data.");
    } finally {
      setLoadingReport(false);
      setLoadingMode(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedArea, selectedDepartment, areas, departments]);

  // ── Totals ─────────────────────────────────────────────────────────────────
  const totalBalance = reportData.reduce((s, r) => s + parseNumber(r.currentBalance), 0);
  const totalKwh = reportData.reduce((s, r) => s + parseNumber(r.kwhCharge), 0);

  // ── UI helpers ─────────────────────────────────────────────────────────────
  const selectCls =
    "w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent";

  const Placeholder = ({ msg, error }: { msg: string; error?: boolean }) => (
    <div className={`w-full px-2 py-1.5 text-xs border rounded-md ${error
        ? "border-red-300 bg-red-50 text-red-600"
        : "border-gray-300 bg-gray-50 text-gray-500"
      }`}>{msg}</div>
  );

  const Spinner = () => (
    <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg"
      fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10"
        stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );

  // ── Export helpers ─────────────────────────────────────────────────────────
  const escapeCsv = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const handleExportCsv = () => {
    if (!reportData.length) return;
    const header = [
      "Account No", "Customer Name", "Address",
      "Current Balance", "kWh Charge", "Avg Consumption",
      "Area", "Department", "Bill Cycle",
    ];
    const rows = reportData.map(r => [
      r.accountNumber, r.customerName, r.address, r.currentBalance,
      r.kwhCharge, r.averageConsumption, r.areaName, r.departmentName, r.billCycle,
    ]);
    const csv = [header, ...rows].map(row => row.map(escapeCsv).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `government-accounts_${selectedArea}_${activeReportMode}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  const handleExportPdf = () => {
    if (!reportData.length) return;
    const title = `List of Government Accounts — ${activeReportMode === "area" ? "Area Report" : "Department Report"}`;
    const subtitle = `Area: ${selectedAreaName}${activeReportMode === "department" && selectedDeptName ? ` | Department: ${selectedDeptName}` : ""}`;
    const rowsHtml = reportData.map(r => `<tr>
      <td style="border:1px solid #ddd;padding:4px 6px;font-size:10px">${escapeCsv(r.accountNumber)}</td>
      <td style="border:1px solid #ddd;padding:4px 6px;font-size:10px">${escapeCsv(r.customerName)}</td>
      <td style="border:1px solid #ddd;padding:4px 6px;font-size:10px">${escapeCsv(r.address)}</td>
      <td style="border:1px solid #ddd;padding:4px 6px;font-size:10px;text-align:right">${r.currentBalance}</td>
      <td style="border:1px solid #ddd;padding:4px 6px;font-size:10px;text-align:right">${r.kwhCharge}</td>
      <td style="border:1px solid #ddd;padding:4px 6px;font-size:10px;text-align:right">${r.averageConsumption}</td>
    </tr>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title>
      <style>
        body{font-family:Arial,sans-serif;margin:10mm;font-size:10px;color:#111}
        .header{font-weight:bold;color:#7A0000;font-size:12px;margin-bottom:5px}
        .subheader{font-size:11px;margin-bottom:8px}
        table{width:100%;border-collapse:collapse;margin-top:8px}
        th{background:#d3d3d3;font-weight:bold;text-align:center;padding:4px 6px;border:1px solid #ddd;font-size:10px}
        td{padding:4px 6px;border:1px solid #ddd;font-size:10px;vertical-align:top}
        tr:nth-child(even){background:#f9f9f9}
        .tot{margin-top:10px;font-size:11px}
        @page{size:A4 landscape;margin:12mm}
      </style>
      </head><body>
      <div class="header">${title}</div>
      <div class="subheader">${subtitle}</div>
      <table><thead><tr><th>Account No</th><th>Customer Name</th><th>Address</th>
      <th>Current Balance</th><th>kWh Charge</th><th>Avg Consumption</th></tr></thead>
      <tbody>${rowsHtml}</tbody></table>
      <div class="tot"><strong>Total Balance:</strong> ${formatCurrency(totalBalance)} &nbsp;
      <strong>Total kWh:</strong> ${formatKwh(totalKwh)}</div>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) { setReportError("Popup blocked — allow popups to export PDF."); return; }
    w.document.open(); w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => { w.print(); setTimeout(() => w.close(), 500); }, 250);
  };

  const handleBackToForm = () => {
    setHasSearched(false);
    setReportData([]);
    setReportError("");
    setActiveReportMode(null);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 bg-white rounded-lg shadow-sm">

      {/* ══════════════════════════ FORM ══════════════════════════════════════ */}
      {!hasSearched && (
        <>
          <h1 className={`text-xl font-bold ${maroon} mb-4`}>List of Government Accounts</h1>
          <p className="text-sm text-gray-500 -mt-2 mb-4">
            View and export government customer accounts with current balances and consumption details
          </p>

          <div className="space-y-5">

            {/* ── Area row ─────────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              <div className="flex flex-col">
                <label className={`text-xs font-medium mb-1 ${maroon}`}>
                  Area: <span className="text-red-600">*</span>
                </label>
                {loadingAreas ? (
                  <Placeholder msg="Loading areas…" />
                ) : areaError ? (
                  <Placeholder msg={areaError} error />
                ) : locked["Area"] ? (
                  <select
                    disabled
                    value={locked["Area"].code}
                    className="w-full px-2 py-1.5 text-xs border rounded-md bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                  >
                    <option value={locked["Area"].code}>
                      {locked["Area"].name ? `${locked["Area"].code} - ${locked["Area"].name}` : locked["Area"].code}
                    </option>
                  </select>
                ) : (
                  <select
                    value={selectedArea}
                    onChange={e => setSelectedArea(e.target.value)}
                    className={selectCls}
                  >
                    <option value="">Select Area</option>
                    {areas.map(a => (
                      <option key={a.areaCode} value={a.areaCode}>
                        {a.areaCode} - {a.areaName}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <button
                  onClick={() => fetchReport("area")}
                  disabled={loadingReport || !selectedArea}
                  className={`px-4 py-1.5 rounded-md font-medium text-xs shadow transition-opacity
                    ${maroonGrad} text-white
                    ${loadingReport || !selectedArea ? "opacity-50 cursor-not-allowed" : "hover:opacity-90"}`}
                >
                  {loadingMode === "area"
                    ? <span className="flex items-center gap-2"><Spinner /> Loading…</span>
                    : "View All Govt. Customers in Above Area"}
                </button>
              </div>
            </div>

            {/* ── Department row ────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              <div className="flex flex-col">
                <label className={`text-xs font-medium mb-1 ${maroon}`}>
                  Department: <span className="text-red-600">*</span>
                </label>
                {loadingDepts ? (
                  <Placeholder msg="Loading departments…" />
                ) : deptError ? (
                  <Placeholder msg={deptError} error />
                ) : departments.length === 0 ? (
                  <Placeholder msg="No departments available" />
                ) : (
                  <select
                    value={selectedDepartment}
                    onChange={e => setSelectedDepartment(e.target.value)}
                    className={selectCls}
                  >
                    <option value="">Select Department</option>
                    {departments.map(d => (
                      <option key={d.departmentCode} value={d.departmentCode}>
                        {d.departmentCode} - {d.departmentName}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <button
                  onClick={() => fetchReport("department")}
                  disabled={loadingReport || !selectedArea || !selectedDepartment}
                  className={`px-4 py-1.5 rounded-md font-medium text-xs shadow transition-opacity
                    ${maroonGrad} text-white
                    ${loadingReport || !selectedArea || !selectedDepartment ? "opacity-50 cursor-not-allowed" : "hover:opacity-90"}`}
                >
                  {loadingMode === "department"
                    ? <span className="flex items-center gap-2"><Spinner /> Loading…</span>
                    : "View Customers in Above Area/Dept"}
                </button>
              </div>
            </div>

          </div>

          {reportError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {reportError}
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════ REPORT ════════════════════════════════════ */}
      {hasSearched && (
        <div className="mt-2">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
            <div>
              <h2 className={`text-lg font-bold ${maroon}`}>
                List of Government Accounts —{" "}
                {activeReportMode === "area" ? "Area Report" : "Department Report"}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Area: {selectedAreaName}
                {activeReportMode === "department" && selectedDeptName && (
                  <> | Department: {selectedDeptName}</>
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 mt-2 md:mt-0">
              <button
                onClick={handleExportCsv}
                disabled={!reportData.length}
                className={`flex items-center gap-1 px-3 py-1.5 border border-blue-400 rounded-md text-xs font-medium shadow-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-200 transition
                  ${!reportData.length ? "text-blue-300 bg-gray-50 cursor-not-allowed" : "text-blue-700 bg-white hover:bg-blue-50 hover:text-blue-800"}`}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5l2 2h5a2 2 0 012 2v12a2 2 0 01-2 2z" />
                </svg>
                CSV
              </button>
              <button
                onClick={handleExportPdf}
                disabled={!reportData.length}
                className={`flex items-center gap-1 px-3 py-1.5 border border-green-400 rounded-md text-xs font-medium shadow-sm
                  focus:outline-none focus:ring-2 focus:ring-green-200 transition
                  ${!reportData.length ? "text-green-300 bg-gray-50 cursor-not-allowed" : "text-green-700 bg-white hover:bg-green-50 hover:text-green-800"}`}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                PDF
              </button>
              <button
                onClick={handleBackToForm}
                className="px-4 py-1.5 bg-[#7A0000] hover:bg-[#A52A2A] text-xs rounded-md text-white"
              >
                Back to Form
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto max-h-[calc(100vh-300px)] border border-gray-300 rounded-lg">
            <div className="min-w-full py-4">
              <table className="w-full border-collapse text-xs">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    {["Account No", "Customer", "Address", "Current Balance", "kWh Charge", "Average Consumption"].map(h => (
                      <th key={h}
                        className="border border-gray-300 px-2 py-1 text-center whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((r, i) => (
                    <tr key={`${r.accountNumber}-${i}`}
                      className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="border border-gray-300 px-2 py-1 text-center whitespace-nowrap">
                        {r.accountNumber}
                      </td>
                      <td className="border border-gray-300 px-2 py-1 max-w-[180px] truncate"
                        title={r.customerName}>{r.customerName}</td>
                      <td className="border border-gray-300 px-2 py-1 max-w-[200px] truncate"
                        title={r.address}>{r.address}</td>
                      <td className="border border-gray-300 px-2 py-1 text-right">
                        {r.currentBalance}
                      </td>
                      <td className="border border-gray-300 px-2 py-1 text-right">
                        {r.kwhCharge}
                      </td>
                      <td className="border border-gray-300 px-2 py-1 text-right">
                        {r.averageConsumption}
                      </td>
                    </tr>
                  ))}
                  {reportData.length > 0 && (
                    <tr className="bg-gray-200 font-bold">
                      <td className="border border-gray-300 px-2 py-1 text-center" colSpan={3}>TOTAL</td>
                      <td className="border border-gray-300 px-2 py-1 text-right">{formatCurrency(totalBalance)}</td>
                      <td className="border border-gray-300 px-2 py-1 text-right">{formatKwh(totalKwh)}</td>
                      <td className="border border-gray-300 px-2 py-1" />
                    </tr>
                  )}
                </tbody>
              </table>
              {reportData.length > 0 && (
                <p className="text-xs text-gray-500 mt-2 text-right px-2">
                  Total records: {reportData.length.toLocaleString()}
                </p>
              )}
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

export default ListOfGovernmentAccounts;