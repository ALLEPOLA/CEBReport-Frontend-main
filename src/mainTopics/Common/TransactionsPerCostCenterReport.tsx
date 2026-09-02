// TransactionsPerCostCenterReport.tsx
import React, {useEffect, useState} from "react";
import {Download, Printer, X, RotateCcw, Eye, Search} from "lucide-react";
import {toast} from "react-toastify";
import {useUser} from "../../contexts/UserContext";

interface Department {
	DeptId: string;
	DeptName: string;
}

interface TransactionsPerCostCenterItem {
	Category: string | null;
	EnteredDate: string | null;
	Count: number;
	BranchName: string | null;
}

/* ────── Constants ────── */
const MAX_RECORDS = 5000;
const FETCH_TIMEOUT_MS = 120000;
const PAGE_SIZE = 9;

/* ────── Formatting helpers ────── */
const formatDate = (dateStr: string | null): string => {
	if (!dateStr) return "";
	const d = new Date(dateStr);
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

/* ────── MAIN COMPONENT ────── */
const TransactionsPerCostCenterReport: React.FC = () => {
	const {user} = useUser();
	const epfNo = user?.Userno || "";

	/* ── Cost center list state ── */
	const [departments, setDepartments] = useState<Department[]>([]);
	const [filtered, setFiltered] = useState<Department[]>([]);
	const [searchId, setSearchId] = useState("");
	const [searchName, setSearchName] = useState("");
	const [page, setPage] = useState(1);
	const [deptLoading, setDeptLoading] = useState(true);
	const [deptError, setDeptError] = useState<string | null>(null);

	/* ── Report state ── */
	const [fromDate, setFromDate] = useState("");
	const [toDate, setToDate] = useState("");
	const [selectedDept, setSelectedDept] = useState<Department | null>(null);
	const [reportData, setReportData] = useState<TransactionsPerCostCenterItem[]>([]);
	const [reportLoading, setReportLoading] = useState(false);
	const [showReport, setShowReport] = useState(false);

	const maroon = "text-[#7A0000]";
	const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";

	/* ────── Fetch Cost Centers (Departments) ────── */
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
		if (!fromDate) {
			toast.error("Please select 'From Date'");
			return false;
		}
		if (!toDate) {
			toast.error("Please select 'To Date'");
			return false;
		}
		if (new Date(toDate) < new Date(fromDate)) {
			toast.error("'To Date' cannot be earlier than 'From Date'");
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
			const url = `/misapi/api/transactionspercostcenter/report/${fromDate}/${toDate}/${costCtrParam}`;

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

			const items: TransactionsPerCostCenterItem[] = json.data || [];
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
		setFromDate("");
		setToDate("");
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

	/* ────── Single flat table, matches ORDER BY category,date ────── */
	const sortedData = [...reportData].sort(
		(a, b) =>
			(a.Category || "").localeCompare(b.Category || "") ||
			(a.EnteredDate || "").localeCompare(b.EnteredDate || "")
	);

	const grandTotalCount = reportData.reduce((s, r) => s + (r.Count || 0), 0);
	const costCenterName =
		reportData.find((r) => r.BranchName)?.BranchName || selectedDept?.DeptName || "";
	const costCenterDisplay = selectedDept?.DeptId || "";

	/* ────── CSV download ────── */
	const downloadCSV = () => {
		if (reportData.length === 0) return;

		const titleRows = [
			`Entered Transactions from ${fromDate} To ${toDate}`,
			`Cost Center : ${costCenterDisplay}/${costCenterName}`,
			"",
		];

		const headers = ["No", "Category", "Transaction Date", "No of Volume"];
		const rows: string[] = [headers.join(",")];

		sortedData.forEach((it, i) => {
			rows.push(
				[
					csvEscape(i + 1),
					csvEscape(it.Category),
					csvEscape(formatDate(it.EnteredDate)),
					csvEscape(it.Count),
				].join(",")
			);
		});

		rows.push(`Total,,,${csvEscape(grandTotalCount)}`);

		const csv = [...titleRows, ...rows].join("\n");
		const blob = new Blob([csv], {type: "text/csv;charset=utf-8;"});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `TransactionsPerCostCenter_${fromDate}_${toDate}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	};

	/* ────── PDF print ────── */
	const printPDF = () => {
		if (reportData.length === 0) return;

		let rows = "";
		sortedData.forEach((it, i) => {
			rows += `
          <tr class="${i % 2 ? "bg-white" : "bg-gray-50"}">
            <td class="px-3 py-2 border-l border-r border-gray-300 text-center text-xs">${
					i + 1
				}</td>
            <td class="px-3 py-2 border-r border-gray-300 text-left text-xs">${
					it.Category || ""
				}</td>
            <td class="px-3 py-2 border-r border-gray-300 text-center text-xs">${formatDate(
					it.EnteredDate
				)}</td>
            <td class="px-3 py-2 border-r border-gray-300 text-right text-xs font-mono">${
					it.Count
				}</td>
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
      .info { margin:6px 8px; font-size:9px; }
      table { border-collapse:collapse; width:100%; font-size:9px; }
      th, td { border:1px solid #d1d5db; padding:6px 8px; word-wrap:break-word; }
      th { background:linear-gradient(to right,#7A0000,#A52A2A); color:white; text-align:center; font-weight:bold; }
      tfoot td { background:#d3d3d3; font-weight:bold; }
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
  <div class="title">Entered Transactions from ${fromDate} To ${toDate}</div>
  <div class="info">
    <div><strong>Cost Center :</strong> ${costCenterDisplay}/${costCenterName}</div>
  </div>
  <table style="width:100%; border-collapse:collapse; font-size:9px; border:1px solid #d1d5db;">
    <thead>
      <tr style="background:linear-gradient(to right,#7A0000,#A52A2A); color:white;">
        <th style="padding:6px 8px; width:8%;">No</th>
        <th style="padding:6px 8px; width:40%;">Category</th>
        <th style="padding:6px 8px; width:26%;">Transaction Date</th>
        <th style="padding:6px 8px; width:26%; text-align:right;">No of Volume</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr>
        <td colspan="3" style="text-align:right; padding:6px 8px; border:1px solid #d1d5db;">Total</td>
        <td style="text-align:right; padding:6px 8px; border:1px solid #d1d5db; font-family:monospace;">${grandTotalCount}</td>
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
					No of Transactions per Cost Center
				</h2>
			</div>

			<div className="bg-gray-50 p-4 rounded-lg mb-4 border border-gray-200">
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
					{/* From Date */}
					<div className="flex items-center gap-2">
						<label
							className={`text-xs font-bold ${maroon} whitespace-nowrap`}
						>
							From Date:
						</label>
						<input
							type="date"
							value={fromDate}
							onChange={(e) => setFromDate(e.target.value)}
							min={minDate}
							max={maxDate}
							className="pl-3 pr-3 py-1.5 w-full rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#7A0000] transition text-sm"
						/>
					</div>

					{/* To Date */}
					<div className="flex items-center gap-2">
						<label
							className={`text-xs font-bold ${maroon} whitespace-nowrap`}
						>
							To Date:
						</label>
						<input
							type="date"
							value={toDate}
							onChange={(e) => setToDate(e.target.value)}
							min={minDate}
							max={maxDate}
							className="pl-3 pr-3 py-1.5 w-full rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#7A0000] transition text-sm"
						/>
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
													disabled={!fromDate || !toDate}
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
					<div className="relative bg-white w-[95vw] sm:w-[85vw] md:w-[75vw] lg:w-[65vw] xl:w-[55vw] max-w-4xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden mt-20 md:mt-32 lg:mt-40 lg:ml-64 mx-auto print:relative print:w-full print:max-w-none print:rounded-none print:shadow-none print:border-none print:overflow-visible">
						{reportLoading && (
							<div className="absolute inset-0 bg-white/95 z-50 flex flex-col items-center justify-center gap-4">
								<div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#7A0000]"></div>
								<p className="text-xl font-bold text-[#7A0000]">
									Loading Report...
								</p>
								<p className="text-sm text-gray-600">
									Counting transactions from server
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
									className={`text-lg md:text-xl font-bold text-center md:mb-2 ${maroon}`}
								>
									Entered Transactions from {fromDate} To {toDate}
								</h2>
								<div className="text-sm mb-3 ml-5 mr-12">
									<span className="font-bold">Cost Center :</span>{" "}
									{costCenterDisplay}/{costCenterName}
								</div>

								<div className="ml-5 mt-1 mb-5 border border-gray-200 rounded-lg overflow-x-auto print:ml-12 print:mt-12 print:overflow-visible">
									<div className="min-w-[500px]">
										<table className="w-full text-xs border-collapse">
											<thead className={`${maroonGrad} text-white`}>
												<tr>
													<th className="px-4 py-2 border border-gray-300" style={{width: "8%"}}>
														No
													</th>
													<th className="px-4 py-2 border border-gray-300" style={{width: "40%"}}>
														Category
													</th>
													<th className="px-4 py-2 border border-gray-300" style={{width: "26%"}}>
														Transaction Date
													</th>
													<th className="px-4 py-2 border border-gray-300 text-right" style={{width: "26%"}}>
														No of Volume
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
														<td className="px-4 py-2 border-r border-gray-300">
															{it.Category || ""}
														</td>
														<td className="px-4 py-2 text-center border-r border-gray-300">
															{formatDate(it.EnteredDate)}
														</td>
														<td className="px-4 py-2 text-right font-mono border-r border-gray-300">
															{it.Count}
														</td>
													</tr>
												))}
											</tbody>
											<tfoot>
												<tr className="bg-[#d3d3d3] font-bold">
													<td
														colSpan={3}
														className="px-4 py-2 text-right border border-gray-300"
													>
														Total
													</td>
													<td className="px-4 py-2 text-right font-mono border border-gray-300">
														{grandTotalCount}
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

export default TransactionsPerCostCenterReport;