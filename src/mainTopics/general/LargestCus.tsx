/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef } from "react";
import { FaArrowLeft, FaFileDownload, FaPrint } from "react-icons/fa";
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

interface LargestCustomer {
  consumptionKwh: number;
  outstandingAmount: number;
  accountNumber?: string;
  customerName?: string;
  address?: string;
  area?: string;
  province?: string;
  region?: string;
  tariffCategory?: string;

  // Backend fields
  kwhCons?: number;          // Largest Customers
  kwh_charge?: number;       // Largest Outstanding Customers
  currentBalance?: number;
  KwhCons?: number;

  AccountNumber?: string;
  CustomerName?: string;
  Address?: string;
  Area?: string;
  Province?: string;
  Region?: string;

  // Tariff fields
  Tariff?: string;
  TariffName?: string;
  TariffCode?: string;
  tariff?: string;
  tariffName?: string;
  tariffCode?: string;
  tariff_code?: string | number;
}

const LargestCus: React.FC = () => {
  const maroon = "text-[#7A0000]";
  const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";

  const [selectedOption, setSelectedOption] = useState<string>("Area");
  const [inputValue, setInputValue] = useState<string>("");
  const [billCycleValue, setBillCycleValue] = useState<string>("");
  const [selectedAreaName, setSelectedAreaName] = useState<string>("");
  const [selectedProvinceName, setSelectedProvinceName] = useState<string>("");
  const [selectedRegionName, setSelectedRegionName] = useState<string>("");
  const [apiType, setApiType] = useState<"LargestCustomers" | "LargestOutstandingCustomers">("LargestCustomers");

  const [areas, setAreas] = useState<Area[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [billCycleOptions, setBillCycleOptions] = useState<BillCycleOption[]>([]);

  const [isLoadingAreas, setIsLoadingAreas] = useState(false);
  const [isLoadingProvinces, setIsLoadingProvinces] = useState(false);
  const [isLoadingDivisions, setIsLoadingDivisions] = useState(false);
  const [isLoadingBillCycles, setIsLoadingBillCycles] = useState(false);

  const [areaError, setAreaError] = useState<string | null>(null);
  const [provinceError, setProvinceError] = useState<string | null>(null);
  const [divisionError, setDivisionError] = useState<string | null>(null);
  const [billCycleError, setBillCycleError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [largestCustomers, setLargestCustomers] = useState<LargestCustomer[]>([]);
  const [reportVisible, setReportVisible] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [, setRawResponse] = useState<any>(null);

  const { user } = useUser();
  const { allowedCategories, locked } = useReportScope();

  const printRef = useRef<HTMLDivElement>(null);

  const columnTitle =
    selectedOption === "Area" ? "Area" :
      selectedOption === "Province" ? "Province" :
        selectedOption === "Division" ? "Region" : "Area / Province / Region";

  const showConsumption = apiType === "LargestCustomers";
  const showOutstanding = apiType === "LargestOutstandingCustomers";

  // ==================== FETCH DROPDOWN DATA ====================
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
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setAreas(data.data || []);
      } catch (err: any) {
        setAreaError(err.message || "Failed to load areas");
      } finally {
        setIsLoadingAreas(false);
      }
    };
    fetchAreas();
  }, [user.Level, user.RegionCode, user.ProvinceCode]);

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
      } catch (err: any) {
        setProvinceError(err.message || "Failed to load provinces");
      } finally {
        setIsLoadingProvinces(false);
      }
    };
    fetchProvinces();
  }, [user.Level, user.RegionCode]);

  useEffect(() => {
    const fetchDivisions = async () => {
      setIsLoadingDivisions(true);
      setDivisionError(null);
      try {
        const res = await fetch("/misapi/api/ordinary/region", { headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setDivisions(data.data || []);
      } catch (err: any) {
        setDivisionError(err.message || "Failed to load divisions");
      } finally {
        setIsLoadingDivisions(false);
      }
    };
    fetchDivisions();
  }, []);

  useEffect(() => {
    const key = selectedOption === "Division" ? "Region" : selectedOption;
    const lock = locked[key as keyof typeof locked];
    if (lock) {
      setInputValue(lock.code);
      const label = lock.name ? `${lock.code} - ${lock.name}` : lock.code;
      if (key === "Area") setSelectedAreaName(label);
      else if (key === "Province") setSelectedProvinceName(label);
      else if (key === "Region") setSelectedRegionName(label);
    }
  }, [selectedOption, user.Level, user.RegionCode, user.ProvinceCode, user.ProvinceName, user.AreaCode, user.AreaName]);

  useEffect(() => {
    const fetchBillCycles = async () => {
      setIsLoadingBillCycles(true);
      setBillCycleError(null);
      try {
        const res = await fetch("/misapi/api/billcycle/max", { headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.data?.BillCycles?.length > 0) {
          const maxNum = parseInt(data.data.MaxBillCycle, 10);
          const options = data.data.BillCycles.map((cycle: string, i: number) => ({
            display: `${maxNum - i} - ${cycle}`,
            code: (maxNum - i).toString(),
          }));
          setBillCycleOptions(options.reverse());
        }
      } catch (err: any) {
        setBillCycleError(err.message || "Failed to load bill cycles");
      } finally {
        setIsLoadingBillCycles(false);
      }
    };
    fetchBillCycles();
  }, []);

  // ==================== GENERATE REPORT ====================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billCycleValue) {
      setReportError("Please select a Bill Cycle");
      return;
    }

    setLoading(true);
    setReportError(null);
    setLargestCustomers([]);
    setRawResponse(null);
    setReportVisible(false);

    try {
      // ✅ Updated to published server URL
      let endpoint = `http://10.128.1.59:5030/api/${apiType}/`;

      if (selectedOption === "Area") endpoint += "area";
      else if (selectedOption === "Province") endpoint += "province";
      else if (selectedOption === "Division") endpoint += "region";
      else endpoint += "ceb";

      const payload: any = {
        billCycle: billCycleValue,
        BillCycle: billCycleValue,
        take: 50,
      };

      if (selectedOption === "Area" && inputValue) {
        payload.areaCode = inputValue;
        payload.AreaCode = inputValue;
      } else if (selectedOption === "Province" && inputValue) {
        payload.provinceCode = inputValue;
        payload.ProvinceCode = inputValue;
        payload.ProvCode = inputValue;
      } else if (selectedOption === "Division" && inputValue) {
        payload.regionCode = inputValue;
        payload.RegionCode = inputValue;
        payload.Region = inputValue;
      } else if (selectedOption === "Entire CEB") {
        payload.AreaCode = "";
        payload.ProvCode = "";
        payload.Region = "";
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Accept": "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status} – ${errorText}`);
      }

      const result = await response.json();
      console.log("✅ RAW API RESPONSE:", result);
      setRawResponse(result);

      let customers: LargestCustomer[] = [];
      if (Array.isArray(result)) customers = result;
      else if (Array.isArray(result.data)) customers = result.data;
      else if (Array.isArray(result.value)) customers = result.value;
      else if (Array.isArray(result.records)) customers = result.records;
      else {
        const firstArray = Object.values(result).find((v) => Array.isArray(v));
        if (firstArray) customers = firstArray as LargestCustomer[];
      }

      const normalized = customers.map((c) => ({
        ...c,
        accountNumber: c.accountNumber || c.AccountNumber,
        customerName: c.customerName || c.CustomerName,
        address: c.address || c.Address || "",
        area: c.area || c.Area,
        province: c.province || c.Province,
        region: c.region || c.Region,
        tariffCategory: String(
          c.tariff_code ??
          c.tariffCode ??
          c.TariffCode ??
          c.tariff ??
          c.Tariff ??
          c.TariffName ??
          c.tariffName ??
          c.tariffCategory ??
          c.tariffCategory ??
          "—"
        ),
        consumptionKwh: apiType === "LargestCustomers"
          ? (c.kwhCons ?? c.KwhCons ?? 0)
          : (c.kwh_charge ?? 0),
        outstandingAmount: c.currentBalance ?? 0,
      }));

      normalized.sort((a, b) => b.outstandingAmount - a.outstandingAmount);

      setLargestCustomers(normalized);
      setReportVisible(true);
    } catch (err: any) {
      setReportError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  // ==================== CSV EXPORT ====================
  const downloadAsCSV = () => {
    if (!largestCustomers.length) return;

    const headers = [
      "Rank",
      showConsumption ? "Consumption (kWh)" : "Outstanding (LKR)",
      "Account Number",
      "Customer Name",
      "Address",
      columnTitle,
      "Tariff"
    ];

    const rows = largestCustomers.map((c, idx) => {
      const row = [
        idx + 1,
        showConsumption ? (c.consumptionKwh ?? "") : (c.outstandingAmount ?? ""),
        c.accountNumber || "",
        c.customerName || "",
        c.address || "",
        c.area || c.province || c.region || "",
        c.tariffCategory || "",
      ];
      return row;
    });

    const csvContent = [
      `${apiType} – Top 50`,
      `Scope: ${selectedOption === "Entire CEB" ? "Entire CEB" : `${selectedOption}: ${inputValue || selectedAreaName}`}`,
      `Bill Cycle: ${billCycleValue}`,
      `Generated: ${new Date().toLocaleDateString()}`,
      "",
      headers.map(h => `"${h}"`).join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${apiType}_Top50_${billCycleValue}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // ==================== PRINT PDF ====================
  const printPDF = () => {
    if (!printRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const scope = selectedOption === "Entire CEB"
      ? "Entire CEB"
      : `${selectedOption}: ${selectedOption === "Area" ? selectedAreaName : selectedOption === "Province" ? selectedProvinceName : selectedOption === "Division" ? selectedRegionName : inputValue}`;

    const now = new Date().toLocaleString();

    printWindow.document.write(`
      <html>
        <head>
          <title></title>
          <style>
            body { 
              font-family: Arial; 
              font-size: 10pt; 
              margin: 15mm; 
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
            }
            th, td { 
              border: 1px solid #ccc; 
              padding: 6px 8px; 
            }
            th { 
              background: #f0f0f0; 
            }
            .right { 
              text-align: right; 
            }
            .header { 
              color: #7A0000; 
              font-size: 18pt; 
              font-weight: bold; 
              text-align: center; 
              margin-bottom: 10px; 
            }
            .sub { 
              font-size: 11pt; 
              margin-bottom: 20px; 
              text-align: center; 
            }
            .footer { 
              position: fixed; 
              bottom: 10mm; 
              right: 15mm; 
              font-size: 9pt; 
              color: #555; 
              text-align: right; 
            }
            @page { 
              margin: 15mm; 
            }
          </style>
        </head>
        <body>
          <div class="header">${apiType.toUpperCase()} – TOP 50</div>
          <div class="sub">Scope: ${scope}<br>Bill Cycle: ${billCycleValue}</div>
          ${printRef.current.innerHTML}
          <div class="footer">Generated on ${now} | CEB</div>
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

  return (
    <div className="max-w-7xl mx-auto p-5 bg-white rounded-xl shadow-lg border border-gray-200 text-sm font-sans">
      {!reportVisible && (
        <>
          <h2 className={`text-2xl font-bold mb-6 ${maroon}`}>
            Largest Outstanding Customers Details
          </h2>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5 items-end">
              <div className="flex flex-col">
                <label className={`${maroon} text-xs font-semibold mb-1.5`}>Report Type</label>
                <select
                  value={apiType}
                  onChange={(e) => setApiType(e.target.value as "LargestCustomers" | "LargestOutstandingCustomers")}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000]"
                >
                  <option value="LargestCustomers">Largest Customers</option>
                  <option value="LargestOutstandingCustomers">Largest Outstanding Customers</option>
                </select>
              </div>

              <div className="flex flex-col">
                <label className={`${maroon} text-xs font-semibold mb-1.5`}>Select Scope</label>
                <select
                  value={selectedOption}
                  onChange={(e) => {
                    setSelectedOption(e.target.value);
                    setInputValue("");
                    setSelectedAreaName("");
                    setSelectedProvinceName("");
                    setSelectedRegionName("");
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000]"
                >
                  {allowedCategories.map((cat) => (
                    <option key={cat} value={cat === "Region" ? "Division" : cat}>
                      {cat === "Region" ? "Division (Region)" : cat}
                    </option>
                  ))}
                </select>
              </div>

              {selectedOption !== "Entire CEB" && (
                <div className="flex flex-col">
                  <label className={`${maroon} text-xs font-semibold mb-1.5`}>
                    {selectedOption === "Area" ? "Area" : selectedOption === "Province" ? "Province" : "Division"}
                  </label>

                  {selectedOption === "Area" &&
                    (locked["Area"] ? (
                      <select
                        disabled
                        value={locked["Area"].code}
                        className="w-full px-3 py-2 text-sm border rounded-md bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                      >
                        <option value={locked["Area"].code}>
                          {locked["Area"].name ? `${locked["Area"].code} - ${locked["Area"].name}` : locked["Area"].code}
                        </option>
                      </select>
                    ) : isLoadingAreas ? (
                      <div className="py-2.5 text-gray-500">Loading areas...</div>
                    ) : areaError ? (
                      <div className="text-red-600 py-2.5 text-xs">{areaError}</div>
                    ) : (
                      <select
                        value={inputValue}
                        onChange={(e) => {
                          const code = e.target.value;
                          setInputValue(code);
                          const area = areas.find((a) => a.AreaCode === code);
                          setSelectedAreaName(area ? `${code} - ${area.AreaName}` : code);
                        }}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000]"
                        required
                      >
                        <option value="">— Select Area —</option>
                        {areas.map((a) => (
                          <option key={a.AreaCode} value={a.AreaCode}>
                            {a.AreaCode} – {a.AreaName}
                          </option>
                        ))}
                      </select>
                    ))}

                  {selectedOption === "Province" &&
                    (locked["Province"] ? (
                      <select
                        disabled
                        value={locked["Province"].code}
                        className="w-full px-3 py-2 text-sm border rounded-md bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                      >
                        <option value={locked["Province"].code}>
                          {locked["Province"].name ? `${locked["Province"].code} - ${locked["Province"].name}` : locked["Province"].code}
                        </option>
                      </select>
                    ) : isLoadingProvinces ? (
                      <div className="py-2.5 text-gray-500">Loading provinces...</div>
                    ) : provinceError ? (
                      <div className="text-red-600 py-2.5 text-xs">{provinceError}</div>
                    ) : (
                      <select
                        value={inputValue}
                        onChange={(e) => {
                          const code = e.target.value;
                          setInputValue(code);
                          const p = provinces.find((p) => p.ProvinceCode === code);
                          setSelectedProvinceName(p ? `${code} - ${p.ProvinceName}` : code);
                        }}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000]"
                        required
                      >
                        <option value="">— Select Province —</option>
                        {provinces.map((p) => (
                          <option key={p.ProvinceCode} value={p.ProvinceCode}>
                            {p.ProvinceCode} – {p.ProvinceName}
                          </option>
                        ))}
                      </select>
                    ))}

                  {selectedOption === "Division" &&
                    (locked["Region"] ? (
                      <select
                        disabled
                        value={locked["Region"].code}
                        className="w-full px-3 py-2 text-sm border rounded-md bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                      >
                        <option value={locked["Region"].code}>{locked["Region"].code}</option>
                      </select>
                    ) : isLoadingDivisions ? (
                      <div className="py-2.5 text-gray-500">Loading divisions...</div>
                    ) : divisionError ? (
                      <div className="text-red-600 py-2.5 text-xs">{divisionError}</div>
                    ) : (
                      <select
                        value={inputValue}
                        onChange={(e) => {
                          const code = e.target.value;
                          setInputValue(code);
                          setSelectedRegionName(code);
                        }}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000]"
                        required
                      >
                        <option value="">— Select Division —</option>
                        {divisions.map((d) => (
                          <option key={d.RegionCode} value={d.RegionCode}>
                            {d.RegionCode}
                          </option>
                        ))}
                      </select>
                    ))}
                </div>
              )}

              <div className="flex flex-col">
                <label className={`${maroon} text-xs font-semibold mb-1.5`}>Bill Cycle</label>
                {isLoadingBillCycles ? (
                  <div className="py-2.5 text-gray-500">Loading bill cycles...</div>
                ) : billCycleError ? (
                  <div className="text-red-600 py-2.5 text-xs">{billCycleError}</div>
                ) : (
                  <select
                    value={billCycleValue}
                    onChange={(e) => setBillCycleValue(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000]"
                    required
                  >
                    <option value="">— Select Bill Cycle —</option>
                    {billCycleOptions.map((opt) => (
                      <option key={opt.code} value={opt.code}>
                        {opt.display}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <button
                type="submit"
                disabled={loading || !billCycleValue}
                className={`px-8 py-2.5 rounded-lg font-medium text-white shadow-md ${maroonGrad} transition ${loading ? "opacity-60 cursor-not-allowed" : "hover:brightness-110"
                  }`}
              >
                {loading ? "Loading..." : `Generate ${apiType} Report (Top 50)`}
              </button>
            </div>
          </form>

          {reportError && !reportVisible && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">{reportError}</div>
          )}
        </>
      )}

      {reportVisible && (
        <div className="mt-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div>
              <h2 className={`text-2xl font-bold ${maroon}`}>{apiType} – Top 50</h2>
              <p className="text-sm text-gray-600 mt-1">
                {selectedOption === "Entire CEB"
                  ? "Entire CEB"
                  : `${selectedOption}: ${selectedOption === "Area" ? selectedAreaName : selectedOption === "Province" ? selectedProvinceName : selectedOption === "Division" ? selectedRegionName : inputValue}`}
                {" • "} Bill Cycle: {billCycleValue} • Records: <strong>{largestCustomers.length}</strong>
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={downloadAsCSV}
                className="flex items-center gap-2 px-5 py-2 border border-blue-600 text-blue-700 rounded-lg hover:bg-blue-50 transition"
              >
                <FaFileDownload /> Export CSV
              </button>
              <button
                onClick={printPDF}
                className="flex items-center gap-2 px-5 py-2 border border-green-600 text-green-700 rounded-lg hover:bg-green-50 transition"
              >
                <FaPrint /> Print
              </button>
              <button
                onClick={() => setReportVisible(false)}
                className={`flex items-center gap-2 px-6 py-2 ${maroonGrad} text-white rounded-lg shadow hover:brightness-110 transition`}
              >
                <FaArrowLeft /> Back
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-gray-300 rounded-lg max-h-[70vh]">
            <div ref={printRef}>
              <table className="w-full text-sm divide-y divide-gray-200 min-w-[1200px]">
                <thead className="bg-gray-100 sticky top-0 z-10">
                  <tr>
                    <th className="px-5 py-3 text-left font-semibold w-14">Rank</th>

                    {showConsumption && (
                      <th className="px-5 py-3 text-right font-semibold">Consumption (kWh)</th>
                    )}
                    {showOutstanding && (
                      <th className="px-5 py-3 text-right font-semibold">Outstanding (LKR)</th>
                    )}

                    <th className="px-5 py-3 text-left font-semibold">Account Number</th>
                    <th className="px-5 py-3 text-left font-semibold">Customer Name</th>
                    <th className="px-5 py-3 text-left font-semibold">Address</th>
                    <th className="px-5 py-3 text-left font-semibold">{columnTitle}</th>
                    <th className="px-5 py-3 text-left font-semibold">Tariff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {largestCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={showConsumption || showOutstanding ? 7 : 6} className="text-center py-16 text-red-600 font-medium">
                        No data returned
                      </td>
                    </tr>
                  ) : (
                    largestCustomers.map((cust, index) => (
                      <tr key={cust.accountNumber || index} className="hover:bg-gray-50">
                        <td className="px-5 py-3 text-center font-medium text-red-700">{index + 1}</td>

                        {showConsumption && (
                          <td className="px-5 py-3 text-right font-medium text-red-700">
                            {(cust.consumptionKwh ?? 0).toLocaleString()}
                          </td>
                        )}
                        {showOutstanding && (
                          <td className="px-5 py-3 text-right font-medium text-red-700">
                            {(cust.outstandingAmount ?? 0).toLocaleString()}
                          </td>
                        )}

                        <td className="px-5 py-3 font-mono">{cust.accountNumber || "—"}</td>
                        <td className="px-5 py-3">{cust.customerName || "—"}</td>
                        <td className="px-5 py-3">{cust.address || "—"}</td>
                        <td className="px-5 py-3">
                          {selectedOption === "Area"
                            ? selectedAreaName
                            : selectedOption === "Province"
                              ? selectedProvinceName
                              : selectedOption === "Division"
                                ? selectedRegionName
                                : selectedOption === "Entire CEB"
                                  ? "Entire CEB"
                                  : cust.area || cust.province || cust.region || "—"}
                        </td>
                        <td className="px-5 py-3">{cust.tariffCategory}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LargestCus;