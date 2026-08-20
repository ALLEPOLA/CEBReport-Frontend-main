import React, { useState, useEffect, useMemo, useRef } from "react";
import { FaFileDownload, FaPrint } from "react-icons/fa";
import { useReportScope } from "../../hooks/useReportScope";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface BillCycleOption {
  display: string; // "450-Feb 26"
  code: string; // "450"
}

interface ProvinceOption {
  ProvinceCode: string;
  ProvinceName: string;
}

interface RegionOption {
  RegionCode: string;
  RegionName: string;
}

type ReportType = "Province" | "Region" | "EntireCEB";

interface SalesRow {
  regionCode: string;
  regionName: string;
  areaCode: string;
  areaName: string;
  rawOrdinarySupplyNet: number;
  rawHeavySupplyNet: number;
  rawTotalNetSales: number;
  rawOrdinarySupplyCollections: number;
  rawBulkSupplyCollections: number;
  rawCollectionsOnSales: number;
  rawPercentCollections: number;
}

interface RegionGroup {
  regionCode: string;
  regionName: string;
  rows: SalesRow[];
  subTotal: {
    ordinarySupplyNet: number;
    heavySupplyNet: number;
    totalNetSales: number;
    ordinarySupplyCollections: number;
    bulkSupplyCollections: number;
    collectionsOnSales: number;
    percentCollections: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const fmt = (num: number, decimals = 2) =>
  num.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const parseNumber = (value: any): number => {
  if (value === undefined || value === null || value === "") return 0;
  if (typeof value === "number") return value;
  const num = parseFloat(String(value).replace(/,/g, ""));
  return isNaN(num) ? 0 : num;
};

// Reduce a raw cycle label like "Feb 2026", "Feb-26", "Feb" down to just the
// 3-letter month abbreviation — used to build the "450-Feb 26" style label.
const toMonthAbbrev = (rawLabel: string): string => {
  const first = String(rawLabel).trim().split(/[\s-]+/)[0] ?? "";
  return first.slice(0, 3);
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
const SalesAndCollection: React.FC = () => {
  const maroon = "text-[#7A0000]";
  const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";

  const selectCls =
    "w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent";
  const disabledSelectCls =
    "w-full px-2 py-1.5 text-xs border rounded-md bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed";

  // ── LBAC (level-based access control) ────────────────────────────────────────
  const { level, locked } = useReportScope();

  const isFullAccess = level >= 80;              // Entire CEB
  const isRegionLocked = level >= 70 && level < 80;  // Region
  const isProvinceLocked = level >= 60 && level < 70; // Province
  const isAreaLocked = level < 60;                 // Area (finest scope; report has no Area mode, so pinned to own Province then client-filtered to own Area)

  const lockedProvinceCode = locked["Province"]?.code || "";
  const lockedProvinceName = locked["Province"]?.name || "";
  const lockedRegionCode = locked["Region"]?.code || "";
  const lockedAreaCode = locked["Area"]?.code || "";
  const lockedAreaName = locked["Area"]?.name || "";

  // Which "Select Category" tabs the user is allowed to pick
  const allowedReportTypes: ReportType[] = isFullAccess
    ? ["Province", "Region", "EntireCEB"]
    : isRegionLocked
    ? ["Region"]
    : ["Province"]; // covers Province-level and Area-level users

  // ── Form state ─────────────────────────────────────────────────────────────
  const [billCycle, setBillCycle] = useState<string>("");
  const [reportType, setReportType] = useState<ReportType>("Province");
  const [provinceCode, setProvinceCode] = useState<string>("");
  const [regionCode, setRegionCode] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // ── Dropdown data ──────────────────────────────────────────────────────────
  const [billCycleOptions, setBillCycleOptions] = useState<BillCycleOption[]>([]);
  const [provinces, setProvinces] = useState<ProvinceOption[]>([]);
  const [regions, setRegions] = useState<RegionOption[]>([]);

  // ── Loading / error states ─────────────────────────────────────────────────
  const [isLoadingCycles, setIsLoadingCycles] = useState(false);
  const [isLoadingGeo, setIsLoadingGeo] = useState(false);
  const [cycleError, setCycleError] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  // ── Report state ───────────────────────────────────────────────────────────
  const [reportData, setReportData] = useState<SalesRow[]>([]);
  const [reportVisible, setReportVisible] = useState(false);
  const [selectedBillCycleDisplay, setSelectedBillCycleDisplay] = useState<string>("");
  const [selectedSubLabel, setSelectedSubLabel] = useState<string>("");

  const printRef = useRef<HTMLDivElement>(null);

  // ── Generic fetch helper ───────────────────────────────────────────────────
  const fetchWithErrorHandling = async (url: string) => {
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      let errorMsg = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData?.errorMessage) errorMsg = errorData.errorMessage;
      } catch {
        errorMsg = response.statusText;
      }
      throw new Error(errorMsg);
    }
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error(`Expected JSON but got ${contentType}`);
    }
    return await response.json();
  };

  // ── 1. Fetch bill cycles on mount ───────────────────────────────────────────
  useEffect(() => {
    const fetchBillCycles = async () => {
      setIsLoadingCycles(true);
      setCycleError(null);
      try {
        const response = await fetchWithErrorHandling(`/misapi/api/receivable-position/billcycle/max?billType=O`);
        const raw = response?.data ?? response;
        const cycles: string[] = raw?.BillCycles ?? raw?.billCycles ?? [];
        const maxCycle: string = raw?.MaxBillCycle ?? raw?.maxBillCycle ?? "";
        const maxNum = parseInt(maxCycle, 10);
        if (!cycles.length || isNaN(maxNum)) {
          setCycleError("No bill cycle data found.");
          return;
        }
        const options: BillCycleOption[] = cycles.map((rawLabel, i) => {
          const code = String(maxNum - i);
          return { code, display: `${code}-${toMonthAbbrev(rawLabel)} ${rawLabel.slice(-2)}` };
        });
        setBillCycleOptions(options);
        setBillCycle(options[0].code);
      } catch (err: any) {
        setCycleError(err.message || "Failed to load bill cycles.");
      } finally {
        setIsLoadingCycles(false);
      }
    };
    fetchBillCycles();
  }, []);

  // ── 2. Fetch regions + provinces on mount ───────────────────────────────────
  useEffect(() => {
    const fetchGeo = async () => {
      setIsLoadingGeo(true);
      setGeoError(null);
      try {
        const [regRes, provRes] = await Promise.all([
          fetchWithErrorHandling(`/misapi/api/ordinary/region`),
          fetchWithErrorHandling(`/misapi/api/ordinary/province`),
        ]);

        const regArr = regRes?.data ?? regRes ?? [];
        const provArr = provRes?.data ?? provRes ?? [];

        setRegions(
          (Array.isArray(regArr) ? regArr : []).map((r: any) => ({
            RegionCode: r.RegionCode ?? r.regionCode ?? "",
            RegionName: r.RegionName ?? r.regionName ?? "",
          })).filter((r: RegionOption) => r.RegionCode)
        );
        setProvinces(
          (Array.isArray(provArr) ? provArr : []).map((p: any) => ({
            ProvinceCode: p.ProvinceCode ?? p.provinceCode ?? "",
            ProvinceName: p.ProvinceName ?? p.provinceName ?? "",
          })).filter((p: ProvinceOption) => p.ProvinceCode)
        );
      } catch (err: any) {
        setGeoError(err.message || "Failed to load province/region lists.");
      } finally {
        setIsLoadingGeo(false);
      }
    };
    fetchGeo();
  }, []);

  // ── Reset sub-filters when reportType changes (respects LBAC locks) ─────────
  useEffect(() => {
    setProvinceCode(reportType === "Province" && (isProvinceLocked || isAreaLocked) ? lockedProvinceCode : "");
    setRegionCode(reportType === "Region" && isRegionLocked ? lockedRegionCode : "");
  }, [reportType, isProvinceLocked, isAreaLocked, isRegionLocked, lockedProvinceCode, lockedRegionCode]);

  // ── Enforce LBAC: pin the category itself for restricted levels ─────────────
  useEffect(() => {
    if (isRegionLocked) {
      setReportType("Region");
    } else if (isProvinceLocked || isAreaLocked) {
      setReportType("Province");
    }
    // Full-access users keep whatever category they've picked
  }, [level, isRegionLocked, isProvinceLocked, isAreaLocked]);

  // ── Submit guard ───────────────────────────────────────────────────────────
  const canSubmit =
    !!billCycle &&
    !loading &&
    (reportType === "EntireCEB" || (reportType === "Province" ? !!provinceCode : !!regionCode));

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setReportError(null);

    try {
      const params = new URLSearchParams();
      params.set("billCycle", billCycle);
      params.set("reportType", reportType);
      if (reportType === "Province") params.set("provinceCode", provinceCode);
      if (reportType === "Region") params.set("regionCode", regionCode);

      const response = await fetchWithErrorHandling(`/misapi/api/sales-collection/report?${params.toString()}`);

      if (response?.errorMessage) {
        setReportError(response.errorMessage);
        return;
      }

      const arr: any[] = Array.isArray(response) ? response : Array.isArray(response?.data) ? response.data : [];

      if (!arr.length) {
        setReportError("No data available for the selected criteria.");
        return;
      }

      // One-time diagnostic: log the exact keys the API actually returned,
      // so a future field-name mismatch (like Heavy vs Bulk) is easy to spot.
      // (No process.env check here — this project has no Node type defs;
      // it's just a console.debug, so it's harmless to leave in.)
      console.debug("[SalesAndCollection] raw report row keys:", Object.keys(arr[0]), arr[0]);

      const rows: SalesRow[] = arr.map((item: any) => {
        const ordinaryNet = parseNumber(item.OrdinarySupplyNet ?? item.ordinarySupplyNet ?? item.OrdinarySupply ?? item.ordinarySupply);
        // "Heavy" (net side) and "Bulk" (collections side) refer to the same
        // customer category in this API — some responses use one term, some
        // the other — so both are tried here.
        const heavyNet = parseNumber(
          item.HeavySupplyNet ??
            item.heavySupplyNet ??
            item.HeavySupply ??
            item.heavySupply ??
            item.BulkSupplyNet ??
            item.bulkSupplyNet ??
            item.BulkSupply ??
            item.bulkSupply
        );
        const ordinaryColl = parseNumber(
          item.OrdinarySupplyCollections ?? item.ordinarySupplyCollections ?? item.OrdinaryCollection ?? item.ordinaryCollection
        );
        const bulkColl = parseNumber(item.BulkSupplyCollections ?? item.bulkSupplyCollections ?? item.BulkCollection ?? item.bulkCollection);
        const totalNetSales = parseNumber(item.TotalNetSales ?? item.totalNetSales) || ordinaryNet + heavyNet;
        const collectionsOnSales = parseNumber(item.TotalCollections ?? item.totalCollections ?? item.CollectionsOnSales ?? item.collectionsOnSales) || ordinaryColl + bulkColl;
        const percentCollections =
          parseNumber(item.CollectionPercentage ?? item.collectionPercentage ?? item.PercentCollections ?? item.percentCollections) ||
          (totalNetSales !== 0 ? (collectionsOnSales / totalNetSales) * 100 : 0);

        return {
          regionCode: String(item.RegionCode ?? item.regionCode ?? ""),
          regionName: String(item.RegionName ?? item.regionName ?? item.RegionCode ?? item.regionCode ?? ""),
          areaCode: String(item.AreaCode ?? item.areaCode ?? ""),
          areaName: String(item.AreaName ?? item.areaName ?? ""),
          rawOrdinarySupplyNet: ordinaryNet,
          rawHeavySupplyNet: heavyNet,
          rawTotalNetSales: totalNetSales,
          rawOrdinarySupplyCollections: ordinaryColl,
          rawBulkSupplyCollections: bulkColl,
          rawCollectionsOnSales: collectionsOnSales,
          rawPercentCollections: percentCollections,
        };
      });

      // Area-level users only ever see their own area's row, even though the
      // API call itself is scoped at Province granularity.
      const scopedRows =
        isAreaLocked && lockedAreaCode
          ? rows.filter((r) => r.areaCode.trim().toLowerCase() === lockedAreaCode.trim().toLowerCase())
          : rows;

      if (isAreaLocked && !scopedRows.length) {
        setReportError("No data available for your area in the selected criteria.");
        return;
      }

      setReportData(scopedRows);
      setReportVisible(true);

      const opt = billCycleOptions.find((o) => o.code === billCycle);
      setSelectedBillCycleDisplay(opt?.display ?? billCycle);

      if (reportType === "Province") {
        const prov = provinces.find((p) => p.ProvinceCode === provinceCode);
        setSelectedSubLabel(prov?.ProvinceName ?? provinceCode);
      } else if (reportType === "Region") {
        const reg = regions.find((r) => r.RegionCode === regionCode);
        setSelectedSubLabel(reg ? `${reg.RegionCode} - ${reg.RegionName}` : regionCode);
      } else {
        setSelectedSubLabel("Entire CEB");
      }
    } catch (err: any) {
      setReportError(err.message || "Failed to generate report. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Group rows by region (matches the "Sub Total" region banding in FR4) ────
  const groups: RegionGroup[] = useMemo(() => {
    const map = new Map<string, RegionGroup>();
    reportData.forEach((row) => {
      const key = row.regionCode || "__single__";
      if (!map.has(key)) {
        map.set(key, {
          regionCode: row.regionCode,
          regionName: row.regionName,
          rows: [],
          subTotal: {
            ordinarySupplyNet: 0,
            heavySupplyNet: 0,
            totalNetSales: 0,
            ordinarySupplyCollections: 0,
            bulkSupplyCollections: 0,
            collectionsOnSales: 0,
            percentCollections: 0,
          },
        });
      }
      const grp = map.get(key)!;
      grp.rows.push(row);
      grp.subTotal.ordinarySupplyNet += row.rawOrdinarySupplyNet;
      grp.subTotal.heavySupplyNet += row.rawHeavySupplyNet;
      grp.subTotal.totalNetSales += row.rawTotalNetSales;
      grp.subTotal.ordinarySupplyCollections += row.rawOrdinarySupplyCollections;
      grp.subTotal.bulkSupplyCollections += row.rawBulkSupplyCollections;
      grp.subTotal.collectionsOnSales += row.rawCollectionsOnSales;
    });
    map.forEach((grp) => {
      grp.subTotal.percentCollections =
        grp.subTotal.totalNetSales !== 0 ? (grp.subTotal.collectionsOnSales / grp.subTotal.totalNetSales) * 100 : 0;
    });
    return Array.from(map.values());
  }, [reportData]);

  // ── Grand totals ─────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const t = reportData.reduce(
      (acc, r) => {
        acc.ordinarySupplyNet += r.rawOrdinarySupplyNet;
        acc.heavySupplyNet += r.rawHeavySupplyNet;
        acc.totalNetSales += r.rawTotalNetSales;
        acc.ordinarySupplyCollections += r.rawOrdinarySupplyCollections;
        acc.bulkSupplyCollections += r.rawBulkSupplyCollections;
        acc.collectionsOnSales += r.rawCollectionsOnSales;
        return acc;
      },
      {
        ordinarySupplyNet: 0,
        heavySupplyNet: 0,
        totalNetSales: 0,
        ordinarySupplyCollections: 0,
        bulkSupplyCollections: 0,
        collectionsOnSales: 0,
        percentCollections: 0,
      }
    );
    t.percentCollections = t.totalNetSales !== 0 ? (t.collectionsOnSales / t.totalNetSales) * 100 : 0;
    return t;
  }, [reportData]);

  // ── CSV Export ─────────────────────────────────────────────────────────────
  const downloadAsCSV = () => {
    if (!reportData.length) return;

    const headers = [
      "Region",
      "Area",
      "Ordinary Supply (Net)",
      "Heavy Supply (Net)",
      "Total Net Sales (without Street Lights)",
      "Ordinary Supply (Collections)",
      "Bulk Supply (Collections)",
      "Collections on Sales (Without Street Lights)",
      "% of Collections on Sales (Without Street Lights)",
    ];

    const rows: (string | number)[][] = [];
    groups.forEach((grp) => {
      grp.rows.forEach((r, i) => {
        rows.push([
          i === 0 ? grp.regionCode : "",
          r.areaName,
          fmt(r.rawOrdinarySupplyNet),
          fmt(r.rawHeavySupplyNet),
          fmt(r.rawTotalNetSales),
          fmt(r.rawOrdinarySupplyCollections),
          fmt(r.rawBulkSupplyCollections),
          fmt(r.rawCollectionsOnSales),
          fmt(r.rawPercentCollections),
        ]);
      });
      rows.push([
        "",
        "Sub Total",
        fmt(grp.subTotal.ordinarySupplyNet),
        fmt(grp.subTotal.heavySupplyNet),
        fmt(grp.subTotal.totalNetSales),
        fmt(grp.subTotal.ordinarySupplyCollections),
        fmt(grp.subTotal.bulkSupplyCollections),
        fmt(grp.subTotal.collectionsOnSales),
        fmt(grp.subTotal.percentCollections),
      ]);
    });

    const totalsRow = [
      "",
      "Total",
      fmt(totals.ordinarySupplyNet),
      fmt(totals.heavySupplyNet),
      fmt(totals.totalNetSales),
      fmt(totals.ordinarySupplyCollections),
      fmt(totals.bulkSupplyCollections),
      fmt(totals.collectionsOnSales),
      fmt(totals.percentCollections),
    ];

    const csv = [
      ["Sales & Collections"],
      ["Bill Cycle:", selectedBillCycleDisplay],
      ["Scope:", selectedSubLabel],
      [],
      headers,
      ...rows,
      totalsRow,
    ]
      .map((row) => row.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    link.download = `SalesCollection_${billCycle}_${reportType}.csv`;
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── Print PDF (prints the rendered on-screen table for exact visual parity) ─
  const printPDF = () => {
    if (!printRef.current) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html><head>
        <title>Sales & Collections</title>
        <style>
          body  { font-family: Arial, sans-serif; font-size: 10px; margin: 10mm; }
          h2    { color: #7A0000; font-size: 13px; margin-bottom: 6px; }
          .meta { font-size: 11px; margin-bottom: 12px; }
          .meta span { font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th    { background: #d3d3d3; font-weight: bold; text-align: center;
                  padding: 5px 4px; border: 1px solid #aaa; font-size: 9px; }
          td    { padding: 3px 4px; border: 1px solid #ccc; font-size: 9px; vertical-align: top; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          @page { size: A4 landscape; margin: 8mm; }
        </style>
      </head><body>
        <h2>Sales &amp; Collections (In Rupees)</h2>
        <div class="meta">
          Bill Cycle : &nbsp;<span>${selectedBillCycleDisplay}</span><br>
          Scope : &nbsp;<span>${selectedSubLabel}</span> (${reportType === "EntireCEB" ? "Entire CEB" : reportType})
        </div>
        ${printRef.current.innerHTML}
      </body></html>
    `);
    w.document.close();
    w.focus();
    setTimeout(() => {
      w.print();
      w.close();
    }, 500);
  };

  // ── Table ──────────────────────────────────────────────────────────────────
  const renderTable = () => {
    if (!reportData.length) {
      return <div className="text-center py-10 text-gray-500 text-sm">No records found for the selected criteria.</div>;
    }

    return (
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-gray-100 text-gray-800 sticky top-0">
            <th className="border border-gray-300 px-2 py-2 text-center font-bold w-10"></th>
            <th className="border border-gray-300 px-2 py-2 text-center font-bold">Area</th>
            <th className="border border-gray-300 px-2 py-2 text-center font-bold">
              Ordinary Supply
              <br />
              (Net)
            </th>
            <th className="border border-gray-300 px-2 py-2 text-center font-bold">
              Heavy Supply
              <br />
              (Net)
            </th>
            <th className="border border-gray-300 px-2 py-2 text-center font-bold">
              Total Net Sales
              <br />
              (without Street Lights)
            </th>
            <th className="border border-gray-300 px-2 py-2 text-center font-bold">
              Ordinary Supply
              <br />
              (Collections)
            </th>
            <th className="border border-gray-300 px-2 py-2 text-center font-bold">
              Bulk Supply
              <br />
              (Collections)
            </th>
            <th className="border border-gray-300 px-2 py-2 text-center font-bold">
              Collections on Sales
              <br />
              (Without Street Lights)
            </th>
            <th className="border border-gray-300 px-2 py-2 text-center font-bold">
              % of Collections on Sales
              <br />
              (Without Street Lights)
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.map((grp, gi) => (
            <React.Fragment key={grp.regionCode || gi}>
              {grp.rows.map((r, i) => (
                <tr key={`${grp.regionCode}-${r.areaCode}-${i}`} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="border border-gray-300 px-2 py-1 text-center font-mono">{i === 0 ? grp.regionCode : ""}</td>
                  <td className="border border-gray-300 px-2 py-1 whitespace-nowrap">{r.areaName}</td>
                  <td className="border border-gray-300 px-2 py-1 text-right font-mono">{fmt(r.rawOrdinarySupplyNet)}</td>
                  <td className="border border-gray-300 px-2 py-1 text-right font-mono">{fmt(r.rawHeavySupplyNet)}</td>
                  <td className="border border-gray-300 px-2 py-1 text-right font-mono">{fmt(r.rawTotalNetSales)}</td>
                  <td className="border border-gray-300 px-2 py-1 text-right font-mono">{fmt(r.rawOrdinarySupplyCollections)}</td>
                  <td className="border border-gray-300 px-2 py-1 text-right font-mono">{fmt(r.rawBulkSupplyCollections)}</td>
                  <td className="border border-gray-300 px-2 py-1 text-right font-mono">{fmt(r.rawCollectionsOnSales)}</td>
                  <td className="border border-gray-300 px-2 py-1 text-right font-mono">{fmt(r.rawPercentCollections)}</td>
                </tr>
              ))}
              <tr className="bg-yellow-50 font-bold">
                <td className="border border-gray-300 px-2 py-1"></td>
                <td className="border border-gray-300 px-2 py-1">Sub Total</td>
                <td className="border border-gray-300 px-2 py-1 text-right font-mono">{fmt(grp.subTotal.ordinarySupplyNet)}</td>
                <td className="border border-gray-300 px-2 py-1 text-right font-mono">{fmt(grp.subTotal.heavySupplyNet)}</td>
                <td className="border border-gray-300 px-2 py-1 text-right font-mono">{fmt(grp.subTotal.totalNetSales)}</td>
                <td className="border border-gray-300 px-2 py-1 text-right font-mono">{fmt(grp.subTotal.ordinarySupplyCollections)}</td>
                <td className="border border-gray-300 px-2 py-1 text-right font-mono">{fmt(grp.subTotal.bulkSupplyCollections)}</td>
                <td className="border border-gray-300 px-2 py-1 text-right font-mono">{fmt(grp.subTotal.collectionsOnSales)}</td>
                <td className="border border-gray-300 px-2 py-1 text-right font-mono">{fmt(grp.subTotal.percentCollections)}</td>
              </tr>
            </React.Fragment>
          ))}

          {/* Grand total row */}
          <tr className="bg-gray-200 font-bold">
            <td className="border border-gray-300 px-2 py-1"></td>
            <td className="border border-gray-300 px-2 py-1">Total</td>
            <td className="border border-gray-300 px-2 py-1 text-right font-mono">{fmt(totals.ordinarySupplyNet)}</td>
            <td className="border border-gray-300 px-2 py-1 text-right font-mono">{fmt(totals.heavySupplyNet)}</td>
            <td className="border border-gray-300 px-2 py-1 text-right font-mono">{fmt(totals.totalNetSales)}</td>
            <td className="border border-gray-300 px-2 py-1 text-right font-mono">{fmt(totals.ordinarySupplyCollections)}</td>
            <td className="border border-gray-300 px-2 py-1 text-right font-mono">{fmt(totals.bulkSupplyCollections)}</td>
            <td className="border border-gray-300 px-2 py-1 text-right font-mono">{fmt(totals.collectionsOnSales)}</td>
            <td className="border border-gray-300 px-2 py-1 text-right font-mono">{fmt(totals.percentCollections)}</td>
          </tr>
        </tbody>
      </table>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // JSX
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 bg-white rounded-lg shadow-sm">
      {/* ── FORM ────────────────────────────────────────────────────────────── */}
      {!reportVisible && (
        <>
          <h1 className={`text-xl font-bold ${maroon} mb-4`}>Sales &amp; Collection – Region Wise</h1>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Bill Cycle */}
            <div className="flex flex-col">
              <label className={`text-xs font-medium mb-1 ${maroon}`}>Bill Cycle:</label>
              {isLoadingCycles ? (
                <div className={selectCls + " bg-gray-50 text-gray-500"}>Loading bill cycles...</div>
              ) : cycleError ? (
                <div className="w-full px-2 py-1.5 text-xs border border-red-300 rounded-md bg-red-50 text-red-600">
                  {cycleError}
                </div>
              ) : (
                <select value={billCycle} onChange={(e) => setBillCycle(e.target.value)} className={selectCls}>
                  {billCycleOptions.map((o) => (
                    <option key={o.code} value={o.code}>
                      {o.display}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Report Type */}
            <div className="flex flex-col">
              <label className={`text-xs font-medium mb-1 ${maroon}`}>Select Category:</label>
              {allowedReportTypes.length > 1 ? (
                <select value={reportType} onChange={(e) => setReportType(e.target.value as ReportType)} className={selectCls}>
                  {allowedReportTypes.map((t) => (
                    <option key={t} value={t}>
                      {t === "EntireCEB" ? "Entire CEB" : t}
                    </option>
                  ))}
                </select>
              ) : (
                <div className={disabledSelectCls}>{reportType === "EntireCEB" ? "Entire CEB" : reportType}</div>
              )}
            </div>

            {/* Province / Region dropdown (conditional) */}
            {reportType !== "EntireCEB" && (
              <div className="flex flex-col">
                <label className={`text-xs font-medium mb-1 ${maroon}`}>
                  Select {reportType === "Province" ? "Province" : "Region"}:
                </label>

                {reportType === "Province" &&
                  (isProvinceLocked || isAreaLocked ? (
                    <div className={disabledSelectCls}>
                      {lockedProvinceName || lockedProvinceCode || "—"}
                      {isAreaLocked && lockedAreaName ? ` (${lockedAreaName})` : ""}
                    </div>
                  ) : isLoadingGeo ? (
                    <div className={selectCls + " bg-gray-50 text-gray-500"}>Loading provinces...</div>
                  ) : (
                    <select value={provinceCode} onChange={(e) => setProvinceCode(e.target.value)} className={selectCls}>
                      <option value="">Select Province</option>
                      {provinces.map((p) => (
                        <option key={p.ProvinceCode} value={p.ProvinceCode}>
                          {p.ProvinceName}
                        </option>
                      ))}
                    </select>
                  ))}

                {reportType === "Region" &&
                  (isRegionLocked ? (
                    <div className={disabledSelectCls}>{lockedRegionCode || "—"}</div>
                  ) : isLoadingGeo ? (
                    <div className={selectCls + " bg-gray-50 text-gray-500"}>Loading regions...</div>
                  ) : (
                    <select value={regionCode} onChange={(e) => setRegionCode(e.target.value)} className={selectCls}>
                      <option value="">Select Region</option>
                      {regions.map((r) => (
                        <option key={r.RegionCode} value={r.RegionCode}>
                          {r.RegionName || r.RegionCode}
                        </option>
                      ))}
                    </select>
                  ))}
              </div>
            )}

            {reportType === "EntireCEB" && (
              <div className="flex flex-col">
                <label className="text-xs font-medium mb-1 text-gray-400">Select Area:</label>
                <div className={disabledSelectCls}>All areas island-wide</div>
              </div>
            )}
          </div>

          {geoError && (
            <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">{geoError}</div>
          )}

          {/* Submit */}
          <div className="w-full mt-6 flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={`px-6 py-2 rounded-md font-medium transition-opacity duration-300 shadow
                ${maroonGrad} text-white
                ${!canSubmit ? "opacity-70 cursor-not-allowed" : "hover:opacity-90"}`}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Loading...
                </span>
              ) : (
                "Generate Report"
              )}
            </button>
          </div>

          {reportError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">{reportError}</div>
          )}
        </>
      )}

      {/* ── REPORT ──────────────────────────────────────────────────────────── */}
      {reportVisible && (
        <div className="mt-2">
          {/* Report header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
            <div>
              <h2 className={`text-lg font-bold ${maroon}`}>Sales &amp; Collections</h2>
              <p className="text-sm text-gray-600 mt-1">
                {selectedBillCycleDisplay} | {selectedSubLabel}
              </p>
            </div>
            <div className="flex space-x-2 mt-2 md:mt-0">
              <button
                onClick={downloadAsCSV}
                disabled={!reportData.length}
                className={`flex items-center gap-1 px-3 py-1.5 border border-blue-400 rounded-md text-xs font-medium shadow-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-200 transition
                  ${!reportData.length ? "text-blue-300 bg-gray-50 cursor-not-allowed" : "text-blue-700 bg-white hover:bg-blue-50 hover:text-blue-800"}`}
              >
                <FaFileDownload className="w-3 h-3" /> CSV
              </button>
              <button
                onClick={printPDF}
                disabled={!reportData.length}
                className={`flex items-center gap-1 px-3 py-1.5 border border-green-400 rounded-md text-xs font-medium shadow-sm
                  focus:outline-none focus:ring-2 focus:ring-green-200 transition
                  ${!reportData.length ? "text-green-300 bg-gray-50 cursor-not-allowed" : "text-green-700 bg-white hover:bg-green-50 hover:text-green-800"}`}
              >
                <FaPrint className="w-3 h-3" /> PDF
              </button>
              <button
                onClick={() => {
                  setReportVisible(false);
                  setReportError(null);
                }}
                className="px-4 py-1.5 bg-[#7A0000] hover:bg-[#A52A2A] text-xs rounded-md text-white"
              >
                Back to Form
              </button>
            </div>
          </div>

          {/* Scrollable table */}
          <div className="overflow-x-auto max-h-[calc(100vh-250px)] border border-gray-300 rounded-lg">
            <div ref={printRef} className="min-w-full py-4">
              {renderTable()}
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

export default SalesAndCollection;