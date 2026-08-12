import React, { useState, useRef, useEffect } from "react";
import { MdPermIdentity, MdDateRange } from "react-icons/md";
import { FaFileDownload, FaPrint } from "react-icons/fa";
import { useReportScope } from "../../hooks/useReportScope";
import { useUser } from "../../contexts/UserContext";

interface PaymentRecord {
  id: string;
  paymentDate: string;
  amount: number;
  center: string;
  counter: string;
  counterName: string;
  paymentMode: string;
  chequeNo: string;
  stubNo: string;
  user: string;
  [key: string]: any;
}

interface POSCollectionRecord {
  id: string;
  date: string;
  counter: string;
  billType: string;
  amount: number;
  payMode: string;
  [key: string]: any;
}

interface LatestUpdateTimeRecord {
  agent: string;
  center: string;
  lastUpdate: string;
  agentName: string;
  centerName: string;
}

interface PaymentInquiryResult {
  accountNumber: string;
  areaName: string;
  customerName: string;
  customerType: string;
  address1: string;
  address2: string;
  address3: string;
  fromDate: string;
  toDate: string;
  totalAmount: number;
  paymentRecords: PaymentRecord[];
  errorMessage: string | null;
}

interface POSCollectionResult {
  province: string;
  area: string;
  counter: string;
  billType: string;
  payMode: string;
  date: string;
  totalAmount: number;
  totalTransactions: number;
  collectionRecords: POSCollectionRecord[];
  errorMessage: string | null;
}

const formatDateDMY = (dateStr: string) => {
  if (!dateStr) return "";
  // Check if YYYY-MM-DD
  if (dateStr.includes("-")) {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return `${parts[0]}/${parts[1]}/${parts[2]}`;
    }
  }
  // Check if MM/DD/YYYY
  if (dateStr.includes("/")) {
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      if (parts[0].length <= 2 && parts[1].length <= 2 && parts[2].length === 4) {
        return `${parts[1].padStart(2, '0')}/${parts[0].padStart(2, '0')}/${parts[2]}`;
      }
      if (parts[0].length === 4) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }
  }
  return dateStr;
};

const PaymentInquiry: React.FC = () => {
  const { level, locked } = useReportScope();
  const { user } = useUser();
  const lockedRegionCode = locked["Region"]?.code;
  const lockedProvinceCode = locked["Province"]?.code;
  const lockedAreaCode = locked["Area"]?.code;

  const maroon = "text-[#7A0000]";
  const maroonBg = "bg-[#7A0000]";
  const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";

  // Form State - Individual Payments
  const [acctNo, setAcctNo] = useState("");
  const [fromDate, setFromDate] = useState("");

  // Form State - POS Collection
  const [province, setProvince] = useState("");
  const [area, setArea] = useState("");
  const [counter, setCounter] = useState("");
  const [billType, setBillType] = useState("*");
  const [payMode, setPayMode] = useState("*");
  const [posDate, setPosDate] = useState("");

  // Result State
  const [individualLoading, setIndividualLoading] = useState(false);
  const [posLoading, setPosLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentResult, setPaymentResult] = useState<PaymentInquiryResult | null>(null);
  const [posResult, setPosResult] = useState<POSCollectionResult | null>(null);
  const [latestUpdateTimes, setLatestUpdateTimes] = useState<LatestUpdateTimeRecord[] | null>(null);
  const [latestUpdateError, setLatestUpdateError] = useState<string | null>(null);
  const [latestUpdateLoading, setLatestUpdateLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"individual" | "pos" | null>(null);
  const [posPage, setPosPage] = useState(1);
  const [authorizedAreaName, setAuthorizedAreaName] = useState("");

  // Print refs
  const paymentPrintRef = useRef<HTMLDivElement>(null);
  const posPrintRef = useRef<HTMLDivElement>(null);
  const latestUpdateTimesPrintRef = useRef<HTMLDivElement>(null);

  // Dynamic data for dropdowns (loaded from API)
  const [provinces, setProvinces] = useState<{ id: string; label: string }[]>([
    { id: "", label: "Select Province" },
  ]);
  const [areas, setAreas] = useState<{ id: string; label: string }[]>([
    { id: "", label: "Select Area" },
  ]);
  const [counters, setCounters] = useState<{ id: string; label: string }[]>([
    /* Original text:
    { id: "", label: "Select Counter" },
    */
    { id: "", label: "All Counters" },
  ]);

  // Fetch provinces on component mount
  useEffect(() => {
    const fetchProvinces = async () => {
      try {
        let url = "/misapi/api/customerdetails/pos-provinces";
        if (level === 70 && lockedRegionCode) {
          url = `/misapi/api/ordinary/province?regionCode=${encodeURIComponent(lockedRegionCode)}`;
        }

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error("Failed to fetch provinces");
        }
        const result = await response.json();
        const provs = result.data?.provinces || result.data?.Provinces || result.data || result;
        if (Array.isArray(provs)) {
          const mapped = provs.map((p: any) => ({
            id: String(p.provCode || p.ProvCode || p.provinceCode || p.ProvinceCode || "").trim(),
            label: String(p.provName || p.ProvName || p.provinceName || p.ProvinceName || "").trim(),
          }));
          const unique = mapped.filter((item, index, self) =>
            item.id && self.findIndex((t) => t.id === item.id) === index
          );
          setProvinces([{ id: "", label: "Select Province" }, ...unique]);

          // Lock to province if Level 60
          if (level === 60 && lockedProvinceCode) {
            const lockedCode = lockedProvinceCode.trim();
            const exists = unique.some((m: any) => m.id.trim() === lockedCode);
            if (exists) {
              setProvince(lockedCode);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching provinces:", error);
      }
    };
    fetchProvinces();
  }, [level, lockedRegionCode, lockedProvinceCode]);

  // If Level < 60 (Area Manager), automatically resolve province code and area name from the area code
  useEffect(() => {
    if (level >= 60 || !lockedAreaCode) return;

    const resolveAreaProvince = async () => {
      try {
        const areaCode = lockedAreaCode.trim().toLowerCase();
        const response = await fetch("/misapi/api/ordinary/areas");
        if (!response.ok) throw new Error("Failed to fetch ordinary areas");
        const result = await response.json();
        
        if (result?.data && Array.isArray(result.data)) {
          const matchedArea = result.data.find(
            (a: any) => String(a.AreaCode || a.areaCode || "").trim().toLowerCase() === areaCode
          );
          if (matchedArea) {
            const resolvedProvCode = String(matchedArea.ProvCode || matchedArea.provCode || "").trim();
            const resolvedAreaName = String(matchedArea.AreaName || matchedArea.areaName || "").trim();
            setProvince(resolvedProvCode);
            setArea(lockedAreaCode.trim());
            setAuthorizedAreaName(resolvedAreaName);
          }
        }
      } catch (err) {
        console.error("Error resolving province for locked area:", err);
      }
    };

    resolveAreaProvince();
  }, [level, lockedAreaCode]);

  // Fetch areas and counters when province changes
  useEffect(() => {
    if (!province) {
      setAreas([{ id: "", label: "Select Area" }]);
      /* Original text:
      setCounters([{ id: "", label: "Select Counter" }]);
      */
      setCounters([{ id: "", label: "All Counters" }]);
      if (level >= 60) {
        setArea("");
      } else if (lockedAreaCode) {
        setArea(lockedAreaCode.trim());
      }
      setCounter("");
      return;
    }

    const fetchAreasAndCounters = async () => {
      // Clear current selection and lists
      if (level >= 60) {
        setArea("");
      } else if (lockedAreaCode) {
        setArea(lockedAreaCode.trim());
      }
      setCounter("");

      try {
        const response = await fetch(
          `/misapi/api/customerdetails/pos-areas?provCode=${encodeURIComponent(province)}`
        );
        if (!response.ok) {
          throw new Error("Failed to fetch areas");
        }
        const result = await response.json();
        const list = result.data?.areas || result.data?.Areas;
        if (Array.isArray(list)) {
          const mapped = list.map((a: any) => ({
            id: String(a.areaCode || a.AreaCode || "").trim(),
            label: String(a.areaName || a.AreaName || "").trim(),
          }));
          const unique = mapped.filter((item, index, self) =>
            item.id && self.findIndex((t) => t.id === item.id) === index
          );
          setAreas([{ id: "", label: "Select Area" }, ...unique]);
          
          if (level < 60 && lockedAreaCode) {
            setArea(lockedAreaCode.trim());
          }
        } else {
          setAreas([{ id: "", label: "Select Area" }]);
        }
      } catch (error) {
        console.error("Error fetching areas:", error);
        setAreas([{ id: "", label: "Select Area" }]);
      }

      try {
        const response = await fetch(
          `/misapi/api/customerdetails/pos-counters?provCode=${encodeURIComponent(province)}`
        );
        if (!response.ok) {
          throw new Error("Failed to fetch counters");
        }
        const result = await response.json();
        const list = result.data?.counters || result.data?.Counters;
        if (Array.isArray(list)) {
          const mapped = list.map((c: any) => ({
            id: String(c.counterNo || c.CounterNo || "").trim(),
            label: String(c.counterName || c.CounterName || "").trim(),
          }));
          const unique = mapped.filter((item, index, self) =>
            item.id && self.findIndex((t) => t.id === item.id) === index
          );
          setCounters([{ id: "", label: "All Counters" }, ...unique]);
        } else {
          /* Original text:
          setCounters([{ id: "", label: "Select Counter" }]);
          */
          setCounters([{ id: "", label: "All Counters" }]);
        }
      } catch (error) {
        console.error("Error fetching counters:", error);
        /* Original text:
        setCounters([{ id: "", label: "Select Counter" }]);
        */
        setCounters([{ id: "", label: "All Counters" }]);
      }
    };

    fetchAreasAndCounters();
  }, [province, level, lockedAreaCode]);

  // Dynamic data for Bill Type and Pay Mode (loaded from API)
  const [billTypes, setBillTypes] = useState<{ id: string; label: string }[]>([
    { id: "*", label: "All" },
    { id: "Bill", label: "Bill" },
    { id: "PIV", label: "PIV" },
  ]);
  const [payModes, setPayModes] = useState<{ id: string; label: string }[]>([
    { id: "*", label: "All" },
  ]);

  // Fetch bill types on component mount
  useEffect(() => {
    const fetchBillTypes = async () => {
      try {
        const response = await fetch("/misapi/api/customerdetails/pos-bill-types");
        if (!response.ok) {
          throw new Error("Failed to fetch bill types");
        }
        const result = await response.json();
        const types = result.data?.billTypes || result.data?.BillTypes;
        if (Array.isArray(types)) {
          const mapped = types.map((t: any) => ({
            id: t.billType || t.BillType,
            label: t.billType || t.BillType,
          }));
          setBillTypes([{ id: "*", label: "All" }, ...mapped]);
        }
      } catch (error) {
        console.error("Error fetching bill types:", error);
      }
    };
    fetchBillTypes();
  }, []);

  // Fetch pay modes on component mount
  // useEffect(() => {
  //   const fetchPayModes = async () => {
  //     try {
  //       const response = await fetch("/api/customerdetails/pos-pay-modes");
  //       if (!response.ok) {
  //         throw new Error("Failed to fetch pay modes");
  //       }
  //       const result = await response.json();
  //       const modes = result.data?.payModes || result.data?.PayModes;
  //       if (Array.isArray(modes)) {
  //         const mapped = modes.map((m: any) => ({
  //           id: m.payMode || m.PayMode,
  //           label: m.codeDescription || m.CodeDescription || m.payMode || m.PayMode,
  //         }));
  //         setPayModes([{ id: "*", label: "All" }, ...mapped]);
  //       }
  //     } catch (error) {
  //       console.error("Error fetching pay modes:", error);
  //     }
  //   };
  //   fetchPayModes();
  // }, []);

  // Fetch pay modes on component mount
useEffect(() => {
  const fetchPayModes = async () => {
    try {
      const response = await fetch("/misapi/api/customerdetails/pos-pay-modes");
      if (!response.ok) throw new Error("Failed to fetch pay modes");

      const result = await response.json();
      const modes = result.data?.payModes || result.data?.PayModes;

      const allowedCodes = ["C", "Q", "D", "R"]; // Cash, Cheque, Bank Draft, Credit Card

      if (Array.isArray(modes)) {
        const mapped = modes
          .filter((m: any) => allowedCodes.includes(m.payMode || m.PayMode))
          .map((m: any) => ({
            id: m.payMode || m.PayMode,
            label: m.codeDescription || m.CodeDescription,
          }));
        setPayModes([{ id: "*", label: "All" }, ...mapped]);
      }
    } catch (error) {
      console.error("Error fetching pay modes:", error);
    }
  };
  fetchPayModes();
}, []);

  const handlePaymentInquiry = async () => {
    setIndividualLoading(true);
    setError(null);
    setPaymentResult(null);
    setActiveTab(null);

    try {
      if (!acctNo) throw new Error("Please enter Account Number");
      if (!fromDate) throw new Error("Please select From Date");

      const payload = {
        acctNo,
        fromDate,
      };

      const response = await fetch("/misapi/api/customerdetails/payment-full-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const payload_response = await response.json();

      if (!response.ok || payload_response?.errorMessage) {
        throw new Error(payload_response?.errorMessage || "Failed to fetch payment inquiry");
      }

      const backendData = payload_response?.data;

      if (!backendData) {
        throw new Error("No data returned from server");
      }

      // Check level-based access control for Area users (Level < 60)
      if (level < 60 && lockedAreaCode) {
        const returnedAreaName = String(backendData.areaName || backendData.AreaName || "").trim().toLowerCase();
        const authAreaName = (authorizedAreaName || user?.AreaName || "").trim().toLowerCase();

        if (returnedAreaName !== authAreaName) {
          throw new Error("This account is outside your access scope.");
        }
      }

      const paymentRecords =
        backendData.paymentRecords ||
        backendData.PaymentRecords ||
        backendData.records ||
        backendData.Records ||
        [];

      // helper to read multiple possible key formats (camelCase, PascalCase, snake_case)
      const getVal = (r: any, ...names: string[]) => {
        for (const n of names) {
          if (r == null) continue;
          if (r[n] !== undefined && r[n] !== null) return r[n];
          const pascal = n.charAt(0).toUpperCase() + n.slice(1);
          if (r[pascal] !== undefined && r[pascal] !== null) return r[pascal];
          const snake = n.replace(/([A-Z])/g, "_$1").toLowerCase();
          if (r[snake] !== undefined && r[snake] !== null) return r[snake];
        }
        return undefined;
      };

      // helper to clean counter name by removing leading numbers and separators
      const cleanCounterName = (name: string) => {
        if (!name) return '';
        return name.replace(/^\d+[\s\-]*/, '').trim();
      };

      const mappedResult: PaymentInquiryResult = {
        accountNumber: backendData.accountNumber || backendData.AccountNumber || acctNo,
        areaName: backendData.areaName || backendData.AreaName || "",
        customerName: backendData.customerName || backendData.CustomerName || "",
        customerType: backendData.customerType || backendData.CustomerType || "",
        address1: backendData.address1 || backendData.Address1 || "",
        address2: backendData.address2 || backendData.Address2 || "",
        address3: backendData.address3 || backendData.Address3 || "",
        fromDate: backendData.fromDate || backendData.FromDate || fromDate,
        toDate: backendData.toDate || backendData.ToDate || new Date().toISOString().split("T")[0],
        totalAmount: Number(backendData.totalAmount ?? backendData.TotalAmount ?? 0),
        paymentRecords: paymentRecords.map((record: any, idx: number) => ({
          id: String(idx + 1),
          // core fields
          paymentDate: String(getVal(record, 'transDate', 'TransDate', 'trans_date') ?? ''),
          amount: Number(getVal(record, 'transAmt', 'TransAmt', 'trans_amt') ?? getVal(record, 'amount', 'Amount') ?? 0) || 0,
          center: String(getVal(record, 'center', 'Center') ?? ''),
          centerName: String(getVal(record, 'centerName', 'CenterName') ?? ''),
          centerDisplay: (() => {
            const centerValue = String(getVal(record, 'center', 'Center') ?? '');
            const agentNameValue = String(getVal(record, 'agentName', 'AgentName') ?? '');
            const centerNameValue = String(getVal(record, 'centerName', 'CenterName') ?? '');
            const parts = [centerValue, agentNameValue, centerNameValue].filter((p) => p && p.trim());
            return parts.join(' - ');
          })(),
          counter: String(getVal(record, 'countNo', 'CountNo', 'count_no') ?? ''),
          counterName: cleanCounterName(String(getVal(record, 'counterName', 'CounterName') ?? '')),
          // payment mode / description
          paymentMode: String(getVal(record, 'codeDescription', 'CodeDescription', 'payMode', 'PayMode', 'pay_mode') ?? ''),
          // cheque / stub
          chequeNo: String(getVal(record, 'chequeMoneyOrderNo', 'ChequeMoneyOrderNo', 'cheque_money_order_no') ?? ''),
          stubNo: String(getVal(record, 'stubNo', 'StubNo') ?? ''),
          // user / agent
          user: String(getVal(record, 'usrLot', 'UsrLot', 'usr_lot') ?? ''),
          agent: String(getVal(record, 'agent', 'Agent') ?? ''),
          agentName: String(getVal(record, 'agentName', 'AgentName') ?? ''),
          transTime: String(getVal(record, 'transTime', 'TransTime', 'trans_time') ?? ''),
          transType: String(getVal(record, 'transType', 'TransType', 'trans_type') ?? ''),
          rawRecord: record,
        })),
        errorMessage: null,
      };

      setPaymentResult(mappedResult);
      setActiveTab("individual");
    } catch (err: any) {
      setError(err.message || "Failed to fetch payment inquiry");
    } finally {
      setIndividualLoading(false);
    }
  };

  const handlePOSInquiry = async () => {
    setPosLoading(true);
    setError(null);
    setPosResult(null);
    setActiveTab(null);
    setPosPage(1);

    try {
      if (!province) throw new Error("Please select Province");
      if (!posDate) throw new Error("Please select Date");

      const payload = {
        TransDate: posDate,
        ProvCode: province || "*",
        AreaCode: area || "*",
        CounterNo: counter || "*",
        PayMode: payMode || "*",
        PayType: billType || "*",
      };

      const response = await fetch("/misapi/api/customerdetails/pos-collection-breakup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const payload_response = await response.json();

      if (!response.ok || payload_response?.errorMessage) {
        throw new Error(payload_response?.errorMessage || "Failed to fetch POS collection breakup");
      }

      const backendData = payload_response?.data;

      if (!backendData) {
        throw new Error("No data returned from server");
      }

      const records = backendData.records || backendData.Records || [];

      const mappedResult: POSCollectionResult = {
        province: backendData.province || backendData.Province || province,
        area: backendData.area || backendData.Area || area,
        counter: backendData.counter || backendData.Counter || counter,
        billType: billType,
        payMode: payMode,
        date: backendData.transDate || backendData.TransDate || posDate,
        totalAmount: Number(backendData.totalAmount ?? backendData.TotalAmount ?? 0),
        totalTransactions: Number(backendData.recordCount ?? backendData.RecordCount ?? records.length),
        collectionRecords: records.map((record: any, idx: number) => {
          const amt = Number(record.transAmount || record.TransAmount || record.trans_amt || record.Trans_Amt || 0) || 0;
          const payModeCode = String(record.payMode || record.PayMode || record.pay_mode || "");
          let cash = 0,
            cheque = 0,
            bankDraft = 0,
            creditCard = 0;

          if (payModeCode === "C") cash = amt;
          else if (payModeCode === "Q") cheque = amt;
          else if (payModeCode === "D") bankDraft = amt;
          else if (payModeCode === "R") creditCard = amt;

          return {
            id: String(idx + 1),
            date: backendData.transDate || backendData.TransDate || posDate,
            accountNo: record.acc_no || record.accNo || record.AccountNo || record.accountNo || "",
            pivNo: record.piv_no || record.pivNo || record.PIVNo || record.PIV_No || "",
            counterNo: record.count_no || record.countNo || record.CountNo || record.counterNo || record.CounterNo || "",
            counterName: record.counterName || record.CounterName || record.counter || record.Counter || "",
            stubNo: record.stub_no || record.stubNo || record.StubNo || "",
            payMode: payModeCode,
            payModeDescription: record.payModeDescription || record.PayModeDescription || record.codeDescription || record.CodeDescription || "",
            transAmount: amt,
            cash,
            cheque,
            bankDraft,
            creditCard,
            billType: record.transType || record.TransType || record.trans_type || "0",
            areaCode: record.area_code || record.areaCode || record.AreaCode || "",
          };
        }),
        errorMessage: null,
      };

      setPosResult(mappedResult);
      setActiveTab("pos");
    } catch (err: any) {
      setError(err.message || "Failed to fetch POS collection data");
    } finally {
      setPosLoading(false);
    }
  };

  const handlePreviewLatestUpdateTimes = async () => {
    setLatestUpdateLoading(true);
    setLatestUpdateError(null);
    setLatestUpdateTimes(null);

    try {
      const response = await fetch("/misapi/api/customerdetails/latest-update-times", {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.errorMessage || "Failed to load latest update times");
      }

      if (payload?.errorMessage) {
        throw new Error(payload.errorMessage);
      }

      // backend returns { data: LatestUpdateTimeResponse, errorMessage }
      // LatestUpdateTimeResponse has `Records` (PascalCase) on the server model
      const raw = payload?.data || null;

      let records: any[] = [];

      if (!raw) {
        records = [];
      } else if (Array.isArray(raw)) {
        records = raw;
      } else if (Array.isArray(raw.records)) {
        records = raw.records;
      } else if (Array.isArray(raw.Records)) {
        records = raw.Records;
      } else if (Array.isArray(payload?.records)) {
        records = payload.records;
      } else if (Array.isArray(payload?.Records)) {
        records = payload.Records;
      }

      // Normalize property names to the frontend record shape
      const mapped = records.map((r: any) => ({
        agent: r.agent ?? r.Agent ?? "",
        center: r.center ?? r.Center ?? "",
        lastUpdate: r.lastUpdate ?? r.LastUpdate ?? "",
        agentName: r.agentName ?? r.AgentName ?? "",
        centerName: r.centerName ?? r.CenterName ?? "",
      }));

      setLatestUpdateTimes(mapped);
    } catch (err: any) {
      setLatestUpdateError(err.message || "Failed to load latest update times");
    } finally {
      setLatestUpdateLoading(false);
    }
  };

  const handlePaymentPrint = () => {
    if (!paymentResult || !paymentPrintRef.current) return;

    const printWindow = window.open("", "_blank", "width=1200,height=800");
    if (!printWindow) return;

    const tableEl = paymentPrintRef.current.querySelector("table");
    const tableHTML = tableEl ? tableEl.outerHTML : paymentPrintRef.current.innerHTML;

    printWindow.document.write(`
      <html>
        <head>
          <title>Payment Inquiry Report</title>
          <style>
            body { font-family: Arial; font-size: 10px; margin: 10mm; }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 11px;
            }
            th, td {
              padding: 5px 8px;
              border: 1px solid #d1d5db;
              line-height: 1.25;
              height: 24px;
            }
            th {
              background-color: #f0f0f0;
              font-weight: bold;
              text-align: left;
            }
            .text-left { text-align: left; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .bold { font-weight: bold; }
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
            tbody tr:nth-child(even) {
              background-color: #f9f9f9;
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
          </style>
        </head>
        <body>
          <div class="header">PAYMENT INQUIRY REPORT</div>
          <div class="subheader">
            Account No: <span class="bold">${paymentResult.accountNumber}</span> &nbsp;&nbsp;&nbsp;&nbsp; Area : <span class="bold">${paymentResult.areaName || "-"}</span><br>
            Customer Name: <span class="bold">${paymentResult.customerName}</span><br>
            Address: <span class="bold">${[paymentResult.address1, paymentResult.address2, paymentResult.address3].filter(Boolean).join(", ") || "-"}</span><br>
            From Date: <span class="bold">${paymentResult.fromDate}</span>
          </div>
          ${tableHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handlePosPrint = () => {
    if (!posResult) return;

    const printWindow = window.open("", "_blank", "width=1200,height=800");
    if (!printWindow) return;

    const tableHTML = `
      <table>
        <thead>
          <tr>
            <th>Account No/PIV No</th>
            <th>Counter</th>
            <th>Stub No.</th>
            <th class="text-right">Cash</th>
            <th class="text-right">Cheque</th>
            <th class="text-right">Bank Draft</th>
            <th class="text-right">Credit Card</th>
          </tr>
        </thead>
        <tbody>
          ${posResult.collectionRecords.map((record, _idx) => `
            <tr>
              <td>${(record.accountNo || "") + (record.pivNo ? ` / ${record.pivNo}` : "")}</td>
              <td>${record.counterNo || record.counter || record.counterName || ""}</td>
              <td>${record.stubNo || ""}</td>
              <td class="text-right">${(record.cash || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td class="text-right">${(record.cheque || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td class="text-right">${(record.bankDraft || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td class="text-right">${(record.creditCard || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3" class="bold text-left">Total</td>
            <td class="text-right bold">${posResult.collectionRecords.reduce((sum, r) => sum + (r.cash || 0), 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td class="text-right bold">${posResult.collectionRecords.reduce((sum, r) => sum + (r.cheque || 0), 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td class="text-right bold">${posResult.collectionRecords.reduce((sum, r) => sum + (r.bankDraft || 0), 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td class="text-right bold">${posResult.collectionRecords.reduce((sum, r) => sum + (r.creditCard || 0), 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          </tr>
        </tfoot>
      </table>
    `;

    printWindow.document.write(`
      <html>
        <head>
          <title>Payment Collection Report</title>
          <style>
            body { font-family: Arial; font-size: 10px; margin: 10mm; }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 11px;
            }
            th, td {
              padding: 5px 8px;
              border: 1px solid #d1d5db;
              line-height: 1.25;
              height: 24px;
            }
            th {
              background-color: #f0f0f0;
              font-weight: bold;
              text-align: left;
            }
            .text-left { text-align: left; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .bold { font-weight: bold; }
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
            tbody tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            tfoot tr {
              font-weight: bold;
              background-color: #f0f0f0;
            }
            /* Keep totals only once at the end of the table in print output */
            tfoot {
              display: table-row-group;
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
          </style>
        </head>
        <body>
          <div class="header">PAYMENT COLLECTION REPORT</div>
          <div class="subheader">
            Payment Collection on <span class="bold">${formatDateDMY(posResult.date)}</span><br>
            Area: <span class="bold">${getAreaLabel()}</span> &nbsp;&nbsp;&nbsp;&nbsp; Counter: <span class="bold">${getCounterLabel()}</span><br>
            Bill Type: <span class="bold">${posResult.billType === "*" ? "All" : posResult.billType}</span> &nbsp;&nbsp;&nbsp;&nbsp; Pay Mode: <span class="bold">${getPayModeLabel()}</span>
          </div>
          ${tableHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handleLatestUpdateTimesPrint = () => {
    if (!latestUpdateTimesPrintRef.current) return;

    const printWindow = window.open("", "_blank", "width=1200,height=800");
    if (!printWindow) return;

    const tableEl = latestUpdateTimesPrintRef.current.querySelector("table");
    const tableHTML = tableEl ? tableEl.outerHTML : latestUpdateTimesPrintRef.current.innerHTML;

    printWindow.document.write(`
      <html>
        <head>
          <title>Latest Update Times of Servers</title>
          <style>
            body { font-family: Arial; font-size: 10px; margin: 10mm; }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 11px;
            }
            th, td {
              padding: 5px 8px;
              border: 1px solid #d1d5db;
              line-height: 1.25;
              height: 24px;
            }
            th {
              background-color: #f0f0f0;
              font-weight: bold;
              text-align: left;
            }
            .text-left { text-align: left; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .bold { font-weight: bold; }
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
            tbody tr:nth-child(even) {
              background-color: #f9f9f9;
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
          </style>
        </head>
        <body>
          <div class="header">LATEST UPDATE TIMES OF SERVERS</div>
          <div class="subheader">
            Generated on: <span class="bold">${new Date().toLocaleString()}</span>
          </div>
          ${tableHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const downloadLatestUpdateTimesCSV = () => {
    if (!latestUpdateTimes?.length) return;

    const rows: string[] = [];
    rows.push("Latest Update Times of Servers Report");
    rows.push("");
    rows.push("Agent,Center,Last Update,Agent Name,Center Name");
    
    latestUpdateTimes.forEach((record) => {
      rows.push(
        `${record.agent},${record.center},"${record.lastUpdate}",${record.agentName || ""},${record.centerName || ""}`
      );
    });

    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Server_Latest_Update_Times.csv`;
    a.click();
  };

  const downloadPaymentCSV = () => {
    if (!paymentResult?.paymentRecords.length) return;

    const rows: string[] = [];
    rows.push("Payment Inquiry Report");
    rows.push(`Account Number,${paymentResult.accountNumber}`);
    rows.push(`Area Name,${paymentResult.areaName || ""}`);
    rows.push(`Customer Name,${paymentResult.customerName}`);
    rows.push(`Customer Type,${paymentResult.customerType || ""}`);
    rows.push(`Address,${[paymentResult.address1, paymentResult.address2, paymentResult.address3].filter(Boolean).join(" | ")}`);
    rows.push(`From Date,${paymentResult.fromDate}`);
    rows.push("");
    rows.push("Payment Date,Amount,Center,Counter,Counter Name,Pay Mode,Cheque No,Stub No,User");
    
    paymentResult.paymentRecords.forEach((record) => {
      rows.push(
        `${record.paymentDate},"${record.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}",${record.centerDisplay || record.center},${record.counter},${record.counterName},${record.paymentMode},${record.chequeNo || ""},${record.stubNo || ""},${record.user || ""}`
      );
    });

    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Payment_Inquiry_${acctNo}.csv`;
    a.click();
  };

  const downloadPosCSV = () => {
    if (!posResult?.collectionRecords.length) return;

    const rows: string[] = [];
    rows.push("POS Collection Report");
    rows.push(`Province,${posResult.province}`);
    rows.push(`Area,${posResult.area}`);
    rows.push(`Counter,${posResult.counter}`);
    rows.push(`Date,${posResult.date}`);
    rows.push(`Total Amount,"${posResult.totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}"`);
    rows.push(`Total Transactions,${posResult.totalTransactions}`);
    rows.push("");
    rows.push("AccountNo/PIVNo,Counter,StubNo,Cash,Cheque,BankDraft,CreditCard");

    posResult.collectionRecords.forEach((record) => {
      const acc = (record.accountNo || "") + (record.pivNo ? `/${record.pivNo}` : "");
      const counter = record.counterNo || record.counter || record.counterName || "";
      rows.push(
        `${acc},${counter},${record.stubNo || ""},"${(record.cash || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}","${(record.cheque || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}","${(record.bankDraft || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}","${(record.creditCard || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}"`
      );
    });

    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `POS_Collection_${posResult.province}.csv`;
    a.click();
  };

  const getAreaLabel = () => {
    if (!posResult) return "";
    if (posResult.area === "*") return "*";
    const found = areas.find((a) => a.id === posResult.area);
    return found ? found.label : posResult.area;
  };

  const getCounterLabel = () => {
    if (!posResult) return "";
    if (posResult.counter === "*") return "*";
    const found = counters.find((c) => c.id === posResult.counter);
    return found ? found.label : posResult.counter;
  };

  const getPayModeLabel = () => {
    if (!posResult) return "";
    if (posResult.payMode === "*") return "All";
    const found = payModes.find((mode) => mode.id === posResult.payMode);
    return found ? found.label : posResult.payMode;
  };

  return (
    <div className="max-w-7xl mx-auto p-4 bg-white rounded-xl shadow border border-gray-200 text-sm font-sans max-h-[82vh] overflow-y-auto">
      {/* Error Alert */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-xs">{error}</p>
        </div>
      )}

      {/* Form Section */}
      <div className="grid grid-cols-1 gap-4 mb-4 w-full">
        {/* Individual Payments Section */}
        <div className="border border-gray-200 rounded-xl p-4 bg-white shadow">
          <h3 className={`text-xl font-bold mb-4 ${maroon}`}>Individual Payments</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            {/* Account Number */}
            <div className="flex flex-col">
              <label className={`${maroon} text-xs font-medium flex items-center gap-1.5 mb-1`}>
                <MdPermIdentity className={maroon} size={16} />
                Account No
              </label>
              {/* Original input with placeholder (kept commented):
              <input
                type="text"
                value={acctNo}
                onChange={(e) => setAcctNo(e.target.value)}
                placeholder="e.g., 5390001419"
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent"
              />
              */}

              {/* Updated input: placeholder removed */}
              <input
                type="text"
                value={acctNo}
                onChange={(e) => setAcctNo(e.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent"
              />
            </div>

            {/* From Date */}
            <div className="flex flex-col">
              <label className={`${maroon} text-xs font-medium flex items-center gap-1.5 mb-1`}>
                <MdDateRange className={maroon} size={16} />
                From
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent"
              />
            </div>
          </div>

          {/* Button */}
          <div className="w-full mt-6 flex justify-end">
            <button
              onClick={handlePaymentInquiry}
              disabled={individualLoading}
              className={`px-6 py-2 rounded-md font-medium transition-opacity duration-300 shadow
            ${maroonGrad} text-white ${
                individualLoading ? "opacity-70 cursor-not-allowed" : "hover:opacity-90"
              }`}
            >
              {individualLoading ? (
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

          {/* Results Section - Payment Inquiry */}
          {activeTab === "individual" && paymentResult && (
            <div ref={paymentPrintRef} className="mt-4 p-4 rounded-xl shadow border border-gray-200 w-full bg-white">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className={`text-xl font-bold ${maroon} mb-2`}>Payment Inquiry Report</h2>
                  {/* Legacy-style header: Account & Area on one line, customer name/address highlighted below */}
                  <div className="w-full text-sm mb-2">
                    <div className="text-sm text-[#7A0000] font-semibold whitespace-pre-line">
                      {`Account No: ${paymentResult.accountNumber} Area : ${paymentResult.areaName || "-"} ${paymentResult.customerName} ${[paymentResult.address1, paymentResult.address2, paymentResult.address3].filter(Boolean).join(", ") || "-"}`}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={downloadPaymentCSV}
                    className="flex items-center gap-1 px-3 py-1.5 border border-blue-400 text-blue-700 bg-white rounded-md text-xs font-medium shadow-sm hover:bg-blue-50 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-200 transition"
                  >
                    <FaFileDownload className="w-3 h-3" /> CSV
                  </button>
                  <button
                    onClick={handlePaymentPrint}
                    className="flex items-center gap-1 px-3 py-1.5 border border-green-400 text-green-700 bg-white rounded-md text-xs font-medium shadow-sm hover:bg-green-50 hover:text-green-800 focus:outline-none focus:ring-2 focus:ring-green-200 transition"
                  >
                    <FaPrint className="w-3 h-3" /> PDF
                  </button>
                  <button
                    onClick={() => setActiveTab(null)}
                    className="px-4 py-1.5 bg-[#7A0000] hover:bg-[#A52A2A] text-xs rounded-md text-white flex items-center"
                  >
                    Back to Form
                  </button>
                </div>
              </div>

              {/* Payment Records Table */}
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 z-10 bg-[#7A0000]">
                    <tr className={`${maroonBg} text-white`}>
                      <th className="p-2 text-left font-semibold">Payment Date</th>
                      <th className="p-2 text-right font-semibold">Amount</th>
                      <th className="p-2 text-left font-semibold">Center</th>
                      <th className="p-2 text-left font-semibold">Counter</th>
                      <th className="p-2 text-left font-semibold">Counter Name</th>
                      <th className="p-2 text-left font-semibold">Pay Mode</th>
                      <th className="p-2 text-left font-semibold">Cheque No</th>
                      <th className="p-2 text-left font-semibold">Stub No</th>
                      <th className="p-2 text-left font-semibold">User</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentResult.paymentRecords.map((record, idx) => (
                      <tr key={record.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="p-2 border-b border-gray-100">{record.paymentDate}</td>
                        <td className="p-2 text-right font-semibold border-b border-gray-100">
                          {record.amount.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="p-2 border-b border-gray-100 whitespace-pre-line">{record.centerDisplay || record.center}</td>
                        <td className="p-2 border-b border-gray-100">{record.counter}</td>
                        <td className="p-2 border-b border-gray-100">{record.counterName}</td>
                        <td className="p-2 border-b border-gray-100">{record.paymentMode}</td>
                        <td className="p-2 border-b border-gray-100">{record.chequeNo || "-"}</td>
                        <td className="p-2 border-b border-gray-100">{record.stubNo || "-"}</td>
                        <td className="p-2 border-b border-gray-100">{record.user || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Timestamp similar to legacy page */}
              <div className="mt-3 text-xs text-gray-600">{new Date().toLocaleString()}</div>
            </div>
          )}
        </div>

        <div className="border border-gray-100 rounded-lg p-4 bg-white shadow-sm">
          <div className="flex flex-col items-start gap-3 mb-3">
            <h3 className={`text-xl font-bold ${maroon}`}>Latest Update Times of Servers</h3>
            <button
              type="button"
              onClick={handlePreviewLatestUpdateTimes}
              className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 rounded-md text-xs font-medium text-white transition-colors"
            >
              Preview latest update times of servers
            </button>
          </div>

          {latestUpdateError && (
            <div className="mb-3 p-3 rounded-lg border border-red-100 bg-red-50">
              <p className="text-xs text-red-600">{latestUpdateError}</p>
            </div>
          )}

          {latestUpdateTimes && (
            <>
              <div className="flex justify-between items-center mb-4">
                <div>
                  {latestUpdateLoading ? (
                    <span className="text-xs text-gray-500">Loading...</span>
                  ) : (
                    <p className="text-xs text-gray-500">
                      Showing all {latestUpdateTimes.length} rows
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={downloadLatestUpdateTimesCSV}
                    className="flex items-center gap-1 px-3 py-1.5 border border-blue-400 text-blue-700 bg-white rounded-md text-xs font-medium shadow-sm hover:bg-blue-50 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-200 transition"
                  >
                    <FaFileDownload className="w-3 h-3" /> CSV
                  </button>
                  <button
                    onClick={handleLatestUpdateTimesPrint}
                    className="flex items-center gap-1 px-3 py-1.5 border border-green-400 text-green-700 bg-white rounded-md text-xs font-medium shadow-sm hover:bg-green-50 hover:text-green-800 focus:outline-none focus:ring-2 focus:ring-green-200 transition"
                  >
                    <FaPrint className="w-3 h-3" /> PDF
                  </button>
                  <button
                    onClick={() => setLatestUpdateTimes(null)}
                    className="px-4 py-1.5 bg-[#7A0000] hover:bg-[#A52A2A] text-xs rounded-md text-white flex items-center"
                  >
                    Back to Form
                  </button>
                </div>
              </div>

              <div ref={latestUpdateTimesPrintRef} className="w-full bg-white p-2">
                <div className="max-h-[70vh] overflow-auto pb-6">
                <table className="min-w-full text-xs border border-gray-200 mb-2">
                  <thead className="bg-[#7A0000] text-white font-semibold">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Agent</th>
                      <th className="px-3 py-2 text-left font-semibold">Center</th>
                      <th className="px-3 py-2 text-left font-semibold">Last Update</th>
                      <th className="px-3 py-2 text-left font-semibold">Agent Name</th>
                      <th className="px-3 py-2 text-left font-semibold">Center Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestUpdateTimes.length > 0 ? (
                      latestUpdateTimes.map((record, idx) => (
                        <tr key={`${record.agent}-${record.center}-${idx}`} className={idx % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                          <td className="px-3 py-2 border-t border-gray-200">{record.agent}</td>
                          <td className="px-3 py-2 border-t border-gray-200">{record.center}</td>
                          <td className="px-3 py-2 border-t border-gray-200">{record.lastUpdate}</td>
                          <td className="px-3 py-2 border-t border-gray-200">{record.agentName}</td>
                          <td className="px-3 py-2 border-t border-gray-200">{record.centerName}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-3 py-3 text-center text-gray-500 border-t border-gray-200">
                          No update times found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {/* Timestamp similar to legacy page */}
              <div className="mt-3 text-xs text-gray-600 mb-2">{new Date().toLocaleString()}</div>
            </div>
            </>
          )}
        </div>

        {/* POS Counter Collection Section */}
        <div className="border border-gray-100 rounded-lg p-4 bg-white shadow-sm">
          <h3 className={`text-xl font-bold ${maroon} mb-3`}>POS Counter Collection Breakup</h3>

          {/* Row 1: Province | Area | Counter */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end justify-between gap-3 mb-3">
            {/* Province */}
            <div className="flex flex-col w-full sm:w-[32%]">
              <label className="text-xs text-gray-600 mb-1">Province</label>
              <select
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                disabled={level < 70}
                className={`w-full px-2 py-1.5 text-xs border rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent ${
                  level < 70
                    ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                    : "border-gray-300"
                }`}
              >
                {provinces.map((prov) => (
                  <option key={prov.id} value={prov.id}>
                    {prov.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Area */}
            <div className="flex flex-col w-full sm:w-[32%]">
              <label className="text-xs text-gray-600 mb-1">Area</label>
              <select
                value={area}
                onChange={(e) => setArea(e.target.value)}
                disabled={level < 60}
                className={`w-full px-2 py-1.5 text-xs border rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent ${
                  level < 60
                    ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                    : "border-gray-300"
                }`}
              >
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Counter */}
            <div className="flex flex-col w-full sm:w-[32%]">
              <label className="text-xs text-gray-600 mb-1">Counter</label>
              <select
                value={counter}
                onChange={(e) => setCounter(e.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent"
              >
                {counters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Bill Type | Pay Mode | Date */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end justify-between gap-3 mb-3">
            {/* Bill Type */}
            <div className="flex flex-col w-full sm:w-[32%]">
              <label className="text-xs text-gray-600 mb-1">Bill Type</label>
              <select
                value={billType}
                onChange={(e) => setBillType(e.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent"
              >
                {billTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Pay Mode */}
            <div className="flex flex-col w-full sm:w-[32%]">
              <label className="text-xs text-gray-600 mb-1">Pay Mode</label>
              <select
                value={payMode}
                onChange={(e) => setPayMode(e.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent"
              >
                {payModes.map((mode) => (
                  <option key={mode.id} value={mode.id}>
                    {mode.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div className="flex flex-col w-full sm:w-[32%]">
              <label className="text-xs text-gray-600 mb-1">Date</label>
              <input
                type="date"
                value={posDate}
                onChange={(e) => setPosDate(e.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-[#7A0000] focus:border-transparent"
              />
            </div>
          </div>

          {/* Info Text */}
          <div className="mt-3">
            <p className="text-xs text-yellow-600">
              this option provides facility to access provincial server and extract information about payments
            </p>
          </div>

          {/* Button */}
          <div className="w-full mt-6 flex justify-end">
            <button
              onClick={handlePOSInquiry}
              disabled={posLoading}
              className={`px-6 py-2 rounded-md font-medium transition-opacity duration-300 shadow
            ${maroonGrad} text-white ${
                posLoading ? "opacity-70 cursor-not-allowed" : "hover:opacity-90"
              }`}
            >
              {posLoading ? (
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
        </div>
      </div>

      {/* Results Section - POS Collection */}
      {activeTab === "pos" && posResult && (
        <div ref={posPrintRef} className="mt-4 p-4 rounded-lg shadow-sm border border-gray-100 w-full bg-white">
          {(() => {
            const pageSize = 30;
            const totalRecords = posResult.collectionRecords.length;
            const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
            const currentPage = Math.min(posPage, totalPages);
            const startIndex = (currentPage - 1) * pageSize;
            const endIndex = Math.min(startIndex + pageSize, totalRecords);
            const pageRecords = posResult.collectionRecords.slice(startIndex, endIndex);

            const handlePrev = () => {
              setPosPage((prev) => (prev > 1 ? prev - 1 : prev));
            };
            const handleNext = () => {
              setPosPage((prev) => (prev < totalPages ? prev + 1 : prev));
            };

            return (
              <>
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className={`text-base font-bold ${maroon}`}>
                Payment Collection on {formatDateDMY(posResult.date)}
              </h2>
              <p className="text-xs font-semibold text-gray-700 mt-1 whitespace-pre">
                {`Area : ${getAreaLabel()}       Counter : ${getCounterLabel()}`}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Showing rows {totalRecords === 0 ? 0 : startIndex + 1}-{endIndex} of {totalRecords}
              </p>
            </div>

            <div className="flex gap-2 print:hidden">
              <button
                onClick={downloadPosCSV}
                className="flex items-center gap-1 px-3 py-1.5 border border-blue-400 text-blue-700 bg-white rounded-md text-xs font-medium shadow-sm hover:bg-blue-50 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-200 transition"
              >
                <FaFileDownload className="w-3 h-3" /> CSV
              </button>
              <button
                onClick={handlePosPrint}
                className="flex items-center gap-1 px-3 py-1.5 border border-green-400 text-green-700 bg-white rounded-md text-xs font-medium shadow-sm hover:bg-green-50 hover:text-green-800 focus:outline-none focus:ring-2 focus:ring-green-200 transition"
              >
                <FaPrint className="w-3 h-3" /> PDF
              </button>
              <button
                onClick={() => setActiveTab(null)}
                className="px-4 py-1.5 bg-[#7A0000] hover:bg-[#A52A2A] text-xs rounded-md text-white flex items-center"
              >
                Back to Form
              </button>
            </div>
          </div>

          {/* Collection Records Table */}
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-[#7A0000]">
                <tr className={`${maroonBg} text-white`}>
                  <th className="p-2 text-left font-semibold">Account No/PIV No</th>
                  <th className="p-2 text-left font-semibold">Counter</th>
                  <th className="p-2 text-left font-semibold">Stub No.</th>
                  <th className="p-2 text-right font-semibold">Cash</th>
                  <th className="p-2 text-right font-semibold">Cheque</th>
                  <th className="p-2 text-right font-semibold">Bank Draft</th>
                  <th className="p-2 text-right font-semibold">Credit Card</th>
                </tr>
              </thead>
              <tbody>
                {pageRecords.map((record, idx) => (
                  <tr key={record.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="p-2 border-b border-gray-100">{(record.accountNo || "") + (record.pivNo ? ` / ${record.pivNo}` : "")}</td>
                    <td className="p-2 border-b border-gray-100">{record.counterNo || record.counter || record.counterName}</td>
                    <td className="p-2 border-b border-gray-100">{record.stubNo || ""}</td>
                    <td className="p-2 text-right font-semibold border-b border-gray-100">{(record.cash || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="p-2 text-right font-semibold border-b border-gray-100">{(record.cheque || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="p-2 text-right font-semibold border-b border-gray-100">{(record.bankDraft || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="p-2 text-right font-semibold border-b border-gray-100">{(record.creditCard || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
              {currentPage === totalPages && (
                <tfoot>
                  <tr className="bg-gray-100 font-bold border-t border-gray-300">
                    <td className="p-2 text-left" colSpan={3}>Total</td>
                    <td className="p-2 text-right text-gray-900">
                      {posResult.collectionRecords.reduce((sum, r) => sum + (r.cash || 0), 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-2 text-right text-gray-900">
                      {posResult.collectionRecords.reduce((sum, r) => sum + (r.cheque || 0), 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-2 text-right text-gray-900">
                      {posResult.collectionRecords.reduce((sum, r) => sum + (r.bankDraft || 0), 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="p-2 text-right text-gray-900">
                      {posResult.collectionRecords.reduce((sum, r) => sum + (r.creditCard || 0), 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between text-xs text-gray-700">
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handlePrev}
                  disabled={currentPage === 1}
                  className={`px-3 py-1 rounded border text-xs ${
                    currentPage === 1
                      ? "border-gray-200 text-gray-300 cursor-not-allowed bg-gray-50"
                      : "border-gray-300 text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={currentPage === totalPages}
                  className={`px-3 py-1 rounded border text-xs ${
                    currentPage === totalPages
                      ? "border-gray-200 text-gray-300 cursor-not-allowed bg-gray-50"
                      : "border-gray-300 text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  Next
                </button>
              </div>
            </div>
          )}
          </>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default PaymentInquiry;
