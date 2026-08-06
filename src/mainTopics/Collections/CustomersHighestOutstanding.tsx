import React, { useState, useEffect, useRef } from "react";
import { FaFileDownload, FaPrint } from "react-icons/fa";
import { useUser } from "../../contexts/UserContext";
import { useReportScope } from "../../hooks/useReportScope";

interface Province {
  ProvinceCode: string;
  ProvinceName: string;
}

interface Division {
  RegionCode: string;
}

interface CustomerOutstandingResult {
  Province?: string;
  province?: string;
  AreaName?: string;
  areaName?: string;
  AccountNumber?: string;
  accountNumber?: string;
  CustomerName?: string;
  customerName?: string;
  Address?: string;
  address?: string;
  Telephone?: string;
  telephone?: string;
  LastCashDate?: string;
  lastCashDate?: string;
  CurrentReadingDate?: string;
  currentReadingDate?: string;
  CurrentBalance?: number;
  currentBalance?: number;
  KwhCharge?: number;
  kwhCharge?: number;
  ArrearsBalance?: number;
  arrearsBalance?: number;
  TariffCode?: string;
  tariffCode?: string;
  ArrearsMonths?: number;
  arrearsMonths?: number;
  Units?: number;
  units?: number;
}

const CustomersHighestOutstanding: React.FC = () => {
  const [scope, setScope] = useState<"Province" | "Division">("Province");
  const [selectedCode, setSelectedCode] = useState<string>("");
  const [monthsInArrears, setMonthsInArrears] = useState<number | "">("");
  const [outstandingBalance, setOutstandingBalance] = useState<number | "">("");

  const [provinces, setProvinces] = useState<Province[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);

  const [isLoadingProvinces, setIsLoadingProvinces] = useState(false);
  const [isLoadingDivisions, setIsLoadingDivisions] = useState(false);
  const [provinceError, setProvinceError] = useState<string | null>(null);
  const [divisionError, setDivisionError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<CustomerOutstandingResult[] | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 100;

  const printRef = useRef<HTMLDivElement>(null);
  const printTableRef = useRef<HTMLTableElement>(null);

  const { user } = useUser();
  const { locked } = useReportScope();

  const maroon = "text-[#7A0000]";
  const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";

  // Fetch Provinces
  useEffect(() => {
    const fetchProvinces = async () => {
      setIsLoadingProvinces(true);
      setProvinceError(null);
      try {
        let url = "/misapi/api/ordinary/province";
        if (locked["Region"]?.code) {
          url += `?regionCode=${locked["Region"].code}`;
        }
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setProvinces(data.data || []);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setProvinceError(errorMsg || "Failed to load provinces");
      } finally {
        setIsLoadingProvinces(false);
      }
    };
    fetchProvinces();
  }, [user.Level, user.RegionCode]);

  useEffect(() => {
    if (locked["Province"]) {
      setScope("Province");
      setSelectedCode(locked["Province"]!.code);
    }
  }, [scope, user.Level, user.ProvinceCode]);

  // Fetch Divisions (Regions)
  useEffect(() => {
    const fetchDivisions = async () => {
      setIsLoadingDivisions(true);
      setDivisionError(null);
      try {
        const res = await fetch("/misapi/api/ordinary/region", {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const divData = data.data || [];
        setDivisions(divData);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setDivisionError(errorMsg || "Failed to load divisions");
      } finally {
        setIsLoadingDivisions(false);
      }
    };
    fetchDivisions();
  }, []);

  // Sync selectedCode when scope changes or list loads
  useEffect(() => {
    if (locked["Province"]) return; // handled by the forcing effect above
    if (scope === "Division" && locked["Region"]) {
      setSelectedCode(locked["Region"]!.code);
      return;
    }
    if (scope === "Province" && provinces.length > 0) {
      if (!selectedCode || !provinces.some((p) => p.ProvinceCode === selectedCode)) {
        setSelectedCode(provinces[0].ProvinceCode);
      }
    } else if (scope === "Division" && divisions.length > 0) {
      if (!selectedCode || !divisions.some((d) => d.RegionCode === selectedCode)) {
        setSelectedCode(divisions[0].RegionCode);
      }
    } else {
      setSelectedCode("");
    }
  }, [scope, provinces, divisions, selectedCode, locked]);

  const handleViewReport = async () => {
    if (!selectedCode) {
      setError(`Please select a ${scope}.`);
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);
    setCurrentPage(1);

    try {
      const payload = {
        Scope: scope,
        ProvinceCode: scope === "Province" ? selectedCode : "",
        RegionCode: scope === "Division" ? selectedCode : "",
        MonthsInArrears: Number(monthsInArrears),
        OutstandingBalance: Number(outstandingBalance),
      };

      const response = await fetch("/misapi/api/collection/highest-outstanding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const payloadResponse = await response.json();

      if (!response.ok || payloadResponse?.errorMessage) {
        throw new Error(payloadResponse?.errorMessage || "Failed to fetch report data");
      }

      const backendData = payloadResponse?.data;
      if (!backendData) {
        throw new Error("No data returned from server");
      }

      setResults(backendData);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg || "Failed to fetch report");
    } finally {
      setLoading(false);
    }
  };

  const getSelectedName = () => {
    if (scope === "Province") {
      const p = provinces.find((prov) => prov.ProvinceCode === selectedCode);
      return p ? `${p.ProvinceCode} - ${p.ProvinceName}` : selectedCode;
    } else {
      const d = divisions.find((div) => div.RegionCode === selectedCode);
      return d ? d.RegionCode : selectedCode;
    }
  };

  const handlePrint = () => {
    if (!printTableRef.current) return;
    const printWindow = window.open("", "_blank", "width=1200,height=800");
    if (!printWindow) return;

    const tableHTML = printTableRef.current.outerHTML;

    printWindow.document.write(`
      <html>
        <head>
          <title>Customers with Highest Outstanding Balance (Ordinary)</title>
          <style>
            body { font-family: Arial, sans-serif; font-size: 11px; margin: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { padding: 4px 6px; border: 1px solid #d4d4d4; text-align: left; }
            th { background-color: #eaeaea; font-weight: bold; color: #222222; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .header { font-weight: bold; margin-bottom: 2px; color: #7A0000; font-size: 16px; }
            .subheader { margin-bottom: 15px; font-size: 12px; font-weight: bold; color: #7A0000; }
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
          <div class="header">Customers with Highest Outstanding Balance (Ordinary)</div>
          <div class="subheader">${getSelectedName()}</div>
          ${tableHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const downloadCSV = () => {
    if (!results || results.length === 0) return;

    const rows: string[] = [];
    rows.push("Customers with Highest Outstanding Balance (Ordinary)");
    rows.push(`Scope: ${scope} (${getSelectedName()})`);
    rows.push(`Min Months in Arrears: ${monthsInArrears}`);
    rows.push(`Min Outstanding Balance: ${outstandingBalance}`);
    rows.push("");

    if (scope === "Division") {
      rows.push("Province,Area Name,Account No,Name,Address,Telephone,Last Cash Date,Current Reading Date,Current Balance,kWh Charge,Current Balance - kWh Charge,Tariff,Months in Arrears,Units");
    } else {
      rows.push("Area Name,Account No,Name,Address,Telephone,Last Cash Date,Current Reading Date,Current Balance,kWh Charge,Current Balance - kWh Charge,Tariff,Months in Arrears,Units");
    }

    results.forEach((r) => {
      const province = r.province || r.Province || "";
      const area = r.areaName || r.AreaName || "";
      const acct = r.accountNumber || r.AccountNumber || "";
      const name = r.customerName || r.CustomerName || "";
      const address = r.address || r.Address || "";
      const tel = r.telephone || r.Telephone || "";
      const lastCash = r.lastCashDate || r.LastCashDate || "";
      const readDate = r.currentReadingDate || r.CurrentReadingDate || "";
      const balance = r.currentBalance ?? r.CurrentBalance ?? 0;
      const charge = r.kwhCharge ?? r.KwhCharge ?? 0;
      const netBalance = r.arrearsBalance ?? r.ArrearsBalance ?? 0;
      const tariff = r.tariffCode || r.TariffCode || "";
      const months = r.arrearsMonths ?? r.ArrearsMonths ?? 0;
      const units = r.units ?? r.Units ?? 0;

      if (scope === "Division") {
        rows.push(
          `"${province.replace(/"/g, '""')}","${area.replace(/"/g, '""')}","${acct}","${name.replace(/"/g, '""')}","${address.replace(/"/g, '""')}","${tel}","${lastCash}","${readDate}",${balance},${charge},${netBalance},"${tariff}",${months.toFixed(1)},${units}`
        );
      } else {
        rows.push(
          `"${area.replace(/"/g, '""')}","${acct}","${name.replace(/"/g, '""')}","${address.replace(/"/g, '""')}","${tel}","${lastCash}","${readDate}",${balance},${charge},${netBalance},"${tariff}",${months.toFixed(1)},${units}`
        );
      }
    });

    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `HighestOutstanding_${scope}_${selectedCode}.csv`;
    a.click();
  };

  const renderTotalRow = (areaName: string, records: CustomerOutstandingResult[]) => {
    const count = records.length;
    const totalBalance = records.reduce((sum, r) => sum + (r.currentBalance ?? r.CurrentBalance ?? 0), 0);
    const totalArrears = records.reduce((sum, r) => sum + (r.arrearsBalance ?? r.ArrearsBalance ?? 0), 0);

    return (
      <tr
        key={`total-${areaName}`}
        className="font-bold border-b border-gray-300"
        style={{ backgroundColor: "#E2F0D9" }}
      >
        {scope === "Division" && <td className="p-2 border border-gray-300"></td>}
        <td className="p-2 border border-gray-300 font-bold text-gray-900">Total</td>
        <td className="p-2 border border-gray-300"></td>
        <td className="p-2 border border-gray-300 font-bold text-gray-900 text-center">{count}</td>
        <td className="p-2 border border-gray-300"></td>
        <td className="p-2 border border-gray-300"></td>
        <td className="p-2 border border-gray-300"></td>
        <td className="p-2 border border-gray-300"></td>
        <td className="p-2 border border-gray-300 text-right font-bold text-gray-900">
          {totalBalance.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </td>
        <td className="p-2 border border-gray-300"></td>
        <td className="p-2 border border-gray-300 text-right font-bold text-gray-900">
          {totalArrears.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </td>
        <td className="p-2 border border-gray-300"></td>
        <td className="p-2 border border-gray-300"></td>
        <td className="p-2 border border-gray-300"></td>
      </tr>
    );
  };

  const renderGrandTotalRow = (records: CustomerOutstandingResult[]) => {
    const count = records.length;
    const totalBalance = records.reduce((sum, r) => sum + (r.currentBalance ?? r.CurrentBalance ?? 0), 0);
    const totalArrears = records.reduce((sum, r) => sum + (r.arrearsBalance ?? r.ArrearsBalance ?? 0), 0);

    return (
      <tr
        key="grand-total"
        className="font-bold border-b border-gray-300"
        style={{ backgroundColor: "#FFF2CC" }}
      >
        {scope === "Division" && <td className="p-2 border border-gray-300"></td>}
        <td className="p-2 border border-gray-300 font-bold text-gray-900">Total</td>
        <td className="p-2 border border-gray-300"></td>
        <td className="p-2 border border-gray-300 font-bold text-gray-900 text-center">{count}</td>
        <td className="p-2 border border-gray-300"></td>
        <td className="p-2 border border-gray-300"></td>
        <td className="p-2 border border-gray-300"></td>
        <td className="p-2 border border-gray-300"></td>
        <td className="p-2 border border-gray-300 text-right font-bold text-gray-900">
          {totalBalance.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </td>
        <td className="p-2 border border-gray-300"></td>
        <td className="p-2 border border-gray-300 text-right font-bold text-gray-900">
          {totalArrears.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </td>
        <td className="p-2 border border-gray-300"></td>
        <td className="p-2 border border-gray-300"></td>
        <td className="p-2 border border-gray-300"></td>
      </tr>
    );
  };

  const renderTableRows = (recordsToRender: CustomerOutstandingResult[], startIndex: number, isPrint: boolean = false) => {
    if (!recordsToRender || recordsToRender.length === 0) {
      return (
        <tr>
          <td colSpan={scope === "Division" ? 14 : 13} className="p-6 text-center text-gray-500 font-medium">
            No records found matching the criteria.
          </td>
        </tr>
      );
    }

    const rows: React.ReactNode[] = [];
    let currentAreaRecords: CustomerOutstandingResult[] = [];
    let lastAreaName = "";

    recordsToRender.forEach((r, idx) => {
      const province = r.province || r.Province || "—";
      const area = r.areaName || r.AreaName || "";
      if (idx === 0) {
        lastAreaName = area;
      }

      if (area.trim().toLowerCase() !== lastAreaName.trim().toLowerCase()) {
        // Add the subtotal row for the completed area group using all records of this area in the report
        const allAreaRecords = results ? results.filter(
          (item) => (item.areaName || item.AreaName || "").trim().toLowerCase() === lastAreaName.trim().toLowerCase()
        ) : [];
        rows.push(renderTotalRow(lastAreaName, allAreaRecords));
        currentAreaRecords = [];
        lastAreaName = area;
      }

      currentAreaRecords.push(r);

      const accountNo = r.accountNumber || r.AccountNumber || "—";
      const name = r.customerName || r.CustomerName || "—";
      const address = r.address || r.Address || "—";
      const telephone = r.telephone || r.Telephone || "—";
      const lastCashDate = r.lastCashDate || r.LastCashDate || "—";
      const currentReadingDate = r.currentReadingDate || r.CurrentReadingDate || "—";
      const currentBalance = r.currentBalance ?? r.CurrentBalance ?? 0;
      const kwhCharge = r.kwhCharge ?? r.KwhCharge ?? 0;
      const arrearsBalance = r.arrearsBalance ?? r.ArrearsBalance ?? 0;
      const tariffCode = r.tariffCode || r.TariffCode || "—";
      const arrearsMonths = r.arrearsMonths ?? r.ArrearsMonths ?? 0;
      const units = r.units ?? r.Units ?? 0;

      const showArea = currentAreaRecords.length === 1;

      const nextRow = idx < recordsToRender.length - 1 ? recordsToRender[idx + 1] : null;
      const nextAreaName = (nextRow?.areaName || nextRow?.AreaName || "").trim().toLowerCase();
      const isLastOfArea = idx === recordsToRender.length - 1 || nextAreaName !== area.trim().toLowerCase();

      // Province grouping logic
      const showProvince = idx === 0 || province.trim().toLowerCase() !== (recordsToRender[idx - 1]?.province || recordsToRender[idx - 1]?.Province || "").trim().toLowerCase();
      const nextProvinceName = (nextRow?.province || nextRow?.Province || "").trim().toLowerCase();
      const isLastOfProvince = idx === recordsToRender.length - 1 || nextProvinceName !== province.trim().toLowerCase();

      rows.push(
        <tr
          key={`${accountNo}-${idx}`}
          className="bg-white hover:bg-gray-50 text-gray-900 border-b border-gray-300"
        >
          {scope === "Division" && (
            <td
              className="p-2 border border-gray-300 font-medium text-gray-700"
              style={{ borderBottom: isLastOfProvince ? undefined : "hidden" }}
            >
              {showProvince ? province : ""}
            </td>
          )}
          <td
            className="p-2 border border-gray-300 font-medium text-gray-700"
            style={{ borderBottom: isLastOfArea ? undefined : "hidden" }}
          >
            {showArea ? area : ""}
          </td>
          <td className="p-2 border border-gray-300 font-mono">{accountNo}</td>
          <td className="p-2 border border-gray-300">{name}</td>
          <td className="p-2 border border-gray-300">{address}</td>
          <td className="p-2 border border-gray-300">{telephone}</td>
          <td className="p-2 border border-gray-300">{lastCashDate}</td>
          <td className="p-2 border border-gray-300">{currentReadingDate}</td>
          <td className="p-2 border border-gray-300 text-right">
            {currentBalance.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </td>
          <td className="p-2 border border-gray-300 text-right">
            {kwhCharge.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </td>
          <td className="p-2 border border-gray-300 text-right font-semibold">
            {arrearsBalance.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </td>
          <td className="p-2 border border-gray-300 text-center">{tariffCode}</td>
          <td className="p-2 border border-gray-300 text-right">
            {arrearsMonths.toFixed(1)}
          </td>
          <td className="p-2 border border-gray-300 text-right">
            {units.toLocaleString("en-US", {
              maximumFractionDigits: 0,
            })}
          </td>
        </tr>
      );
    });

    // Add the subtotal row for the final area group on this page if it is globally finished
    if (currentAreaRecords.length > 0 && results) {
      const globalLastIdx = startIndex + recordsToRender.length - 1;
      const nextGlobalRow = globalLastIdx < results.length - 1 ? results[globalLastIdx + 1] : null;
      const nextGlobalAreaName = (nextGlobalRow?.areaName || nextGlobalRow?.AreaName || "").trim().toLowerCase();
      const isGlobalEnd = globalLastIdx === results.length - 1 || nextGlobalAreaName !== lastAreaName.trim().toLowerCase();

      if (isGlobalEnd) {
        const allAreaRecords = results.filter(
          (item) => (item.areaName || item.AreaName || "").trim().toLowerCase() === lastAreaName.trim().toLowerCase()
        );
        rows.push(renderTotalRow(lastAreaName, allAreaRecords));
      }
    }

    // Add the grand total row for all records combined
    if (results && results.length > 0) {
      if (isPrint) {
        rows.push(renderGrandTotalRow(results));
      } else {
        const totalPages = Math.max(1, Math.ceil(results.length / pageSize));
        const safePage = Math.min(currentPage, totalPages);
        if (safePage === totalPages) {
          rows.push(renderGrandTotalRow(results));
        }
      }
    }

    return rows;
  };

  const renderPagination = () => {
    if (!results || results.length <= pageSize) return null;

    const totalPages = Math.max(1, Math.ceil(results.length / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const startIndex = (safePage - 1) * pageSize;
    const endIndex = startIndex + pageSize;

    return (
      <div className="mt-3 flex items-center justify-between text-xs text-gray-700 font-sans print:hidden">
        <span>
          Showing {startIndex + 1}-{Math.min(endIndex, results.length)} of {results.length}
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={safePage <= 1}
            className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition"
          >
            Previous
          </button>
          <span>
            Page {safePage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={safePage >= totalPages}
            className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition"
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  if (user.Level === 50) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-sm text-center">
        <h2 className="text-lg font-bold text-[#7A0000] mb-2">Access Restricted</h2>
        <p className="text-sm text-gray-600">
          This report isn't available at your access level. Please contact your supervisor if you believe this is an error.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 bg-white rounded-xl shadow border border-gray-200 text-sm font-sans max-h-[82vh] overflow-y-auto">
      {!results && (
        <>
          <h2 className={`text-xl font-bold mb-6 ${maroon}`}>
            Customers with Highest Outstanding Balance (Ordinary)
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-xs">{error}</p>
            </div>
          )}

          <div className="border border-gray-200 rounded-xl p-4 bg-white shadow mb-6">
            {/* Inputs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">

              {/* Scope Dropdown */}
              <div className="flex flex-col">
                <label className={`${maroon} text-xs font-medium mb-1`}>Select Scope:</label>
                {locked["Province"] ? (
                  <div className="w-full px-2 py-1.5 text-xs border rounded-md bg-gray-100 text-gray-500 border-gray-200">
                    Province
                  </div>
                ) : (
                  <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value as "Province" | "Division")}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent bg-white text-gray-800"
                    disabled={loading}
                  >
                    <option value="Province">Province</option>
                    <option value="Division">Division</option>
                  </select>
                )}
              </div>

              {/* Dropdown for Province or Division */}
              <div className="flex flex-col">
                <label className={`${maroon} text-xs font-medium mb-1`}>
                  {scope === "Province" ? "Province" : "Division"}
                </label>
                {scope === "Province" ? (
                  locked["Province"] ? (
                    <select
                      disabled
                      value={locked["Province"]!.code}
                      className="w-full px-2 py-1.5 text-xs border rounded-md bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                    >
                      <option value={locked["Province"]!.code}>
                        {locked["Province"]!.name ? `${locked["Province"]!.code} - ${locked["Province"]!.name}` : locked["Province"]!.code}
                      </option>
                    </select>
                  ) : isLoadingProvinces ? (
                    <div className="py-1 text-xs text-gray-500">Loading provinces...</div>
                  ) : provinceError ? (
                    <div className="text-red-600 text-xs py-1">{provinceError}</div>
                  ) : (
                    <select
                      value={selectedCode}
                      onChange={(e) => setSelectedCode(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent bg-white text-gray-800"
                      disabled={loading}
                    >
                      <option value="">— Select Province —</option>
                      {provinces.map((p) => (
                        <option key={p.ProvinceCode} value={p.ProvinceCode}>
                          {p.ProvinceCode} - {p.ProvinceName}
                        </option>
                      ))}
                    </select>
                  )
                ) : locked["Region"] ? (
                  <select
                    disabled
                    value={locked["Region"]!.code}
                    className="w-full px-2 py-1.5 text-xs border rounded-md bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                  >
                    <option value={locked["Region"]!.code}>{locked["Region"]!.code}</option>
                  </select>
                ) : isLoadingDivisions ? (
                  <div className="py-1 text-xs text-gray-500">Loading divisions...</div>
                ) : divisionError ? (
                  <div className="text-red-600 text-xs py-1">{divisionError}</div>
                ) : (
                  <select
                    value={selectedCode}
                    onChange={(e) => setSelectedCode(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent bg-white text-gray-800"
                    disabled={loading}
                  >
                    <option value="">— Select Division —</option>
                    {divisions.map((d) => (
                      <option key={d.RegionCode} value={d.RegionCode}>
                        {d.RegionCode}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Months In Arrears */}
              <div className="flex flex-col">
                <label className={`${maroon} text-xs font-medium mb-1`}>
                  No of Months in Arrears
                </label>
                <input
                  type="number"
                  value={monthsInArrears}
                  onChange={(e) => {
                    const val = e.target.value;
                    setMonthsInArrears(val === "" ? "" : Number(val));
                  }}
                  min={0}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent"
                  disabled={loading}
                />
              </div>

              {/* Outstanding Balance */}
              <div className="flex flex-col">
                <label className={`${maroon} text-xs font-medium mb-1`}>
                  Outstanding Balance
                </label>
                <input
                  type="number"
                  value={outstandingBalance}
                  onChange={(e) => {
                    const val = e.target.value;
                    setOutstandingBalance(val === "" ? "" : Number(val));
                  }}
                  min={0}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="w-full mt-6 flex justify-end">
              <button
                onClick={handleViewReport}
                disabled={loading}
                className={`px-6 py-2 rounded-md font-medium transition-opacity duration-300 shadow ${maroonGrad} text-white ${loading ? "opacity-70 cursor-not-allowed" : "hover:opacity-90"
                  }`}
              >
                {loading ? "Loading..." : "View Report"}
              </button>
            </div>
          </div>
        </>
      )}

      {results && (
        <div ref={printRef} className="mt-4 p-4 rounded-xl shadow border border-gray-200 w-full bg-white">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 print:hidden">
            <div>
              <h2 className={`text-xl font-bold ${maroon} mb-1`}>
                Customers with Highest Outstanding Balance (Ordinary)
              </h2>
              <div className="text-xs text-gray-700 font-bold">
                {getSelectedName()}
              </div>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={downloadCSV}
                className="flex items-center gap-1 px-3 py-1.5 border border-blue-400 text-blue-700 bg-white rounded-md text-xs font-medium shadow-sm hover:bg-blue-50 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-200 transition"
              >
                <FaFileDownload className="w-3 h-3" /> CSV
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-1 px-3 py-1.5 border border-green-400 text-green-700 bg-white rounded-md text-xs font-medium shadow-sm hover:bg-green-50 hover:text-green-800 focus:outline-none focus:ring-2 focus:ring-green-200 transition"
              >
                <FaPrint className="w-3 h-3" /> PDF
              </button>
              <button
                onClick={() => setResults(null)}
                className="px-4 py-1.5 bg-[#7A0000] hover:bg-[#A52A2A] text-xs rounded-md text-white flex items-center transition"
              >
                Back to Form
              </button>
            </div>
          </div>

          {/* Report header matching screenshot when printing/viewing */}
          <div className="hidden print:block mb-4">
            <h2 className="text-xl font-bold text-[#7A0000] mb-1">
              Customers with Highest Outstanding Balance (Ordinary)
            </h2>
            <div className="text-sm font-bold text-[#7A0000]">
              {getSelectedName()}
            </div>
          </div>

          <div className="overflow-x-auto max-h-[600px] overflow-y-auto border border-gray-300 rounded-lg">
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-[#EAEAEA] text-gray-800 font-semibold border-b border-gray-300">
                <tr>
                  {scope === "Division" && (
                    <th className="p-2 border border-gray-300 font-semibold text-left">Province</th>
                  )}
                  <th className="p-2 border border-gray-300 font-semibold text-left">Area Name</th>
                  <th className="p-2 border border-gray-300 font-semibold text-left">Account No</th>
                  <th className="p-2 border border-gray-300 font-semibold text-left">Name</th>
                  <th className="p-2 border border-gray-300 font-semibold text-left">Address</th>
                  <th className="p-2 border border-gray-300 font-semibold text-left">Telephone</th>
                  <th className="p-2 border border-gray-300 font-semibold text-left">Last Cash Date</th>
                  <th className="p-2 border border-gray-300 font-semibold text-left">Current Reading Date</th>
                  <th className="p-2 border border-gray-300 font-semibold text-right">Current Balance</th>
                  <th className="p-2 border border-gray-300 font-semibold text-right">kWh Charge</th>
                  <th className="p-2 border border-gray-300 font-semibold text-right">Current Balance - kWh Charge</th>
                  <th className="p-2 border border-gray-300 font-semibold text-center">Tariff</th>
                  <th className="p-2 border border-gray-300 font-semibold text-right">Months in Arrears</th>
                  <th className="p-2 border border-gray-300 font-semibold text-right">Units</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const totalPages = results ? Math.max(1, Math.ceil(results.length / pageSize)) : 1;
                  const safePage = Math.min(currentPage, totalPages);
                  const startIndex = (safePage - 1) * pageSize;
                  const endIndex = startIndex + pageSize;
                  const paginatedResults = results ? results.slice(startIndex, endIndex) : [];

                  return renderTableRows(paginatedResults, startIndex, false);
                })()}
              </tbody>
            </table>
          </div>

          {renderPagination()}

          {/* Hidden full table for printing */}
          <div className="hidden">
            <table ref={printTableRef} className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  {scope === "Division" && (
                    <th className="p-2 border border-gray-300 font-semibold text-left">Province</th>
                  )}
                  <th className="p-2 border border-gray-300 font-semibold text-left">Area Name</th>
                  <th className="p-2 border border-gray-300 font-semibold text-left">Account No</th>
                  <th className="p-2 border border-gray-300 font-semibold text-left">Name</th>
                  <th className="p-2 border border-gray-300 font-semibold text-left">Address</th>
                  <th className="p-2 border border-gray-300 font-semibold text-left">Telephone</th>
                  <th className="p-2 border border-gray-300 font-semibold text-left">Last Cash Date</th>
                  <th className="p-2 border border-gray-300 font-semibold text-left">Current Reading Date</th>
                  <th className="p-2 border border-gray-300 font-semibold text-right">Current Balance</th>
                  <th className="p-2 border border-gray-300 font-semibold text-right">kWh Charge</th>
                  <th className="p-2 border border-gray-300 font-semibold text-right">Current Balance - kWh Charge</th>
                  <th className="p-2 border border-gray-300 font-semibold text-center">Tariff</th>
                  <th className="p-2 border border-gray-300 font-semibold text-right">Months in Arrears</th>
                  <th className="p-2 border border-gray-300 font-semibold text-right">Units</th>
                </tr>
              </thead>
              <tbody>
                {renderTableRows(results || [], 0, true)}
              </tbody>
            </table>
          </div>

          <div className="mt-3 text-2xs text-gray-500 print:hidden">
            Generated on: {new Date().toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomersHighestOutstanding;
