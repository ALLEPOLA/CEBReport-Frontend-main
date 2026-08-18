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
	EntDt: string | null;
	PostDt: string | null;
	AcctDt: string | null;
	SubAc: string;
	DeptId1: string;
	DeptId: string;
	ParentId: string;
	TrfParentId: string;
	DocPf: string;
	DocNo: string;
	Ref1: string | null;
	Ref2: string | null;
	Remarks: string | null;
	DesgDept: string;
	CrAmt: number | null;
	DrAmt: number | null;
	LogMth: number | null;
	OpBal: number | null;
	ClBal: number | null;
	CompNm: string;
}

/* ────── Number formatting – negative → (-123.45) ────── */
const formatNumber = (num: number | string | null | undefined): string => {
	const n = num === null || num === undefined ? NaN : Number(num);
	if (isNaN(n) || n === 0) return "0.00";

	const abs = Math.abs(n);
	const formatted = abs.toLocaleString("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});
	return n < 0 ? `(-${formatted})` : formatted;
};

/* ────── Date formatting ────── */
const formatDate = (dateStr: string | null): string => {
	if (!dateStr) return "";
	const date = new Date(dateStr);
	return date.toLocaleDateString("en-GB");
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
const CurrAcctReconExtPeriod: React.FC = () => {
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
	const [monthFrom, setMonthFrom] = useState<number | undefined>(undefined);
	const [monthTo, setMonthTo] = useState<number | undefined>(undefined);
	const [subac, setSubac] = useState("");

	// Report data state
	const [reportData, setReportData] = useState<ReportItem[]>([]);
	const [, setReportLoading] = useState(false);
	const [, setReportError] = useState<string | null>(null);
	const [showReport, setShowReport] = useState(false);
	const iframeRef = useRef<HTMLIFrameElement>(null);

	// Dropdown state
	const [yearDropdownOpen, setYearDropdownOpen] = useState(false);
	const [monthFromDropdownOpen, setMonthFromDropdownOpen] = useState(false);
	const [monthToDropdownOpen, setMonthToDropdownOpen] = useState(false);

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
				!target.closest(".month-from-dropdown") &&
				!target.closest(".month-to-dropdown")
			) {
				setYearDropdownOpen(false);
				setMonthFromDropdownOpen(false);
				setMonthToDropdownOpen(false);
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

		if (selectedYear && monthFrom && monthTo && subac.trim()) {
			if (monthFrom > monthTo) {
				toast.error("Month From cannot be greater than Month To.");
				return;
			}
			await fetchLedgerData(company);
		}
	};

	const fetchLedgerData = async (company?: Company) => {
		const targetCompany = company || selectedCompany;
		if (!targetCompany || !selectedYear || !monthFrom || !monthTo || !subac.trim()) {
			toast.error(
				"Please select Year, Month From, Month To, enter Sub Account and select a Company"
			);
			return;
		}

		if (monthFrom > monthTo) {
			toast.error("Month From cannot be greater than Month To.");
			return;
		}

		setReportLoading(true);
		setReportError(null);
		setReportData([]);
		setShowReport(false);

		try {
			const resp = await fetch(
				`/misapi/api/ledgercard/curr-acct-recon-ext-period?compId=${encodeURIComponent(targetCompany.compId)}&repyear=${selectedYear}&monthFrom=${monthFrom}&monthTo=${monthTo}&subac=${encodeURIComponent(subac.trim())}`,
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
		setMonthFrom(undefined);
		setMonthTo(undefined);
		setSubac("");
		setSelectedCompany(null);
		setSearchId("");
		setSearchName("");
		setPage(1);
	};

	/* ────── CLOSE REPORT (reset selectedCompany) ────── */
	const closeReport = () => {
		setShowReport(false);
		setReportData([]);
		setSelectedCompany(null);
	};

	const totalDr = reportData.reduce((acc, curr) => acc + (curr.DrAmt || 0), 0);
	const totalCr = reportData.reduce((acc, curr) => acc + (curr.CrAmt || 0), 0);

	const periodDisplay = `${getSimpleMonthName(monthFrom)} - ${getSimpleMonthName(monthTo)} ${selectedYear}`;

	/* ────── PRINT (PDF) ────── */
	const printPDF = () => {
		if (reportData.length === 0 || !iframeRef.current || !selectedCompany)
			return;

		let rows = "";
		reportData.forEach((it, i) => {
			rows += `
        <tr class="${i % 2 ? "bg-white" : "bg-gray-50"}">
          <td class="p-1 border border-gray-300 text-center text-xs">${formatDate(it.PostDt)}</td>
          <td class="p-1 border border-gray-300 text-left text-xs">${it.DeptId1}</td>
          <td class="p-1 border border-gray-300 text-left text-xs">${it.DeptId}</td>
          <td class="p-1 border border-gray-300 text-left text-xs break-words">${it.DocPf}</td>
          <td class="p-1 border border-gray-300 text-left text-xs break-words">${it.DocNo}</td>
          <td class="p-1 border border-gray-300 text-left text-xs">${it.Ref1 || ""}</td>
          <td class="p-1 border border-gray-300 text-left text-xs">${it.Ref2 || ""}</td>
          <td class="p-1 border border-gray-300 text-left text-xs break-words">${it.Remarks || ""}</td>
          <td class="p-1 border border-gray-300 text-left text-xs">${it.DesgDept || ""}</td>
          <td class="p-1 border border-gray-300 text-center text-xs">${formatDate(it.AcctDt)}</td>
          <td class="p-1 border border-gray-300 text-right text-xs font-mono">${formatNumber(it.DrAmt)}</td>
          <td class="p-1 border border-gray-300 text-right text-xs font-mono">${formatNumber(it.CrAmt)}</td>
          <td class="p-1 border border-gray-300 text-left text-xs">${it.ParentId || ""}</td>
          <td class="p-1 border border-gray-300 text-left text-xs">${it.TrfParentId || ""}</td>
        </tr>`;
		});

		const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    @media print {
      @page { size: A4 landscape; margin: 8mm 5mm 10mm 5mm; }
      body { margin:0; font-family:Arial,Helvetica,sans-serif; font-size:8px; }
      .title { margin:10px 8px 6px; text-align:center; font-weight:bold; color:#7A0000; font-size:13px; }
      .info  { margin:6px 8px; font-size:9px; display:flex; justify-content:space-between; }
      .info p { margin:1px 0; }
      .cur   { text-align:right; margin-right:3px; font-weight:600; color:#4B5563; font-size:9px; }
      table { border-collapse:collapse; width:100%; margin:0; table-layout:fixed; font-size:8px; }
      th, td { border:1px solid #D1D5DB; padding:4px; word-wrap:break-word; }
      th { background:linear-gradient(to right,#7A0000,#A52A2A); color:white; text-align:center; font-weight:bold; }
      .font-mono { font-family:monospace; }
      .text-right { text-align:right; }
      .text-left { text-align:left; }
      .text-center { text-align:center; }
      @page {
        @bottom-left  { content:"Printed on: ${new Date().toLocaleString(
				"en-US",
				{ timeZone: "Asia/Colombo" }
			)}"; font-size:7px; color:gray; }
        @bottom-right { content:"Page " counter(page) " of " counter(pages); font-size:7px; color:gray; }
      }
    }
  </style>
</head>
<body>
  <div class="title">Current Account Reconciliation (External) - Period ${periodDisplay}</div>

  <div class="info">
    <div>
      <p><span style="font-weight:bold;">Company :</span> ${selectedCompany.CompName} (${selectedCompany.compId})</p>
      <p><span style="font-weight:bold;">Account Code :</span> L9200</p>
      <p><span style="font-weight:bold;">Sub Account / To Dept :</span> ${subac}</p>
    </div>
	<div>
      <p><span style="font-weight:bold;">Opening Balance :</span> ${formatNumber(reportData[0]?.OpBal)}</p>
      <p><span style="font-weight:bold;">Closing Balance :</span> ${formatNumber(reportData[0]?.ClBal)}</p>
	  <p class="cur">Currency : LKR</p>
	</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:6%">Posted</th>
        <th style="width:6%">Dept Id</th>
        <th style="width:6%">Org Dept</th>
        <th style="width:7%">Doc Pf</th>
        <th style="width:9%">Doc No</th>
        <th style="width:9%">Ref 1</th>
        <th style="width:6%">Ref 2</th>
        <th style="width:13%">Remarks</th>
        <th style="width:6%">Des Dept</th>
        <th style="width:6%">Acct Date</th>
        <th style="width:7%">Dr Amt</th>
        <th style="width:7%">Cr Amt</th>
        <th style="width:6%">Org_ParentI</th>
        <th style="width:6%">Deg_ParentId</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr>
        <td colspan="10" class="text-right" style="font-weight:bold">Total:</td>
        <td class="text-right font-mono" style="font-weight:bold">${formatNumber(totalDr)}</td>
        <td class="text-right font-mono" style="font-weight:bold">${formatNumber(totalCr)}</td>
        <td colspan="2"></td>
      </tr>
    </tfoot>
  </table>

  <div style="margin-top:25px; display:flex; justify-content:space-between; padding:0 15px; font-size:9px;">
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

		const titleRows = [
			`Current Account Reconciliation (External) - Period`,
			`Company: ${selectedCompany.CompName} (${selectedCompany.compId})`,
			`Period: ${periodDisplay}`,
			`Account Code: L9200`,
			`Sub Account / To Dept: ${subac}`,
			`Opening Balance: ${formatNumber(reportData[0]?.OpBal)}`,
			`Closing Balance: ${formatNumber(reportData[0]?.ClBal)}`,
			`Currency: LKR`,
			"",
		];

		const headers = [
			"Posted",
			"Dept Id",
			"Org Dept",
			"Doc Pf",
			"Doc No",
			"Ref 1",
			"Ref 2",
			"Remarks",
			"Des Dept",
			"Acct Date",
			"Dr Amt",
			"Cr Amt",
			"Org_ParentI",
			"Deg_ParentId",
		];

		const rows = reportData.map((it) => [
			csvEscape(formatDate(it.PostDt)),
			csvEscape(it.DeptId1),
			csvEscape(it.DeptId),
			csvEscape(it.DocPf),
			csvEscape(it.DocNo),
			csvEscape(it.Ref1),
			csvEscape(it.Ref2),
			csvEscape(it.Remarks),
			csvEscape(it.DesgDept),
			csvEscape(formatDate(it.AcctDt)),
			csvEscape(formatNumber(it.DrAmt)),
			csvEscape(formatNumber(it.CrAmt)),
			csvEscape(it.ParentId),
			csvEscape(it.TrfParentId),
		]);

		const csvContent = [
			...titleRows,
			headers.join(","),
			...rows.map((r) => r.join(",")),
			["", "", "", "", "", "", "", "", "", "Total:", formatNumber(totalDr), formatNumber(totalCr), "", ""].join(","),
		].join("\n");

		const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `curr_acct_recon_ext_period_${selectedCompany.compId}_${selectedYear}_${monthFrom}-${monthTo}.csv`;
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
					setMonthFromDropdownOpen(false);
					setMonthToDropdownOpen(false);
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
								if (monthFrom && monthTo && subac.trim() && selectedCompany) {
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

	// Month From Dropdown Component
	const MonthFromDropdown = () => (
		<div className="month-from-dropdown relative">
			<label className="block text-xs font-medium text-gray-700 mb-1">
				Month From
			</label>
			<button
				type="button"
				onClick={() => {
					setMonthFromDropdownOpen(!monthFromDropdownOpen);
					setYearDropdownOpen(false);
					setMonthToDropdownOpen(false);
				}}
				className="w-full flex justify-between items-center px-3 py-1.5 border border-gray-300 rounded bg-white text-gray-700 text-sm focus:outline-none focus:ring-1 focus:ring-[#7A0000]"
			>
				<span>{getMonthName(monthFrom)}</span>
				<ChevronDown
					className={`w-3 h-3 text-gray-400 transition-transform ${
						monthFromDropdownOpen ? "rotate-180" : ""
					}`}
				/>
			</button>

			{monthFromDropdownOpen && (
				<div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
					{months.map((month) => (
						<button
							key={month}
							type="button"
							onClick={() => {
								setMonthFrom(month);
								setMonthFromDropdownOpen(false);
								if (selectedYear && monthTo && subac.trim() && selectedCompany) {
									fetchLedgerData();
								}
							}}
							className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${
								monthFrom === month
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

	// Month To Dropdown Component
	const MonthToDropdown = () => (
		<div className="month-to-dropdown relative">
			<label className="block text-xs font-medium text-gray-700 mb-1">
				Month To
			</label>
			<button
				type="button"
				onClick={() => {
					setMonthToDropdownOpen(!monthToDropdownOpen);
					setYearDropdownOpen(false);
					setMonthFromDropdownOpen(false);
				}}
				className="w-full flex justify-between items-center px-3 py-1.5 border border-gray-300 rounded bg-white text-gray-700 text-sm focus:outline-none focus:ring-1 focus:ring-[#7A0000]"
			>
				<span>{getMonthName(monthTo)}</span>
				<ChevronDown
					className={`w-3 h-3 text-gray-400 transition-transform ${
						monthToDropdownOpen ? "rotate-180" : ""
					}`}
				/>
			</button>

			{monthToDropdownOpen && (
				<div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
					{months.map((month) => (
						<button
							key={month}
							type="button"
							onClick={() => {
								setMonthTo(month);
								setMonthToDropdownOpen(false);
								if (selectedYear && monthFrom && subac.trim() && selectedCompany) {
									fetchLedgerData();
								}
							}}
							className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${
								monthTo === month
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
					Current Account Reconciliation (External) - Period
				</h2>
			</div>

			{/* Search and Date Selection Section */}
			<div className="bg-gray-50 p-4 rounded-lg mb-4 border border-gray-200">
				<div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
					<div>
						<YearDropdown />
					</div>
					<div>
						<MonthFromDropdown />
					</div>
					<div>
						<MonthToDropdown />
					</div>
					<div>
						<label className="block text-xs font-medium text-gray-700 mb-1">
							Sub Account / To Dept
						</label>
						<input
							type="text"
							value={subac}
							onChange={(e) => setSubac(e.target.value)}
							placeholder="e.g. 600.00"
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
														!monthFrom ||
														!monthTo ||
														!subac.trim()
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

			{/* REPORT MODAL */}
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
						<div className="p-2 md:p-2 max-h-[80vh] overflow-y-auto print:p-0 print:max-h-none print:overflow-visible print:mt-10 print:ml-12">
							<div className="flex justify-end gap-3 mb-6 md:mb-8 print:hidden">
								<button
									onClick={handleDownloadCSV}
									className="flex items-center gap-1 px-2 py-1 text-xs border border-blue-400 text-blue-700 bg-white rounded hover:bg-blue-50"
								>
									<Download className="w-3.5 h-3.5" /> CSV
								</button>
								<button
									onClick={handleDownloadPDF}
									className="flex items-center gap-1 px-2 py-1 text-xs border border-green-400 text-green-700 bg-white rounded hover:bg-green-50"
								>
									<Printer className="w-3.5 h-3.5" /> PDF
								</button>
								<button
									onClick={closeReport}
									className="flex items-center gap-1 px-2 py-1 text-xs border border-red-400 text-red-700 bg-white rounded hover:bg-red-50"
								>
									<X className="w-3.5 h-3.5" /> Close
								</button>
							</div>

							<h2
								className={`text-lg font-bold text-center mb-1 ${maroon}`}
							>
								Current Account Reconciliation (External) - Period {periodDisplay}
							</h2>

							<div className="flex justify-between text-xs mb-1">
								<div>
									<p>
										<span className="font-bold">Company :</span>{" "}
										{selectedCompany.CompName} (
										{selectedCompany.compId})
									</p>
									<p>
										<span className="font-bold">Account Code :</span> L9200
									</p>
									<p>
										<span className="font-bold">Sub Account / To Dept :</span> {subac}
									</p>
								</div>
								<div>
									<p>
										<span className="font-bold">Opening Bal :</span> {formatNumber(reportData[0]?.OpBal)}
									</p>
									<p>
										<span className="font-bold">Closing Bal :</span> {formatNumber(reportData[0]?.ClBal)}
									</p>
									<p className="font-semibold text-gray-600">
										Currency: LKR
									</p>
								</div>
							</div>

							<div className="overflow-x-auto border rounded-lg">
								<table className="w-full text-xs table-fixed min-w-[1500px]">
									<thead className={`${maroonGrad} text-white`}>
										<tr>
											<th className="px-1.5 py-1 w-[6%] border-r border-gray-200">
												Posted
											</th>
											<th className="px-1.5 py-1 w-[6%] border-r border-gray-200">
												Dept Id
											</th>
											<th className="px-1.5 py-1 w-[6%] border-r border-gray-200">
												Org Dept
											</th>
											<th className="px-1.5 py-1 w-[7%] border-r border-gray-200">
												Doc Pf
											</th>
											<th className="px-1.5 py-1 w-[10%] border-r border-gray-200">
												Doc No
											</th>
											
											<th className="px-1.5 py-1 w-[9%] border-r border-gray-200">
												Ref 1
											</th>
											<th className="px-1.5 py-1 w-[6%] border-r border-gray-200">
												Ref 2
											</th>
											<th className="px-1.5 py-1 w-[11%] border-r border-gray-200">
												Remarks
											</th>
											<th className="px-1.5 py-1 w-[6%] border-r border-gray-200">
												Des Dept
											</th>
											<th className="px-1.5 py-1 w-[6%] border-r border-gray-200">
												Acct Date
											</th>
											<th className="px-1.5 py-1 w-[7%] border-r border-gray-200">
												Dr Amount
											</th>
											<th className="px-1.5 py-1 w-[7%] border-r border-gray-200">
												Cr Amount
											</th>
											<th className="px-1.5 py-1 w-[6.5%] border-r border-gray-200">
												Org_ParentI
											</th>
											<th className="px-1.5 py-1 w-[6.5%]">
												Deg_ParentId
											</th>
										</tr>
									</thead>
									<tbody>
										{reportData.map((it, i) => (
											<tr
												key={i}
												className={
													i % 2 ? "bg-white" : "bg-gray-50"
												}
											>
												<td className="px-1.5 py-1 text-center border-r border-gray-200">
													{formatDate(it.PostDt)}
												</td>
												<td className="px-1.5 py-1 text-left border-r border-gray-200">
													{it.DeptId1}
												</td>
												<td className="px-1.5 py-1 text-left border-r border-gray-200">
													{it.DeptId}
												</td>
												<td className="px-1.5 py-1 text-left border-r border-gray-200">
													{it.DocPf}
												</td>
												<td className="px-1.5 py-1 text-left border-r border-gray-200 break-words">
													{it.DocNo}
												</td>
											
												<td className="px-1.5 py-1 text-left border-r border-gray-200">
													{it.Ref1 || ""}
												</td>
												<td className="px-1.5 py-1 text-left border-r border-gray-200">
													{it.Ref2 || ""}
												</td>
												<td className="px-1.5 py-1 text-left break-words text-xs border-r border-gray-200">
													{it.Remarks || ""}
												</td>
												<td className="px-1.5 py-1 text-left border-r border-gray-200">
													{it.DesgDept}
												</td>
												<td className="px-1.5 py-1 text-center border-r border-gray-200">
													{formatDate(it.AcctDt)}
												</td>
												<td className="px-1.5 py-1 text-right font-mono border-r border-gray-200">
													{formatNumber(it.DrAmt)}
												</td>
												<td className="px-1.5 py-1 text-right font-mono border-r border-gray-200">
													{formatNumber(it.CrAmt)}
												</td>
												<td className="px-1.5 py-1 text-left border-r border-gray-200">
													{it.ParentId}
												</td>
												<td className="px-1.5 py-1 text-left border-r border-gray-200">
													{it.TrfParentId}
												</td>
											</tr>
										))}
									</tbody>
									<tfoot>
										<tr>
											<td colSpan={10} className="px-1.5 py-1 text-right font-bold border-r border-gray-200 border-t border-gray-200">Total:</td>
											<td className="px-1.5 py-1 text-right font-mono font-bold border-r border-gray-200 border-t border-gray-200">{formatNumber(totalDr)}</td>
											<td className="px-1.5 py-1 text-right font-mono font-bold border-r border-gray-200 border-t border-gray-200">{formatNumber(totalCr)}</td>
											<td colSpan={2} className="border-t border-gray-200"></td>
										</tr>
									</tfoot>
								</table>
							</div>
						</div>
					</div>

					<iframe ref={iframeRef} className="hidden" title="print-frame" />
				</div>
			)}
		</div>
	);
};

export default CurrAcctReconExtPeriod;
