import React, { useState, useEffect, useRef } from "react";
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

interface DetailedConnectionData {
    AccountNumber: string;
    Name: string;
    Tariff: string;
    MeterNumber: string;
    PresentReadingDate: string;
    PreviousReadingDate: string;
    PresentReadingImport: number;
    PreviousReadingImport: number;
    UnitsIn: number;
    PresentReadingExport: number;
    PreviousReadingExport: number;
    UnitsOut: number;
    NetUnits: number;
    UnitCost: number;
    PayableAmount: number;
    BankCode: string;
    BranchCode: string;
    BankAccountNumber: string;
    AgreementDate: string;
    AreaCode: string;
    Area: string;
    Province: string;
    Division: string;
    BillCycle: string;
    ErrorMessage?: string;
}

interface SummaryConnectionData {
    Category: string;
    Tariff: string;
    NoOfCustomers: number;
    ExportUnits: number;
    ImportUnits: number;
    UnitsBill: number;
    Payments: number;
    ErrorMessage?: string;
}

const SolarConnectionDetailsRetail: React.FC = () => {
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
    const [detailedData, setDetailedData] = useState<DetailedConnectionData[]>([]);
    const [summaryData, setSummaryData] = useState<SummaryConnectionData[]>([]);

    const { user } = useUser();
    const { allowedCategories, locked } = useReportScope();

    const printRef = useRef<HTMLDivElement>(null);

    // CSV Export Functions
    const downloadAsCSV = () => {
        if (reportType === "Summary Report") {
            downloadSummaryCSV();
        } else if (detailedData.length) {
            downloadDetailedCSV();
        }
    };

    const downloadDetailedCSV = () => {
        if (!detailedData.length) return;

        const reportTitle = "Solar Connection Details (incl. reading and usage) - Retail";
        const selectionInfo =
            selectedCategory === "Entire CEB"
                ? "Entire CEB"
                : `${selectedCategory}: ${selectedCategoryName}`;

        const headers = [
            "Division",
            "Province",
            "Area",
            "Account Number",
            "Name",
            "Tariff",
            "Meter Number",
            "Present Reading Date",
            "Previous Reading Date",
            "Present Reading Import",
            "Previous Reading Import",
            "Units In",
            "Present Reading Export",
            "Previous Reading Export",
            "Units Out",
            "Net Units",
            "Unit Cost",
            "Payable Amount",
            "Bank Code",
            "Branch Code",
            "Bank Account Number",
            "Agreement Date",
        ];

        let currentDivision = "";
        let currentProvince = "";
        let currentArea = "";

        const rows = detailedData.map((item) => {
            const row: any[] = [];

            if (currentDivision !== item.Division) {
                currentDivision = item.Division;
                row.push(item.Division);
            } else {
                row.push("");
            }

            const provinceKey = `${item.Division}-${item.Province}`;
            if (currentProvince !== provinceKey) {
                currentProvince = provinceKey;
                row.push(item.Province);
            } else {
                row.push("");
            }

            const areaKey = `${item.Division}-${item.Province}-${item.Area}`;
            if (currentArea !== areaKey) {
                currentArea = areaKey;
                row.push(item.Area);
            } else {
                row.push("");
            }

            row.push(
                item.AccountNumber,
                item.Name,
                item.Tariff,
                item.MeterNumber,
                item.PresentReadingDate,
                item.PreviousReadingDate,
                item.PresentReadingImport,
                item.PreviousReadingImport,
                item.UnitsIn,
                item.PresentReadingExport,
                item.PreviousReadingExport,
                item.UnitsOut,
                item.NetUnits,
                item.UnitCost,
                item.PayableAmount,
                item.BankCode,
                item.BranchCode,
                item.BankAccountNumber,
                item.AgreementDate
            );

            return row;
        });

        const csvContent = [
            reportTitle,
            selectionInfo,
            `${selectedCycleType}: ${selectedCycleDisplay}`,
            `Report Type: ${reportType}`,
            `Net Type: ${netType}`,
            `Generated: ${new Date().toLocaleDateString()}`,
            "",
            headers.map((h) => `"${h}"`).join(","),
            ...rows.map((row) => row.map((cell: any) => `"${cell}"`).join(",")),
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
                `SolarCapacityDetails_${fileDescriptor}_${selectedCycleType.replace(
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
        const reportTitle = "Solar Connection Details (incl. reading and usage) - Retail Summary";
        const headers = [
            "Category",
            "Tariff",
            "No of Customers",
            "Export Units",
            "Import Units",
            "Units Bill",
            "Payments",
        ];

        const formatNumber = (num: number) => num.toLocaleString();

        const rows = summaryData.map((item) => [
            item.Category,
            item.Tariff,
            formatNumber(item.NoOfCustomers),
            formatNumber(item.ExportUnits),
            formatNumber(item.ImportUnits),
            formatNumber(item.UnitsBill),
            formatNumber(item.Payments),
        ]);

        // Calculate totals
        const totals = summaryData.reduce(
            (acc, item) => {
                acc.customers += item.NoOfCustomers;
                acc.export += item.ExportUnits;
                acc.import += item.ImportUnits;
                acc.unitsBill += item.UnitsBill;
                acc.payments += item.Payments;
                return acc;
            },
            { customers: 0, export: 0, import: 0, unitsBill: 0, payments: 0 }
        );

        const totalRow = [
            "Total",
            "",
            totals.customers.toLocaleString(),
            totals.export.toLocaleString(),
            totals.import.toLocaleString(),
            totals.unitsBill.toLocaleString(),
            totals.payments.toLocaleString(),
        ];

        const csvContent = [
            reportTitle,
            `${selectedCycleType}: ${selectedCycleDisplay}`,
            `Generated: ${new Date().toLocaleDateString()}`,
            "",
            headers.map((h) => `"${h}"`).join(","),
            ...rows.map((row) => row.map((cell: any) => `"${cell}"`).join(",")),
            totalRow.map((cell: any) => `"${cell}"`).join(","),
        ].join("\n");

        try {
            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");

            link.setAttribute("href", url);
            link.setAttribute(
                "download",
                `SolarCapacityDetails_Summary_${selectedCycleType.replace(
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

    // PDF Print Function
    const printPDF = () => {
        if (!printRef.current) return;

        const printWindow = window.open("", "_blank");
        if (!printWindow) return;

        let reportTitle = "";
        let selectionInfo = "";

        if (reportType === "Summary Report") {
            reportTitle =
                "SOLAR CONNECTION DETAILS (INCL. READING AND USAGE) - RETAIL SUMMARY";
            selectionInfo = `${selectedCycleType}: <span class="bold">${selectedCycleDisplay}</span>`;
        } else {
            reportTitle = "SOLAR CONNECTION DETAILS (INCL. READING AND USAGE) - RETAIL";
            const categoryInfo = (() => {
                if (selectedCategory === "Entire CEB") {
                    return "Entire CEB";
                } else {
                    return `${selectedCategory}: <span class="bold">${selectedCategoryName}</span>`;
                }
            })();
            selectionInfo = `${categoryInfo}<br>${selectedCycleType}: <span class="bold">${selectedCycleDisplay}</span><br>Report Type: <span class="bold">${reportType}</span><br>Net Type: <span class="bold">${netType}</span>`;
        }

        printWindow.document.write(`
      <html>
        <head>
          <title>Solar Capacity Details Retail Report</title>
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
        data: DetailedConnectionData[]
    ): DetailedConnectionData[] => {
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
                const data = await fetchWithErrorHandling(url);
                if (data.errorMessage) {
                    setAreaError(data.errorMessage);
                } else {
                    setAreas(data.data || []);
                }
            } catch (error) {
                setAreaError(
                    error instanceof Error ? error.message : "Failed to load areas"
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
                const data = await fetchWithErrorHandling(url);
                if (data.errorMessage) {
                    setProvinceError(data.errorMessage);
                } else {
                    setProvinces(data.data || []);
                }
            } catch (error) {
                setProvinceError(
                    error instanceof Error ? error.message : "Failed to load provinces"
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
                const data = await fetchWithErrorHandling(
                    "/misapi/api/ordinary/region"
                );
                if (data.errorMessage) {
                    setDivisionError(data.errorMessage);
                } else {
                    setDivisions(data.data || []);
                }
            } catch (error) {
                setDivisionError(
                    error instanceof Error
                        ? error.message
                        : "Failed to load divisions"
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
            setSelectedCategoryName?.(lock.name ? `${lock.code} - ${lock.name}` : lock.code);
        }
    }, [selectedCategory, locked]);

    // Fetch cycles when cycle type changes
    useEffect(() => {
        const fetchCycles = async () => {
            if (!selectedCycleType) {
                setCycleOptions([]);
                return;
            }

            setIsLoadingCycles(true);
            setCycleError(null);
            try {
                const data = await fetchWithErrorHandling(
                    "/misapi/api/ordinary/netmtcons/billcycle/max"
                );

                if (data.errorMessage) {
                    setCycleError(data.errorMessage);
                    return;
                }

                const cyclesArray = data.data?.BillCycles || [];
                const maxCycleValue = data.data?.MaxBillCycle || "0";

                const options = generateCycleOptions(
                    cyclesArray,
                    maxCycleValue,
                    selectedCycleType
                );
                setCycleOptions(options);
            } catch (error) {
                setCycleError(
                    error instanceof Error
                        ? error.message
                        : "Failed to load bill cycles"
                );
            } finally {
                setIsLoadingCycles(false);
            }
        };

        fetchCycles();
    }, [selectedCycleType]);

    // Map Net Type to API value
    const mapNetTypeToValue = (netType: string): string => {
        const mapping: { [key: string]: string } = {
            "Net Metering": "1",
            "Net Accounting": "2",
            "Net Plus": "3",
            "Net Plus Plus": "4",
            "Convert Net Metering to Net Accounting": "5",
        };
        return mapping[netType] || "1";
    };

    // Handle form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setReportError(null);

        try {
            const cycleType = selectedCycleType === "Bill Cycle" ? "A" : "B";
            const netTypeValue = mapNetTypeToValue(netType);
            const reportTypeParam =
                selectedCategory === "Entire CEB"
                    ? "entireceb"
                    : selectedCategory === "Division"
                        ? "region"
                        : selectedCategory.toLowerCase();
            const typeCode =
                selectedCategory === "Entire CEB" ? "" : categoryValue;

            const baseUrl = `/misapi/solarapi/solarConnectionDetails/retail/${reportType === "Detailed Report" ? "detailed" : "summary"
                }`;

            const params = new URLSearchParams({
                cycleType: cycleType,
                ...(cycleType === "A"
                    ? { billCycle: cycleValue }
                    : { calcCycle: cycleValue }),
                netType: netTypeValue,
                reportType: reportTypeParam,
                ...(typeCode && { typeCode }),
            });

            const url = `${baseUrl}?${params.toString()}`;
            console.log("Fetching from URL:", url);

            const data = await fetchWithErrorHandling(url);

            if (data.errorMessage) {
                setReportError(data.errorMessage);
                return;
            }

            if (reportType === "Detailed Report") {
                const sortedData = sortDataAlphabetically(data.data || []);
                setDetailedData(sortedData);
            } else {
                setSummaryData(data.data || []);
            }

            // Set display names for report header
            if (selectedCategory === "Area") {
                const area = areas.find((a) => a.AreaCode === categoryValue);
                setSelectedCategoryName(area?.AreaName || categoryValue);
            } else if (selectedCategory === "Province") {
                const province = provinces.find((p) => p.ProvinceCode === categoryValue);
                setSelectedCategoryName(province?.ProvinceName || categoryValue);
            } else if (selectedCategory === "Division") {
                setSelectedCategoryName(categoryValue);
            } else {
                setSelectedCategoryName("Entire CEB");
            }

            const selectedCycle = cycleOptions.find(
                (opt) => opt.code === cycleValue
            );
            setSelectedCycleDisplay(selectedCycle?.display || cycleValue);

            setReportVisible(true);
        } catch (error) {
            setReportError(
                error instanceof Error
                    ? error.message
                    : "Failed to generate report"
            );
        } finally {
            setLoading(false);
        }
    };

    // Format division option
    const formatDivisionOption = (division: Division): string => {
        return division.RegionCode;
    };

    // Validation functions
    const isCycleDisabled = () => {
        return !selectedCycleType;
    };

    const isReportTypeDisabled = () => {
        return !selectedCycleType || !cycleValue || !netType;
    };

    const isReportCategoryDisabled = () => {
        return !selectedCycleType || !cycleValue || !reportType;
    };

    const isCategoryValueDisabled = () => {
        return (
            !selectedCycleType ||
            !cycleValue ||
            !reportType ||
            selectedCategory === "Entire CEB"
        );
    };

    const isNetTypeDisabled = () => {
        return !selectedCycleType || !cycleValue;
    };

    const canSubmit = () => {
        return (
            selectedCycleType &&
            cycleValue &&
            reportType &&
            selectedCategory &&
            (selectedCategory === "Entire CEB" || categoryValue) &&
            netType
        );
    };

    // Render detailed table
    // Render detailed table
    const renderDetailedTable = () => {
        if (detailedData.length === 0) {
            return (
                <div className="text-center py-8 text-gray-500">
                    No data available for the selected criteria.
                </div>
            );
        }

        const sortedData = sortDataAlphabetically(detailedData);

        // Calculate rowSpans for merged cells
        const divisionGroups: { [key: string]: number } = {};
        const provinceGroups: { [key: string]: number } = {};
        const areaGroups: { [key: string]: number } = {};

        sortedData.forEach((item) => {
            divisionGroups[item.Division] = (divisionGroups[item.Division] || 0) + 1;
        });

        sortedData.forEach((item) => {
            const provinceKey = `${item.Division}-${item.Province}`;
            provinceGroups[provinceKey] = (provinceGroups[provinceKey] || 0) + 1;
        });

        sortedData.forEach((item) => {
            const areaKey = `${item.Division}-${item.Province}-${item.Area}`;
            areaGroups[areaKey] = (areaGroups[areaKey] || 0) + 1;
        });

        let currentDivision = "";
        let currentProvince = "";
        let currentArea = "";

        // Determine if we should show merged columns (for Province, Division, or Entire CEB reports)
        const showMergedColumns = selectedCategory !== "Area";

        return (
            <table className="w-full border-collapse text-xs">
                <thead className="bg-gray-200 sticky top-0">
                    <tr>
                        {showMergedColumns && (
                            <>
                                <th className="border border-gray-300 px-2 py-1 text-center">
                                    Division
                                </th>
                                <th className="border border-gray-300 px-2 py-1 text-center">
                                    Province
                                </th>
                                <th className="border border-gray-300 px-2 py-1 text-center">
                                    Area
                                </th>
                            </>
                        )}
                        <th className="border border-gray-300 px-2 py-1 text-center">
                            Account Number
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-center">
                            Name
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-center">
                            Tariff
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-center">
                            Meter Number
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-center">
                            Present Reading Date
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-center">
                            Previous Reading Date
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-center">
                            Present Reading (Import)
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-center">
                            Previous Reading (Import)
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-center">
                            Units In
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-center">
                            Present Reading (Export)
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-center">
                            Previous Reading (Export)
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-center">
                            Units Out
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-center">
                            Net Units
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-center">
                            Unit Cost
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-center">
                            Payable Amount
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
                    {sortedData.map((item, index) => {
                        const divisionKey = item.Division;
                        const provinceKey = `${item.Division}-${item.Province}`;
                        const areaKey = `${item.Division}-${item.Province}-${item.Area}`;

                        const showDivision = currentDivision !== divisionKey;
                        const showProvince = currentProvince !== provinceKey;
                        const showArea = currentArea !== areaKey;

                        if (showDivision) {
                            currentDivision = divisionKey;
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

                        return (
                            <tr
                                key={index}
                                className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                            >
                                {showMergedColumns && (
                                    <>
                                        {showDivision ? (
                                            <td
                                                className="border border-gray-300 px-2 py-1 align-top font-medium"
                                                rowSpan={divisionGroups[divisionKey]}
                                            >
                                                {item.Division}
                                            </td>
                                        ) : null}

                                        {showProvince ? (
                                            <td
                                                className="border border-gray-300 px-2 py-1 align-top"
                                                rowSpan={provinceGroups[provinceKey]}
                                            >
                                                {item.Province}
                                            </td>
                                        ) : null}

                                        {showArea ? (
                                            <td
                                                className="border border-gray-300 px-2 py-1 align-top"
                                                rowSpan={areaGroups[areaKey]}
                                            >
                                                {item.Area}
                                            </td>
                                        ) : null}
                                    </>
                                )}
                                <td className="border border-gray-300 px-2 py-1">
                                    {item.AccountNumber}
                                </td>
                                <td className="border border-gray-300 px-2 py-1">
                                    {item.Name}
                                </td>
                                <td className="border border-gray-300 px-2 py-1">
                                    {item.Tariff}
                                </td>
                                <td className="border border-gray-300 px-2 py-1">
                                    {item.MeterNumber}
                                </td>
                                <td className="border border-gray-300 px-2 py-1 whitespace-nowrap">
                                    {item.PresentReadingDate}
                                </td>
                                <td className="border border-gray-300 px-2 py-1 whitespace-nowrap">
                                    {item.PreviousReadingDate}
                                </td>
                                <td className="border border-gray-300 px-2 py-1 text-right">
                                    {item.PresentReadingImport.toLocaleString("en-US")}
                                </td>
                                <td className="border border-gray-300 px-2 py-1 text-right">
                                    {item.PreviousReadingImport.toLocaleString("en-US")}
                                </td>
                                <td className="border border-gray-300 px-2 py-1 text-right">
                                    {item.UnitsIn.toLocaleString("en-US")}
                                </td>
                                <td className="border border-gray-300 px-2 py-1 text-right">
                                    {item.PresentReadingExport.toLocaleString("en-US")}
                                </td>
                                <td className="border border-gray-300 px-2 py-1 text-right">
                                    {item.PreviousReadingExport.toLocaleString("en-US")}
                                </td>
                                <td className="border border-gray-300 px-2 py-1 text-right">
                                    {item.UnitsOut.toLocaleString("en-US")}
                                </td>
                                <td className="border border-gray-300 px-2 py-1 text-right">
                                    {item.NetUnits.toLocaleString("en-US")}
                                </td>
                                <td className="border border-gray-300 px-2 py-1 text-right">
                                    {item.UnitCost.toLocaleString("en-US", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                    })}
                                </td>
                                <td className="border border-gray-300 px-2 py-1 text-right">
                                    {item.PayableAmount.toLocaleString("en-US", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                    })}
                                </td>
                                <td className="border border-gray-300 px-2 py-1">
                                    {item.BankCode}
                                </td>
                                <td className="border border-gray-300 px-2 py-1">
                                    {item.BranchCode}
                                </td>
                                <td className="border border-gray-300 px-2 py-1">
                                    {item.BankAccountNumber}
                                </td>
                                <td className="border border-gray-300 px-2 py-1 whitespace-nowrap">
                                    {item.AgreementDate}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        );
    };

    const renderSummaryTable = () => {
        if (summaryData.length === 0) {
            return (
                <div className="text-center py-8 text-gray-500">
                    No data available for the selected criteria.
                </div>
            );
        }

        // Calculate totals
        const totals = summaryData.reduce(
            (acc, row) => ({
                noOfCustomers: acc.noOfCustomers + row.NoOfCustomers,
                exportUnits: acc.exportUnits + row.ExportUnits,
                importUnits: acc.importUnits + row.ImportUnits,
                unitsBill: acc.unitsBill + row.UnitsBill,
                payments: acc.payments + row.Payments,
            }),
            {
                noOfCustomers: 0,
                exportUnits: 0,
                importUnits: 0,
                unitsBill: 0,
                payments: 0,
            }
        );

        return (
            <table className="w-full border-collapse text-xs">
                <thead className="bg-gray-200">
                    <tr>
                        <th className="border border-gray-300 px-2 py-1 text-center">
                            Category
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-center">
                            Tariff
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-center">
                            No of Customers
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-center">
                            Export Units
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-center">
                            Import Units
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-center">
                            Units Bill
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-center">
                            Payments
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {summaryData.map((row, index) => (
                        <tr key={`${row.Category}-${row.Tariff}-${index}`} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                            <td className="border border-gray-300 px-2 py-1">
                                {row.Category}
                            </td>
                            <td className="border border-gray-300 px-2 py-1">
                                {row.Tariff}
                            </td>
                            <td className="border border-gray-300 px-2 py-1 text-right">
                                {row.NoOfCustomers.toLocaleString("en-US")}
                            </td>
                            <td className="border border-gray-300 px-2 py-1 text-right">
                                {row.ExportUnits.toLocaleString("en-US", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                })}
                            </td>
                            <td className="border border-gray-300 px-2 py-1 text-right">
                                {row.ImportUnits.toLocaleString("en-US", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                })}
                            </td>
                            <td className="border border-gray-300 px-2 py-1 text-right">
                                {row.UnitsBill.toLocaleString("en-US", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                })}
                            </td>
                            <td className="border border-gray-300 px-2 py-1 text-right">
                                {row.Payments.toLocaleString("en-US", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                })}
                            </td>
                        </tr>
                    ))}
                    {/* Total Row */}
                    <tr className="bg-gray-200 font-bold">
                        <td className="border border-gray-300 px-2 py-1" colSpan={2}>
                            Total
                        </td>
                        <td className="border border-gray-300 px-2 py-1 text-right">
                            {totals.noOfCustomers.toLocaleString("en-US")}
                        </td>
                        <td className="border border-gray-300 px-2 py-1 text-right">
                            {totals.exportUnits.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                            })}
                        </td>
                        <td className="border border-gray-300 px-2 py-1 text-right">
                            {totals.importUnits.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                            })}
                        </td>
                        <td className="border border-gray-300 px-2 py-1 text-right">
                            {totals.unitsBill.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                            })}
                        </td>
                        <td className="border border-gray-300 px-2 py-1 text-right">
                            {totals.payments.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                            })}
                        </td>
                    </tr>
                </tbody>
            </table>
        );
    };

    return (
        <div className="p-6 bg-white rounded-lg shadow-md">


            {!reportVisible && (
                <>
                    <div className="mb-6">
                        <h2 className={`text-xl font-bold mb-6 ${maroon}`}>
                            Solar Connection Details (incl. reading and usage) - Retail
                        </h2>
                    </div>
                    <form
                        onSubmit={handleSubmit}
                        className="space-y-4"
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {/* Cycle Type Dropdown */}
                            <div className="flex flex-col">
                                <label className={`text-xs font-medium mb-1 ${maroon}`}>
                                    Select Cycle Type:
                                </label>
                                <select
                                    value={selectedCycleType}
                                    onChange={(e) => {
                                        setSelectedCycleType(e.target.value);
                                        setCycleValue("");
                                        setReportType("");
                                        setSelectedCategory("Area");
                                        setCategoryValue("");
                                        setNetType("");
                                    }}
                                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent"
                                    required
                                >
                                    <option value="">Select Cycle Type</option>
                                    <option value="Bill Cycle">
                                        Bill Cycle (for the selected month)
                                    </option>
                                    <option value="Calculation Cycle">
                                        Calculation Cycle (for all customers)
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
                                <select
                                    value={cycleValue}
                                    onChange={(e) => {
                                        setCycleValue(e.target.value);
                                        setReportType("");
                                        setSelectedCategory("Area");
                                        setCategoryValue("");
                                        setNetType("");
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
                                    {isLoadingCycles ? (
                                        <option value="">Loading...</option>
                                    ) : cycleError ? (
                                        <option value="">Error loading cycles</option>
                                    ) : (
                                        cycleOptions.map((option) => (
                                            <option key={option.code} value={option.code}>
                                                {option.display}
                                            </option>
                                        ))
                                    )}
                                </select>
                                {cycleError && (
                                    <p className="text-xs text-red-500 mt-1">{cycleError}</p>
                                )}
                            </div>

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
                                    required
                                    disabled={isNetTypeDisabled()}
                                >
                                    <option value="">Select Net Type</option>
                                    <option value="Net Metering">Net Metering</option>
                                    <option value="Net Accounting">Net Accounting</option>
                                    <option value="Net Plus">Net Plus</option>
                                    <option value="Net Plus Plus">Net Plus Plus</option>
                                </select>
                            </div>

                            {/* Report Type Dropdown */}
                            <div className="flex flex-col">
                                <label
                                    className={`text-xs font-medium mb-1 ${isReportTypeDisabled() ? "text-gray-400" : maroon
                                        }`}
                                >
                                    Select Report Type:
                                </label>
                                <select
                                    value={reportType}
                                    onChange={(e) => {
                                        setReportType(e.target.value);
                                        setSelectedCategory("Area");
                                        setCategoryValue("");
                                    }}
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
                                    className={`text-xs font-medium mb-1 ${isReportCategoryDisabled() ? "text-gray-400" : maroon
                                        }`}
                                >
                                    Select Report Category:
                                </label>
                                <select
                                    value={selectedCategory}
                                    onChange={(e) => {
                                        setSelectedCategory(e.target.value);
                                        setCategoryValue("");
                                    }}
                                    className={`w-full px-2 py-1.5 text-xs border rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent
                    ${isReportCategoryDisabled()
                                            ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                                            : "border-gray-300"
                                        }`}
                                    required
                                    disabled={isReportCategoryDisabled()}
                                >
                                    {allowedCategories.map((cat) => (
                                        <option key={cat} value={cat === "Region" ? "Division" : cat}>
                                            {cat === "Region" ? "Division" : cat}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Category Value Dropdown */}
                            {selectedCategory !== "Entire CEB" && (
                                <div className="flex flex-col">
                                    <label
                                        className={`text-xs font-medium mb-1 ${isCategoryValueDisabled() ? "text-gray-400" : maroon
                                            }`}
                                    >
                                        Select {selectedCategory}:
                                    </label>
                                    {selectedCategory === "Area" && (
                                        locked["Area"] ? (
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
                                                onChange={(e) => setCategoryValue(e.target.value)}
                                                className={`w-full px-2 py-1.5 text-xs border rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent
                        ${isCategoryValueDisabled()
                                                        ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                                                        : "border-gray-300"
                                                    }`}
                                                required
                                                disabled={isCategoryValueDisabled()}
                                            >
                                                <option value="">Select Area</option>
                                                {isLoadingAreas ? (
                                                    <option value="">Loading...</option>
                                                ) : areaError ? (
                                                    <option value="">Error loading areas</option>
                                                ) : (
                                                    areas.map((area) => (
                                                        <option key={area.AreaCode} value={area.AreaCode}>
                                                            {area.AreaCode} - {area.AreaName}
                                                        </option>
                                                    ))
                                                )}
                                            </select>
                                        )
                                    )}
                                    {selectedCategory === "Province" && (
                                        locked["Province"] ? (
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
                                                onChange={(e) => setCategoryValue(e.target.value)}
                                                className={`w-full px-2 py-1.5 text-xs border rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent
                        ${isCategoryValueDisabled()
                                                        ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                                                        : "border-gray-300"
                                                    }`}
                                                required
                                                disabled={isCategoryValueDisabled()}
                                            >
                                                <option value="">Select Province</option>
                                                {isLoadingProvinces ? (
                                                    <option value="">Loading...</option>
                                                ) : provinceError ? (
                                                    <option value="">Error loading provinces</option>
                                                ) : (
                                                    provinces.map((province) => (
                                                        <option key={province.ProvinceCode} value={province.ProvinceCode}>
                                                            {province.ProvinceCode} - {province.ProvinceName}
                                                        </option>
                                                    ))
                                                )}
                                            </select>
                                        )
                                    )}
                                    {selectedCategory === "Division" && (
                                        locked["Region"] ? (
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
                                                onChange={(e) => setCategoryValue(e.target.value)}
                                                className={`w-full px-2 py-1.5 text-xs border rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent
                        ${isCategoryValueDisabled()
                                                        ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                                                        : "border-gray-300"
                                                    }`}
                                                required
                                                disabled={isCategoryValueDisabled()}
                                            >
                                                <option value="">Select Division</option>
                                                {isLoadingDivisions ? (
                                                    <option value="">Loading...</option>
                                                ) : divisionError ? (
                                                    <option value="">Error loading divisions</option>
                                                ) : (
                                                    divisions.map((division) => (
                                                        <option key={division.RegionCode} value={division.RegionCode}>
                                                            {formatDivisionOption(division)}
                                                        </option>
                                                    ))
                                                )}
                                            </select>
                                        )
                                    )}
                                </div>
                            )}
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
                                Solar Connection Details (incl. reading and usage) - Retail
                            </h2>
                            <p className="text-sm text-gray-600 mt-1">
                                {selectedCategory === "Entire CEB"
                                    ? "Entire CEB"
                                    : `${selectedCategory}: ${selectedCategoryName}`}{" "}
                                | {selectedCycleType}: {selectedCycleDisplay} | Type:{" "}
                                {reportType} | Net Type: {netType}
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
                                ? renderSummaryTable()
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

export default SolarConnectionDetailsRetail;