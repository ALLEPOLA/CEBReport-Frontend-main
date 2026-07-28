import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { FaFileDownload, FaPrint } from "react-icons/fa";
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

interface AgeGroupSummary {
  ageGroup: string;
  count: number;
  percentage?: number;
}

interface SolarCustomer {
  AccountNumber: string;
  Name: string;
  Address: string;
  NetType: string;
  InitialAgreementDate: string;
  PanelCapacity?: string;
  AgeInYears?: number;
  AgeGroup?: string;
  ErrorMessage?: string | null;
}

interface SolarAgeAnalysisApiResult {
  AreaCode?: string;
  BillCycle?: string;
  AgeBand?: string;
  Records?: SolarCustomer[];
  AgeBandCounts?: Record<string, number>;
  ErrorMessage?: string | null;
}

const SolarAgeAnalysis: React.FC = () => {
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
  const [customers, setCustomers] = useState<SolarCustomer[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [fullReportLoading, setFullReportLoading] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportMode, setReportMode] = useState<"age" | "full" | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 30;

  const { user } = useUser();
  const { locked } = useReportScope();

  // chart removed

  const [allCustomers, setAllCustomers] = useState<SolarCustomer[]>([]);

  // Age groups for Solar Customers (in years)
  const ageGroups = [
    { value: "0-1", label: "Age <= 1 year" },
    { value: "1-2", label: "1 < Age <= 2" },
    { value: "2-3", label: "2 < Age <= 3" },
    { value: "3-4", label: "3 < Age <= 4" },
    { value: "4-5", label: "4 < Age <= 5" },
    { value: "5-6", label: "5 < Age <= 6" },
    { value: "6-7", label: "6 < Age <= 7" },
    { value: "7-8", label: "7 < Age <= 8" },
    { value: "8+", label: "Age > 8" },
    { value: "null", label: "Agreement date Null" },
  ];

  const [formData, setFormData] = useState({
    billCycle: "",
    areaCode: "",
    ageGroup: "all",
  });

  // Summary data
  const [ageGroupSummary, setAgeGroupSummary] = useState<AgeGroupSummary[]>([]);
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<string | null>(null);

  // Helper functions
  const generateBillCycleOptions = (
    billCycles: string[],
    maxBillCycle: string
  ): BillCycleOption[] => {
    const maxCycle = parseInt(maxBillCycle || "0", 10);

    return billCycles.map((cycle, index) => {
      const numeric = maxCycle - index;
      const match = /^\s*(\d+)\s*-\s*(.*)$/.exec(cycle);
      const label = match ? match[2] : cycle;
      return {
        display: String(label),
        code: String(numeric),
      };
    });
  };

  const getFormattedBillCycle = (): string => {
    const cycleOption = billCycleOptions.find(
      (c) => c.code === formData.billCycle
    );
    return cycleOption
      ? `${formData.billCycle} - ${cycleOption.display}`
      : formData.billCycle;
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
        // Fetch areas — switched to the ordinary endpoint, which already
        // supports region/province scoping and matches the DB connection
        // this report's actual data queries use.
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

        // Fetch bill cycles from the shared bill cycle API
        // Original implementation (kept commented for reference):
        // const maxCycleData = await fetchWithErrorHandling(
        //   "/misapi/api/billcycle/max"
        // );
        // if (maxCycleData.data && maxCycleData.data.BillCycles?.length > 0) {
        //   const options = generateBillCycleOptions(
        //     maxCycleData.data.BillCycles,
        //     maxCycleData.data.MaxBillCycle
        //   );
        //   setBillCycleOptions(options);
        //   setFormData((prev) => ({ ...prev, billCycle: options[0].code }));
        // } else {
        //   setBillCycleOptions([]);
        //   setFormData((prev) => ({ ...prev, billCycle: "" }));
        // }

        // New robust handler: tolerate different response shapes from the billcycle API.
        // billcycle api from billcyclecontroller
        const maxCycleData = await fetchWithErrorHandling(
          "/misapi/api/billcycle/max"
        );

        // Try several common locations/shapes for the bill cycle list and max cycle
        const raw = maxCycleData?.data ?? maxCycleData;

        // Possible shapes:
        // { BillCycles: string[], MaxBillCycle: string }
        // { billCycles: string[], MaxBillCycle: string }
        // { BillCycleList: string[], MaxBillCycle: string }
        // ["202301 - Jan 2023", ...]
        // { Items: [{ Code, Display }], MaxBillCycle: '...'}

        let billCycles: string[] = [];
        let maxBillCycle = "";

        if (Array.isArray(raw)) {
          // response is directly an array
          billCycles = raw.map((r: any) => (typeof r === "string" ? r : String(r)));
        } else if (raw) {
          if (Array.isArray(raw.BillCycles)) billCycles = raw.BillCycles;
          else if (Array.isArray(raw.billCycles)) billCycles = raw.billCycles;
          else if (Array.isArray(raw.BillCycleList)) billCycles = raw.BillCycleList;
          else if (Array.isArray(raw.Items)) {
            // Items might be objects with Display or Label
            billCycles = raw.Items.map((it: any) => it.Display ?? it.Label ?? it.Name ?? it);
          }

          // Max cycle may be in different fields
          maxBillCycle = raw.MaxBillCycle ?? raw.maxBillCycle ?? raw.MaxCycle ?? "";
        }

        if (billCycles && billCycles.length > 0) {
          const options = generateBillCycleOptions(billCycles, String(maxBillCycle || "0"));
          setBillCycleOptions(options);
          setFormData((prev) => ({ ...prev, billCycle: options[0]?.code ?? "" }));
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

  // Calculate age group summary
  const calculateAgeGroupSummary = useCallback(
    (customersList: SolarCustomer[]): AgeGroupSummary[] => {
      const summary: { [key: string]: number } = {};

      ageGroups.forEach((group) => {
        summary[group.value] = 0;
      });

      customersList.forEach((customer) => {
        const ageGroup = customer.AgeGroup || "null";
        if (summary.hasOwnProperty(ageGroup)) {
          summary[ageGroup]++;
        }
      });

      const total = customersList.length;

      return ageGroups.map((group) => ({
        ageGroup: group.label,
        count: summary[group.value],
        percentage:
          total > 0
            ? Math.round((summary[group.value] / total) * 100 * 100) / 100
            : 0,
      }));
    },
    []
  );


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
    if (!formData.areaCode || !formData.billCycle) return;
    setReportLoading(true);
    setViewLoading(true);
    setReportError(null);
    setCustomers([]);
    setAllCustomers([]);

    try {
      const url = `/misapi/api/analysis/solar-age/view?areaCode=${formData.areaCode}&billCycle=${formData.billCycle}&ageBand=all`;

      const data = await fetchWithErrorHandling(url, 120000);

      if (data.errorMessage) {
        throw new Error(data.errorMessage);
      }

      const resultData = (data.data || {}) as SolarAgeAnalysisApiResult;

      if (resultData.ErrorMessage) {
        throw new Error(resultData.ErrorMessage);
      }

      const records = resultData.Records || [];

      setAllCustomers(records);
      setCustomers(records);
      setReportMode("age");
      setCurrentPage(1);

      if (resultData.AgeBandCounts && Object.keys(resultData.AgeBandCounts).length > 0) {
        const summary = ageGroups.map((group) => ({
          ageGroup: group.label,
          count: resultData.AgeBandCounts?.[group.value === "0-1" ? "<=1" : group.value === "8+" ? ">8" : group.value] ?? 0,
          percentage:
            records.length > 0
              ? Math.round(((resultData.AgeBandCounts?.[group.value === "0-1" ? "<=1" : group.value === "8+" ? ">8" : group.value] ?? 0) / records.length) * 10000) / 100
              : 0,
        }));
        setAgeGroupSummary(summary);
      } else {
        const summary = calculateAgeGroupSummary(records);
        setAgeGroupSummary(summary);
      }

      setShowReport(true);

      // Scroll to report after a small delay
      setTimeout(() => {
        if (reportContainerRef.current) {
          reportContainerRef.current.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    } catch (err: any) {
      let errorMessage = "Error fetching report: ";

      if (err.message.includes("timed out")) {
        errorMessage +=
          "The request timed out. Please try again or select a smaller area.";
      } else {
        errorMessage += err.message || err.toString();
      }

      setReportError(errorMessage);
    } finally {
      setViewLoading(false);
      setReportLoading(false);
    }
  };

  const loadFullReport = async () => {
    if (!formData.areaCode || !formData.billCycle) return;
    setReportLoading(true);
    setFullReportLoading(true);
    setReportError(null);
    setCustomers([]);
    setAllCustomers([]);
    setSelectedAgeGroup(null);
    setReportMode("full");
    setCurrentPage(1);

    try {
      const url = `/misapi/api/analysis/solar-age/full-report?areaCode=${formData.areaCode}&billCycle=${formData.billCycle}`;
      const data = await fetchWithErrorHandling(url, 120000);

      if (data.errorMessage) {
        throw new Error(data.errorMessage);
      }

      const resultData = (data.data || {}) as SolarAgeAnalysisApiResult;
      if (resultData.ErrorMessage) {
        throw new Error(resultData.ErrorMessage);
      }

      const records = resultData.Records || [];
      setAllCustomers(records);
      setCustomers(records);
      setAgeGroupSummary(calculateAgeGroupSummary(records));
      setShowReport(true);

      setTimeout(() => {
        if (reportContainerRef.current) {
          reportContainerRef.current.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    } catch (err: any) {
      let errorMessage = "Error fetching report: ";
      if (err.message.includes("timed out")) {
        errorMessage +=
          "The request timed out. Please try again or select a smaller area.";
      } else {
        errorMessage += err.message || err.toString();
      }
      setReportError(errorMessage);
    } finally {
      setFullReportLoading(false);
      setReportLoading(false);
    }
  };

  const loadAgeGroupDetails = async (ageBand: string) => {
    if (!formData.areaCode || !formData.billCycle) return;
    setReportLoading(true);
    setViewLoading(true);
    setReportError(null);

    try {
      const url = `/misapi/api/analysis/solar-age/view?areaCode=${formData.areaCode}&billCycle=${formData.billCycle}&ageBand=${encodeURIComponent(ageBand)}`;
      const data = await fetchWithErrorHandling(url, 120000);

      if (data.errorMessage) {
        throw new Error(data.errorMessage);
      }

      const resultData = (data.data || {}) as SolarAgeAnalysisApiResult;
      if (resultData.ErrorMessage) {
        throw new Error(resultData.ErrorMessage);
      }

      const records = resultData.Records || [];
      setCustomers(records);
      setSelectedAgeGroup(ageBand);
      setReportMode("age");
      setCurrentPage(1);
    } catch (err: any) {
      let errorMessage = "Error fetching report: ";
      if (err.message.includes("timed out")) {
        errorMessage +=
          "The request timed out. Please try again or select a smaller area.";
      } else {
        errorMessage += err.message || err.toString();
      }
      setReportError(errorMessage);
    } finally {
      setViewLoading(false);
      setReportLoading(false);
    }
  };

  const downloadAsCSV = useCallback(() => {
    if (!customers.length) return;

    const isFullReport = reportMode === "full";

    // Escape a cell value for CSV.
    // Long numeric-only strings (e.g. account numbers) are wrapped with ="..."
    // so Excel / WPS Office renders the full number instead of scientific notation.
    // This also maximises the visible column width because the cell content is
    // treated as text and the full value is always displayed.
    const escapeCell = (value: string): string => {
      if (/^\d{7,}$/.test(value)) {
        // ="5488000000" forces text interpretation and preserves all digits
        return `"=""${value}"""`;
      }
      if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
        // Force text interpretation for dates to prevent Excel from reformatting
        const datePart = value.substring(0, 10);
        return `"=""${datePart}"""`;
      }
      return `"${value.replace(/"/g, '""')}"`;
    };

    const headers = isFullReport
      ? [
        "Account Number",
        "Name",
        "Address",
        "Type",
        "Initial Agreement Date",
        "Panel Capacity",
      ]
      : [
        "Account Number",
        "Name",
        "Address",
        "Net Type",
        "Initial Agreement Date",
        "Age (Years)",
      ];

    const rows = customers.map((customer) =>
      isFullReport
        ? [
          customer.AccountNumber,
          customer.Name,
          customer.Address,
          customer.NetType,
          customer.InitialAgreementDate,
          customer.PanelCapacity || "",
        ]
        : [
          customer.AccountNumber,
          customer.Name,
          customer.Address,
          customer.NetType,
          customer.InitialAgreementDate,
          customer.AgeInYears?.toString() || "N/A",
        ]
    );

    // const summaryRows =
    //   isFullReport
    //     ? []
    //     : [
    //         [],
    //         ["Age Group Summary"],
    //         ...ageGroupSummary.map((item) => [
    //           item.ageGroup,
    //           item.count.toString(),
    //           `${item.percentage}%`,
    //         ]),
    //       ];

    // const csvContent = [
    //   `"Solar Age Analysis Report"`,
    //   `"Bill Cycle: ${getFormattedBillCycle()}"`,
    //   `"Area: ${
    //     areas.find((a) => a.AreaCode === formData.areaCode)?.AreaName
    //   } (${formData.areaCode})"`,
    //   `"Total Customers: ${customers.length}"`,
    //   "",
    //   headers.map((h) => `"${h}"`).join(","),
    //   ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    //   ...summaryRows.map((row) =>
    //     row.map((cell) => `"${cell}"`).join(",")
    //   ),
    // ].join("\n");

    const areaName =
      areas.find((a) => a.AreaCode === formData.areaCode)?.AreaName || "";

    const lines: string[] = [
      `"Solar Age Analysis Report"`,
      `"Bill Cycle: ${getFormattedBillCycle()}"`,
      `"Area: ${areaName} (${formData.areaCode})"`,
      `"Total Customers: ${customers.length}"`,
      "",
      headers.map((h) => `"${h}"`).join(","),
      ...rows.map((row) =>
        row.map((cell) => escapeCell(String(cell ?? ""))).join(",")
      ),
    ];


    //   const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    //   const url = URL.createObjectURL(blob);
    //   const link = document.createElement("a");
    //   link.href = url;
    //   link.download = `SolarAgeAnalysis_Cycle${
    //     formData.billCycle
    //   }_Area${formData.areaCode}_${new Date().toISOString().slice(0, 10)}.csv`;
    //   document.body.appendChild(link);
    //   link.click();
    //   document.body.removeChild(link);
    //   URL.revokeObjectURL(url);
    // }, [customers, formData, billCycleOptions, areas, ageGroupSummary]);

    // UTF-8 BOM ensures Excel / WPS Office opens the file with the correct
    // encoding so special characters (e.g. Sinhala names) are not garbled.
    const BOM = "\uFEFF";
    const csvContent = BOM + lines.join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `SolarAgeAnalysis_Cycle${formData.billCycle}_Area${formData.areaCode
      }_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [customers, reportMode, formData, billCycleOptions, areas, ageGroupSummary]);


  const printPDF = () => {
    if (!customers.length) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const isFullReport = reportMode === "full";
    const generatedDate = new Date().toLocaleDateString();
    const generatedTime = new Date().toLocaleTimeString();

    const generateTableHTML = () => {
      let tableHTML = `
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #f0f0f0;">
              <th style="border: 1px solid #ddd; padding: 2px 4px; text-align: left; font-size: 10px; vertical-align: top; font-weight: bold;">Account Number</th>
              <th style="border: 1px solid #ddd; padding: 2px 4px; text-align: left; font-size: 10px; vertical-align: top; font-weight: bold;">Name</th>
              <th style="border: 1px solid #ddd; padding: 2px 4px; text-align: left; font-size: 10px; vertical-align: top; font-weight: bold;">Address</th>
              <th style="border: 1px solid #ddd; padding: 2px 4px; text-align: left; font-size: 10px; vertical-align: top; font-weight: bold;">${isFullReport ? "Type" : "Net Type"}</th>
              <th style="border: 1px solid #ddd; padding: 2px 4px; text-align: left; font-size: 10px; vertical-align: top; font-weight: bold;">Initial Agreement Date</th>
              ${isFullReport ? '<th style="border: 1px solid #ddd; padding: 2px 4px; text-align: left; font-size: 10px; vertical-align: top; font-weight: bold;">Panel Capacity</th>' : ''}
            </tr>
          </thead>
          <tbody>`;

      customers.forEach((customer, index) => {
        const bgColor = index % 2 === 0 ? "#ffffff" : "#f9f9f9";
        tableHTML += `
          <tr style="background-color: ${bgColor};">
            <td style="border: 1px solid #ddd; padding: 2px 4px; font-size: 10px; vertical-align: top;">${customer.AccountNumber
          }</td>
            <td style="border: 1px solid #ddd; padding: 2px 4px; font-size: 10px; vertical-align: top;">${customer.Name
          }</td>
            <td style="border: 1px solid #ddd; padding: 2px 4px; font-size: 10px; vertical-align: top;">${customer.Address
          }</td>
            <td style="border: 1px solid #ddd; padding: 2px 4px; font-size: 10px; vertical-align: top;">${customer.NetType
          }</td>
            <td style="border: 1px solid #ddd; padding: 2px 4px; font-size: 10px; vertical-align: top;">${customer.InitialAgreementDate
          }</td>
            ${isFullReport ? `<td style="border: 1px solid #ddd; padding: 2px 4px; font-size: 10px; vertical-align: top;">${customer.PanelCapacity || ""}</td>` : ''}
          </tr>`;
      });

      tableHTML += `</tbody></table>`;
      return tableHTML;
    };

    printWindow.document.write(`
      <html>
        <head>
          <title>Solar Age Analysis Report</title>
          <style>
            body { font-family: Arial; font-size: 10px; margin: 10mm; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 2px 4px; border: 1px solid #ddd; font-size: 10px; vertical-align: top; }
            .text-left { text-align: left; }
            .text-right { text-align: right; }
            .header {
              font-weight: bold;
              margin-bottom: 5px;
              color: #0f4c81;
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
                content: "Generated on: ${generatedDate} at ${generatedTime} | Reporting@2026";
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
          <div class="header">SOLAR AGE ANALYSIS REPORT</div>
          <div class="subheader">
            Area: <span class="bold">${areas.find((a) => a.AreaCode === formData.areaCode)?.AreaName
      } (${formData.areaCode})</span><br>
            Bill Cycle: <span class="bold">${getFormattedBillCycle()}</span><br>
            Total Customers: <span class="bold">${customers.length}</span><br>
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
  const handleBack = () => {
    setShowReport(false);
    setCustomers([]);
    setAllCustomers([]);
    setReportError(null);
    setAgeGroupSummary([]);
    setSelectedAgeGroup(null);
    setReportMode(null);
    setCurrentPage(1);
  };


  const renderForm = () => (
    <>
      <h2 className={`text-xl font-bold mb-6 ${maroon}`}>
        Age Analysis of Solar Power Consumers
      </h2>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <option key={area.AreaCode} value={area.AreaCode} className="text-xs py-1">
                    {area.AreaCode} - {area.AreaName}
                  </option>
                ))}
              </select>
            )}
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
        </div>

        {/* Buttons */}
        <div className="w-full mt-6 flex justify-end gap-3">
          <button
            type="submit"
            disabled={viewLoading || fullReportLoading || !formData.areaCode || !formData.billCycle}
            className={`
              px-6 py-2 rounded-md font-medium transition-opacity duration-300 shadow
              ${maroonGrad} text-white
              ${viewLoading || fullReportLoading ? "opacity-70 cursor-not-allowed" : "hover:opacity-90"}
            `}
          >
            {viewLoading ? (
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
              "View Details"
            )}
          </button>
          <button
            type="button"
            onClick={loadFullReport}
            disabled={viewLoading || fullReportLoading || !formData.areaCode || !formData.billCycle}
            className={`
              px-6 py-2 rounded-md font-medium transition-opacity duration-300 shadow
              ${maroonGrad} text-white
              ${viewLoading || fullReportLoading || !formData.areaCode || !formData.billCycle
                ? "opacity-70 cursor-not-allowed"
                : "hover:opacity-90"}
            `}
          >
            {fullReportLoading ? (
              <span className="flex items-center">
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading...
              </span>
            ) : (
              "Full Report"
            )}
          </button>
        </div>
      </form>
    </>
  );

  const renderSummary = () => {
    if (!ageGroupSummary.length) return null;

    return (
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded max-w-md">
        <div className="space-y-1">
          {ageGroupSummary.map((item, index) => {
            const ageGroupValue = ageGroups[index]?.value || "";
            const isSelected = selectedAgeGroup === ageGroupValue;
            return (
              <div
                key={index}
                className={`flex items-center justify-between gap-2 rounded border px-2 py-1.5 ${isSelected
                    ? "border-[#7A0000] bg-red-50"
                    : "border-gray-200 bg-white"
                  }`}
              >
                <div className="text-sm font-medium text-gray-800 leading-none">
                  {item.ageGroup}
                </div>
                <button
                  onClick={() => {
                    if (isSelected) {
                      setSelectedAgeGroup(null);
                      setCustomers(allCustomers);
                      setCurrentPage(1);
                      return;
                    }
                    void loadAgeGroupDetails(ageGroupValue);
                  }}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium whitespace-nowrap ${isSelected ? "bg-[#7A0000] text-white" : "bg-white border border-gray-300 text-[#7A0000] hover:bg-[#7A0000] hover:text-white"}`}
                >
                  {isSelected ? "Viewing" : "View"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const getFilteredCustomers = () => {
    return customers;
  };

  const renderFilteredTable = () => {
    if (!reportMode) return null;

    const filteredData = getFilteredCustomers();
    const isFullReport = reportMode === "full";
    const showDetailsTable = isFullReport || Boolean(selectedAgeGroup);
    const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const startIndex = (safePage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedData = filteredData.slice(startIndex, endIndex);

    return (
      <div className="mt-8 p-4 bg-white border border-gray-300 rounded">
        {/* Clear Filter button when viewing an age-filtered view */}
        {reportMode === "age" && selectedAgeGroup && (
          <div className="w-full flex justify-end mb-3">
            <button
              onClick={() => {
                setSelectedAgeGroup(null);
                setCustomers(allCustomers);
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 bg-[#7A0000] hover:bg-[#A52A2A] text-xs rounded-md text-white"
            >
              Clear Filter
            </button>
          </div>
        )}
        {showDetailsTable && filteredData.length === 0 ? (
          <p className="text-gray-500 text-sm">No customers found in this age group.</p>
        ) : showDetailsTable ? (
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
                    {isFullReport ? "Type" : "Net Type"}
                  </th>
                  <th className="border border-gray-300 px-2 py-1 text-left sticky top-0 bg-gray-100">
                    Initial Agreement Date
                  </th>
                  {isFullReport && (
                    <th className="border border-gray-300 px-2 py-1 text-left sticky top-0 bg-gray-100">
                      Panel Capacity
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((customer, index) => (
                  <tr
                    key={`${customer.AccountNumber}-${index}`}
                    className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    <td className="border border-gray-300 px-2 py-1">
                      {customer.AccountNumber}
                    </td>
                    <td className="border border-gray-300 px-2 py-1">
                      {customer.Name}
                    </td>
                    <td className="border border-gray-300 px-2 py-1">
                      {customer.Address}
                    </td>
                    <td className="border border-gray-300 px-2 py-1">
                      {customer.NetType}
                    </td>
                    <td className="border border-gray-300 px-2 py-1">
                      {customer.InitialAgreementDate}
                    </td>
                    {isFullReport && (
                      <td className="border border-gray-300 px-2 py-1">
                        {customer.PanelCapacity || ""}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-3 flex items-center justify-between text-xs text-gray-700">
              <span>
                Showing {startIndex + 1}-{Math.min(endIndex, filteredData.length)} of {filteredData.length}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={safePage <= 1}
                  className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
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
                  className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  const renderReportTable = () => {
    if (!customers.length && !reportLoading && !reportError) return null;
    const isFullReport = reportMode === "full";

    return (
      <div className="mt-8" ref={printRef}>
        <div className="flex justify-between items-center mb-2">
          <h3 className={`text-lg font-semibold ${maroon}`}>
            {isFullReport ? "Solar Customers Full Report" : "Age Analysis of Solar Power Consumers"}
          </h3>
          <div className="flex gap-2 mt-2">
            <button
              onClick={downloadAsCSV}
              className="flex items-center gap-1 px-3 py-1.5 border border-blue-400 text-blue-700 bg-white rounded-md text-xs font-medium shadow-sm hover:bg-blue-50 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-200 transition"
              disabled={!customers.length}
            >
              <FaFileDownload className="w-3 h-3" /> CSV
            </button>
            <button
              onClick={printPDF}
              className="flex items-center gap-1 px-3 py-1.5 border border-green-400 text-green-700 bg-white rounded-md text-xs font-medium shadow-sm hover:bg-green-50 hover:text-green-800 focus:outline-none focus:ring-2 focus:ring-green-200 transition"
              disabled={!customers.length}
            >
              <FaPrint className="w-3 h-3" /> PDF
            </button>

            {/* chart removed */}
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
        <p className="text-sm text-gray-600 mb-4">
          Area: {areas.find((a) => a.AreaCode === formData.areaCode)?.AreaName}{" "}
          ({formData.areaCode})
        </p>

        {reportLoading && (
          <div
            className={`text-center py-8 ${maroon} text-sm animate-pulse font-sans`}
          >
            <div className="flex items-center justify-center">
              <svg
                className={`animate-spin -ml-1 mr-3 h-5 w-5 ${maroon}`}
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
            </div>
          </div>
        )}

        {reportError && (
          <div className="mt-6 text-red-600 bg-red-100 border border-red-300 p-4 rounded text-sm">
            <strong>Error:</strong> {reportError}
          </div>
        )}

        {!reportLoading && !reportError && customers.length > 0 && (
          <>
            {/* Summary Section */}
            {!isFullReport && renderSummary()}

            {/* Filtered Table Section */}
            {renderFilteredTable()}
          </>
        )}
      </div>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className={`max-w-7xl mx-auto p-6 text-center ${maroon}`}>
        <svg
          className={`animate-spin mx-auto h-6 w-6 ${maroon}`}
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
      {/* Form section */}
      <div className={showReport ? "hidden" : ""}>{renderForm()}</div>

      {/* Show any report errors even when form is visible */}
      {!showReport && reportError && (
        <div className="mt-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded text-xs">
          {reportError}
        </div>
      )}

      {/* Report container */}
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

export default SolarAgeAnalysis;
