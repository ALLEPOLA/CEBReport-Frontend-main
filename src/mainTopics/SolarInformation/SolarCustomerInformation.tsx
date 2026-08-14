import React, { useState, useRef } from "react";
import { FaFileDownload, FaPrint, FaTimes } from "react-icons/fa";
import { useUser } from "../../contexts/UserContext";
import { isWithinUserScope } from "../../hooks/useReportScope";

interface CustomerInfo {
    AreaCode: string;
    AreaName: string;
    AccountNumber: string;
    Name: string;
    Address: string;
    TelephoneNumber: string;
    AgreementDate: string;
    GenerationCapacity: number;
    Bank: string;
    Branch: string;
    BankAccountNumber: string;
    NoOfPhase: string | null;
    ContractDemand: string | null;
    CrntDepot: string;
    SubstnCode: string;
    TariffCode: string;
    NetType: string;
}

interface EnergyHistory {
    CalcCycle: string;
    EnergyExported: string;
    EnergyImported: string;
    PresentReadingDate: string;
    PreviousReadingDate: string;
    PresentReadingExport: string;
    PreviousReadingExport: string;
    MeterNumber: string;
    MeterNumber1: string;
    MeterNumber2: string;
    MeterNumber3: string;
    UnitCost: number;
    UnitSale: number;
    Kwo: string;
    Kwd: string;
    Kwp: string;
    Kva: string;
}

interface CustomerInformationResponse {
    CustomerType: string;
    AccountNumber: string;
    CustomerInfo: CustomerInfo;
    EnergyHistory: EnergyHistory[];
}

const SolarCustomerInformation: React.FC = () => {
    const maroon = "text-[#7A0000]";
    const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";

    const [accountNumber, setAccountNumber] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [customerData, setCustomerData] = useState<CustomerInformationResponse | null>(null);
    const [reportVisible, setReportVisible] = useState(false);
    const { user } = useUser();

    const printRef = useRef<HTMLDivElement>(null);

    // Helper function to map NetType codes to display names
    const getNetTypeName = (netType: string): string => {
        const netTypeMap: { [key: string]: string } = {
            "1": "Net Metering",
            "2": "Net Accounting",
            "3": "Net Plus",
            "4": "Convert Net Plus to Net Accounting",
            "5": "Convert Net Metering to Net Accounting",
        };
        return netTypeMap[netType] || netType;
    };

    // Helper function to format date - removes time portion
    const formatDate = (dateString: string): string => {
        if (!dateString) return "";
        // Split by space and take only the date part
        return dateString.split(' ')[0];
    };

    // Format number with comma separators
    const formatNumber = (value: number | string): string => {
        const cleaned =
            typeof value === 'string'
                ? value.replace(/,/g, '')
                : value;

        const num = Number(cleaned);

        if (isNaN(num)) return '0';

        return num.toLocaleString('en-US');
    };

    const convertToMonthYear = (billCycle: number | string): string => {
        try {
            const cycle = typeof billCycle === "string" ? parseInt(billCycle, 10) : billCycle;
            if (isNaN(cycle)) return "Invalid";

            let mnth = (cycle - 100) % 12;
            let m_mnth = mnth;
            let yr = 97 + Math.floor((cycle - 100) / 12);

            if (mnth === 0) {
                yr -= 1;
                m_mnth = 12;
            }

            const yr1 = (yr % 100).toString().padStart(2, "0");
            const months = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

            return m_mnth >= 1 && m_mnth <= 12 ? `${months[m_mnth]} ${yr1}` : "Unknown";
        } catch {
            return "Invalid";
        }
    };

    const formatCalcCycle = (calcCycle: string): string => {
        const label = convertToMonthYear(calcCycle);
        return `${calcCycle} - ${label}`;
    };

    const fetchCustomerInformation = async () => {
        if (!accountNumber.trim()) {
            setError("Please enter an account number");
            return;
        }

        setLoading(true);
        setError(null);
        setReportVisible(false);
        setCustomerData(null);

        try {
            const response = await fetch(
                `/misapi/solarapi/solarCustomerInformation/${accountNumber.trim()}`
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result.errorMessage) {
                setError(result.errorMessage);
                return;
            }

            if (result.data) {
                const info = result.data.CustomerInfo;

                if (!isWithinUserScope(user, info?.AreaCode, info?.ProvinceCode, info?.Region)) {
                    setError("This account is outside your access scope.");
                    setCustomerData(null);
                    setReportVisible(false);
                    return;
                }

                setCustomerData(result.data);
                setReportVisible(true);
            } else {
                setError("No data found for this account number");
            }
        } catch (err) {
            console.error("Error fetching customer information:", err);
            setError("Failed to fetch customer information. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchCustomerInformation();
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            fetchCustomerInformation();
        }
    };


    const downloadCustomerInfoCSV = () => {
        if (!customerData) return;

        const { CustomerInfo, CustomerType } = customerData;

        // Helper function to escape CSV values
        const escapeCSV = (value: any): string => {
            if (value === null || value === undefined) return '""';
            const strValue = String(value);
            // If value contains comma, quote, or newline, wrap in quotes and escape quotes
            if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
                return `"${strValue.replace(/"/g, '""')}"`;
            }
            return strValue;
        };

        const headers =
            CustomerType === "Ordinary"
                ? [
                    "Account No",
                    "Name",
                    "Address",
                    "Net Type",
                    "Tariff",
                    "Agreement Date",
                    "Generation Capacity (Kw)",
                    "Crnt Depot",
                    "Substn Code",
                    "Bank",
                    "Branch",
                    "Bank Account No",
                    "No of Phase",
                ]
                : [
                    "Account No",
                    "Name",
                    "Address",
                    "Net Type",
                    "Tariff",
                    "Agreement Date",
                    "Generation Capacity (Kw)",
                    "Bank",
                    "Branch",
                    "Bank Account No",
                    "Contract Demand",
                ];

        const row =
            CustomerType === "Ordinary"
                ? [
                    CustomerInfo.AccountNumber,
                    CustomerInfo.Name,
                    CustomerInfo.Address,
                    getNetTypeName(CustomerInfo.NetType),
                    CustomerInfo.TariffCode,
                    formatDate(CustomerInfo.AgreementDate),
                    CustomerInfo.GenerationCapacity,
                    CustomerInfo.CrntDepot || "",
                    CustomerInfo.SubstnCode || "",
                    CustomerInfo.Bank || "",
                    CustomerInfo.Branch || "",
                    CustomerInfo.BankAccountNumber || "",
                    CustomerInfo.NoOfPhase || "",
                ]
                : [
                    CustomerInfo.AccountNumber,
                    CustomerInfo.Name,
                    CustomerInfo.Address,
                    getNetTypeName(CustomerInfo.NetType),
                    CustomerInfo.TariffCode,
                    formatDate(CustomerInfo.AgreementDate),
                    CustomerInfo.GenerationCapacity,
                    CustomerInfo.Bank || "",
                    CustomerInfo.Branch || "",
                    CustomerInfo.BankAccountNumber || "",
                    CustomerInfo.ContractDemand || "",
                ];

        const csvContent = [
            ["Solar Customer Information"],
            [`Area: ${CustomerInfo.AreaCode} - ${CustomerInfo.AreaName}`],
            [`Customer Type: ${CustomerType} Customer`],
            [],
            ["Customer Information"],
            headers.map(escapeCSV),
            row.map(escapeCSV),
            [],
            ["Last 6 Months Energy History"],
            (CustomerType === "Ordinary"
                ? [
                    "Calc Cycle",
                    "Energy Imported",
                    "Energy Exported",
                    "Meter Number 1",
                    "Meter Number 2",
                    "Meter Number 3",
                    "Unit Cost",
                    "Net Units",
                ]
                : [
                    "Bill Cycle",
                    "Meter Number",
                    "Kwo",
                    "Kwd",
                    "Kwp",
                    "Kva",
                    "Export Kwd",
                    "Unit Cost",
                    "Net Units",
                ]).map(escapeCSV),
            ...customerData.EnergyHistory.map((item) =>
                (CustomerType === "Ordinary"
                    ? [
                        formatCalcCycle(item.CalcCycle),
                        formatNumber(item.EnergyImported),
                        formatNumber(item.EnergyExported),
                        item.MeterNumber1 || "",
                        item.MeterNumber2 || "",
                        item.MeterNumber3 || "",
                        item.UnitCost.toFixed(2),
                        formatNumber(item.UnitSale.toFixed(2)),
                    ]
                    : [
                        formatCalcCycle(item.CalcCycle),
                        item.MeterNumber || "",
                        formatNumber(item.Kwo),
                        formatNumber(item.Kwd),
                        formatNumber(item.Kwp),
                        formatNumber(item.Kva),
                        formatNumber(item.EnergyExported),
                        item.UnitCost.toFixed(2),
                        formatNumber(item.UnitSale.toFixed(2)),
                    ]).map(escapeCSV)
            ),
        ]
            .map((row) => row.join(","))
            .join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Solar_Customer_Information_${accountNumber}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrint = () => {
        if (printRef.current && customerData) {
            const printContent = printRef.current;
            const windowPrint = window.open("", "_blank");

            if (windowPrint) {
                const { CustomerInfo } = customerData;
                windowPrint.document.write(`
                    <html>
                        <head>
                            
                            <style>
            body { font-family: Arial; font-size: 10px; margin: 10mm; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { padding: 4px 6px; border: 1px solid #ddd; font-size: 10px; vertical-align: top;}
            .text-left { text-align: left; }
            .text-right { text-align: right; }
            h1, h2, h3 { 
              font-weight: bold; 
              margin-bottom: 5px; 
              color: #7A0000;
              font-size: 13px;
            }
            h4 { 
              font-weight: bold; 
              margin-bottom: 5px;
              font-size: 12px;
            }
            .subheader { 
              margin-bottom: 12px; 
              font-size: 11px;
            }
            .section-title {
              font-weight: bold;
              font-size: 11px;
              margin-top: 15px;
              margin-bottom: 8px;
              color: #333;
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
              background-color: #d3d3d3; 
              font-weight: bold; 
              text-align: center; 
            }
            tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            .bold {
              font-weight: bold;
            }
            .total-row {
              background-color: #d3d3d3;
              font-weight: bold;
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
            .header-section {
                                margin-bottom: 10px;
                                padding-bottom: 5px;
                                border-bottom: 1px solid #ccc;
                            }
                            .header-title {
                                color: #7A0000;
                                font-size: 14px;
                                font-weight: bold;
                                margin: 0 0 3px 0;
                            }
                            .header-subtitle {
                                color: #666;
                                font-size: 10px;
                                margin: 0;
                            }
                            

          </style>

                        </head>
                        <body>
                            <div class="header-section">
                                <h1 class="header-title">Solar Customer Information</h1>
                                <p class="header-subtitle">
                                    Area: ${CustomerInfo.AreaCode} - ${CustomerInfo.AreaName} | 
                                    Account Number: ${customerData.AccountNumber}
                                </p>
                                
                            </div>
                            ${printContent.innerHTML}
                        </body>
                    </html>
                `);
                windowPrint.document.close();
                windowPrint.focus();
                setTimeout(() => {
                    windowPrint.print();
                    windowPrint.close();
                }, 250);
            }
        }
    };

    return (
        <div className="p-6 bg-white rounded-lg shadow-md">
            {/* <div className="bg-white shadow-2xl rounded-lg p-6"> */}
            {!reportVisible && (
                <>
                    <h2 className={`text-xl font-bold mb-6 ${maroon}`}>
                        Solar Customer Information
                    </h2>
                    <form onSubmit={handleSearch}>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label
                                    htmlFor="accountNumber"
                                    className="block text-xs font-semibold mb-1 text-[#7A0000]"
                                >
                                    Account Number:
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        id="accountNumber"
                                        value={accountNumber}
                                        onChange={(e) => setAccountNumber(e.target.value)}
                                        onKeyDown={handleKeyPress}
                                        placeholder="Enter account number"
                                        className="w-full px-2 py-1.5 pr-8 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent bg-white [&:-webkit-autofill]:bg-white [&:-webkit-autofill]:shadow-[inset_0_0_0px_1000px_white]"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setAccountNumber("")}
                                        disabled={!accountNumber}
                                        className={`absolute right-2 top-1/2 transform -translate-y-1/2 focus:outline-none ${accountNumber
                                            ? "text-gray-400 hover:text-gray-600 cursor-pointer"
                                            : "text-gray-300 cursor-not-allowed"
                                            }`}
                                        aria-label="Clear account number"
                                    >
                                        <FaTimes className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Submit button */}
                        <div className="w-full mt-6 flex justify-end">
                            <button
                                type="submit"
                                className={`px-6 py-2 rounded-md font-medium transition-opacity duration-300 shadow
                  ${maroonGrad} text-white ${loading || !accountNumber.trim()
                                        ? "opacity-70 cursor-not-allowed"
                                        : "hover:opacity-90"
                                    }`}
                                disabled={loading || !accountNumber.trim()}
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

            {/* Error Message (when not in report view) */}
            {!reportVisible && error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                    {error === "Account number not found in Ordinary or Bulk databases."
                        ? "Invalid Solar customer account number."
                        : error}
                </div>
            )}

            {/* Report Section */}
            {reportVisible && customerData && (
                <div className="mt-6">
                    {/* Report Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
                        <div>
                            <h2 className={`text-xl font-bold ${maroon}`}>
                                Solar Customer Information
                            </h2>
                            <p className="text-sm text-gray-600 mt-1">
                                Area: {customerData.CustomerInfo.AreaCode} - {customerData.CustomerInfo.AreaName} | Account Number: {customerData.AccountNumber} | Customer Type: {customerData.CustomerType}
                            </p>
                        </div>
                        <div className="flex space-x-2 mt-2 md:mt-0">
                            <button
                                onClick={downloadCustomerInfoCSV}
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
                                onClick={() => setReportVisible(false)}
                                className="px-4 py-1.5 bg-[#7A0000] hover:bg-[#A52A2A] text-xs rounded-md text-white flex items-center"
                            >
                                Back to Form
                            </button>
                        </div>
                    </div>

                    {/* Report Content */}
                    <div className="overflow-auto max-h-[calc(100vh-250px)] border border-gray-300 rounded-lg">
                        <div ref={printRef} className="min-w-full py-4 px-4">
                            {/* <div className="mb-4">
                                    <span
                                        className={`inline-block px-4 py-2 rounded-full text-white font-semibold text-xs ${
                                            customerData.CustomerType === "Ordinary"
                                                ? "bg-blue-600"
                                                : "bg-green-600"
                                        }`}
                                    >
                                        {customerData.CustomerType} Customer
                                    </span>
                                </div> */}

                            {/* Customer Information Table */}
                            <div className="mb-8">
                                <h3
                                    className={`text-sm font-bold text-gray-700 mb-4 uppercase tracking-wide ${customerData.CustomerType === "Ordinary"}`}
                                >
                                    {customerData.CustomerType} Customer
                                </h3>
                                <div className="bg-gradient-to-r from-gray-100 to-gray-50 rounded-lg p-4 border-l-4 border-[#7A0000]">
                                    <h4 className="text-base font-bold mb-3 text-[#7A0000]">
                                        Customer Information
                                    </h4>

                                    <table className="w-full border-collapse">
                                        <tbody>
                                            {/* Account Number */}
                                            <tr>
                                                <td className="px-2 py-1 align-top w-1/3">
                                                    <p className="text-xs text-gray-600">Account Number</p>
                                                </td>
                                                <td className="px-2 py-1">
                                                    <p className="text-sm font-semibold text-gray-900">
                                                        {customerData.CustomerInfo.AccountNumber}
                                                    </p>
                                                </td>
                                            </tr>

                                            {/* Name */}
                                            <tr>
                                                <td className="px-2 py-1 align-top">
                                                    <p className="text-xs text-gray-600">Name</p>
                                                </td>
                                                <td className="px-2 py-1">
                                                    <p className="text-sm font-semibold text-gray-900">
                                                        {customerData.CustomerInfo.Name}
                                                    </p>
                                                </td>
                                            </tr>

                                            {/* Address */}
                                            <tr>
                                                <td className="px-2 py-1 align-top">
                                                    <p className="text-xs text-gray-600">Address</p>
                                                </td>
                                                <td className="px-2 py-1">
                                                    <p className="text-sm font-semibold text-gray-900">
                                                        {customerData.CustomerInfo.Address}
                                                    </p>
                                                </td>
                                            </tr>

                                            {/* Telephone */}
                                            <tr>
                                                <td className="px-2 py-1 align-top">
                                                    <p className="text-xs text-gray-600">Telephone Number</p>
                                                </td>
                                                <td className="px-2 py-1">
                                                    <p className="text-sm font-semibold text-gray-900">
                                                        {customerData.CustomerInfo.TelephoneNumber || "—"}
                                                    </p>
                                                </td>
                                            </tr>

                                            {/* Net Type */}
                                            <tr>
                                                <td className="px-2 py-1 align-top">
                                                    <p className="text-xs text-gray-600">Net Type</p>
                                                </td>
                                                <td className="px-2 py-1">
                                                    <p className="text-sm font-semibold text-gray-900">
                                                        {getNetTypeName(customerData.CustomerInfo.NetType)}
                                                    </p>
                                                </td>
                                            </tr>

                                            {/* Tariff */}
                                            <tr>
                                                <td className="px-2 py-1 align-top">
                                                    <p className="text-xs text-gray-600">Tariff Code</p>
                                                </td>
                                                <td className="px-2 py-1">
                                                    <p className="text-sm font-semibold text-gray-900">
                                                        {customerData.CustomerInfo.TariffCode}
                                                    </p>
                                                </td>
                                            </tr>

                                            {/* Agreement Date */}
                                            <tr>
                                                <td className="px-2 py-1 align-top">
                                                    <p className="text-xs text-gray-600">Agreement Date</p>
                                                </td>
                                                <td className="px-2 py-1">
                                                    <p className="text-sm font-semibold text-gray-900">
                                                        {formatDate(customerData.CustomerInfo.AgreementDate)}
                                                    </p>
                                                </td>
                                            </tr>

                                            {/* Generation Capacity */}
                                            <tr>
                                                <td className="px-2 py-1 align-top">
                                                    <p className="text-xs text-gray-600">Generation Capacity</p>
                                                </td>
                                                <td className="px-2 py-1">
                                                    <p className="text-sm font-semibold text-gray-900">
                                                        {customerData.CustomerInfo.GenerationCapacity.toFixed(2)} kW
                                                    </p>
                                                </td>
                                            </tr>

                                            {/* Current Depot – Only for Ordinary */}
                                            {customerData.CustomerType === "Ordinary" && (
                                                <>
                                                    <tr>
                                                        <td className="px-2 py-1 align-top">
                                                            <p className="text-xs text-gray-600">Current Depot</p>
                                                        </td>
                                                        <td className="px-2 py-1">
                                                            <p className="text-sm font-semibold text-gray-900">
                                                                {customerData.CustomerInfo.CrntDepot || "—"}
                                                            </p>
                                                        </td>
                                                    </tr>

                                                    <tr>
                                                        <td className="px-2 py-1 align-top">
                                                            <p className="text-xs text-gray-600">Substation Code</p>
                                                        </td>
                                                        <td className="px-2 py-1">
                                                            <p className="text-sm font-semibold text-gray-900">
                                                                {customerData.CustomerInfo.SubstnCode || "—"}
                                                            </p>
                                                        </td>
                                                    </tr>
                                                </>
                                            )}

                                            {/* Bank */}
                                            <tr>
                                                <td className="px-2 py-1 align-top">
                                                    <p className="text-xs text-gray-600">Bank</p>
                                                </td>
                                                <td className="px-2 py-1">
                                                    <p className="text-sm font-semibold text-gray-900">
                                                        {customerData.CustomerInfo.Bank || "—"}
                                                    </p>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="px-2 py-1 align-top">
                                                    <p className="text-xs text-gray-600">Branch</p>
                                                </td>
                                                <td className="px-2 py-1">
                                                    <p className="text-sm font-semibold text-gray-900">
                                                        {customerData.CustomerInfo.Branch || "—"}
                                                    </p>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="px-2 py-1 align-top">
                                                    <p className="text-xs text-gray-600">Bank Account Number</p>
                                                </td>
                                                <td className="px-2 py-1">
                                                    <p className="text-sm font-semibold text-gray-900">
                                                        {customerData.CustomerInfo.BankAccountNumber || "—"}
                                                    </p>
                                                </td>
                                            </tr>

                                            {customerData.CustomerType === "Ordinary" && (
                                                <>
                                                    <tr>
                                                        <td className="px-2 py-1 align-top">
                                                            <p className="text-xs text-gray-600">Number of Phases</p>
                                                        </td>
                                                        <td className="px-2 py-1">
                                                            <p className="text-sm font-semibold text-gray-900">
                                                                {customerData.CustomerInfo.NoOfPhase || "—"}
                                                            </p>
                                                        </td>
                                                    </tr>
                                                </>
                                            )}

                                            {/* Contract Demand – Only for Bulk */}
                                            {customerData.CustomerType === "Bulk" && (
                                                <tr>
                                                    <td className="px-2 py-1 align-top">
                                                        <p className="text-xs text-gray-600">Contract Demand</p>
                                                    </td>
                                                    <td className="px-2 py-1">
                                                        <p className="text-sm font-semibold text-gray-900">
                                                            {customerData.CustomerInfo.ContractDemand || "—"}
                                                        </p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                            </div>

                            {/* Energy History Table */}
                            <div>
                                <h4 className="text-base font-bold mb-3 text-[#7A0000]">
                                    Last 6 Months Energy History
                                </h4>
                                {customerData.EnergyHistory.length > 0 ? (
                                    <table className="w-full border-collapse text-xs">
                                        <thead className="bg-gray-200 sticky top-0">
                                            <tr>
                                                {customerData.CustomerType === "Ordinary" ? (
                                                    <>
                                                        <th className="border border-gray-300 px-2 py-1 text-center">
                                                            Calc Cycle
                                                        </th>
                                                        <th className="border border-gray-300 px-2 py-1 text-center">
                                                            Energy Imported
                                                        </th>
                                                        <th className="border border-gray-300 px-2 py-1 text-center">
                                                            Energy Exported
                                                        </th>
                                                        <th className="border border-gray-300 px-2 py-1 text-center">
                                                            Meter Number 1
                                                        </th>
                                                        <th className="border border-gray-300 px-2 py-1 text-center">
                                                            Meter Number 2
                                                        </th>
                                                        <th className="border border-gray-300 px-2 py-1 text-center">
                                                            Meter Number 3
                                                        </th>
                                                        <th className="border border-gray-300 px-2 py-1 text-center">
                                                            Unit Cost
                                                        </th>
                                                        <th className="border border-gray-300 px-2 py-1 text-center">
                                                            Net Units
                                                        </th>
                                                    </>
                                                ) : (
                                                    <>
                                                        <th className="border border-gray-300 px-2 py-1 text-center">
                                                            Bill Cycle
                                                        </th>
                                                        <th className="border border-gray-300 px-2 py-1 text-center">
                                                            Meter Number
                                                        </th>
                                                        {/* <th className="border border-gray-300 px-2 py-1 text-center">
                                                            Energy Imported
                                                        </th> */}

                                                        <th className="border border-gray-300 px-2 py-1 text-center">
                                                            Kwo
                                                        </th>
                                                        <th className="border border-gray-300 px-2 py-1 text-center">
                                                            Kwd
                                                        </th>
                                                        <th className="border border-gray-300 px-2 py-1 text-center">
                                                            Kwp
                                                        </th>
                                                        <th className="border border-gray-300 px-2 py-1 text-center">
                                                            Kva
                                                        </th>
                                                        <th className="border border-gray-300 px-2 py-1 text-center">
                                                            Export Kwd
                                                        </th>

                                                        <th className="border border-gray-300 px-2 py-1 text-center">
                                                            Unit Cost
                                                        </th>
                                                        <th className="border border-gray-300 px-2 py-1 text-center">
                                                            Net Units
                                                        </th>
                                                    </>
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {customerData.EnergyHistory.map((item, index) => (
                                                <tr
                                                    key={index}
                                                    className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                                                >
                                                    {customerData.CustomerType === "Ordinary" ? (
                                                        <>
                                                            <td className="border border-gray-300 px-2 py-1">
                                                                {formatCalcCycle(item.CalcCycle)}
                                                            </td>
                                                            <td className="border border-gray-300 px-2 py-1 text-right">
                                                                {formatNumber(item.EnergyImported)}
                                                            </td>
                                                            <td className="border border-gray-300 px-2 py-1 text-right">
                                                                {formatNumber(item.EnergyExported)}
                                                            </td>
                                                            <td className="border border-gray-300 px-2 py-1 text-right">
                                                                {item.MeterNumber1}
                                                            </td>
                                                            <td className="border border-gray-300 px-2 py-1 text-right">
                                                                {item.MeterNumber2}
                                                            </td>
                                                            <td className="border border-gray-300 px-2 py-1 text-right">
                                                                {item.MeterNumber3}
                                                            </td>
                                                            <td className="border border-gray-300 px-2 py-1 text-right">
                                                                {item.UnitCost.toFixed(2)}
                                                            </td>
                                                            <td className="border border-gray-300 px-2 py-1 text-right">
                                                                {formatNumber(item.UnitSale.toFixed(2))}
                                                            </td>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <td className="border border-gray-300 px-2 py-1">
                                                                {formatCalcCycle(item.CalcCycle)}
                                                            </td>
                                                            <td className="border border-gray-300 px-2 py-1 text-right">
                                                                {item.MeterNumber || "N/A"}
                                                            </td>
                                                            {/* <td className="border border-gray-300 px-2 py-1 text-right">
                                                                {item.EnergyImported}
                                                            </td> */}

                                                            <td className="border border-gray-300 px-2 py-1 text-right">
                                                                {formatNumber(item.Kwo)}
                                                            </td>
                                                            <td className="border border-gray-300 px-2 py-1 text-right">
                                                                {formatNumber(item.Kwd)}
                                                            </td>
                                                            <td className="border border-gray-300 px-2 py-1 text-right">
                                                                {formatNumber(item.Kwp)}
                                                            </td>
                                                            <td className="border border-gray-300 px-2 py-1 text-right">
                                                                {formatNumber(item.Kva)}
                                                            </td>
                                                            <td className="border border-gray-300 px-2 py-1 text-right">
                                                                {formatNumber(item.EnergyExported)}
                                                            </td>

                                                            <td className="border border-gray-300 px-2 py-1 text-right">
                                                                {item.UnitCost.toFixed(2)}
                                                            </td>
                                                            <td className="border border-gray-300 px-2 py-1 text-right">
                                                                {formatNumber(item.UnitSale.toFixed(2))}
                                                            </td>
                                                        </>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="p-4 bg-gray-100 rounded-lg text-center text-gray-600 text-sm">
                                        No energy history available
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* </div> */}
        </div>
    );
};

export default SolarCustomerInformation;