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

interface BulkPaymentData {
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
    KwhCharge: number;
    FixedCharge: number;
    CFUnits: number;
    Rate: number;
    UnitSale: number;
    KwhSales: number;
    BankCode: string | null;
    BranchCode: string | null;
    BankAccountNumber: string | null;
    AgreementDate: string;
    ErrorMessage?: string;
}

const SolarPaymentBulk: React.FC = () => {
    const maroon = "text-[#7A0000]";
    const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";

    // Form states
    const [billCycle, setBillCycle] = useState<string>("");
    const [reportCategory, setReportCategory] = useState<string>("Area");
    const [categoryValue, setCategoryValue] = useState<string>("");
    const [netType, setNetType] = useState<string>("");
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
    const [reportData, setReportData] = useState<BulkPaymentData[]>([]);

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

    // Format number with comma separators
    const formatNumber = (num: number, decimals: number = 2): string => {
        return num.toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    };

    // Sort data alphabetically
    const sortDataAlphabetically = (data: BulkPaymentData[]): BulkPaymentData[] => {
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

                console.log("Bill cycle response:", response); // Debug log

                // The response structure is: { data: { BillCycles: [...], MaxBillCycle: "445" } }
                const billCyclesArray = response?.data?.BillCycles;
                const maxBillCycle = response?.data?.MaxBillCycle;

                if (billCyclesArray && Array.isArray(billCyclesArray) && maxBillCycle) {
                    const maxCycleNum = parseInt(maxBillCycle);

                    // Map bill cycles to options with format "445 - Sep 25"
                    const options: BillCycleOption[] = billCyclesArray.map((cycle: string, index: number) => {
                        const cycleNumber = maxCycleNum - index;
                        return {
                            display: `${cycleNumber} - ${cycle}`, // "445 - Sep 25"
                            code: cycleNumber.toString(), // "445"
                        };
                    });

                    console.log("Parsed bill cycle options:", options); // Debug log
                    setBillCycleOptions(options);

                    if (options.length === 0) {
                        setBillCycleError("No bill cycles available");
                    }
                } else {
                    console.error("Invalid bill cycle data structure:", response);
                    setBillCycleError("Invalid bill cycle data format");
                }
            } catch (err: any) {
                console.error("Error fetching bill cycles:", err);
                setBillCycleError(
                    err.message || "Failed to load bill cycles. Please try again later."
                );
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
                const areaData = await fetchWithErrorHandling(url);
                setAreas(areaData.data || []);
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
                let url = "/misapi/api/bulk/province";
                if (locked["Region"]?.code) {
                    url += `?regionCode=${locked["Region"].code}`;
                }
                const provinceData = await fetchWithErrorHandling(url);
                setProvinces(provinceData.data || []);
            } catch (err: any) {
                console.error("Error fetching provinces:", err);
                setProvinceError(
                    err.message || "Failed to load provinces. Please try again later."
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
                    "/misapi/api/bulk/region"
                );
                setDivisions(divisionData.data || []);
            } catch (err: any) {
                console.error("Error fetching divisions:", err);
                setDivisionError(
                    err.message || "Failed to load divisions. Please try again later."
                );
            } finally {
                setIsLoadingDivisions(false);
            }
        };

        fetchDivisions();
    }, []);


    useEffect(() => {
        const key = reportCategory === "Division" ? "Region" : reportCategory;
        const lock = locked[key as keyof typeof locked];
        if (lock) {
            setCategoryValue(lock.code);
            setSelectedCategoryName(lock.name ? `${lock.code} - ${lock.name}` : lock.code);
        }
    }, [reportCategory, locked]);

    // Reset category value when report category changes
    useEffect(() => {
        setCategoryValue("");
        setSelectedCategoryName("");
    }, [reportCategory]);

    // Helper function to check if category value dropdown should be disabled
    const isCategoryValueDisabled = () => {
        if (!billCycle) return true;
        if (reportCategory === "Entire CEB") return true;
        if (reportCategory === "Area") {
            return isLoadingAreas || areaError !== null;
        }
        if (reportCategory === "Province") {
            return isLoadingProvinces || provinceError !== null;
        }
        if (reportCategory === "Division") {
            return isLoadingDivisions || divisionError !== null;
        }
        return false;
    };

    // Helper function to check if net type dropdown should be disabled
    const isNetTypeDisabled = () => {
        if (!billCycle) return true;
        if (reportCategory === "Entire CEB") return false;
        return !categoryValue;
    };

    // Helper function to map net type to API values
    const mapNetTypeToApiValue = (netType: string): string => {
        const netTypeMap: { [key: string]: string } = {
            "Net Metering": "1",
            "Net Accounting": "2",
            "Net Plus": "3",
            "Net Plus Plus": "4",
            "Convert Net Metering to Net Accounting": "5"
        };
        return netTypeMap[netType] || netType;
    };

    // Helper function to check if form can be submitted
    const canSubmit = () => {
        if (!billCycle || !netType) return false;
        if (reportCategory === "Entire CEB") return true;
        return !!categoryValue;
    };

    // Handle form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit()) return;

        setLoading(true);
        setReportError(null);

        try {
            // Determine report type and type code based on selected category
            let reportType = "";
            let typeCode = "";

            if (reportCategory === "Area") {
                reportType = "Area";
                typeCode = categoryValue;
            } else if (reportCategory === "Province") {
                reportType = "Province";
                typeCode = categoryValue;
            } else if (reportCategory === "Division") {
                reportType = "Region";
                typeCode = categoryValue;
            } else if (reportCategory === "Entire CEB") {
                reportType = "EntireCEB";
                typeCode = "ALL";
            }

            const url = `/misapi/solarapi/solarPayment/bulk?billCycle=${encodeURIComponent(
                billCycle
            )}&netType=${encodeURIComponent(mapNetTypeToApiValue(netType))}&reportType=${reportType}&typeCode=${encodeURIComponent(
                typeCode
            )}`;

            console.log("Request URL:", url); // Debug log

            const data = await fetchWithErrorHandling(url);

            console.log("API Response:", data); // Debug log
            console.log("Response data array:", data.data); // Debug log

            if (data.data && Array.isArray(data.data) && data.data.length > 0) {
                const sortedData = sortDataAlphabetically(data.data);
                setReportData(sortedData);
                setReportVisible(true);

                // Set display names
                if (reportCategory === "Area") {
                    const selectedArea = areas.find((a) => a.AreaCode === categoryValue);
                    setSelectedCategoryName(selectedArea ? `${selectedArea.AreaCode} - ${selectedArea.AreaName}` : categoryValue);
                } else if (reportCategory === "Province") {
                    const selectedProvince = provinces.find((p) => p.ProvinceCode === categoryValue);
                    setSelectedCategoryName(selectedProvince ? `${selectedProvince.ProvinceCode} - ${selectedProvince.ProvinceName}` : categoryValue);
                } else {
                    setSelectedCategoryName(categoryValue);
                }

                const selectedCycle = billCycleOptions.find((c) => c.code === billCycle);
                setSelectedBillCycleDisplay(selectedCycle?.display || billCycle);
            } else {
                console.warn("Empty or invalid data received:", data); // Debug log
                setReportError("No data available for the selected criteria.");
            }
        } catch (err: any) {
            console.error("Error fetching report:", err);
            setReportError(err.message || "Failed to generate report. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // Format division option
    const formatDivisionOption = (division: Division): string => {
        return division.RegionCode || "Unknown";
    };

    // Download as CSV
    const downloadAsCSV = () => {
        if (reportData.length === 0) return;

        const sortedData = sortDataAlphabetically(reportData);

        // Create header information
        const reportTitle = "Solar Payment Information For Current Month - Bulk";
        const selectionInfo = reportCategory === "Entire CEB"
            ? "Entire CEB"
            : `${reportCategory}: ${selectedCategoryName}`;
        const monthInfo = `Month: ${selectedBillCycleDisplay}`;
        const netTypeInfo = `Net Type: ${netType}`;
        const generatedDate = `Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`;

        // Column headers - matching table exactly
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
            "KWH Charge",
            "Fixed Charge",
            "CF Units",
            "Rate",
            "Units Sale",
            "KWH Sales",
            "Bank Code",
            "Branch Code",
            "Bank Account Number",
            "Agreement Date",
        ];

        // Escape values that contain commas by wrapping in quotes
        const escapeCSV = (value: string | number | null) => {
            if (value === null || value === undefined) return "";
            const stringValue = String(value);
            // If value contains comma, quote, or newline, wrap in quotes and escape existing quotes
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
        };

        // Group data like in the table rendering
        const divisionGroups: { [key: string]: BulkPaymentData[] } = {};
        const provinceGroups: { [key: string]: BulkPaymentData[] } = {};
        const areaGroups: { [key: string]: BulkPaymentData[] } = {};

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
                            escapeCSV(formatNumber(row.PanelCapacity, 2)),
                            escapeCSV(formatNumber(row.EnergyExported, 0)),
                            escapeCSV(formatNumber(row.EnergyImported, 0)),
                            escapeCSV(row.Tariff),
                            escapeCSV(formatNumber(row.BFUnits, 0)),
                            escapeCSV(formatNumber(row.KwhCharge, 2)),
                            escapeCSV(formatNumber(row.FixedCharge, 2)),
                            escapeCSV(formatNumber(row.CFUnits, 0)),
                            escapeCSV(formatNumber(row.Rate, 2)),
                            escapeCSV(formatNumber(row.UnitSale, 0)),
                            escapeCSV(formatNumber(row.KwhSales, 2)),
                            escapeCSV(row.BankCode || ""),
                            escapeCSV(row.BranchCode || ""),
                            escapeCSV(row.BankAccountNumber || ""),
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
                            escapeCSV(formatNumber(totals.panelCapacity, 2)),
                            escapeCSV(formatNumber(totals.energyExported, 0)),
                            escapeCSV(formatNumber(totals.energyImported, 0)),
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
                        escapeCSV(formatNumber(totals.panelCapacity, 2)),
                        escapeCSV(formatNumber(totals.energyExported, 0)),
                        escapeCSV(formatNumber(totals.energyImported, 0)),
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
                    escapeCSV(formatNumber(totals.panelCapacity, 2)),
                    escapeCSV(formatNumber(totals.energyExported, 0)),
                    escapeCSV(formatNumber(totals.energyImported, 0)),
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
            `${selectionInfo} | ${monthInfo} | ${netTypeInfo}`,
            generatedDate,
            "", // Empty line
            headers.join(","),
            ...dataRows,
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `solar_payment_bulk_${Date.now()}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Print as PDF
    const printPDF = () => {
        if (!printRef.current) return;

        const printWindow = window.open("", "_blank");
        if (!printWindow) return;

        const reportTitle = "SOLAR PAYMENT INFORMATION FOR CURRENT MONTH - BULK";

        const selectionInfo = (() => {
            if (reportCategory === "Entire CEB") {
                return "Entire CEB";
            } else {
                return `${reportCategory}: <span class="bold">${selectedCategoryName}</span>`;
            }
        })();

        printWindow.document.write(`
      <html>
        <head>
          <title>Solar Payment Bulk Report</title>
          <style>
            body { font-family: Arial; font-size: 10px; margin: 10mm; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 2px 4px; border: 1px solid #ddd; font-size: 10px; vertical-align: top;}
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
              background-color: #f0f0f0; 
              font-weight: bold; 
              text-align: left; 
            }
            tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            .bold {
              font-weight: bold;
            }
            .font-medium {
              font-weight: 500;
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
            ${selectionInfo}<br>
            Month: <span class="bold">${selectedBillCycleDisplay}</span> | Net Type: <span class="bold">${netType}</span>
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
        const sortedData = sortDataAlphabetically(reportData);

        // Calculate row spans for merged cells
        const divisionGroups: { [key: string]: BulkPaymentData[] } = {};
        const provinceGroups: { [key: string]: BulkPaymentData[] } = {};
        const areaGroups: { [key: string]: BulkPaymentData[] } = {};

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
                                        className="px-2 py-1.5 border border-gray-300 align-top font-medium"
                                        rowSpan={divisionRowSpans[divisionKey]}
                                    >
                                        {row.Division}
                                    </td>
                                ) : null}

                                {showProvince ? (
                                    <td
                                        className="px-2 py-1.5 border border-gray-300 align-top"
                                        rowSpan={provinceRowSpans[provinceKeyCheck]}
                                    >
                                        {row.Province}
                                    </td>
                                ) : null}

                                {showArea ? (
                                    <td
                                        className="px-2 py-1.5 border border-gray-300 align-top"
                                        rowSpan={areaRowSpans[areaKeyCheck]}
                                    >
                                        {row.Area}
                                    </td>
                                ) : null}

                                <td className="px-2 py-1.5 border border-gray-300">{row.CustomerName}</td>
                                <td className="px-2 py-1.5 border border-gray-300">{row.AccountNumber}</td>
                                <td className="px-2 py-1.5 text-right border border-gray-300">
                                    {formatNumber(row.PanelCapacity, 2)}
                                </td>
                                <td className="px-2 py-1.5 text-right border border-gray-300">
                                    {formatNumber(row.EnergyExported, 0)}
                                </td>
                                <td className="px-2 py-1.5 text-right border border-gray-300">
                                    {formatNumber(row.EnergyImported, 0)}
                                </td>
                                <td className="px-2 py-1.5 border border-gray-300">{row.Tariff}</td>
                                <td className="px-2 py-1.5 text-right border border-gray-300">
                                    {formatNumber(row.BFUnits, 0)}
                                </td>
                                <td className="px-2 py-1.5 text-right border border-gray-300">
                                    {formatNumber(row.KwhCharge, 2)}
                                </td>
                                <td className="px-2 py-1.5 text-right border border-gray-300">
                                    {formatNumber(row.FixedCharge, 2)}
                                </td>
                                <td className="px-2 py-1.5 text-right border border-gray-300">
                                    {formatNumber(row.CFUnits, 0)}
                                </td>
                                <td className="px-2 py-1.5 text-right border border-gray-300">
                                    {formatNumber(row.Rate, 2)}
                                </td>
                                <td className="px-2 py-1.5 text-right border border-gray-300">
                                    {formatNumber(row.UnitSale, 0)}
                                </td>
                                <td className="px-2 py-1.5 text-right border border-gray-300">
                                    {formatNumber(row.KwhSales, 2)}
                                </td>
                                <td className="px-2 py-1.5 border border-gray-300">
                                    {row.BankCode || "-"}
                                </td>
                                <td className="px-2 py-1.5 border border-gray-300">
                                    {row.BranchCode || "-"}
                                </td>
                                <td className="px-2 py-1.5 border border-gray-300">
                                    {row.BankAccountNumber || "-"}
                                </td>
                                <td className="px-2 py-1.5 border border-gray-300 whitespace-nowrap">
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
                                <td className="px-2 py-1.5 border border-gray-300" colSpan={1}>
                                    Area Total
                                </td>

                                <td className="px-2 py-1.5 text-right border border-gray-300">
                                    {totals.count}
                                </td>
                                <td className="px-2 py-1.5 text-right border border-gray-300">
                                    {formatNumber(totals.panelCapacity, 2)}
                                </td>
                                <td className="px-2 py-1.5 text-right border border-gray-300">
                                    {formatNumber(totals.energyExported, 0)}
                                </td>
                                <td className="px-2 py-1.5 text-right border border-gray-300">
                                    {formatNumber(totals.energyImported, 0)}
                                </td>
                                <td className="px-2 py-1.5 border border-gray-300" colSpan={13}></td>
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
                            <td className="px-2 py-1.5 border border-gray-300" colSpan={2}>
                                Province Total
                            </td>

                            <td className="px-2 py-1.5 text-right border border-gray-300">
                                {totals.count}
                            </td>
                            <td className="px-2 py-1.5 text-right border border-gray-300">
                                {formatNumber(totals.panelCapacity, 2)}
                            </td>
                            <td className="px-2 py-1.5 text-right border border-gray-300">
                                {formatNumber(totals.energyExported, 0)}
                            </td>
                            <td className="px-2 py-1.5 text-right border border-gray-300">
                                {formatNumber(totals.energyImported, 0)}
                            </td>
                            <td className="px-2 py-1.5 border border-gray-300" colSpan={13}></td>
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
                        <td className="px-2 py-1.5 border border-gray-300" colSpan={3}>
                            Division Total
                        </td>

                        <td className="px-2 py-1.5 text-right border border-gray-300">
                            {totals.count}
                        </td>
                        <td className="px-2 py-1.5 text-right border border-gray-300">
                            {formatNumber(totals.panelCapacity, 2)}
                        </td>
                        <td className="px-2 py-1.5 text-right border border-gray-300">
                            {formatNumber(totals.energyExported, 0)}
                        </td>
                        <td className="px-2 py-1.5 text-right border border-gray-300">
                            {formatNumber(totals.energyImported, 0)}
                        </td>
                        <td className="px-2 py-1.5 border border-gray-300" colSpan={13}></td>
                    </tr>
                );
                rowIndex++;
            }
        });

        return (
            <table className="min-w-full text-xs border-collapse">
                <thead>
                    <tr className="bg-gray-200">
                        <th className="px-2 py-2 text-left border border-gray-300 font-semibold">Division</th>
                        <th className="px-2 py-2 text-left border border-gray-300 font-semibold">Province</th>
                        <th className="px-2 py-2 text-left border border-gray-300 font-semibold">Area</th>
                        <th className="px-2 py-2 text-left border border-gray-300 font-semibold">Name of Customer</th>
                        <th className="px-2 py-2 text-left border border-gray-300 font-semibold">A/C No.</th>
                        <th className="px-2 py-2 text-right border border-gray-300 font-semibold">Panel Capacity (kW)</th>
                        <th className="px-2 py-2 text-right border border-gray-300 font-semibold">Energy Exported (kWh)</th>
                        <th className="px-2 py-2 text-right border border-gray-300 font-semibold">Energy Imported (kWh)</th>
                        <th className="px-2 py-2 text-left border border-gray-300 font-semibold">Tariff</th>
                        <th className="px-2 py-2 text-right border border-gray-300 font-semibold">BF Units</th>
                        <th className="px-2 py-2 text-right border border-gray-300 font-semibold">KWH Charge</th>
                        <th className="px-2 py-2 text-right border border-gray-300 font-semibold">Fixed Charge</th>
                        <th className="px-2 py-2 text-right border border-gray-300 font-semibold">CF Units</th>
                        <th className="px-2 py-2 text-right border border-gray-300 font-semibold">Rate</th>
                        <th className="px-2 py-2 text-right border border-gray-300 font-semibold">Units Sale</th>
                        <th className="px-2 py-2 text-right border border-gray-300 font-semibold">KWH Sales</th>
                        <th className="px-2 py-2 text-left border border-gray-300 font-semibold">Bank Code</th>
                        <th className="px-2 py-2 text-left border border-gray-300 font-semibold">Branch Code</th>
                        <th className="px-2 py-2 text-left border border-gray-300 font-semibold">Bank Account Number</th>
                        <th className="px-2 py-2 text-left border border-gray-300 font-semibold">Agreement Date</th>

                    </tr>
                </thead>
                <tbody>
                    {tableRows}
                </tbody>
            </table>
        );
    };

    return (
        <div className="p-6 bg-white rounded-lg shadow-md">
            {!reportVisible && (
                <>
                    {/* Header */}
                    <div className="mb-6">
                        <h2 className={`text-xl font-bold ${maroon}`}>
                            Solar Payment Information For Current Month - Bulk
                        </h2>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* First Row - 3 Dropdowns */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Select Month Dropdown */}
                            <div className="flex flex-col">
                                <label className={`text-xs font-medium mb-1 ${maroon}`}>
                                    Select Month:
                                </label>
                                {isLoadingBillCycles ? (
                                    <div className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md bg-gray-50 text-gray-500">
                                        Loading bill cycles...
                                    </div>
                                ) : billCycleError ? (
                                    <div className="w-full px-2 py-1.5 text-xs border border-red-300 rounded-md bg-red-50 text-red-600">
                                        {billCycleError}
                                    </div>
                                ) : (
                                    <select
                                        value={billCycle}
                                        onChange={(e) => setBillCycle(e.target.value)}
                                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent"
                                        required
                                    >
                                        <option value="">Select Month</option>
                                        {billCycleOptions.map((option) => (
                                            <option key={option.code} value={option.code}>
                                                {option.display}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            {/* Select Report Category Dropdown */}
                            <div className="flex flex-col">
                                <label
                                    className={`text-xs font-medium mb-1 ${!billCycle ? "text-gray-400" : maroon
                                        }`}
                                >
                                    Select Report Category:
                                </label>
                                <select
                                    value={reportCategory}
                                    onChange={(e) => setReportCategory(e.target.value)}
                                    className={`w-full px-2 py-1.5 text-xs border rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent ${!billCycle
                                        ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                                        : "border-gray-300"
                                        }`}
                                    disabled={!billCycle}
                                    required
                                >
                                    {allowedCategories.map((cat) => (
                                        <option key={cat} value={cat === "Region" ? "Division" : cat}>
                                            {cat === "Region" ? "Division" : cat}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Select Area/Province/Division/Entire CEB Dropdown */}
                            {reportCategory !== "Entire CEB" && (
                                <div className="flex flex-col">
                                    <label
                                        className={`text-xs font-medium mb-1 ${isCategoryValueDisabled() ? "text-gray-400" : maroon
                                            }`}
                                    >
                                        Select {reportCategory}:
                                    </label>
                                    {reportCategory === "Area" && (
                                        <>
                                            {locked["Area"] ? (
                                                <select
                                                    disabled
                                                    value={locked["Area"].code}
                                                    className="w-full px-2 py-1.5 text-xs border rounded-md bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                                                >
                                                    <option value={locked["Area"].code}>
                                                        {locked["Area"].name ? `${locked["Area"].code} - ${locked["Area"].name}` : locked["Area"].code}
                                                    </option>
                                                </select>
                                            ) : isLoadingAreas ? (
                                                <div className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md bg-gray-50 text-gray-500">
                                                    Loading areas...
                                                </div>
                                            ) : areaError ? (
                                                <div className="w-full px-2 py-1.5 text-xs border border-red-300 rounded-md bg-red-50 text-red-600">
                                                    {areaError}
                                                </div>
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
                                                    {areas.map((area) => (
                                                        <option key={area.AreaCode} value={area.AreaCode}>
                                                            {area.AreaCode} - {area.AreaName}
                                                        </option>
                                                    ))}
                                                </select>
                                            )}
                                        </>
                                    )}
                                    {reportCategory === "Province" && (
                                        <>
                                            {locked["Province"] ? (
                                                <select
                                                    disabled
                                                    value={locked["Province"].code}
                                                    className="w-full px-2 py-1.5 text-xs border rounded-md bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                                                >
                                                    <option value={locked["Province"].code}>
                                                        {locked["Province"].name ? `${locked["Province"].code} - ${locked["Province"].name}` : locked["Province"].code}
                                                    </option>
                                                </select>
                                            ) : isLoadingProvinces ? (
                                                <div className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md bg-gray-50 text-gray-500">
                                                    Loading provinces...
                                                </div>
                                            ) : provinceError ? (
                                                <div className="w-full px-2 py-1.5 text-xs border border-red-300 rounded-md bg-red-50 text-red-600">
                                                    {provinceError}
                                                </div>
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
                                                    className={`w-full px-2 py-1.5 text-xs border rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent ${isCategoryValueDisabled()
                                                        ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                                                        : "border-gray-300"
                                                        }`}
                                                    required
                                                    disabled={isCategoryValueDisabled()}
                                                >
                                                    <option value="">Select Province</option>
                                                    {provinces.map((province) => (
                                                        <option key={province.ProvinceCode} value={province.ProvinceCode}>
                                                            {province.ProvinceCode} - {province.ProvinceName}
                                                        </option>
                                                    ))}
                                                </select>
                                            )}
                                        </>
                                    )}
                                    {reportCategory === "Division" && (
                                        <>
                                            {locked["Region"] ? (
                                                <select
                                                    disabled
                                                    value={locked["Region"].code}
                                                    className="w-full px-2 py-1.5 text-xs border rounded-md bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                                                >
                                                    <option value={locked["Region"].code}>{locked["Region"].code}</option>
                                                </select>
                                            ) : isLoadingDivisions ? (
                                                <div className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md bg-gray-50 text-gray-500">
                                                    Loading divisions...
                                                </div>
                                            ) : divisionError ? (
                                                <div className="w-full px-2 py-1.5 text-xs border border-red-300 rounded-md bg-red-50 text-red-600">
                                                    {divisionError}
                                                </div>
                                            ) : (
                                                <select
                                                    value={categoryValue}
                                                    onChange={(e) => {
                                                        const selectedDivisionCode = e.target.value;
                                                        setCategoryValue(selectedDivisionCode);
                                                        setSelectedCategoryName(selectedDivisionCode);
                                                    }}
                                                    className={`w-full px-2 py-1.5 text-xs border rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent ${isCategoryValueDisabled()
                                                        ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                                                        : "border-gray-300"
                                                        }`}
                                                    required
                                                    disabled={isCategoryValueDisabled()}
                                                >
                                                    <option value="">Select Division</option>
                                                    {divisions.map((division) => (
                                                        <option key={division.RegionCode} value={division.RegionCode}>
                                                            {formatDivisionOption(division)}
                                                        </option>
                                                    ))}
                                                </select>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Placeholder for Entire CEB to maintain grid layout */}
                            {reportCategory === "Entire CEB" && (
                                <div className="flex flex-col">
                                    {/* Empty div to maintain 3-column grid */}
                                </div>
                            )}
                        </div>

                        {/* Second Row - Net Type Dropdown */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                                    onChange={(e) => setNetType(e.target.value)}
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
                                Solar Payment Information For Current Month - Bulk
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

export default SolarPaymentBulk;