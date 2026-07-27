import React, { useState, useEffect, useCallback } from "react";
import { FaFileDownload, FaPrint } from "react-icons/fa";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface AreaInfo {
  areaCode: string;
  areaName: string;
}

interface ProvinceInfo {
  provinceCode: string;
  provinceName: string;
}

interface RegionInfo {
  regionCode: string;
  regionName: string;
}

interface ReceivableRow {
  areaCode: string;
  areaName: string;
  openingBalance: string;
  monthlyCharge: string;
  debits: string;
  credits: string;
  underCharge: string;
  overCharge: string;
  payments: string;
  closingBalance: string;
  closingBalanceWithoutFinAcc: string;
  averageCharge: string;
  noOfMonthsInArrears: string;
  noOfMonthsInArrearsWithoutFinAcc: string;
  rawOpeningBalance: number;
  rawMonthlyCharge: number;
  rawDebits: number;
  rawCredits: number;
  rawUnderCharge: number;
  rawOverCharge: number;
  rawPayments: number;
  rawClosingBalance: number;
  rawClosingBalanceWithoutFinAcc: number;
  rawAverageCharge: number;
  rawNoOfMonthsInArrears: number;
  rawNoOfMonthsInArrearsWithoutFinAcc: number;
}

type ScopeType = "Province" | "Region" | "EntireCEB";

interface BillCycleOption {
  code: string;
  label: string;
  shortLabel: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
async function apiFetch<T>(url: string): Promise<{ data: T | null; errorMessage: string | null }> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      if (res.status === 404) throw new Error("API endpoint not found (404). Please check if the backend is running.");
      if (res.status === 500) throw new Error("Database error (500). Please check your database connection.");
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) throw new Error(`Expected JSON but got ${contentType}`);
    return await res.json();
  } catch (err: any) {
    if (err.name === "AbortError") return { data: null, errorMessage: "Request timeout. Please check your connection." };
    if (err.message?.includes("Failed to fetch"))
      return { data: null, errorMessage: "Cannot connect to server. Please ensure the backend is running." };
    return { data: null, errorMessage: err.message };
  }
}

const parseNumber = (value: any): number => {
  if (value === undefined || value === null || value === "") return 0;
  if (typeof value === "number") return value;
  const num = parseFloat(String(value).replace(/,/g, ""));
  return isNaN(num) ? 0 : num;
};

const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Reduce a raw cycle label like "Apr 26", "Apr-26", "Apr" down to just the
// 3-letter month abbreviation, e.g. "Apr" — used to build the short
// "452-Apr" style label used across reports (CSV / PDF / screenshots).
const toMonthAbbrev = (rawLabel: string): string => {
  const first = String(rawLabel).trim().split(/[\s-]+/)[0] ?? "";
  return first.slice(0, 3);
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
const ReceivablePosition: React.FC = () => {
  const maroon = "text-[#7A0000]";
  const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";

  const selectCls =
    "w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent";
  const disabledSelectCls =
    "w-full px-2 py-1.5 text-xs border rounded-md bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed";

  // ── Form state ──────────────────────────────────────────────────────────
  const [billType, setBillType] = useState<"O" | "B">("O");
  const [billCycleOptions, setBillCycleOptions] = useState<BillCycleOption[]>([]);
  const [selectedBillCycle, setSelectedBillCycle] = useState("");

  const [scopeType, setScopeType] = useState<ScopeType>("Province");
  const [provinces, setProvinces] = useState<ProvinceInfo[]>([]);
  const [regions, setRegions] = useState<RegionInfo[]>([]);
  const [scopeValue, setScopeValue] = useState("");

  // ── Loading / errors ────────────────────────────────────────────────────
  const [loadingCycles, setLoadingCycles] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("");

  const [cycleError, setCycleError] = useState<string | null>(null);
  const [scopeListError, setScopeListError] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  // ── Report state ────────────────────────────────────────────────────────
  const [reportData, setReportData] = useState<ReceivableRow[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [resolvedBillCycle, setResolvedBillCycle] = useState("");
  const [resolvedScopeLabel, setResolvedScopeLabel] = useState("");

  // ── 1. Fetch bill cycles whenever billType changes ─────────────────────
  useEffect(() => {
    const fetchCycles = async () => {
      setLoadingCycles(true);
      setCycleError(null);
      setSelectedBillCycle("");
      setBillCycleOptions([]);
      try {
        const response = await apiFetch<any>(`/misapi/api/receivable-position/billcycle/max?billType=${billType}`);
        if (response.errorMessage) {
          setCycleError(response.errorMessage);
          return;
        }
        const raw = response.data as any;
        const cycles: string[] = raw?.BillCycles ?? raw?.billCycles ?? [];
        const maxCycle: string = raw?.MaxBillCycle ?? raw?.maxBillCycle ?? "";
        const maxNum = parseInt(maxCycle, 10);
        if (!cycles.length || isNaN(maxNum)) {
          setCycleError("No bill cycle data found.");
          return;
        }
        const options: BillCycleOption[] = cycles.map((rawLabel, i) => {
          const code = String(maxNum - i);
          const monthAbbrev = toMonthAbbrev(rawLabel);
          return {
            code,
            label: `${code}-${rawLabel}`,
            shortLabel: `${code}-${monthAbbrev}`,
          };
        });
        setBillCycleOptions(options);
        setSelectedBillCycle(options[0].code);
      } catch (err: any) {
        setCycleError(err.message || "Failed to load bill cycles.");
      } finally {
        setLoadingCycles(false);
      }
    };
    fetchCycles();
  }, [billType]);

  // ── 2. Fetch provinces + regions whenever billType changes ─────────────
  useEffect(() => {
    const provUrl = billType === "B" ? `/misapi/api/bulk/province` : `/misapi/api/ordinary/province`;
    const regUrl = billType === "B" ? `/misapi/api/bulk/region` : `/misapi/api/ordinary/region`;

    setProvinces([]);
    setRegions([]);
    setScopeListError(null);

    (async () => {
      const [provRes, regRes] = await Promise.all([apiFetch<any[]>(provUrl), apiFetch<any[]>(regUrl)]);

      const errors: string[] = [];

      if (provRes.errorMessage) {
        errors.push(provRes.errorMessage);
      } else if (provRes.data && Array.isArray(provRes.data)) {
        setProvinces(
          provRes.data.map((p: any) => ({
            provinceCode: p.ProvinceCode ?? p.provinceCode ?? "",
            provinceName: p.ProvinceName ?? p.provinceName ?? "",
          }))
        );
      } else {
        errors.push("Failed to load provinces.");
      }

      if (regRes.errorMessage) {
        errors.push(regRes.errorMessage);
      } else if (regRes.data && Array.isArray(regRes.data)) {
        setRegions(
          regRes.data
            .map((r: any) => {
              const code = r.RegionCode ?? r.regionCode ?? "";
              const name = r.RegionName ?? r.regionName ?? code;
              return { regionCode: code, regionName: name };
            })
            .filter((r) => r.regionCode)
        );
      } else {
        errors.push("Failed to load regions.");
      }

      if (errors.length) {
        setScopeListError(errors.join(" "));
      }
    })();
  }, [billType]);

  // ── Reset scope value when scope type changes ───────────────────────────
  useEffect(() => {
    setScopeValue("");
    setScopeListError(null);
  }, [scopeType, billType]);

  // ── 3. Resolve area list for the current scope + billType + scopeValue ─
  const resolveAreaList = useCallback(async (): Promise<AreaInfo[]> => {
    if (scopeType === "EntireCEB") {
      const url = billType === "B" ? `/misapi/api/bulk/areas` : `/misapi/api/ordinary/areas`;
      const res = await apiFetch<any[]>(url);
      if (res.errorMessage || !res.data) throw new Error(res.errorMessage || "Failed to load areas.");
      return res.data.map((a: any) => ({
        areaCode: a.AreaCode ?? a.areaCode ?? "",
        areaName: a.AreaName ?? a.areaName ?? "",
      }));
    }

    if (scopeType === "Province") {
      const url = `/misapi/api/receivable-position/areas-by-province?provinceCode=${encodeURIComponent(scopeValue)}&billType=${billType}`;
      const res = await apiFetch<any[]>(url);
      if (res.errorMessage || !res.data) throw new Error(res.errorMessage || "Failed to load areas for province.");
      return res.data.map((a: any) => ({
        areaCode: a.AreaCode ?? a.areaCode ?? "",
        areaName: a.AreaName ?? a.areaName ?? "",
      }));
    }

    // Region
    const url = `/misapi/api/receivable-position/areas-by-region?regionCode=${encodeURIComponent(scopeValue)}&billType=${billType}`;
    const res = await apiFetch<any[]>(url);
    if (res.errorMessage || !res.data) throw new Error(res.errorMessage || "Failed to load areas for region.");
    return res.data.map((a: any) => ({
      areaCode: a.AreaCode ?? a.areaCode ?? "",
      areaName: a.AreaName ?? a.areaName ?? "",
    }));
  }, [scopeType, scopeValue, billType]);

  // ── 4. Fetch report: resolve areas, then loop report calls per area ────
  const fetchReport = useCallback(async () => {
    if (!selectedBillCycle) return;
    if (scopeType !== "EntireCEB" && !scopeValue) return;

    setLoadingReport(true);
    setReportError(null);
    setLoadingStatus("Resolving area list...");

    try {
      const areaList = await resolveAreaList();

      if (!areaList.length) {
        setReportError("No areas found for the selected scope.");
        return;
      }

      const rows: ReceivableRow[] = [];

      for (let i = 0; i < areaList.length; i++) {
        const area = areaList[i];
        setLoadingStatus(`Loading area ${i + 1} of ${areaList.length} (${area.areaCode})...`);

        const url = `/misapi/api/receivable-position/report?billCycle=${encodeURIComponent(
          selectedBillCycle
        )}&areaCode=${encodeURIComponent(area.areaCode)}&billType=${billType}`;

        const res = await apiFetch<any>(url);
        if (res.errorMessage || !res.data) continue; // skip areas with no data

        const raw = res.data as any;
        const arr: any[] = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
        const item = arr[0];
        if (!item) continue;

        rows.push({
          areaCode: item.AreaCode ?? item.areaCode ?? area.areaCode,
          areaName: area.areaName,
          openingBalance: String(item.OpeningBalance ?? item.openingBalance ?? "0.00"),
          monthlyCharge: String(item.MonthlyCharge ?? item.monthlyCharge ?? "0.00"),
          debits: String(item.Debits ?? item.debits ?? "0.00"),
          credits: String(item.Credits ?? item.credits ?? "0.00"),
          underCharge: String(item.UnderCharge ?? item.underCharge ?? "0.00"),
          overCharge: String(item.OverCharge ?? item.overCharge ?? "0.00"),
          payments: String(item.Payments ?? item.payments ?? "0.00"),
          closingBalance: String(item.ClosingBalance ?? item.closingBalance ?? "0.00"),
          closingBalanceWithoutFinAcc: String(item.ClosingBalanceWithoutFinAcc ?? item.closingBalanceWithoutFinAcc ?? "0.00"),
          averageCharge: String(item.AverageCharge ?? item.averageCharge ?? "0.00"),
          noOfMonthsInArrears: String(item.NoOfMonthsInArrears ?? item.noOfMonthsInArrears ?? "0.00"),
          noOfMonthsInArrearsWithoutFinAcc: String(
            item.NoOfMonthsInArrearsWithoutFinAcc ?? item.noOfMonthsInArrearsWithoutFinAcc ?? "0.00"
          ),
          rawOpeningBalance: parseNumber(item.RawOpeningBalance ?? item.rawOpeningBalance ?? item.OpeningBalance),
          rawMonthlyCharge: parseNumber(item.RawMonthlyCharge ?? item.rawMonthlyCharge ?? item.MonthlyCharge),
          rawDebits: parseNumber(item.RawDebits ?? item.rawDebits ?? item.Debits),
          rawCredits: parseNumber(item.RawCredits ?? item.rawCredits ?? item.Credits),
          rawUnderCharge: parseNumber(item.RawUnderCharge ?? item.rawUnderCharge ?? item.UnderCharge),
          rawOverCharge: parseNumber(item.RawOverCharge ?? item.rawOverCharge ?? item.OverCharge),
          rawPayments: parseNumber(item.RawPayments ?? item.rawPayments ?? item.Payments),
          rawClosingBalance: parseNumber(item.RawClosingBalance ?? item.rawClosingBalance ?? item.ClosingBalance),
          rawClosingBalanceWithoutFinAcc: parseNumber(
            item.RawClosingBalanceWithoutFinAcc ?? item.rawClosingBalanceWithoutFinAcc ?? item.ClosingBalanceWithoutFinAcc
          ),
          rawAverageCharge: parseNumber(item.RawAverageCharge ?? item.rawAverageCharge ?? item.AverageCharge),
          rawNoOfMonthsInArrears: parseNumber(item.RawNoOfMonthsInArrears ?? item.rawNoOfMonthsInArrears ?? item.NoOfMonthsInArrears),
          rawNoOfMonthsInArrearsWithoutFinAcc: parseNumber(
            item.RawNoOfMonthsInArrearsWithoutFinAcc ?? item.rawNoOfMonthsInArrearsWithoutFinAcc ?? item.NoOfMonthsInArrearsWithoutFinAcc
          ),
        });
      }

      if (!rows.length) {
        setReportError("No data found for the selected criteria.");
        return;
      }

      const cycleOpt = billCycleOptions.find((o) => o.code === selectedBillCycle);
      setResolvedBillCycle(cycleOpt?.shortLabel ?? selectedBillCycle);

      let scopeLabel = "Entire CEB";
      if (scopeType === "Province") {
        scopeLabel = provinces.find((p) => p.provinceCode === scopeValue)?.provinceName ?? scopeValue;
      } else if (scopeType === "Region") {
        scopeLabel = regions.find((r) => r.regionCode === scopeValue)?.regionName ?? scopeValue;
      }
      setResolvedScopeLabel(scopeLabel);

      setReportData(rows);
      setHasSearched(true);
    } catch (err: any) {
      setReportError(err.message || "Failed to fetch report data.");
    } finally {
      setLoadingReport(false);
      setLoadingStatus("");
    }
  }, [selectedBillCycle, scopeType, scopeValue, billType, resolveAreaList, billCycleOptions, provinces, regions]);

  // ── Totals ───────────────────────────────────────────────────────────────
  const totals = reportData.reduce(
    (acc, r) => {
      acc.openingBalance += r.rawOpeningBalance;
      acc.monthlyCharge += r.rawMonthlyCharge;
      acc.debits += r.rawDebits;
      acc.credits += r.rawCredits;
      acc.underCharge += r.rawUnderCharge;
      acc.overCharge += r.rawOverCharge;
      acc.payments += r.rawPayments;
      acc.closingBalance += r.rawClosingBalance;
      acc.closingBalanceWithoutFinAcc += r.rawClosingBalanceWithoutFinAcc;
      acc.averageCharge += r.rawAverageCharge;
      acc.noOfMonthsInArrears += r.rawNoOfMonthsInArrears;
      acc.noOfMonthsInArrearsWithoutFinAcc += r.rawNoOfMonthsInArrearsWithoutFinAcc;
      return acc;
    },
    {
      openingBalance: 0,
      monthlyCharge: 0,
      debits: 0,
      credits: 0,
      underCharge: 0,
      overCharge: 0,
      payments: 0,
      closingBalance: 0,
      closingBalanceWithoutFinAcc: 0,
      averageCharge: 0,
      noOfMonthsInArrears: 0,
      noOfMonthsInArrearsWithoutFinAcc: 0,
    }
  );

  const handleBackToForm = () => {
    setHasSearched(false);
    setReportData([]);
    setReportError(null);
  };

  // ── Export helpers ──────────────────────────────────────────────────────
  const escapeCsv = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const handleExportCsv = () => {
    if (!reportData.length) {
      setReportError("No data to export.");
      return;
    }

    const metaRows: (string | number)[][] = [
      ["Receivable Position"],
      ["Scope :", `${resolvedScopeLabel} (${scopeType})`],
      ["Customer Type :", billType === "B" ? "Bulk" : "Ordinary"],
      ["Bill Cycle :", resolvedBillCycle],
      [],
    ];

    const header = [
      "Area Code",
      "Area Name",
      "Opening Balance",
      "Monthly Charge",
      "Debits",
      "Credits",
      "Under Charge",
      "Over Charge",
      "Payments",
      "Closing Balance",
      "Closing Bal (W/O Fin Acc)",
      "Avg Charge",
      "No. Months Arrears",
      "No. Months Arrears (W/O Fin Acc)",
    ];
    const rows = reportData.map((r) => [
      r.areaCode,
      r.areaName,
      r.openingBalance,
      r.monthlyCharge,
      r.debits,
      r.credits,
      r.underCharge,
      r.overCharge,
      r.payments,
      r.closingBalance,
      r.closingBalanceWithoutFinAcc,
      r.averageCharge,
      r.noOfMonthsInArrears,
      r.noOfMonthsInArrearsWithoutFinAcc,
    ]);
    const totalRow = [
      "Total",
      "",
      fmt(totals.openingBalance),
      fmt(totals.monthlyCharge),
      fmt(totals.debits),
      fmt(totals.credits),
      fmt(totals.underCharge),
      fmt(totals.overCharge),
      fmt(totals.payments),
      fmt(totals.closingBalance),
      fmt(totals.closingBalanceWithoutFinAcc),
      fmt(totals.averageCharge),
      fmt(totals.noOfMonthsInArrears),
      fmt(totals.noOfMonthsInArrearsWithoutFinAcc),
    ];

    const csv = [...metaRows, header, ...rows, totalRow].map((row) => row.map(escapeCsv).join(",")).join("\r\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    link.download = `ReceivablePosition_${scopeValue || "EntireCEB"}_${resolvedBillCycle || selectedBillCycle}.csv`;
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPdf = () => {
    if (!reportData.length) {
      setReportError("No data to export.");
      return;
    }
    const title = "Receivable Position";
    const rowsHtml = reportData
      .map(
        (r) => `<tr>
      <td style="border:1px solid #ccc;padding:3px 4px;text-align:center;font-size:9px">${escapeCsv(r.areaCode)}</td>
      <td style="border:1px solid #ccc;padding:3px 4px;text-align:left;font-size:9px">${escapeCsv(r.areaName)}</td>
      <td style="border:1px solid #ccc;padding:3px 4px;text-align:right;font-size:9px">${r.openingBalance}</td>
      <td style="border:1px solid #ccc;padding:3px 4px;text-align:right;font-size:9px">${r.monthlyCharge}</td>
      <td style="border:1px solid #ccc;padding:3px 4px;text-align:right;font-size:9px">${r.debits}</td>
      <td style="border:1px solid #ccc;padding:3px 4px;text-align:right;font-size:9px">${r.credits}</td>
      <td style="border:1px solid #ccc;padding:3px 4px;text-align:right;font-size:9px">${r.underCharge}</td>
      <td style="border:1px solid #ccc;padding:3px 4px;text-align:right;font-size:9px">${r.overCharge}</td>
      <td style="border:1px solid #ccc;padding:3px 4px;text-align:right;font-size:9px">${r.payments}</td>
      <td style="border:1px solid #ccc;padding:3px 4px;text-align:right;font-size:9px">${r.closingBalance}</td>
      <td style="border:1px solid #ccc;padding:3px 4px;text-align:right;font-size:9px">${r.closingBalanceWithoutFinAcc}</td>
      <td style="border:1px solid #ccc;padding:3px 4px;text-align:right;font-size:9px">${r.averageCharge}</td>
      <td style="border:1px solid #ccc;padding:3px 4px;text-align:right;font-size:9px">${r.noOfMonthsInArrears}</td>
      <td style="border:1px solid #ccc;padding:3px 4px;text-align:right;font-size:9px">${r.noOfMonthsInArrearsWithoutFinAcc}</td>
    </tr>`
      )
      .join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title>
<style>
  body{font-family:Arial,sans-serif;margin:8mm;color:#111}
  h2{color:#7A0000;font-size:13px;margin-bottom:6px}
  .meta{font-size:11px;margin-bottom:10px}
  .meta span{font-weight:bold}
  table{width:100%;border-collapse:collapse;margin-top:6px}
  th{background:#d3d3d3;font-weight:bold;text-align:center;padding:4px 3px;border:1px solid #aaa;font-size:9px}
  td{padding:3px;border:1px solid #ccc;font-size:9px;vertical-align:top}
  tr:nth-child(even){background:#f9f9f9}
  .total-row td{background:#d3d3d3;font-weight:bold}
  @page{size:A4 landscape;margin:8mm}
</style>
</head><body>
<h2>${title}</h2>
<div class="meta">Scope : &nbsp;<span>${resolvedScopeLabel}</span> (${scopeType}) &nbsp;|&nbsp; Customer Type : &nbsp;<span>${
      billType === "B" ? "Bulk" : "Ordinary"
    }</span><br>Bill Cycle : &nbsp;<span>${resolvedBillCycle}</span></div>
<table><thead><tr>
  <th>Area</th><th>Area Name</th>
  <th>Opening Bal</th><th>Monthly Chg</th><th>Debits</th><th>Credits</th>
  <th>Under Chg</th><th>Over Chg</th><th>Payments</th>
  <th>Closing Bal</th><th>Closing Bal (W/O Fin)</th><th>Avg Chg</th>
  <th>Mths Arrears</th><th>Mths Arrears (W/O Fin)</th>
</tr></thead>
<tbody>${rowsHtml}</tbody>
<tfoot><tr class="total-row">
  <td colspan="2"><b>Total</b></td>
  <td style="text-align:right"><b>${fmt(totals.openingBalance)}</b></td>
  <td style="text-align:right"><b>${fmt(totals.monthlyCharge)}</b></td>
  <td style="text-align:right"><b>${fmt(totals.debits)}</b></td>
  <td style="text-align:right"><b>${fmt(totals.credits)}</b></td>
  <td style="text-align:right"><b>${fmt(totals.underCharge)}</b></td>
  <td style="text-align:right"><b>${fmt(totals.overCharge)}</b></td>
  <td style="text-align:right"><b>${fmt(totals.payments)}</b></td>
  <td style="text-align:right"><b>${fmt(totals.closingBalance)}</b></td>
  <td style="text-align:right"><b>${fmt(totals.closingBalanceWithoutFinAcc)}</b></td>
  <td style="text-align:right"><b>${fmt(totals.averageCharge)}</b></td>
  <td style="text-align:right"><b>${fmt(totals.noOfMonthsInArrears)}</b></td>
  <td style="text-align:right"><b>${fmt(totals.noOfMonthsInArrearsWithoutFinAcc)}</b></td>
</tr></tfoot>
</table></body></html>`;
    const w = window.open("", "_blank");
    if (!w) {
      setReportError("Popup blocked. Please allow popups to export PDF.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => {
      w.print();
      setTimeout(() => w.close(), 500);
    }, 250);
  };

  const canSubmit = !!selectedBillCycle && (scopeType === "EntireCEB" || !!scopeValue) && !loadingReport;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-4 bg-white rounded-lg shadow-sm">
      {!hasSearched && (
        <>
          <h1 className={`text-xl font-bold ${maroon} mb-4`}>Receivable Position</h1>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Month */}
            <div className="flex flex-col">
              <label className={`text-xs font-medium mb-1 ${maroon}`}>Month:</label>
              {loadingCycles ? (
                <div className={selectCls + " bg-gray-50 text-gray-500"}>Loading bill cycles...</div>
              ) : cycleError ? (
                <div className="w-full px-2 py-1.5 text-xs border border-red-300 rounded-md bg-red-50 text-red-600">
                  {cycleError}
                </div>
              ) : (
                <select value={selectedBillCycle} onChange={(e) => setSelectedBillCycle(e.target.value)} className={selectCls}>
                  {billCycleOptions.map((o) => (
                    <option key={o.code} value={o.code}>
                      {o.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Customer Type */}
            <div className="flex flex-col">
              <label className={`text-xs font-medium mb-1 ${maroon}`}>Customer Type:</label>
              <select value={billType} onChange={(e) => setBillType(e.target.value as "O" | "B")} className={selectCls}>
                <option value="O">Ordinary Customers</option>
                <option value="B">Bulk Customers</option>
              </select>
            </div>

            {/* Scope type */}
            <div className="flex flex-col">
              <label className={`text-xs font-medium mb-1 ${maroon}`}>Select Category:</label>
              <select value={scopeType} onChange={(e) => setScopeType(e.target.value as ScopeType)} className={selectCls}>
                <option value="Province">Province</option>
                <option value="Region">Region</option>
                <option value="EntireCEB">Entire CEB</option>
              </select>
            </div>

            {/* Scope value */}
            {scopeType !== "EntireCEB" && (
              <div className="flex flex-col">
                <label className={`text-xs font-medium mb-1 ${maroon}`}>
                  Select {scopeType === "Province" ? "Province" : "Region"}:
                </label>

                {scopeType === "Province" && (
                  <select value={scopeValue} onChange={(e) => setScopeValue(e.target.value)} className={selectCls}>
                    <option value="">Select Province</option>
                    {provinces.map((p) => (
                      <option key={p.provinceCode} value={p.provinceCode}>
                        {p.provinceName}
                      </option>
                    ))}
                  </select>
                )}

                {scopeType === "Region" && (
                  <select value={scopeValue} onChange={(e) => setScopeValue(e.target.value)} className={selectCls}>
                    <option value="">Select Region</option>
                    {regions.map((r) => (
                      <option key={r.regionCode} value={r.regionCode}>
                        {r.regionName || r.regionCode}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {scopeType === "EntireCEB" && (
              <div className="flex flex-col">
                <label className={`text-xs font-medium mb-1 text-gray-400`}>Select Area:</label>
                <div className={disabledSelectCls}>All areas island-wide</div>
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="w-full mt-6 flex justify-end">
            <button
              onClick={fetchReport}
              disabled={!canSubmit}
              className={`px-6 py-2 rounded-md font-medium transition-opacity duration-300 shadow
                ${maroonGrad} text-white
                ${!canSubmit ? "opacity-70 cursor-not-allowed" : "hover:opacity-90"}`}
            >
              {loadingReport ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {loadingStatus || "Loading..."}
                </span>
              ) : (
                "Generate Report"
              )}
            </button>
          </div>

          {reportError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">{reportError}</div>
          )}
          {scopeListError && (
            <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">{scopeListError}</div>
          )}
        </>
      )}

      {hasSearched && (
        <div className="mt-2">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
            <div>
              <h2 className={`text-lg font-bold ${maroon}`}>Receivable Position</h2>
              <p className="text-sm text-gray-600 mt-1">
                {resolvedScopeLabel} ({scopeType}) | {billType === "B" ? "Bulk" : "Ordinary"} | Bill Cycle: {resolvedBillCycle}
              </p>
            </div>

            <div className="flex space-x-2 mt-2 md:mt-0">
              <button
                onClick={handleExportCsv}
                disabled={!reportData.length}
                className={`flex items-center gap-1 px-3 py-1.5 border border-blue-400 rounded-md text-xs font-medium shadow-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-200 transition
                  ${!reportData.length ? "text-blue-300 bg-gray-50 cursor-not-allowed" : "text-blue-700 bg-white hover:bg-blue-50 hover:text-blue-800"}`}
              >
                <FaFileDownload className="w-3 h-3" /> CSV
              </button>
              <button
                onClick={handleExportPdf}
                disabled={!reportData.length}
                className={`flex items-center gap-1 px-3 py-1.5 border border-green-400 rounded-md text-xs font-medium shadow-sm
                  focus:outline-none focus:ring-2 focus:ring-green-200 transition
                  ${!reportData.length ? "text-green-300 bg-gray-50 cursor-not-allowed" : "text-green-700 bg-white hover:bg-green-50 hover:text-green-800"}`}
              >
                <FaPrint className="w-3 h-3" /> PDF
              </button>
              <button
                onClick={handleBackToForm}
                className="px-4 py-1.5 bg-[#7A0000] hover:bg-[#A52A2A] text-xs rounded-md text-white"
              >
                Back to Form
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[calc(100vh-250px)] border border-gray-300 rounded-lg">
            <div className="min-w-full py-4">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-100 text-gray-800 sticky top-0">
                    <th className="border border-gray-300 px-2 py-2 text-center font-bold">Area</th>
                    <th className="border border-gray-300 px-2 py-2 text-left font-bold">Area Name</th>
                    <th className="border border-gray-300 px-2 py-2 text-right font-bold">Opening Bal</th>
                    <th className="border border-gray-300 px-2 py-2 text-right font-bold">Monthly Chg</th>
                    <th className="border border-gray-300 px-2 py-2 text-right font-bold">Debits</th>
                    <th className="border border-gray-300 px-2 py-2 text-right font-bold">Credits</th>
                    <th className="border border-gray-300 px-2 py-2 text-right font-bold">Under Chg</th>
                    <th className="border border-gray-300 px-2 py-2 text-right font-bold">Over Chg</th>
                    <th className="border border-gray-300 px-2 py-2 text-right font-bold">Payments</th>
                    <th className="border border-gray-300 px-2 py-2 text-right font-bold">Closing Bal</th>
                    <th className="border border-gray-300 px-2 py-2 text-right font-bold">Closing Bal (W/O Fin)</th>
                    <th className="border border-gray-300 px-2 py-2 text-right font-bold">Avg Chg</th>
                    <th className="border border-gray-300 px-2 py-2 text-right font-bold">Mths Arrears</th>
                    <th className="border border-gray-300 px-2 py-2 text-right font-bold">Mths Arrears (W/O Fin)</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((r, i) => (
                    <tr key={`${r.areaCode}-${i}`} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="border border-gray-300 px-2 py-1 text-center font-mono">{r.areaCode}</td>
                      <td className="border border-gray-300 px-2 py-1 text-left">{r.areaName}</td>
                      <td className="border border-gray-300 px-2 py-1 text-right font-mono">{r.openingBalance}</td>
                      <td className="border border-gray-300 px-2 py-1 text-right font-mono">{r.monthlyCharge}</td>
                      <td className="border border-gray-300 px-2 py-1 text-right font-mono">{r.debits}</td>
                      <td className="border border-gray-300 px-2 py-1 text-right font-mono">{r.credits}</td>
                      <td className="border border-gray-300 px-2 py-1 text-right font-mono">{r.underCharge}</td>
                      <td className="border border-gray-300 px-2 py-1 text-right font-mono">{r.overCharge}</td>
                      <td className="border border-gray-300 px-2 py-1 text-right font-mono">{r.payments}</td>
                      <td className="border border-gray-300 px-2 py-1 text-right font-mono">{r.closingBalance}</td>
                      <td className="border border-gray-300 px-2 py-1 text-right font-mono">{r.closingBalanceWithoutFinAcc}</td>
                      <td className="border border-gray-300 px-2 py-1 text-right font-mono">{r.averageCharge}</td>
                      <td className="border border-gray-300 px-2 py-1 text-right font-mono">{r.noOfMonthsInArrears}</td>
                      <td className="border border-gray-300 px-2 py-1 text-right font-mono">{r.noOfMonthsInArrearsWithoutFinAcc}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-200 font-bold sticky bottom-0">
                    <td colSpan={2} className="border border-gray-300 px-2 py-2 text-center font-bold">
                      TOTAL
                    </td>
                    <td className="border border-gray-300 px-2 py-2 text-right font-mono font-bold">{fmt(totals.openingBalance)}</td>
                    <td className="border border-gray-300 px-2 py-2 text-right font-mono font-bold">{fmt(totals.monthlyCharge)}</td>
                    <td className="border border-gray-300 px-2 py-2 text-right font-mono font-bold">{fmt(totals.debits)}</td>
                    <td className="border border-gray-300 px-2 py-2 text-right font-mono font-bold">{fmt(totals.credits)}</td>
                    <td className="border border-gray-300 px-2 py-2 text-right font-mono font-bold">{fmt(totals.underCharge)}</td>
                    <td className="border border-gray-300 px-2 py-2 text-right font-mono font-bold">{fmt(totals.overCharge)}</td>
                    <td className="border border-gray-300 px-2 py-2 text-right font-mono font-bold">{fmt(totals.payments)}</td>
                    <td className="border border-gray-300 px-2 py-2 text-right font-mono font-bold">{fmt(totals.closingBalance)}</td>
                    <td className="border border-gray-300 px-2 py-2 text-right font-mono font-bold">
                      {fmt(totals.closingBalanceWithoutFinAcc)}
                    </td>
                    <td className="border border-gray-300 px-2 py-2 text-right font-mono font-bold">{fmt(totals.averageCharge)}</td>
                    <td className="border border-gray-300 px-2 py-2 text-right font-mono font-bold">{fmt(totals.noOfMonthsInArrears)}</td>
                    <td className="border border-gray-300 px-2 py-2 text-right font-mono font-bold">
                      {fmt(totals.noOfMonthsInArrearsWithoutFinAcc)}
                    </td>
                  </tr>
                </tfoot>
              </table>
              {reportData.length > 0 && (
                <p className="text-xs text-gray-500 mt-2 text-right px-2">Total areas: {reportData.length.toLocaleString()}</p>
              )}
            </div>
          </div>

          {reportError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">{reportError}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReceivablePosition;