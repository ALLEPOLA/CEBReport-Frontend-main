import React, { useState, useEffect } from "react";
import { Download, Printer, X, RotateCcw, Eye, Search } from "lucide-react";
import { toast } from "react-toastify";
import { useUser } from "../../contexts/UserContext";

interface Department {
	DeptId: string;
	DeptName: string;
}

interface CCWiseIssueRow {
	type: string;
	yrInd: string;
	mthInd: string;
	trxType: string;
	trxDt: string;
	docPf: string;
	docNo: string;
	ref1: string;
	ref2: string;
	ref3: string;
	ref4: string;
	total: string;
	remarks: string;
	isRef: string;
	cctName: string;
}

/* ────── Constants ────── */
const PAGE_SIZE = 9;
const FETCH_TIMEOUT_MS = 30000;

/* ────── Helpers ────── */
const parseNumber = (value: any): number => {
	if (value === undefined || value === null || value === "") return 0;
	if (typeof value === "number") return value;
	const num = parseFloat(String(value).replace(/,/g, ""));
	return isNaN(num) ? 0 : num;
};

const displayType = (type: string) => type.replace(/^\d/, "");

const csvEscape = (val: string | number | null | undefined): string => {
	if (val == null) return "";
	const str = String(val);
	if (/[,\n"]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
	return str;
};

const MONTHS = [
	{ value: "1", label: "January" },
	{ value: "2", label: "February" },
	{ value: "3", label: "March" },
	{ value: "4", label: "April" },
	{ value: "5", label: "May" },
	{ value: "6", label: "June" },
	{ value: "7", label: "July" },
	{ value: "8", label: "August" },
	{ value: "9", label: "September" },
	{ value: "10", label: "October" },
	{ value: "11", label: "November" },
	{ value: "12", label: "December" },
];

/* ────── MAIN COMPONENT ────── */
const CCWiseIssue: React.FC = () => {
	const { user } = useUser();
	const epfNo = user?.Userno || "";

	const maroon = "text-[#7A0000]";
	const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";

	const currentYear = new Date().getFullYear();

	/* ── Cost Center list state ── */
	const [departments, setDepartments] = useState<Department[]>([]);
	const [filtered, setFiltered] = useState<Department[]>([]);
	const [searchId, setSearchId] = useState("");
	const [searchName, setSearchName] = useState("");
	const [page, setPage] = useState(1);
	const [deptLoading, setDeptLoading] = useState(true);
	const [deptError, setDeptError] = useState<string | null>(null);

	/* ── Report state ── */
	const [yearInput, setYearInput] = useState(String(currentYear));
	const [monthInput, setMonthInput] = useState(String(new Date().getMonth() + 1));
	const [selectedDept, setSelectedDept] = useState<Department | null>(null);
	const [reportData, setReportData] = useState<CCWiseIssueRow[]>([]);
	const [reportLoading, setReportLoading] = useState(false);
	const [showReport, setShowReport] = useState(false);
	const [, setReportError] = useState<string | null>(null);

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
		if (!yearInput) {
			toast.error("Please enter Year");
			return false;
		}
		if (!/^\d{4}$/.test(yearInput)) {
			toast.error("Year must be a 4-digit number.");
			return false;
		}
		if (!monthInput) {
			toast.error("Please select a month.");
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
		setReportError(null);

		try {
			const costCtrParam = encodeURIComponent(dept.DeptId);
			const url = `/misapi/api/ccwiseissue/report?repYear=${encodeURIComponent(yearInput)}&repMonth=${encodeURIComponent(monthInput)}&costCtr=${costCtrParam}`;

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

			const raw = json.data || [];
			if (!Array.isArray(raw) || raw.length === 0) {
				toast.warn("No records found for the selected criteria.");
				setShowReport(false);
				setSelectedDept(null);
				return;
			}

			const mappedRows: CCWiseIssueRow[] = raw.map((item: any) => ({
				type: String(item.Type ?? item.type ?? ""),
				yrInd: String(item.YrInd ?? item.yrInd ?? ""),
				mthInd: String(item.MthInd ?? item.mthInd ?? ""),
				trxType: String(item.TrxType ?? item.trxType ?? ""),
				trxDt: String(item.TrxDt ?? item.trxDt ?? ""),
				docPf: String(item.DocPf ?? item.docPf ?? ""),
				docNo: String(item.DocNo ?? item.docNo ?? ""),
				ref1: String(item.Ref1 ?? item.ref1 ?? ""),
				ref2: String(item.Ref2 ?? item.ref2 ?? ""),
				ref3: String(item.Ref3 ?? item.ref3 ?? ""),
				ref4: String(item.Ref4 ?? item.ref4 ?? ""),
				total: String(item.Total ?? item.total ?? "0.00"),
				remarks: String(item.Remarks ?? item.remarks ?? ""),
				isRef: String(item.IsRef ?? item.isRef ?? ""),
				cctName: String(item.CctName ?? item.cctName ?? ""),
			}));

			setReportData(mappedRows);
			toast.success(`${mappedRows.length} records loaded successfully.`);
		} catch (e: any) {
			if (e.name === "AbortError") {
				toast.error("Request timed out.");
			} else {
				const msg = e.message.includes("Failed to fetch")
					? "Server unreachable. Please check your connection."
					: e.message;
				toast.error(msg);
				setReportError(msg);
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
		setYearInput(String(currentYear));
		setMonthInput(String(new Date().getMonth() + 1));
		setSearchId("");
		setSearchName("");
		setShowReport(false);
		setReportData([]);
		setSelectedDept(null);
		setReportError(null);
		toast.info("Filters cleared.");
	};

	const closeReport = () => {
		setShowReport(false);
		setReportData([]);
		setSelectedDept(null);
		setReportLoading(false);
		setReportError(null);
	};

	const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

	/* ────── Derived totals ───────────────────────────────────────────────────────── */
	const totalAmount = reportData.reduce((s, r) => s + parseNumber(r.total), 0);
	const cctName = reportData.find((r) => r.cctName)?.cctName || selectedDept?.DeptName || "";
	const costCtrDisplay = selectedDept?.DeptId || "";

	/* ────── CSV download ────── */
	const downloadCSV = () => {
		if (reportData.length === 0) {
			toast.error("No data to export.");
			return;
		}

		const titleRows = [
			`C/C Wise Issue & Issue Cancellation`,
			`Cost Center: ${costCtrDisplay} | ${cctName}`,
			`Year: ${yearInput} | Month: ${MONTHS.find((m) => m.value === monthInput)?.label ?? monthInput}`,
			"",
		];

		const headers = [
			"Type",
			"Transaction Type",
			"Transaction Date",
			"Document Profile",
			"Document No",
			"Reference 1",
			"Reference 2",
			"Reference 3",
			"Reference 4",
			"Total",
			"Remarks",
			"Is Ref",
		];

		const rows = reportData.map((r) => [
			csvEscape(displayType(r.type)),
			csvEscape(r.trxType),
			csvEscape(r.trxDt),
			csvEscape(r.docPf),
			csvEscape(r.docNo),
			csvEscape(r.ref1),
			csvEscape(r.ref2),
			csvEscape(r.ref3),
			csvEscape(r.ref4),
			csvEscape(r.total),
			csvEscape(r.remarks),
			csvEscape(r.isRef),
		]);

		const csv = [
			...titleRows,
			headers.join(","),
			...rows.map((row) => row.join(",")),
			`Total,,,,,,,,,${csvEscape(totalAmount.toFixed(2))},,`,
		].join("\n");

		const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `CCWiseIssue_${costCtrDisplay}_${yearInput}_${monthInput}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	};

	/* ────── PDF print ────── */
	const printPDF = () => {
		if (reportData.length === 0) {
			toast.error("No data to export.");
			return;
		}

		let rows = "";
		reportData.forEach((r, i) => {
			rows += `
          <tr class="${i % 2 ? "bg-white" : "bg-gray-50"}">
            <td class="px-3 py-2 border-l border-r border-gray-300 text-center text-xs">${displayType(r.type)}</td>
            <td class="px-3 py-2 border-r border-gray-300 text-center text-xs">${r.trxType}</td>
            <td class="px-3 py-2 border-r border-gray-300 text-center text-xs font-mono">${r.trxDt}</td>
            <td class="px-3 py-2 border-r border-gray-300 text-center text-xs font-mono">${r.docPf}</td>
            <td class="px-3 py-2 border-r border-gray-300 text-center text-xs font-mono">${r.docNo}</td>
            <td class="px-3 py-2 border-r border-gray-300 text-center text-xs font-mono">${r.ref1}</td>
            <td class="px-3 py-2 border-r border-gray-300 text-center text-xs font-mono">${r.ref2}</td>
            <td class="px-3 py-2 border-r border-gray-300 text-center text-xs font-mono">${r.ref3}</td>
            <td class="px-3 py-2 border-r border-gray-300 text-center text-xs font-mono">${r.ref4}</td>
            <td class="px-3 py-2 border-r border-gray-300 text-right text-xs font-mono">${parseNumber(r.total).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
            <td class="px-3 py-2 border-r border-gray-300 text-left text-xs break-words">${r.remarks}</td>
            <td class="px-3 py-2 border-r border-gray-300 text-center text-xs font-mono">${r.isRef}</td>
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
      .font-mono { font-family:monospace; }
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
  <div class="title">C/C Wise Issue & Issue Cancellation</div>
  <div class="info">
    <div><strong>Cost Center:</strong> ${costCtrDisplay} / ${cctName}</div>
    <div style="font-weight:600; color:#4B5563;">Year: ${yearInput} | Month: ${MONTHS.find((m) => m.value === monthInput)?.label ?? monthInput}</div>
  </div>
  <table style="width:100%; border-collapse:collapse; font-size:8.5px; border:1px solid #d1d5db;">
    <thead>
      <tr style="background:linear-gradient(to right,#7A0000,#A52A2A); color:white;">
        <th style="padding:6px 8px; width:6%;">Type</th>
        <th style="padding:6px 8px; width:8%;">Transaction Type</th>
        <th style="padding:6px 8px; width:8%;">Transaction Date</th>
        <th style="padding:6px 8px; width:7%;">Document Profile</th>
        <th style="padding:6px 8px; width:9%;">Document No</th>
        <th style="padding:6px 8px; width:8%;">Reference 1</th>
        <th style="padding:6px 8px; width:8%;">Reference 2</th>
        <th style="padding:6px 8px; width:8%;">Reference 3</th>
        <th style="padding:6px 8px; width:8%;">Reference 4</th>
        <th style="padding:6px 8px; width:10%; text-align:right;">Total</th>
        <th style="padding:6px 8px; width:12%;">Remarks</th>
        <th style="padding:6px 8px; width:8%;">Is Ref</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr>
        <td colspan="9" style="text-align:right; padding:6px 8px; border:1px solid #d1d5db;">Total</td>
        <td style="text-align:right; padding:6px 8px; border:1px solid #d1d5db; font-family:monospace; font-weight:bold;">${totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
        <td colspan="2" style="padding:6px 8px; border:1px solid #d1d5db;"></td>
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

	/* ────── RENDER ────── */
	return (
		<div className="max-w-7xl mx-auto p-6 bg-white rounded-xl shadow border border-gray-200 text-sm font-sans">
			<div className="flex justify-between items-center mb-4">
				<h2 className={`text-xl font-bold ${maroon}`}>
					C/C Wise Issue & Issue Cancellation
				</h2>
			</div>

			<div className="bg-gray-50 p-4 rounded-lg mb-4 border border-gray-200">
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
					{/* Year */}
					<div className="flex items-center gap-2">
						<label
							className={`text-xs font-bold ${maroon} whitespace-nowrap`}
						>
							Year: <span className="text-red-600">*</span>
						</label>
						<input
							type="text"
							value={yearInput}
							onChange={(e) => {
								setYearInput(e.target.value);
								setReportError(null);
							}}
							placeholder="e.g. 2022"
							maxLength={4}
							className="pl-3 pr-3 py-1.5 w-full rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#7A0000] transition text-sm"
						/>
					</div>

					{/* Month */}
					<div className="flex items-center gap-2">
						<label
							className={`text-xs font-bold ${maroon} whitespace-nowrap`}
						>
							Month: <span className="text-red-600">*</span>
						</label>
						<select
							value={monthInput}
							onChange={(e) => {
								setMonthInput(e.target.value);
								setReportError(null);
							}}
							className="pl-3 pr-3 py-1.5 w-full rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#7A0000] transition text-sm"
						>
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
													disabled={!yearInput || !monthInput}
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
									Fetching issue details from server
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
									C/C Wise Issue & Issue Cancellation 
								</h2>
								<div className="flex justify-between text-sm mb-3 ml-5 mr-12">
									<div>
										<span className="font-bold">Cost Center:</span>{" "}
										{costCtrDisplay} / {cctName}
									</div>
									<div className="font-semibold text-gray-600">
										Year: {yearInput} | Month: {MONTHS.find((m) => m.value === monthInput)?.label ?? monthInput}
									</div>
								</div>

								<div className="ml-5 mt-1 mb-5 border border-gray-200 rounded-lg overflow-x-auto print:ml-12 print:mt-12 print:overflow-visible">
									<div className="min-w-[1400px]">
										<table className="w-full text-xs border-collapse">
											<thead className={`${maroonGrad} text-white`}>
												<tr>
													<th className="px-4 py-2 border border-gray-300" style={{ width: "6%" }}>
														Type
													</th>
													<th className="px-4 py-2 border border-gray-300" style={{ width: "8%" }}>
														Transaction Type
													</th>
													<th className="px-4 py-2 border border-gray-300" style={{ width: "8%" }}>
														Transaction Date
													</th>
													<th className="px-4 py-2 border border-gray-300" style={{ width: "7%" }}>
														Document Profile
													</th>
													<th className="px-4 py-2 border border-gray-300" style={{ width: "9%" }}>
														Document No
													</th>
													<th className="px-4 py-2 border border-gray-300" style={{ width: "8%" }}>
														Reference 1
													</th>
													<th className="px-4 py-2 border border-gray-300" style={{ width: "8%" }}>
														Reference 2
													</th>
													<th className="px-4 py-2 border border-gray-300" style={{ width: "8%" }}>
														Reference 3
													</th>
													<th className="px-4 py-2 border border-gray-300" style={{ width: "8%" }}>
														Reference 4
													</th>
													<th className="px-4 py-2 border border-gray-300 text-right" style={{ width: "10%" }}>
														Total
													</th>
													<th className="px-4 py-2 border border-gray-300" style={{ width: "12%" }}>
														Remarks
													</th>
													<th className="px-4 py-2 border border-gray-300" style={{ width: "8%" }}>
														Is Ref
													</th>
												</tr>
											</thead>
											<tbody>
												{reportData.map((r, i) => (
													<tr
														key={`${r.docNo}-${i}`}
														className={
															i % 2 === 0
																? "bg-white"
																: "bg-gray-50"
														}
													>
														<td className="px-4 py-2 border-l border-r border-gray-300 text-center">
															{displayType(r.type)}
														</td>
														<td className="px-4 py-2 text-center border-r border-gray-300">
															{r.trxType}
														</td>
														<td className="px-4 py-2 text-center font-mono border-r border-gray-300">
															{r.trxDt}
														</td>
														<td className="px-4 py-2 text-center font-mono border-r border-gray-300">
															{r.docPf}
														</td>
														<td className="px-4 py-2 text-center font-mono border-r border-gray-300">
															{r.docNo}
														</td>
														<td className="px-4 py-2 text-center font-mono border-r border-gray-300">
															{r.ref1}
														</td>
														<td className="px-4 py-2 text-center font-mono border-r border-gray-300">
															{r.ref2}
														</td>
														<td className="px-4 py-2 text-center font-mono border-r border-gray-300">
															{r.ref3}
														</td>
														<td className="px-4 py-2 text-center font-mono border-r border-gray-300">
															{r.ref4}
														</td>
														<td className="px-4 py-2 text-right font-mono border-r border-gray-300">
															{parseNumber(r.total).toLocaleString("en-US", { minimumFractionDigits: 2 })}
														</td>
														<td className="px-4 py-2 border-r border-gray-300 break-words">
															{r.remarks}
														</td>
														<td className="px-4 py-2 text-center font-mono border-r border-gray-300">
															{r.isRef}
														</td>
													</tr>
												))}
											</tbody>
											<tfoot>
												<tr className="bg-[#d3d3d3] font-bold">
													<td
														colSpan={9}
														className="px-4 py-2 text-right border border-gray-300"
													>
														TOTAL
													</td>
													<td className="px-4 py-2 text-right font-mono border border-gray-300">
														{totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
													</td>
													<td
														colSpan={2}
														className="px-4 py-2 border border-gray-300"
													></td>
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

export default CCWiseIssue;