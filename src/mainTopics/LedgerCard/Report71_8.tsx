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

interface SearchableSelectProps {
	label: string;
	value: string;
	onChange: (val: string) => void;
	options: Company[];
	placeholder: string;
	loading?: boolean;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
	label,
	value,
	onChange,
	options,
	placeholder,
	loading = false,
}) => {
	const [isOpen, setIsOpen] = useState(false);
	const [searchTerm, setSearchTerm] = useState("");
	const dropdownRef = useRef<HTMLDivElement>(null);

	const maroon = "text-[#7A0000]";

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setIsOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const filteredOptions = options.filter(
		(opt) =>
			opt.compId.toLowerCase().includes(searchTerm.toLowerCase()) ||
			opt.CompName.toLowerCase().includes(searchTerm.toLowerCase())
	);

	const selectedOption = options.find((opt) => opt.compId === value);

	return (
		<div className="relative" ref={dropdownRef}>
			<label className={`block text-xs md:text-sm font-bold ${maroon} mb-1`}>
				{label}
			</label>
			<div
				onClick={() => setIsOpen(!isOpen)}
				className="w-full flex items-center justify-between pl-3 pr-2 py-1.5 rounded-md border border-gray-300 bg-white cursor-pointer focus-within:ring-2 focus-within:ring-[#7A0000] text-xs md:text-sm"
			>
				<span className={selectedOption ? "text-gray-900 font-medium truncate" : "text-gray-400 truncate"}>
					{selectedOption
						? `${selectedOption.compId} - ${selectedOption.CompName}`
						: value || placeholder}
				</span>
				<ChevronDown className="w-4 h-4 text-gray-400 shrink-0 ml-1" />
			</div>

			{isOpen && (
				<div className="absolute z-50 mt-1 w-max min-w-full max-w-[90vw] md:max-w-[450px] bg-white rounded-md shadow-lg border border-gray-200 py-1 text-xs md:text-sm max-h-60 overflow-hidden flex flex-col left-0">
					<div className="p-2 border-b border-gray-100 relative">
						<Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
						<input
							type="text"
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							placeholder="Search by ID or Name..."
							className="w-full pl-8 pr-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:border-[#7A0000]"
							autoFocus
						/>
					</div>

					<div className="overflow-y-auto max-h-48">
						{loading ? (
							<div className="p-3 text-center text-gray-500">Loading divisions...</div>
						) : filteredOptions.length === 0 ? (
							<div className="p-3 text-center text-gray-500">No divisions found</div>
						) : (
							filteredOptions.map((opt) => (
								<div
									key={opt.compId}
									onClick={() => {
										onChange(opt.compId);
										setIsOpen(false);
										setSearchTerm("");
									}}
									className={`px-3 py-2 cursor-pointer hover:bg-red-50 hover:text-[#7A0000] flex justify-between items-center gap-3 transition ${
										value === opt.compId ? "bg-red-50 text-[#7A0000] font-bold" : "text-gray-700"
									}`}
								>
									<span className="font-mono font-semibold shrink-0">{opt.compId}</span>
									<span className="text-gray-500 text-xs truncate max-w-[220px] md:max-w-[320px] text-right">{opt.CompName}</span>
								</div>
							))
						)}
					</div>
				</div>
			)}
		</div>
	);
};

const Report71_8: React.FC = () => {
	const { user } = useUser();
	const epfNo = user?.Userno || "";
	const iframeRef = useRef<HTMLIFrameElement>(null);

	const [companies, setCompanies] = useState<Company[]>([]);
	const [loadingCompanies, setLoadingCompanies] = useState<boolean>(false);

	const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
	const [year, setYear] = useState<string>("");
	const [month, setMonth] = useState<string>("");
	const [data, setData] = useState<Report71_8Item[]>([]);
	const [loading, setLoading] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);
	const [showReport, setShowReport] = useState<boolean>(false);
	const [summaryInfo, setSummaryInfo] = useState<{
		cctName?: string;
		totalDebit?: number;
		totalCredit?: number;
	}>({});

	const maroon = "text-[#7A0000]";
	const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";

	const currentYear = new Date().getFullYear();

	useEffect(() => {
		const fetchCompanies = async () => {
			if (!epfNo) return;
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
			} catch (err: any) {
				console.error("Error loading companies:", err);
			} finally {
				setLoadingCompanies(false);
			}
		};

		fetchCompanies();
	}, [epfNo]);

	const handleViewClick = async () => {
		if (!selectedCompanyId.trim()) {
			toast.error("Please select Division / Region.");
			return;
		}
		if (!year || isNaN(+year)) {
			toast.error("Please select a valid year.");
			return;
		}
		if (!month) {
			toast.error("Please select a month.");
			return;
		}

		setLoading(true);
		setError(null);
		setData([]);
		setShowReport(false);

		try {
			const url = `/misapi/api/ledgercard/report-71-8?compId=${encodeURIComponent(
				selectedCompanyId.trim()
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
			setError(msg);
			toast.error(msg);
		} finally {
			setLoading(false);
		}
	};

	const clearFilters = () => {
		setSelectedCompanyId("");
		setYear("");
		setMonth("");
		setData([]);
		setShowReport(false);
		setError(null);
	};

	const grandTotalDr = useMemo(() => data.reduce((sum, item) => sum + (item.DrAmt || 0), 0), [data]);
	const grandTotalCr = useMemo(() => data.reduce((sum, item) => sum + (item.CrAmt || 0), 0), [data]);

	const handleDownloadCSV = () => {
		if (data.length === 0) return;

		const escapeCsv = (value: any) =>
			`"${String(value ?? "").replace(/"/g, '""')}"`;

		const monthDisplay = getMonthName(month);
		const compName = summaryInfo.cctName || companies.find((c) => c.compId === selectedCompanyId)?.CompName || "";

		const csvLines: string[] = [
			`Divisional (71/8) Report for ${monthDisplay} / ${year}`,
			`Division / Region: ${selectedCompanyId} ${compName ? `/ ${compName}` : ""}`,
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
		a.download = `Divisional_71_8_Report_${selectedCompanyId}_${year}_${month}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	};

	const printPDF = () => {
		if (data.length === 0 || !iframeRef.current) return;

		const monthDisplay = getMonthName(month);
		const compName = summaryInfo.cctName || companies.find((c) => c.compId === selectedCompanyId)?.CompName || "";

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
				<div class="header-sub">Division / Region: ${selectedCompanyId} ${compName ? `/ ${compName}` : ""}</div>
				
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
		<div className="max-w-[95%] mx-auto p-2 md:p-4 bg-white rounded-xl shadow border border-gray-200 text-sm md:text-base font-sans min-h-[350px] pb-28">
			<h2 className={`text-lg md:text-xl font-bold mb-4 ${maroon}`}>
				Divisional (71/8) Report
			</h2>

			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
				<SearchableSelect
					label="Division / Region"
					value={selectedCompanyId}
					onChange={setSelectedCompanyId}
					options={companies}
					placeholder="Select Division / Region"
					loading={loadingCompanies}
				/>

				<div>
					<label className={`block text-xs md:text-sm font-bold ${maroon} mb-1`}>
						Year
					</label>
					<select
						value={year}
						onChange={(e) => setYear(e.target.value)}
						className="w-full pl-3 pr-2 py-1.5 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#7A0000] text-xs md:text-sm bg-white"
					>
						<option value="">Select Year</option>
						{Array.from({ length: 21 }, (_, i) => currentYear - i).map((y) => (
							<option key={y} value={y}>
								{y}
							</option>
						))}
					</select>
				</div>

				<div>
					<label className={`block text-xs md:text-sm font-bold ${maroon} mb-1`}>
						Month
					</label>
					<select
						value={month}
						onChange={(e) => setMonth(e.target.value)}
						className="w-full pl-3 pr-2 py-1.5 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#7A0000] text-xs md:text-sm"
					>
						<option value="">Select Month</option>
						{Array.from({ length: 12 }, (_, i) => (
							<option key={i + 1} value={i + 1}>
								{i + 1} - {new Date(0, i).toLocaleString("en", { month: "long" })}
							</option>
						))}
					</select>
				</div>
			</div>

			<div className="flex flex-wrap gap-2 mb-4 justify-end">
				<button
					onClick={handleViewClick}
					disabled={loading}
					className={`flex items-center gap-1 px-3 py-1.5 ${maroonGrad} text-white rounded-md text-xs md:text-sm font-medium hover:brightness-110 transition shadow ${
						loading ? "opacity-50 cursor-not-allowed" : ""
					}`}
				>
					<Eye className="w-4 h-4" /> View
				</button>
				<button
					onClick={clearFilters}
					className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs md:text-sm"
				>
					<RotateCcw className="w-4 h-4" /> Clear
				</button>
			</div>

			{loading && (
				<div className="text-center py-8">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7A0000] mx-auto"></div>
					<p className="mt-2 text-gray-600">Loading report data...</p>
				</div>
			)}

			{error && (
				<div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
					Error: {error}
				</div>
			)}

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
										<span className="font-bold">Division / Region :</span>{" "}
										{selectedCompanyId} {summaryInfo.cctName || companies.find((c) => c.compId === selectedCompanyId)?.CompName ? `/ ${summaryInfo.cctName || companies.find((c) => c.compId === selectedCompanyId)?.CompName}` : ""}
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
