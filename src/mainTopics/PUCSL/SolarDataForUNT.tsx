import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { FaFileDownload, FaPrint } from "react-icons/fa";
import {
    BillCycleOption, Province, Division
} from "../../components/mainTopics/PUCSLSolarConnection/pucslTypes.ts";
import {
    fetchWithErrorHandling, getSolarTypeValue, getReportCategoryValue
} from "../../components/mainTopics/PUCSLSolarConnection/pucslUtils.ts";
import { useUser } from "../../contexts/UserContext";
import { useReportScope } from "../../hooks/useReportScope";

type ReportCategory = "Province" | "Division" | "Entire CEB";

interface UNTDataModel {
  Category: string;
  Year: string;
  Month: string;
  Accts: number;
  UnitsExpD: number;
  UnitsExpP: number;
  UnitsExpOffP: number;
  UnitsImpD: number;
  UnitsImpP: number;
  UnitsImpOffP: number;
}

interface UNTResponse {
  Data: UNTDataModel[];
  Total: UNTDataModel;
  ErrorMessage?: string;
}

const SolarDataForUNT = () => {
  const maroon = "text-[#7A0000]";
  const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";

  const { user } = useUser();
  const { locked } = useReportScope();

  // ── Form State ────────────────────────────────────────────────────────────
  const [reportCategory, setReportCategory] = useState<ReportCategory>("Province");
  const [typeCode, setTypeCode] = useState<string>("");
  const [billCycle, setBillCycle] = useState<string>("");
  const [netType, setNetType] = useState<string>("Net Metering");

  // ── Filters Dropdown Data State ───────────────────────────────────────────
  const [billCycleOptions, setBillCycleOptions] = useState<BillCycleOption[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);

  // ── Loading & UI State ────────────────────────────────────────────────────
  const [isLoadingFilters, setIsLoadingFilters] = useState<boolean>(true);
  const [isLoadingReport, setIsLoadingReport] = useState<boolean>(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportVisible, setReportVisible] = useState<boolean>(false);

  // ── Generated Report Details State ────────────────────────────────────────
  const [exportResult, setExportResult] = useState<UNTResponse | null>(null);
  const [selectedLocationLabel, setSelectedLocationLabel] = useState<string>("");
  const [selectedBillCycleDisplay, setSelectedBillCycleDisplay] = useState<string>("");

  const printRef = useRef<HTMLDivElement>(null);

  // ── Fetch Filters on Mount ────────────────────────────────────────────────
  useEffect(() => {
    const loadFilters = async () => {
      setIsLoadingFilters(true);
      setReportError(null);

      try {
        // API SOURCE COMMENTS:
        // - Bill Cycles are fetched from: /misapi/api/ordinary/areas/billcycle/min
        // - Provinces are fetched from: /misapi/api/ordinary/province
        // - Regions/Divisions are fetched from: /misapi/api/ordinary/region
        let provinceUrl = "/misapi/api/ordinary/province";
        if (locked["Region"]?.code) {
          provinceUrl += `?regionCode=${locked["Region"].code}`;
        }

        const [cyclesRes, provinceRes, divisionRes] = await Promise.all([
          fetchWithErrorHandling("/misapi/api/ordinary/areas/billcycle/min"),
          fetchWithErrorHandling(provinceUrl),
          fetchWithErrorHandling("/misapi/api/ordinary/region"),
        ]) as [
          { data?: { BillCycles?: string[]; MaxBillCycle?: string } },
          { data?: Province[] },
          { data?: Division[] }
        ];

        const billCycles = cyclesRes.data?.BillCycles ?? [];
        const maxCycle = parseInt(cyclesRes.data?.MaxBillCycle ?? "0", 10);
        const generatedOptions = billCycles.map((cycle: string, index: number) => ({
          display: `${maxCycle - index} - ${cycle}`,
          code: String(maxCycle - index),
        }));

        setBillCycleOptions(generatedOptions);
        if (generatedOptions.length > 0) {
          setBillCycle(generatedOptions[0].code);
        }

        const sortedProvinces = [...(provinceRes.data ?? [])].sort((a, b) =>
          a.ProvinceName.localeCompare(b.ProvinceName)
        );
        const sortedDivisions = [...(divisionRes.data ?? [])].sort((a, b) =>
          a.RegionCode.localeCompare(b.RegionCode)
        );

        setProvinces(sortedProvinces);
        setDivisions(sortedDivisions);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load filters.";
        setReportError(message);
      } finally {
        setIsLoadingFilters(false);
      }
    };

    loadFilters();
  }, [user.Level, user.RegionCode, user.ProvinceCode]);

  // Sync typeCode with locked value or reset it when report category changes
  useEffect(() => {
    const lockKey = reportCategory === "Division" ? "Region" : "Province";
    const lock = locked[lockKey];
    if (lock) {
      setTypeCode(lock.code);
    } else {
      setTypeCode("");
    }
  }, [reportCategory, user.Level, user.RegionCode, user.ProvinceCode, user.ProvinceName]);

  // If user level is below 60, render access restricted UI
  if (!user?.Level || user.Level < 60) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-sm text-center">
        <h2 className="text-lg font-bold text-[#7A0000] mb-2">Access Restricted</h2>
        <p className="text-sm text-gray-600">
          This report isn't available at your access level.
        </p>
      </div>
    );
  }

  // Compute values for Province/Division dropdowns
  const typeOptions = useMemo(() => {
    if (reportCategory === "Province") {
      return provinces.map((item) => ({
        value: item.ProvinceCode,
        label: `${item.ProvinceCode} - ${item.ProvinceName}`,
      }));
    }

    if (reportCategory === "Division") {
      return divisions.map((item) => ({
        value: item.RegionCode,
        label: item.RegionCode,
      }));
    }

    return [];
  }, [provinces, divisions, reportCategory]);

  const billCycleDisplayMap = useMemo(() => {
    return new Map(billCycleOptions.map((option) => [option.code, option.display]));
  }, [billCycleOptions]);

  const getBillCycleDisplay = (cycle: string) => {
    return billCycleDisplayMap.get(cycle) ?? cycle;
  };

  const getFormattedLocation = () => {
    if (reportCategory === "Entire CEB") {
      return "Entire CEB";
    }

    if (!typeCode) {
      return "";
    }

    if (reportCategory === "Province") {
      const province = provinces.find((p) => p.ProvinceCode === typeCode);
      return province ? `${typeCode} - ${province.ProvinceName}` : typeCode;
    }

    if (reportCategory === "Division") {
      return typeCode;
    }

    return "";
  };

  const isFormInvalid = () => {
    if (isLoadingFilters || isLoadingReport) return true;
    if (!billCycle) return true;
    if (reportCategory !== "Entire CEB" && !typeCode) return true;
    return false;
  };

  // ── Form Submit (Fetch Data) ──────────────────────────────────────────────
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setReportError(null);
    setExportResult(null);

    if (isFormInvalid()) {
      return;
    }

    try {
      setIsLoadingReport(true);

      const requestBody = {
        reportCategory: getReportCategoryValue(reportCategory),
        typeCode: reportCategory !== "Entire CEB" ? typeCode : "",
        billCycle,
        reportType: "RawDataForSolar", 
        solarType: getSolarTypeValue(netType),
      };

      // API SOURCE COMMENT:
      // - Solar Data for UNT is fetched from: /misapi/api/pucsl/solarDataUNT
      const response = await fetch("/misapi/api/pucsl/solarDataUNT", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        let msg = `HTTP error! status: ${response.status}`;
        try {
          const d = await response.json();
          if (d.errorMessage) msg = d.errorMessage;
        } catch { }
        throw new Error(msg);
      }

      const result = await response.json();
      if (result.errorMessage) {
        throw new Error(result.errorMessage);
      }

      const resData = result.data as UNTResponse;
      if (!resData?.Data?.length) {
        throw new Error("No data found for the selected criteria.");
      }

      setExportResult(resData);
      setSelectedLocationLabel(getFormattedLocation());
      setSelectedBillCycleDisplay(getBillCycleDisplay(billCycle));
      setReportVisible(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate report.";
      setReportError(message);
      setExportResult(null);
      setReportVisible(false);
    } finally {
      setIsLoadingReport(false);
    }
  };

  // ── Formatter Helper ──────────────────────────────────────────────────────
  const fmtVal = (val: number) => {
    return val.toLocaleString("en-US", { maximumFractionDigits: 0 });
  };



  // ── Download CSV ──────────────────────────────────────────────────────────
  const downloadAsCSV = () => {
    if (!exportResult) return;

    let headers: string;
    let rows: string[];

    if (netType === "Net Plus Plus") {
      headers = [
        "cust_cat",
        "year",
        "submit_month",
        "no_cus",
        "Solar meter_export_kWh",
        "Solar meter_import_kWh",
        "paid_amount"
      ].join(",");

      rows = exportResult.Data.map((row) => [
        row.Category,
        row.Year,
        row.Month,
        row.Accts,
        row.UnitsExpP,
        row.UnitsExpD,
        row.UnitsExpOffP
      ].join(","));
    } else if (netType === "Net Plus") {
      headers = [
        "cust_cat",
        "year",
        "submit_month",
        "no_cus",
        "Solar meter_export_kWh",
        "Solar meter_import_kWh",
        "paid_amount",
        "Import units"
      ].join(",");

      rows = exportResult.Data.map((row) => [
        row.Category,
        row.Year,
        row.Month,
        row.Accts,
        row.UnitsExpP,
        row.UnitsExpD,
        row.UnitsExpOffP,
        row.UnitsImpD
      ].join(","));
    } else if (netType === "Net Accounting") {
      headers = [
        "Category",
        "Year",
        "Month",
        "No of Accounts",
        "kWh_purchased",
        "units_exprt_kWh",
        "units_imprt_kWh",
        "paid_amount"
      ].join(",");

      rows = exportResult.Data.map((row) => [
        row.Category,
        row.Year,
        row.Month,
        row.Accts,
        row.UnitsExpP,
        row.UnitsExpD,
        row.UnitsImpD,
        row.UnitsExpOffP
      ].join(","));
    } else {
      headers = [
        "Category",
        "Year",
        "Month",
        "No of Accounts",
        "units_exprt_DAY_kWh",
        "units_exprt_PEAK_kWh",
        "units_exprt_OFFPEAK_kWh",
        "units_imprt_DAY_kWh",
        "units_imprt_PEAK_kWh",
        "units_imprt_OFFPEAK_kWh"
      ].join(",");

      rows = exportResult.Data.map((row) => [
        row.Category,
        row.Year,
        row.Month,
        row.Accts,
        row.UnitsExpD,
        row.UnitsExpP,
        row.UnitsExpOffP,
        row.UnitsImpD,
        row.UnitsImpP,
        row.UnitsImpOffP
      ].join(","));
    }

    const csvContent = [
      `Solar Data for UNT Calculation - ${netType}`,
      selectedBillCycleDisplay,
      "",
      headers,
      ...rows
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Solar_Data_UNT_${netType.replace(/\s+/g, "_")}_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // ── Print PDF ─────────────────────────────────────────────────────────────
  const printPDF = () => {
    const content = printRef.current;
    if (!content) return;

    const printWindow = window.open("", "_blank", "width=1200,height=800");
    if (!printWindow) return;

    const title = `Solar Data for UNT Calculation - ${netType}`;

    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: Arial, sans-serif; font-size: 11px; margin: 10mm; color: #333; }
            .header { font-weight: bold; font-size: 14px; color: #000; margin-bottom: 2px; }
            .subheader { font-size: 11px; color: #000; margin-bottom: 12px; line-height: 1.3; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #d1d5db; padding: 5px 6px; font-size: 10px; text-align: right; }
            th { background-color: #f3f4f6; font-weight: bold; text-align: center; }
            td:first-child { text-align: left; font-weight: bold; }
            tr.total-row { font-weight: bold; background-color: #f3f4f6; }
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
          </style>
        </head>
        <body>
          <div class="header">Solar Data for UNT Calculation - ${netType}</div>
          <div class="subheader">
            ${selectedBillCycleDisplay}
          </div>
          ${content.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="max-w-7xl mx-auto p-4 bg-white rounded-xl shadow border border-gray-200 text-sm font-sans">
      
      {/* ── Form View ────────────────────────────────────────────────────── */}
      {!reportVisible && (
        <>
          <h2 className={`text-xl font-bold mb-6 ${maroon}`}>
            Solar Data for UNT Calculation
          </h2>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              
              {/* Bill Cycle Select */}
              <div className="flex flex-col">
                <label className={`${maroon} text-xs font-medium mb-1`}>
                  Year & Month:
                </label>
                <select
                  value={billCycle}
                  onChange={(e) => setBillCycle(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent bg-white text-gray-800"
                  disabled={isLoadingFilters || isLoadingReport}
                  required
                >
                  {isLoadingFilters ? (
                    <option>Loading cycles...</option>
                  ) : (
                    billCycleOptions.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.display}
                      </option>
                    ))
                  )}
                </select>
              </div>

               {/* Net Type Select */}
              <div className="flex flex-col">
                <label className={`${maroon} text-xs font-medium mb-1`}>
                  Net Type:
                </label>
                <select
                  value={netType}
                  onChange={(e) => setNetType(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent bg-white text-gray-800"
                  disabled={isLoadingFilters || isLoadingReport}
                  required
                >
                  <option value="Net Metering">Net Metering</option>
                  <option value="Net Accounting">Net Accounting</option>
                  <option value="Net Plus">Net Plus</option>
                  <option value="Net Plus Plus">Net Plus Plus</option>
                </select>
              </div>

              {/* Category Select */}
              <div className="flex flex-col">
                <label className={`${maroon} text-xs font-medium mb-1`}>Select Category:</label>
                {user.Level === 60 ? (
                  <div className="w-full px-2 py-1.5 text-xs border rounded-md bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed">
                    Province
                  </div>
                ) : (
                  <select
                    value={reportCategory}
                    onChange={(e) => setReportCategory(e.target.value as ReportCategory)}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent bg-white text-gray-800"
                    disabled={isLoadingFilters || isLoadingReport}
                  >
                    <option value="Province">Province</option>
                    <option value="Division">Division</option>
                    {user.Level >= 80 && <option value="Entire CEB">Entire CEB</option>}
                  </select>
                )}
              </div>

              {/* Dynamic Province/Division select */}
              {reportCategory !== "Entire CEB" && (
                <div className="flex flex-col">
                  <label className={`${maroon} text-xs font-medium mb-1`}>
                    {reportCategory === "Province" ? "Select Province:" : "Select Division:"}
                  </label>
                  {(() => {
                    const lockKey = reportCategory === "Division" ? "Region" : "Province";
                    const lock = locked[lockKey];
                    return lock ? (
                      <select
                        disabled
                        value={lock.code}
                        className="w-full px-2 py-1.5 text-xs border rounded-md bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                      >
                        <option value={lock.code}>
                          {lock.name ? `${lock.code} - ${lock.name}` : lock.code}
                        </option>
                      </select>
                    ) : (
                      <select
                        value={typeCode}
                        onChange={(e) => setTypeCode(e.target.value)}
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent bg-white text-gray-800"
                        disabled={isLoadingFilters || isLoadingReport}
                        required
                      >
                        <option value="">Select Value</option>
                        {typeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    );
                  })()}
                </div>
              )}

            </div>

            {/* Action Buttons */}
            <div className="w-full mt-6 flex justify-end">
              <button
                type="submit"
                className={`px-6 py-2 rounded-md font-medium transition-opacity duration-300 shadow ${maroonGrad} text-white ${
                  isLoadingReport || isFormInvalid() ? "opacity-70 cursor-not-allowed" : "hover:opacity-90"
                }`}
                disabled={isFormInvalid()}
              >
                {isLoadingReport ? "Loading..." : "Generate Report"}
              </button>
            </div>
          </form>
        </>
      )}

      {/* ── Table Report View ────────────────────────────────────────────── */}
      {reportVisible && exportResult && (
        <div className="mt-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
            <div>
              <h2 className={`text-xl font-bold ${maroon}`}>
                Solar Data for UNT Calculation
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {selectedLocationLabel} | Bill Cycle: {selectedBillCycleDisplay} | Net Type: {netType}
              </p>
            </div>

            <div className="flex space-x-2 mt-2 md:mt-0">
              <button
                onClick={downloadAsCSV}
                className="flex items-center gap-1 px-3 py-1.5 border border-blue-400 text-blue-700 bg-white rounded-md text-xs font-medium shadow-sm hover:bg-blue-50 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-200 transition cursor-pointer"
              >
                <FaFileDownload className="w-3 h-3" /> CSV
              </button>
              <button
                onClick={printPDF}
                className="flex items-center gap-1 px-3 py-1.5 border border-green-400 text-green-700 bg-white rounded-md text-xs font-medium shadow-sm hover:bg-green-50 hover:text-green-800 focus:outline-none focus:ring-2 focus:ring-green-200 transition cursor-pointer"
              >
                <FaPrint className="w-3 h-3" /> PDF
              </button>
              <button
                onClick={() => setReportVisible(false)}
                className="px-4 py-1.5 bg-[#7A0000] hover:bg-[#A52A2A] text-xs rounded-md text-white flex items-center cursor-pointer"
              >
                Back to Form
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[calc(100vh-250px)] border border-gray-300 rounded-lg">
            <div ref={printRef} className="min-w-full p-4 bg-white">
              <table className="w-full border-collapse border border-gray-300 text-xs text-gray-700 font-sans">
                {netType === "Net Plus Plus" ? (
                  <>
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="border border-gray-300 px-3 py-2 text-left font-bold">cust_cat</th>
                        <th className="border border-gray-300 px-3 py-2 text-right font-bold">year</th>
                        <th className="border border-gray-300 px-3 py-2 text-right font-bold">submit_month</th>
                        <th className="border border-gray-300 px-3 py-2 text-right font-bold">no_cus</th>
                        <th className="border border-gray-300 px-3 py-2 text-right font-bold">Solar meter_export_kWh</th>
                        <th className="border border-gray-300 px-3 py-2 text-right font-bold">Solar meter_import_kWh</th>
                        <th className="border border-gray-300 px-3 py-2 text-right font-bold">paid_amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {exportResult.Data.map((row, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <td className="border border-gray-300 px-3 py-2 font-semibold text-gray-800 text-left">{row.Category}</td>
                          <td className="border border-gray-300 px-3 py-2 text-right">{row.Year}</td>
                          <td className="border border-gray-300 px-3 py-2 text-right">{row.Month}</td>
                          <td className="border border-gray-300 px-3 py-2 text-right">{fmtVal(row.Accts)}</td>
                          <td className="border border-gray-300 px-3 py-2 text-right">{fmtVal(row.UnitsExpP)}</td>
                          <td className="border border-gray-300 px-3 py-2 text-right">{fmtVal(row.UnitsExpD)}</td>
                          <td className="border border-gray-300 px-3 py-2 text-right">{fmtVal(row.UnitsExpOffP)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                ) : netType === "Net Plus" ? (
                  <>
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="border border-gray-300 px-3 py-2 text-left font-bold">cust_cat</th>
                        <th className="border border-gray-300 px-3 py-2 text-right font-bold">year</th>
                        <th className="border border-gray-300 px-3 py-2 text-right font-bold">submit_month</th>
                        <th className="border border-gray-300 px-3 py-2 text-right font-bold">no_cus</th>
                        <th className="border border-gray-300 px-3 py-2 text-right font-bold">Solar meter_export_kWh</th>
                        <th className="border border-gray-300 px-3 py-2 text-right font-bold">Solar meter_import_kWh</th>
                        <th className="border border-gray-300 px-3 py-2 text-right font-bold">paid_amount</th>
                        <th className="border border-gray-300 px-3 py-2 text-right font-bold">Import units</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {exportResult.Data.map((row, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <td className="border border-gray-300 px-3 py-2 font-semibold text-gray-800 text-left">{row.Category}</td>
                          <td className="border border-gray-300 px-3 py-2 text-right">{row.Year}</td>
                          <td className="border border-gray-300 px-3 py-2 text-right">{row.Month}</td>
                          <td className="border border-gray-300 px-3 py-2 text-right">{fmtVal(row.Accts)}</td>
                          <td className="border border-gray-300 px-3 py-2 text-right">{fmtVal(row.UnitsExpP)}</td>
                          <td className="border border-gray-300 px-3 py-2 text-right">{fmtVal(row.UnitsExpD)}</td>
                          <td className="border border-gray-300 px-3 py-2 text-right">{fmtVal(row.UnitsExpOffP)}</td>
                          <td className="border border-gray-300 px-3 py-2 text-right">{fmtVal(row.UnitsImpD)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                ) : netType === "Net Accounting" ? (
                  <>
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="border border-gray-300 px-3 py-2 text-left font-bold">Category</th>
                        <th className="border border-gray-300 px-3 py-2 text-right font-bold">Year</th>
                        <th className="border border-gray-300 px-3 py-2 text-right font-bold">Month</th>
                        <th className="border border-gray-300 px-3 py-2 text-right font-bold">No of Accounts</th>
                        <th className="border border-gray-300 px-3 py-2 text-right font-bold">kWh_purchased</th>
                        <th className="border border-gray-300 px-3 py-2 text-right font-bold">units_exprt_kWh</th>
                        <th className="border border-gray-300 px-3 py-2 text-right font-bold">units_imprt_kWh</th>
                        <th className="border border-gray-300 px-3 py-2 text-right font-bold">paid_amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {exportResult.Data.map((row, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <td className="border border-gray-300 px-3 py-2 font-semibold text-gray-800 text-left">{row.Category}</td>
                          <td className="border border-gray-300 px-3 py-2 text-right">{row.Year}</td>
                          <td className="border border-gray-300 px-3 py-2 text-right">{row.Month}</td>
                          <td className="border border-gray-300 px-3 py-2 text-right">{fmtVal(row.Accts)}</td>
                          <td className="border border-gray-300 px-3 py-2 text-right">{fmtVal(row.UnitsExpP)}</td>
                          <td className="border border-gray-300 px-3 py-2 text-right">{fmtVal(row.UnitsExpD)}</td>
                          <td className="border border-gray-300 px-3 py-2 text-right">{fmtVal(row.UnitsImpD)}</td>
                          <td className="border border-gray-300 px-3 py-2 text-right">{fmtVal(row.UnitsExpOffP)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                ) : (
                  <>
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="border border-gray-300 px-3 py-2 text-left font-bold">Category</th>
                        <th className="border border-gray-300 px-3 py-2 text-right font-bold">Year</th>
                        <th className="border border-gray-300 px-3 py-2 text-right font-bold">Month</th>
                        <th className="border border-gray-300 px-3 py-2 text-right font-bold">No of Accounts</th>
                        <th className="border border-gray-300 px-3 py-2 text-right font-bold">units_exprt_DAY_kWh</th>
                        <th className="border border-gray-300 px-3 py-2 text-right font-bold">units_exprt_PEAK_kWh</th>
                        <th className="border border-gray-300 px-3 py-2 text-right font-bold">units_exprt_OFFPEAK_kWh</th>
                        <th className="border border-gray-300 px-3 py-2 text-right font-bold">units_imprt_DAY_kWh</th>
                        <th className="border border-gray-300 px-3 py-2 text-right font-bold">units_imprt_PEAK_kWh</th>
                        <th className="border border-gray-300 px-3 py-2 text-right font-bold">units_imprt_OFFPEAK_kWh</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {exportResult.Data.map((row, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <td className="border border-gray-300 px-3 py-2 font-semibold text-gray-800 text-left">{row.Category}</td>
                          <td className="border border-gray-300 px-3 py-2 text-right">{row.Year}</td>
                          <td className="border border-gray-300 px-3 py-2 text-right">{row.Month}</td>
                          <td className="border border-gray-300 px-3 py-2 text-right">{fmtVal(row.Accts)}</td>
                          <td className="border border-gray-300 px-3 py-2 text-right">{fmtVal(row.UnitsExpD)}</td>
                          <td className="border border-gray-300 px-3 py-2 text-right">{fmtVal(row.UnitsExpP)}</td>
                          <td className="border border-gray-300 px-3 py-2 text-right">{fmtVal(row.UnitsExpOffP)}</td>
                          <td className="border border-gray-300 px-3 py-2 text-right">{fmtVal(row.UnitsImpD)}</td>
                          <td className="border border-gray-300 px-3 py-2 text-right">{fmtVal(row.UnitsImpP)}</td>
                          <td className="border border-gray-300 px-3 py-2 text-right">{fmtVal(row.UnitsImpOffP)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {reportError && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
          {reportError}
        </div>
      )}

    </div>
  );
};

export default SolarDataForUNT;
