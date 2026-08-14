// AreaWiseCashBookReport.tsx
import React, {useState, useCallback} from "react";
import {Download, Printer, X} from "lucide-react";
import {useUser} from "../../contexts/UserContext";
import {toast} from "react-toastify";
import ReusableCompanyList from "../../components/utils/ReusableCompanyList";

type Company = {
	compId: string;
	CompName: string;
};

interface CashBookItem {
	DocNo: string | null;
	DocDt: string | null;
	ExpCd: string | null;
	SubAc: string | null;
	DrAmt: number | null;
	CrAmt: number | null;
	NonTaxabl: number | null;
	TranStatus: string | null;
	Payee: string | null;
	Remarks: string | null;
	CctName: string | null;
}

/* ────── Constants ────── */
const MAX_RECORDS = 5000;

/* ────── Formatting helpers ────── */
const formatNumber = (num: number | string | null | undefined): string => {
	const n = num === null || num === undefined ? NaN : Number(num);
	if (isNaN(n)) return "0.00";
	const abs = Math.abs(n);
	const formatted = abs.toLocaleString("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});
	return n < 0 ? `(${formatted})` : formatted;
};

const formatDate = (dateStr: string | null): string => {
	if (!dateStr) return "";
	const d = new Date(dateStr);
	if (isNaN(d.getTime())) return "";
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
};

const csvEscape = (val: string | number | null | undefined): string => {
	if (val == null) return "";
	const str = String(val);
	if (/[,\n"]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
	return str;
};

const today = new Date();
const currentYear = today.getFullYear();
const currentMonth = String(today.getMonth() + 1).padStart(2, "0");
const currentDay = String(today.getDate()).padStart(2, "0");
const maxDate = `${currentYear}-${currentMonth}-${currentDay}`;

const minYear = currentYear - 20;
const minDate = `${minYear}-${currentMonth}-${currentDay}`;

const AreaWiseCashBookInquiryReport: React.FC = () => {
	const {user} = useUser();
	const epfNo = user?.Userno || "";

	const maroon = "text-[#7A0000]";
	const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";

	/* ── Date range state ── */
	const [fromDate, setFromDate] = useState("");
	const [toDate, setToDate] = useState("");

	/* ── Report state ── */
	const [selectedCompany, setSelectedCompany] = useState<{id: string; name: string} | null>(null);
	const [showReport, setShowReport] = useState(false);
	const [reportLoading, setReportLoading] = useState(false);
	const [reportData, setReportData] = useState<CashBookItem[]>([]);

	/* ────── Fetch report data ────── */
	const handleViewReport = async (company: Company) => {
		if (!fromDate || !toDate) {
			toast.error("Please select both From Date and To Date first.");
			return;
		}
		if (new Date(toDate) < new Date(fromDate)) {
			toast.error("'To Date' cannot be earlier than 'From Date'");
			return;
		}

		setSelectedCompany({id: company.compId, name: company.CompName});
		setReportLoading(true);
		setReportData([]);
		setShowReport(true);

		try {
			const url = `/misapi/api/areawisecashbookinquiry/report/${fromDate}/${toDate}/${encodeURIComponent(
				company.compId
			)}`;

			const res = await fetch(url, {method: "GET", credentials: "include"});

			if (!res.ok) {
				const errorText = await res.text();
				throw new Error(`HTTP ${res.status}: ${errorText}`);
			}

			const json = await res.json();
			if (!json.success) throw new Error(json.message || "Failed to load data");

			const items: CashBookItem[] = Array.isArray(json) ? json : json.data || [];

			if (items.length > MAX_RECORDS)
				throw new Error(`Too many records (${items.length}). Please refine your search.`);

			if (items.length === 0) {
				toast.warn("No records found for the selected criteria.");
				setShowReport(false);
				setSelectedCompany(null);
				return;
			}

			setReportData(items);
			toast.success("Report loaded successfully");
		} catch (err: any) {
			const msg = err.message?.includes("Failed to fetch")
				? "Server unreachable. Please check your connection."
				: err.message || "Unknown error";
			toast.error("Failed to load report: " + msg);
			setShowReport(false);
			setSelectedCompany(null);
		} finally {
			setReportLoading(false);
		}
	};

	const closeReport = () => {
		setShowReport(false);
		setReportData([]);
		setSelectedCompany(null);
	};

	/* ────── Sorted per SQL: ORDER BY doc_dt, doc_no ────── */
	const sortedData = [...reportData].sort(
		(a, b) => (a.DocDt || "").localeCompare(b.DocDt || "") || (a.DocNo || "").localeCompare(b.DocNo || "")
	);

	const areaName =
		reportData.find((r) => r.CctName)?.CctName || selectedCompany?.name || "";
	const areaIdDisplay = selectedCompany?.id || "";

	/* ────── CSV download ────── */
	const downloadCSV = () => {
		if (reportData.length === 0 || !selectedCompany) return;

		const titleRows = [
			`Area wise Cash Book Inquiry Report From ${fromDate} To ${toDate}`,
			`Area: ${areaIdDisplay}/${areaName}`,
			"",
		];

		const headers = [
			"Payslips No.",
			"Transaction Date",
			"Expenditure Code",
			"Sub Account",
			"Dr Amount",
			"Cr Amount",
			"Total",
			"Payee",
			"Remarks",
			"Status",
		];
		const rows: string[] = [headers.join(",")];

		sortedData.forEach((it) => {
			rows.push(
				[
					csvEscape(it.DocNo),
					csvEscape(formatDate(it.DocDt)),
					csvEscape(it.ExpCd),
					csvEscape(it.SubAc),
					csvEscape(formatNumber(it.DrAmt)),
					csvEscape(formatNumber(it.CrAmt)),
					csvEscape(formatNumber(it.NonTaxabl)),
					csvEscape(it.Payee),
					csvEscape(it.Remarks),
					csvEscape(it.TranStatus),
				].join(",")
			);
		});

		const csv = [...titleRows, ...rows].join("\n");
		const blob = new Blob([csv], {type: "text/csv;charset=utf-8;"});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `AreaWiseCashBook_${areaIdDisplay}_${fromDate}_${toDate}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	};

	/* ────── PDF print ────── */
	const printPDF = () => {
		if (reportData.length === 0 || !selectedCompany) return;

		let rows = "";
		sortedData.forEach((it, i) => {
			rows += `
          <tr class="${i % 2 ? "bg-white" : "bg-gray-50"}">
            <td class="px-2 py-2 border-l border-r border-gray-300 text-left text-xs font-mono">${
					it.DocNo || ""
				}</td>
            <td class="px-2 py-2 border-r border-gray-300 text-center text-xs">${formatDate(it.DocDt)}</td>
            <td class="px-2 py-2 border-r border-gray-300 text-left text-xs">${it.ExpCd || ""}</td>
            <td class="px-2 py-2 border-r border-gray-300 text-left text-xs">${it.SubAc || ""}</td>
            <td class="px-2 py-2 border-r border-gray-300 text-right text-xs font-mono">${formatNumber(
					it.DrAmt
				)}</td>
            <td class="px-2 py-2 border-r border-gray-300 text-right text-xs font-mono">${formatNumber(
					it.CrAmt
				)}</td>
            <td class="px-2 py-2 border-r border-gray-300 text-right text-xs font-mono">${formatNumber(
					it.NonTaxabl
				)}</td>
            <td class="px-2 py-2 border-r border-gray-300 text-left text-xs">${it.Payee || ""}</td>
            <td class="px-2 py-2 border-r border-gray-300 text-left text-xs">${it.Remarks || ""}</td>
            <td class="px-2 py-2 border-r border-gray-300 text-left text-xs">${it.TranStatus || ""}</td>
          </tr>`;
		});

		const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    @media print {
      @page { margin: 8mm 5mm 10mm 5mm; }
      body { margin:0; font-family:Arial,Helvetica,sans-serif; }
      .title { margin: 10px 8px 6px; text-align:center; font-weight:bold; color:#7A0000; font-size:13px; }
      .info { margin:4px 8px; font-size:9.5px; }
      .info div { margin-bottom:3px; }
      table { border-collapse:collapse; width:100%; font-size:8px; margin-top:10px; }
      th, td { border:1px solid #d1d5db; padding:5px 6px; word-wrap:break-word; }
      th { background:linear-gradient(to right,#7A0000,#A52A2A); color:white; text-align:center; font-weight:bold; }
      .font-mono { font-family:monospace; }
      @page {
        @bottom-left  { content:"Printed on: ${new Date().toLocaleString(
				"en-US",
				{timeZone: "Asia/Colombo"}
			)}"; font-size:7px; color:gray; }
        @bottom-right { content:"Page " counter(page) " of " counter(pages); font-size:7px; color:gray; }
      }
    }
  </style>
</head>
<body>
  <div class="title">Area wise Cash Book Inquiry Report From ${fromDate} To ${toDate}</div>
  <div class="info">
    <div><strong>Area:</strong> ${areaIdDisplay}/${areaName}</div>
  </div>
  <table style="width:100%; border-collapse:collapse; font-size:8px; border:1px solid #d1d5db;">
    <thead>
      <tr style="background:linear-gradient(to right,#7A0000,#A52A2A); color:white;">
        <th style="padding:5px 6px; width:9%;">Payslips No.</th>
        <th style="padding:5px 6px; width:10%;">Transaction Date</th>
        <th style="padding:5px 6px; width:10%;">Expenditure Code</th>
        <th style="padding:5px 6px; width:9%;">Sub Account</th>
        <th style="padding:5px 6px; width:10%; text-align:right;">Dr Amount</th>
        <th style="padding:5px 6px; width:10%; text-align:right;">Cr Amount</th>
        <th style="padding:5px 6px; width:9%; text-align:right;">Total</th>
        <th style="padding:5px 6px; width:12%;">Payee</th>
        <th style="padding:5px 6px; width:12%;">Remarks</th>
        <th style="padding:5px 6px; width:9%;">Status</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;

		const win = window.open("", "_blank");
		if (!win) {
			toast.error("Popup blocked. Please allow popups.");
			return;
		}
		win.document.write(html);
		win.document.close();
		win.onload = () => win.print();
		win.onafterprint = () => win.close();
	};

	return (
		<div className="max-w-[95%] mx-auto p-4 bg-white rounded-xl shadow border border-gray-200 font-sans">
			<h2 className={`text-lg md:text-xl font-bold mb-6 ${maroon}`}>Area Wise Cash Book Inquiry</h2>

			{/* Parameter Selection Controls */}
			<div className="flex flex-col md:flex-row gap-6 items-end mb-6">
				<div className="flex items-center gap-2">
					<label className={`text-xs font-bold ${maroon} whitespace-nowrap`}>From Date:</label>
					<input
						type="date"
						value={fromDate}
						onChange={(e) => setFromDate(e.target.value)}
						min={minDate}
						max={maxDate}
						className="pl-3 pr-3 py-1.5 rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#7A0000] transition text-sm"
					/>
				</div>
				<div className="flex items-center gap-2">
					<label className={`text-xs font-bold ${maroon} whitespace-nowrap`}>To Date:</label>
					<input
						type="date"
						value={toDate}
						onChange={(e) => setToDate(e.target.value)}
						min={minDate}
						max={maxDate}
						className="pl-3 pr-3 py-1.5 rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#7A0000] transition text-sm"
					/>
				</div>
			</div>

			{/* ── Area (Company) List ── */}
			<div className="mt-6">
				<ReusableCompanyList
					fetchItems={useCallback(async () => {
						if (!epfNo) {
							toast.error("No EPF number available.");
							return [];
						}
						try {
							const res = await fetch(`/misapi/api/incomeexpenditure/Usercompanies/${epfNo}/50`);
							if (!res.ok) throw new Error(`HTTP ${res.status}`);
							const txt = await res.text();
							const parsed = JSON.parse(txt);
							const raw = Array.isArray(parsed) ? parsed : parsed.data || [];
							return raw.map((c: any) => ({
								id: c.CompId,
								name: c.CompName,
							}));
						} catch (e: any) {
							toast.error(e.message || "Failed to load companies");
							return [];
						}
					}, [epfNo])}
					onViewItem={(company: {id: string; name: string}) => {
						handleViewReport({
							compId: company.id,
							CompName: company.name,
						});
					}}
					idColumnTitle="Area Code"
					nameColumnTitle="Area Name"
					loadingMessage="Loading areas..."
					emptyMessage="No areas available for selection."
				/>
			</div>

			{/* ────── REPORT MODAL ────── */}
			{showReport && selectedCompany && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/90 print:static print:inset-auto print:p-0 print:bg-white">
					<div className="relative bg-white w-[95vw] sm:w-[90vw] md:w-[85vw] lg:w-[80vw] xl:w-[75vw] max-w-7xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden mt-20 md:mt-32 lg:mt-40 lg:ml-64 mx-auto print:relative print:w-full print:max-w-none print:rounded-none print:shadow-none print:border-none print:overflow-visible">
						{reportLoading && (
							<div className="absolute inset-0 bg-white/95 z-50 flex flex-col items-center justify-center gap-4">
								<div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#7A0000]"></div>
								<p className="text-xl font-bold text-[#7A0000]">Loading Report...</p>
								<p className="text-sm text-gray-600">Fetching cash book data from server</p>
							</div>
						)}
						{!reportLoading && reportData.length > 0 && (
							<div className="p-2 md:p-2 max-h-[80vh] overflow-y-auto print:p-0 print:max-h-none print:overflow-visible print:mt-10 print:ml-12">
								<div className="flex justify-end gap-3 mb-6 md:mb-8 print:hidden">
									<button
										onClick={downloadCSV}
										className="flex items-center gap-1 px-3 py-1.5 border border-blue-400 text-blue-700 bg-white rounded-md text-xs font-medium shadow-sm hover:bg-blue-50"
									>
										<Download className="w-4 h-4" /> CSV
									</button>
									<button
										onClick={printPDF}
										className="flex items-center gap-1 px-3 py-1.5 border border-green-400 text-green-700 bg-white rounded-md text-xs font-medium shadow-sm hover:bg-green-50"
									>
										<Printer className="w-4 h-4" /> PDF
									</button>
									<button
										onClick={closeReport}
										className="flex items-center gap-1 px-3 py-1.5 border border-red-400 text-red-700 bg-white rounded-md text-xs font-medium shadow-sm hover:bg-red-50"
									>
										<X className="w-4 h-4" /> Close
									</button>
								</div>

								<h2 className={`text-lg md:text-xl font-bold text-center md:mb-2 ${maroon}`}>
									Area wise pay Slip Inquiry Report From {fromDate} To {toDate}
								</h2>
								<div className="text-sm mb-3 ml-5 mr-12">
									<span className="font-bold">Area:</span> {areaIdDisplay}/{areaName}
								</div>

								<div className="ml-5 mt-1 mb-5 border border-gray-200 rounded-lg overflow-x-auto print:ml-12 print:mt-12 print:overflow-visible">
									<div className="min-w-[1200px]">
										<table className="w-full text-xs border-collapse">
											<thead className={`${maroonGrad} text-white`}>
												<tr>
													<th className="px-2 py-2 border border-gray-300" style={{width: "9%"}}>
														Payslips No.
													</th>
													<th className="px-2 py-2 border border-gray-300" style={{width: "10%"}}>
														Transaction Date
													</th>
													<th className="px-2 py-2 border border-gray-300" style={{width: "10%"}}>
														Expenditure Code
													</th>
													<th className="px-2 py-2 border border-gray-300" style={{width: "9%"}}>
														Sub Account
													</th>
													<th className="px-2 py-2 border border-gray-300 text-right" style={{width: "10%"}}>
														Dr Amount
													</th>
													<th className="px-2 py-2 border border-gray-300 text-right" style={{width: "10%"}}>
														Cr Amount
													</th>
													<th className="px-2 py-2 border border-gray-300 text-right" style={{width: "9%"}}>
														Total
													</th>
													<th className="px-2 py-2 border border-gray-300" style={{width: "12%"}}>
														Payee
													</th>
													<th className="px-2 py-2 border border-gray-300" style={{width: "12%"}}>
														Remarks
													</th>
													<th className="px-2 py-2 border border-gray-300" style={{width: "9%"}}>
														Status
													</th>
												</tr>
											</thead>
											<tbody>
												{sortedData.map((it, i) => (
													<tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
														<td className="px-2 py-2 font-mono border-l border-r border-gray-300">
															{it.DocNo || ""}
														</td>
														<td className="px-2 py-2 text-center border-r border-gray-300">
															{formatDate(it.DocDt)}
														</td>
														<td className="px-2 py-2 border-r border-gray-300">{it.ExpCd || ""}</td>
														<td className="px-2 py-2 border-r border-gray-300">{it.SubAc || ""}</td>
														<td className="px-2 py-2 text-right font-mono border-r border-gray-300">
															{formatNumber(it.DrAmt)}
														</td>
														<td className="px-2 py-2 text-right font-mono border-r border-gray-300">
															{formatNumber(it.CrAmt)}
														</td>
														<td className="px-2 py-2 text-right font-mono border-r border-gray-300">
															{formatNumber(it.NonTaxabl)}
														</td>
														<td className="px-2 py-2 border-r border-gray-300">{it.Payee || ""}</td>
														<td className="px-2 py-2 border-r border-gray-300">{it.Remarks || ""}</td>
														<td className="px-2 py-2 border-r border-gray-300">{it.TranStatus || ""}</td>
													</tr>
												))}
											</tbody>
										</table>
										<p className="text-xs text-gray-500 mt-2 text-right px-2">
											Total records: {reportData.length.toLocaleString()}
										</p>
									</div>
								</div>
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
};

export default AreaWiseCashBookInquiryReport;