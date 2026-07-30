import React, { useState, useEffect, useRef, JSX } from "react";
import { FaFileDownload, FaPrint } from "react-icons/fa";
import { useUser } from "../../contexts/UserContext";
import { useReportScope } from "../../hooks/useReportScope";

interface Area {
    AreaCode: string;
    AreaName: string;
    ErrorMessage?: string | null;
}

interface Province {
    ProvinceCode: string;
    ProvinceName: string;
    ErrorMessage?: string | null;
}

interface Division {
    RegionCode: string;
    ErrorMessage?: string | null;
}

interface BillCycleOption {
    display: string;
    code: string;
}

interface DetailedRetailPayment {
    Division: string;
    Province: string;
    Area: string;
    CustomerName: string;
    AccountNumber: string;
    PanelCapacity: number;
    EnergyExported: number;
    EnergyImported: number;
    Tariff: string;
    BFUnits: number;
    UnitsInBill: number;
    Period: number;
    KwhCharge: number;
    FixedCharge: number;
    FuelCharge: number;
    CFUnits: number;
    Rate: number;
    UnitSale: number;
    KwhSales: number;
    BankCode: string;
    BranchCode: string;
    BankAccountNumber: string;
    AgreementDate: string;
    ErrorMessage?: string;
}

interface SummaryRetailPayment {
    NetType: string;
    NoOfAccounts: number;
    EnergyExported: number;
    EnergyImported: number;
    UnitSaleKwh: number;
    UnitSaleRs: number;
    KwhPayableBalance: number;
    ErrorMessage?: string;
}

const SolarPaymentRetail: React.FC = () => {
    const maroon = "text-[#7A0000]";
    const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";

    const [selectedCycleType, setSelectedCycleType] = useState<string>("");
    const [cycleValue, setCycleValue] = useState<string>("");
    const [reportType, setReportType] = useState<string>("");
    const [selectedCategory, setSelectedCategory] = useState<string>("Area");
    const [categoryValue, setCategoryValue] = useState<string>("");
    const [netType, setNetType] = useState<string>("");
    const [loading, setLoading] = useState(false);

    // Data states
    const [areas, setAreas] = useState<Area[]>([]);
    const [provinces, setProvinces] = useState<Province[]>([]);
    const [divisions, setDivisions] = useState<Division[]>([]);
    const [cycleOptions, setCycleOptions] = useState<BillCycleOption[]>([]);

    // Loading states
    const [isLoadingAreas, setIsLoadingAreas] = useState(false);
    const [isLoadingProvinces, setIsLoadingProvinces] = useState(false);
    const [isLoadingDivisions, setIsLoadingDivisions] = useState(false);
    const [isLoadingCycles, setIsLoadingCycles] = useState(false);

    // Error states
    const [areaError, setAreaError] = useState<string | null>(null);
    const [provinceError, setProvinceError] = useState<string | null>(null);
    const [divisionError, setDivisionError] = useState<string | null>(null);
    const [cycleError, setCycleError] = useState<string | null>(null);
    const [reportError, setReportError] = useState<string | null>(null);

    // Display states
    const [selectedCategoryName, setSelectedCategoryName] = useState<string>("");
    const [selectedCycleDisplay, setSelectedCycleDisplay] = useState<string>("");
    const [reportVisible, setReportVisible] = useState(false);

    // Report data
    const [detailedData, setDetailedData] = useState<DetailedRetailPayment[]>(
        []
    );
    const [ordinarySummaryData, setOrdinarySummaryData] = useState<
        SummaryRetailPayment[]
    >([]);
    const [bulkSummaryData, setBulkSummaryData] = useState<
        SummaryRetailPayment[]
    >([]);

    const { user } = useUser();
    const { allowedCategories, locked } = useReportScope();

    const printRef = useRef<HTMLDivElement>(null);

    // Helper function for error handling
    const fetchWithErrorHandling = async (url: string) => {
        try {
            const response = await fetch(url, {
                headers: {
                    Accept: "application/json",
                },
            });

            if (!response.ok) {
                let errorMsg = `HTTP error! status: ${response.status}`;
                try {
                    const errorData = await response.json();
                    if (errorData.errorMessage) {
                        errorMsg = errorData.errorMessage;
                    }
                } catch (e) {
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

    // Generate cycle options
    const generateCycleOptions = (
        cycles: string[],
        maxCycle: string,
        cycleType: string
    ): BillCycleOption[] => {
        const maxCycleNum = parseInt(maxCycle);
        return cycles.map((cycle, index) => ({
            display:
                cycleType === "Calculation Cycle"
                    ? cycle
                    : `${(maxCycleNum - index).toString()} - ${cycle}`,
            code: (maxCycleNum - index).toString(),
        }));
    };

    // Sort data alphabetically
    const sortDataAlphabetically = (
        data: DetailedRetailPayment[]
    ): DetailedRetailPayment[] => {
        return [...data].sort((a, b) => {
            if (a.Division < b.Division) return -1;
            if (a.Division > b.Division) return 1;
            if (a.Province < b.Province) return -1;
            if (a.Province > b.Province) return 1;
            if (a.Area < b.Area) return -1;
            if (a.Area > b.Area) return 1;
            return 0;
        });
    };

    // Fetch areas
    useEffect(() => {
        const fetchAreas = async () => {
            setIsLoadingAreas(true);
            setAreaError(null);
            try {
                let url = "/misapi/api/ordinary/areas";
                if (locked["Region"]?.code) {
                    url += `?regionCode=${locked["Region"].code}`;
                } else if (locked["Province"]?.code) {
                    url += `?provCode=${locked["Province"].code}`;
                }
                const areaData = await fetchWithErrorHandling(url);
                const sortedAreas = (areaData.data || []).sort((a: Area, b: Area) =>
                    a.AreaName.localeCompare(b.AreaName)
                );
                setAreas(sortedAreas);
            } catch (err: any) {
                console.error("Error fetching areas:", err);
                setAreaError(
                    err.message || "Failed to load areas. Please try again later."
                );
            } finally {
                setIsLoadingAreas(false);
            }
        };

        fetchAreas();
    }, [user.Level]);

    // Fetch provinces
    useEffect(() => {
        const fetchProvinces = async () => {
            setIsLoadingProvinces(true);
            setProvinceError(null);
            try {
                let url = "/misapi/api/ordinary/province";
                if (locked["Region"]?.code) {
                    url += `?regionCode=${locked["Region"].code}`;
                }
                const provinceData = await fetchWithErrorHandling(url);
                const sortedProvinces = (provinceData.data || []).sort(
                    (a: Province, b: Province) =>
                        a.ProvinceName.localeCompare(b.ProvinceName)
                );
                setProvinces(sortedProvinces);
            } catch (err: any) {
                console.error("Error fetching provinces:", err);
                setProvinceError(
                    err.message ||
                    "Failed to load provinces. Please try again later."
                );
            } finally {
                setIsLoadingProvinces(false);
            }
        };

        fetchProvinces();
    }, [user.Level]);

    // Fetch divisions
    useEffect(() => {
        const fetchDivisions = async () => {
            setIsLoadingDivisions(true);
            setDivisionError(null);
            try {
                const divisionData = await fetchWithErrorHandling(
                    "/misapi/api/ordinary/region"
                );
                const sortedDivisions = (divisionData.data || []).sort(
                    (a: Division, b: Division) =>
                        a.RegionCode.localeCompare(b.RegionCode)
                );
                setDivisions(sortedDivisions);
            } catch (err: any) {
                console.error("Error fetching divisions:", err);
                setDivisionError(
                    err.message ||
                    "Failed to load divisions. Please try again later."
                );
            } finally {
                setIsLoadingDivisions(false);
            }
        };

        fetchDivisions();
    }, []);

    useEffect(() => {
        const key = selectedCategory === "Division" ? "Region" : selectedCategory;
        const lock = locked[key as keyof typeof locked];
        if (lock) {
            setCategoryValue(lock.code);
            setSelectedCategoryName(lock.name ? `${lock.code} - ${lock.name}` : lock.code);
        }
    }, [selectedCategory, locked]);

    // Fetch cycles based on cycle type
    useEffect(() => {
        if (!selectedCycleType) {
            setCycleOptions([]);
            setCycleValue("");
            setSelectedCycleDisplay("");
            return;
        }

        const fetchCycles = async () => {
            setIsLoadingCycles(true);
            setCycleError(null);
            setCycleOptions([]);
            setCycleValue("");
            setSelectedCycleDisplay("");

            try {
                const cycleData = await fetchWithErrorHandling(
                    "/misapi/api/ordinary/netmtcons/billcycle/max"
                );
                if (cycleData.data && cycleData.data.BillCycles?.length > 0) {
                    const options = generateCycleOptions(
                        cycleData.data.BillCycles,
                        cycleData.data.MaxBillCycle,
                        selectedCycleType
                    );
                    setCycleOptions(options);
                } else {
                    setCycleOptions([]);
                }
            } catch (err: any) {
                console.error("Error fetching cycles:", err);
                setCycleError(
                    err.message || "Failed to load cycles. Please try again later."
                );
            } finally {
                setIsLoadingCycles(false);
            }
        };

        fetchCycles();
    }, [selectedCycleType]);

    const handleCycleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        setSelectedCycleType(value);
        setCycleValue("");
        setSelectedCycleDisplay("");
    };

    const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        setSelectedCategory(value);
        setCategoryValue("");
        setSelectedCategoryName("");
    };

    const formatCurrency = (value: number): string => {
        return value.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    };

    const formatNumber = (value: string | number): string => {
        return typeof value === "number" ? value.toLocaleString("en-US") : value;
    };

    const downloadAsCSV = () => {
        if (reportType === "Summary Report") {
            downloadSummaryCSV();
        } else if (detailedData.length) {
            downloadDetailedCSV();
        }
    };

    const downloadDetailedCSV = () => {
        if (!detailedData.length) return;

        const reportTitle =
            "Solar Payment Information For Current Month - Retail";
        const selectionInfo =
            selectedCategory === "Entire CEB"
                ? "Entire CEB"
                : selectedCategory === "Area"
                    ? `${selectedCategory}: ${selectedCategoryName}`
                    : `${selectedCategory}: ${categoryValue}`;

        const cycleInfo = `${selectedCycleType}: ${selectedCycleDisplay}`;
        const reportTypeInfo = `Report Type: ${reportType}`;
        const netTypeInfo = `Net Type: ${netType}`;
        const generatedDate = `Generated: ${new Date().toLocaleDateString()}`;

        const headers = [
            "Division",
            "Province",
            "Area",
            "Name of Customer",
            "A/C No.",
            "Panel Capacity (kW)",
            "Energy Exported (kWh)",
            "Energy Imported (kWh)",
            "Tariff",
            "BF Units",
            "Units in Bill",
            "Period",
            "KWH Charge",
            "Fixed Charge",
            "Fuel Charge",
            "CF Units",
            "Rate",
            "Units Sale",
            "KWH Sales",
            "Bank Code",
            "Branch Code",
            "Bank Account Number",
            "Agreement Date",
        ];

        // Helper function to escape CSV values
        const escapeCSV = (value: string | number): string => {
            const strValue = String(value);
            if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
                return `"${strValue.replace(/"/g, '""')}"`;
            }
            return strValue;
        };

        // Helper function to format numbers
        const formatNumberCSV = (num: number, decimals: number = 2): string => {
            return num.toLocaleString('en-US', {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals
            });
        };

        const sortedData = sortDataAlphabetically(detailedData);

        // Group data by division, province, and area
        const divisionGroups: { [key: string]: DetailedRetailPayment[] } = {};
        const provinceGroups: { [key: string]: DetailedRetailPayment[] } = {};
        const areaGroups: { [key: string]: DetailedRetailPayment[] } = {};

        sortedData.forEach((item) => {
            if (!divisionGroups[item.Division]) divisionGroups[item.Division] = [];
            divisionGroups[item.Division].push(item);
        });

        sortedData.forEach((item) => {
            const provinceKey = `${item.Division}-${item.Province}`;
            if (!provinceGroups[provinceKey]) provinceGroups[provinceKey] = [];
            provinceGroups[provinceKey].push(item);
        });

        sortedData.forEach((item) => {
            const areaKey = `${item.Division}-${item.Province}-${item.Area}`;
            if (!areaGroups[areaKey]) areaGroups[areaKey] = [];
            areaGroups[areaKey].push(item);
        });

        // Get unique divisions in order
        const uniqueDivisions = Object.keys(divisionGroups).sort();

        const dataRows: string[] = [];

        // Track current context for merged cell simulation
        let currentDivision = "";
        let currentProvince = "";
        let currentArea = "";

        uniqueDivisions.forEach((division) => {
            const provincesInDivision = Object.keys(provinceGroups)
                .filter(pk => pk.startsWith(`${division}-`))
                .sort();

            provincesInDivision.forEach((provinceKey) => {
                const areasInProvince = Object.keys(areaGroups)
                    .filter(ak => ak.startsWith(`${provinceKey}-`))
                    .sort();

                areasInProvince.forEach((areaKey) => {
                    const items = areaGroups[areaKey];

                    items.forEach((row) => {
                        const divisionValue = currentDivision !== row.Division ? row.Division : "";
                        const provinceValue = currentProvince !== `${row.Division}-${row.Province}` ? row.Province : "";
                        const areaValue = currentArea !== `${row.Division}-${row.Province}-${row.Area}` ? row.Area : "";

                        // Update tracking
                        if (divisionValue) {
                            currentDivision = row.Division;
                            currentProvince = "";
                            currentArea = "";
                        }
                        if (provinceValue) {
                            currentProvince = `${row.Division}-${row.Province}`;
                            currentArea = "";
                        }
                        if (areaValue) {
                            currentArea = `${row.Division}-${row.Province}-${row.Area}`;
                        }

                        dataRows.push([
                            escapeCSV(divisionValue),
                            escapeCSV(provinceValue),
                            escapeCSV(areaValue),
                            escapeCSV(row.CustomerName),
                            escapeCSV(row.AccountNumber),
                            escapeCSV(formatNumberCSV(row.PanelCapacity, 2)),
                            escapeCSV(row.EnergyExported.toLocaleString('en-US')),
                            escapeCSV(row.EnergyImported.toLocaleString('en-US')),
                            escapeCSV(row.Tariff),
                            escapeCSV(row.BFUnits.toLocaleString('en-US')),
                            escapeCSV(row.UnitsInBill.toLocaleString('en-US')),
                            escapeCSV(row.Period.toString()),
                            escapeCSV(formatNumberCSV(row.KwhCharge, 2)),
                            escapeCSV(formatNumberCSV(row.FixedCharge, 2)),
                            escapeCSV(formatNumberCSV(row.FuelCharge, 2)),
                            escapeCSV(row.CFUnits.toLocaleString('en-US')),
                            escapeCSV(formatNumberCSV(row.Rate, 2)),
                            escapeCSV(row.UnitSale.toLocaleString('en-US')),
                            escapeCSV(formatNumberCSV(row.KwhSales, 2)),
                            escapeCSV(row.BankCode),
                            escapeCSV(row.BranchCode),
                            escapeCSV(row.BankAccountNumber),
                            escapeCSV(row.AgreementDate),
                        ].join(","));
                    });

                    // Add Area Total if more than 1 record in area
                    if (items.length > 1) {
                        const totals = {
                            count: items.length,
                            panelCapacity: items.reduce((sum, item) => sum + item.PanelCapacity, 0),
                            energyExported: items.reduce((sum, item) => sum + item.EnergyExported, 0),
                            energyImported: items.reduce((sum, item) => sum + item.EnergyImported, 0),
                        };

                        dataRows.push([
                            "",
                            "",
                            "",
                            "Area Total",
                            escapeCSV(totals.count.toString()),
                            escapeCSV(formatNumberCSV(totals.panelCapacity, 2)),
                            escapeCSV(totals.energyExported.toLocaleString('en-US')),
                            escapeCSV(totals.energyImported.toLocaleString('en-US')),
                            "",
                            "",
                            "",
                            "",
                            "",
                            "",
                            "",
                            "",
                            "",
                            "",
                            "",
                            "",
                            "",
                            "",
                            "",
                        ].join(","));
                    }
                });

                // Add Province Total if more than 1 area
                if (areasInProvince.length > 1) {
                    const provinceItems = provinceGroups[provinceKey];
                    const totals = {
                        count: provinceItems.length,
                        panelCapacity: provinceItems.reduce((sum, item) => sum + item.PanelCapacity, 0),
                        energyExported: provinceItems.reduce((sum, item) => sum + item.EnergyExported, 0),
                        energyImported: provinceItems.reduce((sum, item) => sum + item.EnergyImported, 0),
                    };

                    dataRows.push([
                        "",
                        "",
                        "Province Total",
                        "",
                        escapeCSV(totals.count.toString()),
                        escapeCSV(formatNumberCSV(totals.panelCapacity, 2)),
                        escapeCSV(totals.energyExported.toLocaleString('en-US')),
                        escapeCSV(totals.energyImported.toLocaleString('en-US')),
                        "",
                        "",
                        "",
                        "",
                        "",
                        "",
                        "",
                        "",
                        "",
                        "",
                        "",
                        "",
                        "",
                        "",
                        "",
                    ].join(","));
                }
            });

            // Add Division Total if more than 1 province
            if (provincesInDivision.length > 1) {
                const divisionItems = divisionGroups[division];
                const totals = {
                    count: divisionItems.length,
                    panelCapacity: divisionItems.reduce((sum, item) => sum + item.PanelCapacity, 0),
                    energyExported: divisionItems.reduce((sum, item) => sum + item.EnergyExported, 0),
                    energyImported: divisionItems.reduce((sum, item) => sum + item.EnergyImported, 0),
                };

                dataRows.push([
                    "",
                    "Division Total",
                    "",
                    "",
                    escapeCSV(totals.count.toString()),
                    escapeCSV(formatNumberCSV(totals.panelCapacity, 2)),
                    escapeCSV(totals.energyExported.toLocaleString('en-US')),
                    escapeCSV(totals.energyImported.toLocaleString('en-US')),
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                ].join(","));
            }
        });

        // Combine all parts
        const csvContent = [
            reportTitle,
            `${selectionInfo} | ${cycleInfo} | ${reportTypeInfo} | ${netTypeInfo}`,
            generatedDate,
            "", // Empty line
            headers.join(","),
            ...dataRows,
        ].join("\n");

        try {
            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");

            const fileDescriptor =
                selectedCategory === "Entire CEB"
                    ? "EntireCEB"
                    : selectedCategory === "Area"
                        ? `${selectedCategory}_${selectedCategoryName}`
                        : `${selectedCategory}_${categoryValue}`;

            link.setAttribute("href", url);
            link.setAttribute(
                "download",
                `SolarPaymentRetail_${fileDescriptor}_${selectedCycleType.replace(
                    " ",
                    ""
                )}_${cycleValue}.csv`
            );
            link.style.visibility = "hidden";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(url), 100);
        } catch (error) {
            console.error("Error generating CSV:", error);
            alert("Failed to export CSV");
        }
    };

    const downloadSummaryCSV = () => {
        const reportTitle =
            "Solar Payment Information For Current Month - Retail Summary";
        const headers = [
            "Net Type",
            "No of Accounts",
            "Energy Exported (kWh)",
            "Energy Imported (kWh)",
            "Unit Sale (KWH)",
            "Unit Sale (Rs)",
            "KWH payable balances to Customer (Rs)",
        ];

        // Calculate totals for ordinary
        const ordinaryTotals = ordinarySummaryData.reduce(
            (acc, item) => {
                acc.accounts += item.NoOfAccounts;
                acc.exported += item.EnergyExported;
                acc.imported += item.EnergyImported;
                acc.unitSaleKwh += item.UnitSaleKwh;
                acc.unitSaleRs += item.UnitSaleRs;
                acc.payableBalance += item.KwhPayableBalance;
                return acc;
            },
            {
                accounts: 0,
                exported: 0,
                imported: 0,
                unitSaleKwh: 0,
                unitSaleRs: 0,
                payableBalance: 0,
            }
        );

        // Calculate totals for bulk
        const bulkTotals = bulkSummaryData.reduce(
            (acc, item) => {
                acc.accounts += item.NoOfAccounts;
                acc.exported += item.EnergyExported;
                acc.imported += item.EnergyImported;
                acc.unitSaleKwh += item.UnitSaleKwh;
                acc.unitSaleRs += item.UnitSaleRs;
                acc.payableBalance += item.KwhPayableBalance;
                return acc;
            },
            {
                accounts: 0,
                exported: 0,
                imported: 0,
                unitSaleKwh: 0,
                unitSaleRs: 0,
                payableBalance: 0,
            }
        );

        const ordinaryRows = ordinarySummaryData.map((item) => [
            item.NetType,
            formatNumber(item.NoOfAccounts),
            formatNumber(item.EnergyExported),
            formatNumber(item.EnergyImported),
            formatNumber(item.UnitSaleKwh),
            formatNumber(item.UnitSaleRs),
            formatNumber(item.KwhPayableBalance),
        ]);

        const ordinaryTotalRow = [
            "Total",
            ordinaryTotals.accounts.toLocaleString(),
            ordinaryTotals.exported.toLocaleString(),
            ordinaryTotals.imported.toLocaleString(),
            ordinaryTotals.unitSaleKwh.toLocaleString(),
            formatCurrency(ordinaryTotals.unitSaleRs),
            formatCurrency(ordinaryTotals.payableBalance),
        ];

        const bulkRows = bulkSummaryData.map((item) => [
            item.NetType,
            formatNumber(item.NoOfAccounts),
            formatNumber(item.EnergyExported),
            formatNumber(item.EnergyImported),
            formatNumber(item.UnitSaleKwh),
            formatNumber(item.UnitSaleRs),
            formatNumber(item.KwhPayableBalance),
        ]);

        const bulkTotalRow =
            bulkSummaryData.length > 0
                ? [
                    "Total",
                    bulkTotals.accounts.toLocaleString(),
                    bulkTotals.exported.toLocaleString(),
                    bulkTotals.imported.toLocaleString(),
                    bulkTotals.unitSaleKwh.toLocaleString(),
                    formatCurrency(bulkTotals.unitSaleRs),
                    formatCurrency(bulkTotals.payableBalance),
                ]
                : [];

        const csvRows = [
            reportTitle,
            `${selectedCycleType}: ${selectedCycleDisplay}`,
            `Generated: ${new Date().toLocaleDateString()}`,
            "",
            "Ordinary Customer Details",
            headers.map((h) => `"${h}"`).join(","),
            ...ordinaryRows.map((row) =>
                row.map((cell: any) => `"${cell}"`).join(",")
            ),
            ordinaryTotalRow.map((cell: any) => `"${cell}"`).join(","),
        ];

        if (bulkSummaryData.length > 0) {
            csvRows.push(
                "",
                "Bulk Customer Details",
                headers.map((h) => `"${h}"`).join(","),
                ...bulkRows.map((row) =>
                    row.map((cell: any) => `"${cell}"`).join(",")
                ),
                bulkTotalRow.map((cell: any) => `"${cell}"`).join(",")
            );
        }

        const csvContent = csvRows.join("\n");

        try {
            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");

            link.setAttribute("href", url);
            link.setAttribute(
                "download",
                `SolarPaymentRetail_Summary_${selectedCycleType.replace(
                    " ",
                    ""
                )}_${cycleValue}.csv`
            );
            link.style.visibility = "hidden";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(url), 100);
        } catch (error) {
            console.error("Error generating CSV:", error);
            alert("Failed to export CSV");
        }
    };

    const printPDF = () => {
        if (!printRef.current) return;

        const printWindow = window.open("", "_blank");
        if (!printWindow) return;

        let reportTitle = "";
        let selectionInfo = "";

        if (reportType === "Summary Report") {
            reportTitle =
                "SOLAR PAYMENT INFORMATION FOR CURRENT MONTH - RETAIL SUMMARY";
            selectionInfo = `${selectedCycleType}: <span class="bold">${selectedCycleDisplay}</span>`;
        } else {
            reportTitle = "SOLAR PAYMENT INFORMATION FOR CURRENT MONTH - RETAIL";
            const categoryInfo = (() => {
                if (selectedCategory === "Entire CEB") {
                    return "Entire CEB";
                } else if (selectedCategory === "Area") {
                    return `${selectedCategory}: <span class="bold">${selectedCategoryName}</span>`;
                } else {
                    return `${selectedCategory}: <span class="bold">${categoryValue}</span>`;
                }
            })();
            selectionInfo = `${categoryInfo}<br>${selectedCycleType}: <span class="bold">${selectedCycleDisplay}</span><br>Report Type: <span class="bold">${reportType}</span><br>Net Type: <span class="bold">${netType}</span>`;
        }

        printWindow.document.write(`
      <html>
        <head>
          <title>Solar Payment Retail Report</title>
          <style>
            body { font-family: Arial; font-size: 10px; margin: 10mm; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { padding: 4px 6px; border: 1px solid #ddd; font-size: 10px; vertical-align: top;}
            .text-left { text-align: left; }
            .text-right { text-align: right; }
            .header { 
              font-weight: bold; 
              margin-bottom: 5px; 
              color: #7A0000;
              font-size: 12px;
            }
            .subheader { 
              margin-bottom: 12px; 
              font-size: 11px;
            }
            .section-title {
              font-weight: bold;
              font-size: 11px;
              margin-top: 15px;
              margin-bottom: 8px;
              color: #333;
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
            .bold {
              font-weight: bold;
            }
            .total-row {
              background-color: #d3d3d3;
              font-weight: bold;
            }
            .whitespace-nowrap {
              white-space: nowrap;
            }
            .bg-green-50 {
              font-weight: bold !important;
            }
            .bg-green-50 td {
              font-weight: bold !important;
            }
            .bg-blue-50 {
              font-weight: bold !important;
            }
            .bg-blue-50 td {
              font-weight: bold !important;
            }
            .bg-yellow-50 {
              font-weight: bold !important;
            }
            .bg-yellow-50 td {
              font-weight: bold !important;
            }
            .font-medium, .font-semibold, .font-bold {
              font-weight: bold !important;
            }
          </style>
        </head>
        <body>
          <div class="header">${reportTitle}</div>
          <div class="subheader">
            ${selectionInfo}
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

    const renderSummaryTables = () => {
        // Calculate totals for ordinary
        const ordinaryTotals = ordinarySummaryData.reduce(
            (acc, item) => {
                acc.accounts += item.NoOfAccounts;
                acc.exported += item.EnergyExported;
                acc.imported += item.EnergyImported;
                acc.unitSaleKwh += item.UnitSaleKwh;
                acc.unitSaleRs += item.UnitSaleRs;
                acc.payableBalance += item.KwhPayableBalance;
                return acc;
            },
            {
                accounts: 0,
                exported: 0,
                imported: 0,
                unitSaleKwh: 0,
                unitSaleRs: 0,
                payableBalance: 0,
            }
        );

        // Calculate totals for bulk
        const bulkTotals = bulkSummaryData.reduce(
            (acc, item) => {
                acc.accounts += item.NoOfAccounts;
                acc.exported += item.EnergyExported;
                acc.imported += item.EnergyImported;
                acc.unitSaleKwh += item.UnitSaleKwh;
                acc.unitSaleRs += item.UnitSaleRs;
                acc.payableBalance += item.KwhPayableBalance;
                return acc;
            },
            {
                accounts: 0,
                exported: 0,
                imported: 0,
                unitSaleKwh: 0,
                unitSaleRs: 0,
                payableBalance: 0,
            }
        );

        return (
            <div>
                {/* Ordinary Customer Details */}
                <h3 className="text-base font-bold mb-3 text-gray-700">
                    Ordinary Customer Details
                </h3>
                <table className="w-full border-collapse text-xs">
                    <thead className="bg-gray-200 sticky top-0">
                        <tr>
                            <th className="border border-gray-300 px-2 py-1 text-center">
                                Net Type
                            </th>
                            <th className="border border-gray-300 px-2 py-1 text-center">
                                No of Accounts
                            </th>
                            <th className="border border-gray-300 px-2 py-1 text-center">
                                Energy Exported
                                <br />
                                (kWh)
                            </th>
                            <th className="border border-gray-300 px-2 py-1 text-center">
                                Energy Imported
                                <br />
                                (kWh)
                            </th>
                            <th className="border border-gray-300 px-2 py-1 text-center">
                                Unit Sale
                                <br />
                                (KWH)
                            </th>
                            <th className="border border-gray-300 px-2 py-1 text-center">
                                Unit Sale (Rs)
                            </th>
                            <th className="border border-gray-300 px-2 py-1 text-center">
                                KWH payable
                                <br />
                                balances to
                                <br />
                                Customer (Rs)
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {ordinarySummaryData.map((item, index) => (
                            <tr
                                key={index}
                                className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                            >
                                <td className="border border-gray-300 px-2 py-1">
                                    {item.NetType}
                                </td>
                                <td className="border border-gray-300 px-2 py-1 text-right">
                                    {formatNumber(item.NoOfAccounts)}
                                </td>
                                <td className="border border-gray-300 px-2 py-1 text-right">
                                    {formatNumber(item.EnergyExported)}
                                </td>
                                <td className="border border-gray-300 px-2 py-1 text-right">
                                    {formatNumber(item.EnergyImported)}
                                </td>
                                <td className="border border-gray-300 px-2 py-1 text-right">
                                    {formatNumber(item.UnitSaleKwh)}
                                </td>
                                <td className="border border-gray-300 px-2 py-1 text-right">
                                    {formatNumber(item.UnitSaleRs)}
                                </td>
                                <td className="border border-gray-300 px-2 py-1 text-right">
                                    {formatNumber(item.KwhPayableBalance)}
                                </td>
                            </tr>
                        ))}
                        <tr className="bg-gray-200 font-bold">
                            <td className="border border-gray-300 px-2 py-1">Total</td>
                            <td className="border border-gray-300 px-2 py-1 text-right">
                                {ordinaryTotals.accounts.toLocaleString()}
                            </td>
                            <td className="border border-gray-300 px-2 py-1 text-right">
                                {ordinaryTotals.exported.toLocaleString()}
                            </td>
                            <td className="border border-gray-300 px-2 py-1 text-right">
                                {ordinaryTotals.imported.toLocaleString()}
                            </td>
                            <td className="border border-gray-300 px-2 py-1 text-right">
                                {ordinaryTotals.unitSaleKwh.toLocaleString()}
                            </td>
                            <td className="border border-gray-300 px-2 py-1 text-right">
                                {formatCurrency(ordinaryTotals.unitSaleRs)}
                            </td>
                            <td className="border border-gray-300 px-2 py-1 text-right">
                                {formatCurrency(ordinaryTotals.payableBalance)}
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* Bulk Customer Details */}
                {bulkSummaryData.length > 0 && (
                    <>
                        <h3 className="text-base font-bold mb-3 text-gray-700 mt-6">
                            Bulk Customer Details
                        </h3>
                        <table className="w-full border-collapse text-xs">
                            <thead className="bg-gray-200 sticky top-0">
                                <tr>
                                    <th className="border border-gray-300 px-2 py-1 text-center">
                                        Net Type
                                    </th>
                                    <th className="border border-gray-300 px-2 py-1 text-center">
                                        No of Accounts
                                    </th>
                                    <th className="border border-gray-300 px-2 py-1 text-center">
                                        Energy Exported
                                        <br />
                                        (kWh)
                                    </th>
                                    <th className="border border-gray-300 px-2 py-1 text-center">
                                        Energy Imported
                                        <br />
                                        (kWh)
                                    </th>
                                    <th className="border border-gray-300 px-2 py-1 text-center">
                                        Unit Sale
                                        <br />
                                        (KWH)
                                    </th>
                                    <th className="border border-gray-300 px-2 py-1 text-center">
                                        Unit Sale (Rs)
                                    </th>
                                    <th className="border border-gray-300 px-2 py-1 text-center">
                                        KWH payable
                                        <br />
                                        balances to
                                        <br />
                                        Customer (Rs)
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {bulkSummaryData.map((item, index) => (
                                    <tr
                                        key={index}
                                        className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                                    >
                                        <td className="border border-gray-300 px-2 py-1">
                                            {item.NetType}
                                        </td>
                                        <td className="border border-gray-300 px-2 py-1 text-right">
                                            {formatNumber(item.NoOfAccounts)}
                                        </td>
                                        <td className="border border-gray-300 px-2 py-1 text-right">
                                            {formatNumber(item.EnergyExported)}
                                        </td>
                                        <td className="border border-gray-300 px-2 py-1 text-right">
                                            {formatNumber(item.EnergyImported)}
                                        </td>
                                        <td className="border border-gray-300 px-2 py-1 text-right">
                                            {formatNumber(item.UnitSaleKwh)}
                                        </td>
                                        <td className="border border-gray-300 px-2 py-1 text-right">
                                            {formatNumber(item.UnitSaleRs)}
                                        </td>
                                        <td className="border border-gray-300 px-2 py-1 text-right">
                                            {formatNumber(item.KwhPayableBalance)}
                                        </td>
                                    </tr>
                                ))}
                                <tr className="bg-gray-200 font-bold">
                                    <td className="border border-gray-300 px-2 py-1">Total</td>
                                    <td className="border border-gray-300 px-2 py-1 text-right">
                                        {bulkTotals.accounts.toLocaleString()}
                                    </td>
                                    <td className="border border-gray-300 px-2 py-1 text-right">
                                        {bulkTotals.exported.toLocaleString()}
                                    </td>
                                    <td className="border border-gray-300 px-2 py-1 text-right">
                                        {bulkTotals.imported.toLocaleString()}
                                    </td>
                                    <td className="border border-gray-300 px-2 py-1 text-right">
                                        {bulkTotals.unitSaleKwh.toLocaleString()}
                                    </td>
                                    <td className="border border-gray-300 px-2 py-1 text-right">
                                        {formatCurrency(bulkTotals.unitSaleRs)}
                                    </td>
                                    <td className="border border-gray-300 px-2 py-1 text-right">
                                        {formatCurrency(bulkTotals.payableBalance)}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </>
                )}
            </div>
        );
    };

    const renderDetailedTable = () => {
        const sortedData = sortDataAlphabetically(detailedData);

        // Calculate row spans for merged cells
        const divisionGroups: { [key: string]: DetailedRetailPayment[] } = {};
        const provinceGroups: { [key: string]: DetailedRetailPayment[] } = {};
        const areaGroups: { [key: string]: DetailedRetailPayment[] } = {};

        sortedData.forEach((item) => {
            if (!divisionGroups[item.Division]) divisionGroups[item.Division] = [];
            divisionGroups[item.Division].push(item);
        });

        sortedData.forEach((item) => {
            const provinceKey = `${item.Division}-${item.Province}`;
            if (!provinceGroups[provinceKey]) provinceGroups[provinceKey] = [];
            provinceGroups[provinceKey].push(item);
        });

        sortedData.forEach((item) => {
            const areaKey = `${item.Division}-${item.Province}-${item.Area}`;
            if (!areaGroups[areaKey]) areaGroups[areaKey] = [];
            areaGroups[areaKey].push(item);
        });

        // Calculate row span counts
        const divisionRowSpans: { [key: string]: number } = {};
        const provinceRowSpans: { [key: string]: number } = {};
        const areaRowSpans: { [key: string]: number } = {};

        Object.keys(divisionGroups).forEach(key => {
            let rowCount = divisionGroups[key].length;
            // Add area total rows
            const areas = Object.keys(areaGroups).filter(ak => {
                const [div] = ak.split('-');
                return div === key;
            });
            areas.forEach(ak => {
                if (areaGroups[ak].length > 1) rowCount++;
            });
            // Add province total rows
            const provinces = Object.keys(provinceGroups).filter(pk => pk.startsWith(`${key}-`));
            provinces.forEach(pk => {
                if (provinceGroups[pk].length > 1) rowCount++;
            });
            // Add division total row
            if (provinces.length > 1) rowCount++;
            divisionRowSpans[key] = rowCount;
        });

        Object.keys(provinceGroups).forEach(key => {
            let rowCount = provinceGroups[key].length;
            // Add area total rows
            const areas = Object.keys(areaGroups).filter(ak => ak.startsWith(`${key}-`));
            areas.forEach(ak => {
                if (areaGroups[ak].length > 1) rowCount++;
            });
            // Add province total row
            if (provinceGroups[key].length > 1) rowCount++;
            provinceRowSpans[key] = rowCount;
        });

        Object.keys(areaGroups).forEach(key => {
            let rowCount = areaGroups[key].length;
            // Add area total row
            if (areaGroups[key].length > 1) rowCount++;
            areaRowSpans[key] = rowCount;
        });

        let currentDivision = "";
        let currentProvince = "";
        let currentArea = "";

        // Get unique divisions in order
        const uniqueDivisions = Object.keys(divisionGroups).sort();

        const tableRows: JSX.Element[] = [];
        let rowIndex = 0;
        let dataRowIndex = 0;

        uniqueDivisions.forEach((division) => {
            const provincesInDivision = Object.keys(provinceGroups)
                .filter(pk => pk.startsWith(`${division}-`))
                .sort();

            provincesInDivision.forEach((provinceKey) => {
                const areasInProvince = Object.keys(areaGroups)
                    .filter(ak => ak.startsWith(`${provinceKey}-`))
                    .sort();

                areasInProvince.forEach((areaKey) => {
                    const items = areaGroups[areaKey];

                    items.forEach((row) => {
                        const divisionKey = row.Division;
                        const provinceKeyCheck = `${row.Division}-${row.Province}`;
                        const areaKeyCheck = `${row.Division}-${row.Province}-${row.Area}`;

                        const showDivision = currentDivision !== divisionKey;
                        const showProvince = currentProvince !== provinceKeyCheck;
                        const showArea = currentArea !== areaKeyCheck;

                        if (showDivision) {
                            currentDivision = divisionKey;
                            currentProvince = "";
                            currentArea = "";
                        }

                        if (showProvince) {
                            currentProvince = provinceKeyCheck;
                            currentArea = "";
                        }

                        if (showArea) {
                            currentArea = areaKeyCheck;
                        }

                        tableRows.push(
                            <tr
                                key={`data-${rowIndex}`}
                                className={dataRowIndex % 2 === 0 ? "bg-white" : "bg-gray-50"}
                            >
                                {showDivision ? (
                                    <td
                                        className="border border-gray-300 px-2 py-1 align-top font-medium"
                                        rowSpan={divisionRowSpans[divisionKey]}
                                    >
                                        {row.Division}
                                    </td>
                                ) : null}

                                {showProvince ? (
                                    <td
                                        className="border border-gray-300 px-2 py-1 align-top"
                                        rowSpan={provinceRowSpans[provinceKeyCheck]}
                                    >
                                        {row.Province}
                                    </td>
                                ) : null}

                                {showArea ? (
                                    <td
                                        className="border border-gray-300 px-2 py-1 align-top"
                                        rowSpan={areaRowSpans[areaKeyCheck]}
                                    >
                                        {row.Area}
                                    </td>
                                ) : null}
                                <td className="border border-gray-300 px-2 py-1">
                                    {row.CustomerName}
                                </td>
                                <td className="border border-gray-300 px-2 py-1">
                                    {row.AccountNumber}
                                </td>
                                <td className="border border-gray-300 px-2 py-1 text-right">
                                    {formatCurrency(row.PanelCapacity)}
                                </td>
                                <td className="border border-gray-300 px-2 py-1 text-right">
                                    {row.EnergyExported.toLocaleString('en-US')}
                                </td>
                                <td className="border border-gray-300 px-2 py-1 text-right">
                                    {row.EnergyImported.toLocaleString('en-US')}
                                </td>
                                <td className="border border-gray-300 px-2 py-1">
                                    {row.Tariff}
                                </td>
                                <td className="border border-gray-300 px-2 py-1 text-right">
                                    {row.BFUnits.toLocaleString('en-US')}
                                </td>
                                <td className="border border-gray-300 px-2 py-1 text-right">
                                    {row.UnitsInBill.toLocaleString('en-US')}
                                </td>
                                <td className="border border-gray-300 px-2 py-1 text-right">
                                    {row.Period.toLocaleString('en-US')}
                                </td>
                                <td className="border border-gray-300 px-2 py-1 text-right">
                                    {formatCurrency(row.KwhCharge)}
                                </td>
                                <td className="border border-gray-300 px-2 py-1 text-right">
                                    {formatCurrency(row.FixedCharge)}
                                </td>
                                <td className="border border-gray-300 px-2 py-1 text-right">
                                    {formatCurrency(row.FuelCharge)}
                                </td>
                                <td className="border border-gray-300 px-2 py-1 text-right">
                                    {row.CFUnits.toLocaleString('en-US')}
                                </td>
                                <td className="border border-gray-300 px-2 py-1 text-right">
                                    {formatCurrency(row.Rate)}
                                </td>
                                <td className="border border-gray-300 px-2 py-1 text-right">
                                    {row.UnitSale.toLocaleString('en-US')}
                                </td>
                                <td className="border border-gray-300 px-2 py-1 text-right">
                                    {formatCurrency(row.KwhSales)}
                                </td>
                                <td className="border border-gray-300 px-2 py-1">
                                    {row.BankCode}
                                </td>
                                <td className="border border-gray-300 px-2 py-1">
                                    {row.BranchCode}
                                </td>
                                <td className="border border-gray-300 px-2 py-1">
                                    {row.BankAccountNumber}
                                </td>
                                <td className="border border-gray-300 px-2 py-1 whitespace-nowrap">
                                    {row.AgreementDate}
                                </td>
                            </tr>
                        );
                        rowIndex++;
                        dataRowIndex++;
                    });

                    // Add Area Total if more than 1 record in area
                    if (items.length > 1) {
                        const totals = {
                            count: items.length,
                            panelCapacity: items.reduce((sum, item) => sum + item.PanelCapacity, 0),
                            energyExported: items.reduce((sum, item) => sum + item.EnergyExported, 0),
                            energyImported: items.reduce((sum, item) => sum + item.EnergyImported, 0),
                        };

                        tableRows.push(
                            <tr key={`area-total-${rowIndex}`} className="bg-green-50 font-medium">
                                <td className="border border-gray-300 px-2 py-1 text-center" colSpan={1}>
                                    Area Total
                                </td>
                                <td className="border border-gray-300 px-2 py-1 text-right">
                                    {totals.count}
                                </td>
                                <td className="border border-gray-300 px-2 py-1 text-right">
                                    {formatCurrency(totals.panelCapacity)}
                                </td>
                                <td className="border border-gray-300 px-2 py-1 text-right">
                                    {totals.energyExported.toLocaleString('en-US')}
                                </td>
                                <td className="border border-gray-300 px-2 py-1 text-right">
                                    {totals.energyImported.toLocaleString('en-US')}
                                </td>
                                <td className="border border-gray-300 px-2 py-1" colSpan={16}></td>
                            </tr>
                        );
                        rowIndex++;
                    }
                });

                // Add Province Total if more than 1 area
                if (areasInProvince.length > 1) {
                    const provinceItems = provinceGroups[provinceKey];
                    const totals = {
                        count: provinceItems.length,
                        panelCapacity: provinceItems.reduce((sum, item) => sum + item.PanelCapacity, 0),
                        energyExported: provinceItems.reduce((sum, item) => sum + item.EnergyExported, 0),
                        energyImported: provinceItems.reduce((sum, item) => sum + item.EnergyImported, 0),
                    };

                    tableRows.push(
                        <tr key={`province-total-${rowIndex}`} className="bg-blue-50 font-semibold">
                            <td className="border border-gray-300 px-2 py-1" colSpan={2}>
                                Province Total
                            </td>

                            <td className="border border-gray-300 px-2 py-1 text-right">
                                {totals.count}
                            </td>
                            <td className="border border-gray-300 px-2 py-1 text-right">
                                {formatCurrency(totals.panelCapacity)}
                            </td>
                            <td className="border border-gray-300 px-2 py-1 text-right">
                                {totals.energyExported}
                            </td>
                            <td className="border border-gray-300 px-2 py-1 text-right">
                                {totals.energyImported}
                            </td>
                            <td className="border border-gray-300 px-2 py-1" colSpan={16}></td>
                        </tr>
                    );
                    rowIndex++;
                }
            });

            // Add Division Total if more than 1 province
            if (provincesInDivision.length > 1) {
                const divisionItems = divisionGroups[division];
                const totals = {
                    count: divisionItems.length,
                    panelCapacity: divisionItems.reduce((sum, item) => sum + item.PanelCapacity, 0),
                    energyExported: divisionItems.reduce((sum, item) => sum + item.EnergyExported, 0),
                    energyImported: divisionItems.reduce((sum, item) => sum + item.EnergyImported, 0),
                };

                tableRows.push(
                    <tr key={`division-total-${rowIndex}`} className="bg-yellow-50 font-bold">
                        <td className="border border-gray-300 px-2 py-1" colSpan={3}>
                            Division Total
                        </td>

                        <td className="border border-gray-300 px-2 py-1 text-right">
                            {totals.count}
                        </td>
                        <td className="border border-gray-300 px-2 py-1 text-right">
                            {formatCurrency(totals.panelCapacity)}
                        </td>
                        <td className="border border-gray-300 px-2 py-1 text-right">
                            {totals.energyExported}
                        </td>
                        <td className="border border-gray-300 px-2 py-1 text-right">
                            {totals.energyImported}
                        </td>
                        <td className="border border-gray-300 px-2 py-1" colSpan={16}></td>
                    </tr>
                );
                rowIndex++;
            }
        });

        return (
            <table className="w-full border-collapse text-xs">
                <thead className="bg-gray-100 sticky top-0">
                    <tr>
                        <th className="border border-gray-300 px-2 py-1 text-center">
                            Division
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-center">
                            Province
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-center">
                            Area
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-center">
                            Name of Customer
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-center">
                            A/C No.
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-center">
                            Panel Capacity (kW)
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-center">
                            Energy Exported (kWh)
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-center">
                            Energy Imported (kWh)
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-center">
                            Tariff
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-center">
                            BF Units
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-center">
                            Units in Bill
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-center">
                            Period
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-center">
                            KWH Charge
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-center">
                            Fixed Charge
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-center">
                            Fuel Charge
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-center">
                            CF Units
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-center">
                            Rate
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-center">
                            Units Sale
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-center">
                            KWH Sales
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-center">
                            Bank Code
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-center">
                            Branch Code
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-center">
                            Bank Account Number
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-center">
                            Agreement Date
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {tableRows}
                </tbody>
            </table>
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setReportError(null);
        setDetailedData([]);
        setOrdinarySummaryData([]);
        setBulkSummaryData([]);
        setReportVisible(false);

        try {
            let validationError = "";

            if (!cycleValue) validationError = `${selectedCycleType} is required`;
            if (!reportType) validationError = "Report type is required";

            // For detailed report, validate additional fields
            if (reportType === "Detailed Report") {
                if (!netType) validationError = "Net type is required";
                if (selectedCategory !== "Entire CEB" && !categoryValue) {
                    validationError = `${selectedCategory} is required`;
                }
            }

            if (validationError) {
                throw new Error(validationError);
            }

            if (reportType === "Summary Report") {
                // Fetch both ordinary and bulk summary data
                const cycleTypeParam = selectedCycleType === "Bill Cycle" ? "A" : "C";
                const cycleParam =
                    selectedCycleType === "Bill Cycle" ? "billCycle" : "calcCycle";

                console.log("=== Fetching Summary Reports ===");
                console.log("Cycle Type:", selectedCycleType);
                console.log("Cycle Value:", cycleValue);

                // Fetch ordinary summary
                const ordinaryEndpoint = `/misapi/solarapi/retail/summary?${cycleParam}=${cycleValue}&cycleType=${cycleTypeParam}`;
                console.log("Ordinary Endpoint:", ordinaryEndpoint);

                const ordinaryResponse = await fetch(ordinaryEndpoint, {
                    method: "GET",
                    headers: {
                        Accept: "application/json",
                    },
                });

                if (!ordinaryResponse.ok) {
                    throw new Error(
                        `Failed to fetch ordinary summary: ${ordinaryResponse.status}`
                    );
                }

                const ordinaryResult = await ordinaryResponse.json();
                const ordinaryData = ordinaryResult.data || [];
                console.log("Ordinary data:", ordinaryData);

                // Fetch bulk summary (for both Bill Cycle and Calculation Cycle - using billCycle parameter)
                let bulkData = [];
                const bulkEndpoint = `/misapi/solarapi/retail/summary-bulk?billCycle=${cycleValue}`;
                console.log("Bulk Endpoint:", bulkEndpoint);

                try {
                    const bulkResponse = await fetch(bulkEndpoint, {
                        method: "GET",
                        headers: {
                            Accept: "application/json",
                        },
                    });

                    if (bulkResponse.ok) {
                        const bulkResult = await bulkResponse.json();
                        bulkData = bulkResult.data || [];
                        console.log("Bulk data:", bulkData);
                    } else {
                        console.warn("Bulk data not available");
                    }
                } catch (bulkError) {
                    console.warn("Error fetching bulk data:", bulkError);
                }

                setOrdinarySummaryData(ordinaryData);
                setBulkSummaryData(bulkData);
                setReportVisible(true);
            } else if (reportType === "Detailed Report") {
                const typeCode = selectedCategory === "Entire CEB" ? "" : categoryValue;
                let reportTypeParam = "";

                if (selectedCategory === "Entire CEB") {
                    reportTypeParam = "entireceb";
                } else if (selectedCategory === "Area") {
                    reportTypeParam = "area";
                } else if (selectedCategory === "Province") {
                    reportTypeParam = "province";
                } else if (selectedCategory === "Division") {
                    reportTypeParam = "region";
                }

                const cycleTypeParam = selectedCycleType === "Bill Cycle" ? "A" : "C";
                const cycleParam =
                    selectedCycleType === "Bill Cycle" ? "billCycle" : "calcCycle";

                const netTypeMap: Record<string, string> = {
                    "Net Metering": "1",
                    "Net Accounting": "2",
                    "Net Plus": "3",
                    "Net Plus Plus": "4",
                    "Convert Net Metering to Net Accounting": "5",
                };

                const netTypeCode = netTypeMap[netType] || netType;

                let endpoint = `/misapi/solarapi/retail/detailed?${cycleParam}=${cycleValue}&netType=${netTypeCode}&reportType=${reportTypeParam}`;

                if (selectedCategory !== "Entire CEB") {
                    endpoint += `&typeCode=${typeCode}`;
                }

                endpoint += `&cycleType=${cycleTypeParam}`;

                console.log("=== API Request Details ===");
                console.log("Full Endpoint:", endpoint);

                const response = await fetch(endpoint, {
                    method: "GET",
                    headers: {
                        Accept: "application/json",
                    },
                });

                if (!response.ok) {
                    let errorMsg = `HTTP error ${response.status}`;
                    try {
                        const errorText = await response.text();
                        try {
                            const errorData = JSON.parse(errorText);
                            if (errorData.errorMessage) {
                                errorMsg = errorData.errorMessage;
                            } else if (errorData.message) {
                                errorMsg = errorData.message;
                            }
                        } catch (e) {
                            errorMsg = `${errorMsg}: ${errorText}`;
                        }
                    } catch (e) {
                        errorMsg = `${errorMsg}: ${response.statusText}`;
                    }
                    throw new Error(errorMsg);
                }

                const result = await response.json();
                const responseData = result.data || result;
                const detailedDataArray = Array.isArray(responseData)
                    ? responseData
                    : [responseData];
                const sortedData = sortDataAlphabetically(detailedDataArray);
                setDetailedData(sortedData);
                setReportVisible(true);
            }
        } catch (err: any) {
            console.error("Error in form submission:", err);
            if (err.message.includes("Failed to fetch")) {
                setReportError("Network error - please check your connection");
            } else {
                setReportError(err.message || "Failed to load payment data");
            }
        } finally {
            setLoading(false);
        }
    };

    const formatAreaOption = (area: Area) => {
        return `${area.AreaCode} - ${area.AreaName}`;
    };

    const formatProvinceOption = (province: Province) => {
        return `${province.ProvinceCode} - ${province.ProvinceName}`;
    };

    const formatDivisionOption = (division: Division) => {
        return `${division.RegionCode}`;
    };

    const isCycleDisabled = () => {
        return !selectedCycleType;
    };

    const isReportTypeDisabled = () => {
        return !cycleValue || isCycleDisabled();
    };

    const isCategoryDisabled = () => {
        // Category is disabled for Summary Report
        return (
            reportType === "Summary Report" || !reportType || isReportTypeDisabled()
        );
    };

    const isCategoryValueDisabled = () => {
        if (selectedCategory === "Entire CEB") return true;
        // Category value is disabled for Summary Report
        if (reportType === "Summary Report") return true;
        return (
            !selectedCategory ||
            isCategoryDisabled() ||
            (selectedCategory === "Area" && (isLoadingAreas || areaError !== null)) ||
            (selectedCategory === "Province" &&
                (isLoadingProvinces || provinceError !== null)) ||
            (selectedCategory === "Division" &&
                (isLoadingDivisions || divisionError !== null))
        );
    };

    const isNetTypeDisabled = () => {
        // Net type is disabled for Summary Report
        if (reportType === "Summary Report") return true;

        if (selectedCategory === "Entire CEB") {
            return !selectedCategory || isCategoryDisabled();
        }
        return !categoryValue || isCategoryValueDisabled();
    };

    const canSubmit = () => {
        if (!cycleValue || !reportType) return false;

        // For Summary Report, only cycle and report type are required
        if (reportType === "Summary Report") {
            return true;
        }

        // For Detailed Report, all fields are required
        if (reportType === "Detailed Report") {
            if (!netType) return false;
            if (selectedCategory !== "Entire CEB" && !categoryValue) return false;
            return true;
        }

        return false;
    };

    return (
        <div className="max-w-7xl mx-auto p-4 bg-white rounded-xl shadow border border-gray-200 text-sm font-sans">
            {!reportVisible && (
                <>
                    <h2 className={`text-xl font-bold mb-6 ${maroon}`}>
                        Solar Payment Information For Current Month - Retail
                    </h2>

                    <form onSubmit={handleSubmit}>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                            {/* Cycle Type Dropdown */}
                            <div className="flex flex-col">
                                <label className={`text-xs font-medium mb-1 ${maroon}`}>
                                    Select Cycle Type:
                                </label>
                                <select
                                    value={selectedCycleType}
                                    onChange={handleCycleTypeChange}
                                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent"
                                    required
                                >
                                    <option value="">Select Cycle Type</option>
                                    <option value="Bill Cycle">
                                        Bill Cycle (for the selected month)
                                    </option>
                                    <option value="Calculation Cycle">
                                        Calculation Cycle (for the selected month)
                                    </option>
                                </select>
                            </div>

                            {/* Month Dropdown */}
                            <div className="flex flex-col">
                                <label
                                    className={`text-xs font-medium mb-1 ${isCycleDisabled() ? "text-gray-400" : maroon
                                        }`}
                                >
                                    Select Month:
                                </label>
                                {isLoadingCycles ? (
                                    <div className="flex items-center justify-center py-2">
                                        <svg
                                            className="animate-spin h-5 w-5 text-[#7A0000]"
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
                                        <span className="ml-2 text-xs">Loading cycles...</span>
                                    </div>
                                ) : cycleError ? (
                                    <div className="text-red-500 text-xs py-2">{cycleError}</div>
                                ) : (
                                    <select
                                        value={cycleValue}
                                        onChange={(e) => {
                                            const selectedCode = e.target.value;
                                            setCycleValue(selectedCode);
                                            const selectedOption = cycleOptions.find(
                                                (option) => option.code === selectedCode
                                            );
                                            setSelectedCycleDisplay(
                                                selectedOption ? selectedOption.display : ""
                                            );
                                        }}
                                        className={`w-full px-2 py-1.5 text-xs border rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent
                      ${isCycleDisabled()
                                                ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                                                : "border-gray-300"
                                            }`}
                                        required
                                        disabled={isCycleDisabled()}
                                    >
                                        <option value="">Select Month</option>
                                        {cycleOptions.map((option) => (
                                            <option key={option.code} value={option.code}>
                                                {option.display}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            {/* Report Type Dropdown */}
                            <div className="flex flex-col">
                                <label
                                    className={`text-xs font-medium mb-1 ${isReportTypeDisabled() ? "text-gray-400" : maroon
                                        }`}
                                >
                                    Report Type:
                                </label>
                                <select
                                    value={reportType}
                                    onChange={(e) => setReportType(e.target.value)}
                                    className={`w-full px-2 py-1.5 text-xs border rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent
                    ${isReportTypeDisabled()
                                            ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                                            : "border-gray-300"
                                        }`}
                                    required
                                    disabled={isReportTypeDisabled()}
                                >
                                    <option value="">Select Report Type</option>
                                    <option value="Detailed Report">Detailed Report</option>
                                    <option value="Summary Report">Summary Report</option>
                                </select>
                            </div>

                            {/* Report Category Dropdown */}
                            <div className="flex flex-col">
                                <label
                                    className={`text-xs font-medium mb-1 ${isCategoryDisabled() ? "text-gray-400" : maroon
                                        }`}
                                >
                                    Select Report Category:
                                </label>
                                <select
                                    value={selectedCategory}
                                    onChange={handleCategoryChange}
                                    className={`w-full px-2 py-1.5 text-xs border rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent
                    ${isCategoryDisabled()
                                            ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                                            : "border-gray-300"
                                        }`}
                                    required={reportType === "Detailed Report"}
                                    disabled={isCategoryDisabled()}
                                >
                                    {allowedCategories.map((cat) => (
                                        <option key={cat} value={cat === "Region" ? "Division" : cat}>
                                            {cat === "Region" ? "Division" : cat}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Category Value Dropdown */}
                            {selectedCategory === "Area" && (
                                <div className="flex flex-col">
                                    <label
                                        className={`text-xs font-medium mb-1 ${isCategoryValueDisabled() ? "text-gray-400" : maroon
                                            }`}
                                    >
                                        Select Area:
                                    </label>
                                    {isLoadingAreas ? (
                                        <div className="flex items-center justify-center py-2">
                                            <svg
                                                className="animate-spin h-5 w-5 text-[#7A0000]"
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
                                            <span className="ml-2 text-xs">Loading areas...</span>
                                        </div>
                                    ) : areaError ? (
                                        <div className="text-red-500 text-xs py-2">{areaError}</div>
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
                                            value={categoryValue}
                                            onChange={(e) => {
                                                const selectedAreaCode = e.target.value;
                                                setCategoryValue(selectedAreaCode);
                                                const selectedArea = areas.find(
                                                    (area) => area.AreaCode === selectedAreaCode
                                                );
                                                setSelectedCategoryName(
                                                    selectedArea ? selectedArea.AreaName : ""
                                                );
                                            }}
                                            className={`w-full px-2 py-1.5 text-xs border rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent
                        ${isCategoryValueDisabled()
                                                    ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                                                    : "border-gray-300"
                                                }`}
                                            required={reportType === "Detailed Report"}
                                            disabled={isCategoryValueDisabled()}
                                        >
                                            <option value="">Select Area</option>
                                            {areas.map((area) => (
                                                <option key={area.AreaCode} value={area.AreaCode}>
                                                    {formatAreaOption(area)}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            )}

                            {selectedCategory === "Province" && (
                                <div className="flex flex-col">
                                    <label
                                        className={`text-xs font-medium mb-1 ${isCategoryValueDisabled() ? "text-gray-400" : maroon
                                            }`}
                                    >
                                        Select Province:
                                    </label>
                                    {isLoadingProvinces ? (
                                        <div className="flex items-center justify-center py-2">
                                            <svg
                                                className="animate-spin h-5 w-5 text-[#7A0000]"
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
                                            <span className="ml-2 text-xs">Loading provinces...</span>
                                        </div>
                                    ) : provinceError ? (
                                        <div className="text-red-500 text-xs py-2">
                                            {provinceError}
                                        </div>
                                    ) : locked["Province"] ? (
                                        <select
                                            disabled
                                            value={locked["Province"].code}
                                            className="w-full px-2 py-1.5 text-xs border rounded-md bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                                        >
                                            <option value={locked["Province"].code}>
                                                {locked["Province"].name ? `${locked["Province"].code} - ${locked["Province"].name}` : locked["Province"].code}
                                            </option>
                                        </select>
                                    ) : (
                                        <select
                                            value={categoryValue}
                                            onChange={(e) => {
                                                const selectedProvinceCode = e.target.value;
                                                setCategoryValue(selectedProvinceCode);
                                                const selectedProvince = provinces.find(
                                                    (province) => province.ProvinceCode === selectedProvinceCode
                                                );
                                                setSelectedCategoryName(
                                                    selectedProvince ? selectedProvince.ProvinceName : ""
                                                );
                                            }}
                                            className={`w-full px-2 py-1.5 text-xs border rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent
                        ${isCategoryValueDisabled()
                                                    ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                                                    : "border-gray-300"
                                                }`}
                                            required={reportType === "Detailed Report"}
                                            disabled={isCategoryValueDisabled()}
                                        >
                                            <option value="">Select Province</option>
                                            {provinces.map((province) => (
                                                <option
                                                    key={province.ProvinceCode}
                                                    value={province.ProvinceCode}
                                                >
                                                    {formatProvinceOption(province)}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            )}

                            {selectedCategory === "Division" && (
                                <div className="flex flex-col">
                                    <label
                                        className={`text-xs font-medium mb-1 ${isCategoryValueDisabled() ? "text-gray-400" : maroon
                                            }`}
                                    >
                                        Select Division:
                                    </label>
                                    {isLoadingDivisions ? (
                                        <div className="flex items-center justify-center py-2">
                                            <svg
                                                className="animate-spin h-5 w-5 text-[#7A0000]"
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
                                            <span className="ml-2 text-xs">Loading divisions...</span>
                                        </div>
                                    ) : divisionError ? (
                                        <div className="text-red-500 text-xs py-2">
                                            {divisionError}
                                        </div>
                                    ) : locked["Region"] ? (
                                        <select
                                            disabled
                                            value={locked["Region"].code}
                                            className="w-full px-2 py-1.5 text-xs border rounded-md bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                                        >
                                            <option value={locked["Region"].code}>{locked["Region"].code}</option>
                                        </select>
                                    ) : (
                                        <select
                                            value={categoryValue}
                                            onChange={(e) => {
                                                const selectedDivisionCode = e.target.value;
                                                setCategoryValue(selectedDivisionCode);
                                                setSelectedCategoryName(selectedDivisionCode); // Division uses code as name
                                            }}
                                            className={`w-full px-2 py-1.5 text-xs border rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent
                        ${isCategoryValueDisabled()
                                                    ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                                                    : "border-gray-300"
                                                }`}
                                            required={reportType === "Detailed Report"}
                                            disabled={isCategoryValueDisabled()}
                                        >
                                            <option value="">Select Division</option>
                                            {divisions.map((division) => (
                                                <option
                                                    key={division.RegionCode}
                                                    value={division.RegionCode}
                                                >
                                                    {formatDivisionOption(division)}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            )}

                            {/* Net Type Dropdown */}
                            <div className="flex flex-col">
                                <label
                                    className={`text-xs font-medium mb-1 ${isNetTypeDisabled() ? "text-gray-400" : maroon
                                        }`}
                                >
                                    Select Net Type:
                                </label>
                                <select
                                    value={netType}
                                    onChange={(e) => setNetType(e.target.value)}
                                    className={`w-full px-2 py-1.5 text-xs border rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent
                    ${isNetTypeDisabled()
                                            ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                                            : "border-gray-300"
                                        }`}
                                    required={reportType === "Detailed Report"}
                                    disabled={isNetTypeDisabled()}
                                >
                                    <option value="">Select Net Type</option>
                                    <option value="Net Metering">Net Metering</option>
                                    <option value="Net Accounting">Net Accounting</option>
                                    <option value="Net Plus">Net Plus</option>
                                    <option value="Net Plus Plus">Net Plus Plus</option>
                                    <option value="Convert Net Metering to Net Accounting">
                                        Convert Net Metering to Net Accounting
                                    </option>
                                </select>
                            </div>
                        </div>

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

            {/* Report Section */}
            {reportVisible && (
                <div className="mt-6">
                    {/* Report Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
                        <div>
                            <h2 className={`text-xl font-bold ${maroon}`}>
                                {reportType === "Summary Report"
                                    ? "Solar Payment Information - Retail Summary"
                                    : "Solar Payment Information - Retail"}
                            </h2>
                            <p className="text-sm text-gray-600 mt-1">
                                {reportType === "Summary Report" ? (
                                    <>
                                        {selectedCycleType}: {selectedCycleDisplay}
                                    </>
                                ) : (
                                    <>
                                        {selectedCategory === "Entire CEB"
                                            ? "Entire CEB"
                                            : `${selectedCategory}: ${selectedCategoryName} `}
                                        | {selectedCycleType}: {selectedCycleDisplay} | Type:{" "}
                                        {reportType} | Net Type: {netType}
                                    </>
                                )}
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
                    <div
                        className={`${reportType === "Summary Report"
                            ? ""
                            : "overflow-x-auto max-h-[calc(100vh-250px)]"
                            } border border-gray-300 rounded-lg`}
                    >
                        <div ref={printRef} className="min-w-full py-4">
                            {reportType === "Summary Report"
                                ? renderSummaryTables()
                                : renderDetailedTable()}
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

            {/* Error Message (when not in report view) */}
            {!reportVisible && reportError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                    {reportError}
                </div>
            )}
        </div>
    );
};

export default SolarPaymentRetail;