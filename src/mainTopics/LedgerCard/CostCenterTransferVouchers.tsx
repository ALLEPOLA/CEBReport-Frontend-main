import React, { useState, useRef, useEffect, useMemo } from "react";
import { Eye, X, Download, Printer, RotateCcw, ChevronDown, Search } from "lucide-react";
import { toast } from "react-toastify";
import { useUser } from "../../contexts/UserContext";

interface CostCenter {
	CostCenterId: string;
	CostCenterName: string;
}

interface DocProfile {
	doc_pf: string;
	doc_desc?: string;
}

interface VoucherItem {
	DocPf: string | null;
	TrfType: string | null;
	SubAc: string | null;
	Remarks: string | null;
	AcctDt: string | null;
	DocNo: string | null;
	Ref1: string | null;
	ChqNo: string | null;
	CrAmt: number | null;
	DrAmt: number | null;
	LogMth: number | null;
	DesgDept: string | null;
	CctName: string | null;
}

interface GroupedVouchers {
	docPf: string;
	trfType: string;
	items: VoucherItem[];
	subTotalDr: number;
	subTotalCr: number;
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
	options: CostCenter[];
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
			opt.CostCenterId.toLowerCase().includes(searchTerm.toLowerCase()) ||
			opt.CostCenterName.toLowerCase().includes(searchTerm.toLowerCase())
	);

	const selectedOption = options.find((opt) => opt.CostCenterId === value);

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
						? `${selectedOption.CostCenterId} - ${selectedOption.CostCenterName}`
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
							<div className="p-3 text-center text-gray-500">Loading cost centers...</div>
						) : filteredOptions.length === 0 ? (
							<div className="p-3 text-center text-gray-500">No cost centers found</div>
						) : (
							filteredOptions.map((opt) => (
								<div
									key={opt.CostCenterId}
									onClick={() => {
										onChange(opt.CostCenterId);
										setIsOpen(false);
										setSearchTerm("");
									}}
									className={`px-3 py-2 cursor-pointer hover:bg-red-50 hover:text-[#7A0000] flex items-center gap-3 transition ${
										value === opt.CostCenterId ? "bg-red-50 text-[#7A0000] font-bold" : "text-gray-700"
									}`}
								>
									<span className="font-mono font-semibold shrink-0">{opt.CostCenterId}</span>
									<span className="text-gray-500 text-xs truncate text-left max-w-[220px] md:max-w-[320px]">{opt.CostCenterName}</span>
								</div>
							))
						)}
					</div>
				</div>
			)}
		</div>
	);
};

const CostCenterTransferVouchers: React.FC = () => {
	const { user } = useUser();
	const epfNo = user?.Userno || "";
	const iframeRef = useRef<HTMLIFrameElement>(null);

	const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
	const [loadingCostCenters, setLoadingCostCenters] = useState<boolean>(false);

	const [fromCostCenter, setFromCostCenter] = useState<string>("");
	const [toCostCenter, setToCostCenter] = useState<string>("");
	const [docProfiles, setDocProfiles] = useState<DocProfile[]>([]);
	const [loadingDocProfiles, setLoadingDocProfiles] = useState<boolean>(false);
	const [selectedDocPf, setSelectedDocPf] = useState<string>("");
	const [year, setYear] = useState<string>("");
	const [startMonth, setStartMonth] = useState<string>("");
	const [endMonth, setEndMonth] = useState<string>("");
	const [data, setData] = useState<VoucherItem[]>([]);
	const [loading, setLoading] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);
	const [showReport, setShowReport] = useState<boolean>(false);

	const maroon = "text-[#7A0000]";
	const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";

	const currentYear = new Date().getFullYear();

	useEffect(() => {
		const fetchCostCenters = async () => {
			if (!epfNo) return;
			setLoadingCostCenters(true);
			try {
				const res = await fetch(`/misapi/api/incomeexpenditure/departments/${epfNo}`);
				if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

				const parsed = await res.json();
				let rawData = [];
				if (Array.isArray(parsed)) {
					rawData = parsed;
				} else if (parsed.data && Array.isArray(parsed.data)) {
					rawData = parsed.data;
				} else if (parsed.result && Array.isArray(parsed.result)) {
					rawData = parsed.result;
				} else if (parsed.departments && Array.isArray(parsed.departments)) {
					rawData = parsed.departments;
				}

				const final: CostCenter[] = rawData.map((item: any) => ({
					CostCenterId: item.DeptId?.toString() || item.deptId?.toString() || item.CostCenterId?.toString() || "",
					CostCenterName: item.DeptName?.toString().trim() || item.deptName?.toString().trim() || item.CostCenterName?.toString().trim() || "",
				}));

				setCostCenters(final);
			} catch (err: any) {
				console.error("Error loading cost centers:", err);
			} finally {
				setLoadingCostCenters(false);
			}
		};

		fetchCostCenters();
	}, [epfNo]);

	useEffect(() => {
		const fetchDocProfiles = async () => {
			if (!fromCostCenter) {
				setDocProfiles([]);
				setSelectedDocPf("");
				return;
			}
			setLoadingDocProfiles(true);
			try {
				const res = await fetch(`/misapi/api/ledgercard/costcenter-transfer-vouchers/doc-profiles?costctr=${encodeURIComponent(fromCostCenter)}`);
				if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
				const parsed = await res.json();
				setDocProfiles(parsed || []);
			} catch (err: any) {
				console.error("Error loading doc profiles:", err);
			} finally {
				setLoadingDocProfiles(false);
			}
		};

		fetchDocProfiles();
	}, [fromCostCenter]);

	const handleViewClick = async () => {
		if (!fromCostCenter.trim()) {
			toast.error("Please select Cost Center.");
			return;
		}
		if (!toCostCenter.trim()) {
			toast.error("Please select Destination Cost Center.");
			return;
		}
		if (!year || isNaN(+year)) {
			toast.error("Please select a valid year.");
			return;
		}
		if (!startMonth || !endMonth) {
			toast.error("Please select both Start and End Month.");
			return;
		}
		if (+startMonth < 1 || +startMonth > 12 || +endMonth < 1 || +endMonth > 12) {
			toast.error("Months must be between 1 and 12.");
			return;
		}
		if (+endMonth < +startMonth) {
			toast.error("End Month cannot be before Start Month.");
			return;
		}

		setLoading(true);
		setError(null);
		setData([]);
		setShowReport(false);

		try {
			const url = `/misapi/api/ledgercard/costcenter-transfer-vouchers?costctr=${encodeURIComponent(
				fromCostCenter.trim()
			)}&repyear=${year}&startmonth=${startMonth}&endmonth=${endMonth}&subac=${encodeURIComponent(
				toCostCenter.trim()
			)}${selectedDocPf ? `&docpf=${encodeURIComponent(selectedDocPf.trim())}` : ""}`;

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

			const items: VoucherItem[] = await response.json();

			if (!items || items.length === 0) {
				toast.warn("No transfer vouchers found for the given criteria.");
				return;
			}

			setData(items);
			setShowReport(true);
			toast.success("Report loaded successfully.");
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
		setFromCostCenter("");
		setToCostCenter("");
		setSelectedDocPf("");
		setYear("");
		setStartMonth("");
		setEndMonth("");
		setData([]);
		setShowReport(false);
		setError(null);
	};

	// Grouping by Doc. Profile & Transfer Type
	const groupedData = useMemo(() => {
		const groupsMap: { [key: string]: GroupedVouchers } = {};
		const groupKeys: string[] = [];

		data.forEach((item) => {
			const docPf = item.DocPf || "N/A";
			const trfType = item.TrfType || "N/A";
			const key = `${docPf}___${trfType}`;

			if (!groupsMap[key]) {
				groupsMap[key] = {
					docPf,
					trfType,
					items: [],
					subTotalDr: 0,
					subTotalCr: 0,
				};
				groupKeys.push(key);
			}

			groupsMap[key].items.push(item);
			groupsMap[key].subTotalDr += item.DrAmt || 0;
			groupsMap[key].subTotalCr += item.CrAmt || 0;
		});

		return groupKeys.map((key) => groupsMap[key]);
	}, [data]);

	const grandTotalDr = useMemo(() => data.reduce((sum, item) => sum + (item.DrAmt || 0), 0), [data]);
	const grandTotalCr = useMemo(() => data.reduce((sum, item) => sum + (item.CrAmt || 0), 0), [data]);

	const handleDownloadCSV = () => {
		if (data.length === 0) return;

		const escapeCsv = (value: any) =>
			`"${String(value ?? "").replace(/"/g, '""')}"`;

		const monthDisplay = startMonth === endMonth 
			? getMonthName(startMonth) 
			: `${getMonthName(startMonth)} - ${getMonthName(endMonth)}`;
		const cctName = data[0]?.CctName || "";

		const csvLines: string[] = [
			`Cost center Ledger Card Report for ${monthDisplay} / ${year}`,
			`Cost Centre: ${fromCostCenter} ${cctName ? `/ ${cctName}` : ""}`,
			`Destination Cost centre (Transfer Department): ${toCostCenter}`,
			"",
		];

		groupedData.forEach((group) => {
			csvLines.push(`"Group: Doc. Profile: ${group.docPf} | Transfer Type: ${group.trfType}"`);
			csvLines.push(
				["Document No", "Remarks", "Acct. Date", "Sub Account", "Reference", "Dr Amount", "Cr Amount"]
					.map(escapeCsv)
					.join(",")
			);

			group.items.forEach((item) => {
				csvLines.push(
					[
						item.DocNo || "",
						item.Remarks || "",
						item.AcctDt ? new Date(item.AcctDt).toLocaleDateString("en-GB") : "",
						item.SubAc || "",
						item.ChqNo || item.Ref1 || "",
						formatNumber(item.DrAmt),
						formatNumber(item.CrAmt),
					]
						.map(escapeCsv)
						.join(",")
				);
			});

			csvLines.push(
				[
					`"Subtotal (${group.docPf} / ${group.trfType})"`,
					"",
					"",
					"",
					"",
					formatNumber(group.subTotalDr),
					formatNumber(group.subTotalCr),
				].join(",")
			);
			csvLines.push("");
		});

		csvLines.push(
			[
				`"Grand Total"`,
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
		a.download = `CostCenterTransferVouchers_${fromCostCenter}_to_${toCostCenter}_${year}_${startMonth}-${endMonth}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	};

	const printPDF = () => {
		if (data.length === 0 || !iframeRef.current) return;

		const monthDisplay = startMonth === endMonth 
			? getMonthName(startMonth) 
			: `${getMonthName(startMonth)} - ${getMonthName(endMonth)}`;
		const cctName = data[0]?.CctName || "";

		let tableRows = "";
		groupedData.forEach((group) => {
			tableRows += `
				<tr style="background-color: #fce8e8; font-weight: bold; color: #7A0000;">
					<td colspan="7" style="padding: 6px; border: 1px solid #ddd;">
						Doc. Profile: <strong>${group.docPf}</strong> &nbsp;|&nbsp; Transfer Type: <strong>${group.trfType}</strong>
					</td>
				</tr>
			`;

			group.items.forEach((item) => {
				tableRows += `
					<tr style="border-bottom: 1px solid #ddd;">
						<td style="padding: 4px 8px; border: 1px solid #ddd;">${item.DocNo || ""}</td>
						<td style="padding: 4px 8px; border: 1px solid #ddd;">${item.Remarks || ""}</td>
						<td style="padding: 4px 8px; border: 1px solid #ddd;">${item.AcctDt ? new Date(item.AcctDt).toLocaleDateString("en-GB") : ""}</td>
						<td style="padding: 4px 8px; border: 1px solid #ddd;">${item.SubAc || ""}</td>
						<td style="padding: 4px 8px; border: 1px solid #ddd;">${item.ChqNo || item.Ref1 || ""}</td>
						<td style="padding: 4px 8px; border: 1px solid #ddd; text-align: right;">${formatNumber(item.DrAmt)}</td>
						<td style="padding: 4px 8px; border: 1px solid #ddd; text-align: right;">${formatNumber(item.CrAmt)}</td>
					</tr>
				`;
			});

			tableRows += `
				<tr style="background-color: #fef9c3; font-weight: bold; border-bottom: 2px solid #ccc;">
					<td colspan="5" style="padding: 5px 8px; border: 1px solid #ddd; text-align: right;">Subtotal (${group.docPf} / ${group.trfType}):</td>
					<td style="padding: 5px 8px; border: 1px solid #ddd; text-align: right; color: #b91c1c;">${formatNumber(group.subTotalDr)}</td>
					<td style="padding: 5px 8px; border: 1px solid #ddd; text-align: right; color: #15803d;">${formatNumber(group.subTotalCr)}</td>
				</tr>
			`;
		});

		const htmlContent = `
			<!DOCTYPE html>
			<html>
			<head>
				<title>Cost Center Transfer Vouchers</title>
				<style>
					body { font-family: sans-serif; font-size: 12px; margin: 20px; }
					table { width: 100%; border-collapse: collapse; margin-top: 10px; }
					th, td { border: 1px solid #ddd; padding: 4px 8px; text-align: left; }
					th { background-color: #7A0000; color: white; font-weight: bold; }
					.text-right { text-align: right; }
					.header-title { font-size: 16px; font-weight: bold; margin-bottom: 5px; }
					.header-sub { font-size: 14px; margin-bottom: 5px; }
					.grand-total { font-weight: bold; background-color: #7A0000; color: white; }
				</style>
			</head>
			<body>
				<div class="header-title">Cost center Ledger Card Report for ${monthDisplay} / ${year}</div>
				<div class="header-sub">Cost Centre: ${fromCostCenter} ${cctName ? `/ ${cctName}` : ""}</div>
				<div class="header-sub">Destination Cost centre (Transfer Department): ${toCostCenter}</div>
				
				<table>
					<thead>
						<tr>
							<th>Document No</th>
							<th>Remarks</th>
							<th>Acct. Date</th>
							<th>Sub Account</th>
							<th>Reference</th>
							<th class="text-right">Dr Amount</th>
							<th class="text-right">Cr Amount</th>
						</tr>
					</thead>
					<tbody>
						${tableRows}
					</tbody>
					<tfoot>
						<tr class="grand-total">
							<td colspan="5" class="text-right">Grand Total:</td>
							<td class="text-right">${formatNumber(grandTotalDr)}</td>
							<td class="text-right">${formatNumber(grandTotalCr)}</td>
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
				Cost Center Transfer Vouchers
			</h2>

			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
				<SearchableSelect
					label="Cost Center"
					value={fromCostCenter}
					onChange={setFromCostCenter}
					options={costCenters}
					placeholder="Select Cost Center"
					loading={loadingCostCenters}
				/>

				<SearchableSelect
					label="Destination Cost Center"
					value={toCostCenter}
					onChange={setToCostCenter}
					options={costCenters}
					placeholder="Select Destination"
					loading={loadingCostCenters}
				/>

				<div>
					<label className={`block text-xs md:text-sm font-bold ${maroon} mb-1`}>
						Doc. Profile
					</label>
					<select
						value={selectedDocPf}
						onChange={(e) => setSelectedDocPf(e.target.value)}
						className="w-full pl-3 pr-2 py-1.5 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#7A0000] text-xs md:text-sm bg-white"
						disabled={loadingDocProfiles || !fromCostCenter}
					>
						<option value="">
							{loadingDocProfiles ? "Loading..." : "All Profiles"}
						</option>
						{docProfiles.map((dp, idx) => (
							<option key={idx} value={dp.doc_pf}>
								{dp.doc_pf} {dp.doc_desc ? `- ${dp.doc_desc}` : ""}
							</option>
						))}
					</select>
				</div>

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
						Start Month
					</label>
					<select
						value={startMonth}
						onChange={(e) => setStartMonth(e.target.value)}
						className="w-full pl-3 pr-2 py-1.5 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#7A0000] text-xs md:text-sm"
					>
						<option value="">Select Start Month</option>
						{Array.from({ length: 12 }, (_, i) => (
							<option key={i + 1} value={i + 1}>
								{i + 1} - {new Date(0, i).toLocaleString("en", { month: "long" })}
							</option>
						))}
					</select>
				</div>

				<div>
					<label className={`block text-xs md:text-sm font-bold ${maroon} mb-1`}>
						End Month
					</label>
					<select
						value={endMonth}
						onChange={(e) => setEndMonth(e.target.value)}
						className="w-full pl-3 pr-2 py-1.5 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#7A0000] text-xs md:text-sm"
					>
						<option value="">Select End Month</option>
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
					<p className="mt-2 text-gray-600">Loading ledger data...</p>
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
								Cost center Ledger Card Report for {startMonth === endMonth ? getMonthName(startMonth) : `${getMonthName(startMonth)} - ${getMonthName(endMonth)}`} / {year}
							</h2>

							<div className="grid grid-cols-1 md:grid-cols-2 text-sm mb-4 bg-gray-50 p-3 rounded-lg border border-gray-200">
								<div>
									<p>
										<span className="font-bold">Cost Centre :</span>{" "}
										{fromCostCenter} {data[0]?.CctName ? `/ ${data[0].CctName}` : ""}
									</p>
									<p>
										<span className="font-bold">
											Destination Cost centre (Transfer Department) :
										</span>{" "}
										{toCostCenter}
									</p>
								</div>
								<div className="text-right font-semibold text-gray-600">
									Currency : LKR
								</div>
							</div>

							<div className="overflow-x-auto border rounded-lg shadow-sm">
								<table className="w-full text-xs border-collapse table-fixed min-w-[1050px]">
									<thead className={`${maroonGrad} text-white`}>
										<tr>
											<th className="px-3 py-2 w-[18%] text-left">Document No</th>
											<th className="px-3 py-2 w-[24%] text-left">Remarks</th>
											<th className="px-3 py-2 w-[12%] text-left">Acct. Date</th>
											<th className="px-3 py-2 w-[11%] text-left">Sub Account</th>
											<th className="px-3 py-2 w-[13%] text-left">Reference</th>
											<th className="px-3 py-2 w-[11%] text-right">Dr Amount</th>
											<th className="px-3 py-2 w-[11%] text-right">Cr Amount</th>
										</tr>
									</thead>
									<tbody>
										{groupedData.map((group, gIdx) => (
											<React.Fragment key={gIdx}>
												{/* Group Header Row */}
												<tr className="bg-red-50/90 font-bold border-t-2 border-b border-[#7A0000]/30 text-[#7A0000]">
													<td colSpan={7} className="px-3 py-2">
														<div className="flex items-center gap-4 text-xs md:text-sm">
															<span>
																Doc. Profile:{" "}
																<span className="font-mono bg-white px-2 py-0.5 rounded border border-red-200 shadow-sm text-gray-900">
																	{group.docPf}
																</span>
															</span>
															<span className="text-gray-300">|</span>
															<span>
																Transfer Type:{" "}
																<span className="font-mono bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-200 shadow-sm">
																	{group.trfType}
																</span>
															</span>
														</div>
													</td>
												</tr>

												{/* Voucher Items */}
												{group.items.map((item, idx) => (
													<tr
														key={`${gIdx}-${idx}`}
														className="border-b border-gray-200 hover:bg-gray-50"
													>
														<td className="px-3 py-2 font-mono font-medium border-r border-gray-200">
															{item.DocNo}
														</td>
														<td className="px-3 py-2 border-r border-gray-200">
															{item.Remarks}
														</td>
														<td className="px-3 py-2 border-r border-gray-200 whitespace-nowrap">
															{item.AcctDt ? new Date(item.AcctDt).toLocaleDateString("en-GB") : ""}
														</td>
														<td className="px-3 py-2 font-mono border-r border-gray-200">
															{item.SubAc}
														</td>
														<td className="px-3 py-2 border-r border-gray-200">
															{item.ChqNo || item.Ref1 || ""}
														</td>
														<td className="px-3 py-2 text-right font-mono border-r border-gray-200">
															{formatNumber(item.DrAmt)}
														</td>
														<td className="px-3 py-2 text-right font-mono">
															{formatNumber(item.CrAmt)}
														</td>
													</tr>
												))}

												{/* Group Subtotal Row */}
												<tr className="bg-amber-50/80 font-bold border-b-2 border-gray-300 text-gray-800">
													<td colSpan={5} className="px-3 py-2 text-right border-r border-gray-300">
														Subtotal ({group.docPf} / {group.trfType}):
													</td>
													<td className="px-3 py-2 text-right font-mono border-r border-gray-300 text-red-700">
														{formatNumber(group.subTotalDr)}
													</td>
													<td className="px-3 py-2 text-right font-mono text-green-700">
														{formatNumber(group.subTotalCr)}
													</td>
												</tr>
											</React.Fragment>
										))}
									</tbody>
									<tfoot className="bg-[#7A0000] text-white font-bold border-t-2 border-gray-400">
										<tr>
											<td colSpan={5} className="px-3 py-2.5 text-right border-r border-red-900">
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

export default CostCenterTransferVouchers;
