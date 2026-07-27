// PriceVarianceReport.tsx
import React, {useEffect, useState} from "react";
import {Download, Printer, X, RotateCcw, Eye, Search} from "lucide-react";
import {toast} from "react-toastify";
import {useUser} from "../../contexts/UserContext";

interface Department {
	DeptId: string;
	DeptName: string;
}

interface PriceVarianceItem {
	MatCd: string | null;
	GradeCd: string | null;
	UnitPrice: number | null;
	NewPrice: number | null;
	INetChange: number | null;
	DNetChange: number | null;
	QtyOnHand: number | null;
	Var: number | null;
	CctName: string | null;
}

/* ────── Constants ────── */
const MAX_RECORDS = 5000;
const FETCH_TIMEOUT_MS = 120000;
const PAGE_SIZE = 9;

const MONTHS = [
	{value: "01", label: "January"},
	{value: "02", label: "February"},
	{value: "03", label: "March"},
	{value: "04", label: "April"},
	{value: "05", label: "May"},
	{value: "06", label: "June"},
	{value: "07", label: "July"},
	{value: "08", label: "August"},
	{value: "09", label: "September"},
	{value: "10", label: "October"},
	{value: "11", label: "November"},
	{value: "12", label: "December"},
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({length: 21}, (_, i) => String(currentYear - i)); // current year back 20 years

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

const csvEscape = (val: string | number | null | undefined): string => {
	if (val == null) return "";
	const str = String(val);
	if (/[,\n"]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
	return str;
};

// ── New text escape for preserving leading zeros ──
const csvEscapeText = (val: string | number | null | undefined): string => {
  if (val == null) return "";
  const str = String(val);
  const escaped = str.replace(/"/g, '""');
  // "=""0011""" -> after CSV unescaping -> ="0011"
  // Excel evaluates this as the formula ="0011", a quoted string literal,
  // so it returns TEXT "0011" and keeps both leading zeros.
  return `"=""${escaped}"""`;
};

// ── Numeric escape (no leading‑zero issue) ──
const csvEscapeNumber = (val: string | number | null | undefined): string => {
  if (val == null) return "";
  const str = String(val);
  if (/[,\n"]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
};

/* ────── MAIN COMPONENT ────── */
const PriceVarianceReport: React.FC = () => {
	const {user} = useUser();
	const epfNo = user?.Userno || "";

	/* ── Cost Center list state ── */
	const [departments, setDepartments] = useState<Department[]>([]);
	const [filtered, setFiltered] = useState<Department[]>([]);
	const [searchId, setSearchId] = useState("");
	const [searchName, setSearchName] = useState("");
	const [page, setPage] = useState(1);
	const [deptLoading, setDeptLoading] = useState(true);
	const [deptError, setDeptError] = useState<string | null>(null);

	/* ── Report state ── */
	const [repYear, setRepYear] = useState("");
	const [repMonth, setRepMonth] = useState("");
	const [selectedDept, setSelectedDept] = useState<Department | null>(null);
	const [reportData, setReportData] = useState<PriceVarianceItem[]>([]);
	const [reportLoading, setReportLoading] = useState(false);
	const [showReport, setShowReport] = useState(false);

	const maroon = "text-[#7A0000]";
	const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";

	/* ────── Fetch Departments ────── */
	useEffect(() => {
		const fetchDepartments = async () => {
			if (!epfNo) {
				setDeptError("No EPF number available.");
				toast.error("Login required.");
				setDeptLoading(false);
				return;
			}

			setDeptLoading(true);
			try {
				const res = await fetch(
					`/misapi/api/incomeexpenditure/departments/${epfNo}`
				);
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const json = await res.json();
				const raw = Array.isArray(json)
					? json
					: json.data || json.result || json.departments || [];
				const deps: Department[] = raw.map((d: any) => ({
					DeptId: String(d.DeptId || d.deptId || ""),
					DeptName: String(d.DeptName || d.deptName || "").trim(),
				}));
				setDepartments(deps);
				setFiltered(deps);
			} catch (e: any) {
				setDeptError(e.message);
				toast.error("Failed to load cost centers.");
			} finally {
				setDeptLoading(false);
			}
		};
		fetchDepartments();
	}, [epfNo]);

	/* ────── Filter Departments ────── */
	useEffect(() => {
		const f = departments.filter(
			(d) =>
				(!searchId ||
					d.DeptId.toLowerCase().includes(searchId.toLowerCase())) &&
				(!searchName ||
					d.DeptName.toLowerCase().includes(searchName.toLowerCase()))
		);
		setFiltered(f);
		setPage(1);
	}, [searchId, searchName, departments]);

	/* ────── Input validation ────── */
	const validateInputs = (): boolean => {
		if (!repYear) {
			toast.error("Please select 'Year'");
			return false;
		}
		if (!repMonth) {
			toast.error("Please select 'Month'");
			return false;
		}
		return true;
	};

	/* ────── Fetch report for a selected Cost Center ────── */
	const fetchReport = async (dept: Department) => {
		if (!validateInputs()) return;

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

		setSelectedDept(dept);
		setReportLoading(true);
		setReportData([]);
		setShowReport(true);

		try {
			const costCtrParam = encodeURIComponent(dept.DeptId);
			const url = `/misapi/api/priceva/report/${repYear}/${repMonth}/${costCtrParam}`;

			const res = await fetch(url, {
				credentials: "include",
				signal: controller.signal,
			});
			clearTimeout(timeoutId);

			if (!res.ok) {
				const txt = await res.text();
				throw new Error(`HTTP ${res.status}: ${txt}`);
			}

			const json = await res.json();
			if (!json.success)
				throw new Error(json.message || "Failed to load data");

			const items: PriceVarianceItem[] = json.data || [];
			if (items.length > MAX_RECORDS)
				throw new Error(
					`Too many records (${items.length}). Please refine your search.`
				);

			if (items.length === 0) {
				toast.warn("No records found for the selected criteria.");
				setShowReport(false);
				setSelectedDept(null);
				return;
			}

			setReportData(items);
			toast.success(`${items.length} records loaded successfully.`);
		} catch (e: any) {
			if (e.name === "AbortError") {
				toast.error("Request timed out.");
			} else {
				const msg = e.message.includes("Failed to fetch")
					? "Server unreachable. Please check your connection."
					: e.message;
				toast.error(msg);
			}
			setReportData([]);
			setShowReport(false);
			setSelectedDept(null);
		} finally {
			setReportLoading(false);
		}
	};

	const clearFilters = () => {
		setSearchId("");
		setSearchName("");
	};

	const clearAll = () => {
		setRepYear("");
		setRepMonth("");
		setSearchId("");
		setSearchName("");
		setShowReport(false);
		setReportData([]);
		setSelectedDept(null);
		toast.info("Filters cleared.");
	};

	const closeReport = () => {
		setShowReport(false);
		setReportData([]);
		setSelectedDept(null);
		setReportLoading(false);
	};

	/* ────── Single flat table, sorted by material code ────── */
	const sortedData = [...reportData].sort((a, b) =>
		(a.MatCd || "").localeCompare(b.MatCd || "")
	);

	const grandTotalIncrease = reportData.reduce(
		(s, r) => s + (r.INetChange || 0),
		0
	);
	const grandTotalDecrease = reportData.reduce(
		(s, r) => s + (r.DNetChange || 0),
		0
	);
	const grandTotalVar = reportData.reduce((s, r) => s + (r.Var || 0), 0);
	const cctName =
		reportData.find((r) => r.CctName)?.CctName || selectedDept?.DeptName || "";
	const costCtrDisplay = selectedDept?.DeptId || "";
	const monthLabel = MONTHS.find((m) => m.value === repMonth)?.label || repMonth;

	/* ────── CSV download ────── */
	const downloadCSV = () => {
		if (reportData.length === 0) return;

		const titleRows = [
			`Price Variance Report For ${monthLabel} ${repYear}`,
			`Cost Centre: ${costCtrDisplay} | ${cctName}`,
			"",
		];

		const headers = [
			"No",
			"Material Code",
			"Grade Code",
			"Unit Price",
			"New Price",
			"Increase",
			"Decrease",
			"Qty On Hand",
			"Variance",
		];
		const rows: string[] = [headers.join(",")];

		sortedData.forEach((it, i) => {
			rows.push(
				[
					csvEscapeNumber(i + 1),
					csvEscapeText(it.MatCd),
					csvEscapeText(it.GradeCd),
					csvEscapeNumber(formatNumber(it.UnitPrice)),
					csvEscapeNumber(formatNumber(it.NewPrice)),
					csvEscapeNumber(formatNumber(it.INetChange)),
					csvEscapeNumber(formatNumber(it.DNetChange)),
					csvEscapeNumber(formatNumber(it.QtyOnHand)),
					csvEscapeNumber(formatNumber(it.Var)),
				].join(",")
			);
		});

		rows.push(
			`Grand Total,,,,,${csvEscape(formatNumber(grandTotalIncrease))},${csvEscape(
				formatNumber(grandTotalDecrease)
			)},,${csvEscape(formatNumber(grandTotalVar))}`
		);

		const csv = [...titleRows, ...rows].join("\n");
		const blob = new Blob([csv], {type: "text/csv;charset=utf-8;"});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `PriceVariance_${repYear}_${repMonth}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	};

	/* ────── PDF print ──────
	   NOTE: This HTML is written into a brand-new window via window.open("", "_blank"),
	   which has NO access to the app's Tailwind stylesheet. Any Tailwind utility class
	   (text-right, text-center, bg-white, font-mono, px-3, py-2, etc.) used here does
	   NOTHING in that window. Every visual rule — alignment, spacing, borders, colors —
	   must be written as inline `style="..."` or defined in the <style> block below.
	*/
	const printPDF = () => {
		if (reportData.length === 0) return;

		let rows = "";
		const cellBase =
			"padding:6px 8px; border:1px solid #d1d5db; font-size:8.5px;";
		const mono = "font-family:monospace;";

		sortedData.forEach((it, i) => {
			const rowBg = i % 2 ? "#ffffff" : "#f9fafb";
			rows += `
          <tr style="background:${rowBg};">
            <td style="${cellBase} text-align:right;">${i + 1}</td>
            <td style="${cellBase} text-align:center; ${mono}">${
					it.MatCd || ""
				}</td>
            <td style="${cellBase} text-align:center;">${
					it.GradeCd || ""
				}</td>
            <td style="${cellBase} text-align:right; ${mono}">${formatNumber(
					it.UnitPrice
				)}</td>
            <td style="${cellBase} text-align:right; ${mono}">${formatNumber(
					it.NewPrice
				)}</td>
            <td style="${cellBase} text-align:right; ${mono}">${formatNumber(
					it.INetChange
				)}</td>
            <td style="${cellBase} text-align:right; ${mono}">${formatNumber(
					it.DNetChange
				)}</td>
            <td style="${cellBase} text-align:right; ${mono}">${formatNumber(
					it.QtyOnHand
				)}</td>
            <td style="${cellBase} text-align:right; ${mono}">${formatNumber(
					it.Var
				)}</td>
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
      .title { margin: 10px 8px 20px; text-align:center; font-weight:bold; color:#7A0000; font-size:13px; }
      .info { margin:6px 8px; font-size:9px; display:flex; justify-content:space-between; }
      table { border-collapse:collapse; width:100%; font-size:8.5px; }
      th, td { border:1px solid #d1d5db; padding:6px 8px; word-wrap:break-word; }
      th { background:linear-gradient(to right,#7A0000,#A52A2A); color:white; text-align:center; font-weight:bold; }
      tfoot td { background:#d3d3d3; font-weight:bold; }
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
  <div class="title">Price Variance Report For ${monthLabel} ${repYear}</div>
  <div class="info">
    <div><strong>Cost Center:</strong> ${costCtrDisplay} / ${cctName}</div>
    <div style="font-weight:600; color:#4B5563;">Currency : LKR</div>
  </div>
  <table style="width:100%; border-collapse:collapse; font-size:8.5px; border:1px solid #d1d5db;">
    <thead>
      <tr style="background:linear-gradient(to right,#7A0000,#A52A2A); color:white;">
        <th style="padding:6px 8px; width:5%; text-align:right;">No</th>
        <th style="padding:6px 8px; width:13%; text-align:center;">Material Code</th>
        <th style="padding:6px 8px; width:11%; text-align:center;">Grade Code</th>
        <th style="padding:6px 8px; width:12%; text-align:right;">Unit Price</th>
        <th style="padding:6px 8px; width:12%; text-align:right;">New Price</th>
        <th style="padding:6px 8px; width:12%; text-align:right;">Increase</th>
        <th style="padding:6px 8px; width:12%; text-align:right;">Decrease</th>
        <th style="padding:6px 8px; width:11%; text-align:right;">Qty On Hand</th>
        <th style="padding:6px 8px; width:12%; text-align:right;">Variance</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr>
        <td colspan="5" style="text-align:right; padding:6px 8px; border:1px solid #d1d5db;">Grand Total</td>
        <td style="text-align:right; padding:6px 8px; border:1px solid #d1d5db; font-family:monospace;">${formatNumber(
			grandTotalIncrease
		)}</td>
        <td style="text-align:right; padding:6px 8px; border:1px solid #d1d5db; font-family:monospace;">${formatNumber(
			grandTotalDecrease
		)}</td>
        <td style="padding:6px 8px; border:1px solid #d1d5db;"></td>
        <td style="text-align:right; padding:6px 8px; border:1px solid #d1d5db; font-family:monospace;">${formatNumber(
			grandTotalVar
		)}</td>
      </tr>
    </tfoot>
  </table>

  <div style="margin-top:20px; display:flex; justify-content:space-between; padding:0 15px; font-size:9px;">
    <div>Prepared By: ____________________</div>
    <div>Checked By: ____________________</div>
  </div>
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

	const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

	/* ────── RENDER ────── */
	return (
		<div className="max-w-7xl mx-auto p-6 bg-white rounded-xl shadow border border-gray-200 text-sm font-sans">
			<div className="flex justify-between items-center mb-4">
				<h2 className={`text-xl font-bold ${maroon}`}>
					Price Variance Report
				</h2>
			</div>

			<div className="bg-gray-50 p-4 rounded-lg mb-4 border border-gray-200">
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
					{/* Year */}
					<div className="flex items-center gap-2">
						<label
							className={`text-xs font-bold ${maroon} whitespace-nowrap`}
						>
							Year:
						</label>
						<select
							value={repYear}
							onChange={(e) => setRepYear(e.target.value)}
							className="pl-3 pr-3 py-1.5 w-full rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#7A0000] transition text-sm"
						>
							<option value="">Select Year</option>
							{YEARS.map((y) => (
								<option key={y} value={y}>
									{y}
								</option>
							))}
						</select>
					</div>

					{/* Month */}
					<div className="flex items-center gap-2">
						<label
							className={`text-xs font-bold ${maroon} whitespace-nowrap`}
						>
							Month:
						</label>
						<select
							value={repMonth}
							onChange={(e) => setRepMonth(e.target.value)}
							className="pl-3 pr-3 py-1.5 w-full rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#7A0000] transition text-sm"
						>
							<option value="">Select Month</option>
							{MONTHS.map((m) => (
								<option key={m.value} value={m.value}>
									{m.label}
								</option>
							))}
						</select>
					</div>
				</div>

				<div className="flex justify-end mt-4">
					<button
						onClick={clearAll}
						className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm"
					>
						<RotateCcw className="w-3 h-3" /> Clear All
					</button>
				</div>
			</div>

			{/* ────── Cost Center List ────── */}
			<div className="flex flex-wrap gap-2 mb-4">
				<div className="relative">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
					<input
						type="text"
						value={searchId}
						placeholder="Search by ID"
						onChange={(e) => setSearchId(e.target.value)}
						className="pl-10 pr-3 py-1.5 w-40 rounded border border-gray-300 focus:ring-2 focus:ring-[#7A0000] text-sm"
					/>
				</div>
				<div className="relative">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
					<input
						type="text"
						value={searchName}
						placeholder="Search by Name"
						onChange={(e) => setSearchName(e.target.value)}
						className="pl-10 pr-3 py-1.5 w-40 rounded border border-gray-300 focus:ring-2 focus:ring-[#7A0000] text-sm"
					/>
				</div>
				{(searchId || searchName) && (
					<button
						onClick={clearFilters}
						className="flex items-center gap-1 px-3 py-1.5 border rounded bg-gray-100 hover:bg-gray-200 text-xs"
					>
						<RotateCcw className="w-3 h-3" /> Clear
					</button>
				)}
			</div>

			{deptLoading && (
				<div className="flex flex-col items-center justify-center py-12">
					<div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#7A0000]"></div>
					<p className="mt-3 text-gray-600 text-sm">
						Loading cost centers...
					</p>
				</div>
			)}

			{deptError && (
				<div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 text-sm">
					{deptError}
				</div>
			)}

			{!deptLoading && !deptError && filtered.length > 0 && (
				<>
					<div className="overflow-x-auto rounded-lg border border-gray-200">
						<div className="max-h-[50vh] overflow-y-auto">
							<table className="w-full table-fixed text-left text-xs md:text-sm">
								<thead
									className={`${maroonGrad} text-white sticky top-0`}
								>
									<tr>
										<th className="px-4 py-2 w-1/4">
											Cost Center Code
										</th>
										<th className="px-4 py-2 w-1/2">
											Cost Center Name
										</th>
										<th className="px-4 py-2 w-1/4 text-center">
											Action
										</th>
									</tr>
								</thead>
								<tbody>
									{paginated.map((dept, i) => (
										<tr
											key={i}
											className={i % 2 ? "bg-white" : "bg-gray-50"}
										>
											<td className="px-4 py-2 truncate">
												{dept.DeptId}
											</td>
											<td className="px-4 py-2 truncate">
												{dept.DeptName}
											</td>
											<td className="px-4 py-2 text-center">
												<button
													onClick={() => fetchReport(dept)}
													disabled={!repYear || !repMonth}
													className={`px-3 py-1 rounded text-xs font-medium hover:brightness-110 transition shadow disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 mx-auto
                            ${
											selectedDept?.DeptId === dept.DeptId &&
											reportLoading
												? "bg-green-600 text-white"
												: selectedDept?.DeptId === dept.DeptId
												? "bg-green-600 text-white"
												: `${maroonGrad} text-white`
										}`}
												>
													<Eye className="w-3 h-3" />
													{selectedDept?.DeptId === dept.DeptId &&
													reportLoading
														? "Viewing"
														: selectedDept?.DeptId === dept.DeptId
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

					<div className="flex justify-end items-center gap-3 mt-3">
						<button
							onClick={() => setPage((p) => Math.max(1, p - 1))}
							disabled={page === 1}
							className="px-3 py-1 border rounded bg-white text-gray-600 text-xs hover:bg-gray-100 disabled:opacity-40"
						>
							Previous
						</button>
						<span className="text-xs text-gray-600">
							Page {page} of {Math.ceil(filtered.length / PAGE_SIZE)}
						</span>
						<button
							onClick={() =>
								setPage((p) =>
									Math.min(
										Math.ceil(filtered.length / PAGE_SIZE),
										p + 1
									)
								)
							}
							disabled={page >= Math.ceil(filtered.length / PAGE_SIZE)}
							className="px-3 py-1 border rounded bg-white text-gray-600 text-xs hover:bg-gray-100 disabled:opacity-40"
						>
							Next
						</button>
					</div>
				</>
			)}

			{/* ────── REPORT MODAL ────── */}
			{showReport && selectedDept && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/90 print:static print:inset-auto print:p-0 print:bg-white">
					<div className="relative bg-white w-[95vw] sm:w-[90vw] md:w-[85vw] lg:w-[80vw] xl:w-[75vw] max-w-7xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden mt-20 md:mt-32 lg:mt-40 lg:ml-64 mx-auto print:relative print:w-full print:max-w-none print:rounded-none print:shadow-none print:border-none print:overflow-visible">
						{reportLoading && (
							<div className="absolute inset-0 bg-white/95 z-50 flex flex-col items-center justify-center gap-4">
								<div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#7A0000]"></div>
								<p className="text-xl font-bold text-[#7A0000]">
									Loading Report...
								</p>
								<p className="text-sm text-gray-600">
									Fetching price variance data from server
								</p>
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

								<h2
									className={`text-lg md:text-xl font-bold text-center md:mb-6 ${maroon}`}
								>
									Price Variance Report For {monthLabel} {repYear}
								</h2>
								<div className="flex justify-between text-sm mb-3 ml-5 mr-12">
									<div>
										<span className="font-bold">Cost Center:</span>{" "}
										{costCtrDisplay} / {cctName}
									</div>
									<div className="font-semibold text-gray-600">
										Currency : LKR
									</div>
								</div>

								<div className="ml-5 mt-1 mb-5 border border-gray-200 rounded-lg overflow-x-auto print:ml-12 print:mt-12 print:overflow-visible">
									<div className="min-w-[1200px]">
										<table className="w-full text-xs border-collapse">
											<thead className={`${maroonGrad} text-white`}>
												<tr>
													<th className="px-4 py-2 border border-gray-300" style={{width: "5%"}}>
														No
													</th>
													<th className="px-4 py-2 border border-gray-300" style={{width: "13%"}}>
														Material Code
													</th>
													<th className="px-4 py-2 border border-gray-300" style={{width: "11%"}}>
														Grade Code
													</th>
													<th className="px-4 py-2 border border-gray-300 text-right" style={{width: "12%"}}>
														Unit Price
													</th>
													<th className="px-4 py-2 border border-gray-300 text-right" style={{width: "12%"}}>
														New Price
													</th>
													<th className="px-4 py-2 border border-gray-300 text-right" style={{width: "12%"}}>
														Increase
													</th>
													<th className="px-4 py-2 border border-gray-300 text-right" style={{width: "12%"}}>
														Decrease
													</th>
													<th className="px-4 py-2 border border-gray-300 text-right" style={{width: "11%"}}>
														Qty On Hand
													</th>
													<th className="px-4 py-2 border border-gray-300 text-right" style={{width: "12%"}}>
														Variance
													</th>
												</tr>
											</thead>
											<tbody>
												{sortedData.map((it, i) => (
													<tr
														key={i}
														className={
															i % 2 === 0
																? "bg-white"
																: "bg-gray-50"
														}
													>
														<td className="px-4 py-2 border-l border-r border-gray-300 text-center">
															{i + 1}
														</td>
														<td className="px-4 py-2 font-mono text-center border-r border-gray-300">
															{it.MatCd || ""}
														</td>
														<td className="px-4 py-2 text-center border-r border-gray-300">
															{it.GradeCd || ""}
														</td>
														<td className="px-4 py-2 text-right font-mono border-r border-gray-300">
															{formatNumber(it.UnitPrice)}
														</td>
														<td className="px-4 py-2 text-right font-mono border-r border-gray-300">
															{formatNumber(it.NewPrice)}
														</td>
														<td className="px-4 py-2 text-right font-mono border-r border-gray-300">
															{formatNumber(it.INetChange)}
														</td>
														<td className="px-4 py-2 text-right font-mono border-r border-gray-300">
															{formatNumber(it.DNetChange)}
														</td>
														<td className="px-4 py-2 text-right font-mono border-r border-gray-300">
															{formatNumber(it.QtyOnHand)}
														</td>
														<td className="px-4 py-2 text-right font-mono border-r border-gray-300">
															{formatNumber(it.Var)}
														</td>
													</tr>
												))}
											</tbody>
											<tfoot>
												<tr className="bg-[#d3d3d3] font-bold">
													<td
														colSpan={5}
														className="px-4 py-2 text-right border border-gray-300"
													>
														Grand Total
													</td>
													<td className="px-4 py-2 text-right font-mono border border-gray-300">
														{formatNumber(grandTotalIncrease)}
													</td>
													<td className="px-4 py-2 text-right font-mono border border-gray-300">
														{formatNumber(grandTotalDecrease)}
													</td>
													<td className="px-4 py-2 border border-gray-300"></td>
													<td className="px-4 py-2 text-right font-mono border border-gray-300">
														{formatNumber(grandTotalVar)}
													</td>
												</tr>
											</tfoot>
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

export default PriceVarianceReport;