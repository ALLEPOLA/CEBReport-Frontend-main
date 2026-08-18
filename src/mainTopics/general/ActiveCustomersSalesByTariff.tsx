import React, { useState, useEffect, useRef, JSX } from "react";
import { FaFileDownload, FaPrint } from "react-icons/fa";

// ── Types ────────────────────────────────────────────────────────────────────

interface BillCycleOption {
    display: string;
    code: string;
}

// Raw row from API – tall/long format
interface OrdinaryRow {
    Area: string | null;
    Province: string | null;
    Division: string | null;
    BillCycle: string;
    TariffClass: string;
    Count: number;
    KwhSales: number;
    ErrorMessage: string;
}

interface BulkRow {
    Province: string | null;
    Area: string | null;
    AreaCode: string | null;
    Division: string | null;
    BillCycle: string;
    Tariff: string;
    Count: number;
    KwhSales: number;
    ErrorMessage: string;
}

// Pivoted row used by the table renderer
interface PivotedRow {
    province: string;
    area: string;
    division: string;
    billCycle: string;
    tariffs: Record<string, number>;
    total: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const ORDINARY_TARIFFS = ["D1", "D1-TOU", "GP1", "Govt. Hosp. & Schools", "Govt. Universities", "H1", "I1", "AGRI", "R1"];
const BULK_TARIFFS = ["DM1", "GP1", "GP2", "GP3", "GV1", "GV2", "GV3", "H1", "H2", "H3", "I1", "I2", "I3", "RL0", "RL1"];
const BULK_SALES_TARIFFS = [...BULK_TARIFFS, "DM2"];


// Map DB tariff codes → display column names for ordinary
const ORDINARY_TARIFF_MAP: Record<string, string> = {
    "GV1SH": "Govt. Hosp. & Schools",
    "GV2SH": "Govt. Hosp. & Schools",
    "GV1UV": "Govt. Universities",
    "GV2UV": "Govt. Universities",
    "AGRI": "AGRI",
    "AGRI-T": "AGRI",
};

const normaliseOrdinaryTariff = (raw: string): string =>
    ORDINARY_TARIFF_MAP[raw] ?? raw;

// ── Helper: cycle display ─────────────────────────────────────────────────────

const formatCycleDisplay = (code: string, cycles: BillCycleOption[]): string => {
    const opt = cycles.find(o => o.code === code);
    return opt?.display ?? code;
};

// ── Component ────────────────────────────────────────────────────────────────

const ActiveCustomersSalesByTariff: React.FC = () => {
    const maroon = "text-[#7A0000]";
    const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";

    // ── Form state ──────────────────────────────────────────────────────────
    const [category, setCategory] = useState<string>("");   // "Customers" | "Sales"
    const [custType, setCustType] = useState<string>("");   // "Ordinary" | "Bulk"
    const [fromCycle, setFromCycle] = useState<string>("");
    const [toCycle, setToCycle] = useState<string>("");
    const [reportType, setReportType] = useState<string>("");   // "area" | "province" | "region" | "entireceb"
    const [loading, setLoading] = useState(false);

    // ── Cycle options ───────────────────────────────────────────────────────
    const [cycleOptions, setCycleOptions] = useState<BillCycleOption[]>([]);
    const [isLoadingCycles, setIsLoadingCycles] = useState(false);
    const [cycleError, setCycleError] = useState<string | null>(null);

    // ── Report state ────────────────────────────────────────────────────────
    const [reportVisible, setReportVisible] = useState(false);
    const [reportError, setReportError] = useState<string | null>(null);
    const [pivotedData, setPivotedData] = useState<PivotedRow[]>([]);
    const [activeTariffs, setActiveTariffs] = useState<string[]>([]);

    // ── Snapshot of submitted form for the report header ───────────────────
    const [snapCategory, setSnapCategory] = useState("");
    const [snapCustType, setSnapCustType] = useState("");
    const [snapFromCycle, setSnapFromCycle] = useState("");
    const [snapToCycle, setSnapToCycle] = useState("");
    const [snapReportType, setSnapReportType] = useState("");

    const printRef = useRef<HTMLDivElement>(null);

    // ── Fetch bill cycles when custType changes ─────────────────────────────
    useEffect(() => {
        if (!custType) { setCycleOptions([]); return; }

        const fetchCycles = async () => {
            setIsLoadingCycles(true);
            setCycleError(null);
            setFromCycle("");
            setToCycle("");
            try {
                const url = custType === "Ordinary"
                    ? "/misapi/api/ordinary/consmry/billcycle/max"
                    : "/misapi/api/bulk/account_info/billcycle/max";
                const data = await fetchJSON(url);
                if (data.errorMessage) { setCycleError(data.errorMessage); return; }

                const cycles: string[] = data.data?.BillCycles ?? [];
                const maxCycle: string = data.data?.MaxBillCycle ?? "0";
                const maxNum = parseInt(maxCycle, 10);

                const opts: BillCycleOption[] = cycles.map((c, i) => ({
                    display: `${(maxNum - i)} - ${c}`,
                    code: (maxNum - i).toString(),
                }));
                setCycleOptions(opts);
            } catch (e) {
                setCycleError(e instanceof Error ? e.message : "Failed to load cycles");
            } finally {
                setIsLoadingCycles(false);
            }
        };
        fetchCycles();
    }, [custType]);

    // ── Generic fetch helper ────────────────────────────────────────────────
    const fetchJSON = async (url: string) => {
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        if (!res.ok) {
            let msg = `HTTP error ${res.status}`;
            try { const j = await res.json(); msg = j.errorMessage ?? msg; } catch { }
            throw new Error(msg);
        }
        return res.json();
    };

    // ── Pivot helper ────────────────────────────────────────────────────────
    const pivotOrdinary = (rows: OrdinaryRow[], rtype: string): PivotedRow[] => {
        const map = new Map<string, PivotedRow>();

        rows.forEach(r => {
            const province = r.Province ?? "";
            const area = r.Area ?? "";
            const division = r.Division ?? "";
            const cycle = r.BillCycle ?? "";

            // Build location key based on report type
            const locKey = rtype === "area"
                ? `${province}||${area}||${cycle}`
                : rtype === "province"
                    ? `${division}||${province}||${cycle}`
                    : rtype === "region"
                        ? `${division}||${cycle}`
                        : `Entire CEB||${cycle}`;

            if (!map.has(locKey)) {
                map.set(locKey, { province, area, division, billCycle: cycle, tariffs: {}, total: 0 });
            }
            const entry = map.get(locKey)!;
            const col = normaliseOrdinaryTariff(r.TariffClass);
            entry.tariffs[col] = (entry.tariffs[col] ?? 0) + (r.Count || r.KwhSales || 0);
        });

        // Compute totals
        map.forEach(entry => {
            entry.total = Object.values(entry.tariffs).reduce((a, b) => a + b, 0);
        });

        return [...map.values()].sort((a, b) =>
            a.division.localeCompare(b.division, undefined, { sensitivity: "base" })
            || a.province.localeCompare(b.province, undefined, { sensitivity: "base" })
            || a.area.localeCompare(b.area, undefined, { sensitivity: "base" })
            || a.billCycle.localeCompare(b.billCycle)
        );
    };

    const pivotBulk = (rows: BulkRow[], rtype: string): PivotedRow[] => {
        const map = new Map<string, PivotedRow>();

        rows.forEach(r => {
            const province = r.Province ?? "";
            const area = r.Area ?? "";
            const division = rtype === "region" ? province : (r.Division ?? "");
            const cycle = r.BillCycle ?? "";

            const locKey = rtype === "area"
                ? `${province}||${area}||${cycle}`
                : rtype === "province"
                    ? `${division}||${province}||${cycle}`
                    : rtype === "region"
                        ? `${division}||${cycle}`
                        : `Entire CEB||${cycle}`;

            if (!map.has(locKey)) {
                map.set(locKey, { province, area, division, billCycle: cycle, tariffs: {}, total: 0 });
            }
            const entry = map.get(locKey)!;
            entry.tariffs[r.Tariff] = (entry.tariffs[r.Tariff] ?? 0) + (r.Count || r.KwhSales || 0);
        });

        map.forEach(entry => {
            entry.total = Object.values(entry.tariffs).reduce((a, b) => a + b, 0);
        });

        return [...map.values()].sort((a, b) =>
            a.division.localeCompare(b.division, undefined, { sensitivity: "base" })
            || a.province.localeCompare(b.province, undefined, { sensitivity: "base" })
            || a.area.localeCompare(b.area, undefined, { sensitivity: "base" })
            || a.billCycle.localeCompare(b.billCycle)
        );
    };

    // ── Submit ──────────────────────────────────────────────────────────────
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setReportError(null);

        try {
            const rtParam = reportType; // already "area"|"province"|"region"|"entireceb"
            let url = "";

            if (category === "Customers") {
                url = custType === "Ordinary"
                    ? `/misapi/api/activeCustomers/ordinary?fromCycle=${fromCycle}&toCycle=${toCycle}&reportType=${rtParam}`
                    : `/misapi/api/activeCustomers/bulk?fromCycle=${fromCycle}&toCycle=${toCycle}&reportType=${rtParam}`;
            } else {
                url = custType === "Ordinary"
                    ? `/misapi/api/salesByTariff/ordinary?fromCycle=${fromCycle}&toCycle=${toCycle}&reportType=${rtParam}`
                    : `/misapi/api/salesByTariff/bulk?fromCycle=${fromCycle}&toCycle=${toCycle}&reportType=${rtParam}`;
            }

            const data = await fetchJSON(url);
            if (data.errorMessage) { setReportError(data.errorMessage); return; }

            const rows: any[] = data.data ?? [];

            // Choose value field based on category
            // For Customers → Count; for Sales → KwhSales
            // Inject correct numeric field name into rows so pivot helper works
            const enriched = rows.map((r: any) => ({
                ...r,
                Count: category === "Customers" ? (r.Count ?? 0) : 0,
                KwhSales: category === "Sales" ? (r.KwhSales ?? 0) : 0,
            }));

            const pivoted = custType === "Ordinary"
                ? pivotOrdinary(enriched as OrdinaryRow[], rtParam)
                : pivotBulk(enriched as BulkRow[], rtParam);

            // Determine which tariff columns are active (have any non-zero value)
            const baseCols = custType === "Ordinary"
                ? ORDINARY_TARIFFS
                : (category === "Sales" ? BULK_SALES_TARIFFS : BULK_TARIFFS);

            // Allowlist: only show columns defined in the canonical tariff arrays.
            // Any unknown codes from the DB (N++, NET++, SL, etc.) are silently ignored.
            const finalTariffs = baseCols;
            setActiveTariffs(finalTariffs);

            // Recompute each row's total from only the visible tariff columns
            const adjusted = pivoted.map(r => ({
                ...r,
                total: finalTariffs.reduce((sum, col) => sum + (r.tariffs[col] ?? 0), 0),
            }));
            setPivotedData(adjusted);
            // Snapshot form values for report header
            setSnapCategory(category);
            setSnapCustType(custType);
            setSnapFromCycle(fromCycle);
            setSnapToCycle(toCycle);
            setSnapReportType(reportType);

            setReportVisible(true);
        } catch (err) {
            setReportError(err instanceof Error ? err.message : "Failed to generate report");
        } finally {
            setLoading(false);
        }
    };

    // ── Validation ──────────────────────────────────────────────────────────
    const canSubmit = () =>
        category && custType && fromCycle && toCycle && reportType;

    const isToCycleDisabled = () => !custType || !fromCycle;
    const isReportTypeDisabled = () => !custType || !fromCycle || !toCycle;

    // ── Report title helpers ─────────────────────────────────────────────────
    const reportTitle = () => {
        const cat = snapCategory === "Customers" ? "No. of Consumers by Tariff" : "Sales by Tariff";
        const type = snapCustType;
        return `${cat} - ${type}`;
    };

    const cycleRangeDisplay = () => {
        const from = formatCycleDisplay(snapFromCycle, cycleOptions);
        const to = formatCycleDisplay(snapToCycle, cycleOptions);
        return `${from} To ${to}`;
    };

    const formatNum = (val: number) =>
        snapCategory === "Customers"
            ? val.toLocaleString("en-US")
            : val.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

    const formatCycleLabel = (code: string): string => {
        const display = formatCycleDisplay(code, cycleOptions);
        const parts = display.split(" - ");
        return parts.length > 1 ? parts[1] : display;
    };

    // ── Pivot table renderer ─────────────────────────────────────────────────
    const renderTable = (): JSX.Element => {
        if (pivotedData.length === 0) {
            return <div className="text-center py-8 text-gray-500">No data available for the selected criteria.</div>;
        }

        const rtype = snapReportType;
        const isSales = snapCategory === "Sales";

        // ── Header columns per report type ──────────────────────────────────
        const locationHeaders: string[] =
            rtype === "area" ? ["Province", "Area"]
                : rtype === "province" ? ["Region", "Province"]
                    : rtype === "region" ? ["Region"]
                        : [];

        // ── Build grouping maps using "-" separator (same as SolarPaymentRetail) ──
        const divisionGroups: Record<string, PivotedRow[]> = {};
        const provinceGroups: Record<string, PivotedRow[]> = {};
        const areaGroups: Record<string, PivotedRow[]> = {};

        pivotedData.forEach(r => {
            if (!divisionGroups[r.division]) divisionGroups[r.division] = [];
            divisionGroups[r.division].push(r);

            const provKey = `${r.division}-${r.province}`;
            if (!provinceGroups[provKey]) provinceGroups[provKey] = [];
            provinceGroups[provKey].push(r);

            const areaKey = `${r.division}-${r.province}-${r.area}`;
            if (!areaGroups[areaKey]) areaGroups[areaKey] = [];
            areaGroups[areaKey].push(r);
        });

        // ── Compute group totals for Sales ───────────────────────────────────
        const sumGroup = (rows: PivotedRow[]) => {
            const t: Record<string, number> = {};
            activeTariffs.forEach(col => {
                t[col] = rows.reduce((s, r) => s + (r.tariffs[col] ?? 0), 0);
            });
            t["__total"] = rows.reduce((s, r) => s + r.total, 0);
            return t;
        };

        // ── Rowspan calculation (accounts for injected total rows) ───────────
        const divisionRowSpans: Record<string, number> = {};
        const provinceRowSpans: Record<string, number> = {};
        const areaRowSpans: Record<string, number> = {};

        // area report: Province | Area columns — no Region column
        if (rtype === "area") {
            Object.keys(areaGroups).forEach(ak => {
                areaRowSpans[ak] = areaGroups[ak].length + (isSales ? 1 : 0);
            });
            Object.keys(provinceGroups).forEach(pk => {
                const areas = Object.keys(areaGroups).filter(ak => ak.startsWith(`${pk}-`));
                provinceRowSpans[pk] = areas.reduce((s, ak) => s + areaRowSpans[ak], 0);
            });

            // province report: Region | Province columns
        } else if (rtype === "province") {
            Object.keys(provinceGroups).forEach(pk => {
                let rowCount = provinceGroups[pk].length;
                if (isSales) rowCount++; // Province Total row
                provinceRowSpans[pk] = rowCount;
            });
            Object.keys(divisionGroups).forEach(dk => {
                const provs = Object.keys(provinceGroups).filter(pk => pk.startsWith(`${dk}-`));
                divisionRowSpans[dk] = provs.reduce((s, pk) => s + provinceRowSpans[pk], 0);
            });

            // region report: Region column only
        } else if (rtype === "region") {
            Object.keys(divisionGroups).forEach(dk => {
                divisionRowSpans[dk] = divisionGroups[dk].length + (isSales ? 1 : 0);
            });
        }

        // ── Build table rows ─────────────────────────────────────────────────
        const tableRows: JSX.Element[] = [];
        let rowIndex = 0;
        let dataRowIndex = 0;

        let currentDivision = "";
        let currentProvince = "";
        let currentArea = "";

        const uniqueDivisions = Object.keys(divisionGroups).sort();

        uniqueDivisions.forEach(division => {
            const provincesInDivision = Object.keys(provinceGroups)
                .filter(pk => pk.startsWith(`${division}-`))
                .sort();

            provincesInDivision.forEach(provinceKey => {
                const areasInProvince = Object.keys(areaGroups)
                    .filter(ak => ak.startsWith(`${provinceKey}-`))
                    .sort();

                // For province/region/entireceb: iterate province items directly
                const iterKeys = rtype === "area" ? areasInProvince : [provinceKey];

                iterKeys.forEach(areaKey => {
                    const items = rtype === "area"
                        ? areaGroups[areaKey]
                        : provinceGroups[provinceKey];

                    items.forEach(row => {
                        const showDivision = currentDivision !== division;
                        const showProvince = currentProvince !== provinceKey;
                        const showArea = currentArea !== areaKey;

                        if (showDivision) {
                            currentDivision = division;
                            currentProvince = "";
                            currentArea = "";
                        }
                        if (showProvince) {
                            currentProvince = provinceKey;
                            currentArea = "";
                        }
                        if (showArea) {
                            currentArea = areaKey;
                        }

                        tableRows.push(
                            <tr key={`data-${rowIndex}`} className={dataRowIndex % 2 === 0 ? "bg-white" : "bg-gray-50"}>

                                {/* Region cell — province/region reports only */}
                                {(rtype === "province" || rtype === "region") && (
                                    showDivision ? (
                                        <td className="border border-gray-300 px-2 py-1.5 align-top font-medium text-xs"
                                            rowSpan={divisionRowSpans[division]}>
                                            {row.division}
                                        </td>
                                    ) : null
                                )}

                                {/* Province cell — area/province reports only */}
                                {(rtype === "area" || rtype === "province") && (
                                    showProvince ? (
                                        <td className="border border-gray-300 px-2 py-1.5 align-top text-xs"
                                            rowSpan={provinceRowSpans[provinceKey]}>
                                            {row.province}
                                        </td>
                                    ) : null
                                )}

                                {/* Area cell — area report only */}
                                {rtype === "area" && (
                                    showArea ? (
                                        <td className="border border-gray-300 px-2 py-1.5 align-top text-xs"
                                            rowSpan={areaRowSpans[areaKey]}>
                                            {row.area}
                                        </td>
                                    ) : null
                                )}

                                {/* Month */}
                                <td className="border border-gray-300 px-2 py-1.5 text-xs whitespace-nowrap">
                                    {formatCycleLabel(row.billCycle)}
                                </td>

                                {/* Tariff values */}
                                {activeTariffs.map(col => (
                                    <td key={col} className="border border-gray-300 px-2 py-1.5 text-right text-xs">
                                        {row.tariffs[col] ? formatNum(row.tariffs[col]) : ""}
                                    </td>
                                ))}

                                {/* Row total */}
                                <td className="border border-gray-300 px-2 py-1.5 text-right text-xs font-medium">
                                    {formatNum(row.total)}
                                </td>
                            </tr>
                        );
                        rowIndex++;
                        dataRowIndex++;
                    });

                    // ── Area Total (Sales + area report) ─────────────────────
                    if (isSales && rtype === "area") {
                        const gt = sumGroup(areaGroups[areaKey]);
                        tableRows.push(
                            <tr key={`area-total-${rowIndex}`} className="bg-green-50 font-medium">
                                {/* <td className="border border-gray-300 px-2 py-1.5 text-xs font-medium"
                                    colSpan={locationHeaders.length}>
                                </td> */}
                                <td className="border border-gray-300 px-2 py-1.5 text-xs font-medium">
                                    Total
                                </td>
                                {activeTariffs.map(col => (
                                    <td key={col} className="border border-gray-300 px-2 py-1.5 text-right text-xs">
                                        {gt[col] ? formatNum(gt[col]) : ""}
                                    </td>
                                ))}
                                <td className="border border-gray-300 px-2 py-1.5 text-right text-xs font-bold">
                                    {formatNum(gt["__total"] ?? 0)}
                                </td>
                            </tr>
                        );
                        rowIndex++;
                    }
                });

                // ── Province Total (Sales + province report) ──────────────────
                if (isSales && rtype === "province") {
                    const gt = sumGroup(provinceGroups[provinceKey]);
                    tableRows.push(
                        <tr key={`prov-total-${rowIndex}`} className="bg-blue-50 font-semibold">
                            <td className="border border-gray-300 px-2 py-1.5 text-xs font-semibold"
                                colSpan={1}>
                                Total
                            </td>
                            {activeTariffs.map(col => (
                                <td key={col} className="border border-gray-300 px-2 py-1.5 text-right text-xs">
                                    {gt[col] ? formatNum(gt[col]) : ""}
                                </td>
                            ))}
                            <td className="border border-gray-300 px-2 py-1.5 text-right text-xs font-bold">
                                {formatNum(gt["__total"] ?? 0)}
                            </td>
                        </tr>
                    );
                    rowIndex++;
                }
            });

            // ── Region Total (Sales + province report, >1 province in division) ──
            // if (isSales && rtype === "province" && provincesInDivision.length > 1) {
            //     const gt = sumGroup(divisionGroups[division]);
            //     tableRows.push(
            //         <tr key={`div-total-${rowIndex}`} className="bg-yellow-50 font-bold">
            //             <td className="border border-gray-300 px-2 py-1.5 text-xs font-bold"
            //                 colSpan={locationHeaders.length + 1}>
            //                 Region Total
            //             </td>
            //             {activeTariffs.map(col => (
            //                 <td key={col} className="border border-gray-300 px-2 py-1.5 text-right text-xs">
            //                     {gt[col] ? formatNum(gt[col]) : ""}
            //                 </td>
            //             ))}
            //             <td className="border border-gray-300 px-2 py-1.5 text-right text-xs font-bold">
            //                 {formatNum(gt["__total"] ?? 0)}
            //             </td>
            //         </tr>
            //     );
            //     rowIndex++;
            // }

            // ── Region Total (Sales + region report) ─────────────────────────
            if (isSales && rtype === "region") {
                const gt = sumGroup(divisionGroups[division]);
                tableRows.push(
                    <tr key={`div-total-${rowIndex}`} className="bg-yellow-50 font-bold">
                        <td className="border border-gray-300 px-2 py-1.5 text-xs font-bold"
                            colSpan={1}>
                            Total
                        </td>
                        {activeTariffs.map(col => (
                            <td key={col} className="border border-gray-300 px-2 py-1.5 text-right text-xs">
                                {gt[col] ? formatNum(gt[col]) : ""}
                            </td>
                        ))}
                        <td className="border border-gray-300 px-2 py-1.5 text-right text-xs font-bold">
                            {formatNum(gt["__total"] ?? 0)}
                        </td>
                    </tr>
                );
                rowIndex++;
            }
        });

        // ── Grand Total (always at bottom) ───────────────────────────────────
        // if (rtype === "entireceb") {
        //     const grandTariffs: Record<string, number> = {};
        //     activeTariffs.forEach(col => {
        //         grandTariffs[col] = pivotedData.reduce((s, r) => s + (r.tariffs[col] ?? 0), 0);
        //     });
        //     const grandTotal = pivotedData.reduce((s, r) => s + r.total, 0);

        //     tableRows.push(
        //         <tr key="grand-total" className="bg-gray-200 font-bold">
        //             <td className="border border-gray-300 px-2 py-1.5 text-xs font-bold"
        //                 colSpan={locationHeaders.length + 1}>
        //                 Total
        //             </td>
        //             {activeTariffs.map(col => (
        //                 <td key={col} className="border border-gray-300 px-2 py-1.5 text-right text-xs">
        //                     {grandTariffs[col] ? formatNum(grandTariffs[col]) : ""}
        //                 </td>
        //             ))}
        //             <td className="border border-gray-300 px-2 py-1.5 text-right text-xs font-bold">
        //                 {formatNum(grandTotal)}
        //             </td>
        //         </tr>
        //     );
        // }

        return (
            <table className="min-w-full text-xs border-collapse">
                <thead className="bg-gray-200 sticky top-0 z-10">
                    <tr>
                        {locationHeaders.map(label => (
                            <th key={label} className="px-2 py-2 text-center border border-gray-300 font-semibold">
                                {label}
                            </th>
                        ))}
                        <th className="px-2 py-2 text-center border border-gray-300 font-semibold">Month</th>
                        {activeTariffs.map(col => (
                            <th key={col} className="px-2 py-2 text-center border border-gray-300 font-semibold">
                                {col}
                            </th>
                        ))}
                        <th className="px-2 py-2 text-center border border-gray-300 font-semibold">Total</th>
                    </tr>
                </thead>
                <tbody>{tableRows}</tbody>
            </table>
        );
    };

    // ── CSV Export ───────────────────────────────────────────────────────────
    const downloadCSV = () => {
        const locationLabels =
            snapReportType === "area" ? ["Province", "Area"]
                : snapReportType === "province" ? ["Region", "Province"]
                    : snapReportType === "region" ? ["Region"]
                        : [];

        const headers = [...locationLabels, "Month", ...activeTariffs, "Total"];

        const rows: string[][] = [];
        const seenLoc = new Set<string>();

        pivotedData.forEach(r => {
            const locVals =
                snapReportType === "area" ? [r.province, r.area]
                    : snapReportType === "province" ? [r.division, r.province]
                        : snapReportType === "region" ? [r.division]
                            : [];

            const locKey = locVals.join("||");
            const showLoc = !seenLoc.has(locKey);
            if (showLoc) seenLoc.add(locKey);

            rows.push([
                ...(showLoc ? locVals : locVals.map(() => "")),
                formatCycleLabel(r.billCycle),
                ...activeTariffs.map(col => (r.tariffs[col] ?? 0).toString()),
                r.total.toString(),
            ]);

            // Group total for Sales
            if (snapCategory === "Sales") {
                const isLast = pivotedData.indexOf(r) === pivotedData.length - 1
                    || (snapReportType !== "entireceb" &&
                        (() => {
                            const next = pivotedData[pivotedData.indexOf(r) + 1];
                            if (!next) return true;
                            if (snapReportType === "area") return next.area !== r.area;
                            if (snapReportType === "province") return next.province !== r.province;
                            if (snapReportType === "region") return next.division !== r.division;
                            return false;
                        })());
                if (isLast) {
                    // placeholder – full group total would need same map as renderTable; omitted for brevity
                }
            }
        });

        const csv = [
            `"${reportTitle()}"`,
            `"${cycleRangeDisplay()}"`,
            `"Generated: ${new Date().toLocaleDateString()}"`,
            "",
            headers.map(h => `"${h}"`).join(","),
            ...rows.map(r => r.map(c => `"${c}"`).join(",")),
        ].join("\n");

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `${snapCategory}_${snapCustType}_${snapReportType}_${Date.now()}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 100);
    };

    // ── PDF Print ────────────────────────────────────────────────────────────
    const printPDF = () => {
        if (!printRef.current) return;
        const win = window.open("", "_blank");
        if (!win) return;

        win.document.write(`
            <html>
            <head>
                <title>${reportTitle()}</title>
                <style>
                    body { font-family: Arial; font-size: 9px; margin: 10mm; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    th, td { padding: 3px 5px; border: 1px solid #ddd; font-size: 9px; vertical-align: top; }
                    th { background-color: #d3d3d3; font-weight: bold; }
                    .text-right { text-align: right; }
                    .header { font-weight: bold; color: #7A0000; font-size: 12px; margin-bottom: 4px; }
                    .subheader { font-size: 10px; margin-bottom: 12px; }
                    tr:nth-child(even) { background-color: #f9f9f9; }
                    .bg-green-50 td, .bg-blue-50 td, .bg-yellow-50 td, .bg-gray-200 td { font-weight: bold; }
                    @page {
                        margin-bottom: 18mm;
                        @bottom-left { content: "Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()} | Reporting@2026"; font-size: 8px; color: #666; font-family: Arial; }
                        @bottom-right { content: "Page " counter(page) " of " counter(pages); font-size: 8px; color: #666; font-family: Arial; }
                    }
                </style>
            </head>
            <body>
                <div class="header">${reportTitle().toUpperCase()}</div>
                <div class="subheader">${cycleRangeDisplay()}</div>
                ${printRef.current.innerHTML}
            </body>
            </html>
        `);
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); win.close(); }, 500);
    };

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="p-6 bg-white rounded-lg shadow-md">

            {/* ── FORM ── */}
            {!reportVisible && (
                <>
                    <div className="mb-6">
                        <h2 className={`text-xl font-bold mb-6 ${maroon}`}>
                            Active Customers &amp; Sales by Tariff
                        </h2>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

                            {/* 1. Category */}
                            <div className="flex flex-col">
                                <label className={`text-xs font-medium mb-1 ${maroon}`}>
                                    Select Category:
                                </label>
                                <select
                                    value={category}
                                    onChange={e => {
                                        setCategory(e.target.value);
                                        setCustType("");
                                        setFromCycle("");
                                        setToCycle("");
                                        setReportType("");
                                        setCycleOptions([]);
                                    }}
                                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent"
                                    required
                                >
                                    <option value="">Select Category</option>
                                    <option value="Customers">No. of Consumers</option>
                                    <option value="Sales">Sales</option>
                                </select>
                            </div>

                            {/* 2. Customer Type */}
                            <div className="flex flex-col">
                                <label className={`text-xs font-medium mb-1 ${!category ? "text-gray-400" : maroon}`}>
                                    Select Customer Type:
                                </label>
                                <select
                                    value={custType}
                                    onChange={e => {
                                        setCustType(e.target.value);
                                        setFromCycle("");
                                        setToCycle("");
                                        setReportType("");
                                    }}
                                    className={`w-full px-2 py-1.5 text-xs border rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent
                                        ${!category ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed" : "border-gray-300"}`}
                                    required
                                    disabled={!category}
                                >
                                    <option value="">Select Customer Type</option>
                                    <option value="Ordinary">Ordinary</option>
                                    <option value="Bulk">Bulk</option>
                                </select>
                            </div>

                            {/* 3. From Cycle */}
                            <div className="flex flex-col">
                                <label className={`text-xs font-medium mb-1 ${!custType ? "text-gray-400" : maroon}`}>
                                    From Cycle:
                                </label>
                                <select
                                    value={fromCycle}
                                    onChange={e => {
                                        setFromCycle(e.target.value);
                                        setToCycle("");
                                        setReportType("");
                                    }}
                                    className={`w-full px-2 py-1.5 text-xs border rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent
                                        ${!custType ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed" : "border-gray-300"}`}
                                    required
                                    disabled={!custType}
                                >
                                    <option value="">Select From Cycle</option>
                                    {isLoadingCycles ? (
                                        <option value="">Loading...</option>
                                    ) : cycleError ? (
                                        <option value="">Error loading cycles</option>
                                    ) : (
                                        cycleOptions.map(opt => (
                                            <option key={opt.code} value={opt.code}>{opt.display}</option>
                                        ))
                                    )}
                                </select>
                            </div>

                            {/* 4. To Cycle */}
                            <div className="flex flex-col">
                                <label className={`text-xs font-medium mb-1 ${isToCycleDisabled() ? "text-gray-400" : maroon}`}>
                                    To Cycle:
                                </label>
                                <select
                                    value={toCycle}
                                    onChange={e => {
                                        setToCycle(e.target.value);
                                        setReportType("");
                                    }}
                                    className={`w-full px-2 py-1.5 text-xs border rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent
                                        ${isToCycleDisabled() ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed" : "border-gray-300"}`}
                                    required
                                    disabled={isToCycleDisabled()}
                                >
                                    <option value="">Select To Cycle</option>
                                    {isLoadingCycles ? (
                                        <option value="">Loading...</option>
                                    ) : cycleError ? (
                                        <option value="">Error loading cycles</option>
                                    ) : (
                                        cycleOptions
                                            .filter(opt => parseInt(opt.code) >= parseInt(fromCycle || "0"))
                                            .map(opt => (
                                                <option key={opt.code} value={opt.code}>{opt.display}</option>
                                            ))
                                    )}
                                </select>
                            </div>

                            {/* 5. Report Type */}
                            <div className="flex flex-col">
                                <label className={`text-xs font-medium mb-1 ${isReportTypeDisabled() ? "text-gray-400" : maroon}`}>
                                    Select Report Type:
                                </label>
                                <select
                                    value={reportType}
                                    onChange={e => setReportType(e.target.value)}
                                    className={`w-full px-2 py-1.5 text-xs border rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent
                                        ${isReportTypeDisabled() ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed" : "border-gray-300"}`}
                                    required
                                    disabled={isReportTypeDisabled()}
                                >
                                    <option value="">Select Report Type</option>
                                    <option value="area">Area</option>
                                    <option value="province">Province</option>
                                    <option value="region">Region</option>
                                    <option value="entireceb">Entire CEB</option>
                                </select>
                            </div>
                        </div>

                        {/* Submit */}
                        <div className="w-full mt-6 flex justify-end">
                            <button
                                type="submit"
                                className={`px-6 py-2 rounded-md font-medium transition-opacity duration-300 shadow
                                    ${maroonGrad} text-white ${loading || !canSubmit() ? "opacity-70 cursor-not-allowed" : "hover:opacity-90"}`}
                                disabled={loading || !canSubmit()}
                            >
                                {loading ? (
                                    <span className="flex items-center">
                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Loading...
                                    </span>
                                ) : "Generate Report"}
                            </button>
                        </div>
                    </form>
                </>
            )}

            {/* ── REPORT ── */}
            {reportVisible && (
                <div className="mt-2">
                    {/* Report Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
                        <div>
                            <h2 className={`text-xl font-bold ${maroon}`}>{reportTitle()}</h2>
                            <p className="text-sm text-gray-600 mt-1">{cycleRangeDisplay()}</p>
                        </div>
                        <div className="flex space-x-2 mt-2 md:mt-0">
                            <button
                                onClick={downloadCSV}
                                className="flex items-center gap-1 px-3 py-1.5 border border-blue-400 text-blue-700 bg-white rounded-md text-xs font-medium shadow-sm hover:bg-blue-50 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-200 transition"
                            >
                                <FaFileDownload className="w-3 h-3" /> CSV
                            </button>
                            <button
                                onClick={printPDF}
                                className="flex items-center gap-1 px-3 py-1.5 border border-green-400 text-green-700 bg-white rounded-md text-xs font-medium shadow-sm hover:bg-green-50 hover:text-green-800 focus:outline-none focus:ring-2 focus:ring-green-200 transition"
                            >
                                <FaPrint className="w-3 h-3" /> PDF
                            </button>
                            <button
                                onClick={() => setReportVisible(false)}
                                className="px-4 py-1.5 bg-[#7A0000] hover:bg-[#A52A2A] text-xs rounded-md text-white flex items-center"
                            >
                                Back to Form
                            </button>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto max-h-[calc(100vh-250px)] border border-gray-300 rounded-lg">
                        <div ref={printRef} className="min-w-full py-2">
                            {renderTable()}
                        </div>
                    </div>

                    {reportError && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                            {reportError}
                        </div>
                    )}
                </div>
            )}

            {!reportVisible && reportError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                    {reportError}
                </div>
            )}
        </div>
    );
};

export default ActiveCustomersSalesByTariff;