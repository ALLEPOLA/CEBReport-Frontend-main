import React, { useState, useEffect, useRef, useMemo } from "react";
import { FaFileDownload, FaPrint } from "react-icons/fa";

interface Division {
    RegionCode: string;
    ErrorMessage?: string | null;
}

interface BillCycleOption {
    display: string;
    code: string;
}

interface PUCSLSolarCustomerRow {
    Region: string;
    BillCycle: string;
    Period: string;
    NetType: string;
    AreaCode: string;
    NoOfAccounts: number | null;
    Sale: number | null;
    Export: number | null;
    Import: number | null;
    KwhSales: number | null;
    ErrorMessage?: string | null;
}

interface Totals {
    accounts: number;
    sale: number;
    export: number;
    import: number;
    kwhSales: number;
}

interface NetTypeGroup {
    netType: string;
    rows: PUCSLSolarCustomerRow[];
    subtotal: Totals;
}

interface CycleGroup {
    billCycle: string;
    period: string;
    netTypeGroups: NetTypeGroup[];
    cycleTotal: Totals;
}

const emptyTotals = (): Totals => ({
    accounts: 0,
    sale: 0,
    export: 0,
    import: 0,
    kwhSales: 0,
});

const addTotals = (a: Totals, b: Totals): Totals => ({
    accounts: a.accounts + b.accounts,
    sale: a.sale + b.sale,
    export: a.export + b.export,
    import: a.import + b.import,
    kwhSales: a.kwhSales + b.kwhSales,
});

interface SolarCustomersCardProps {
    /** e.g. "Bulk" or "Ordinary" — used in headings, CSV/PDF titles and file names */
    reportLabel: string;
    /** POST endpoint for generating the report, e.g. /api/pucsl/bulkSolarCustomers */
    apiUrl: string;
}

const SolarCustomersCard: React.FC<SolarCustomersCardProps> = ({ reportLabel, apiUrl }) => {
    const maroon = "text-[#7A0000]";
    const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";

    // Form state
    const [region, setRegion] = useState<string>("");
    const [fromBillCycle, setFromBillCycle] = useState<string>("");
    const [toBillCycle, setToBillCycle] = useState<string>("");
    const [loading, setLoading] = useState(false);

    // Dropdown data
    const [divisions, setDivisions] = useState<Division[]>([]);
    const [billCycleOptions, setBillCycleOptions] = useState<BillCycleOption[]>([]);
    const [isLoadingDivisions, setIsLoadingDivisions] = useState(false);
    const [isLoadingBillCycles, setIsLoadingBillCycles] = useState(false);
    const [divisionError, setDivisionError] = useState<string | null>(null);
    const [billCycleError, setBillCycleError] = useState<string | null>(null);

    // Report state
    const [reportData, setReportData] = useState<PUCSLSolarCustomerRow[]>([]);
    const [reportVisible, setReportVisible] = useState(false);
    const [reportError, setReportError] = useState<string | null>(null);
    const [selectedFromDisplay, setSelectedFromDisplay] = useState<string>("");
    const [selectedToDisplay, setSelectedToDisplay] = useState<string>("");

    const printRef = useRef<HTMLDivElement>(null);

    // Normalize a raw API row into our internal shape.
    // Bulk and Ordinary endpoints don't use identical field names:
    //   - Bulk sends "BillCycle" / "Sale" / "KwhSales"
    //   - Ordinary sends "CalcCycle" (no separate BillCycle) and "Net" instead of KwhSales,
    //     and has no "Sale" field at all.
    // This maps either shape into the same PUCSLSolarCustomerRow so the rest of the
    // component (grouping, totals, table, CSV) doesn't need to know which endpoint it came from.
    const normalizeRow = (raw: any): PUCSLSolarCustomerRow => ({
        Region: raw.Region ?? "",
        BillCycle: raw.BillCycle ?? raw.CalcCycle ?? "",
        Period: raw.Period ?? "",
        NetType: raw.NetType ?? "",
        AreaCode: raw.AreaCode ?? "",
        NoOfAccounts: raw.NoOfAccounts ?? null,
        Sale: raw.Sale ?? null,
        Export: raw.Export ?? null,
        Import: raw.Import ?? null,
        KwhSales: raw.KwhSales ?? raw.Net ?? null,
        ErrorMessage: raw.ErrorMessage ?? null,
    });

    // Helper for error handling
    const fetchWithErrorHandling = async (url: string, options?: RequestInit) => {
        try {
            const response = await fetch(url, {
                headers: {
                    Accept: "application/json",
                    ...(options?.method === "POST" ? { "Content-Type": "application/json" } : {}),
                },
                ...options,
            });

            if (!response.ok) {
                let errorMsg = `HTTP error! status: ${response.status}`;
                try {
                    const errorData = await response.json();
                    if (errorData.errorMessage) {
                        errorMsg = errorData.errorMessage;
                    }
                } catch {
                    errorMsg = response.statusText;
                }
                throw new Error(errorMsg);
            }

            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                throw new Error(`Expected JSON response but got ${contentType}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`Error fetching ${url}:`, error);
            throw error;
        }
    };

    // Format number with comma separators
    // Guards against null/undefined/NaN — some Ordinary rows come back from the
    // API with missing numeric fields, and calling .toLocaleString() on null/undefined
    // throws and crashes the whole page (that was the root cause of the blank page).
    const formatNumber = (num: number | null | undefined, decimals: number = 2): string => {
        const safeNum = typeof num === "number" && !isNaN(num) ? num : 0;
        return safeNum.toLocaleString("en-US", {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        });
    };

    // Fetch bill cycles
    useEffect(() => {
        const fetchBillCycles = async () => {
            setIsLoadingBillCycles(true);
            setBillCycleError(null);
            try {
                const response = await fetchWithErrorHandling(
                    "/misapi/api/bulk/netmtcons/billcycle/max"
                );

                const billCyclesArray = response?.data?.BillCycles;
                const maxBillCycle = response?.data?.MaxBillCycle;

                if (billCyclesArray && Array.isArray(billCyclesArray) && maxBillCycle) {
                    const maxCycleNum = parseInt(maxBillCycle);

                    const options: BillCycleOption[] = billCyclesArray.map(
                        (cycle: string, index: number) => {
                            const cycleNumber = maxCycleNum - index;
                            return {
                                display: `${cycleNumber} - ${cycle}`,
                                code: cycleNumber.toString(),
                            };
                        }
                    );

                    setBillCycleOptions(options);
                } else {
                    throw new Error("Invalid bill cycle data format");
                }
            } catch (error: any) {
                console.error("Error fetching bill cycles:", error);
                setBillCycleError(error.message || "Failed to load bill cycles");
            } finally {
                setIsLoadingBillCycles(false);
            }
        };

        fetchBillCycles();
    }, []);

    // Fetch regions (divisions)
    useEffect(() => {
        const fetchDivisions = async () => {
            setIsLoadingDivisions(true);
            setDivisionError(null);
            try {
                const response = await fetchWithErrorHandling("/misapi/api/bulk/region");
                if (response?.data && Array.isArray(response.data)) {
                    setDivisions(response.data);
                } else {
                    throw new Error("Invalid region data format");
                }
            } catch (error: any) {
                console.error("Error fetching regions:", error);
                setDivisionError(error.message || "Failed to load regions");
            } finally {
                setIsLoadingDivisions(false);
            }
        };

        fetchDivisions();
    }, []);

    const canSubmit = () => {
        if (!region || !fromBillCycle || !toBillCycle) return false;
        if (parseInt(fromBillCycle) > parseInt(toBillCycle)) return false;
        return true;
    };

    // Handle form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setReportError(null);

        try {
            const response = await fetchWithErrorHandling(apiUrl, {
                method: "POST",
                body: JSON.stringify({
                    region,
                    fromBillCycle,
                    toBillCycle,
                }),
            });

            if (response?.data && Array.isArray(response.data)) {
                setReportData(response.data.map(normalizeRow));

                const fromOpt = billCycleOptions.find((opt) => opt.code === fromBillCycle);
                const toOpt = billCycleOptions.find((opt) => opt.code === toBillCycle);
                setSelectedFromDisplay(fromOpt?.display || fromBillCycle);
                setSelectedToDisplay(toOpt?.display || toBillCycle);

                setReportVisible(true);
            } else {
                throw new Error(response?.errorMessage || "Invalid response data format");
            }
        } catch (error: any) {
            console.error("Error generating report:", error);
            setReportError(error.message || "Failed to generate report. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // Group flat report data into Bill Cycle -> Net Type -> Rows,
    // matching the SQL's ORDER BY (region, bill_cycle, net_type, area_cd).
    const groupedData: CycleGroup[] = useMemo(() => {
        const cycleOrder: string[] = [];
        const cycleMap: Record<
            string,
            { period: string; netTypeOrder: string[]; netTypeMap: Record<string, PUCSLSolarCustomerRow[]> }
        > = {};

        reportData.forEach((row) => {
            const billCycleKey = row.BillCycle ?? "Unknown";
            const netTypeKey = row.NetType ?? "Unknown";

            if (!cycleMap[billCycleKey]) {
                cycleMap[billCycleKey] = { period: row.Period, netTypeOrder: [], netTypeMap: {} };
                cycleOrder.push(billCycleKey);
            }
            const cycle = cycleMap[billCycleKey];
            if (!cycle.netTypeMap[netTypeKey]) {
                cycle.netTypeMap[netTypeKey] = [];
                cycle.netTypeOrder.push(netTypeKey);
            }
            cycle.netTypeMap[netTypeKey].push(row);
        });

        return cycleOrder.map((bc) => {
            const cycle = cycleMap[bc];

            const netTypeGroups: NetTypeGroup[] = cycle.netTypeOrder.map((nt) => {
                const rows = cycle.netTypeMap[nt];
                const subtotal = rows.reduce(
                    (acc, r) =>
                        addTotals(acc, {
                            accounts: r.NoOfAccounts ?? 0,
                            sale: r.Sale ?? 0,
                            export: r.Export ?? 0,
                            import: r.Import ?? 0,
                            kwhSales: r.KwhSales ?? 0,
                        }),
                    emptyTotals()
                );
                return { netType: nt, rows, subtotal };
            });

            const cycleTotal = netTypeGroups.reduce(
                (acc, g) => addTotals(acc, g.subtotal),
                emptyTotals()
            );

            return { billCycle: bc, period: cycle.period, netTypeGroups, cycleTotal };
        });
    }, [reportData]);

    const grandTotal: Totals = useMemo(
        () => groupedData.reduce((acc, c) => addTotals(acc, c.cycleTotal), emptyTotals()),
        [groupedData]
    );

    const regionLabel = region.replace(/^R/i, "");

    // CSV Export
    const downloadAsCSV = () => {
        if (!reportData.length) return;

        const headers = [
            "Area Code",
            "No of Accounts",
            "Unit Sale",
            "Export",
            "Import",
            "kWh Sale",
        ];

        const lines: any[][] = [
            ["Electricity Distribution Lanka (Private) Ltd. / Division " + regionLabel],
            [`Fixed Solar Submission Report (${reportLabel})`],
            [`From Bill Cycle ${fromBillCycle} To Bill Cycle ${toBillCycle}`],
            [],
        ];

        groupedData.forEach((cycle) => {
            lines.push([`Bill Cycle - ${cycle.billCycle} (${cycle.period})`]);
            cycle.netTypeGroups.forEach((group) => {
                lines.push([group.netType]);
                lines.push(headers);
                group.rows.forEach((row) => {
                    lines.push([
                        row.AreaCode,
                        row.NoOfAccounts,
                        (row.Sale ?? 0).toFixed(2),
                        (row.Export ?? 0).toFixed(2),
                        (row.Import ?? 0).toFixed(2),
                        (row.KwhSales ?? 0).toFixed(2),
                    ]);
                });
                lines.push([
                    `Total ${group.netType}`,
                    group.subtotal.accounts,
                    group.subtotal.sale.toFixed(2),
                    group.subtotal.export.toFixed(2),
                    group.subtotal.import.toFixed(2),
                    group.subtotal.kwhSales.toFixed(2),
                ]);
                lines.push([]);
            });
            lines.push([
                "Total for bill cycle",
                cycle.cycleTotal.accounts,
                cycle.cycleTotal.sale.toFixed(2),
                cycle.cycleTotal.export.toFixed(2),
                cycle.cycleTotal.import.toFixed(2),
                cycle.cycleTotal.kwhSales.toFixed(2),
            ]);
            lines.push([]);
        });

        lines.push([
            "Total for the period",
            ,
            grandTotal.sale.toFixed(2),
            grandTotal.export.toFixed(2),
            grandTotal.import.toFixed(2),
            grandTotal.kwhSales.toFixed(2),
        ]);

        const csvContent = lines
            .map((row) => row.map((cell) => `"${cell}"`).join(","))
            .join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute(
            "download",
            `PUCSL_Solar_Customers_${reportLabel}_${region}_${fromBillCycle}_${toBillCycle}.csv`
        );
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Print PDF
    const printPDF = () => {
        if (!printRef.current) return;

        const printWindow = window.open("", "_blank");
        if (!printWindow) return;

        printWindow.document.write(`
      <html>
        <head>
          <title>Fixed Solar Submission Report (${reportLabel})</title>
          <style>
            body { font-family: Arial; font-size: 10px; margin: 10mm; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
            th, td { padding: 6px 6px; border: 1px solid #ddd; font-size: 10px; vertical-align: top; }
            .text-left { text-align: left; }
            .text-right { text-align: right; }
            .header {
              font-weight: bold;
              margin-bottom: 5px;
              color: #7A0000;
              font-size: 14px;
              text-align: center;
            }
            .subheader {
              margin-bottom: 12px;
              font-size: 14px;
              font-weight: bold;
              text-align: center;
            }
            .subheader-2 {
              margin-bottom: 12px;
              font-size: 14px;
              
            }
            .cycle-title {
              font-weight: bold;
              font-size: 13px;
              padding-top: 8px;
              padding-bottom: 8px;
              color: #333;
            }
            .nettype-title {
              font-weight: bold;
              font-size: 13px;
              color: #7A0000;
              padding-top: 8px;
              padding-bottom: 8px;
}
            .footer {
              margin-top: 10px;
              font-size: 9px;
              color: #666;
            }
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
            th {
              background-color: #d3d3d3;
              font-weight: bold;
              text-align: center;
            }
            tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            .subtotal-row {
              background-color: #eaeaea;
              font-weight: bold;
            }
            .cycle-total-row {
              background-color: #fadada;
              font-weight: bold;
            }
            tr.grand-total-row td {
              background-color: #7A0000 !important;
              color: white !important;
              font-weight: bold;
           }
          </style>
        </head>
        <body>
          <div class="header">Electricity Distribution Lanka (Private) Ltd. / Division ${regionLabel}</div>
          <div class="subheader">Fixed Solar Submission Report (${reportLabel})</div>
          <div class="subheader-2">From Bill Cycle ${selectedFromDisplay} To Bill Cycle ${selectedToDisplay}
          </div>
          ${printRef.current.innerHTML}
        </body>
      </html>
    `);

        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 500);
    };

    // Render the grouped report table, matching the PDF layout exactly:
    // Bill Cycle section -> Net Type subsection -> area rows -> subtotal ->
    // total for bill cycle -> ... -> total for the period
    const renderTable = () => {
        if (!groupedData.length) {
            return (
                <div className="p-4 bg-gray-100 rounded-lg text-center text-gray-600 text-sm">
                    No data available for the selected criteria
                </div>
            );
        }

        const isLastCycle = (bc: string) =>
            groupedData.length > 0 && groupedData[groupedData.length - 1].billCycle === bc;

        return (
            <table className="w-full border-collapse text-xs">
                {groupedData.map((cycle) => (
                    <React.Fragment key={cycle.billCycle}>
                        {/* Bill cycle heading row — spans the full table width */}
                        <tbody>
                            <tr>
                                <td
                                    colSpan={6}
                                    className="cycle-title border border-gray-300 px-2 py-1.5 bg-gray-100 text-sm font-bold text-gray-700"
                                >
                                    Bill Cycle - {cycle.billCycle}{" "}
                                    <span className="text-gray-500 font-normal">
                                        ({cycle.period})
                                    </span>
                                </td>
                            </tr>
                        </tbody>

                        {cycle.netTypeGroups.map((group) => (
                            <tbody key={group.netType}>
                                <tr>
                                    <td
                                        colSpan={6}
                                        className={`nettype-title border border-gray-300 px-2 py-2 text-sm font-bold ${maroon}`}
                                    >
                                        {group.netType}
                                    </td>
                                </tr>
                                <tr className="bg-gray-200">
                                    <th className="border border-gray-300 px-2 py-1 text-center">
                                        Area Code
                                    </th>
                                    <th className="border border-gray-300 px-2 py-1 text-center">
                                        No of Accounts
                                    </th>
                                    <th className="border border-gray-300 px-2 py-1 text-center">
                                        Unit Sale
                                    </th>
                                    <th className="border border-gray-300 px-2 py-1 text-center">
                                        Export
                                    </th>
                                    <th className="border border-gray-300 px-2 py-1 text-center">
                                        Import
                                    </th>
                                    <th className="border border-gray-300 px-2 py-1 text-center">
                                        kWh Sale
                                    </th>
                                </tr>
                                {group.rows.map((row, idx) => (
                                    <tr
                                        key={`${row.AreaCode}-${idx}`}
                                        className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                                    >
                                        <td className="border border-gray-300 px-2 py-1">
                                            {row.AreaCode}
                                        </td>
                                        <td className="border border-gray-300 px-2 py-1 text-right">
                                            {formatNumber(row.NoOfAccounts, 0)}
                                        </td>
                                        <td className="border border-gray-300 px-2 py-1 text-right">
                                            {formatNumber(row.Sale)}
                                        </td>
                                        <td className="border border-gray-300 px-2 py-1 text-right">
                                            {formatNumber(row.Export)}
                                        </td>
                                        <td className="border border-gray-300 px-2 py-1 text-right">
                                            {formatNumber(row.Import)}
                                        </td>
                                        <td className="border border-gray-300 px-2 py-1 text-right">
                                            {formatNumber(row.KwhSales)}
                                        </td>
                                    </tr>
                                ))}
                                <tr className="subtotal-row bg-gray-200 font-semibold">
                                    <td className="border border-gray-300 px-2 py-1">
                                        Total {group.netType}
                                    </td>
                                    <td className="border border-gray-300 px-2 py-1 text-right">
                                        {formatNumber(group.subtotal.accounts, 0)}
                                    </td>
                                    <td className="border border-gray-300 px-2 py-1 text-right">
                                        {formatNumber(group.subtotal.sale)}
                                    </td>
                                    <td className="border border-gray-300 px-2 py-1 text-right">
                                        {formatNumber(group.subtotal.export)}
                                    </td>
                                    <td className="border border-gray-300 px-2 py-1 text-right">
                                        {formatNumber(group.subtotal.import)}
                                    </td>
                                    <td className="border border-gray-300 px-2 py-1 text-right">
                                        {formatNumber(group.subtotal.kwhSales)}
                                    </td>
                                </tr>
                            </tbody>
                        ))}

                        {/* Total for bill cycle — same table, own tbody */}
                        <tbody>
                            <tr className="cycle-total-row bg-[#7A0000]/10 font-bold">
                                <td className="border border-gray-300 px-2 py-1 w-[16.6%]">
                                    Total for bill cycle
                                </td>
                                <td className="border border-gray-300 px-2 py-1 text-right w-[16.6%]">
                                    {formatNumber(cycle.cycleTotal.accounts, 0)}
                                </td>
                                <td className="border border-gray-300 px-2 py-1 text-right w-[16.6%]">
                                    {formatNumber(cycle.cycleTotal.sale)}
                                </td>
                                <td className="border border-gray-300 px-2 py-1 text-right w-[16.6%]">
                                    {formatNumber(cycle.cycleTotal.export)}
                                </td>
                                <td className="border border-gray-300 px-2 py-1 text-right w-[16.6%]">
                                    {formatNumber(cycle.cycleTotal.import)}
                                </td>
                                <td className="border border-gray-300 px-2 py-1 text-right w-[16.6%]">
                                    {formatNumber(cycle.cycleTotal.kwhSales)}
                                </td>
                            </tr>

                            {/* Grand total — appended right after the last cycle's total, same table */}
                            {isLastCycle(cycle.billCycle) && (
                                <tr className="grand-total-row bg-[#7A0000] text-white font-bold">
                                    <td className="border border-gray-300 px-2 py-2 w-[16.6%]">
                                        Total for the period
                                    </td>
                                    <td className="border border-gray-300 px-2 py-2 text-right w-[16.6%]">

                                    </td>
                                    <td className="border border-gray-300 px-2 py-2 text-right w-[16.6%]">
                                        {formatNumber(grandTotal.sale)}
                                    </td>
                                    <td className="border border-gray-300 px-2 py-2 text-right w-[16.6%]">
                                        {formatNumber(grandTotal.export)}
                                    </td>
                                    <td className="border border-gray-300 px-2 py-2 text-right w-[16.6%]">
                                        {formatNumber(grandTotal.import)}
                                    </td>
                                    <td className="border border-gray-300 px-2 py-2 text-right w-[16.6%]">
                                        {formatNumber(grandTotal.kwhSales)}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </React.Fragment>
                ))}
            </table>
        );
    };

    return (
        <div className="p-6 bg-white rounded-lg shadow-md">
            {!reportVisible && (
                <>
                    <h2 className={`text-xl font-bold mb-6 ${maroon}`}>
                        Fixed Solar Submission Report ({reportLabel})
                    </h2>
                    <form onSubmit={handleSubmit}>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Region */}
                            <div>
                                <label
                                    htmlFor={`region-${reportLabel}`}
                                    className="block text-xs font-semibold mb-1 text-[#7A0000]"
                                >
                                    Region:
                                </label>
                                <select
                                    id={`region-${reportLabel}`}
                                    value={region}
                                    onChange={(e) => setRegion(e.target.value)}
                                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent bg-white"
                                    required
                                >
                                    <option value="">Select Region</option>
                                    {isLoadingDivisions ? (
                                        <option value="">Loading...</option>
                                    ) : divisionError ? (
                                        <option value="">Error loading regions</option>
                                    ) : (
                                        divisions.map((division) => (
                                            <option key={division.RegionCode} value={division.RegionCode}>
                                                {division.RegionCode}
                                            </option>
                                        ))
                                    )}
                                </select>
                            </div>

                            {/* From Bill Cycle */}
                            <div>
                                <label
                                    htmlFor={`fromBillCycle-${reportLabel}`}
                                    className="block text-xs font-semibold mb-1 text-[#7A0000]"
                                >
                                    From Bill Cycle:
                                </label>
                                <select
                                    id={`fromBillCycle-${reportLabel}`}
                                    value={fromBillCycle}
                                    onChange={(e) => setFromBillCycle(e.target.value)}
                                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent bg-white"
                                    required
                                >
                                    <option value="">Select Bill Cycle</option>
                                    {isLoadingBillCycles ? (
                                        <option value="">Loading...</option>
                                    ) : billCycleError ? (
                                        <option value="">Error loading bill cycles</option>
                                    ) : (
                                        billCycleOptions.map((opt) => (
                                            <option key={opt.code} value={opt.code}>
                                                {opt.display}
                                            </option>
                                        ))
                                    )}
                                </select>
                            </div>

                            {/* To Bill Cycle */}
                            <div>
                                <label
                                    htmlFor={`toBillCycle-${reportLabel}`}
                                    className="block text-xs font-semibold mb-1 text-[#7A0000]"
                                >
                                    To Bill Cycle:
                                </label>
                                <select
                                    id={`toBillCycle-${reportLabel}`}
                                    value={toBillCycle}
                                    onChange={(e) => setToBillCycle(e.target.value)}
                                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent bg-white"
                                    required
                                >
                                    <option value="">Select Bill Cycle</option>
                                    {isLoadingBillCycles ? (
                                        <option value="">Loading...</option>
                                    ) : billCycleError ? (
                                        <option value="">Error loading bill cycles</option>
                                    ) : (
                                        billCycleOptions.map((opt) => (
                                            <option key={opt.code} value={opt.code}>
                                                {opt.display}
                                            </option>
                                        ))
                                    )}
                                </select>
                            </div>
                        </div>

                        {fromBillCycle &&
                            toBillCycle &&
                            parseInt(fromBillCycle) > parseInt(toBillCycle) && (
                                <p className="text-xs text-red-600 mt-2">
                                    "From Bill Cycle" cannot be greater than "To Bill Cycle".
                                </p>
                            )}

                        {/* Submit button */}
                        <div className="w-full mt-6 flex justify-end">
                            <button
                                type="submit"
                                className={`px-6 py-2 rounded-md font-medium transition-opacity duration-300 shadow
                  ${maroonGrad} text-white ${loading || !canSubmit()
                                        ? "opacity-70 cursor-not-allowed"
                                        : "hover:opacity-90"
                                    }`}
                                disabled={loading || !canSubmit()}
                            >
                                {loading ? (
                                    <span className="flex items-center">
                                        <svg
                                            className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
                                            ></circle>
                                            <path
                                                className="opacity-75"
                                                fill="currentColor"
                                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                            ></path>
                                        </svg>
                                        Loading...
                                    </span>
                                ) : (
                                    "Generate Report"
                                )}
                            </button>
                        </div>
                    </form>
                </>
            )}

            {/* Error Message (when not in report view) */}
            {!reportVisible && reportError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                    {reportError}
                </div>
            )}

            {/* Report Section */}
            {reportVisible && (
                <div className="mt-6">
                    {/* Report Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
                        <div>
                            <h2 className={`text-xl font-bold ${maroon}`}>
                                Fixed Solar Submission Report ({reportLabel})
                            </h2>
                            <p className="text-sm text-gray-600 mt-1">
                                Division {regionLabel} | From Bill Cycle {selectedFromDisplay} To Bill
                                Cycle {selectedToDisplay}
                            </p>
                        </div>
                        <div className="flex space-x-2 mt-2 md:mt-0">
                            <button
                                onClick={downloadAsCSV}
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

                    {/* Report Table */}
                    <div className="overflow-auto max-h-[calc(100vh-250px)] border border-gray-300 rounded-lg">
                        <div ref={printRef} className="min-w-full py-4 px-4">
                            {renderTable()}
                        </div>
                    </div>

                    {/* Error Message */}
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

const PUCSLSolarCustomers: React.FC = () => {
    return (
        <div className="space-y-6">
            {/* Bulk card */}
            <SolarCustomersCard reportLabel="Bulk" apiUrl="/misapi/api/pucsl/bulkSolarCustomers" />

            {/* Ordinary card */}
            <SolarCustomersCard reportLabel="Ordinary" apiUrl="/misapi/api/pucsl/ordinarySolarCustomers" />
        </div>
    );
};

export default PUCSLSolarCustomers;