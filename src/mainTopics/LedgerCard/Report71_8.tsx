import React, { useState, useRef, useEffect, useMemo } from "react";
import { Eye, X, Download, Printer, RotateCcw, ChevronDown, Search } from "lucide-react";
import { toast } from "react-toastify";
import { useUser } from "../../contexts/UserContext";

interface Company {
	compId: string;
	CompName: string;
}

interface Report71_8Item {
	GlCd: string;
	SubAc: string;
	Remarks: string | null;
	AcctDt: string | null;
	DocPf: string | null;
	DocNo: string | null;
	Ref1: string | null;
	Ref2: string | null;
	ChqNo: string | null;
	CrAmt: number | null;
	DrAmt: number | null;
	LogMth: number | null;
	CctName: string | null;
}

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

const getMonthName = (monthNumber: number | string): string => {
	const months = [
		"January", "February", "March", "April", "May", "June",
		"July", "August", "September", "October", "November", "December"
	];
	const index = Number(monthNumber) - 1;
	return months[index] || String(monthNumber);
};

const Report71_8: React.FC = () => {
	const { user } = useUser();
	const epfNo = user?.Userno || "";
	const iframeRef = useRef<HTMLIFrameElement>(null);

	// Company list state
	const [companies, setCompanies] = useState<Company[]>([]);
	const [searchId, setSearchId] = useState("");
	const [searchName, setSearchName] = useState("");
	const [filteredCompanies, setFilteredCompanies] = useState<Company[]>([]);
	const [loadingCompanies, setLoadingCompanies] = useState<boolean>(true);
	const [companiesError, setCompaniesError] = useState<string | null>(null);
	const [page, setPage] = useState(1);
	const pageSize = 50;

	// Selected parameters
	const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
	const [year, setYear] = useState<string>("");
	const [month, setMonth] = useState<string>("");

	// Report data state
	const [data, setData] = useState<Report71_8Item[]>([]);
	const [loadingReport, setLoadingReport] = useState<boolean>(false);
	const [reportError, setReportError] = useState<string | null>(null);
	const [showReport, setShowReport] = useState<boolean>(false);
	const [summaryInfo, setSummaryInfo] = useState<{
		cctName?: string;
		totalDebit?: number;
		totalCredit?: number;
	}>({});

	// Dropdown states
	const [yearDropdownOpen, setYearDropdownOpen] = useState(false);
	const [monthDropdownOpen, setMonthDropdownOpen] = useState(false);

	const maroon = "text-[#7A0000]";
	const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";

	const currentYear = new Date().getFullYear();
	const years = Array.from({ length: 21 }, (_, i) => currentYear - i);
	const months = Array.from({ length: 12 }, (_, i) => i + 1);

	// Close dropdowns on outside click
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			if (!target.closest(".year-dropdown") && !target.closest(".month-dropdown")) {
				setYearDropdownOpen(false);
				setMonthDropdownOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	// Fetch companies on mount
	useEffect(() => {
		const fetchCompanies = async () => {
			if (!epfNo) {
				setCompaniesError("No EPF number available. Please login again.");
				setLoadingCompanies(false);
				return;
			}
			setLoadingCompanies(true);
			try {
				const res = await fetch(`/misapi/api/incomeexpenditure/Usercompanies/${epfNo}/70`);
				if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

				const parsed = await res.json();
				let rawData = [];
				if (Array.isArray(parsed)) {
					rawData = parsed;
				} else if (parsed.data && Array.isArray(parsed.data)) {
					rawData = parsed.data;
				} else if (parsed.result && Array.isArray(parsed.result)) {
					rawData = parsed.result;
				}

				const final: Company[] = rawData.map((item: any) => ({
					compId: item.CompId?.toString() || "",
					CompName: item.CompName?.toString().trim() || "",
				}));

				setCompanies(final);
				setFilteredCompanies(final);
			} catch (err: any) {
				console.error("Error loading companies:", err);
				setCompaniesError(err.message);
				toast.error("Failed to load company codes");
			} finally {
				setLoadingCompanies(false);
			}
		};

		fetchCompanies();
	}, [epfNo]);

	// Filter companies
	useEffect(() => {
		const filtered = companies.filter(
			(c) =>
				(!searchId || c.compId.toLowerCase().includes(searchId.toLowerCase())) &&
				(!searchName || c.CompName.toLowerCase().includes(searchName.toLowerCase()))
		);
		setFilteredCompanies(filtered);
		setPage(1);
	}, [searchId, searchName, companies]);

	const paginatedCompanies = filteredCompanies.slice((page - 1) * pageSize, page * pageSize);

	// Handle company click
	const handleCompanySelect = async (comp: Company) => {
		if (!year) {
			toast.error("Please select a Year first.");
			return;
		}
		if (!month) {
			toast.error("Please select a Month first.");
			return;
		}

		setSelectedCompany(comp);
		await fetchReportData(comp);
	};

	const fetchReportData = async (targetComp?: Company) => {
		const comp = targetComp || selectedCompany;
		if (!comp || !year || !month) {
			toast.error("Please select Year, Month, and Company.");
			return;
		}

		setLoadingReport(true);
		setReportError(null);
		setData([]);
		setShowReport(false);

		try {
			const url = `/misapi/api/ledgercard/report-71-8?compId=${encodeURIComponent(
				comp.compId.trim()
			)}&repyear=${year}&repmonth=${month}`;

			const response = await fetch(url, {
				method: "GET",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
				},
				credentials: "include",
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`HTTP ${response.status}: ${errorText || "Unknown error"}`);
			}

			const json = await response.json();
			const items: Report71_8Item[] = json.data || [];

			if (!items || items.length === 0) {
				toast.warn("No records found for the selected criteria.");
				return;
			}

			setData(items);
			setSummaryInfo(json.summary || {});
			setShowReport(true);
			toast.success("71/8 Report loaded successfully.");
		} catch (err: any) {
			console.error("Fetch Error:", err);
			const msg = err.message.includes("Failed to fetch")
				? "Cannot connect to server. Please check your connection."
				: err.message;
			setReportError(msg);
			toast.error(msg);
		} finally {
			setLoadingReport(false);
		}
	};

	const clearSearch = () => {
		setSearchId("");
		setSearchName("");
	};

	const clearAll = () => {
		setSelectedCompany(null);
		setYear("");
		setMonth("");
		setSearchId("");
		setSearchName("");
		setData([]);
		setShowReport(false);
		setReportError(null);
	};

	const grandTotalDr = useMemo(() => data.reduce((sum, item) => sum + (item.DrAmt || 0), 0), [data]);
	const grandTotalCr = useMemo(() => data.reduce((sum, item) => sum + (item.CrAmt || 0), 0), [data]);

	const handleDownloadCSV = () => {
		if (data.length === 0 || !selectedCompany) return;

		const escapeCsv = (value: any) =>
			`"${String(value ?? "").replace(/"/g, '""')}"`;

		const monthDisplay = getMonthName(month);
		const compName = summaryInfo.cctName || selectedCompany.CompName || "";

		const csvLines: string[] = [
			`Divisional (71/8) Report for ${monthDisplay} / ${year}`,
			`Company Code: ${selectedCompany.compId} ${compName ? `/ ${compName}` : ""}`,
			"",
			["Gl Cd", "Sub Acc.", "Document No", "Remarks", "Acct. Date", "Reference 1", "Reference 2", "Doc. PF", "Dr Amount", "Cr Amount"]
				.map(escapeCsv)
				.join(",")
		];

		data.forEach((item) => {
			csvLines.push(
				[
					item.GlCd || "",
					item.SubAc || "",
					item.DocNo || "",
					item.Remarks || "",
					item.AcctDt ? new Date(item.AcctDt).toLocaleDateString("en-GB") : "",
					item.Ref1 || "",
					item.Ref2 || "",
					item.DocPf || "",
					formatNumber(item.DrAmt),
					formatNumber(item.CrAmt),
				]
					.map(escapeCsv)
					.join(",")
			);
		});

		csvLines.push(
			[
				`"Grand Total"`,
				"",
				"",
				"",
				"",
				"",
				"",
				"",
				formatNumber(grandTotalDr),
				formatNumber(grandTotalCr),
			].join(",")
		);

		const blob = new Blob([csvLines.join("\n")], { type: "text/csv" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `Divisional_71_8_Report_${selectedCompany.compId}_${year}_${month}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	};

	const printPDF = () => {
		if (data.length === 0 || !selectedCompany || !iframeRef.current) return;

		const monthDisplay = getMonthName(month);
		const compName = summaryInfo.cctName || selectedCompany.CompName || "";

		let tableRows = "";

		data.forEach((item) => {
			tableRows += `
				<tr style="border-bottom: 1px solid #ddd;">
					<td style="padding: 4px 8px; border: 1px solid #ddd; font-family: monospace;">${item.GlCd || ""}</td>
					<td style="padding: 4px 8px; border: 1px solid #ddd; font-family: monospace;">${item.SubAc || ""}</td>
					<td style="padding: 4px 8px; border: 1px solid #ddd; font-family: monospace;">${item.DocNo || ""}</td>
					<td style="padding: 4px 8px; border: 1px solid #ddd;">${item.Remarks || ""}</td>
					<td style="padding: 4px 8px; border: 1px solid #ddd; font-family: monospace;">${item.AcctDt ? new Date(item.AcctDt).toLocaleDateString("en-GB") : ""}</td>
					<td style="padding: 4px 8px; border: 1px solid #ddd;">${item.Ref1 || ""}</td>
					<td style="padding: 4px 8px; border: 1px solid #ddd;">${item.Ref2 || ""}</td>
					<td style="padding: 4px 8px; border: 1px solid #ddd; text-align: center;">${item.DocPf || ""}</td>
					<td style="padding: 4px 8px; border: 1px solid #ddd; text-align: right; font-family: monospace;">${formatNumber(item.DrAmt)}</td>
					<td style="padding: 4px 8px; border: 1px solid #ddd; text-align: right; font-family: monospace;">${formatNumber(item.CrAmt)}</td>
				</tr>
			`;
		});

		const htmlContent = `
			<!DOCTYPE html>
			<html>
			<head>
				<title>Divisional (71/8) Report</title>
				<style>
					body { font-family: sans-serif; font-size: 12px; margin: 20px; }
					table { width: 100%; border-collapse: collapse; margin-top: 10px; }
					th, td { border: 1px solid #ddd; padding: 4px 8px; text-align: left; }
					th { background-color: #7A0000; color: white; font-weight: bold; }
					.text-right { text-align: right; }
					.text-center { text-align: center; }
					.header-title { font-size: 16px; font-weight: bold; margin-bottom: 5px; }
					.header-sub { font-size: 14px; margin-bottom: 5px; }
					.grand-total { font-weight: bold; background-color: #7A0000; color: white; }
				</style>
			</head>
			<body>
				<div class="header-title">Divisional (71/8) Report for ${monthDisplay} / ${year}</div>
				<div class="header-sub">Company Code: ${selectedCompany.compId} ${compName ? `/ ${compName}` : ""}</div>
				
				<table>
					<thead>
						<tr>
							<th>Gl Cd</th>
							<th>Sub Acc.</th>
							<th>Document No</th>
							<th>Remarks</th>
							<th class="text-center">Acct. Date</th>
							<th>Reference 1</th>
							<th>Reference 2</th>
							<th class="text-center">Doc. PF</th>
							<th class="text-right">Dr Amount</th>
							<th class="text-right">Cr Amount</th>
						</tr>
					</thead>
					<tbody>
						${tableRows}
					</tbody>
					<tfoot>
						<tr class="grand-total">
							<td colspan="8" class="text-right">Grand Total:</td>
							<td class="text-right" style="font-family: monospace;">${formatNumber(grandTotalDr)}</td>
							<td class="text-right" style="font-family: monospace;">${formatNumber(grandTotalCr)}</td>
						</tr>
					</tfoot>
				</table>
			</body>
			</html>
		`;

		const iframeDoc = iframeRef.current?.contentDocument;
		if (iframeDoc) {
			iframeDoc.open();
			iframeDoc.write(htmlContent);
			iframeDoc.close();
			setTimeout(() => iframeRef.current?.contentWindow?.print(), 500);
		}
	};

	return (
		<div className="max-w-7xl mx-auto p-6 bg-white rounded-xl shadow border border-gray-200 text-sm font-sans">
			<div className="flex justify-between items-center mb-4">
				<h2 className={`text-xl font-bold ${maroon}`}>
					Divisional (71/8) Report
				</h2>
			</div>

			{/* Search and Date Selection Section */}
			<div className="bg-gray-50 p-4 rounded-lg mb-4 border border-gray-200 relative z-30">
				<div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end mb-3">
					{/* Year Dropdown */}
					<div className="year-dropdown relative z-40">
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
							<span>{year || "Select Year"}</span>
							<ChevronDown
								className={`w-3 h-3 text-gray-400 transition-transform ${
									yearDropdownOpen ? "rotate-180" : ""
								}`}
							/>
						</button>

						{yearDropdownOpen && (
							<div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-xl max-h-56 overflow-y-auto">
								{years.map((y) => (
									<button
										key={y}
										type="button"
										onClick={() => {
											setYear(y.toString());
											setYearDropdownOpen(false);
										}}
										className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${
											year === y.toString()
												? "bg-[#7A0000] text-white font-medium"
												: "text-gray-700"
										}`}
									>
										{y}
									</button>
								))}
							</div>
						)}
					</div>

					{/* Month Dropdown */}
					<div className="month-dropdown relative z-40">
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
							<span>{month ? `${month} - ${getMonthName(month)}` : "Select Month"}</span>
							<ChevronDown
								className={`w-3 h-3 text-gray-400 transition-transform ${
									monthDropdownOpen ? "rotate-180" : ""
								}`}
							/>
						</button>

						{monthDropdownOpen && (
							<div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-xl max-h-56 overflow-y-auto">
								{months.map((m) => (
									<button
										key={m}
										type="button"
										onClick={() => {
											setMonth(m.toString());
											setMonthDropdownOpen(false);
										}}
										className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${
											month === m.toString()
												? "bg-[#7A0000] text-white font-medium"
												: "text-gray-700"
										}`}
									>
										{m} - {getMonthName(m)}
									</button>
								))}
							</div>
						)}
					</div>
				</div>

				{/* Search Inputs & Clear Buttons */}
				<div className="flex flex-wrap justify-between items-center gap-3 pt-2 border-t border-gray-200">
					<div className="flex flex-wrap gap-4">
						<div className="relative">
							<Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
							<input
								type="text"
								value={searchId}
								placeholder="Search by Code"
								onChange={(e) => setSearchId(e.target.value)}
								className="pl-8 pr-2 py-1.5 w-44 rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#7A0000] transition text-sm"
							/>
						</div>

						<div className="relative">
							<Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
							<input
								type="text"
								value={searchName}
								placeholder="Search by Name"
								onChange={(e) => setSearchName(e.target.value)}
								className="pl-8 pr-2 py-1.5 w-44 rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#7A0000] transition text-sm"
							/>
						</div>
					</div>

					<div className="flex gap-2">
						{(searchId || searchName) && (
							<button
								onClick={clearSearch}
								className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm"
							>
								<RotateCcw className="w-3.5 h-3.5" /> Clear Search
							</button>
						)}
						<button
							onClick={clearAll}
							className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm"
						>
							<RotateCcw className="w-3.5 h-3.5" /> Clear All
						</button>
					</div>
				</div>
			</div>

			{/* LOADING / ERROR */}
			{loadingCompanies && (
				<div className="text-center py-8">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7A0000] mx-auto"></div>
					<p className="mt-2 text-gray-600">Loading company codes...</p>
				</div>
			)}

			{companiesError && (
				<div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
					Error: {companiesError}
				</div>
			)}

			{!loadingCompanies && !companiesError && filteredCompanies.length === 0 && (
				<div className="text-gray-600 bg-gray-100 p-4 rounded text-center">
					No company codes found matching criteria.
				</div>
			)}

			{/* COMPANY CODE TABLE */}
			{!loadingCompanies && !companiesError && filteredCompanies.length > 0 && (
				<>
					<div className="overflow-x-auto rounded-lg border border-gray-200">
						<div className="max-h-[60vh] overflow-y-auto">
							<table className="w-full table-fixed text-left text-gray-700 text-sm">
								<thead className={`${maroonGrad} text-white sticky top-0 z-10`}>
									<tr>
										<th className="px-4 py-2.5 w-1/4">Company Code</th>
										<th className="px-4 py-2.5 w-1/2">Company Name</th>
										<th className="px-4 py-2.5 w-1/4 text-center">Action</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-gray-200">
									{paginatedCompanies.map((company, i) => (
										<tr
											key={company.compId || i}
											className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}
										>
											<td className="px-4 py-2.5 font-mono font-medium truncate">
												{company.compId}
											</td>
											<td className="px-4 py-2.5 truncate">
												{company.CompName}
											</td>
											<td className="px-4 py-2.5 text-center">
												<button
													onClick={() => handleCompanySelect(company)}
													disabled={!year || !month || loadingReport}
													className={`px-3 py-1.5 ${
														selectedCompany?.compId === company.compId
															? "bg-green-600 text-white"
															: maroonGrad + " text-white"
													} rounded text-xs font-medium hover:brightness-110 transition shadow disabled:opacity-50 disabled:cursor-not-allowed`}
												>
													<Eye className="inline-block mr-1 w-3.5 h-3.5" />
													{selectedCompany?.compId === company.compId && loadingReport
														? "Loading..."
														: selectedCompany?.compId === company.compId
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
							Page {page} of {Math.ceil(filteredCompanies.length / pageSize)}
						</span>
						<button
							onClick={() =>
								setPage((p) =>
									Math.min(
										Math.ceil(filteredCompanies.length / pageSize),
										p + 1
									)
								)
							}
							disabled={page >= Math.ceil(filteredCompanies.length / pageSize)}
							className="px-3 py-1 border rounded bg-white text-gray-600 text-xs hover:bg-gray-100 disabled:opacity-40"
						>
							Next
						</button>
					</div>
				</>
			)}

			{/* REPORT RESULTS MODAL */}
			{showReport && data.length > 0 && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/90 print:static print:inset-auto print:p-0 print:bg-white">
					<div className="relative bg-white w-[95vw] sm:w-[90vw] md:w-[85vw] lg:w-[80vw] xl:w-[75vw] max-w-7xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden mt-20 md:mt-32 lg:mt-40 lg:ml-64 mx-auto print:relative print:w-full print:max-w-none print:rounded-none print:shadow-none print:border-none print:overflow-visible">
						<div className="p-4 md:p-6 max-h-[80vh] overflow-y-auto print:p-0 print:max-h-none print:overflow-visible print:mt-10 print:ml-12">
							<div className="flex justify-end gap-3 mb-6 print:hidden">
								<button
									onClick={handleDownloadCSV}
									className="flex items-center gap-1 px-3 py-1.5 border border-blue-400 text-blue-700 bg-white rounded-md text-xs font-medium hover:bg-blue-50"
								>
									<Download className="w-4 h-4" /> CSV
								</button>
								<button
									onClick={printPDF}
									className="flex items-center gap-1 px-3 py-1.5 border border-green-400 text-green-700 bg-white rounded-md text-xs font-medium hover:bg-green-50"
								>
									<Printer className="w-4 h-4" /> PDF
								</button>
								<button
									onClick={() => setShowReport(false)}
									className="flex items-center gap-1 px-3 py-1.5 border border-red-400 text-red-700 bg-white rounded-md text-xs font-medium hover:bg-red-50"
								>
									<X className="w-4 h-4" /> Close
								</button>
							</div>

							<h2 className={`text-xl font-bold mb-4 text-center ${maroon}`}>
								Divisional (71/8) Report for {getMonthName(month)} / {year}
							</h2>

							<div className="grid grid-cols-1 md:grid-cols-2 text-sm mb-4 bg-gray-50 p-3 rounded-lg border border-gray-200">
								<div>
									<p>
										<span className="font-bold">Company Code :</span>{" "}
										{selectedCompany?.compId} {summaryInfo.cctName || selectedCompany?.CompName ? `/ ${summaryInfo.cctName || selectedCompany?.CompName}` : ""}
									</p>
								</div>
								<div className="text-right font-semibold text-gray-600">
									Currency : LKR
								</div>
							</div>

							<div className="overflow-x-auto border rounded-lg shadow-sm">
								<table className="w-full text-xs border-collapse table-fixed min-w-[1300px]">
									<thead className={`${maroonGrad} text-white`}>
										<tr>
											<th className="px-3 py-2 w-[10%] text-left">Gl Cd</th>
											<th className="px-3 py-2 w-[5%] text-left">Sub Acc.</th>
											<th className="px-3 py-2 w-[11%] text-left">Document No</th>
											<th className="px-3 py-2 w-[28%] text-left">Remarks</th>
											<th className="px-3 py-2 w-[8%] text-center">Acct. Date</th>
											<th className="px-3 py-2 w-[7%] text-left">Reference 1</th>
											<th className="px-3 py-2 w-[7%] text-left">Reference 2</th>
											<th className="px-3 py-2 w-[6%] text-center">Doc. PF</th>
											<th className="px-3 py-2 w-[9%] text-right">Dr Amount</th>
											<th className="px-3 py-2 w-[9%] text-right">Cr Amount</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-gray-200">
										{data.map((item, idx) => (
											<tr
												key={idx}
												className="border-b border-gray-200 hover:bg-gray-50"
											>
												<td className="px-3 py-2 font-mono font-medium border-r border-gray-200">
													{item.GlCd}
												</td>
												<td className="px-3 py-2 font-mono border-r border-gray-200">
													{item.SubAc}
												</td>
												<td className="px-3 py-2 font-mono border-r border-gray-200">
													{item.DocNo}
												</td>
												<td className="px-3 py-2 border-r border-gray-200 break-words whitespace-normal" title={item.Remarks || ""}>
													{item.Remarks}
												</td>
												<td className="px-3 py-2 border-r border-gray-200 whitespace-nowrap text-center">
													{item.AcctDt ? new Date(item.AcctDt).toLocaleDateString("en-GB") : ""}
												</td>
												<td className="px-3 py-2 border-r border-gray-200">
													{item.Ref1}
												</td>
												<td className="px-3 py-2 border-r border-gray-200">
													{item.Ref2}
												</td>
												<td className="px-3 py-2 font-mono text-center border-r border-gray-200">
													{item.DocPf}
												</td>
												<td className="px-3 py-2 text-right font-mono border-r border-gray-200">
													{formatNumber(item.DrAmt)}
												</td>
												<td className="px-3 py-2 text-right font-mono">
													{formatNumber(item.CrAmt)}
												</td>
											</tr>
										))}
									</tbody>
									<tfoot className="bg-[#7A0000] text-white font-bold border-t-2 border-gray-400">
										<tr>
											<td colSpan={8} className="px-3 py-2.5 text-right border-r border-red-900">
												Grand Total:
											</td>
											<td className="px-3 py-2.5 text-right font-mono border-r border-red-900">
												{formatNumber(grandTotalDr)}
											</td>
											<td className="px-3 py-2.5 text-right font-mono">
												{formatNumber(grandTotalCr)}
											</td>
										</tr>
									</tfoot>
								</table>
							</div>
						</div>
					</div>
				</div>
			)}
			
			<iframe
				ref={iframeRef}
				style={{ display: "none" }}
				title="Print Report"
			/>
		</div>
	);
};

export default Report71_8;
