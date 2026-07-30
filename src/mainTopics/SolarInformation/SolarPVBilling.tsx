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

interface DetailedPVConnection {
  Division: string;
  Province: string;
  Area: string;
  CustomerName: string;
  AccountNumber: string;
  CustomerType: string;
  PanelCapacity: number;
  BFUnits: number;
  EnergyExported: number;
  EnergyImported: number;
  CFUnits: number;
  SinNumber: string;
  Tariff: string;
  AgreementDate: string;
  UnitsForLossReduction?: number; // Only for ordinary connections
}

interface SummaryReportData {
  ordinary: DetailedPVConnection[];
  bulk: DetailedPVConnection[];
}

const SolarPVBilling: React.FC = () => {
  const maroon = "text-[#7A0000]";
  const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";

  const [selectedCategory, setSelectedCategory] = useState<string>("Area");
  const [selectedCycleType, setSelectedCycleType] = useState<string>("");
  const [categoryValue, setCategoryValue] = useState<string>("");
  const [cycleValue, setCycleValue] = useState<string>(""); // Bill cycle or calc cycle value
  const [reportType, setReportType] = useState<string>("");
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

  const { user } = useUser();
  const { allowedCategories, locked } = useReportScope();

  // Report data
  const [detailedData, setDetailedData] = useState<DetailedPVConnection[]>([]);
  const [summaryData, setSummaryData] = useState<SummaryReportData>({
    ordinary: [],
    bulk: [],
  });

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
      display: cycleType === "Calculation Cycle"
        ? cycle  // Show only month-year for Calculation Cycle
        : `${(maxCycleNum - index).toString()} - ${cycle}`,  // Show full format for Bill Cycle
      code: (maxCycleNum - index).toString(),
    }));
  };

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
  }, [user.Level, user.RegionCode, user.ProvinceCode]);

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
  }, [user.Level, user.RegionCode]);

  // Fetch divisions
  useEffect(() => {
    const fetchDivisions = async () => {
      setIsLoadingDivisions(true);
      setDivisionError(null);
      try {
        const divisionData = await fetchWithErrorHandling("/misapi/api/bulk/region");
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
    const lock = locked[selectedCategory as keyof typeof locked];
    if (lock) {
      setCategoryValue(lock.code);
      setSelectedCategoryName(lock.name ? `${lock.code} - ${lock.name}` : lock.code);
    }
  }, [selectedCategory, user.Level, user.RegionCode, user.ProvinceCode, user.ProvinceName, user.AreaCode, user.AreaName]);

  // Fetch cycles based on cycle type
  useEffect(() => {
    // Only fetch cycles if a cycle type is selected
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
        // Use the same endpoint for both bill cycle and calc cycle
        const cycleData = await fetchWithErrorHandling("/misapi/api/bulk/netmtcons/billcycle/max");
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

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedCategory(value);

    // reset all dependent values
    setCategoryValue("");
    setSelectedCycleType(""); // Reset cycle type when category changes
    setCycleValue("");
    setReportType("");
    setSelectedCategoryName("");
    setSelectedCycleDisplay("");
  };

  const handleCycleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedCycleType(value);

    // reset dependent values
    setCycleValue("");
    setReportType("");
    setSelectedCycleDisplay("");
  };

  const formatCurrency = (value: number): string => {
    return value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const downloadAsCSV = () => {
    if (
      (reportType.includes("Detailed") && !detailedData.length) ||
      (reportType === "Summary Report" &&
        (!summaryData.ordinary || !summaryData.bulk))
    )
      return;

    let csvContent = "";
    const reportTitle = "Solar PV Connections Report";
    const selectionInfo =
      selectedCategory === "Entire CEB"
        ? "Entire CEB"
        : selectedCategory === "Area"
          ? `${selectedCategory}: ${selectedCategoryName}`
          : `${selectedCategory}: ${categoryValue}`;

    if (reportType.includes("Detailed")) {
      const isOrdinaryReport = reportType === "Detailed Report - Ordinary";
      let headers: string[] = [];

      if (isOrdinaryReport) {
        headers = [
          "Division",
          "Province",
          "Area",
          "Name of Customer",
          "A/C No.",
          "Type of Customer",
          "Panel Capacity (kW)",
          "B/F Units",
          "Energy Exported (kWh)",
          "Energy Imported (kWh)",
          "C/F Units",
          "Sin No.",
          "Tariff",
          "Agreement Date",
          "Units for Loss Reduction",
        ];
      } else {
        headers = [
          "Division",
          "Province",
          "Area",
          "Name of Customer",
          "A/C No.",
          "Type of Customer",
          "Panel Capacity (kW)",
          "B/F Units",
          "Energy Exported (kWh)",
          "Energy Imported (kWh)",
          "C/F Units",
          "Sin No.",
          "Tariff",
          "Agreement Date",
        ];
      }

      // Escape CSV values
      const escapeCSV = (value: string | number | null | undefined) => {
        if (value === null || value === undefined) return "";
        const stringValue = String(value);
        if (
          stringValue.includes(",") ||
          stringValue.includes('"') ||
          stringValue.includes("\n")
        ) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      };

      // Sort and group data
      const sortedData = [...detailedData].sort((a, b) => {
        if (a.Division !== b.Division) {
          return (a.Division || "").localeCompare(b.Division || "");
        }
        if (a.Province !== b.Province) {
          return (a.Province || "").localeCompare(b.Province || "");
        }
        if (a.Area !== b.Area) {
          return (a.Area || "").localeCompare(b.Area || "");
        }
        return 0;
      });

      const divisionGroups: { [key: string]: DetailedPVConnection[] } = {};
      const provinceGroups: { [key: string]: DetailedPVConnection[] } = {};
      const areaGroups: { [key: string]: DetailedPVConnection[] } = {};

      sortedData.forEach((item) => {
        const divisionKey = item.Division || "";
        const provinceKey = `${item.Division || ""}-${item.Province || ""}`;
        const areaKey = `${item.Division || ""}-${item.Province || ""}-${item.Area || ""
          }`;

        if (!divisionGroups[divisionKey]) divisionGroups[divisionKey] = [];
        divisionGroups[divisionKey].push(item);

        if (!provinceGroups[provinceKey]) provinceGroups[provinceKey] = [];
        provinceGroups[provinceKey].push(item);

        if (!areaGroups[areaKey]) areaGroups[areaKey] = [];
        areaGroups[areaKey].push(item);
      });

      const uniqueDivisions = Object.keys(divisionGroups).sort();
      const dataRows: string[] = [];

      let currentDivision = "";
      let currentProvince = "";
      let currentArea = "";

      uniqueDivisions.forEach((division) => {
        const provincesInDivision = Object.keys(provinceGroups)
          .filter((pk) => pk.startsWith(`${division}-`))
          .sort();

        provincesInDivision.forEach((provinceKey) => {
          const areasInProvince = Object.keys(areaGroups)
            .filter((ak) => ak.startsWith(`${provinceKey}-`))
            .sort();

          areasInProvince.forEach((areaKey) => {
            const items = areaGroups[areaKey];

            items.forEach((row) => {
              const divisionValue =
                currentDivision !== row.Division ? row.Division : "";
              const provinceValue =
                currentProvince !== `${row.Division}-${row.Province}`
                  ? row.Province
                  : "";
              const areaValue =
                currentArea !== `${row.Division}-${row.Province}-${row.Area}`
                  ? row.Area
                  : "";

              if (divisionValue) {
                currentDivision = row.Division || "";
                currentProvince = "";
                currentArea = "";
              }
              if (provinceValue) {
                currentProvince = `${row.Division || ""}-${row.Province || ""}`;
                currentArea = "";
              }
              if (areaValue) {
                currentArea = `${row.Division || ""}-${row.Province || ""}-${row.Area || ""
                  }`;
              }

              const rowData = [
                escapeCSV(divisionValue),
                escapeCSV(provinceValue),
                escapeCSV(areaValue),
                escapeCSV(row.CustomerName),
                escapeCSV(row.AccountNumber),
                escapeCSV(row.CustomerType),
                escapeCSV(formatCurrency(row.PanelCapacity || 0)),
                escapeCSV(row.BFUnits),
                escapeCSV(row.EnergyExported),
                escapeCSV(row.EnergyImported),
                escapeCSV(row.CFUnits),
                escapeCSV(row.SinNumber),
                escapeCSV(row.Tariff),
                escapeCSV(row.AgreementDate),
              ];

              if (isOrdinaryReport) {
                rowData.push(escapeCSV(row.UnitsForLossReduction || ""));
              }

              dataRows.push(rowData.join(","));
            });

            // Add Area Total if more than 1 record in area
            if (items.length > 1) {
              const totals = {
                count: items.length,
                panelCapacity: items.reduce(
                  (sum, item) => sum + (item.PanelCapacity || 0),
                  0
                ),
                energyExported: items.reduce(
                  (sum, item) => sum + (item.EnergyExported || 0),
                  0
                ),
                energyImported: items.reduce(
                  (sum, item) => sum + (item.EnergyImported || 0),
                  0
                ),
              };

              const totalRow = [
                "",
                "",
                "",
                "Area Total",
                escapeCSV(totals.count.toString()),
                "",
                escapeCSV(formatCurrency(totals.panelCapacity)),
                "",
                escapeCSV(totals.energyExported.toString()),
                escapeCSV(totals.energyImported.toString()),
                "",
                "",
                "",
                "",
              ];

              if (isOrdinaryReport) {
                totalRow.push("");
              }

              dataRows.push(totalRow.join(","));
            }
          });

          // Add Province Total if more than 1 area
          if (areasInProvince.length > 1) {
            const provinceItems = provinceGroups[provinceKey];
            const totals = {
              count: provinceItems.length,
              panelCapacity: provinceItems.reduce(
                (sum, item) => sum + (item.PanelCapacity || 0),
                0
              ),
              energyExported: provinceItems.reduce(
                (sum, item) => sum + (item.EnergyExported || 0),
                0
              ),
              energyImported: provinceItems.reduce(
                (sum, item) => sum + (item.EnergyImported || 0),
                0
              ),
            };

            const totalRow = [
              "",
              "",
              "Province Total",
              "",
              escapeCSV(totals.count.toString()),
              "",
              escapeCSV(formatCurrency(totals.panelCapacity)),
              "",
              escapeCSV(totals.energyExported.toString()),
              escapeCSV(totals.energyImported.toString()),
              "",
              "",
              "",
              "",
            ];

            if (isOrdinaryReport) {
              totalRow.push("");
            }

            dataRows.push(totalRow.join(","));
          }
        });

        // Add Division Total if more than 1 province
        if (provincesInDivision.length > 1) {
          const divisionItems = divisionGroups[division];
          const totals = {
            count: divisionItems.length,
            panelCapacity: divisionItems.reduce(
              (sum, item) => sum + (item.PanelCapacity || 0),
              0
            ),
            energyExported: divisionItems.reduce(
              (sum, item) => sum + (item.EnergyExported || 0),
              0
            ),
            energyImported: divisionItems.reduce(
              (sum, item) => sum + (item.EnergyImported || 0),
              0
            ),
          };

          const totalRow = [
            "",
            "Division Total",
            "",
            "",
            escapeCSV(totals.count.toString()),
            "",
            escapeCSV(formatCurrency(totals.panelCapacity)),
            "",
            escapeCSV(totals.energyExported.toString()),
            escapeCSV(totals.energyImported.toString()),
            "",
            "",
            "",
            "",
          ];

          if (isOrdinaryReport) {
            totalRow.push("");
          }

          dataRows.push(totalRow.join(","));
        }
      });

      csvContent = [
        reportTitle,
        selectionInfo,
        `${selectedCycleType}: ${selectedCycleDisplay}`,
        `Report Type: ${reportType}`,
        `Generated: ${new Date().toLocaleDateString()}`,
        "",
        headers.map((h) => `"${h}"`).join(","),
        ...dataRows,
      ].join("\n");
    } else {
      // Summary report CSV - match the exact table structure from the UI

      // Group by customer type for ordinary connections
      const ordinaryByType = summaryData.ordinary.reduce((acc, item) => {
        const type = item.CustomerType || "Unknown";
        if (!acc[type]) {
          acc[type] = {
            count: 0,
            capacity: 0,
            exported: 0,
            imported: 0,
          };
        }
        acc[type].count += 1;
        acc[type].capacity += item.PanelCapacity || 0;
        acc[type].exported += item.EnergyExported || 0;
        acc[type].imported += item.EnergyImported || 0;
        return acc;
      }, {} as Record<string, { count: number; capacity: number; exported: number; imported: number }>);

      // Group by customer type for bulk connections
      const bulkByType = summaryData.bulk.reduce((acc, item) => {
        const type = item.CustomerType || "Unknown";
        if (!acc[type]) {
          acc[type] = {
            count: 0,
            capacity: 0,
            exported: 0,
            imported: 0,
          };
        }
        acc[type].count += 1;
        acc[type].capacity += item.PanelCapacity || 0;
        acc[type].exported += item.EnergyExported || 0;
        acc[type].imported += item.EnergyImported || 0;
        return acc;
      }, {} as Record<string, { count: number; capacity: number; exported: number; imported: number }>);

      // Calculate totals
      const ordinaryAccounts = summaryData.ordinary.length;
      const bulkAccounts = summaryData.bulk.length;
      const totalAccounts = ordinaryAccounts + bulkAccounts;

      const ordinaryCapacity = summaryData.ordinary.reduce(
        (sum, item) => sum + (item.PanelCapacity || 0),
        0
      );
      const bulkCapacity = summaryData.bulk.reduce(
        (sum, item) => sum + (item.PanelCapacity || 0),
        0
      );
      const totalCapacity = ordinaryCapacity + bulkCapacity;

      const ordinaryExported = summaryData.ordinary.reduce(
        (sum, item) => sum + (item.EnergyExported || 0),
        0
      );
      const bulkExported = summaryData.bulk.reduce(
        (sum, item) => sum + (item.EnergyExported || 0),
        0
      );
      const totalExported = ordinaryExported + bulkExported;

      const ordinaryImported = summaryData.ordinary.reduce(
        (sum, item) => sum + (item.EnergyImported || 0),
        0
      );
      const bulkImported = summaryData.bulk.reduce(
        (sum, item) => sum + (item.EnergyImported || 0),
        0
      );
      const totalImported = ordinaryImported + bulkImported;

      // Build CSV content matching the exact table structure
      const csvLines = [
        reportTitle,
        selectionInfo,
        `${selectedCycleType}: ${selectedCycleDisplay}`,
        `Report Type: ${reportType}`,
        `Generated: ${new Date().toLocaleDateString()}`,
        "",

        // Ordinary Customer Details Table
        "Ordinary Customer Details",
        `"No. of Accounts","Type of Customer","Panel Capacity (kW)","Energy Exported (kWh)","Energy Imported (kWh)"`,
      ];

      // Add ordinary customer type rows
      Object.entries(ordinaryByType).forEach(([type, data]) => {
        csvLines.push(
          `"${data.count}","${type}","${formatCurrency(
            data.capacity
          )}","${formatCurrency(data.exported)}","${formatCurrency(
            data.imported
          )}"`
        );
      });

      // Add ordinary total row
      csvLines.push(
        `"${ordinaryAccounts}","","${formatCurrency(
          ordinaryCapacity
        )}","${formatCurrency(ordinaryExported)}","${formatCurrency(
          ordinaryImported
        )}"`
      );

      csvLines.push(""); // Empty line between tables

      // Bulk Customer Details Table
      csvLines.push("Bulk Customer Details");
      csvLines.push(
        `"No. of Accounts","Type of Customer","Panel Capacity (kW)","Energy Exported (kWh)","Energy Imported (kWh)"`
      );

      // Add bulk customer type rows
      Object.entries(bulkByType).forEach(([type, data]) => {
        csvLines.push(
          `"${data.count}","${type}","${formatCurrency(
            data.capacity
          )}","${formatCurrency(data.exported)}","${formatCurrency(
            data.imported
          )}"`
        );
      });

      // Add bulk total row
      csvLines.push(
        `"${bulkAccounts}","","${formatCurrency(
          bulkCapacity
        )}","${formatCurrency(bulkExported)}","${formatCurrency(bulkImported)}"`
      );

      csvLines.push(""); // Empty line between tables

      // Total Customers Table
      csvLines.push("Total Customers");
      csvLines.push(
        `"Total Customers","Total Panel Capacity (kW)","Energy Exported (kWh)","Energy Imported (kWh)"`
      );
      csvLines.push(
        `"${totalAccounts}","${formatCurrency(
          totalCapacity
        )}","${formatCurrency(totalExported)}","${formatCurrency(
          totalImported
        )}"`
      );

      csvContent = csvLines.join("\n");
    }

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
        `SolarPVConnections_${fileDescriptor}_${selectedCycleType.replace(
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

    const reportTitle = "SOLAR PV CONNECTIONS REPORT";
    const selectionInfo = (() => {
      if (selectedCategory === "Entire CEB") {
        return "Entire CEB";
      } else if (selectedCategory === "Area") {
        return `${selectedCategory}: <span class="bold">${selectedCategoryName}</span>`;
      } else {
        return `${selectedCategory}: <span class="bold">${categoryValue}</span>`;
      }
    })();

    printWindow.document.write(`
      <html>
        <head>
          <title>Solar PV Connections Report</title>
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
            .total-row { 
              font-weight: bold; 
              background-color: #f5f5f5; 
            }
            th { 
              background-color: #f0f0f0; 
              font-weight: bold; 
              text-align: center; 
            }
            tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            .bold {
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="header">${reportTitle}</div>
          <div class="subheader">
            ${selectionInfo}<br>
            ${selectedCycleType}: <span class="bold">${selectedCycleDisplay}</span><br>
            Report Type: <span class="bold">${reportType}</span>
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

  const renderDetailedTable = () => {
    const isOrdinaryReport = reportType === "Detailed Report - Ordinary";

    // Handle empty data
    if (!detailedData || detailedData.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          No data available for the selected criteria.
        </div>
      );
    }

    // Sort data first to ensure proper grouping (by Division, then Province, then Area)
    const sortedData = [...detailedData].sort((a, b) => {
      if (a.Division !== b.Division) {
        return (a.Division || "").localeCompare(b.Division || "");
      }
      if (a.Province !== b.Province) {
        return (a.Province || "").localeCompare(b.Province || "");
      }
      if (a.Area !== b.Area) {
        return (a.Area || "").localeCompare(b.Area || "");
      }
      return 0;
    });

    // Group data by Division, Province, and Area
    const divisionGroups: { [key: string]: DetailedPVConnection[] } = {};
    const provinceGroups: { [key: string]: DetailedPVConnection[] } = {};
    const areaGroups: { [key: string]: DetailedPVConnection[] } = {};

    sortedData.forEach((item) => {
      const divisionKey = item.Division || "";
      const provinceKey = `${item.Division || ""}-${item.Province || ""}`;
      const areaKey = `${item.Division || ""}-${item.Province || ""}-${item.Area || ""}`;

      if (!divisionGroups[divisionKey]) divisionGroups[divisionKey] = [];
      divisionGroups[divisionKey].push(item);

      if (!provinceGroups[provinceKey]) provinceGroups[provinceKey] = [];
      provinceGroups[provinceKey].push(item);

      if (!areaGroups[areaKey]) areaGroups[areaKey] = [];
      areaGroups[areaKey].push(item);
    });

    // Calculate row span counts (including total rows)
    const divisionRowSpans: { [key: string]: number } = {};
    const provinceRowSpans: { [key: string]: number } = {};
    const areaRowSpans: { [key: string]: number } = {};

    Object.keys(divisionGroups).forEach((key) => {
      let rowCount = divisionGroups[key].length;
      // Add area total rows
      const areas = Object.keys(areaGroups).filter((ak) => {
        const [div] = ak.split("-");
        return div === key;
      });
      areas.forEach((ak) => {
        if (areaGroups[ak].length > 1) rowCount++;
      });
      // Add province total rows
      const provinces = Object.keys(provinceGroups).filter((pk) =>
        pk.startsWith(`${key}-`)
      );
      provinces.forEach((pk) => {
        const areaCount = Object.keys(areaGroups).filter((ak) =>
          ak.startsWith(`${pk}-`)
        ).length;
        if (areaCount > 1) rowCount++;
      });
      // Add division total row
      if (provinces.length > 1) rowCount++;
      divisionRowSpans[key] = rowCount;
    });

    Object.keys(provinceGroups).forEach((key) => {
      let rowCount = provinceGroups[key].length;
      // Add area total rows
      const areas = Object.keys(areaGroups).filter((ak) =>
        ak.startsWith(`${key}-`)
      );
      areas.forEach((ak) => {
        if (areaGroups[ak].length > 1) rowCount++;
      });
      // Add province total row
      if (areas.length > 1) rowCount++;
      provinceRowSpans[key] = rowCount;
    });

    Object.keys(areaGroups).forEach((key) => {
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

    const tableRows: React.ReactElement[] = [];
    let rowIndex = 0;

    uniqueDivisions.forEach((division) => {
      const provincesInDivision = Object.keys(provinceGroups)
        .filter((pk) => pk.startsWith(`${division}-`))
        .sort();

      provincesInDivision.forEach((provinceKey) => {
        const areasInProvince = Object.keys(areaGroups)
          .filter((ak) => ak.startsWith(`${provinceKey}-`))
          .sort();

        areasInProvince.forEach((areaKey) => {
          const items = areaGroups[areaKey];

          items.forEach((row) => {
            const divisionKeyCheck = row.Division || "";
            const provinceKeyCheck = `${row.Division || ""}-${row.Province || ""}`;
            const areaKeyCheck = `${row.Division || ""}-${row.Province || ""}-${row.Area || ""}`;

            const showDivision = currentDivision !== divisionKeyCheck;
            const showProvince = currentProvince !== provinceKeyCheck;
            const showArea = currentArea !== areaKeyCheck;

            if (showDivision) {
              currentDivision = divisionKeyCheck;
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
                className={rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50"}
              >
                {showDivision && (
                  <td
                    className="border border-gray-300 px-2 py-1 align-top font-medium"
                    rowSpan={divisionRowSpans[divisionKeyCheck]}
                  >
                    {row.Division || "N/A"}
                  </td>
                )}
                {showProvince && (
                  <td
                    className="border border-gray-300 px-2 py-1 align-top"
                    rowSpan={provinceRowSpans[provinceKeyCheck]}
                  >
                    {row.Province || "N/A"}
                  </td>
                )}
                {showArea && (
                  <td
                    className="border border-gray-300 px-2 py-1 align-top"
                    rowSpan={areaRowSpans[areaKeyCheck]}
                  >
                    {row.Area || "N/A"}
                  </td>
                )}
                <td className="border border-gray-300 px-2 py-1">
                  {row.CustomerName || "N/A"}
                </td>
                <td className="border border-gray-300 px-2 py-1">
                  {row.AccountNumber || "N/A"}
                </td>
                <td className="border border-gray-300 px-2 py-1">
                  {row.CustomerType || "N/A"}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-right">
                  {row.PanelCapacity != null
                    ? formatCurrency(row.PanelCapacity)
                    : "0.00"}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-right">
                  {row.BFUnits != null ? row.BFUnits : "0"}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-right">
                  {row.EnergyExported != null ? row.EnergyExported : "0"}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-right">
                  {row.EnergyImported != null ? row.EnergyImported : "0"}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-right">
                  {row.CFUnits != null ? row.CFUnits : "0"}
                </td>
                <td className="border border-gray-300 px-2 py-1">
                  {row.SinNumber || "N/A"}
                </td>
                <td className="border border-gray-300 px-2 py-1">
                  {row.Tariff || "N/A"}
                </td>
                <td className="border border-gray-300 px-2 py-1 whitespace-nowrap">
                  {row.AgreementDate || "N/A"}
                </td>
                {isOrdinaryReport && (
                  <td className="border border-gray-300 px-2 py-1 text-right">
                    {row.UnitsForLossReduction != null
                      ? row.UnitsForLossReduction
                      : ""}
                  </td>
                )}
              </tr>
            );
            rowIndex++;
          });

          // Add Area Total if more than 1 record in area
          if (items.length > 1) {
            const totals = {
              count: items.length,
              panelCapacity: items.reduce(
                (sum, item) => sum + (item.PanelCapacity || 0),
                0
              ),
              energyExported: items.reduce(
                (sum, item) => sum + (item.EnergyExported || 0),
                0
              ),
              energyImported: items.reduce(
                (sum, item) => sum + (item.EnergyImported || 0),
                0
              ),
            };

            tableRows.push(
              <tr key={`area-total-${rowIndex}`} className="bg-green-50 font-medium">
                <td className="border border-gray-300 px-2 py-1" colSpan={1}>
                  Area Total
                </td>
                <td className="border border-gray-300 px-2 py-1 text-right">
                  {totals.count}
                </td>
                <td className="border border-gray-300 px-2 py-1" colSpan={1}></td>
                <td className="border border-gray-300 px-2 py-1 text-right">
                  {formatCurrency(totals.panelCapacity)}
                </td>
                <td className="border border-gray-300 px-2 py-1"></td>
                <td className="border border-gray-300 px-2 py-1 text-right">
                  {totals.energyExported}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-right">
                  {totals.energyImported}
                </td>
                <td
                  className="border border-gray-300 px-2 py-1"
                  colSpan={isOrdinaryReport ? 5 : 4}
                ></td>
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
            panelCapacity: provinceItems.reduce(
              (sum, item) => sum + (item.PanelCapacity || 0),
              0
            ),
            energyExported: provinceItems.reduce(
              (sum, item) => sum + (item.EnergyExported || 0),
              0
            ),
            energyImported: provinceItems.reduce(
              (sum, item) => sum + (item.EnergyImported || 0),
              0
            ),
          };

          tableRows.push(
            <tr key={`province-total-${rowIndex}`} className="bg-blue-50 font-semibold">
              <td className="border border-gray-300 px-2 py-1" colSpan={2}>
                Province Total
              </td>
              <td className="border border-gray-300 px-2 py-1 text-right">
                {totals.count}
              </td>
              <td className="border border-gray-300 px-2 py-1" colSpan={1}></td>
              <td className="border border-gray-300 px-2 py-1 text-right">
                {formatCurrency(totals.panelCapacity)}
              </td>
              <td className="border border-gray-300 px-2 py-1"></td>
              <td className="border border-gray-300 px-2 py-1 text-right">
                {totals.energyExported}
              </td>
              <td className="border border-gray-300 px-2 py-1 text-right">
                {totals.energyImported}
              </td>
              <td
                className="border border-gray-300 px-2 py-1"
                colSpan={isOrdinaryReport ? 5 : 4}
              ></td>
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
          panelCapacity: divisionItems.reduce(
            (sum, item) => sum + (item.PanelCapacity || 0),
            0
          ),
          energyExported: divisionItems.reduce(
            (sum, item) => sum + (item.EnergyExported || 0),
            0
          ),
          energyImported: divisionItems.reduce(
            (sum, item) => sum + (item.EnergyImported || 0),
            0
          ),
        };

        tableRows.push(
          <tr key={`division-total-${rowIndex}`} className="bg-yellow-50 font-bold">
            <td className="border border-gray-300 px-2 py-1" colSpan={3}>
              Division Total
            </td>
            <td className="border border-gray-300 px-2 py-1 text-right">
              {totals.count}
            </td>
            <td className="border border-gray-300 px-2 py-1" colSpan={1}></td>
            <td className="border border-gray-300 px-2 py-1 text-right">
              {formatCurrency(totals.panelCapacity)}
            </td>
            <td className="border border-gray-300 px-2 py-1"></td>
            <td className="border border-gray-300 px-2 py-1 text-right">
              {totals.energyExported}
            </td>
            <td className="border border-gray-300 px-2 py-1 text-right">
              {totals.energyImported}
            </td>
            <td
              className="border border-gray-300 px-2 py-1"
              colSpan={isOrdinaryReport ? 5 : 4}
            ></td>
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
              Type of Customer
            </th>
            <th className="border border-gray-300 px-2 py-1 text-center">
              Panel Capacity (kW)
            </th>
            <th className="border border-gray-300 px-2 py-1 text-center">
              B/F Units
            </th>
            <th className="border border-gray-300 px-2 py-1 text-center">
              Energy Exported (kWh)
            </th>
            <th className="border border-gray-300 px-2 py-1 text-center">
              Energy Imported (kWh)
            </th>
            <th className="border border-gray-300 px-2 py-1 text-center">
              C/F Units
            </th>
            <th className="border border-gray-300 px-2 py-1 text-center">
              Sin No.
            </th>
            <th className="border border-gray-300 px-2 py-1 text-center">
              Tariff
            </th>
            <th className="border border-gray-300 px-2 py-1 text-center">
              Agreement Date
            </th>
            {isOrdinaryReport && (
              <th className="border border-gray-300 px-2 py-1 text-center">
                Units for Loss Reduction
              </th>
            )}
          </tr>
        </thead>
        <tbody>{tableRows}</tbody>
      </table>
    );
  };

  const renderSummaryTables = () => {
    if (!summaryData.ordinary || !summaryData.bulk) return null;

    // Calculate totals from ordinary and bulk data
    const ordinaryAccounts = summaryData.ordinary.length;
    const bulkAccounts = summaryData.bulk.length;
    const totalAccounts = ordinaryAccounts + bulkAccounts;

    const ordinaryCapacity = summaryData.ordinary.reduce(
      (sum, item) => sum + (item.PanelCapacity || 0),
      0
    );
    const bulkCapacity = summaryData.bulk.reduce(
      (sum, item) => sum + (item.PanelCapacity || 0),
      0
    );
    const totalCapacity = ordinaryCapacity + bulkCapacity;

    const ordinaryExported = summaryData.ordinary.reduce(
      (sum, item) => sum + (item.EnergyExported || 0),
      0
    );
    const bulkExported = summaryData.bulk.reduce(
      (sum, item) => sum + (item.EnergyExported || 0),
      0
    );
    const totalExported = ordinaryExported + bulkExported;

    const ordinaryImported = summaryData.ordinary.reduce(
      (sum, item) => sum + (item.EnergyImported || 0),
      0
    );
    const bulkImported = summaryData.bulk.reduce(
      (sum, item) => sum + (item.EnergyImported || 0),
      0
    );
    const totalImported = ordinaryImported + bulkImported;

    // Group by customer type for ordinary connections
    const ordinaryByType = summaryData.ordinary.reduce((acc, item) => {
      const type = item.CustomerType || "Unknown";
      if (!acc[type]) {
        acc[type] = {
          count: 0,
          capacity: 0,
          exported: 0,
          imported: 0,
        };
      }
      acc[type].count += 1;
      acc[type].capacity += item.PanelCapacity || 0;
      acc[type].exported += item.EnergyExported || 0;
      acc[type].imported += item.EnergyImported || 0;
      return acc;
    }, {} as Record<string, { count: number; capacity: number; exported: number; imported: number }>);

    // Group by customer type for bulk connections
    const bulkByType = summaryData.bulk.reduce((acc, item) => {
      const type = item.CustomerType || "Unknown";
      if (!acc[type]) {
        acc[type] = {
          count: 0,
          capacity: 0,
          exported: 0,
          imported: 0,
        };
      }
      acc[type].count += 1;
      acc[type].capacity += item.PanelCapacity || 0;
      acc[type].exported += item.EnergyExported || 0;
      acc[type].imported += item.EnergyImported || 0;
      return acc;
    }, {} as Record<string, { count: number; capacity: number; exported: number; imported: number }>);

    return (
      <div className="space-y-6">
        {/* Ordinary Customer Details Table */}
        <div>
          <h3 className="font-bold text-lg mb-2 text-[#7A0000]">
            Ordinary Customer Details
          </h3>
          <table className="w-full border-collapse text-xs border border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="border border-gray-300 px-2 py-1 text-center">
                  No. of Accounts
                </th>
                <th className="border border-gray-300 px-2 py-1 text-center">
                  Type of Customer
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
              </tr>
            </thead>
            <tbody>
              {Object.entries(ordinaryByType).map(([type, data], index) => (
                <tr
                  key={index}
                  className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                >
                  <td className="border border-gray-300 px-2 py-1 text-right">
                    {data.count}
                  </td>
                  <td className="border border-gray-300 px-2 py-1">{type}</td>
                  <td className="border border-gray-300 px-2 py-1 text-right">
                    {formatCurrency(data.capacity)}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right">
                    {formatCurrency(data.exported)}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right">
                    {formatCurrency(data.imported)}
                  </td>
                </tr>
              ))}
              <tr className="font-bold bg-gray-100">
                <td className="border border-gray-300 px-2 py-1 text-right">
                  {ordinaryAccounts}
                </td>
                <td className="border border-gray-300 px-2 py-1"></td>
                <td className="border border-gray-300 px-2 py-1 text-right">
                  {formatCurrency(ordinaryCapacity)}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-right">
                  {formatCurrency(ordinaryExported)}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-right">
                  {formatCurrency(ordinaryImported)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Bulk Customer Details Table */}
        <div>
          <h3 className="font-bold text-lg mb-2 text-[#7A0000]">
            Bulk Customer Details
          </h3>
          <table className="w-full border-collapse text-xs border border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="border border-gray-300 px-2 py-1 text-center">
                  No. of Accounts
                </th>
                <th className="border border-gray-300 px-2 py-1 text-center">
                  Type of Customer
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
              </tr>
            </thead>
            <tbody>
              {Object.entries(bulkByType).map(([type, data], index) => (
                <tr
                  key={index}
                  className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                >
                  <td className="border border-gray-300 px-2 py-1 text-right">
                    {data.count}
                  </td>
                  <td className="border border-gray-300 px-2 py-1">{type}</td>
                  <td className="border border-gray-300 px-2 py-1 text-right">
                    {formatCurrency(data.capacity)}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right">
                    {formatCurrency(data.exported)}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right">
                    {formatCurrency(data.imported)}
                  </td>
                </tr>
              ))}
              <tr className="font-bold bg-gray-100">
                <td className="border border-gray-300 px-2 py-1 text-right">
                  {bulkAccounts}
                </td>
                <td className="border border-gray-300 px-2 py-1"></td>
                <td className="border border-gray-300 px-2 py-1 text-right">
                  {formatCurrency(bulkCapacity)}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-right">
                  {formatCurrency(bulkExported)}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-right">
                  {formatCurrency(bulkImported)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Combined Totals Table */}
        <div>
          <h3 className="font-bold text-lg mb-2 text-[#7A0000]">
            Total Customers
          </h3>
          <table className="w-full border-collapse text-xs border border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="border border-gray-300 px-2 py-1 text-center">
                  Total Customers
                </th>
                <th className="border border-gray-300 px-2 py-1 text-center">
                  Total Panel Capacity (kW)
                </th>
                <th className="border border-gray-300 px-2 py-1 text-center">
                  Energy Exported (kWh)
                </th>
                <th className="border border-gray-300 px-2 py-1 text-center">
                  Energy Imported (kWh)
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="font-bold bg-gray-100">
                <td className="border border-gray-300 px-2 py-1 text-center">
                  {totalAccounts}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-center">
                  {formatCurrency(totalCapacity)}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-center">
                  {formatCurrency(totalExported)}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-center">
                  {formatCurrency(totalImported)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setReportError(null);
    setDetailedData([]);
    setSummaryData({ ordinary: [], bulk: [] });
    setReportVisible(false);

    try {
      let endpoint = "";
      let validationError = "";

      // Validate inputs
      if (!cycleValue) validationError = `${selectedCycleType} is required`;
      if (!reportType) validationError = "Report type is required";
      if (selectedCategory !== "Entire CEB" && !categoryValue) {
        validationError = `${selectedCategory} is required`;
      }

      if (validationError) {
        throw new Error(validationError);
      }

      // Build API URL
      const typeCode = selectedCategory === "Entire CEB" ? "" : categoryValue;
      let reportTypeParam = "";

      if (selectedCategory === "Entire CEB") {
        reportTypeParam = "entireceb";
      } else if (selectedCategory === "Area") {
        reportTypeParam = "area";
      } else if (selectedCategory === "Province") {
        reportTypeParam = "province";
      } else if (selectedCategory === "Region") {
        reportTypeParam = "region";
      }

      // Determine cycle type parameter
      const cycleTypeParam = selectedCycleType === "Bill Cycle" ? "A" : "C";
      const cycleParam =
        selectedCycleType === "Bill Cycle" ? "billCycle" : "calcCycle";

      // Determine endpoint based on report type
      if (reportType === "Detailed Report - Ordinary") {
        endpoint = `/misapi/solarapi/pv-connections?${cycleParam}=${cycleValue}&cycleType=${cycleTypeParam}&reportType=${reportTypeParam}`;

        // Only add typeCode parameter if it's not Entire CEB
        if (selectedCategory !== "Entire CEB") {
          endpoint += `&typeCode=${typeCode}`;
        }

        console.log("Making API call to:", endpoint);

        const response = await fetch(endpoint, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        });

        console.log("Response status:", response.status);

        // HTTP error handling
        if (!response.ok) {
          let errorMsg = `HTTP error ${response.status}`;
          try {
            const errorData = await response.json();
            if (errorData.errorMessage) {
              errorMsg = errorData.errorMessage;
            } else if (errorData.message) {
              errorMsg = errorData.message;
            }
          } catch (e) {
            errorMsg = `${errorMsg}: ${await response.text()}`;
          }
          throw new Error(errorMsg);
        }

        // Content type verification
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          throw new Error(`Expected JSON but got ${contentType}`);
        }

        // Process successful response
        const result = await response.json();
        console.log("API result:", result);

        // Handle response data
        const responseData = result.data || result;
        let detailedDataArray = [];

        if (Array.isArray(responseData)) {
          detailedDataArray = responseData;
        } else if (responseData && typeof responseData === 'object') {
          detailedDataArray = [responseData];
        }

        // Filter out any null or undefined entries
        detailedDataArray = detailedDataArray.filter(item => item != null);

        console.log("Processed detailed data:", detailedDataArray);
        setDetailedData(detailedDataArray);
        setReportVisible(true);
      } else if (reportType === "Detailed Report - Bulk") {
        endpoint = `/misapi/solarapi/pv-bulkconnections?${cycleParam}=${cycleValue}&cycleType=${cycleTypeParam}&reportType=${reportTypeParam}`;

        // Only add typeCode parameter if it's not Entire CEB
        if (selectedCategory !== "Entire CEB") {
          endpoint += `&typeCode=${typeCode}`;
        }

        console.log("Making API call to:", endpoint);

        const response = await fetch(endpoint, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        });

        console.log("Response status:", response.status);

        // HTTP error handling
        if (!response.ok) {
          let errorMsg = `HTTP error ${response.status}`;
          try {
            const errorData = await response.json();
            if (errorData.errorMessage) {
              errorMsg = errorData.errorMessage;
            } else if (errorData.message) {
              errorMsg = errorData.message;
            }
          } catch (e) {
            errorMsg = `${errorMsg}: ${await response.text()}`;
          }
          throw new Error(errorMsg);
        }

        // Content type verification
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          throw new Error(`Expected JSON but got ${contentType}`);
        }

        // Process successful response
        const result = await response.json();
        console.log("API result:", result);

        // Handle response data
        const responseData = result.data || result;
        let detailedDataArray = [];

        if (Array.isArray(responseData)) {
          detailedDataArray = responseData;
        } else if (responseData && typeof responseData === 'object') {
          detailedDataArray = [responseData];
        }

        // Filter out any null or undefined entries
        detailedDataArray = detailedDataArray.filter(item => item != null);

        console.log("Processed detailed data:", detailedDataArray);
        setDetailedData(detailedDataArray);
        setReportVisible(true);
      } else if (reportType === "Summary Report") {
        // For summary report, we'll fetch both ordinary and bulk data
        let ordinaryEndpoint = `/misapi/solarapi/pv-connections?${cycleParam}=${cycleValue}&cycleType=${cycleTypeParam}&reportType=${reportTypeParam}`;
        let bulkEndpoint = `/misapi/solarapi/pv-bulkconnections?${cycleParam}=${cycleValue}&cycleType=${cycleTypeParam}&reportType=${reportTypeParam}`;

        // Only add typeCode parameter if it's not Entire CEB
        if (selectedCategory !== "Entire CEB") {
          ordinaryEndpoint += `&typeCode=${typeCode}`;
          bulkEndpoint += `&typeCode=${typeCode}`;
        }

        console.log(
          "Making API calls for summary:",
          ordinaryEndpoint,
          bulkEndpoint
        );

        // Fetch both ordinary and bulk data
        const [ordinaryResponse, bulkResponse] = await Promise.all([
          fetch(ordinaryEndpoint, {
            method: "GET",
            headers: { Accept: "application/json" },
          }),
          fetch(bulkEndpoint, {
            method: "GET",
            headers: { Accept: "application/json" },
          }),
        ]);

        // Check both responses
        if (!ordinaryResponse.ok || !bulkResponse.ok) {
          throw new Error(
            `Failed to fetch data: Ordinary ${ordinaryResponse.status}, Bulk ${bulkResponse.status}`
          );
        }

        // Content type verification
        const ordinaryContentType =
          ordinaryResponse.headers.get("content-type");
        const bulkContentType = bulkResponse.headers.get("content-type");

        if (
          !ordinaryContentType ||
          !ordinaryContentType.includes("application/json") ||
          !bulkContentType ||
          !bulkContentType.includes("application/json")
        ) {
          throw new Error(
            `Expected JSON but got Ordinary: ${ordinaryContentType}, Bulk: ${bulkContentType}`
          );
        }

        // Process both responses
        const ordinaryData = await ordinaryResponse.json();
        const bulkData = await bulkResponse.json();

        // Combine the data for summary report
        const ordinaryResponseData = ordinaryData.data || ordinaryData;
        const bulkResponseData = bulkData.data || bulkData;

        let ordinaryArray = [];
        let bulkArray = [];

        if (Array.isArray(ordinaryResponseData)) {
          ordinaryArray = ordinaryResponseData;
        } else if (ordinaryResponseData && typeof ordinaryResponseData === 'object') {
          ordinaryArray = [ordinaryResponseData];
        }

        if (Array.isArray(bulkResponseData)) {
          bulkArray = bulkResponseData;
        } else if (bulkResponseData && typeof bulkResponseData === 'object') {
          bulkArray = [bulkResponseData];
        }

        // Filter out any null or undefined entries
        ordinaryArray = ordinaryArray.filter(item => item != null);
        bulkArray = bulkArray.filter(item => item != null);

        const combinedData = {
          ordinary: ordinaryArray,
          bulk: bulkArray,
        };

        console.log("Processed summary data:", combinedData);
        setSummaryData(combinedData);
        setReportVisible(true);
      }
    } catch (err: any) {
      console.error("Error in form submission:", err);
      if (err.message.includes("Failed to fetch")) {
        setReportError("Network error - please check your connection");
      } else {
        setReportError(err.message || "Failed to load PV connections data");
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

  // Check if cycle type dropdown should be disabled
  const isCycleTypeDisabled = () => {
    if (selectedCategory === "Entire CEB") {
      return false; // Always enabled for Entire CEB
    }

    return (
      !categoryValue ||
      (selectedCategory === "Area" && (isLoadingAreas || areaError !== null)) ||
      (selectedCategory === "Province" &&
        (isLoadingProvinces || provinceError !== null)) ||
      (selectedCategory === "Region" &&
        (isLoadingDivisions || divisionError !== null))
    );
  };

  // Check if month dropdown should be disabled
  const isMonthDisabled = () => {
    return (
      !selectedCycleType ||
      isCycleTypeDisabled() ||
      isLoadingCycles ||
      cycleError !== null
    );
  };

  // Check if report type dropdown should be disabled
  const isReportTypeDisabled = () => {
    return isMonthDisabled() || !cycleValue;
  };

  return (
    <div className="max-w-7xl mx-auto p-4 bg-white rounded-xl shadow border border-gray-200 text-sm font-sans">
      {/* Form Section */}
      {!reportVisible && (
        <>
          <h2 className={`text-xl font-bold mb-6 ${maroon}`}>
            Solar PV Connections
          </h2>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              {/* Dropdown for category selection */}
              <div className="flex flex-col">
                <label className={`${maroon} text-xs font-medium mb-1`}>
                  Select Category:
                </label>
                <select
                  value={selectedCategory}
                  onChange={handleCategoryChange}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent"
                  required
                >
                  {allowedCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Conditional dropdown based on category selection */}
              {selectedCategory === "Area" && (
                <div className="flex flex-col">
                  <label className={`${maroon} text-xs font-medium mb-1`}>
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
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent"
                      required
                      disabled={isLoadingAreas || areaError !== null}
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
                  <label className={`${maroon} text-xs font-medium mb-1`}>
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
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent"
                      required
                      disabled={isLoadingProvinces || provinceError !== null}
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

              {selectedCategory === "Region" && (
                <div className="flex flex-col">
                  <label className={`${maroon} text-xs font-medium mb-1`}>
                    Select Region:
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
                      <span className="ml-2 text-xs">Loading regions...</span>
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
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent"
                      required
                      disabled={isLoadingDivisions || divisionError !== null}
                    >
                      <option value="">Select Region</option>
                      {divisions.map((division) => (
                        <option key={division.RegionCode} value={division.RegionCode}>
                          {formatDivisionOption(division)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Cycle Type Dropdown */}
              <div className="flex flex-col">
                <label
                  className={`text-xs font-medium mb-1 ${isCycleTypeDisabled() ? "text-gray-400" : maroon
                    }`}
                >
                  Select Cycle Type:
                </label>
                <select
                  value={selectedCycleType}
                  onChange={handleCycleTypeChange}
                  className={`w-full px-2 py-1.5 text-xs border rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent
                                        ${isCycleTypeDisabled()
                      ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                      : "border-gray-300"
                    }`}
                  required
                  disabled={isCycleTypeDisabled()}
                >
                  <option value="">Select Cycle Type</option>
                  <option value="Bill Cycle">Bill Cycle</option>
                  <option value="Calculation Cycle">Calculation Cycle</option>
                </select>
              </div>

              {/* Month/Cycle Dropdown */}
              <div className="flex flex-col">
                <label
                  className={`text-xs font-medium mb-1 ${isMonthDisabled() ? "text-gray-400" : maroon
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
                      // Find and store the cycle display text
                      const selectedOption = cycleOptions.find(
                        (option) => option.code === selectedCode
                      );
                      setSelectedCycleDisplay(
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
                  className={`text-xs font-medium mb-1 ${isReportTypeDisabled()
                      ? "text-gray-400" // light gray when disabled
                      : maroon
                    }`}
                >
                  Select Type:
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
                  <option value="">Select Type</option>
                  <option value="Detailed Report - Ordinary">
                    Detailed Report - Ordinary
                  </option>
                  <option value="Detailed Report - Bulk">
                    Detailed Report - Bulk
                  </option>
                  <option value="Summary Report">Summary Report</option>
                </select>
              </div>
            </div>

            {/* Submit button */}
            <div className="w-full mt-6 flex justify-end">
              <button
                type="submit"
                className={`px-6 py-2 rounded-md font-medium transition-opacity duration-300 shadow
                            ${maroonGrad} text-white ${loading ? "opacity-70 cursor-not-allowed" : "hover:opacity-90"
                  }`}
                disabled={loading || isReportTypeDisabled() || !reportType}
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
                  ? "Solar PV Connections Summary"
                  : "Solar PV Connections Report"}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {selectedCategory === "Entire CEB"
                  ? "Entire CEB"
                  : selectedCategory === "Area"
                    ? `${selectedCategory}: ${selectedCategoryName}`
                    : `${selectedCategory}: ${categoryValue}`}{" "}
                |{selectedCycleType}: {selectedCycleDisplay} | Type:{" "}
                {reportType}
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
            <div ref={printRef} className="min-w-full">
              {reportType.includes("Detailed")
                ? renderDetailedTable()
                : renderSummaryTables()}
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

export default SolarPVBilling;