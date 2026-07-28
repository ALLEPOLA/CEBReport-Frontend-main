import React, { useState, useEffect, useRef, JSX } from "react";
import { Download, Printer } from "lucide-react";
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

interface PVCapacityData {
    NetType: string;
    Division: string;
    Province: string;
    Area: string;
    NoOfConsumers: number;
    Capacity: number;
}

const SolarPVCapacityInformation: React.FC = () => {
    const maroon = "text-[#7A0000]";
    const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";

    const [customerType, setCustomerType] = useState<string>("");
    const [calendarMonth, setCalendarMonth] = useState<string>("");
    const [selectedCategory, setSelectedCategory] = useState<string>("Area");
    const [categoryValue, setCategoryValue] = useState<string>("");
    const [loading, setLoading] = useState(false);

    // Data states
    const [areas, setAreas] = useState<Area[]>([]);
    const [provinces, setProvinces] = useState<Province[]>([]);
    const [divisions, setDivisions] = useState<Division[]>([]);
    const [monthOptions, setMonthOptions] = useState<BillCycleOption[]>([]);

    // Loading states
    const [isLoadingAreas, setIsLoadingAreas] = useState(false);
    const [isLoadingProvinces, setIsLoadingProvinces] = useState(false);
    const [isLoadingDivisions, setIsLoadingDivisions] = useState(false);
    const [isLoadingMonths, setIsLoadingMonths] = useState(false);

    // Error states
    const [areaError, setAreaError] = useState<string | null>(null);
    const [provinceError, setProvinceError] = useState<string | null>(null);
    const [divisionError, setDivisionError] = useState<string | null>(null);
    const [monthError, setMonthError] = useState<string | null>(null);
    const [reportError, setReportError] = useState<string | null>(null);

    // Display states
    const [selectedCategoryName, setSelectedCategoryName] = useState<string>("");
    const [selectedMonthDisplay, setSelectedMonthDisplay] = useState<string>("");
    const [reportVisible, setReportVisible] = useState(false);

    // Report data
    const [pvCapacityData, setPvCapacityData] = useState<PVCapacityData[]>([]);
    const [uniqueNetTypes, setUniqueNetTypes] = useState<string[]>([]);

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

    // Generate month options
    const generateMonthOptions = (cycles: string[], maxCycle: string): BillCycleOption[] => {
        const maxCycleNum = parseInt(maxCycle);
        return cycles.map((cycle, index) => ({
            display: cycle,
            code: (maxCycleNum - index).toString(),
        }));
    };

    // Extract unique net types from data
    const extractUniqueNetTypes = (data: PVCapacityData[]): string[] => {
        const netTypes = [...new Set(data.map(item => item.NetType))];

        // Define the desired order
        const orderPriority: { [key: string]: number } = {
            "Net Metering": 1,
            "Net Accounting": 2,
            "Net Plus": 3,
            "Net Plus Plus": 4,
            "Convert from Net Metering to Net Accounting": 5
        };

        // Sort net types based on priority, unknown types go to the end
        return netTypes.sort((a, b) => {
            const priorityA = orderPriority[a] || 999;
            const priorityB = orderPriority[b] || 999;

            if (priorityA !== priorityB) {
                return priorityA - priorityB;
            }
            // If both have no priority or same priority, sort alphabetically
            return a.localeCompare(b);
        });
    };

    // Sort data hierarchically
    const sortDataHierarchically = (data: PVCapacityData[]): PVCapacityData[] => {
        return [...data].sort((a, b) => {
            if (a.Division !== b.Division) return a.Division.localeCompare(b.Division);
            if (a.Province !== b.Province) return a.Province.localeCompare(b.Province);
            if (a.Area !== b.Area) return a.Area.localeCompare(b.Area);
            return a.NetType.localeCompare(b.NetType);
        });
    };

    const formatNumber = (value: number): string => {
        return value.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
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
                setAreaError(err.message || "Failed to load areas. Please try again later.");
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
                const sortedProvinces = (provinceData.data || []).sort((a: Province, b: Province) =>
                    a.ProvinceName.localeCompare(b.ProvinceName)
                );
                setProvinces(sortedProvinces);
            } catch (err: any) {
                console.error("Error fetching provinces:", err);
                setProvinceError(err.message || "Failed to load provinces. Please try again later.");
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
                    (a: Division, b: Division) => a.RegionCode.localeCompare(b.RegionCode)
                );
                setDivisions(sortedDivisions);
            } catch (err: any) {
                console.error("Error fetching divisions:", err);
                setDivisionError(err.message || "Failed to load divisions. Please try again later.");
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

    // Fetch calendar months
    useEffect(() => {
        const fetchMonths = async () => {
            setIsLoadingMonths(true);
            setMonthError(null);
            setMonthOptions([]);
            setCalendarMonth("");
            setSelectedMonthDisplay("");

            try {
                const monthData = await fetchWithErrorHandling(
                    "/misapi/api/ordinary/netprogrs/billcycle/max"
                );
                if (monthData.data && monthData.data.BillCycles?.length > 0) {
                    const options = generateMonthOptions(
                        monthData.data.BillCycles,
                        monthData.data.MaxBillCycle
                    );
                    setMonthOptions(options);
                } else {
                    setMonthOptions([]);
                }
            } catch (err: any) {
                console.error("Error fetching months:", err);
                setMonthError(err.message || "Failed to load months. Please try again later.");
            } finally {
                setIsLoadingMonths(false);
            }
        };

        fetchMonths();
    }, []);

    const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        setSelectedCategory(value);
        setCategoryValue("");
        setSelectedCategoryName("");
    };

    const downloadAsCSV = () => {
        if (!pvCapacityData.length) return;

        const reportTitle = "Progress of Battle For Solar Energy";
        const selectionInfo =
            selectedCategory === "Entire CEB"
                ? "Entire CEB"
                : selectedCategory === "Area"
                    ? `${selectedCategory}: ${selectedCategoryName}`
                    : `${selectedCategory}: ${categoryValue}`;

        // Build dynamic headers - Two rows to match table structure
        // Row 1: Division, Province, Area, then each NetType (spanning 2 columns), then Total (spanning 2 columns)
        const headerRow1 = ["Division", "Province", "Area"];
        uniqueNetTypes.forEach(netType => {
            headerRow1.push(netType);
            headerRow1.push(""); // Empty cell for colspan representation
        });
        headerRow1.push("Total");
        headerRow1.push(""); // Empty cell for colspan representation

        // Row 2: Empty for Division/Province/Area, then "No of Consumers" and "Capacity (KW)" for each NetType and Total
        const headerRow2 = ["", "", ""]; // Empty cells under Division, Province, Area (they span 2 rows)
        uniqueNetTypes.forEach(() => {
            headerRow2.push("No of Consumers");
            headerRow2.push("Capacity (KW)");
        });
        headerRow2.push("No of Consumers");
        headerRow2.push("Capacity (KW)");

        const sortedData = sortDataHierarchically(pvCapacityData);

        const uniqueDivisions = [...new Set(sortedData.map(item => item.Division))];

        const divisionGroups: { [key: string]: typeof sortedData } = {};
        const provinceGroups: { [key: string]: typeof sortedData } = {};
        const areaGroups: { [key: string]: typeof sortedData } = {};

        sortedData.forEach((item) => {
            const divisionKey = item.Division;
            const provinceKey = `${item.Division}-${item.Province}`;
            const areaKey = `${item.Division}-${item.Province}-${item.Area}`;

            if (!divisionGroups[divisionKey]) divisionGroups[divisionKey] = [];
            divisionGroups[divisionKey].push(item);

            if (!provinceGroups[provinceKey]) provinceGroups[provinceKey] = [];
            provinceGroups[provinceKey].push(item);

            if (!areaGroups[areaKey]) areaGroups[areaKey] = [];
            areaGroups[areaKey].push(item);
        });

        const calculateTotals = (items: typeof sortedData) => {
            const netTypeTotals: { [netType: string]: { consumers: number; capacity: number } } = {};
            let overallTotal = { consumers: 0, capacity: 0 };

            items.forEach((item) => {
                if (!netTypeTotals[item.NetType]) {
                    netTypeTotals[item.NetType] = { consumers: 0, capacity: 0 };
                }
                netTypeTotals[item.NetType].consumers += item.NoOfConsumers;
                netTypeTotals[item.NetType].capacity += item.Capacity;
                overallTotal.consumers += item.NoOfConsumers;
                overallTotal.capacity += item.Capacity;
            });

            return { netTypeTotals, overallTotal };
        };

        const createTotalRow = (label: string, netTypeTotals: any, overallTotal: any, colspan: number) => {
            const row = [];
            if (colspan === 1) {
                // Province Total - only label in first column
                row.push(label);
            } else if (colspan === 2) {
                // Division Total - label spans first two columns, so second column is empty
                row.push(label);
                row.push("");
            } else {
                row.push(label);
            }

            // For Province Total (colspan=1), we need empty Province and Area columns
            // For Division Total (colspan=2), we need empty Area column
            if (colspan === 1) {
                row.push(""); // Empty Province column
            }
            row.push(""); // Empty Area column

            uniqueNetTypes.forEach(netType => {
                row.push((netTypeTotals[netType]?.consumers || 0).toString());
                row.push((netTypeTotals[netType]?.capacity || 0).toFixed(2));
            });
            row.push(overallTotal.consumers.toString());
            row.push(overallTotal.capacity.toFixed(2));
            return row;
        };

        const rows: any[] = [];
        let currentDivision = "";
        let currentProvince = "";

        uniqueDivisions.forEach((division) => {
            const provincesInDivision = Object.keys(provinceGroups).filter(pk => pk.startsWith(`${division}-`));

            provincesInDivision.forEach((provinceKey) => {
                const [] = provinceKey.split('-');
                const areasInProvince = Object.keys(areaGroups).filter(ak => ak.startsWith(`${provinceKey}-`));

                areasInProvince.forEach((areaKey) => {
                    const items = areaGroups[areaKey];
                    const firstItem = items[0];

                    const divisionKey = firstItem.Division;
                    const provinceKeyForCheck = `${firstItem.Division}-${firstItem.Province}`;

                    const showDivision = currentDivision !== divisionKey;
                    const showProvince = currentProvince !== provinceKeyForCheck;

                    if (showDivision) {
                        currentDivision = divisionKey;
                        currentProvince = "";
                    }

                    if (showProvince) {
                        currentProvince = provinceKeyForCheck;
                    }

                    const netTypeMap: { [key: string]: { consumers: number; capacity: number } } = {};
                    let areaTotal = { consumers: 0, capacity: 0 };

                    items.forEach((item) => {
                        netTypeMap[item.NetType] = {
                            consumers: item.NoOfConsumers,
                            capacity: item.Capacity
                        };
                        areaTotal.consumers += item.NoOfConsumers;
                        areaTotal.capacity += item.Capacity;
                    });

                    // Show Division and Province only for first occurrence (to match table rowspan behavior)
                    const row = [
                        showDivision ? firstItem.Division : "",
                        showProvince ? firstItem.Province : "",
                        firstItem.Area
                    ];

                    uniqueNetTypes.forEach(netType => {
                        row.push(netTypeMap[netType]?.consumers.toString() || "");
                        row.push(netTypeMap[netType]?.capacity.toFixed(2) || "");
                    });
                    row.push(areaTotal.consumers.toString());
                    row.push(areaTotal.capacity.toFixed(2));

                    rows.push(row);
                });

                if (areasInProvince.length > 1) {
                    const { netTypeTotals, overallTotal } = calculateTotals(provinceGroups[provinceKey]);
                    rows.push(createTotalRow("Province Total", netTypeTotals, overallTotal, 1));
                }
            });

            if (provincesInDivision.length > 1) {
                const { netTypeTotals, overallTotal } = calculateTotals(divisionGroups[division]);
                rows.push(createTotalRow("Division Total", netTypeTotals, overallTotal, 2));
            }
        });

        const csvContent = [
            reportTitle,
            selectionInfo,
            `Calendar Month: ${selectedMonthDisplay}`,
            `Customer Type: ${customerType}`,
            `Generated: ${new Date().toLocaleDateString()}`,
            "",
            headerRow1.map((h) => `"${h}"`).join(","),
            headerRow2.map((h) => `"${h}"`).join(","),
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
                `SolarPVCapacity_${fileDescriptor}_${customerType}_${calendarMonth}.csv`
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
        const reportTitle = "PROGRESS OF BATTLE FOR SOLAR ENERGY";
        const categoryInfo = (() => {
            if (selectedCategory === "Entire CEB") {
                return "Entire CEB";
            } else if (selectedCategory === "Area") {
                return `${selectedCategory}: <span class="bold">${selectedCategoryName}</span>`;
            } else {
                return `${selectedCategory}: <span class="bold">${categoryValue}</span>`;
            }
        })();
        const selectionInfo = `${categoryInfo}<br>Calendar Month: <span class="bold">${selectedMonthDisplay}</span><br>Customer Type: <span class="bold">${customerType}</span>`;

        // Generate the exact same table structure as displayed
        const sortedData = sortDataHierarchically(pvCapacityData);
        const uniqueDivisions = [...new Set(sortedData.map(item => item.Division))];

        const divisionGroups: { [key: string]: typeof sortedData } = {};
        const provinceGroups: { [key: string]: typeof sortedData } = {};
        const areaGroups: { [key: string]: typeof sortedData } = {};

        sortedData.forEach((item) => {
            const divisionKey = item.Division;
            const provinceKey = `${item.Division}-${item.Province}`;
            const areaKey = `${item.Division}-${item.Province}-${item.Area}`;

            if (!divisionGroups[divisionKey]) divisionGroups[divisionKey] = [];
            divisionGroups[divisionKey].push(item);

            if (!provinceGroups[provinceKey]) provinceGroups[provinceKey] = [];
            provinceGroups[provinceKey].push(item);

            if (!areaGroups[areaKey]) areaGroups[areaKey] = [];
            areaGroups[areaKey].push(item);
        });

        const divisionRowSpans: { [key: string]: number } = {};
        const provinceRowSpans: { [key: string]: number } = {};
        const areaRowCounts: { [key: string]: number } = {};

        uniqueDivisions.forEach((division) => {
            let count = 0;
            const provincesInDiv = Object.keys(provinceGroups).filter(pk => pk.startsWith(`${division}-`));

            provincesInDiv.forEach((provinceKey) => {
                const areasInProv = Object.keys(areaGroups).filter(ak => ak.startsWith(`${provinceKey}-`));
                count += areasInProv.length;

                if (areasInProv.length > 1) {
                    count += 1;
                }
            });

            if (provincesInDiv.length > 1) {
                count += 1;
            }

            divisionRowSpans[division] = count;
        });

        Object.keys(provinceGroups).forEach((provinceKey) => {
            const areasInProv = Object.keys(areaGroups).filter(ak => ak.startsWith(`${provinceKey}-`));
            let count = areasInProv.length;

            if (areasInProv.length > 1) {
                count += 1;
            }

            provinceRowSpans[provinceKey] = count;
        });

        Object.keys(areaGroups).forEach((areaKey) => {
            areaRowCounts[areaKey] = 1;
        });

        const calculateTotals = (items: typeof sortedData) => {
            const netTypeTotals: { [netType: string]: { consumers: number; capacity: number } } = {};
            let overallTotal = { consumers: 0, capacity: 0 };

            items.forEach((item) => {
                if (!netTypeTotals[item.NetType]) {
                    netTypeTotals[item.NetType] = { consumers: 0, capacity: 0 };
                }
                netTypeTotals[item.NetType].consumers += item.NoOfConsumers;
                netTypeTotals[item.NetType].capacity += item.Capacity;
                overallTotal.consumers += item.NoOfConsumers;
                overallTotal.capacity += item.Capacity;
            });

            return { netTypeTotals, overallTotal };
        };

        const renderTotalRowHTML = (label: string, netTypeTotals: any, overallTotal: any, bgColor: string, colspan: number) => {
            let cells = `<td class="text-center font-bold" colspan="${colspan}">${label}</td>`;

            uniqueNetTypes.forEach(netType => {
                cells += `
                    <td class="text-right">${(netTypeTotals[netType]?.consumers || 0).toLocaleString()}</td>
                    <td class="text-right">${formatNumber(netTypeTotals[netType]?.capacity || 0)}</td>
                `;
            });

            cells += `
                <td class="text-right">${overallTotal.consumers.toLocaleString()}</td>
                <td class="text-right">${formatNumber(overallTotal.capacity)}</td>
            `;

            return `<tr class="${bgColor}">${cells}</tr>`;
        };

        let tableRows = '';
        let rowIndex = 0;
        let currentDivision = "";
        let currentProvince = "";
        let currentArea = "";

        uniqueDivisions.forEach((division) => {
            const provincesInDivision = Object.keys(provinceGroups).filter(pk => pk.startsWith(`${division}-`));

            provincesInDivision.forEach((provinceKey) => {
                const [] = provinceKey.split('-');
                const areasInProvince = Object.keys(areaGroups).filter(ak => ak.startsWith(`${provinceKey}-`));

                areasInProvince.forEach((areaKey) => {
                    const items = areaGroups[areaKey];
                    const firstItem = items[0];

                    const divisionKey = firstItem.Division;
                    const provinceKeyForCheck = `${firstItem.Division}-${firstItem.Province}`;
                    const areaKeyForCheck = `${firstItem.Division}-${firstItem.Province}-${firstItem.Area}`;

                    const showDivision = currentDivision !== divisionKey;
                    const showProvince = currentProvince !== provinceKeyForCheck;
                    const showArea = currentArea !== areaKeyForCheck;

                    if (showDivision) {
                        currentDivision = divisionKey;
                        currentProvince = "";
                        currentArea = "";
                    }

                    if (showProvince) {
                        currentProvince = provinceKeyForCheck;
                        currentArea = "";
                    }

                    if (showArea) {
                        currentArea = areaKeyForCheck;
                    }

                    const netTypeMap: { [key: string]: { consumers: number; capacity: number } } = {};
                    let areaTotal = { consumers: 0, capacity: 0 };

                    items.forEach((item) => {
                        netTypeMap[item.NetType] = {
                            consumers: item.NoOfConsumers,
                            capacity: item.Capacity
                        };
                        areaTotal.consumers += item.NoOfConsumers;
                        areaTotal.capacity += item.Capacity;
                    });

                    const rowClass = rowIndex % 2 === 0 ? 'row-even' : 'row-odd';
                    let row = `<tr class="${rowClass}">`;

                    if (showDivision) {
                        row += `<td class="font-medium" rowspan="${divisionRowSpans[divisionKey]}">${firstItem.Division}</td>`;
                    }

                    if (showProvince) {
                        row += `<td rowspan="${provinceRowSpans[provinceKeyForCheck]}">${firstItem.Province}</td>`;
                    }

                    if (showArea) {
                        row += `<td rowspan="${areaRowCounts[areaKeyForCheck]}">${firstItem.Area}</td>`;
                    }

                    uniqueNetTypes.forEach(netType => {
                        row += `
                            <td class="text-right">${netTypeMap[netType]?.consumers.toLocaleString() || ""}</td>
                            <td class="text-right">${netTypeMap[netType] ? formatNumber(netTypeMap[netType].capacity) : ""}</td>
                        `;
                    });

                    row += `
                        <td class="text-right font-bold">${areaTotal.consumers.toLocaleString()}</td>
                        <td class="text-right font-bold">${formatNumber(areaTotal.capacity)}</td>
                    </tr>`;

                    tableRows += row;
                    rowIndex++;
                });

                if (areasInProvince.length > 1) {
                    const { netTypeTotals, overallTotal } = calculateTotals(provinceGroups[provinceKey]);
                    tableRows += renderTotalRowHTML('Province Total', netTypeTotals, overallTotal, 'province-total', 1);
                    rowIndex++;
                }
            });

            if (provincesInDivision.length > 1) {
                const { netTypeTotals, overallTotal } = calculateTotals(divisionGroups[division]);
                tableRows += renderTotalRowHTML('Division Total', netTypeTotals, overallTotal, 'division-total', 2);
                rowIndex++;
            }
        });

        let headerRow1 = `
            <tr>
                <th rowspan="2">Division</th>
                <th rowspan="2">Province</th>
                <th rowspan="2">Area</th>`;

        uniqueNetTypes.forEach(netType => {
            headerRow1 += `<th colspan="2">${netType}</th>`;
        });

        headerRow1 += `<th colspan="2">Total</th></tr>`;

        let headerRow2 = '<tr>';
        uniqueNetTypes.forEach(() => {
            headerRow2 += `
                <th>No of Consumers</th>
                <th>Capacity (KW)</th>
            `;
        });
        headerRow2 += `
            <th>No of Consumers</th>
            <th>Capacity (KW)</th>
        </tr>`;

        const printWindow = window.open("", "_blank");
        if (!printWindow) return;

        printWindow.document.write(`
      <html>
        <head>
          <title>Solar PV Capacity Report</title>
          <style>
            body { font-family: Arial; font-size: 9px; margin: 10mm; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { padding: 3px 4px; border: 1px solid #ddd; font-size: 9px; vertical-align: middle;}
            .text-left { text-align: left; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .header { 
              font-weight: bold; 
              margin-bottom: 5px; 
              color: #7A0000;
              font-size: 12px;
            }
            .subheader { 
              margin-bottom: 12px; 
              font-size: 10px;
            }
            .footer { 
              margin-top: 10px; 
              font-size: 8px; 
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
            .row-even {
              background-color: #ffffff;
            }
            .row-odd {
              background-color: #f9f9f9;
            }
            .bold, .font-bold {
              font-weight: bold;
            }
            .font-medium {
              font-weight: 500;
            }
            .province-total {
              background-color: #dbeafe;
              font-weight: bold;
            }
            .division-total {
              background-color: #dcfce7;
              font-weight: bold;
            }
            @media print {
              body { margin: 5mm; }
              table { page-break-inside: auto; }
              tr { page-break-inside: avoid; page-break-after: auto; }
            }
          </style>
        </head>
        <body>
          <div class="header">${reportTitle}</div>
          <div class="subheader">
            ${selectionInfo}
          </div>
          <table>
            <thead>
              ${headerRow1}
              ${headerRow2}
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
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

    const renderPVCapacityTable = () => {
        const sortedData = sortDataHierarchically(pvCapacityData);

        const uniqueDivisions = [...new Set(sortedData.map(item => item.Division))];

        const divisionGroups: { [key: string]: typeof sortedData } = {};
        const provinceGroups: { [key: string]: typeof sortedData } = {};
        const areaGroups: { [key: string]: typeof sortedData } = {};

        sortedData.forEach((item) => {
            const divisionKey = item.Division;
            const provinceKey = `${item.Division}-${item.Province}`;
            const areaKey = `${item.Division}-${item.Province}-${item.Area}`;

            if (!divisionGroups[divisionKey]) divisionGroups[divisionKey] = [];
            divisionGroups[divisionKey].push(item);

            if (!provinceGroups[provinceKey]) provinceGroups[provinceKey] = [];
            provinceGroups[provinceKey].push(item);

            if (!areaGroups[areaKey]) areaGroups[areaKey] = [];
            areaGroups[areaKey].push(item);
        });

        const divisionRowSpans: { [key: string]: number } = {};
        const provinceRowSpans: { [key: string]: number } = {};
        const areaRowCounts: { [key: string]: number } = {};

        uniqueDivisions.forEach((division) => {
            let count = 0;
            const provincesInDiv = Object.keys(provinceGroups).filter(pk => pk.startsWith(`${division}-`));

            provincesInDiv.forEach((provinceKey) => {
                const areasInProv = Object.keys(areaGroups).filter(ak => ak.startsWith(`${provinceKey}-`));
                count += areasInProv.length;

                if (areasInProv.length > 1) {
                    count += 1;
                }
            });

            if (provincesInDiv.length > 1) {
                count += 1;
            }

            divisionRowSpans[division] = count;
        });

        Object.keys(provinceGroups).forEach((provinceKey) => {
            const areasInProv = Object.keys(areaGroups).filter(ak => ak.startsWith(`${provinceKey}-`));
            let count = areasInProv.length;

            if (areasInProv.length > 1) {
                count += 1;
            }

            provinceRowSpans[provinceKey] = count;
        });

        Object.keys(areaGroups).forEach((areaKey) => {
            areaRowCounts[areaKey] = 1;
        });

        const calculateTotals = (items: typeof sortedData) => {
            const netTypeTotals: { [netType: string]: { consumers: number; capacity: number } } = {};
            let overallTotal = { consumers: 0, capacity: 0 };

            items.forEach((item) => {
                if (!netTypeTotals[item.NetType]) {
                    netTypeTotals[item.NetType] = { consumers: 0, capacity: 0 };
                }
                netTypeTotals[item.NetType].consumers += item.NoOfConsumers;
                netTypeTotals[item.NetType].capacity += item.Capacity;
                overallTotal.consumers += item.NoOfConsumers;
                overallTotal.capacity += item.Capacity;
            });

            return { netTypeTotals, overallTotal };
        };

        const renderTotalRow = (label: string, netTypeTotals: any, overallTotal: any, bgColor: string = "bg-yellow-50", colspan: number = 3) => {
            return (
                <tr className={`${bgColor} font-semibold`}>
                    <td className="border border-gray-300 px-2 py-1 text-center" colSpan={colspan}>
                        {label}
                    </td>
                    {uniqueNetTypes.map(netType => (
                        <React.Fragment key={netType}>
                            <td className="border border-gray-300 px-2 py-1 text-right">
                                {(netTypeTotals[netType]?.consumers || 0).toLocaleString()}
                            </td>
                            <td className="border border-gray-300 px-2 py-1 text-right">
                                {formatNumber(netTypeTotals[netType]?.capacity || 0)}
                            </td>
                        </React.Fragment>
                    ))}
                    <td className="border border-gray-300 px-2 py-1 text-right">
                        {overallTotal.consumers.toLocaleString()}
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-right">
                        {formatNumber(overallTotal.capacity)}
                    </td>
                </tr>
            );
        };

        const rows: JSX.Element[] = [];
        let rowIndex = 0;
        let currentDivision = "";
        let currentProvince = "";
        let currentArea = "";

        uniqueDivisions.forEach((division) => {
            const provincesInDivision = Object.keys(provinceGroups).filter(pk => pk.startsWith(`${division}-`));

            provincesInDivision.forEach((provinceKey) => {
                const [] = provinceKey.split('-');
                const areasInProvince = Object.keys(areaGroups).filter(ak => ak.startsWith(`${provinceKey}-`));

                areasInProvince.forEach((areaKey) => {
                    const items = areaGroups[areaKey];
                    const firstItem = items[0];

                    const divisionKey = firstItem.Division;
                    const provinceKeyForCheck = `${firstItem.Division}-${firstItem.Province}`;
                    const areaKeyForCheck = `${firstItem.Division}-${firstItem.Province}-${firstItem.Area}`;

                    const showDivision = currentDivision !== divisionKey;
                    const showProvince = currentProvince !== provinceKeyForCheck;
                    const showArea = currentArea !== areaKeyForCheck;

                    if (showDivision) {
                        currentDivision = divisionKey;
                        currentProvince = "";
                        currentArea = "";
                    }

                    if (showProvince) {
                        currentProvince = provinceKeyForCheck;
                        currentArea = "";
                    }

                    if (showArea) {
                        currentArea = areaKeyForCheck;
                    }

                    const netTypeMap: { [key: string]: { consumers: number; capacity: number } } = {};
                    let areaTotal = { consumers: 0, capacity: 0 };

                    items.forEach((item) => {
                        netTypeMap[item.NetType] = {
                            consumers: item.NoOfConsumers,
                            capacity: item.Capacity
                        };
                        areaTotal.consumers += item.NoOfConsumers;
                        areaTotal.capacity += item.Capacity;
                    });

                    rows.push(
                        <tr key={rowIndex} className={rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                            {showDivision ? (
                                <td
                                    className="border border-gray-300 px-2 py-1 align-top font-medium"
                                    rowSpan={divisionRowSpans[divisionKey]}
                                >
                                    {firstItem.Division}
                                </td>
                            ) : null}

                            {showProvince ? (
                                <td
                                    className="border border-gray-300 px-2 py-1 align-top"
                                    rowSpan={provinceRowSpans[provinceKeyForCheck]}
                                >
                                    {firstItem.Province}
                                </td>
                            ) : null}

                            {showArea ? (
                                <td
                                    className="border border-gray-300 px-2 py-1 align-top"
                                    rowSpan={areaRowCounts[areaKeyForCheck]}
                                >
                                    {firstItem.Area}
                                </td>
                            ) : null}

                            {uniqueNetTypes.map(netType => (
                                <React.Fragment key={netType}>
                                    <td className="border border-gray-300 px-2 py-1 text-right">
                                        {netTypeMap[netType]?.consumers.toLocaleString() || ""}
                                    </td>
                                    <td className="border border-gray-300 px-2 py-1 text-right">
                                        {netTypeMap[netType] ? formatNumber(netTypeMap[netType].capacity) : ""}
                                    </td>
                                </React.Fragment>
                            ))}

                            <td className="border border-gray-300 px-2 py-1 text-right font-semibold">
                                {areaTotal.consumers.toLocaleString()}
                            </td>
                            <td className="border border-gray-300 px-2 py-1 text-right font-semibold">
                                {formatNumber(areaTotal.capacity)}
                            </td>
                        </tr>
                    );
                    rowIndex++;
                });

                if (areasInProvince.length > 1) {
                    const { netTypeTotals, overallTotal } = calculateTotals(provinceGroups[provinceKey]);
                    rows.push(
                        <React.Fragment key={`province-total-${rowIndex}`}>
                            {renderTotalRow(`Province Total`, netTypeTotals, overallTotal, "bg-blue-50", 1)}
                        </React.Fragment>
                    );
                    rowIndex++;
                }
            });

            if (provincesInDivision.length > 1) {
                const { netTypeTotals, overallTotal } = calculateTotals(divisionGroups[division]);
                rows.push(
                    <React.Fragment key={`division-total-${rowIndex}`}>
                        {renderTotalRow(`Division Total`, netTypeTotals, overallTotal, "bg-green-50", 2)}
                    </React.Fragment>
                );
                rowIndex++;
            }
        });

        return (
            <table className="w-full border-collapse text-xs">
                <thead className="bg-gray-100">
                    <tr>
                        <th className="border border-gray-300 px-2 py-1 text-center" rowSpan={2}>Division</th>
                        <th className="border border-gray-300 px-2 py-1 text-center" rowSpan={2}>Province</th>
                        <th className="border border-gray-300 px-2 py-1 text-center" rowSpan={2}>Area</th>
                        {uniqueNetTypes.map(netType => (
                            <th key={netType} className="border border-gray-300 px-2 py-1 text-center" colSpan={2}>
                                {netType}
                            </th>
                        ))}
                        <th className="border border-gray-300 px-2 py-1 text-center" colSpan={2}>Total</th>
                    </tr>
                    <tr>
                        {uniqueNetTypes.map(netType => (
                            <React.Fragment key={netType}>
                                <th className="border border-gray-300 px-2 py-1 text-center">No of Consumers</th>
                                <th className="border border-gray-300 px-2 py-1 text-center">Capacity (KW)</th>
                            </React.Fragment>
                        ))}
                        <th className="border border-gray-300 px-2 py-1 text-center">No of Consumers</th>
                        <th className="border border-gray-300 px-2 py-1 text-center">Capacity (KW)</th>
                    </tr>
                </thead>
                <tbody>
                    {rows}
                </tbody>
            </table>
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setReportError(null);
        setPvCapacityData([]);
        setReportVisible(false);

        try {
            let validationError = "";

            if (!customerType) validationError = "Customer type is required";
            if (!calendarMonth) validationError = "Calendar month is required";
            if (selectedCategory !== "Entire CEB" && !categoryValue) {
                validationError = `${selectedCategory} is required`;
            }

            if (validationError) {
                throw new Error(validationError);
            }

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

            let endpoint = "";

            if (customerType === "Ordinary") {
                endpoint = `/misapi/solarapi/solarPVCapacity/ordinary?billCycle=${calendarMonth}&reportType=${reportTypeParam}`;
            } else if (customerType === "Bulk") {
                endpoint = `/misapi/solarapi/solarPVCapacity/bulk?billCycle=${calendarMonth}&reportType=${reportTypeParam}`;
            } else if (customerType === "Both") {
                endpoint = `/misapi/solarapi/solarPVCapacity/summary?billCycle=${calendarMonth}&reportType=${reportTypeParam}`;
            }

            if (selectedCategory !== "Entire CEB") {
                endpoint += `&typeCode=${typeCode}`;
            }

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
            const dataArray = Array.isArray(responseData) ? responseData : [responseData];

            if (dataArray.length === 0) {
                throw new Error("No data available for the selected criteria");
            }

            setPvCapacityData(dataArray);
            // Extract and set unique net types dynamically
            const netTypes = extractUniqueNetTypes(dataArray);
            setUniqueNetTypes(netTypes);
            setReportVisible(true);
        } catch (err: any) {
            console.error("Error in form submission:", err);
            if (err.message.includes("Failed to fetch")) {
                setReportError("Network error - please check your connection");
            } else {
                setReportError(err.message || "Failed to load PV capacity data");
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

    const isMonthDisabled = () => {
        return !customerType;
    };

    const isCategoryDisabled = () => {
        return !calendarMonth || isMonthDisabled();
    };

    const isCategoryValueDisabled = () => {
        if (selectedCategory === "Entire CEB") return true;
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

    const canSubmit = () => {
        if (!customerType || !calendarMonth) return false;
        if (selectedCategory !== "Entire CEB" && !categoryValue) return false;
        return true;
    };

    return (
        <div className="max-w-7xl mx-auto p-4 bg-white rounded-xl shadow border border-gray-200 text-sm font-sans">
            {!reportVisible && (
                <>
                    <h2 className={`text-xl font-bold mb-6 ${maroon}`}>
                        Progress of Battle For Solar Energy
                    </h2>

                    <form onSubmit={handleSubmit}>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                            {/* Customer Type Dropdown */}
                            <div className="flex flex-col">
                                <label className={`text-xs font-medium mb-1 ${maroon}`}>
                                    Select Customer Type:
                                </label>
                                <select
                                    value={customerType}
                                    onChange={(e) => setCustomerType(e.target.value)}
                                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent"
                                    required
                                >
                                    <option value="">Select Customer Type</option>
                                    <option value="Ordinary">Ordinary</option>
                                    <option value="Bulk">Bulk</option>
                                    <option value="Both">Both</option>
                                </select>
                            </div>

                            {/* Calendar Month Dropdown */}
                            <div className="flex flex-col">
                                <label
                                    className={`text-xs font-medium mb-1 ${isMonthDisabled() ? "text-gray-400" : maroon
                                        }`}
                                >
                                    Calendar Month:
                                </label>
                                {isLoadingMonths ? (
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
                                        <span className="ml-2 text-xs">Loading months...</span>
                                    </div>
                                ) : monthError ? (
                                    <div className="text-red-500 text-xs py-2">{monthError}</div>
                                ) : (
                                    <select
                                        value={calendarMonth}
                                        onChange={(e) => {
                                            const selectedCode = e.target.value;
                                            setCalendarMonth(selectedCode);
                                            const selectedOption = monthOptions.find(
                                                (option) => option.code === selectedCode
                                            );
                                            setSelectedMonthDisplay(
                                                selectedOption ? selectedOption.display : ""
                                            );
                                        }}
                                        className={`w-full px-2 py-1.5 text-xs border rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent
                      ${isMonthDisabled()
                                                ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                                                : "border-gray-300"
                                            }`}
                                        required
                                        disabled={isMonthDisabled()}
                                    >
                                        <option value="">Select Month</option>
                                        {monthOptions.map((option) => (
                                            <option key={option.code} value={option.code}>
                                                {option.display}
                                            </option>
                                        ))}
                                    </select>
                                )}
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
                                    required
                                    disabled={isCategoryDisabled()}
                                >
                                    {allowedCategories.map((cat) => (
                                        <option key={cat} value={cat === "Region" ? "Division" : cat}>
                                            {cat === "Region" ? "Division" : cat}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Category Value Dropdown - Area */}
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
                                            required
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

                            {/* Category Value Dropdown - Province */}
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
                                            {provinces.map((province) => (
                                                <option key={province.ProvinceCode} value={province.ProvinceCode}>
                                                    {formatProvinceOption(province)}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            )}

                            {/* Category Value Dropdown - Division */}
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
                                            {divisions.map((division) => (
                                                <option key={division.RegionCode} value={division.RegionCode}>
                                                    {formatDivisionOption(division)}
                                                </option>
                                            ))}
                                        </select>
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
                                Progress of Battle For Solar Energy
                            </h2>
                            <p className="text-sm text-gray-600 mt-1">
                                {selectedCategory === "Entire CEB"
                                    ? "Entire CEB"
                                    : selectedCategory === "Area"
                                        ? `${selectedCategory}: ${selectedCategoryName}`
                                        : `${selectedCategory}: ${categoryValue}`}{" "}
                                | Month: {selectedMonthDisplay} | Customer Type: {customerType}
                            </p>
                        </div>
                        <div className="flex space-x-2 mt-2 md:mt-0">
                            <button
                                onClick={downloadAsCSV}
                                className="flex items-center gap-1 px-3 py-1.5 border border-blue-400 text-blue-700 bg-white rounded-md text-xs font-medium shadow-sm hover:bg-blue-50 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-200 transition"
                            >
                                <Download className="w-3 h-3" /> CSV
                            </button>
                            <button
                                onClick={printPDF}
                                className="flex items-center gap-1 px-3 py-1.5 border border-green-400 text-green-700 bg-white rounded-md text-xs font-medium shadow-sm hover:bg-green-50 hover:text-green-800 focus:outline-none focus:ring-2 focus:ring-green-200 transition"
                            >
                                <Printer className="w-3 h-3" /> PDF
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
                            {renderPVCapacityTable()}
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

export default SolarPVCapacityInformation;