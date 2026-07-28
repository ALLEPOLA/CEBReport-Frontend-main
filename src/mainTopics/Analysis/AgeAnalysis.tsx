import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { FaFileDownload, FaPrint } from "react-icons/fa";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LabelList,
} from "recharts";
import { useUser } from "../../contexts/UserContext";
import { useReportScope } from "../../hooks/useReportScope";

// Interfaces
interface Area {
  AreaCode: string;
  AreaName: string;
  ErrorMessage?: string | null;
}

interface BillCycleOption {
  display: string;
  code: string;
}

interface CustomerTypeOption {
  display: string;
  value: string;
}

interface Debtor {
  AreaName: string;
  AccountNumber: string;
  TariffCode: string;
  OutstandingBalance: number;
  FirstName: string;
  LastName: string;
  Address1: string;
  Address2: string;
  Address3: string;
  Month0: number;
  Month1: number;
  Month2: number;
  Month3: number;
  Month4: number;
  Month5: number;
  Month6: number;
  Months7_9: number;
  Months10_12: number;
  Months13_24: number;
  Months25_36: number;
  Months37_48: number;
  Months49_60: number;
  Months61Plus: number;
  ErrorMessage: string | null;
}

const AgeAnalysis: React.FC = () => {
  // Colors and styling
  const maroon = "text-[#7A0000]";
  const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";

  // Hooks
  const printRef = useRef<HTMLDivElement>(null);
  const reportContainerRef = useRef<HTMLDivElement>(null);

  // State
  const [areas, setAreas] = useState<Area[]>([]);
  const [billCycleOptions, setBillCycleOptions] = useState<BillCycleOption[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);

  // Chart state
  const [showChart, setShowChart] = useState(false);
  const [chartType, setChartType] = useState<"bar" | "pie">("bar");

  // Pagination state for large datasets
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(100); // Show 100 records per page
  const [totalRecords, setTotalRecords] = useState(0);

  const { user } = useUser();
  const { locked } = useReportScope();

  // Constants
  const timePeriods = [
    { value: "0-6", label: "0 - 6 Months" },
    { value: "7-12", label: "7 - 12 Months" },
    { value: "1-2", label: "1 - 2 Years" },
    { value: "2-3", label: "2 - 3 Years" },
    { value: "3-4", label: "3 - 4 Years" },
    { value: "4-5", label: "4 - 5 Years" },
    { value: ">5", label: "above 5 Years" },
    { value: "All", label: "All" },
  ];

  const customerTypeOptions: CustomerTypeOption[] = [
    { display: "Active", value: "A" },
    { display: "Government", value: "G" },
    { display: "Finalized", value: "F" },
  ];

  const [formData, setFormData] = useState({
    custType: "A",
    billCycle: "",
    areaCode: "",
    timePeriod: "0-6",
  });

  // Helper functions
  const generateBillCycleOptions = (
    billCycles: string[],
    maxCycle: string
  ): BillCycleOption[] => {
    const maxCycleNum = parseInt(maxCycle);
    return billCycles.map((cycle, index) => ({
      display: cycle,
      code: (maxCycleNum - index).toString(),
    }));
  };

  // Helper function to get formatted bill cycle display
  const getFormattedBillCycle = (): string => {
    const cycleOption = billCycleOptions.find(c => c.code === formData.billCycle);
    return cycleOption ? `${formData.billCycle} - ${cycleOption.display}` : formData.billCycle;
  };

  const fetchWithErrorHandling = async (url: string, timeout = 60000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

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
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(
          "Request timed out - the server may be processing a large dataset"
        );
      }
      console.error(`Error fetching ${url}:`, error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  };

  // Effects
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        let areasUrl = "/misapi/api/ordinary/areas";
        if (locked["Region"]?.code) {
          areasUrl += `?regionCode=${locked["Region"].code}`;
        } else if (locked["Province"]?.code) {
          areasUrl += `?provCode=${locked["Province"].code}`;
        }
        const areaData = await fetchWithErrorHandling(areasUrl);
        setAreas(areaData.data || []);
        const defaultAreaCode = locked["Area"]?.code
          || (areaData.data?.length > 0 ? areaData.data[0].AreaCode : "");
        setFormData((prev) => ({
          ...prev,
          areaCode: defaultAreaCode,
        }));

        const maxCycleData = await fetchWithErrorHandling(
          "/misapi/api/billcycle/max"
        );
        if (maxCycleData.data && maxCycleData.data.BillCycles?.length > 0) {
          const options = generateBillCycleOptions(
            maxCycleData.data.BillCycles,
            maxCycleData.data.MaxBillCycle
          );
          setBillCycleOptions(options);
          setFormData((prev) => ({ ...prev, billCycle: options[0].code }));
        } else {
          setBillCycleOptions([]);
          setFormData((prev) => ({ ...prev, billCycle: "" }));
        }
      } catch (err: any) {
        setError("Error loading data: " + (err.message || err.toString()));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user.Level, user.RegionCode, user.ProvinceCode]);

  // Calculate totals from debtors
  const totals = useMemo(() => {
    if (!debtors.length) return null;

    return {
      totalOutstanding: debtors.reduce(
        (sum, d) => sum + d.OutstandingBalance,
        0
      ),
      month0: debtors.reduce((sum, d) => sum + d.Month0, 0),
      month1: debtors.reduce((sum, d) => sum + d.Month1, 0),
      month2: debtors.reduce((sum, d) => sum + d.Month2, 0),
      month3: debtors.reduce((sum, d) => sum + d.Month3, 0),
      month4: debtors.reduce((sum, d) => sum + d.Month4, 0),
      month5: debtors.reduce((sum, d) => sum + d.Month5, 0),
      month6: debtors.reduce((sum, d) => sum + d.Month6, 0),
      months7_9: debtors.reduce((sum, d) => sum + d.Months7_9, 0),
      months10_12: debtors.reduce((sum, d) => sum + d.Months10_12, 0),
      months13_24: debtors.reduce((sum, d) => sum + d.Months13_24, 0),
      months25_36: debtors.reduce((sum, d) => sum + d.Months25_36, 0),
      months37_48: debtors.reduce((sum, d) => sum + d.Months37_48, 0),
      months49_60: debtors.reduce((sum, d) => sum + d.Months49_60, 0),
      months61Plus: debtors.reduce((sum, d) => sum + d.Months61Plus, 0),
    };
  }, [debtors]);

  // Memoized chart data
  const chartData = useMemo(() => {
    if (!debtors.length || !totals) return [];

    const data = [];

    if (formData.timePeriod === "0-6") {
      data.push(
        { name: "Month 0", value: totals.month0, color: "#1E3A8A" },
        { name: "Month 1", value: totals.month1, color: "#10B981" },
        { name: "Month 2", value: totals.month2, color: "#F59E0B" },
        { name: "Month 3", value: totals.month3, color: "#6366F1" },
        { name: "Month 4", value: totals.month4, color: "#3B82F6" },
        { name: "Month 5", value: totals.month5, color: "#6B7280" },
        { name: "Month 6", value: totals.month6, color: "#9CA3AF" }
      );
    } else if (formData.timePeriod === "7-12") {
      data.push(
        { name: "Months 7-9", value: totals.months7_9, color: "#1E3A8A" },
        { name: "Months 10-12", value: totals.months10_12, color: "#10B981" }
      );
    } else if (formData.timePeriod === "1-2") {
      data.push({
        name: "1-2 Years",
        value: totals.months13_24,
        color: "#1E3A8A",
      });
    } else if (formData.timePeriod === "2-3") {
      data.push({
        name: "2-3 Years",
        value: totals.months25_36,
        color: "#1E3A8A",
      });
    } else if (formData.timePeriod === "3-4") {
      data.push({
        name: "3-4 Years",
        value: totals.months37_48,
        color: "#1E3A8A",
      });
    } else if (formData.timePeriod === "4-5") {
      data.push({
        name: "4-5 Years",
        value: totals.months49_60,
        color: "#1E3A8A",
      });
    } else if (formData.timePeriod === ">5") {
      data.push({
        name: "5+ Years",
        value: totals.months61Plus,
        color: "#1E3A8A",
      });
    } else if (formData.timePeriod === "All") {
      data.push(
        {
          name: "0-6 Months",
          value:
            totals.month0 +
            totals.month1 +
            totals.month2 +
            totals.month3 +
            totals.month4 +
            totals.month5 +
            totals.month6,
          color: "#1E3A8A",
        },
        {
          name: "7-12 Months",
          value: totals.months7_9 + totals.months10_12,
          color: "#10B981",
        },
        { name: "1-2 Years", value: totals.months13_24, color: "#F59E0B" },
        { name: "2-3 Years", value: totals.months25_36, color: "#6366F1" },
        { name: "3-4 Years", value: totals.months37_48, color: "#3B82F6" },
        { name: "4-5 Years", value: totals.months49_60, color: "#6B7280" },
        { name: "5+ Years", value: totals.months61Plus, color: "#9CA3AF" }
      );
    }

    return data.filter((item) => item.value > 0); // Only show non-zero values
  }, [debtors, totals, formData.timePeriod]);

  // Paginated data
  const paginatedDebtors = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return debtors.slice(startIndex, endIndex);
  }, [debtors, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(debtors.length / itemsPerPage);

  // Event handlers
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));
    },
    []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.areaCode || !formData.billCycle || !formData.custType) return;

    setReportLoading(true);
    setReportError(null);
    setDebtors([]);
    setCurrentPage(1);

    try {
      let ageRange = "";
      switch (formData.timePeriod) {
        case "0-6":
          ageRange = "Months0_6";
          break;
        case "7-12":
          ageRange = "Months7_12";
          break;
        case "1-2":
          ageRange = "Years1_2";
          break;
        case "2-3":
          ageRange = "Years2_3";
          break;
        case "3-4":
          ageRange = "Years3_4";
          break;
        case "4-5":
          ageRange = "Years4_5";
          break;
        case ">5":
          ageRange = "Years5Plus";
          break;
        case "All":
          ageRange = "All";
          break;
        default:
          ageRange = "All";
      }

      const url = `/misapi/api/debtors?custType=${formData.custType}&billCycle=${formData.billCycle}&areaCode=${formData.areaCode}&ageRange=${ageRange}`;

      // Increased timeout for Active customer reports
      const timeout = formData.custType === "A" ? 120000 : 60000; // 2 minutes for Active, 1 minute for others
      const data = await fetchWithErrorHandling(url, timeout);

      if (data.errorMessage) {
        throw new Error(data.errorMessage);
      }

      const resultData = data.data || [];

      if (!Array.isArray(resultData)) {
        if (resultData.ErrorMessage) {
          throw new Error(resultData.ErrorMessage);
        }
        setDebtors([resultData]);
        setTotalRecords(1);
      } else {
        setDebtors(resultData);
        setTotalRecords(resultData.length);
      }

      setShowReport(true);

      // Scroll to report after a small delay to allow rendering
      setTimeout(() => {
        if (reportContainerRef.current) {
          reportContainerRef.current.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    } catch (err: any) {
      let errorMessage = "Error fetching report: ";

      if (err.message.includes("timed out")) {
        errorMessage +=
          "The request timed out. This usually happens when there are too many Active customers. Try selecting a more specific time period or smaller area.";
      } else {
        errorMessage += err.message || err.toString();
      }

      setReportError(errorMessage);
    } finally {
      setReportLoading(false);
    }
  };

  const downloadAsCSV = useCallback(() => {
    if (!debtors.length) return;

    // Create headers based on the selected time period
    let headers = [
      "Account Number",
      "Name",
      "Address",
      "Tariff Code",
      "Outstanding Balance",
    ];

    // Add columns based on the selected time period
    if (formData.timePeriod === "0-6") {
      headers.push(
        "Month 0",
        "Month 1",
        "Month 2",
        "Month 3",
        "Month 4",
        "Month 5",
        "Month 6"
      );
    } else if (formData.timePeriod === "7-12") {
      headers.push("Months 7-9", "Months 10-12");
    } else if (formData.timePeriod === "1-2") {
      headers.push("1-2 Years");
    } else if (formData.timePeriod === "2-3") {
      headers.push("2-3 Years");
    } else if (formData.timePeriod === "3-4") {
      headers.push("3-4 Years");
    } else if (formData.timePeriod === "4-5") {
      headers.push("4-5 Years");
    } else if (formData.timePeriod === ">5") {
      headers.push("5+ Years");
    } else if (formData.timePeriod === "All") {
      headers.push(
        "0-6 Months",
        "7-12 Months",
        "1-2 Years",
        "2-3 Years",
        "3-4 Years",
        "4-5 Years",
        "5+ Years"
      );
    }

    // Create rows with proper formatting
    const rows = debtors.map((debtor) => {
      const row = [
        debtor.AccountNumber,
        `${debtor.FirstName} ${debtor.LastName}`.trim(),
        [debtor.Address1, debtor.Address2, debtor.Address3]
          .filter((part) => part && part.trim() !== "")
          .join(", "),
        debtor.TariffCode,
        formatCurrency(debtor.OutstandingBalance),
      ];

      // Add values based on the selected time period
      if (formData.timePeriod === "0-6") {
        row.push(
          formatCurrency(debtor.Month0),
          formatCurrency(debtor.Month1),
          formatCurrency(debtor.Month2),
          formatCurrency(debtor.Month3),
          formatCurrency(debtor.Month4),
          formatCurrency(debtor.Month5),
          formatCurrency(debtor.Month6)
        );
      } else if (formData.timePeriod === "7-12") {
        row.push(
          formatCurrency(debtor.Months7_9),
          formatCurrency(debtor.Months10_12)
        );
      } else if (formData.timePeriod === "1-2") {
        row.push(formatCurrency(debtor.Months13_24));
      } else if (formData.timePeriod === "2-3") {
        row.push(formatCurrency(debtor.Months25_36));
      } else if (formData.timePeriod === "3-4") {
        row.push(formatCurrency(debtor.Months37_48));
      } else if (formData.timePeriod === "4-5") {
        row.push(formatCurrency(debtor.Months49_60));
      } else if (formData.timePeriod === ">5") {
        row.push(formatCurrency(debtor.Months61Plus));
      } else if (formData.timePeriod === "All") {
        row.push(
          formatCurrency(
            debtor.Month0 +
            debtor.Month1 +
            debtor.Month2 +
            debtor.Month3 +
            debtor.Month4 +
            debtor.Month5 +
            debtor.Month6
          ),
          formatCurrency(debtor.Months7_9 + debtor.Months10_12),
          formatCurrency(debtor.Months13_24),
          formatCurrency(debtor.Months25_36),
          formatCurrency(debtor.Months37_48),
          formatCurrency(debtor.Months49_60),
          formatCurrency(debtor.Months61Plus)
        );
      }

      return row;
    });

    // Add totals row if more than one debtor
    if (debtors.length > 1 && totals) {
      const totalsRow = ["", "", "", "", "TOTAL:"];

      if (formData.timePeriod === "0-6") {
        totalsRow.push(
          formatCurrency(totals.month0),
          formatCurrency(totals.month1),
          formatCurrency(totals.month2),
          formatCurrency(totals.month3),
          formatCurrency(totals.month4),
          formatCurrency(totals.month5),
          formatCurrency(totals.month6)
        );
      } else if (formData.timePeriod === "7-12") {
        totalsRow.push(
          formatCurrency(totals.months7_9),
          formatCurrency(totals.months10_12)
        );
      } else if (formData.timePeriod === "1-2") {
        totalsRow.push(formatCurrency(totals.months13_24));
      } else if (formData.timePeriod === "2-3") {
        totalsRow.push(formatCurrency(totals.months25_36));
      } else if (formData.timePeriod === "3-4") {
        totalsRow.push(formatCurrency(totals.months37_48));
      } else if (formData.timePeriod === "4-5") {
        totalsRow.push(formatCurrency(totals.months49_60));
      } else if (formData.timePeriod === ">5") {
        totalsRow.push(formatCurrency(totals.months61Plus));
      } else if (formData.timePeriod === "All") {
        totalsRow.push(
          formatCurrency(
            totals.month0 +
            totals.month1 +
            totals.month2 +
            totals.month3 +
            totals.month4 +
            totals.month5 +
            totals.month6
          ),
          formatCurrency(totals.months7_9 + totals.months10_12),
          formatCurrency(totals.months13_24),
          formatCurrency(totals.months25_36),
          formatCurrency(totals.months37_48),
          formatCurrency(totals.months49_60),
          formatCurrency(totals.months61Plus)
        );
      }

      rows.push(totalsRow);
    }

    // Create CSV content with proper formatting
    let csvContent = [
      `"Age Analysis Report - ${customerTypeOptions.find((t) => t.value === formData.custType)?.display
      } Customers"`,
      `"Bill Cycle: ${getFormattedBillCycle()}"`,
      `"Area: ${areas.find((a) => a.AreaCode === formData.areaCode)?.AreaName
      } (${formData.areaCode})"`,

      "",
      headers.map((h) => `"${h}"`).join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    // Create and trigger download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `AgeAnalysis_${formData.custType}_Cycle${formData.billCycle
      }_Area${formData.areaCode}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [
    debtors,
    formData,
    billCycleOptions,
    areas,
    customerTypeOptions,
    totals,
    totalRecords,
  ]);

  const printPDF = () => {
    if (!debtors.length) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    // Generate table HTML for all records
    const generateTableHTML = () => {
      let tableHTML = `
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #f0f0f0;">
              <th style="border: 1px solid #ddd; padding: 2px 4px; text-align: left; font-size: 10px; vertical-align: top; font-weight: bold;">Account Number</th>
              <th style="border: 1px solid #ddd; padding: 2px 4px; text-align: left; font-size: 10px; vertical-align: top; font-weight: bold;">Name</th>
              <th style="border: 1px solid #ddd; padding: 2px 4px; text-align: left; font-size: 10px; vertical-align: top; font-weight: bold;">Address</th>
              <th style="border: 1px solid #ddd; padding: 2px 4px; text-align: left; font-size: 10px; vertical-align: top; font-weight: bold;">Tariff</th>
              <th style="border: 1px solid #ddd; padding: 2px 4px; text-align: left; font-size: 10px; vertical-align: top; font-weight: bold;">Outstanding Balance</th>`;

      // Add time period specific headers
      if (formData.timePeriod === "0-6") {
        tableHTML += `
          <th style="border: 1px solid #ddd; padding: 2px 4px; text-align: left; font-size: 10px; vertical-align: top; font-weight: bold;">Month 0</th>
          <th style="border: 1px solid #ddd; padding: 2px 4px; text-align: left; font-size: 10px; vertical-align: top; font-weight: bold;">Month 1</th>
          <th style="border: 1px solid #ddd; padding: 2px 4px; text-align: left; font-size: 10px; vertical-align: top; font-weight: bold;">Month 2</th>
          <th style="border: 1px solid #ddd; padding: 2px 4px; text-align: left; font-size: 10px; vertical-align: top; font-weight: bold;">Month 3</th>
          <th style="border: 1px solid #ddd; padding: 2px 4px; text-align: left; font-size: 10px; vertical-align: top; font-weight: bold;">Month 4</th>
          <th style="border: 1px solid #ddd; padding: 2px 4px; text-align: left; font-size: 10px; vertical-align: top; font-weight: bold;">Month 5</th>
          <th style="border: 1px solid #ddd; padding: 2px 4px; text-align: left; font-size: 10px; vertical-align: top; font-weight: bold;">Month 6</th>`;
      } else if (formData.timePeriod === "7-12") {
        tableHTML += `
          <th style="border: 1px solid #ddd; padding: 2px 4px; text-align: left; font-size: 10px; vertical-align: top; font-weight: bold;">Months 7-9</th>
          <th style="border: 1px solid #ddd; padding: 2px 4px; text-align: left; font-size: 10px; vertical-align: top; font-weight: bold;">Months 10-12</th>`;
      } else if (formData.timePeriod === "1-2") {
        tableHTML += `<th style="border: 1px solid #ddd; padding: 2px 4px; text-align: left; font-size: 10px; vertical-align: top; font-weight: bold;">1-2 Years</th>`;
      } else if (formData.timePeriod === "2-3") {
        tableHTML += `<th style="border: 1px solid #ddd; padding: 2px 4px; text-align: left; font-size: 10px; vertical-align: top; font-weight: bold;">2-3 Years</th>`;
      } else if (formData.timePeriod === "3-4") {
        tableHTML += `<th style="border: 1px solid #ddd; padding: 2px 4px; text-align: left; font-size: 10px; vertical-align: top; font-weight: bold;">3-4 Years</th>`;
      } else if (formData.timePeriod === "4-5") {
        tableHTML += `<th style="border: 1px solid #ddd; padding: 2px 4px; text-align: left; font-size: 10px; vertical-align: top; font-weight: bold;">4-5 Years</th>`;
      } else if (formData.timePeriod === ">5") {
        tableHTML += `<th style="border: 1px solid #ddd; padding: 2px 4px; text-align: left; font-size: 10px; vertical-align: top; font-weight: bold;">5+ Years</th>`;
      } else if (formData.timePeriod === "All") {
        tableHTML += `
          <th style="border: 1px solid #ddd; padding: 2px 4px; text-align: left; font-size: 10px; vertical-align: top; font-weight: bold;">0-6 Months</th>
          <th style="border: 1px solid #ddd; padding: 2px 4px; text-align: left; font-size: 10px; vertical-align: top; font-weight: bold;">7-12 Months</th>
          <th style="border: 1px solid #ddd; padding: 2px 4px; text-align: left; font-size: 10px; vertical-align: top; font-weight: bold;">1-2 Years</th>
          <th style="border: 1px solid #ddd; padding: 2px 4px; text-align: left; font-size: 10px; vertical-align: top; font-weight: bold;">2-3 Years</th>
          <th style="border: 1px solid #ddd; padding: 2px 4px; text-align: left; font-size: 10px; vertical-align: top; font-weight: bold;">3-4 Years</th>
          <th style="border: 1px solid #ddd; padding: 2px 4px; text-align: left; font-size: 10px; vertical-align: top; font-weight: bold;">4-5 Years</th>
          <th style="border: 1px solid #ddd; padding: 2px 4px; text-align: left; font-size: 10px; vertical-align: top; font-weight: bold;">5+ Years</th>`;
      }

      tableHTML += `</tr></thead><tbody>`;

      // Add all debtor rows
      debtors.forEach((debtor, index) => {
        const bgColor = index % 2 === 0 ? "#ffffff" : "#f9f9f9";
        tableHTML += `
          <tr style="background-color: ${bgColor};">
            <td style="border: 1px solid #ddd; padding: 2px 4px; font-size: 10px; vertical-align: top;">${debtor.AccountNumber
          }</td>
            <td style="border: 1px solid #ddd; padding: 2px 4px; font-size: 10px; vertical-align: top;">${getFullName(
            debtor
          )}</td>
            <td style="border: 1px solid #ddd; padding: 2px 4px; font-size: 10px; vertical-align: top;">${getFullAddress(
            debtor
          )}</td>
            <td style="border: 1px solid #ddd; padding: 2px 4px; font-size: 10px; vertical-align: top;">${debtor.TariffCode
          }</td>
            <td style="border: 1px solid #ddd; padding: 2px 4px; text-align: right; font-size: 10px; vertical-align: top;">${formatCurrency(
            debtor.OutstandingBalance
          )}</td>`;

        // Add time period specific data
        if (formData.timePeriod === "0-6") {
          tableHTML += `
            <td style="border: 1px solid #ddd; padding: 2px 4px; text-align: right; font-size: 10px; vertical-align: top;">${formatCurrency(
            debtor.Month0
          )}</td>
            <td style="border: 1px solid #ddd; padding: 2px 4px; text-align: right; font-size: 10px; vertical-align: top;">${formatCurrency(
            debtor.Month1
          )}</td>
            <td style="border: 1px solid #ddd; padding: 2px 4px; text-align: right; font-size: 10px; vertical-align: top;">${formatCurrency(
            debtor.Month2
          )}</td>
            <td style="border: 1px solid #ddd; padding: 2px 4px; text-align: right; font-size: 10px; vertical-align: top;">${formatCurrency(
            debtor.Month3
          )}</td>
            <td style="border: 1px solid #ddd; padding: 2px 4px; text-align: right; font-size: 10px; vertical-align: top;">${formatCurrency(
            debtor.Month4
          )}</td>
            <td style="border: 1px solid #ddd; padding: 2px 4px; text-align: right; font-size: 10px; vertical-align: top;">${formatCurrency(
            debtor.Month5
          )}</td>
            <td style="border: 1px solid #ddd; padding: 2px 4px; text-align: right; font-size: 10px; vertical-align: top;">${formatCurrency(
            debtor.Month6
          )}</td>`;
        } else if (formData.timePeriod === "7-12") {
          tableHTML += `
            <td style="border: 1px solid #ddd; padding: 2px 4px; text-align: right; font-size: 10px; vertical-align: top;">${formatCurrency(
            debtor.Months7_9
          )}</td>
            <td style="border: 1px solid #ddd; padding: 2px 4px; text-align: right; font-size: 10px; vertical-align: top;">${formatCurrency(
            debtor.Months10_12
          )}</td>`;
        } else if (formData.timePeriod === "1-2") {
          tableHTML += `<td style="border: 1px solid #ddd; padding: 2px 4px; text-align: right; font-size: 10px; vertical-align: top;">${formatCurrency(
            debtor.Months13_24
          )}</td>`;
        } else if (formData.timePeriod === "2-3") {
          tableHTML += `<td style="border: 1px solid #ddd; padding: 2px 4px; text-align: right; font-size: 10px; vertical-align: top;">${formatCurrency(
            debtor.Months25_36
          )}</td>`;
        } else if (formData.timePeriod === "3-4") {
          tableHTML += `<td style="border: 1px solid #ddd; padding: 2px 4px; text-align: right; font-size: 10px; vertical-align: top;">${formatCurrency(
            debtor.Months37_48
          )}</td>`;
        } else if (formData.timePeriod === "4-5") {
          tableHTML += `<td style="border: 1px solid #ddd; padding: 2px 4px; text-align: right; font-size: 10px; vertical-align: top;">${formatCurrency(
            debtor.Months49_60
          )}</td>`;
        } else if (formData.timePeriod === ">5") {
          tableHTML += `<td style="border: 1px solid #ddd; padding: 2px 4px; text-align: right; font-size: 10px; vertical-align: top;">${formatCurrency(
            debtor.Months61Plus
          )}</td>`;
        } else if (formData.timePeriod === "All") {
          tableHTML += `
            <td style="border: 1px solid #ddd; padding: 2px 4px; text-align: right; font-size: 10px; vertical-align: top;">${formatCurrency(
            debtor.Month0 +
            debtor.Month1 +
            debtor.Month2 +
            debtor.Month3 +
            debtor.Month4 +
            debtor.Month5 +
            debtor.Month6
          )}</td>
            <td style="border: 1px solid #ddd; padding: 2px 4px; text-align: right; font-size: 10px; vertical-align: top;">${formatCurrency(
            debtor.Months7_9 + debtor.Months10_12
          )}</td>
            <td style="border: 1px solid #ddd; padding: 2px 4px; text-align: right; font-size: 10px; vertical-align: top;">${formatCurrency(
            debtor.Months13_24
          )}</td>
            <td style="border: 1px solid #ddd; padding: 2px 4px; text-align: right; font-size: 10px; vertical-align: top;">${formatCurrency(
            debtor.Months25_36
          )}</td>
            <td style="border: 1px solid #ddd; padding: 2px 4px; text-align: right; font-size: 10px; vertical-align: top;">${formatCurrency(
            debtor.Months37_48
          )}</td>
            <td style="border: 1px solid #ddd; padding: 2px 4px; text-align: right; font-size: 10px; vertical-align: top;">${formatCurrency(
            debtor.Months49_60
          )}</td>
            <td style="border: 1px solid #ddd; padding: 2px 4px; text-align: right; font-size: 10px; vertical-align: top;">${formatCurrency(
            debtor.Months61Plus
          )}</td>`;
        }

        tableHTML += `</tr>`;
      });

      tableHTML += `</tbody></table>`;
      return tableHTML;
    };

    printWindow.document.write(`
      <html>
        <head>
          <title>Age Analysis Report</title>
          <style>
            body { font-family: Arial; font-size: 10px; margin: 10mm; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 2px 4px; border: 1px solid #ddd; font-size: 10px; vertical-align: top; }
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
              text-align: left;
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
          <div class="header">AGE ANALYSIS REPORT - ${customerTypeOptions.find((t) => t.value === formData.custType)
        ?.display
      } </div>
          <div class="subheader">
            Area: <span class="bold">${areas.find((a) => a.AreaCode === formData.areaCode)?.AreaName
      } (${formData.areaCode})</span><br>
            Bill Cycle: <span class="bold">${getFormattedBillCycle()}</span><br>
            
          </div>
          ${generateTableHTML()}
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

  // UI helpers
  const formatCurrency = (value: number): string => {
    const absValue = Math.abs(value);
    const formatted = absValue.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return value < 0 ? `(${formatted})` : formatted;
  };

  const getFullName = (debtor: Debtor): string => {
    return `${debtor.FirstName} ${debtor.LastName}`.trim();
  };

  const getFullAddress = (debtor: Debtor): string => {
    return [debtor.Address1, debtor.Address2, debtor.Address3]
      .filter((part) => part && part.trim() !== "")
      .join(", ");
  };

  const handleBack = () => {
    setShowReport(false);
    setDebtors([]);
    setReportError(null);
    setCurrentPage(1);
    setTotalRecords(0);
    setShowChart(false);
  };

  const renderChart = () => {
    const hideChartPeriods = ["1-2", "2-3", "3-4", "4-5", ">5"];
    if (
      !showChart ||
      !chartData.length ||
      hideChartPeriods.includes(formData.timePeriod)
    ) {
      return null;
    }

    return (
      <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded">
        <div className="flex justify-between items-center mb-4">
          <h4 className="font-medium text-gray-800">
            Age Analysis Visualization
          </h4>
          <div className="flex gap-2">
            <button
              onClick={() => setChartType("bar")}
              className={`px-3 py-1 rounded text-sm ${chartType === "bar"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 hover:bg-gray-300"
                }`}
            >
              Bar Chart
            </button>
            <button
              onClick={() => setChartType("pie")}
              className={`px-3 py-1 rounded text-sm ${chartType === "pie"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 hover:bg-gray-300"
                }`}
            >
              Pie Chart
            </button>
          </div>
        </div>

        <div style={{ width: "100%", height: "400px" }}>
          {chartType === "bar" ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) => {
                    if (value >= 1000000)
                      return `${(value / 1000000).toFixed(1)}M`;
                    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                    return value.toString();
                  }}
                />
                <Tooltip
                  cursor={{ fill: "rgba(0,0,0,0.05)" }} // highlight bar on hover
                  formatter={(value) => [
                    formatCurrency(Number(value)),
                    "Amount",
                  ]}
                  labelStyle={{ fontSize: "12px" }}
                />
                <Legend
                  payload={chartData.map((item) => ({
                    id: item.name,
                    type: "square",
                    value: item.name,
                    color: item.color,
                  }))}
                />

                <Bar
                  dataKey="value"
                  name="Outstanding Amount"
                  // fill="#1E3A8A"
                  radius={[6, 6, 0, 0]} // rounded corners
                  onClick={(data) => {
                    alert(
                      `You clicked on ${data.name} with value ${formatCurrency(
                        data.value
                      )}`
                    );
                  }}
                  isAnimationActive={true} // animate on load
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`bar-cell-${index}`} fill={entry.color} />
                  ))}
                  {/* Labels on bars */}
                  <LabelList
                    dataKey="value"
                    position="top"
                    formatter={(val: number) => formatCurrency(val)}
                    style={{ fontSize: "10px", fill: "#333" }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={150}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name}: ${(percent * 100).toFixed(1)}%`
                  }
                  labelLine={false}
                  fontSize={11}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [
                    formatCurrency(Number(value)),
                    "Amount",
                  ]}
                  labelStyle={{ fontSize: "12px" }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    );
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pageNumbers = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }

    return (
      <div className="flex justify-center items-center gap-2 my-4">
        <button
          onClick={() => setCurrentPage(1)}
          disabled={currentPage === 1}
          className="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded disabled:opacity-50"
        >
          First
        </button>
        <button
          onClick={() => setCurrentPage(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded disabled:opacity-50"
        >
          Previous
        </button>

        {pageNumbers.map((pageNum) => (
          <button
            key={pageNum}
            onClick={() => setCurrentPage(pageNum)}
            className={`px-2 py-1 text-xs rounded ${currentPage === pageNum
                ? "bg-[#7A0000] text-white"
                : "bg-gray-200 hover:bg-gray-300"
              }`}
          >
            {pageNum}
          </button>
        ))}

        <button
          onClick={() => setCurrentPage(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded disabled:opacity-50"
        >
          Next
        </button>
        <button
          onClick={() => setCurrentPage(totalPages)}
          disabled={currentPage === totalPages}
          className="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded disabled:opacity-50"
        >
          Last
        </button>

        <span className="text-xs text-gray-600 ml-4">
          Showing {(currentPage - 1) * itemsPerPage + 1}-
          {Math.min(currentPage * itemsPerPage, totalRecords)} of {totalRecords}{" "}
          records
        </span>
      </div>
    );
  };

  const renderForm = () => (
    <>
      <h2 className={`text-xl font-bold mb-6 ${maroon}`}>Age Analysis</h2>

      {/* Warning for Active customers */}
      {formData.custType === "A" && (
        <div className="mb-4 p-3 bg-yellow-50 text-yellow-800 border border-yellow-200 rounded text-sm">
          <strong>Note:</strong> Active customer reports may take longer to load
          due to large dataset size. Consider selecting a specific time period
          for faster results.
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Customer Type Dropdown */}
          <div className="flex flex-col">
            <label className={`${maroon} text-xs font-medium mb-1`}>
              Select Customer Type:
            </label>
            <select
              name="custType"
              value={formData.custType}
              onChange={handleInputChange}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent mb-1"
            >
              {customerTypeOptions.map((type) => (
                <option
                  key={type.value}
                  value={type.value}
                  className="text-xs py-1"
                >
                  {type.display} - {type.value}
                </option>
              ))}
            </select>
          </div>

          {/* Bill Cycle Dropdown */}
          <div className="flex flex-col">
            <label className={`${maroon} text-xs font-medium mb-1`}>
              Select Bill Cycle:
            </label>
            <select
              name="billCycle"
              value={formData.billCycle}
              onChange={handleInputChange}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent"
              required
            >
              {billCycleOptions.map((option) => (
                <option
                  key={option.code}
                  value={option.code}
                  className="text-xs py-1"
                >
                  {option.code} - {option.display}
                </option>
              ))}
            </select>
          </div>

          {/* Area Dropdown */}
          <div className="flex flex-col">
            <label className={`${maroon} text-xs font-medium mb-1`}>
              Select Area:
            </label>
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
            ) : (
              <select
                name="areaCode"
                value={formData.areaCode}
                onChange={handleInputChange}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent"
                required
              >
                {areas.map((area) => (
                  <option
                    key={area.AreaCode}
                    value={area.AreaCode}
                    className="text-xs py-1"
                  >
                    {area.AreaName} ({area.AreaCode})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Time Period Dropdown */}
          <div className="flex flex-col">
            <label className={`${maroon} text-xs font-medium mb-1`}>
              Select Time Period:
            </label>
            <select
              name="timePeriod"
              value={formData.timePeriod}
              onChange={handleInputChange}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent"
              required
            >
              {timePeriods.map((period) => (
                <option
                  key={period.value}
                  value={period.value}
                  className="text-xs py-1"
                >
                  {period.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* View Report Button */}
        <div className="w-full mt-6 flex justify-end">
          <button
            type="submit"
            disabled={
              reportLoading ||
              !formData.areaCode ||
              !formData.billCycle ||
              !formData.custType
            }
            className={`
              px-6 py-2 rounded-md font-medium transition-opacity duration-300 shadow
              ${maroonGrad} text-white
              ${reportLoading
                ? "opacity-70 cursor-not-allowed"
                : "hover:opacity-90"
              }
            `}
          >
            {reportLoading ? (
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
                {formData.custType === "A"
                  ? "Loading (may take up to 2 minutes)..."
                  : "Loading..."}
              </span>
            ) : (
              "Generate Report"
            )}
          </button>
        </div>
      </form>
    </>
  );

  const renderReportTable = () => {
    if (!debtors.length && !reportLoading && !reportError) return null;

    const disableChartPeriods = ["1-2", "2-3", "3-4", "4-5", ">5"];
    const isChartDisabled = disableChartPeriods.includes(formData.timePeriod);

    return (
      <div className="mt-8" ref={printRef}>
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-semibold text-[#7A0000]">
            Debtors Age Analysis —{" "}
            {
              customerTypeOptions.find((t) => t.value === formData.custType)
                ?.display
            }{" "}
            Customers
          </h3>
          <div className="flex gap-2 mt-2">
            {/* <button
              onClick={downloadAsCSV}
              className="flex items-center gap-1 px-3 py-1.5 border border-blue-400 text-blue-700 bg-white rounded-md text-xs font-medium shadow-sm hover:bg-blue-50 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-200 transition"
              disabled={!debtors.length}
            >
              CSV
            </button>
            <button
              onClick={printPDF}
              className="flex items-center gap-1 px-3 py-1.5 border border-green-400 text-green-700 bg-white rounded-md text-xs font-medium shadow-sm hover:bg-green-50 hover:text-green-800 focus:outline-none focus:ring-2 focus:ring-green-200 transition"
              disabled={!debtors.length}
            >
              PDF
            </button> */}
            <button
              onClick={downloadAsCSV}
              className="flex items-center gap-1 px-3 py-1.5 border border-blue-400 text-blue-700 bg-white rounded-md text-xs font-medium shadow-sm hover:bg-blue-50 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-200 transition"
              disabled={!debtors.length}
            >
              <FaFileDownload className="w-3 h-3" /> CSV
            </button>
            <button
              onClick={printPDF}
              className="flex items-center gap-1 px-3 py-1.5 border border-green-400 text-green-700 bg-white rounded-md text-xs font-medium shadow-sm hover:bg-green-50 hover:text-green-800 focus:outline-none focus:ring-2 focus:ring-green-200 transition"
              disabled={!debtors.length}
            >
              <FaPrint className="w-3 h-3" /> PDF
            </button>

            <button
              onClick={() => setShowChart(!showChart)}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-xs rounded-md text-white flex items-center"
              disabled={!debtors.length || isChartDisabled}
              title={
                isChartDisabled
                  ? "Charts not available for this time period"
                  : ""
              }
            >
              {showChart ? "Hide Chart" : "Show Chart"}
            </button>
            <button
              onClick={handleBack}
              className="px-4 py-1.5 bg-[#7A0000] hover:bg-[#A52A2A] text-xs rounded-md text-white flex items-center"
            >
              Back to Form
            </button>
          </div>
        </div>

        <p className="text-sm text-gray-600 mb-2">
          Bill Cycle: {getFormattedBillCycle()}
        </p>
        <p className="text-sm text-gray-600 mb-2">
          Area: {areas.find((a) => a.AreaCode === formData.areaCode)?.AreaName}{" "}
          ({formData.areaCode})
        </p>
        {/* <p className="text-sm text-gray-600 mb-4">
          Total Records: {totalRecords} {totalPages > 1 && `(${totalPages} pages)`}
        </p> */}

        {reportLoading && (
          <div
            className={`text-center py-8 ${maroon} text-sm animate-pulse font-sans`}
          >
            <div className="flex items-center justify-center">
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-[#7A0000]"
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
              Loading report data...
              {formData.custType === "A" && (
                <span className="block mt-2 text-xs text-gray-500">
                  Active customer reports may take up to 2 minutes
                </span>
              )}
            </div>
          </div>
        )}

        {reportError && (
          <div className="mt-6 text-red-600 bg-red-100 border border-red-300 p-4 rounded text-sm">
            <strong>Error:</strong> {reportError}
          </div>
        )}

        {!reportLoading && !reportError && debtors.length > 0 && (
          <>
            {/* Summary totals */}
            {totals && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
                <h4 className="font-medium text-blue-800 mb-2">
                  Summary Totals
                </h4>
                <p className="text-sm text-blue-700">
                  Total Outstanding Balance:{" "}
                  <strong>{formatCurrency(totals.totalOutstanding)}</strong>
                </p>
                {formData.timePeriod === "All" && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-xs text-blue-600">
                    <div>
                      0-6 Months:{" "}
                      {formatCurrency(
                        totals.month0 +
                        totals.month1 +
                        totals.month2 +
                        totals.month3 +
                        totals.month4 +
                        totals.month5 +
                        totals.month6
                      )}
                    </div>
                    <div>
                      7-12 Months:{" "}
                      {formatCurrency(totals.months7_9 + totals.months10_12)}
                    </div>
                    <div>1-2 Years: {formatCurrency(totals.months13_24)}</div>
                    <div>2-3 Years: {formatCurrency(totals.months25_36)}</div>
                    <div>3-4 Years: {formatCurrency(totals.months37_48)}</div>
                    <div>4-5 Years: {formatCurrency(totals.months49_60)}</div>
                    <div>5+ Years: {formatCurrency(totals.months61Plus)}</div>
                  </div>
                )}
              </div>
            )}

            {/* Chart Section */}
            {renderChart()}

            {renderPagination()}

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-2 py-1 text-left sticky top-0 bg-gray-100">
                      Account Number
                    </th>
                    <th className="border border-gray-300 px-2 py-1 text-left sticky top-0 bg-gray-100">
                      Name
                    </th>
                    <th className="border border-gray-300 px-2 py-1 text-left sticky top-0 bg-gray-100">
                      Address
                    </th>
                    <th className="border border-gray-300 px-2 py-1 text-left sticky top-0 bg-gray-100">
                      Tariff
                    </th>
                    <th className="border border-gray-300 px-2 py-1 text-left sticky top-0 bg-gray-100">
                      Outstanding Balance
                    </th>
                    {formData.timePeriod === "0-6" && (
                      <>
                        <th className="border border-gray-300 px-2 py-1 text-left sticky top-0 bg-gray-100">
                          Month 0
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-left sticky top-0 bg-gray-100">
                          Month 1
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-left sticky top-0 bg-gray-100">
                          Month 2
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-left sticky top-0 bg-gray-100">
                          Month 3
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-left sticky top-0 bg-gray-100">
                          Month 4
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-left sticky top-0 bg-gray-100">
                          Month 5
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-left sticky top-0 bg-gray-100">
                          Month 6
                        </th>
                      </>
                    )}
                    {formData.timePeriod === "7-12" && (
                      <>
                        <th className="border border-gray-300 px-2 py-1 text-left sticky top-0 bg-gray-100">
                          Months 7-9
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-left sticky top-0 bg-gray-100">
                          Months 10-12
                        </th>
                      </>
                    )}
                    {formData.timePeriod === "1-2" && (
                      <th className="border border-gray-300 px-2 py-1 text-left sticky top-0 bg-gray-100">
                        1-2 Years
                      </th>
                    )}
                    {formData.timePeriod === "2-3" && (
                      <th className="border border-gray-300 px-2 py-1 text-left sticky top-0 bg-gray-100">
                        2-3 Years
                      </th>
                    )}
                    {formData.timePeriod === "3-4" && (
                      <th className="border border-gray-300 px-2 py-1 text-left sticky top-0 bg-gray-100">
                        3-4 Years
                      </th>
                    )}
                    {formData.timePeriod === "4-5" && (
                      <th className="border border-gray-300 px-2 py-1 text-left sticky top-0 bg-gray-100">
                        4-5 Years
                      </th>
                    )}
                    {formData.timePeriod === ">5" && (
                      <th className="border border-gray-300 px-2 py-1 text-left sticky top-0 bg-gray-100">
                        5+ Years
                      </th>
                    )}
                    {formData.timePeriod === "All" && (
                      <>
                        <th className="border border-gray-300 px-2 py-1 text-left sticky top-0 bg-gray-100">
                          0-6 Months
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-left sticky top-0 bg-gray-100">
                          7-12 Months
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-left sticky top-0 bg-gray-100">
                          1-2 Years
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-left sticky top-0 bg-gray-100">
                          2-3 Years
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-left sticky top-0 bg-gray-100">
                          3-4 Years
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-left sticky top-0 bg-gray-100">
                          4-5 Years
                        </th>
                        <th className="border border-gray-300 px-2 py-1 text-left sticky top-0 bg-gray-100">
                          5+ Years
                        </th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {paginatedDebtors.map((debtor, index) => (
                    <tr
                      key={`${debtor.AccountNumber}-${index}`}
                      className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                    >
                      <td className="border border-gray-300 px-2 py-1">
                        {debtor.AccountNumber}
                      </td>
                      <td className="border border-gray-300 px-2 py-1">
                        {getFullName(debtor)}
                      </td>
                      <td className="border border-gray-300 px-2 py-1">
                        {getFullAddress(debtor)}
                      </td>
                      <td className="border border-gray-300 px-2 py-1">
                        {debtor.TariffCode}
                      </td>
                      <td className="border border-gray-300 px-2 py-1 text-right">
                        {formatCurrency(debtor.OutstandingBalance)}
                      </td>
                      {formData.timePeriod === "0-6" && (
                        <>
                          <td className="border border-gray-300 px-2 py-1 text-right">
                            {formatCurrency(debtor.Month0)}
                          </td>
                          <td className="border border-gray-300 px-2 py-1 text-right">
                            {formatCurrency(debtor.Month1)}
                          </td>
                          <td className="border border-gray-300 px-2 py-1 text-right">
                            {formatCurrency(debtor.Month2)}
                          </td>
                          <td className="border border-gray-300 px-2 py-1 text-right">
                            {formatCurrency(debtor.Month3)}
                          </td>
                          <td className="border border-gray-300 px-2 py-1 text-right">
                            {formatCurrency(debtor.Month4)}
                          </td>
                          <td className="border border-gray-300 px-2 py-1 text-right">
                            {formatCurrency(debtor.Month5)}
                          </td>
                          <td className="border border-gray-300 px-2 py-1 text-right">
                            {formatCurrency(debtor.Month6)}
                          </td>
                        </>
                      )}
                      {formData.timePeriod === "7-12" && (
                        <>
                          <td className="border border-gray-300 px-2 py-1 text-right">
                            {formatCurrency(debtor.Months7_9)}
                          </td>
                          <td className="border border-gray-300 px-2 py-1 text-right">
                            {formatCurrency(debtor.Months10_12)}
                          </td>
                        </>
                      )}
                      {formData.timePeriod === "1-2" && (
                        <td className="border border-gray-300 px-2 py-1 text-right">
                          {formatCurrency(debtor.Months13_24)}
                        </td>
                      )}
                      {formData.timePeriod === "2-3" && (
                        <td className="border border-gray-300 px-2 py-1 text-right">
                          {formatCurrency(debtor.Months25_36)}
                        </td>
                      )}
                      {formData.timePeriod === "3-4" && (
                        <td className="border border-gray-300 px-2 py-1 text-right">
                          {formatCurrency(debtor.Months37_48)}
                        </td>
                      )}
                      {formData.timePeriod === "4-5" && (
                        <td className="border border-gray-300 px-2 py-1 text-right">
                          {formatCurrency(debtor.Months49_60)}
                        </td>
                      )}
                      {formData.timePeriod === ">5" && (
                        <td className="border border-gray-300 px-2 py-1 text-right">
                          {formatCurrency(debtor.Months61Plus)}
                        </td>
                      )}
                      {formData.timePeriod === "All" && (
                        <>
                          <td className="border border-gray-300 px-2 py-1 text-right">
                            {formatCurrency(
                              debtor.Month0 +
                              debtor.Month1 +
                              debtor.Month2 +
                              debtor.Month3 +
                              debtor.Month4 +
                              debtor.Month5 +
                              debtor.Month6
                            )}
                          </td>
                          <td className="border border-gray-300 px-2 py-1 text-right">
                            {formatCurrency(
                              debtor.Months7_9 + debtor.Months10_12
                            )}
                          </td>
                          <td className="border border-gray-300 px-2 py-1 text-right">
                            {formatCurrency(debtor.Months13_24)}
                          </td>
                          <td className="border border-gray-300 px-2 py-1 text-right">
                            {formatCurrency(debtor.Months25_36)}
                          </td>
                          <td className="border border-gray-300 px-2 py-1 text-right">
                            {formatCurrency(debtor.Months37_48)}
                          </td>
                          <td className="border border-gray-300 px-2 py-1 text-right">
                            {formatCurrency(debtor.Months49_60)}
                          </td>
                          <td className="border border-gray-300 px-2 py-1 text-right">
                            {formatCurrency(debtor.Months61Plus)}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {renderPagination()}
          </>
        )}
      </div>
    );
  };

  // Main render
  if (loading) {
    return (
      <div
        className={`text-center py-8 ${maroon} text-sm animate-pulse font-sans`}
      >
        Loading initial data...
      </div>
    );
  }

  if (error) {
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
    <div
      className={`max-w-7xl mx-auto p-6 bg-white rounded-xl shadow border border-gray-200 text-sm font-sans`}
    >
      {/* Always render form (will be hidden when report is shown) */}
      <div className={showReport ? "hidden" : ""}>{renderForm()}</div>

      {/* Show any report errors even when form is visible */}
      {!showReport && reportError && (
        <div className="mt-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded text-xs">
          {reportError}
        </div>
      )}

      {/* Report container with scrollable content */}
      {showReport && (
        <div
          ref={reportContainerRef}
          className="mt-4 border border-gray-300 rounded-lg overflow-hidden"
          style={{ maxHeight: "calc(100vh - 200px)", overflowY: "auto" }}
        >
          {renderReportTable()}
        </div>
      )}
    </div>
  );
};

export default AgeAnalysis;
