import React, { useState, useEffect, useRef } from "react";
import { FaFileDownload, FaPrint } from "react-icons/fa";
import { useUser } from "../../contexts/UserContext";
import { useReportScope } from "../../hooks/useReportScope";

interface Area {
  AreaCode: string;
  AreaName: string;
  ProvCode?: string;
  Region?: string;
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

interface RoofTopSolarInputDataModel {
  ScenarioNumber: number;
  ScenarioDescription: string;
  BF: number | null;
  SumExportMinusImport1: number | null;
  SumExportMinusImport2: number | null;
  SumExport: number | null;
  CalcCycle: string | null;
  ErrorMessage: string | null;
}

const RoofTopSolarInputData: React.FC = () => {
  const maroon = "text-[#7A0000]";
  const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";

  const [selectedCategory, setSelectedCategory] = useState<string>("Area");
  const [categoryValue, setCategoryValue] = useState<string>("");
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>("");
  const [calcCycleValue, setCalcCycleValue] = useState<string>("");
  const [selectedCycleDisplay, setSelectedCycleDisplay] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const [areas, setAreas] = useState<Area[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [cycleOptions, setCycleOptions] = useState<BillCycleOption[]>([]);

  const [isLoadingAreas, setIsLoadingAreas] = useState(false);
  const [isLoadingProvinces, setIsLoadingProvinces] = useState(false);
  const [isLoadingDivisions, setIsLoadingDivisions] = useState(false);
  const [isLoadingCycles, setIsLoadingCycles] = useState(false);

  const [areaError, setAreaError] = useState<string | null>(null);
  const [provinceError, setProvinceError] = useState<string | null>(null);
  const [divisionError, setDivisionError] = useState<string | null>(null);
  const [cycleError, setCycleError] = useState<string | null>(null);

  const [reportData, setReportData] = useState<RoofTopSolarInputDataModel[]>([]);

  const { user } = useUser();
  const { allowedCategories, locked } = useReportScope();

  const printRef = useRef<HTMLDivElement>(null);

  // ─── fetch helpers ────────────────────────────────────────────────────────

  const fetchWithErrorHandling = async (url: string) => {
    try {
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) {
        let errorMsg = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.errorMessage) errorMsg = errorData.errorMessage;
        } catch {
          errorMsg = response.statusText;
        }
        throw new Error(errorMsg);
      }
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json"))
        throw new Error(`Expected JSON but got ${contentType}`);
      return await response.json();
    } catch (error) {
      console.error(`Error fetching ${url}:`, error);
      throw error;
    }
  };

  const generateCycleOptions = (cycles: string[], maxCycle: string): BillCycleOption[] => {
    const maxCycleNum = parseInt(maxCycle);
    return cycles.map((cycle, index) => ({
      display: `${(maxCycleNum - index).toString()} - ${cycle}`,
      code: (maxCycleNum - index).toString(),
    }));
  };

  // ─── data fetches ─────────────────────────────────────────────────────────

  useEffect(() => {
  const fetch = async () => {
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
      setAreas(data.data || []);
    } catch (err: any) {
      setAreaError(err.message || "Failed to load areas.");
    } finally {
      setIsLoadingAreas(false);
    }
  };
  fetch();
}, [user.Level]); // re-fetch if the logged-in user changes

useEffect(() => {
  const fetch = async () => {
    setIsLoadingProvinces(true);
    setProvinceError(null);
    try {
      let url = "/misapi/api/ordinary/province";
      if (locked["Region"]?.code) {
        url += `?regionCode=${locked["Region"].code}`;
      }
      const data = await fetchWithErrorHandling(url);
      setProvinces(data.data || []);
    } catch (err: any) {
      setProvinceError(err.message || "Failed to load provinces.");
    } finally {
      setIsLoadingProvinces(false);
    }
  };
  fetch();
}, [user.Level]);

  useEffect(() => {
    const fetch = async () => {
      setIsLoadingDivisions(true);
      setDivisionError(null);
      try {
        const data = await fetchWithErrorHandling("/misapi/api/ordinary/region");
        setDivisions(data.data || []);
      } catch (err: any) {
        setDivisionError(err.message || "Failed to load divisions.");
      } finally {
        setIsLoadingDivisions(false);
      }
    };
    fetch();
  }, []);

  useEffect(() => {
    const fetch = async () => {
      setIsLoadingCycles(true);
      setCycleError(null);
      try {
        const data = await fetchWithErrorHandling(
          "/misapi/api/ordinary/netmtcons/billcycle/max"
        );
        if (data.data && data.data.BillCycles?.length > 0) {
          setCycleOptions(
            generateCycleOptions(data.data.BillCycles, data.data.MaxBillCycle)
          );
        } else {
          setCycleOptions([]);
        }
      } catch (err: any) {
        setCycleError(err.message || "Failed to load calc cycles.");
      } finally {
        setIsLoadingCycles(false);
      }
    };
    fetch();
  }, []);


  useEffect(() => {
    const lock = locked[selectedCategory as keyof typeof locked];
    if (lock) {
      setCategoryValue(lock.code);
      setSelectedCategoryName(lock.name ? `${lock.code} - ${lock.name}` : lock.code);
    }
  }, [selectedCategory, locked]);

  // ─── handlers ─────────────────────────────────────────────────────────────

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCategory(e.target.value);
    setCategoryValue("");
    setSelectedCategoryName("");
    setReportError(null);
  };

  const canSubmit = () => {
    if (!calcCycleValue) return false;
    if (selectedCategory !== "Entire CEB" && !categoryValue) return false;
    return true;
  };

  const getReportTypeParam = () => {
    switch (selectedCategory) {
      case "Area": return "area";
      case "Province": return "province";
      case "Region": return "region";
      default: return "entireceb";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setReportError(null);
    setReportData([]);

    try {
      const reportType = getReportTypeParam();
      const typeCodeParam =
        selectedCategory !== "Entire CEB" ? `&typeCode=${categoryValue}` : "";
      const url = `/misapi/solarapi/rooftop-solar-input/report?calcCycle=${calcCycleValue}&reportType=${reportType}${typeCodeParam}`;

      const result = await fetchWithErrorHandling(url);

      if (result.errorMessage) {
        setReportError(result.errorMessage);
        return;
      }

      setReportData(result.data || []);
      setReportVisible(true);
    } catch (err: any) {
      setReportError(err.message || "Failed to generate report.");
    } finally {
      setLoading(false);
    }
  };

  // ─── format helpers ───────────────────────────────────────────────────────

  const formatNumber = (value: number | null): string => {
    if (value === null || value === undefined) return "";
    return value.toLocaleString("en-US");
  };

  const getScopeLabel = () => {
    if (selectedCategory === "Entire CEB") return "Entire CEB";
    return `${selectedCategory}: ${selectedCategoryName}`;
  };

  // ─── CSV export ───────────────────────────────────────────────────────────

  const downloadAsCSV = () => {
    if (!reportData.length) return;

    const headers = [
      "Scenario No.",
      "Scenario",
      "B/F",
      "Σ(Export-Import)",
      "Σ(Export-Import)",
      "Σ Export",
    ];

    const rows = reportData.map((row) => [
      row.ScenarioNumber,
      row.ScenarioDescription,
      row.BF ?? "",
      row.SumExportMinusImport1 ?? "",
      row.SumExportMinusImport2 ?? "",
      row.SumExport ?? "",
    ]);

    const csvContent = [
      "Roof Top Solar Input Data Portal for Loss Calculations",
      `Calc Cycle: ${selectedCycleDisplay}`,
      getScopeLabel(),
      `Generated: ${new Date().toLocaleDateString()}`,
      "",
      headers.map((h) => `"${h}"`).join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const scope =
      selectedCategory === "Entire CEB" ? "EntireCEB" : `${selectedCategory}_${categoryValue}`;
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `RoofTopSolarInputData_${scope}_CalcCycle_${calcCycleValue}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  // ─── PDF print ────────────────────────────────────────────────────────────

  const printPDF = () => {
    if (!printRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const tableRows = reportData
      .map(
        (row) => `
        <tr>
          
          <td>${row.ScenarioDescription}</td>
          <td class="text-right">${formatNumber(row.BF)}</td>
          <td class="text-right">${formatNumber(row.SumExportMinusImport1)}</td>
          <td class="text-right">${formatNumber(row.SumExportMinusImport2)}</td>
          <td class="text-right">${formatNumber(row.SumExport)}</td>
        </tr>`
      )
      .join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Roof Top Solar Input Data Portal for Loss Calculations</title>
          <style>
            body { font-family: Arial; font-size: 10px; margin: 10mm; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { padding: 4px 6px; border: 1px solid #ddd; font-size: 10px; vertical-align: top;}
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .header { font-weight: bold; color: #7A0000; font-size: 12px; margin-bottom: 5px; }
            .subheader { font-size: 11px; margin-bottom: 2px; }
            th { background-color: #d3d3d3; font-weight: bold; text-align: center; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .group-header { background-color: #e8e8e8; font-weight: bold; text-align: center; }
            @page {
              margin-bottom: 18mm;
              @bottom-left {
                content: "Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()} | Reporting@2026";
                font-size: 9px; color: #666; font-family: Arial;
              }
              @bottom-right {
                content: "Page " counter(page) " of " counter(pages);
                font-size: 9px; color: #666; font-family: Arial;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">Roof Top Solar Input Data Portal for Loss Calculations</div>
          <div class="subheader"><strong>Calc Cycle: ${selectedCycleDisplay} </strong></div>
          <div class="subheader"><strong>${getScopeLabel()}</strong></div>
          <div class="subheader">Ordinary</div>
          <br/>
          <table>
            <thead>
              <tr>
                
                <th rowspan="2">Scenario</th>
                <th colspan="4" class="text-center">kWh Units</th>
              </tr>
              <tr>
                <th>B/F</th>
                <th>Σ(Export-Import)</th>
                <th>Σ(Export-Import)</th>
                <th>Σ Export</th>
              </tr>
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

  // ─── render table ─────────────────────────────────────────────────────────

  const renderTable = () => (
    <table className="w-full border-collapse text-xs">
      <thead className="bg-gray-100 sticky top-0">
        <tr>
          {/* <th
            className="border border-gray-300 px-2 py-1 text-center"
            rowSpan={2}
          ></th> */}
          <th
            className="border border-gray-300 px-2 py-1 text-center"
            rowSpan={2}
          >
            Scenario
          </th>
          <th
            className="border border-gray-300 px-2 py-1 text-center"
            colSpan={4}
          >
            kWh Units
          </th>
        </tr>
        <tr>
          <th className="border border-gray-300 px-2 py-1 text-center">B/F</th>
          <th className="border border-gray-300 px-2 py-1 text-center">
            Σ(Export-Import)
          </th>
          <th className="border border-gray-300 px-2 py-1 text-center">
            Σ(Export-Import)
          </th>
          <th className="border border-gray-300 px-2 py-1 text-center">
            Σ Export
          </th>
        </tr>
      </thead>
      <tbody>
        {reportData.map((row, index) => (
          <tr
            key={row.ScenarioNumber}
            className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
          >
            {/* <td className="border border-gray-300 px-2 py-1 text-center">
              {row.ScenarioNumber}
            </td> */}
            <td className="border border-gray-300 px-2 py-1">
              {row.ScenarioDescription}
            </td>
            <td className="border border-gray-300 px-2 py-1 text-right">
              {formatNumber(row.BF)}
            </td>
            <td className="border border-gray-300 px-2 py-1 text-right">
              {formatNumber(row.SumExportMinusImport1)}
            </td>
            <td className="border border-gray-300 px-2 py-1 text-right">
              {formatNumber(row.SumExportMinusImport2)}
            </td>
            <td className="border border-gray-300 px-2 py-1 text-right">
              {formatNumber(row.SumExport)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  // ─── render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-4 bg-white rounded-lg shadow-sm">
      {/* Form */}
      {!reportVisible && (
        <>
          <h1 className={`text-xl font-bold ${maroon} mb-4`}>
            Roof Top Solar Input Data Portal for Loss Calculations
          </h1>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              {/* Select Category */}
              <div className="flex flex-col">
                <label className={`text-xs font-medium mb-1 ${maroon}`}>
                  Select Category:
                </label>
                <select
                  value={selectedCategory}
                  onChange={handleCategoryChange}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent"
                >
                  {allowedCategories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Select Report Type (Area / Province / Region value) */}
              {selectedCategory !== "Entire CEB" && (
                <div className="flex flex-col">
                  <label className={`text-xs font-medium mb-1 ${maroon}`}>
                    Select{" "}
                    {selectedCategory === "Area"
                      ? "Area"
                      : selectedCategory === "Province"
                        ? "Province"
                        : "Region"}
                    :
                  </label>

                  {selectedCategory === "Area" && (
                    locked["Area"] ? (
                      <select disabled value={locked["Area"].code} className="w-full px-2 py-1.5 text-xs border rounded-md bg-gray-100 text-gray-600 border-gray-200 cursor-not-allowed">
                        <option value={locked["Area"].code}>
                          {locked["Area"].code} - {locked["Area"].name}
                        </option>
                      </select>
                    ) : (
                      <select
                        value={categoryValue}
                        onChange={(e) => {
                          const selected = areas.find(
                            (a) => a.AreaCode === e.target.value
                          );
                          setCategoryValue(e.target.value);
                          setSelectedCategoryName(
                            selected
                              ? `${selected.AreaCode} - ${selected.AreaName}`
                              : ""
                          );
                        }}
                        className={`w-full px-2 py-1.5 text-xs border rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent ${isLoadingAreas
                          ? "bg-gray-100 text-gray-400 border-gray-200"
                          : "border-gray-300"
                          }`}
                        disabled={isLoadingAreas}
                      >
                        <option value="">
                          {isLoadingAreas ? "Loading..." : "Select Area"}
                        </option>
                        {areaError && (
                          <option disabled value="">
                            {areaError}
                          </option>
                        )}
                        {areas.map((area) => (
                          <option key={area.AreaCode} value={area.AreaCode}>
                            {area.AreaCode} - {area.AreaName}
                          </option>
                        ))}
                      </select>
                    )
                  )}

                  {selectedCategory === "Province" && (
                    locked["Province"] ? (
                      <select disabled value={locked["Province"].code} className="w-full px-2 py-1.5 text-xs border rounded-md bg-gray-100 text-gray-600 border-gray-200 cursor-not-allowed">
                        <option value={locked["Province"].code}>
                          {locked["Province"].code} - {locked["Province"].name}
                        </option>
                      </select>
                    ) : (
                      <select
                        value={categoryValue}
                        onChange={(e) => {
                          const selected = provinces.find(
                            (p) => p.ProvinceCode === e.target.value
                          );
                          setCategoryValue(e.target.value);
                          setSelectedCategoryName(
                            selected
                              ? `${selected.ProvinceCode} - ${selected.ProvinceName}`
                              : ""
                          );
                        }}
                        className={`w-full px-2 py-1.5 text-xs border rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent ${isLoadingProvinces
                          ? "bg-gray-100 text-gray-400 border-gray-200"
                          : "border-gray-300"
                          }`}
                        disabled={isLoadingProvinces}
                      >
                        <option value="">
                          {isLoadingProvinces ? "Loading..." : "Select Province"}
                        </option>
                        {provinceError && (
                          <option disabled value="">
                            {provinceError}
                          </option>
                        )}
                        {provinces.map((prov) => (
                          <option key={prov.ProvinceCode} value={prov.ProvinceCode}>
                            {prov.ProvinceCode} - {prov.ProvinceName}
                          </option>
                        ))}
                      </select>
                    )
                  )}

                  {selectedCategory === "Region" && (
                    locked["Region"] ? (
                      <select disabled value={locked["Region"].code} className="w-full px-2 py-1.5 text-xs border rounded-md bg-gray-100 text-gray-600 border-gray-200 cursor-not-allowed">
                        <option value={locked["Region"].code}>
                          {locked["Region"].name ? `${locked["Region"].code} - ${locked["Region"].name}` : locked["Region"].code}
                        </option>
                      </select>
                    ) : (
                      <select
                        value={categoryValue}
                        onChange={(e) => {
                          setCategoryValue(e.target.value);
                          setSelectedCategoryName(e.target.value);
                        }}
                        className={`w-full px-2 py-1.5 text-xs border rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent ${isLoadingDivisions
                          ? "bg-gray-100 text-gray-400 border-gray-200"
                          : "border-gray-300"
                          }`}
                        disabled={isLoadingDivisions}
                      >
                        <option value="">
                          {isLoadingDivisions ? "Loading..." : "Select Region"}
                        </option>
                        {divisionError && (
                          <option disabled value="">
                            {divisionError}
                          </option>
                        )}
                        {divisions.map((div) => (
                          <option key={div.RegionCode} value={div.RegionCode}>
                            {div.RegionCode}
                          </option>
                        ))}
                      </select>
                    )
                  )}
                </div>
              )}

              {/* Calc Cycle
            <div className="flex flex-col">
              <label className={`text-xs font-medium mb-1 ${maroon}`}>
                Calc Cycle:
              </label>
              <select
                value={calcCycleValue}
                onChange={(e) => {
                  const selected = cycleOptions.find(
                    (c) => c.code === e.target.value
                  );
                  setCalcCycleValue(e.target.value);
                  setSelectedCycleDisplay(selected?.display ?? "");
                }}
                className={`w-full px-2 py-1.5 text-xs border rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent ${
                  isLoadingCycles
                    ? "bg-gray-100 text-gray-400 border-gray-200"
                    : "border-gray-300"
                }`}
                disabled={isLoadingCycles}
              >
                <option value="">
                  {isLoadingCycles ? "Loading..." : "Select Calc Cycle"}
                </option>
                {cycleError && (
                  <option disabled value="">
                    {cycleError}
                  </option>
                )}
                {cycleOptions.map((opt) => (
                  <option key={opt.code} value={opt.code}>
                    {opt.display}
                  </option>
                ))}
              </select>
            </div> */}

              {/* Calc Cycle */}
              <div className="flex flex-col">
                <label
                  className={`text-xs font-medium mb-1 ${isLoadingCycles ||
                    cycleError !== null ||
                    (selectedCategory !== "Entire CEB" && !categoryValue)
                    ? "text-gray-400"
                    : maroon
                    }`}
                >
                  Calc Cycle:
                </label>
                <select
                  value={calcCycleValue}
                  onChange={(e) => {
                    const selected = cycleOptions.find(
                      (c) => c.code === e.target.value
                    );
                    setCalcCycleValue(e.target.value);
                    setSelectedCycleDisplay(selected?.display ?? "");
                  }}
                  className={`w-full px-2 py-1.5 text-xs border rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent ${isLoadingCycles ||
                    cycleError !== null ||
                    (selectedCategory !== "Entire CEB" && !categoryValue)
                    ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                    : "border-gray-300"
                    }`}
                  disabled={
                    isLoadingCycles ||
                    cycleError !== null ||
                    (selectedCategory !== "Entire CEB" && !categoryValue)
                  }
                >
                  <option value="">
                    {isLoadingCycles ? "Loading..." : "Select Calc Cycle"}
                  </option>
                  {cycleError && (
                    <option disabled value="">
                      {cycleError}
                    </option>
                  )}
                  {cycleOptions.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.display}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Submit */}
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
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
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
        <div className="mt-2">
          {/* Report Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
            <div>
              <h2 className={`text-lg font-bold ${maroon}`}>
                Roof Top Solar Input Data Portal for Loss Calculations
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {selectedCategory === "Entire CEB"
                  ? "Entire CEB"
                  : `${selectedCategory}: ${selectedCategoryName}`}{" "}
                | Calc Cycle: {selectedCycleDisplay} | Ordinary
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
                className="px-4 py-1.5 bg-[#7A0000] hover:bg-[#A52A2A] text-xs rounded-md text-white"
              >
                Back to Form
              </button>
            </div>
          </div>


          <div className="overflow-x-auto max-h-[calc(100vh-250px)] border border-gray-300 rounded-lg">
            <div ref={printRef} className="min-w-full py-4">
              {reportData.length > 0 ? (
                renderTable()
              ) : (
                <p className="text-sm text-gray-500 text-center py-6">
                  No data available.
                </p>
              )}
            </div>
          </div>

          {reportError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {reportError}
            </div>
          )}
        </div>
      )}

      {/* Error (form view) */}
      {!reportVisible && reportError && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
          {reportError}
        </div>
      )}
    </div>
  );
};

export default RoofTopSolarInputData;