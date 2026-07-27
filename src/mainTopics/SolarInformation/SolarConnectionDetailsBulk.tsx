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

interface BulkUsageData {
    AccountNumber: string;
    Name: string;
    Tariff: string;
    NetType: string;
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
    AgreementDate: string;
    Division: string;
    Province: string;
    Area: string;
    AreaCode: string;
    BillCycle: string;
    ErrorMessage?: string;
}

const SolarConnectionDetailsBulk: React.FC = () => {
    const maroon = "text-[#7A0000]";
    const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";

    // Form states
    const [billCycle, setBillCycle] = useState<string>("");
    const [netType, setNetType] = useState<string>("");
    const [reportCategory, setReportCategory] = useState<string>("Area");
    const [categoryValue, setCategoryValue] = useState<string>("");
    const [loading, setLoading] = useState(false);

    // Data states
    const [areas, setAreas] = useState<Area[]>([]);
    const [provinces, setProvinces] = useState<Province[]>([]);
    const [divisions, setDivisions] = useState<Division[]>([]);
    const [billCycleOptions, setBillCycleOptions] = useState<BillCycleOption[]>([]);

    // Loading states
    const [isLoadingAreas, setIsLoadingAreas] = useState(false);
    const [isLoadingProvinces, setIsLoadingProvinces] = useState(false);
    const [isLoadingDivisions, setIsLoadingDivisions] = useState(false);
    const [isLoadingBillCycles, setIsLoadingBillCycles] = useState(false);

    // Error states
    const [areaError, setAreaError] = useState<string | null>(null);
    const [provinceError, setProvinceError] = useState<string | null>(null);
    const [divisionError, setDivisionError] = useState<string | null>(null);
    const [billCycleError, setBillCycleError] = useState<string | null>(null);
    const [reportError, setReportError] = useState<string | null>(null);

    // Display states
    const [selectedCategoryName, setSelectedCategoryName] = useState<string>("");
    const [selectedBillCycleDisplay, setSelectedBillCycleDisplay] = useState<string>("");
    const [reportVisible, setReportVisible] = useState(false);

    // Report data
    const [reportData, setReportData] = useState<BulkUsageData[]>([]);

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

    // Convert net type display to backend code
    const getNetTypeCode = (displayValue: string): string => {
        const netTypeMap: { [key: string]: string } = {
            "Net Metering": "1",
            "Net Accounting": "2",
            "Net Plus": "3",
            "Net Plus Plus": "4",
            "Convert Net Metering to Net Accounting": "5"
        };
        return netTypeMap[displayValue] || "";
    };

    // Convert net type code to display name
    const getNetTypeDisplayName = (netTypeCode: string): string => {
        const netTypeMap: { [key: string]: string } = {
            "1": "Net Metering",
            "2": "Net Accounting",
            "3": "Net Plus",
            "4": "Net Plus Plus",
            //"5": "Convert Net Metering to Net Accounting"
        };
        return netTypeMap[netTypeCode] || netTypeCode; // Fallback to the code if not found
    };

    // Format number with comma separators
    const formatNumber = (num: number, decimals: number = 2): string => {
        return num.toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    };

    // Format date
    const formatDate = (dateStr: string): string => {
        if (!dateStr) return "";
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return dateStr;
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const year = date.getFullYear();
            return `${day}-${month}-${year}`;
        } catch {
            return dateStr;
        }
    };

    // Sort data alphabetically
    const sortDataAlphabetically = (data: BulkUsageData[]): BulkUsageData[] => {
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



    // Fetch bill cycles
    useEffect(() => {
        const fetchBillCycles = async () => {
            setIsLoadingBillCycles(true);
            setBillCycleError(null);
            try {
                const response = await fetchWithErrorHandling("/misapi/api/bulk/netmtcons/billcycle/max");

                const billCyclesArray = response?.data?.BillCycles;
                const maxBillCycle = response?.data?.MaxBillCycle;

                if (billCyclesArray && Array.isArray(billCyclesArray) && maxBillCycle) {
                    const maxCycleNum = parseInt(maxBillCycle);

                    const options: BillCycleOption[] = billCyclesArray.map((cycle: string, index: number) => {
                        const cycleNumber = maxCycleNum - index;
                        return {
                            display: `${cycleNumber} - ${cycle}`,
                            code: cycleNumber.toString(),
                        };
                    });

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

    // Fetch areas
    useEffect(() => {
        const fetchAreas = async () => {
            setIsLoadingAreas(true);
            setAreaError(null);
            try {
                let url = "/misapi/api/bulk/areas";
                if (locked["Region"]?.code) {
                    url += `?regionCode=${locked["Region"].code}`;
                } else if (locked["Province"]?.code) {
                    url += `?provCode=${locked["Province"].code}`;
                }
                const response = await fetchWithErrorHandling(url);
                if (response?.data && Array.isArray(response.data)) {
                    setAreas(response.data);
                } else {
                    throw new Error("Invalid areas data format");
                }
            } catch (error: any) {
                console.error("Error fetching areas:", error);
                setAreaError(error.message || "Failed to load areas");
            } finally {
                setIsLoadingAreas(false);
            }
        };

        if (reportCategory === "Area") {
            fetchAreas();
        }
    }, [reportCategory, user.Level, user.RegionCode, user.ProvinceCode]);

    // Fetch provinces
    useEffect(() => {
        const fetchProvinces = async () => {
            setIsLoadingProvinces(true);
            setProvinceError(null);
            try {
                let url = "/misapi/api/bulk/province";
                if (locked["Region"]?.code) {
                    url += `?regionCode=${locked["Region"].code}`;
                }
                const response = await fetchWithErrorHandling(url);
                if (response?.data && Array.isArray(response.data)) {
                    setProvinces(response.data);
                } else {
                    throw new Error("Invalid provinces data format");
                }
            } catch (error: any) {
                console.error("Error fetching provinces:", error);
                setProvinceError(error.message || "Failed to load provinces");
            } finally {
                setIsLoadingProvinces(false);
            }
        };

        if (reportCategory === "Province") {
            fetchProvinces();
        }
    }, [reportCategory, user.Level, user.RegionCode]);

    // Fetch divisions
    useEffect(() => {
        const fetchDivisions = async () => {
            setIsLoadingDivisions(true);
            setDivisionError(null);
            try {
                const response = await fetchWithErrorHandling("/misapi/api/bulk/region");
                if (response?.data && Array.isArray(response.data)) {
                    setDivisions(response.data);
                } else {
                    throw new Error("Invalid divisions data format");
                }
            } catch (error: any) {
                console.error("Error fetching divisions:", error);
                setDivisionError(error.message || "Failed to load divisions");
            } finally {
                setIsLoadingDivisions(false);
            }
        };

        if (reportCategory === "Division") {
            fetchDivisions();
        }
    }, [reportCategory]);


    useEffect(() => {
        const key = reportCategory === "Division" ? "Region" : reportCategory;
        const lock = locked[key as keyof typeof locked];
        if (lock) {
            setCategoryValue(lock.code);
            setSelectedCategoryName(lock.name ? `${lock.code} - ${lock.name}` : lock.code);
        }
    }, [reportCategory, user.Level, user.RegionCode, user.ProvinceCode, user.ProvinceName, user.AreaCode, user.AreaName]);

    // Format division option
    const formatDivisionOption = (division: Division): string => {
        return division.RegionCode || "Unknown";
    };

    // Check if category value dropdown should be disabled
    const isCategoryValueDisabled = () => {
        return !billCycle || !netType;
    };

    // Check if net type dropdown should be disabled
    const isNetTypeDisabled = () => {
        return !billCycle;
    };

    // Check if form can be submitted
    const canSubmit = () => {
        if (!billCycle || !netType || !reportCategory) return false;
        if (reportCategory !== "Entire CEB" && !categoryValue) return false;
        return true;
    };

    // Handle form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setReportError(null);

        try {
            const netTypeCode = getNetTypeCode(netType);

            // Determine report type for API
            let reportTypeParam = "";
            let typeCodeParam = "";

            if (reportCategory === "Area") {
                reportTypeParam = "area";
                typeCodeParam = categoryValue;
            } else if (reportCategory === "Province") {
                reportTypeParam = "province";
                typeCodeParam = categoryValue;
            } else if (reportCategory === "Division") {
                reportTypeParam = "region";
                typeCodeParam = categoryValue;
            } else if (reportCategory === "Entire CEB") {
                reportTypeParam = "entireceb";
                typeCodeParam = "";
            }

            // Build API URL
            const apiUrl = `/misapi/solarapi/solarConnectionDetails/bulk?addedBillCycle=${billCycle}&billCycle=${billCycle}&netType=${netTypeCode}&reportType=${reportTypeParam}${typeCodeParam ? `&typeCode=${typeCodeParam}` : ''}`;

            console.log("Fetching report from:", apiUrl);

            const response = await fetchWithErrorHandling(apiUrl);

            if (response?.data && Array.isArray(response.data)) {
                const sortedData = sortDataAlphabetically(response.data);
                setReportData(sortedData);

                // Set display values
                if (reportCategory === "Area") {
                    const selectedArea = areas.find(a => a.AreaCode === categoryValue);
                    setSelectedCategoryName(selectedArea?.AreaName || categoryValue);
                } else if (reportCategory === "Province") {
                    const selectedProvince = provinces.find(p => p.ProvinceCode === categoryValue);
                    setSelectedCategoryName(selectedProvince?.ProvinceName || categoryValue);
                } else if (reportCategory === "Division") {
                    setSelectedCategoryName(categoryValue);
                } else {
                    setSelectedCategoryName("Entire CEB");
                }

                const selectedCycle = billCycleOptions.find(opt => opt.code === billCycle);
                setSelectedBillCycleDisplay(selectedCycle?.display || billCycle);

                setReportVisible(true);
            } else {
                throw new Error("Invalid response data format");
            }
        } catch (error: any) {
            console.error("Error generating report:", error);
            setReportError(error.message || "Failed to generate report. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // CSV Export Function
    const downloadAsCSV = () => {
        if (!reportData.length) return;

        const reportTitle = "Solar Connection Details (incl. reading and usage) - Bulk";
        const selectionInfo = reportCategory === "Entire CEB"
            ? "Entire CEB"
            : `${reportCategory}: ${selectedCategoryName}`;

        // Determine headers based on report category
        const headers = reportCategory === "Area"
            ? [
                "Account Number",
                "Name",
                "Tariff",
                "Net Type",
                "Meter Number",
                "Present Reading Date",
                "Previous Reading Date",
                "Present Reading (Import)",
                "Previous Reading (Import)",
                "Units In",
                "Present Reading (Export)",
                "Previous Reading (Export)",
                "Units Out",
                "Net Units",
                "Unit Cost",
                "Agreement Date"
            ]
            : [
                "Division",
                "Province",
                "Area",
                "Account Number",
                "Name",
                "Tariff",
                "Net Type",
                "Meter Number",
                "Present Reading Date",
                "Previous Reading Date",
                "Present Reading (Import)",
                "Previous Reading (Import)",
                "Units In",
                "Present Reading (Export)",
                "Previous Reading (Export)",
                "Units Out",
                "Net Units",
                "Unit Cost",
                "Agreement Date"
            ];

        let currentDivision = "";
        let currentProvince = "";
        let currentArea = "";

        const rows = reportData.map((item) => {
            const row: any[] = [];

            if (reportCategory !== "Area") {
                // Division column
                if (currentDivision !== item.Division) {
                    currentDivision = item.Division;
                    row.push(item.Division);
                } else {
                    row.push("");
                }

                // Province column
                const provinceKey = `${item.Division}-${item.Province}`;
                if (currentProvince !== provinceKey) {
                    currentProvince = provinceKey;
                    row.push(item.Province);
                } else {
                    row.push("");
                }

                // Area column
                const areaKey = `${item.Division}-${item.Province}-${item.Area}`;
                if (currentArea !== areaKey) {
                    currentArea = areaKey;
                    row.push(item.Area);
                } else {
                    row.push("");
                }
            }

            // Common columns
            row.push(
                item.AccountNumber,
                item.Name,
                item.Tariff,
                getNetTypeDisplayName(item.NetType),
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
                formatDate(item.AgreementDate)
            );

            return row;
        });

        const csvContent = [
            [reportTitle],
            [selectionInfo],
            [`Month: ${selectedBillCycleDisplay}`],
            [`Net Type: ${netType}`],
            [],
            headers,
            ...rows,
        ]
            .map((row) => row.map((cell) => `"${cell}"`).join(","))
            .join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Solar_Bulk_Usage_${billCycle}_${reportCategory}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Print PDF Function
    const printPDF = () => {
        if (!printRef.current) return;

        const printWindow = window.open("", "_blank");
        if (!printWindow) return;

        const reportTitle = "SOLAR CONNECTION DETAILS (INCL. READING AND USAGE) - BULK";
        const categoryInfo = reportCategory === "Entire CEB"
            ? "Entire CEB"
            : `${reportCategory}: <span class="bold">${selectedCategoryName}</span>`;
        const selectionInfo = `${categoryInfo}<br>Month: <span class="bold">${selectedBillCycleDisplay}</span><br>Net Type: <span class="bold">${netType}</span>`;

        printWindow.document.write(`
      <html>
        <head>
          <title>Solar Connection Details (incl. reading and usage) - Bulk</title>
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

    // Render table
    const renderTable = () => {
        if (!reportData.length) {
            return (
                <div className="text-center py-8 text-gray-500">
                    No data available
                </div>
            );
        }

        // Calculate rowSpans for merged cells
        const divisionGroups: { [key: string]: number } = {};
        const provinceGroups: { [key: string]: number } = {};
        const areaGroups: { [key: string]: number } = {};

        reportData.forEach((item) => {
            divisionGroups[item.Division] = (divisionGroups[item.Division] || 0) + 1;
        });

        reportData.forEach((item) => {
            const provinceKey = `${item.Division}-${item.Province}`;
            provinceGroups[provinceKey] = (provinceGroups[provinceKey] || 0) + 1;
        });

        reportData.forEach((item) => {
            const areaKey = `${item.Division}-${item.Province}-${item.Area}`;
            areaGroups[areaKey] = (areaGroups[areaKey] || 0) + 1;
        });

        let currentDivision = "";
        let currentProvince = "";
        let currentArea = "";

        return (
            <table className="w-full border-collapse text-xs">
                <thead className="bg-gray-200 sticky top-0">
                    <tr>
                        {reportCategory !== "Area" && (
                            <>
                                <th className="border border-gray-300 px-2 py-1 text-center">Division</th>
                                <th className="border border-gray-300 px-2 py-1 text-center">Province</th>
                                <th className="border border-gray-300 px-2 py-1 text-center">Area</th>
                            </>
                        )}
                        <th className="border border-gray-300 px-2 py-1 text-center">Account Number</th>
                        <th className="border border-gray-300 px-2 py-1 text-center">Name</th>
                        <th className="border border-gray-300 px-2 py-1 text-center">Tariff</th>
                        <th className="border border-gray-300 px-2 py-1 text-center">Net Type</th>
                        <th className="border border-gray-300 px-2 py-1 text-center">Meter Number</th>
                        <th className="border border-gray-300 px-2 py-1 text-center">Present Reading Date</th>
                        <th className="border border-gray-300 px-2 py-1 text-center">Previous Reading Date</th>
                        <th className="border border-gray-300 px-2 py-1 text-center">Present Reading (Import)</th>
                        <th className="border border-gray-300 px-2 py-1 text-center">Previous Reading (Import)</th>
                        <th className="border border-gray-300 px-2 py-1 text-center">Units In</th>
                        <th className="border border-gray-300 px-2 py-1 text-center">Present Reading (Export)</th>
                        <th className="border border-gray-300 px-2 py-1 text-center">Previous Reading (Export)</th>
                        <th className="border border-gray-300 px-2 py-1 text-center">Units Out</th>
                        <th className="border border-gray-300 px-2 py-1 text-center">Net Units</th>
                        <th className="border border-gray-300 px-2 py-1 text-center">Unit Cost</th>
                        <th className="border border-gray-300 px-2 py-1 text-center">Agreement Date</th>
                    </tr>
                </thead>
                <tbody>
                    {reportData.map((item, index) => {
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
                            <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                {reportCategory !== "Area" && (
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
                                <td className="border border-gray-300 px-2 py-1">{item.AccountNumber}</td>
                                <td className="border border-gray-300 px-2 py-1">{item.Name}</td>
                                <td className="border border-gray-300 px-2 py-1">{item.Tariff}</td>
                                <td className="border border-gray-300 px-2 py-1 whitespace-nowrap">{getNetTypeDisplayName(item.NetType)}</td>
                                <td className="border border-gray-300 px-2 py-1">{item.MeterNumber}</td>
                                <td className="border border-gray-300 px-2 py-1 whitespace-nowrap">{item.PresentReadingDate}</td>
                                <td className="border border-gray-300 px-2 py-1 whitespace-nowrap">{item.PreviousReadingDate}</td>
                                <td className="border border-gray-300 px-2 py-1 text-right">{formatNumber(item.PresentReadingImport)}</td>
                                <td className="border border-gray-300 px-2 py-1 text-right">{formatNumber(item.PreviousReadingImport)}</td>
                                <td className="border border-gray-300 px-2 py-1 text-right">{formatNumber(item.UnitsIn)}</td>
                                <td className="border border-gray-300 px-2 py-1 text-right">{formatNumber(item.PresentReadingExport)}</td>
                                <td className="border border-gray-300 px-2 py-1 text-right">{formatNumber(item.PreviousReadingExport)}</td>
                                <td className="border border-gray-300 px-2 py-1 text-right">{formatNumber(item.UnitsOut)}</td>
                                <td className="border border-gray-300 px-2 py-1 text-right">{formatNumber(item.NetUnits)}</td>
                                <td className="border border-gray-300 px-2 py-1 text-right">{formatNumber(item.UnitCost)}</td>
                                <td className="border border-gray-300 px-2 py-1 whitespace-nowrap">{formatDate(item.AgreementDate)}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        );
    };

    return (
        <div className="p-6 bg-white rounded-lg shadow-md">


            {/* Form Section */}
            {!reportVisible && (
                <>
                    <h2 className={`text-xl font-bold mb-6 ${maroon}`}>
                        Solar Connection Details (incl. reading and usage) - Bulk
                    </h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* First Row - Month, Net Type, Report Category */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Select Month Dropdown */}
                            <div className="flex flex-col">
                                <label className={`text-xs font-medium mb-1 ${maroon}`}>
                                    Select Month:
                                </label>
                                <select
                                    value={billCycle}
                                    onChange={(e) => {
                                        setBillCycle(e.target.value);
                                        setNetType("");
                                        setCategoryValue("");
                                    }}
                                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent"
                                    required
                                >
                                    <option value="">Select Month</option>
                                    {isLoadingBillCycles ? (
                                        <option value="">Loading...</option>
                                    ) : billCycleError ? (
                                        <option value="">Error loading bill cycles</option>
                                    ) : (
                                        billCycleOptions.map((option) => (
                                            <option key={option.code} value={option.code}>
                                                {option.display}
                                            </option>
                                        ))
                                    )}
                                </select>
                            </div>

                            {/* Select Net Type Dropdown */}
                            <div className="flex flex-col">
                                <label
                                    className={`text-xs font-medium mb-1 ${isNetTypeDisabled() ? "text-gray-400" : maroon
                                        }`}
                                >
                                    Select Net Type:
                                </label>
                                <select
                                    value={netType}
                                    onChange={(e) => {
                                        setNetType(e.target.value);
                                        setCategoryValue("");
                                    }}
                                    className={`w-full px-2 py-1.5 text-xs border rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent ${isNetTypeDisabled()
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

                            {/* Select Report Category Dropdown */}
                            <div className="flex flex-col">
                                <label
                                    className={`text-xs font-medium mb-1 ${isCategoryValueDisabled() ? "text-gray-400" : maroon
                                        }`}
                                >
                                    Select Report Category:
                                </label>
                                <select
                                    value={reportCategory}
                                    onChange={(e) => {
                                        setReportCategory(e.target.value);
                                        setCategoryValue("");
                                    }}
                                    className={`w-full px-2 py-1.5 text-xs border rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent ${isCategoryValueDisabled()
                                        ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                                        : "border-gray-300"
                                        }`}
                                    required
                                    disabled={isCategoryValueDisabled()}
                                >
                                    {allowedCategories.map((cat) => (
                                        <option key={cat} value={cat === "Region" ? "Division" : cat}>
                                            {cat === "Region" ? "Division" : cat}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Second Row - Category Value (Area/Province/Division) */}
                        {reportCategory !== "Entire CEB" && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="flex flex-col">
                                    <label
                                        className={`text-xs font-medium mb-1 ${isCategoryValueDisabled() ? "text-gray-400" : maroon
                                            }`}
                                    >
                                        {reportCategory === "Area" && "Select Area:"}
                                        {reportCategory === "Province" && "Select Province:"}
                                        {reportCategory === "Division" && "Select Division:"}
                                    </label>
                                    {reportCategory === "Area" && (
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
                                                className={`w-full px-2 py-1.5 text-xs border rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent ${isCategoryValueDisabled()
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
                                    {reportCategory === "Province" && (
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
                                                className={`w-full px-2 py-1.5 text-xs border rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent ${isCategoryValueDisabled()
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
                                    {reportCategory === "Division" && (
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
                                                className={`w-full px-2 py-1.5 text-xs border rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent ${isCategoryValueDisabled()
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
                            </div>
                        )}

                        {/* Submit button */}
                        <div className="w-full mt-6 flex justify-end">
                            <button
                                type="submit"
                                className={`px-6 py-2 rounded-md font-medium transition-opacity duration-300 shadow ${maroonGrad} text-white ${loading || !canSubmit()
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
                                Solar Connection Details (incl. reading and usage) - Bulk
                            </h2>
                            <p className="text-sm text-gray-600 mt-1">
                                {reportCategory === "Entire CEB"
                                    ? "Entire CEB"
                                    : `${reportCategory}: ${selectedCategoryName}`}{" "}
                                | Month: {selectedBillCycleDisplay} | Net Type: {netType}
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
                    <div className="overflow-x-auto max-h-[calc(100vh-250px)] border border-gray-300 rounded-lg">
                        <div ref={printRef} className="min-w-full py-4">
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

            {/* Error Message (when not in report view) */}
            {!reportVisible && reportError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                    {reportError}
                </div>
            )}
        </div>
    );
};

export default SolarConnectionDetailsBulk;