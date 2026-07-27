import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DebtorsModal from "../../components/mainTopics/AnalysisDebtors/DebtorsModal";
import { useUser } from "../../contexts/UserContext";
import { useReportScope } from "../../hooks/useReportScope";

interface Area {
  AreaCode: string;
  AreaName: string;
  ErrorMessage?: string | null;
}


interface BillCycleOption {
  display: string;
  code: string;
}

interface DebtorSummary {
  Type: string;
  CustType: string;
  TotDebtors: number;
  Month01: number;
  Month02: number;
  Month03: number;
  Month04: number;
  Month01Percent?: number;
  Month02Percent?: number;
  Month03Percent?: number;
  Month04Percent?: number;
  ErrorMessage: string | null;
}


const DebtorsAnalysis: React.FC = () => {
  // Colors
  const maroon = "text-[#7A0000]";
  const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";
  const chartColors = [
    '#1E3A8A', '#10B981', '#F59E0B', '#6366F1',
    '#3B82F6', '#6B7280', '#9CA3AF', '#D97706'
  ];

  // // Region codes constant
  // const regionCodes = [
  //   { code: "R1", name: "Region 01" },
  //   { code: "R2", name: "Region 02" },
  //   { code: "R3", name: "Region 03" },
  //   { code: "R4", name: "Region 04" }
  // ];

  // // Province codes constant
  // const provinceCodes = [
  //   { code: "1", name: "Western Province North" },
  //   { code: "2", name: "Western Province South" },
  //   { code: "3", name: "Colombo City" },
  //   { code: "4", name: "Northern Province" },
  //   { code: "5", name: "Central Province" },
  //   { code: "6", name: "Uva Province" },
  //   { code: "7", name: "Eastern Province" },
  //   { code: "8", name: "North Western Province" },
  //   { code: "9", name: "Sabaragamuwa Province" },
  //   { code: "A", name: "North Central Province" },
  //   { code: "B", name: "Southern Province" },
  //   { code: "C", name: "Western Province South 2" },
  //   { code: "D", name: "North Western Province 2" },
  //   { code: "E", name: "Central Province 2" },
  //   { code: "F", name: "Southern Province 2" }
  // ];

  const { user } = useUser();
  const { allowedCategories, locked } = useReportScope();
  const [regionCodes, setRegionCodes] = useState<{ code: string; name: string }[]>([]);
  const [provinceCodes, setProvinceCodes] = useState<{ code: string; name: string }[]>([]);

  // Main state
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState({
    ordinary: [] as DebtorSummary[],
    bulk: [] as DebtorSummary[]
  });
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    option: "A",
    cycle: "",
    areaCode: "",
    showOrdinary: true,
    showBulk: true
  });
  const [areas, setAreas] = useState<Area[]>([]);
  const [billCycleOptions, setBillCycleOptions] = useState<BillCycleOption[]>([]);
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);

  // Helper functions
  const generateBillCycleOptions = (billCycles: string[], maxCycle: string): BillCycleOption[] => {
    const maxCycleNum = parseInt(maxCycle);
    return billCycles.map((cycle, index) => ({
      display: cycle,
      code: (maxCycleNum - index).toString()
    }));
  };

  // Helper function to get formatted bill cycle display
  const getFormattedBillCycle = (): string => {
    const cycleOption = billCycleOptions.find(c => c.code === formData.cycle);
    return cycleOption ? `${formData.cycle} - ${cycleOption.display}` : formData.cycle;
  };

  // Function to calculate percentages for each row
  const calculatePercentages = (data: DebtorSummary[]): DebtorSummary[] => {
    return data.map(row => {
      const totDebtors = row.TotDebtors || 0;
      const absTotDebtors = Math.abs(totDebtors);
      return {
        ...row,
        Month01Percent: absTotDebtors !== 0 ? parseFloat((((row.Month01 || 0) / absTotDebtors) * 100).toFixed(2)) : 0,
        Month02Percent: absTotDebtors !== 0 ? parseFloat((((row.Month02 || 0) / absTotDebtors) * 100).toFixed(2)) : 0,
        Month03Percent: absTotDebtors !== 0 ? parseFloat((((row.Month03 || 0) / absTotDebtors) * 100).toFixed(2)) : 0,
        Month04Percent: absTotDebtors !== 0 ? parseFloat((((row.Month04 || 0) / absTotDebtors) * 100).toFixed(2)) : 0,
      };
    });
  };

  const formatPercentage = (value: number | undefined): string => {
    if (value === undefined || value === null || value === 0) return "-";
    const absValue = Math.abs(value);
    return value < 0 ? `(${absValue})` : `${absValue}`;
  };

  const fetchWithErrorHandling = async (url: string) => {
    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json'
        }
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

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Expected JSON response but got ${contentType}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error fetching ${url}:`, error);
      throw error;
    }
  };

  // Fetch initial data
  useEffect(() => {
  const fetchInitialData = async () => {
    setInitialLoading(true);
    setError(null);
    try {
      // Fetch all areas (no query param needed — /misapi/api/areas already
      // returns ProvCode and Region on every row), then filter client-side.
      const areaData = await fetchWithErrorHandling("/misapi/api/areas");
      let filteredAreas = areaData.data || [];
      if (locked["Region"]?.code) {
        filteredAreas = filteredAreas.filter(
          (a: any) => a.Region === locked["Region"]!.code
        );
      } else if (locked["Province"]?.code) {
        filteredAreas = filteredAreas.filter(
          (a: any) => a.ProvCode === locked["Province"]!.code
        );
      }
      setAreas(filteredAreas);

      const regionData = await fetchWithErrorHandling("/misapi/api/ordinary/region");
      setRegionCodes(
        (regionData.data || []).map((r: any) => ({ code: r.RegionCode, name: r.RegionCode }))
      );

      let provinceUrl = "/misapi/api/ordinary/province";
      if (locked["Region"]?.code) {
        provinceUrl += `?regionCode=${locked["Region"].code}`;
      }
      const provinceData = await fetchWithErrorHandling(provinceUrl);
      setProvinceCodes(
        (provinceData.data || []).map((p: any) => ({ code: p.ProvinceCode, name: p.ProvinceName }))
      );

      const defaultAreaCode = locked["Area"]?.code
        || (filteredAreas.length > 0 ? filteredAreas[0].AreaCode : "");
      setFormData(prev => ({ ...prev, areaCode: defaultAreaCode }));

      const maxCycleData = await fetchWithErrorHandling("/misapi/api/billcycle/max");
      if (maxCycleData.data && maxCycleData.data.BillCycles?.length > 0) {
        const options = generateBillCycleOptions(
          maxCycleData.data.BillCycles,
          maxCycleData.data.MaxBillCycle
        );
        setBillCycleOptions(options);
        setFormData(prev => ({ ...prev, cycle: options[0].code }));
      } else {
        setBillCycleOptions([]);
        setFormData(prev => ({ ...prev, cycle: "" }));
      }
    } catch (err: any) {
      setError("Error loading data: " + (err.message || err.toString()));
    } finally {
      setInitialLoading(false);
    }
  };

  fetchInitialData();
}, [user.Level, user.RegionCode, user.ProvinceCode]);

  const getCodeLabel = () => {
    const labels = { P: "Province Code", D: "Region Code", A: "Area Code" };
    return labels[formData.option as keyof typeof labels] || "Area Code";
  };


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined;

    // If option changes, reset areaCode to appropriate default
    if (name === 'option') {
      let defaultAreaCode = "";
      if (value === "D") {
        defaultAreaCode = locked["Region"]?.code || (regionCodes[0]?.code || "");
      } else if (value === "P") {
        defaultAreaCode = locked["Province"]?.code || (provinceCodes[0]?.code || "");
      } else if (value === "A") {
        defaultAreaCode = locked["Area"]?.code || (areas.length > 0 ? areas[0].AreaCode : "");
      }

      setFormData(prev => ({
        ...prev,
        [name]: value,
        areaCode: defaultAreaCode
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

  const formatCurrency = (value: number | undefined): string => {
    if (value === undefined || value === null || value === 0) return "-";
    const absValue = Math.abs(value);
    const formatted = absValue.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return value < 0 ? `(${formatted})` : formatted;
  };

  const calculateTotals = (data: DebtorSummary[]) => {
    const totals = data.reduce((acc, row) => {
      acc.TotDebtors = (acc.TotDebtors || 0) + (row.TotDebtors || 0);
      acc.Month01 = (acc.Month01 || 0) + (row.Month01 || 0);
      acc.Month02 = (acc.Month02 || 0) + (row.Month02 || 0);
      acc.Month03 = (acc.Month03 || 0) + (row.Month03 || 0);
      acc.Month04 = (acc.Month04 || 0) + (row.Month04 || 0);
      return acc;
    }, {
      Type: "Total",
      CustType: "",
      TotDebtors: 0,
      Month01: 0,
      Month02: 0,
      Month03: 0,
      Month04: 0,
      ErrorMessage: null
    });

    // Calculate percentages for totals
    const totDebtors = totals.TotDebtors || 0;
    return {
      ...totals,
      Month01Percent: totDebtors !== 0 ? parseFloat(((Math.abs(totals.Month01) / Math.abs(totDebtors)) * 100).toFixed(2)) : 0,
      Month02Percent: totDebtors !== 0 ? parseFloat(((Math.abs(totals.Month02) / Math.abs(totDebtors)) * 100).toFixed(2)) : 0,
      Month03Percent: totDebtors !== 0 ? parseFloat(((Math.abs(totals.Month03) / Math.abs(totDebtors)) * 100).toFixed(2)) : 0,
      Month04Percent: totDebtors !== 0 ? parseFloat(((Math.abs(totals.Month04) / Math.abs(totDebtors)) * 100).toFixed(2)) : 0,
    };
  };

  const fetchDebtorsData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { option, cycle, areaCode, showOrdinary, showBulk } = formData;
      if (!cycle) throw new Error("Please select a Bill Cycle");

      if (!showOrdinary && !showBulk) {
        throw new Error("Please select at least one debtor type");
      }

      const results = {
        ordinary: [] as DebtorSummary[],
        bulk: [] as DebtorSummary[]
      };

      if (showOrdinary) {
        let ordinaryUrl = `/misapi/api/debtors/summary?opt=${option}&cycle=${cycle}`;
        if (option !== "E" && !areaCode) throw new Error(`Please select an ${getCodeLabel()}`);
        if (option !== "E") ordinaryUrl += `&areaCode=${areaCode}`;

        const ordinaryResponse = await fetch(ordinaryUrl);
        if (!ordinaryResponse.ok) throw new Error(`HTTP error! status: ${ordinaryResponse.status}`);
        const ordinaryResult = await ordinaryResponse.json();
        if (ordinaryResult.ErrorMessage) throw new Error(ordinaryResult.ErrorMessage);

        const rawOrdinaryData = Array.isArray(ordinaryResult) ? ordinaryResult : ordinaryResult.data || [];
        results.ordinary = calculatePercentages(rawOrdinaryData);
      }

      if (showBulk) {
        let bulkUrl = `/misapi/api/debtorsbulk/summary?opt=${option}&cycle=${cycle}`;
        if (option !== "E" && !areaCode) throw new Error(`Please select an ${getCodeLabel()}`);
        if (option !== "E") bulkUrl += `&areaCode=${areaCode}`;

        const bulkResponse = await fetch(bulkUrl);
        if (!bulkResponse.ok) throw new Error(`HTTP error! status: ${bulkResponse.status}`);
        const bulkResult = await bulkResponse.json();
        if (bulkResult.ErrorMessage) throw new Error(bulkResult.ErrorMessage);

        const rawBulkData = Array.isArray(bulkResult) ? bulkResult : bulkResult.data || [];
        results.bulk = calculatePercentages(rawBulkData);
      }

      setData(results);
      setShowModal(true);
    } catch (err: any) {
      setError(err.message || "Failed to fetch debtors data");
      setData({ ordinary: [], bulk: [] });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDebtorsData();
  };

  const preparePieChartData = (data: DebtorSummary[]) => {
    return data.map(item => ({
      name: item.CustType,
      value: Math.abs(item.TotDebtors || 0)
    }));
  };

  const prepareBarChartData = (data: DebtorSummary[]) => {
    const barData = data.map(item => ({
      name: item.CustType,
      'Month 01': Math.abs(item.Month01 || 0),
      'Month 02': Math.abs(item.Month02 || 0),
      'Month 03': Math.abs(item.Month03 || 0),
      'Month 04': Math.abs(item.Month04 || 0),
      isGovernment: item.CustType.toLowerCase().includes('government')
    }));
    return barData.sort((a, b) =>
      a.isGovernment === b.isGovernment ? 0 : a.isGovernment ? -1 : 1
    );
  };

  const downloadAsCSV = () => {
    if (!formData.showOrdinary && !formData.showBulk) return;
    if (data.ordinary.length === 0 && data.bulk.length === 0) return;

    // Get location/analysis details
    const getLocationText = () => {
      switch (formData.option) {
        case "A":
          const area = areas.find(a => a.AreaCode === formData.areaCode);
          return `Area: ${area?.AreaName || formData.areaCode} (${formData.areaCode})`;
        case "D":
          const region = regionCodes.find(r => r.code === formData.areaCode);
          return `Region: ${region?.name || formData.areaCode} (${formData.areaCode})`;
        case "P":
          const province = provinceCodes.find(p => p.code === formData.areaCode);
          return `Province: ${province?.name || formData.areaCode} (${formData.areaCode})`;
        case "E":
          return "Analysis for: All CEB";
        default:
          return "";
      }
    };

    const headers = [
      "Type",
      "Customer Type",
      "Total Debtors (LKR)",
      "0_1 Month (LKR)",
      "% Total",
      "1_2 Month (LKR)",
      "% Total",
      "2_3 Month (LKR)",
      "% Total",
      ">3 Month (LKR)",
      "% Total"
    ];

    let csvContent = [
      `Debtors Analysis Report`,
      getLocationText(),
      `Bill Cycle: ${getFormattedBillCycle()}`,
      `Generated: ${new Date().toLocaleDateString()}`,
      "",
      headers.map(h => `"${h}"`).join(",")
    ];

    // Add Ordinary Debtors section
    if (formData.showOrdinary && data.ordinary.length > 0) {
      csvContent.push(""); // Empty line before section
      csvContent.push('"ORDINARY DEBTORS"');

      const ordinaryRows = data.ordinary.map(row => [
        row.Type,
        row.CustType,
        row.TotDebtors ?? 0,
        row.Month01 ?? 0,
        formatPercentage(row.Month01Percent),
        row.Month02 ?? 0,
        formatPercentage(row.Month02Percent),
        row.Month03 ?? 0,
        formatPercentage(row.Month03Percent),
        row.Month04 ?? 0,
        formatPercentage(row.Month04Percent)
      ].map(cell => `"${cell}"`).join(","));

      csvContent.push(...ordinaryRows);

      // Add Ordinary Total
      const ordinaryTotal = calculateTotals(data.ordinary);
      csvContent.push([
        "TOTAL",
        "",
        ordinaryTotal.TotDebtors,
        ordinaryTotal.Month01,
        formatPercentage(ordinaryTotal.Month01Percent),
        ordinaryTotal.Month02,
        formatPercentage(ordinaryTotal.Month02Percent),
        ordinaryTotal.Month03,
        formatPercentage(ordinaryTotal.Month03Percent),
        ordinaryTotal.Month04,
        formatPercentage(ordinaryTotal.Month04Percent)
      ].map(cell => `"${cell}"`).join(","));
    }

    // Add Bulk Debtors section
    if (formData.showBulk && data.bulk.length > 0) {
      csvContent.push(""); // Empty line before section
      csvContent.push('"BULK DEBTORS"');

      const bulkRows = data.bulk.map(row => [
        row.Type,
        row.CustType,
        row.TotDebtors ?? 0,
        row.Month01 ?? 0,
        formatPercentage(row.Month01Percent),
        row.Month02 ?? 0,
        formatPercentage(row.Month02Percent),
        row.Month03 ?? 0,
        formatPercentage(row.Month03Percent),
        row.Month04 ?? 0,
        formatPercentage(row.Month04Percent)
      ].map(cell => `"${cell}"`).join(","));

      csvContent.push(...bulkRows);

      // Add Bulk Total
      const bulkTotal = calculateTotals(data.bulk);
      csvContent.push([
        "TOTAL",
        "",
        bulkTotal.TotDebtors,
        bulkTotal.Month01,
        formatPercentage(bulkTotal.Month01Percent),
        bulkTotal.Month02,
        formatPercentage(bulkTotal.Month02Percent),
        bulkTotal.Month03,
        formatPercentage(bulkTotal.Month03Percent),
        bulkTotal.Month04,
        formatPercentage(bulkTotal.Month04Percent)
      ].map(cell => `"${cell}"`).join(","));
    }

    try {
      const csvString = csvContent.join("\n");
      const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      const fileDescriptor = formData.option === "E"
        ? "AllCEB"
        : `${formData.option}_${formData.areaCode}`;

      link.setAttribute("href", url);
      link.setAttribute("download", `DebtorsAnalysis_${fileDescriptor}_Cycle${formData.cycle}.csv`);
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

    // Generate header content based on selection
    const getHeaderContent = () => {
      let optionText = "";
      switch (formData.option) {
        case "A":
          const area = areas.find(a => a.AreaCode === formData.areaCode);
          optionText = `Area: <span class="bold">${area?.AreaName || formData.areaCode} (${formData.areaCode})</span>`;
          break;
        case "D":
          const region = regionCodes.find(r => r.code === formData.areaCode);
          optionText = `Region: <span class="bold">${region?.name || formData.areaCode} (${formData.areaCode})</span>`;
          break;
        case "P":
          const province = provinceCodes.find(p => p.code === formData.areaCode);
          optionText = `Province: <span class="bold">${province?.name || formData.areaCode} (${formData.areaCode})</span>`;
          break;
        case "E":
          optionText = "Analysis for: <span class='bold'>All CEB</span>";
          break;
        default:
          optionText = "";
      }

      const cycleText = `Bill Cycle: <span class="bold">${getFormattedBillCycle()}</span>`;

      return `${optionText}<br>${cycleText}`;
    };

    // Generate table content for PDF
    const generateTableContent = () => {
      let tableContent = "";

      // Ordinary Debtors Table
      if (formData.showOrdinary && data.ordinary.length > 0) {
        const ordinaryTotal = calculateTotals(data.ordinary);

        tableContent += `
          <div class="section-title">ORDINARY DEBTORS</div>
          <table>
            <thead>
              <tr>
                <th class="text-left">Customer Type</th>
                <th class="text-right">Total Debtors (LKR)</th>
                <th class="text-right">0-1 Month (LKR)</th>
                <th class="text-right">% Total</th>
                <th class="text-right">1-2 Months (LKR)</th>
                <th class="text-right">% Total</th>
                <th class="text-right">2-3 Months (LKR)</th>
                <th class="text-right">% Total</th>
                <th class="text-right">&gt;3 Months (LKR)</th>
                <th class="text-right">% Total</th>
              </tr>
            </thead>
            <tbody>
        `;

        data.ordinary.forEach(row => {
          tableContent += `
    <tr>
      <td class="text-left">${row.CustType}</td>
      <td class="text-right">${formatCurrency(row.TotDebtors)}</td>
      <td class="text-right">${formatCurrency(row.Month01)}</td>
      <td class="text-right">${formatPercentage(row.Month01Percent)}</td>
      <td class="text-right">${formatCurrency(row.Month02)}</td>
      <td class="text-right">${formatPercentage(row.Month02Percent)}</td>
      <td class="text-right">${formatCurrency(row.Month03)}</td>
      <td class="text-right">${formatPercentage(row.Month03Percent)}</td>
      <td class="text-right">${formatCurrency(row.Month04)}</td>
      <td class="text-right">${formatPercentage(row.Month04Percent)}</td>
    </tr>
  `;
        });

        // Add total row
        tableContent += `
    <tr class="total-row">
      <td class="text-left"><strong>TOTAL</strong></td>
      <td class="text-right"><strong>${formatCurrency(ordinaryTotal.TotDebtors)}</strong></td>
      <td class="text-right"><strong>${formatCurrency(ordinaryTotal.Month01)}</strong></td>
      <td class="text-right"><strong>${formatPercentage(ordinaryTotal.Month01Percent)}</strong></td>
      <td class="text-right"><strong>${formatCurrency(ordinaryTotal.Month02)}</strong></td>
      <td class="text-right"><strong>${formatPercentage(ordinaryTotal.Month02Percent)}</strong></td>
      <td class="text-right"><strong>${formatCurrency(ordinaryTotal.Month03)}</strong></td>
      <td class="text-right"><strong>${formatPercentage(ordinaryTotal.Month03Percent)}</strong></td>
      <td class="text-right"><strong>${formatCurrency(ordinaryTotal.Month04)}</strong></td>
      <td class="text-right"><strong>${formatPercentage(ordinaryTotal.Month04Percent)}</strong></td>
    </tr>
    </tbody>
  </table>
`;
      }

      // Bulk Debtors Table
      if (formData.showBulk && data.bulk.length > 0) {
        const bulkTotal = calculateTotals(data.bulk);

        if (tableContent) tableContent += `<div class="table-spacer"></div>`;

        tableContent += `
          <div class="section-title">BULK DEBTORS</div>
          <table>
            <thead>
              <tr>
                <th class="text-left">Customer Type</th>
                <th class="text-right">Total Debtors (LKR)</th>
                <th class="text-right">0-1 Month (LKR)</th>
                <th class="text-right">% Total</th>
                <th class="text-right">1-2 Months (LKR)</th>
                <th class="text-right">% Total</th>
                <th class="text-right">2-3 Months (LKR)</th>
                <th class="text-right">% Total</th>
                <th class="text-right">&gt;3 Months (LKR)</th>
                <th class="text-right">% Total</th>
              </tr>
            </thead>
            <tbody>
        `;

        data.bulk.forEach(row => {
          tableContent += `
    <tr>
      <td class="text-left">${row.CustType}</td>
      <td class="text-right">${formatCurrency(row.TotDebtors)}</td>
      <td class="text-right">${formatCurrency(row.Month01)}</td>
      <td class="text-right">${formatPercentage(row.Month01Percent)}</td>
      <td class="text-right">${formatCurrency(row.Month02)}</td>
      <td class="text-right">${formatPercentage(row.Month02Percent)}</td>
      <td class="text-right">${formatCurrency(row.Month03)}</td>
      <td class="text-right">${formatPercentage(row.Month03Percent)}</td>
      <td class="text-right">${formatCurrency(row.Month04)}</td>
      <td class="text-right">${formatPercentage(row.Month04Percent)}</td>
    </tr>
  `;
        });

        // Add total row
        tableContent += `
    <tr class="total-row">
      <td class="text-left"><strong>TOTAL</strong></td>
      <td class="text-right"><strong>${formatCurrency(bulkTotal.TotDebtors)}</strong></td>
      <td class="text-right"><strong>${formatCurrency(bulkTotal.Month01)}</strong></td>
      <td class="text-right"><strong>${formatPercentage(bulkTotal.Month01Percent)}</strong></td>
      <td class="text-right"><strong>${formatCurrency(bulkTotal.Month02)}</strong></td>
      <td class="text-right"><strong>${formatPercentage(bulkTotal.Month02Percent)}</strong></td>
      <td class="text-right"><strong>${formatCurrency(bulkTotal.Month03)}</strong></td>
      <td class="text-right"><strong>${formatPercentage(bulkTotal.Month03Percent)}</strong></td>
      <td class="text-right"><strong>${formatCurrency(bulkTotal.Month04)}</strong></td>
      <td class="text-right"><strong>${formatPercentage(bulkTotal.Month04Percent)}</strong></td>
    </tr>
    </tbody>
  </table>
`;
      }

      return tableContent;
    };

    printWindow.document.write(`
      <html>
        <head>
          <title>Debtors Analysis Report</title>
          <style>
            body { font-family: Arial; font-size: 10px; margin: 10mm; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            th, td { padding: 2px 4px; border: 1px solid #ddd; font-size: 10px;}
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
              color: #7A0000;
              font-size: 11px;
              margin: 15px 0 8px 0;
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
            .table-spacer {
              margin: 20px 0;
            }
            th { 
              background-color: #f0f0f0; 
              font-weight: bold; 
              text-align: left; 
              font-size: 9px;
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
          <div class="header">DEBTORS ANALYSIS REPORT</div>
          <div class="subheader">
            ${getHeaderContent()}
          </div>
          ${generateTableContent()}
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

  // Function to render the appropriate dropdown based on selected option
  const renderCodeDropdown = () => {
    if (formData.option === "E") return null;

    if (formData.option === "D") {
      if (locked["Region"]) {
        return (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Region Code</label>
            <select disabled value={locked["Region"].code} className="w-full px-2 py-1.5 text-xs border rounded-md bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed">
              <option value={locked["Region"].code}>{locked["Region"].code}</option>
            </select>
          </div>
        );
      }
      return (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Region Code</label>
          <select
            name="areaCode"
            value={formData.areaCode}
            onChange={handleInputChange}
            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent"
            style={{ maxHeight: '200px', fontSize: '12px' }}
            required
          >
            {regionCodes.map(region => (
              <option key={region.code} value={region.code} className="text-xs py-1">
                {region.name} ({region.code})
              </option>
            ))}
          </select>
        </div>
      );
    } else if (formData.option === "P") {
      if (locked["Province"]) {
        return (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Province Code</label>
            <select disabled value={locked["Province"].code} className="w-full px-2 py-1.5 text-xs border rounded-md bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed">
              <option value={locked["Province"].code}>
                {locked["Province"].name ? `${locked["Province"].code} - ${locked["Province"].name}` : locked["Province"].code}
              </option>
            </select>
          </div>
        );
      }
      return (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Province Code</label>
          <select
            name="areaCode"
            value={formData.areaCode}
            onChange={handleInputChange}
            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent"
            style={{ maxHeight: '200px', fontSize: '12px' }}
            required
          >
            {provinceCodes.map(province => (
              <option key={province.code} value={province.code} className="text-xs py-1">
                {province.name} ({province.code})
              </option>
            ))}
          </select>
        </div>
      );
    } else {
      if (locked["Area"]) {
        return (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{getCodeLabel()}</label>
            <select disabled value={locked["Area"].code} className="w-full px-2 py-1.5 text-xs border rounded-md bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed">
              <option value={locked["Area"].code}>
                {locked["Area"].name ? `${locked["Area"].code} - ${locked["Area"].name}` : locked["Area"].code}
              </option>
            </select>
          </div>
        );
      }
      return (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">{getCodeLabel()}</label>
          <select
            name="areaCode"
            value={formData.areaCode}
            onChange={handleInputChange}
            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent"
            style={{ maxHeight: '200px', fontSize: '12px' }}
            required
          >
            {areas.map(area => (
              <option key={area.AreaCode} value={area.AreaCode} className="text-xs py-1">
                {area.AreaName} ({area.AreaCode})
              </option>
            ))}
          </select>
        </div>
      );
    }
  };

  // Loading state for initial data
  if (initialLoading) {
    return (
      <div className={`text-center py-8 ${maroon} text-sm animate-pulse font-sans`}>
        Loading initial data...
      </div>
    );
  }

  // Error state for initial data
  if (error && !showModal) {
    return (
      <div className="text-red-600 bg-red-100 border border-red-300 p-4 rounded text-sm">
        <strong>Error:</strong> {error}
        <button
          onClick={() => setError(null)}
          className="float-right text-red-800 font-bold"
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white rounded-xl shadow border border-gray-200 text-sm font-sans">
      {/* Form Section */}
      <div className="mb-8">
        <h2 className={`text-xl font-bold mb-4 ${maroon}`}>Debtors Analysis</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Option Selection */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Analysis Option</label>
              <select
                name="option"
                value={formData.option}
                onChange={handleInputChange}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent"
                style={{ maxHeight: '200px', fontSize: '12px' }}
              >
                {allowedCategories.includes("Area") && <option value="A">Area</option>}
                {allowedCategories.includes("Region") && <option value="D">Region</option>}
                {allowedCategories.includes("Province") && <option value="P">Province</option>}
                {allowedCategories.includes("Entire CEB") && <option value="E">All CEB</option>}
              </select>
            </div>

            {/* Bill Cycle Dropdown - Fixed */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Bill Cycle</label>
              <select
                name="cycle"
                value={formData.cycle}
                onChange={handleInputChange}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent"
                style={{ maxHeight: '200px', fontSize: '12px' }}
                required
              >
                {billCycleOptions.map(option => (
                  <option key={option.code} value={option.code} className="text-xs py-1">
                    {option.code} - {option.display}
                  </option>
                ))}
              </select>
            </div>

            {/* Dynamic Code Dropdown */}
            {renderCodeDropdown()}

            {/* Debtor Type Checkboxes */}
            <div className="flex items-center space-x-4">
              <label className="inline-flex items-center">
                <input
                  type="checkbox"
                  name="showOrdinary"
                  checked={formData.showOrdinary}
                  onChange={handleInputChange}
                  className="rounded border-gray-300 text-[#7A0000] focus:ring-[#7A0000] w-3 h-3"
                />
                <span className="ml-2 text-xs text-gray-700">Show Ordinary Debtors</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="checkbox"
                  name="showBulk"
                  checked={formData.showBulk}
                  onChange={handleInputChange}
                  className="rounded border-gray-300 text-[#7A0000] focus:ring-[#7A0000] w-3 h-3"
                />
                <span className="ml-2 text-xs text-gray-700">Show Bulk Debtors</span>
              </label>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#7A0000]"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={loading || !formData.cycle || (formData.option !== "E" && !formData.areaCode)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium text-white ${maroonGrad} hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#7A0000] disabled:opacity-50`}
            >
              {loading ? "Processing..." : "Generate Report"}
            </button>
          </div>
        </form>
      </div>

      {/* Error Display */}
      {error && showModal && (
        <div className="mt-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded text-xs">
          {error}
        </div>
      )}

      {/* Modal Section */}
      <div ref={printRef}>
        <DebtorsModal
          showModal={showModal}
          setShowModal={setShowModal}
          data={data}
          formData={formData}
          error={error}
          loading={loading}
          columns={[
            { label: "Customer Type", accessor: "CustType", className: "text-left w-[10%]" },
            { label: "Total Debtors (LKR)", accessor: "TotDebtors", className: "text-right w-[10%]", format: formatCurrency },
            { label: "0_1 Month (LKR)", accessor: "Month01", className: "text-right w-[10%]", format: formatCurrency },
            { label: "% Total", accessor: "Month01Percent", className: "text-right w-[8%]", format: formatPercentage },
            { label: "1_2 Months (LKR)", accessor: "Month02", className: "text-right w-[10%]", format: formatCurrency },
            { label: "% Total", accessor: "Month02Percent", className: "text-right w-[8%]", format: formatPercentage },
            { label: "2_3 Months (LKR)", accessor: "Month03", className: "text-right w-[10%]", format: formatCurrency },
            { label: "% Total", accessor: "Month03Percent", className: "text-right w-[8%]", format: formatPercentage },
            { label: ">3 Months (LKR)", accessor: "Month04", className: "text-right w-[10%]", format: formatCurrency },
            { label: "% Total", accessor: "Month04Percent", className: "text-right w-[8%]", format: formatPercentage },
          ]}

          formatCurrency={formatCurrency}
          formatPercentage={formatPercentage}
          calculateTotals={calculateTotals}
          preparePieChartData={preparePieChartData}
          prepareBarChartData={prepareBarChartData}
          downloadAsCSV={downloadAsCSV}
          printPDF={printPDF}
          chartColors={chartColors}
          areas={areas}
          regionCodes={regionCodes}
          provinceCodes={provinceCodes}
          billCycleOptions={billCycleOptions}
        />
      </div>
    </div>
  );
};

export default DebtorsAnalysis;