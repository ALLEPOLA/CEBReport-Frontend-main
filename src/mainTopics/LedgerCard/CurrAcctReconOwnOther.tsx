import React, { useEffect, useState, useRef } from "react";
import {
	Eye,
	X,
	Download,
	Printer,
	RotateCcw,
	ChevronDown,
	Search,
} from "lucide-react";
import { toast } from "react-toastify";
import { useUser } from "../../contexts/UserContext";

interface Company {
	compId: string;
	CompName: string;
}

interface ReportItem {
	CatCode: string;
	SubAc: string;
	ClBal: number | null;
	AcName: string;
	CctName: string;
}

/* ────── Number formatting – negative → (123,456.78) ────── */
const formatNumber = (num: number | string | null | undefined): string => {
	const n = num === null || num === undefined ? NaN : Number(num);
	if (isNaN(n) || n === 0) return "0.00";

	const abs = Math.abs(n);
	const formatted = abs.toLocaleString("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});
	return n < 0 ? `(${formatted})` : formatted;
};

/* ────── CSV safe escape ────── */
const csvEscape = (val: string | null | undefined): string => {
	if (val == null) return "";
	const str = String(val);
	if (/[,\n"]/.test(str)) {
		return `"${str.replace(/"/g, '""')}"`;
	}
	return str;
};

/* ────── MAIN COMPONENT ────── */
const CurrAcctReconOwnOther: React.FC = () => {
	const { user } = useUser();
	const epfNo = user?.Userno || "";

	// Company list state
	const [data, setData] = useState<Company[]>([]);
	const [searchId, setSearchId] = useState("");
	const [searchName, setSearchName] = useState("");
	const [filtered, setFiltered] = useState<Company[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [page, setPage] = useState(1);
	const pageSize = 50;

	// Selection state
	const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
	const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined);
	const [selectedMonth, setSelectedMonth] = useState<number | undefined>(undefined);
	const [subac, setSubac] = useState("");

	// Report data state
	const [reportData, setReportData] = useState<ReportItem[]>([]);
	const [reportLoading, setReportLoading] = useState(false);
	const [, setReportError] = useState<string | null>(null);
	const [showReport, setShowReport] = useState(false);
	const iframeRef = useRef<HTMLIFrameElement>(null);

	// Dropdown state
	const [yearDropdownOpen, setYearDropdownOpen] = useState(false);
	const [monthDropdownOpen, setMonthDropdownOpen] = useState(false);

	const maroon = "text-[#7A0000]";
	const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";

	// Years: Current year and past 20 years
	const currentYear = new Date().getFullYear();
	const years = Array.from({ length: 21 }, (_, i) => currentYear - i);

	// Months: 1 to 12
	const months = Array.from({ length: 12 }, (_, i) => i + 1);

	// Close dropdowns on outside click
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			if (
				!target.closest(".year-dropdown") &&
				!target.closest(".month-dropdown")
			) {
				setYearDropdownOpen(false);
				setMonthDropdownOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () =>
			document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	// Fetch companies on mount
	useEffect(() => {
		const fetchData = async () => {
			if (!epfNo) {
				setError("No EPF number available. Please login again.");
				setLoading(false);
				return;
			}

			setLoading(true);
			try {
				const res = await fetch(
					`/misapi/api/incomeexpenditure/Usercompanies/${epfNo}/70`
				);
				if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

				const txt = await res.text();
				const parsed = JSON.parse(txt);
				const rawData = Array.isArray(parsed) ? parsed : parsed.data || [];
				const final: Company[] = rawData.map((item: any) => ({
					compId: item.CompId,
					CompName: item.CompName,
				}));
				setData(final);
				setFiltered(final);
			} catch (e: any) {
				setError(e.message);
				toast.error("Failed to load companies");
			} finally {
				setLoading(false);
			}
		};
		fetchData();
	}, [epfNo]);

	// Filter companies
	useEffect(() => {
		const f = data.filter(
			(c) =>
				(!searchId ||
					c.compId.toLowerCase().includes(searchId.toLowerCase())) &&
				(!searchName ||
					c.CompName.toLowerCase().includes(searchName.toLowerCase()))
		);
		setFiltered(f);
		setPage(1);
	}, [searchId, searchName, data]);

	const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

	// Helper for month names
	const getMonthName = (monthNum: number | undefined): string => {
		if (!monthNum) return "Select Month";
		const monthNames = [
			"1-January",
			"2-February",
			"3-March",
			"4-April",
			"5-May",
			"6-June",
			"7-July",
			"8-August",
			"9-September",
			"10-October",
			"11-November",
			"12-December",
		];
		return monthNames[monthNum - 1] || "Select Month";
	};

	const getSimpleMonthName = (monthNum: number | undefined): string => {
		if (!monthNum) return "";
		const monthNames = [
			"January",
			"February",
			"March",
			"April",
			"May",
			"June",
			"July",
			"August",
			"September",
			"October",
			"November",
			"December",
		];
		return monthNames[monthNum - 1] || "";
	};

	/* ────── HANDLE VIEW CLICK ────── */
	const handleCompanySelect = async (company: Company) => {
		setSelectedCompany(company);

		if (selectedYear && selectedMonth && subac.trim()) {
			await fetchLedgerData(company);
		}
	};

	const fetchLedgerData = async (company?: Company) => {
		const targetCompany = company || selectedCompany;
		if (!targetCompany || !selectedYear || !selectedMonth || !subac.trim()) {
			toast.error(
				"Please select Year, Month, enter Sub Account / To dept and select a Company"
			);
			return;
		}

		setReportLoading(true);
		setReportError(null);
		setReportData([]);
		setShowReport(false);

		try {
			const resp = await fetch(
				`/misapi/api/ledgercard/current-account-reconciliation-own-other?REGION=${encodeURIComponent(
					targetCompany.compId
				)}&YEAR=${selectedYear}&MONTH=${selectedMonth}&SUBAC=${encodeURIComponent(
					subac.trim()
				)}`,
				{
					method: "GET",
					headers: {
						"Content-Type": "application/json",
						Accept: "application/json",
					},
					credentials: "include",
				}
			);

			if (!resp.ok) {
				const txt = await resp.text();
				throw new Error(`HTTP ${resp.status}: ${txt || "Unknown error"}`);
			}

			const items: ReportItem[] = await resp.json();

			if (items.length === 0) {
				toast.warn("No records found.");
				setSelectedCompany(null);
				return;
			}

			setReportData(items);
			setShowReport(true);
			toast.success("Report loaded successfully.");
		} catch (e: any) {
			const msg = e.message.includes("Failed to fetch")
				? "Cannot connect to server."
				: e.message;
			setReportError(msg);
			toast.error(msg);
			setSelectedCompany(null);
		} finally {
			setReportLoading(false);
		}
	};

	const clearFilters = () => {
		setSearchId("");
		setSearchName("");
	};

	const clearAll = () => {
		setSelectedYear(undefined);
		setSelectedMonth(undefined);
		setSubac("");
		setSelectedCompany(null);
		setSearchId("");
		setSearchName("");
		setPage(1);
	};

	/* ────── CLOSE REPORT ────── */
	const closeReport = () => {
		setShowReport(false);
		setReportData([]);
		setSelectedCompany(null);
	};

	// Group data by CatCode
	const ownDivisionItems = reportData.filter(
		(x) => x.CatCode?.toLowerCase() === "own division"
	);
	const otherDivisionItems = reportData.filter(
		(x) => x.CatCode?.toLowerCase() !== "own division"
	);

	/* ────── PRINT (PDF) ────── */
	const printPDF = () => {
		if (reportData.length === 0 || !iframeRef.current || !selectedCompany)
			return;

		const monthName = getSimpleMonthName(selectedMonth);
		const acName = reportData[0]?.AcName ? `L9200 - ${reportData[0].AcName}` : "L9200 - A/C UNIT - A/C UNIT";
		const cctName = reportData[0]?.CctName || selectedCompany.CompName;

		let ownRows = "";
		ownDivisionItems.forEach((it, idx) => {
			ownRows += `
				<tr class="${idx % 2 ? "bg-white" : "bg-gray-50"}">
					${
						idx === 0
							? `<td rowspan="${ownDivisionItems.length}" style="border:1px solid #D1D5DB; padding:6px; font-weight:bold; vertical-align:top; background-color:#fff;">
									<div style="border:1px solid #000; padding:2px 6px; display:inline-block; font-size:9px;">Own Division</div>
							   </td>`
							: ""
					}
					<td style="border:1px solid #D1D5DB; padding:6px; text-align:left; font-family:Arial,sans-serif; font-size:9px;">${it.SubAc}</td>
					<td style="border:1px solid #D1D5DB; padding:6px; text-align:right; font-family:monospace; font-size:9px;">${formatNumber(it.ClBal)}</td>
				</tr>
			`;
		});

		let otherRows = "";
		otherDivisionItems.forEach((it, idx) => {
			otherRows += `
				<tr class="${idx % 2 ? "bg-white" : "bg-gray-50"}">
					${
						idx === 0
							? `<td rowspan="${otherDivisionItems.length}" style="border:1px solid #D1D5DB; padding:6px; font-weight:bold; vertical-align:top; background-color:#fff;">
									<div style="border:1px solid #000; padding:2px 6px; display:inline-block; font-size:9px;">Other Division</div>
							   </td>`
							: ""
					}
					<td style="border:1px solid #D1D5DB; padding:6px; text-align:left; font-family:Arial,sans-serif; font-size:9px;">${it.SubAc}</td>
					<td style="border:1px solid #D1D5DB; padding:6px; text-align:right; font-family:monospace; font-size:9px;">${formatNumber(it.ClBal)}</td>
				</tr>
			`;
		});

		const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    @media print {
      @page { size: A4 portrait; margin: 10mm 8mm 12mm 8mm; }
      body { margin:0; font-family:Arial,Helvetica,sans-serif; font-size:9px; color:#111827; }
      .header-container { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; }
      .header-left { flex:1; }
      .header-right { text-align:right; font-size:9px; }
      .title { font-size:13px; font-weight:bold; color:#7A0000; margin-bottom:3px; }
      .info-p { font-size:9px; margin:2px 0; }
      .cur { font-weight:600; color:#4B5563; margin-top:4px; font-size:9px; }
      table { border-collapse:collapse; width:100%; margin-top:8px; font-size:9px; }
      th, td { border:1px solid #D1D5DB; padding:5px 8px; }
      th { background:linear-gradient(to right,#7A0000,#A52A2A); color:white; font-weight:bold; }
      .font-mono { font-family:monospace; }
      .text-right { text-align:right; }
      .text-left { text-align:left; }
      .text-center { text-align:center; }
      @page {
        @bottom-left  { content:"Printed on: ${new Date().toLocaleString("en-US", { timeZone: "Asia/Colombo" })}"; font-size:7px; color:gray; }
        @bottom-right { content:"Page " counter(page) " of " counter(pages); font-size:7px; color:gray; }
      }
    }
  </style>
</head>
<body>
  <div class="header-container">
    <div class="header-left">
      <div class="title">Current Account Balances Both INTERNAL & EXTERNAL ${monthName} / ${selectedYear}</div>
      <div class="info-p"><span style="font-weight:bold;">DIVISION :</span> ${selectedCompany.compId} / ${cctName}</div>
      <div class="info-p"><span style="font-weight:bold;">Account Code Code :</span> ${acName}</div>
    </div>
    <div class="header-right">
      <div style="font-weight:bold; color:#374151;">Report Id :GL/005</div>
      <div class="cur">Currency : LKR</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:25%; text-align:left;">Sub Account</th>
        <th style="width:25%; text-align:left;">Sub Account</th>
        <th style="width:50%; text-align:right;">Closing Balance</th>
      </tr>
    </thead>
    <tbody>
      ${ownRows}
      ${otherRows}
    </tbody>
  </table>

  <div style="margin-top:35px; display:flex; justify-content:space-between; padding:0 15px; font-size:9px;">
    <div>Prepared By: ____________________</div>
    <div>Checked By: ____________________</div>
  </div>
</body>
</html>`;

		const doc = iframeRef.current?.contentDocument;
		if (doc) {
			doc.open();
			doc.write(html);
			doc.close();
			setTimeout(() => iframeRef.current?.contentWindow?.print(), 600);
		}
	};

	/* ────── CSV DOWNLOAD ────── */
	const handleDownloadCSV = () => {
		if (reportData.length === 0 || !selectedCompany) return;

		const monthName = getSimpleMonthName(selectedMonth);
		const acName = reportData[0]?.AcName ? `L9200 - ${reportData[0].AcName}` : "L9200 - A/C UNIT - A/C UNIT";
		const cctName = reportData[0]?.CctName || selectedCompany.CompName;

		const titleRows = [
			`Report Id: GL/005`,
			`Current Account Balances Both INTERNAL & EXTERNAL ${monthName} / ${selectedYear}`,
			`DIVISION: ${selectedCompany.compId} / ${cctName}`,
			`Account Code Code: ${acName}`,
			`Currency: LKR`,
			"",
		];

		const headers = ["Sub Account (Category)", "Sub Account", "Closing Balance"];

		const rows = reportData.map((it) => [
			csvEscape(it.CatCode),
			csvEscape(it.SubAc),
			csvEscape(formatNumber(it.ClBal)),
		]);

		const csvContent = [
			...titleRows,
			headers.join(","),
			...rows.map((r) => r.join(",")),
		].join("\n");

		const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `current_account_balances_both_internal_external_${selectedCompany.compId}_${selectedYear}_${String(
			selectedMonth
		).padStart(2, "0")}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	};

	const handleDownloadPDF = () => {
		printPDF();
	};

	// Year Dropdown Component
	const YearDropdown = () => (
		<div className="year-dropdown relative">
			<label className="block text-xs font-medium text-gray-700 mb-1">
				Year
			</label>
			<button
				type="button"
				onClick={() => {
					setYearDropdownOpen(!yearDropdownOpen);
					setMonthDropdownOpen(false);
				}}
				className="w-full flex justify-between items-center px-3 py-1.5 border border-gray-300 rounded bg-white text-gray-700 text-sm focus:outline-none focus:ring-1 focus:ring-[#7A0000]"
			>
				<span>{selectedYear || "Select Year"}</span>
				<ChevronDown
					className={`w-3 h-3 text-gray-400 transition-transform ${
						yearDropdownOpen ? "rotate-180" : ""
					}`}
				/>
			</button>

			{yearDropdownOpen && (
				<div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
					{years.map((year) => (
						<button
							key={year}
							type="button"
							onClick={() => {
								setSelectedYear(year);
								setYearDropdownOpen(false);
								if (selectedMonth && subac.trim() && selectedCompany) {
									fetchLedgerData();
								}
							}}
							className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${
								selectedYear === year
									? "bg-[#7A0000] text-white"
									: "text-gray-700"
							}`}
						>
							{year}
						</button>
					))}
				</div>
			)}
		</div>
	);

	// Month Dropdown Component
	const MonthDropdown = () => (
		<div className="month-dropdown relative">
			<label className="block text-xs font-medium text-gray-700 mb-1">
				Month
			</label>
			<button
				type="button"
				onClick={() => {
					setMonthDropdownOpen(!monthDropdownOpen);
					setYearDropdownOpen(false);
				}}
				className="w-full flex justify-between items-center px-3 py-1.5 border border-gray-300 rounded bg-white text-gray-700 text-sm focus:outline-none focus:ring-1 focus:ring-[#7A0000]"
			>
				<span>{getMonthName(selectedMonth)}</span>
				<ChevronDown
					className={`w-3 h-3 text-gray-400 transition-transform ${
						monthDropdownOpen ? "rotate-180" : ""
					}`}
				/>
			</button>

			{monthDropdownOpen && (
				<div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
					{months.map((month) => (
						<button
							key={month}
							type="button"
							onClick={() => {
								setSelectedMonth(month);
								setMonthDropdownOpen(false);
								if (selectedYear && subac.trim() && selectedCompany) {
									fetchLedgerData();
								}
							}}
							className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${
								selectedMonth === month
									? "bg-[#7A0000] text-white"
									: "text-gray-700"
							}`}
						>
							{getMonthName(month)}
						</button>
					))}
				</div>
			)}
		</div>
	);

	/* ────── RENDER ────── */
	return (
		<div className="max-w-7xl mx-auto p-6 bg-white rounded-xl shadow border border-gray-200 text-sm font-sans">
			<div className="flex justify-between items-center mb-4">
				<h2 className={`text-xl font-bold ${maroon}`}>
					Current Account Reconciliation (Own / Other)
				</h2>
			</div>

			{/* Search and Date Selection Section */}
			<div className="bg-gray-50 p-4 rounded-lg mb-4 border border-gray-200">
				<div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
					<div className="md:col-start-3">
						<YearDropdown />
					</div>
					<div>
						<MonthDropdown />
					</div>
					<div>
						<label className="block text-xs font-medium text-gray-700 mb-1">
							Sub Account / To dept
						</label>
						<input
							type="text"
							value={subac}
							onChange={(e) => setSubac(e.target.value)}
							placeholder="e.g. AFMHQ"
							className="w-full px-3 py-1.5 rounded border border-gray-300 bg-white focus:outline-none focus:ring-1 focus:ring-[#7A0000] text-sm"
						/>
					</div>
				</div>

				{/* Clear Filters */}
				<div className="flex justify-between items-center mt-3">
					<div className="flex gap-4">
						<div className="relative">
							<Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3" />
							<input
								type="text"
								value={searchId}
								placeholder="Search by Code"
								onChange={(e) => setSearchId(e.target.value)}
								className="pl-8 pr-2 py-1.5 w-40 rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#7A0000] transition text-sm"
							/>
						</div>

						<div className="relative">
							<Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3" />
							<input
								type="text"
								value={searchName}
								placeholder="Search by Name"
								onChange={(e) => setSearchName(e.target.value)}
								className="pl-8 pr-2 py-1.5 w-40 rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#7A0000] transition text-sm"
							/>
						</div>
					</div>

					<div className="flex gap-2">
						{(searchId || searchName) && (
							<button
								onClick={clearFilters}
								className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm"
							>
								<RotateCcw className="w-3 h-3" /> Clear Search
							</button>
						)}
						<button
							onClick={clearAll}
							className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm"
						>
							<RotateCcw className="w-3 h-3" /> Clear All
						</button>
					</div>
				</div>
			</div>

			{/* LOADING / ERROR */}
			{loading && (
				<div className="text-center py-8">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7A0000] mx-auto"></div>
					<p className="mt-2 text-gray-600">Loading companies...</p>
				</div>
			)}

			{error && (
				<div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
					Error: {error}
				</div>
			)}

			{!loading && !error && filtered.length === 0 && (
				<div className="text-gray-600 bg-gray-100 p-4 rounded">
					No companies found.
				</div>
			)}

			{/* COMPANY TABLE */}
			{!loading && !error && filtered.length > 0 && (
				<>
					<div className="overflow-x-auto rounded-lg border border-gray-200">
						<div className="max-h-[70vh] overflow-y-auto">
							<table className="w-full table-fixed text-left text-gray-700 text-sm">
								<thead
									className={`${maroonGrad} text-white sticky top-0`}
								>
									<tr>
										<th className="px-4 py-2 w-1/4">Company Code</th>
										<th className="px-4 py-2 w-1/2">Company Name</th>
										<th className="px-4 py-2 w-1/4 text-center">
											Action
										</th>
									</tr>
								</thead>
								<tbody>
									{paginated.map((company, i) => (
										<tr
											key={i}
											className={`${
												i % 2 ? "bg-white" : "bg-gray-50"
											}`}
										>
											<td className="px-4 py-2 truncate">
												{company.compId}
											</td>
											<td className="px-4 py-2 truncate">
												{company.CompName}
											</td>
											<td className="px-4 py-2 text-center">
												<button
													onClick={() =>
														handleCompanySelect(company)
													}
													disabled={
														!selectedYear ||
														!selectedMonth ||
														!subac.trim() ||
														reportLoading
													}
													className={`px-3 py-1 ${
														selectedCompany?.compId ===
														company.compId
															? "bg-green-600 text-white"
															: maroonGrad + " text-white"
													} rounded text-xs font-medium hover:brightness-110 transition shadow disabled:opacity-50 disabled:cursor-not-allowed`}
												>
													<Eye className="inline-block mr-1 w-3 h-3" />
													{selectedCompany?.compId ===
													company.compId
														? "Viewing"
														: "View"}
												</button>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>

					{/* Pagination */}
					<div className="flex justify-end items-center gap-3 mt-3">
						<button
							onClick={() => setPage((p) => Math.max(1, p - 1))}
							disabled={page === 1}
							className="px-3 py-1 border rounded bg-white text-gray-600 text-xs hover:bg-gray-100 disabled:opacity-40"
						>
							Previous
						</button>
						<span className="text-xs text-gray-500">
							Page {page} of {Math.ceil(filtered.length / pageSize)}
						</span>
						<button
							onClick={() =>
								setPage((p) =>
									Math.min(
										Math.ceil(filtered.length / pageSize),
										p + 1
									)
								)
							}
							disabled={page >= Math.ceil(filtered.length / pageSize)}
							className="px-3 py-1 border rounded bg-white text-gray-600 text-xs hover:bg-gray-100 disabled:opacity-40"
						>
							Next
						</button>
					</div>
				</>
			)}

			{/* REPORT MODAL (Matching the Jasper Report Sheet Design) */}
			{showReport && reportData.length > 0 && selectedCompany && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/90 print:static print:inset-auto print:p-0 print:bg-white">
					<div
						className="
              relative bg-white
              w-[95vw] sm:w-[90vw] md:w-[85vw] lg:w-[80vw] xl:w-[75vw]
              max-w-7xl
              rounded-2xl shadow-2xl border border-gray-200 overflow-hidden
              mt-20 md:mt-32 lg:mt-40 lg:ml-64
              mx-auto
              print:relative print:w-full print:max-w-none print:rounded-none
              print:shadow-none print:border-none print:overflow-visible print-container
            "
					>
						<div className="p-4 md:p-6 max-h-[80vh] overflow-y-auto print:p-0 print:max-h-none print:overflow-visible print:mt-10 print:ml-12">
							{/* Action Buttons */}
							<div className="flex justify-end gap-3 mb-4 print:hidden">
								<button
									onClick={handleDownloadCSV}
									className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-blue-400 text-blue-700 bg-white rounded-md hover:bg-blue-50 transition shadow-sm"
								>
									<Download className="w-3.5 h-3.5" /> CSV
								</button>
								<button
									onClick={handleDownloadPDF}
									className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-green-500 text-green-700 bg-white rounded-md hover:bg-green-50 transition shadow-sm"
								>
									<Printer className="w-3.5 h-3.5" /> PDF
								</button>
								<button
									onClick={closeReport}
									className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-red-400 text-red-700 bg-white rounded-md hover:bg-red-50 transition shadow-sm"
								>
									<X className="w-3.5 h-3.5" /> Close
								</button>
							</div>

							{/* Report Sheet Header */}
							<h2 className={`text-lg font-bold text-center mb-2 ${maroon}`}>
								Current Account Balances Both INTERNAL & EXTERNAL {getSimpleMonthName(selectedMonth)} / {selectedYear}
							</h2>

							<div className="flex justify-between items-start text-xs mb-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
								<div>
									<p className="mb-0.5">
										<span className="font-bold text-gray-900">DIVISION :</span>{" "}
										{selectedCompany.compId} / {reportData[0]?.CctName || selectedCompany.CompName}
									</p>
									<p className="mb-0.5">
										<span className="font-bold text-gray-900">Account Code Code :</span>{" "}
										{reportData[0]?.AcName ? `L9200 - ${reportData[0].AcName}` : "L9200 - A/C UNIT - A/C UNIT"}
									</p>
									<p>
										<span className="font-bold text-gray-900">Sub Account :</span>{" "}
										{subac}
									</p>
								</div>
								<div className="text-right">
									<p className="font-bold text-gray-800">
										Report Id :GL/005
									</p>
									<p className="font-semibold text-gray-600 mt-1">
										Currency : LKR
									</p>
								</div>
							</div>

							{/* Report Sheet Table */}
							<div className="overflow-x-auto border border-gray-300 rounded-lg shadow-sm">
								<table className="w-full text-xs border-collapse">
									<thead className={`${maroonGrad} text-white`}>
										<tr>
											<th className="px-4 py-2 text-left font-bold border-r border-white/20 w-1/4">
												Sub Account
											</th>
											<th className="px-4 py-2 text-left font-bold border-r border-white/20 w-1/4">
												Sub Account
											</th>
											<th className="px-4 py-2 text-right font-bold w-1/2">
												Closing Balance
											</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-gray-200">
										{/* Own Division Rows */}
										{ownDivisionItems.map((it, idx) => (
											<tr
												key={`own-${idx}`}
												className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
											>
												{idx === 0 && (
													<td
														rowSpan={ownDivisionItems.length}
														className="px-4 py-2.5 font-bold text-gray-900 align-top border-r border-gray-200 bg-white"
													>
														<div className="border border-gray-800 px-2 py-0.5 inline-block font-semibold rounded text-xs">
															Own Division
														</div>
													</td>
												)}
												<td className="px-4 py-2.5 text-left font-mono font-medium border-r border-gray-200">
													{it.SubAc}
												</td>
												<td className="px-4 py-2.5 text-right font-mono text-gray-900 font-medium">
													{formatNumber(it.ClBal)}
												</td>
											</tr>
										))}

										{/* Other Division Rows */}
										{otherDivisionItems.map((it, idx) => (
											<tr
												key={`other-${idx}`}
												className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
											>
												{idx === 0 && (
													<td
														rowSpan={otherDivisionItems.length}
														className="px-4 py-2.5 font-bold text-gray-900 align-top border-r border-gray-200 bg-white"
													>
														<div className="border border-gray-800 px-2 py-0.5 inline-block font-semibold rounded text-xs">
															Other Division
														</div>
													</td>
												)}
												<td className="px-4 py-2.5 text-left font-mono font-medium border-r border-gray-200">
													{it.SubAc}
												</td>
												<td className="px-4 py-2.5 text-right font-mono text-gray-900 font-medium">
													{formatNumber(it.ClBal)}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					</div>

					{/* Hidden iframe for native printing */}
					<iframe
						ref={iframeRef}
						className="hidden"
						title="print-frame"
					/>
				</div>
			)}
		</div>
	);
};

export default CurrAcctReconOwnOther;
