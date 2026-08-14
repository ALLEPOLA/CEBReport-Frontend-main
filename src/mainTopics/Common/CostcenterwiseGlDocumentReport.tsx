// CostCenterWiseGLDocumentReport.tsx
import React, {useEffect, useState} from "react";
import {Download, Printer, X, RotateCcw, Eye, Search} from "lucide-react";
import {toast} from "react-toastify";
import {useUser} from "../../contexts/UserContext";

interface Department {
	DeptId: string;
	DeptName: string;
}

interface GLDocItem {
	Category: string | null;
	DocNo: string | null;
	DocPf: string | null;
	DrAmt: number | null;
	CrAmt: number | null;
	GlCd: string | null;
	SubAc: string | null;
	Remarks: string | null;
	TrxVal: number | null;
	TranStatus: string | null;
}

/* ────── Constants ────── */
const MAX_RECORDS = 5000;
const FETCH_TIMEOUT_MS = 120000;
const PAGE_SIZE = 9;

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

const parseApiResponse = (response: any): any[] => {
	if (Array.isArray(response)) return response;
	if (response.data && Array.isArray(response.data)) return response.data;
	if (response.result && Array.isArray(response.result)) return response.result;
	if (response.departments && Array.isArray(response.departments)) return response.departments;
	if (response.Data && Array.isArray(response.Data)) return response.Data;
	console.warn("Unexpected API response format:", response);
	return [];
};

const today = new Date();
const currentYear = today.getFullYear();
const currentMonth = String(today.getMonth() + 1).padStart(2, "0");
const currentDay = String(today.getDate()).padStart(2, "0");
const maxDate = `${currentYear}-${currentMonth}-${currentDay}`;

const minYear = currentYear - 20;
const minDate = `${minYear}-${currentMonth}-${currentDay}`;

/* ────── MAIN COMPONENT ────── */
const CostCenterWiseGLDocumentReport: React.FC = () => {
	const {user} = useUser();
	const epfNo = user?.Userno || "";

	const maroon = "text-[#7A0000]";
	const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";

	/* ── Cost Center list state ── */
	const [departments, setDepartments] = useState<Department[]>([]);
	const [filtered, setFiltered] = useState<Department[]>([]);
	const [searchId, setSearchId] = useState("");
	const [searchName, setSearchName] = useState("");
	const [page, setPage] = useState(1);
	const [deptLoading, setDeptLoading] = useState(true);
	const [deptError, setDeptError] = useState<string | null>(null);

	const [selectedDept, setSelectedDept] = useState<Department | null>(null);

	/* ── Other filter state ── */
	const [fromDate, setFromDate] = useState("");
	const [toDate, setToDate] = useState("");

	/* ── Report state ── */
	const [reportData, setReportData] = useState<GLDocItem[]>([]);
	const [reportLoading, setReportLoading] = useState(false);
	const [showReport, setShowReport] = useState(false);

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
				const raw = parseApiResponse(json);
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
		if (!selectedDept) {
			toast.error("Please select a cost center.");
			return false;
		}
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

	/* ────── Fetch report ────── */
	const fetchReport = async () => {
		if (!validateInputs()) return;

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

		setReportLoading(true);
		setReportData([]);
		setShowReport(true);

		try {
			const costCtrParam = encodeURIComponent(selectedDept!.DeptId);
			const url = `/misapi/api/costcenterwisegldocument/report/${fromDate}/${toDate}/${costCtrParam}`;

			const res = await fetch(url, {credentials: "include", signal: controller.signal});
			clearTimeout(timeoutId);

			if (!res.ok) {
				const txt = await res.text();
				throw new Error(`HTTP ${res.status}: ${txt}`);
			}

			const json = await res.json();
			if (!json.success) throw new Error(json.message || "Failed to load data");

			const items: GLDocItem[] = json.data || [];
			if (items.length > MAX_RECORDS)
				throw new Error(`Too many records (${items.length}). Please refine your search.`);

			if (items.length === 0) {
				toast.warn("No records found for the selected criteria.");
				setShowReport(false);
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
		} finally {
			setReportLoading(false);
		}
	};

	const clearFilters = () => {
		setSearchId("");
		setSearchName("");
	};

	const clearAll = () => {
		setSelectedDept(null);
		setFromDate("");
		setToDate("");
		setSearchId("");
		setSearchName("");
		setShowReport(false);
		setReportData([]);
		toast.info("Filters cleared.");
	};

	const closeReport = () => {
		setShowReport(false);
		setReportData([]);
		setReportLoading(false);
	};

	/* ────── Sorted per SQL: ORDER BY 2,1,3,4 (doc_no, category, doc_pf, doc_dt) ────── */
	const sortedData = [...reportData].sort(
		(a, b) =>
			(a.DocNo || "").localeCompare(b.DocNo || "") ||
			(a.Category || "").localeCompare(b.Category || "") ||
			(a.DocPf || "").localeCompare(b.DocPf || "")
	);

	const costCtrDisplay = selectedDept?.DeptId || "";
	const deptName = selectedDept?.DeptName || "";

	/* ────── CSV download ────── */
	const downloadCSV = () => {
		if (reportData.length === 0) return;

		const titleRows = [
			`General Ledger Transactions Inquiry Report From ${fromDate} To ${toDate}`,
			`Cost Center: ${costCtrDisplay}/${deptName}`,
			"",
		];

		const headers = [
			"Category",
			"Document No.",
			"Type",
			"Transaction Ledger Code",
			"Total Amount",
			"Dr Amount",
			"Cr Amount",
			"Status",
			"Sub",
			"Remarks",
		];
		const rows: string[] = [headers.join(",")];

		sortedData.forEach((it) => {
			rows.push(
				[
					csvEscape(it.Category),
					csvEscape(it.DocNo),
					csvEscape(it.DocPf),
					csvEscape(it.GlCd),
					csvEscape(formatNumber(it.TrxVal)),
					csvEscape(formatNumber(it.DrAmt)),
					csvEscape(formatNumber(it.CrAmt)),
					csvEscape(it.TranStatus),
					csvEscape(it.SubAc),
					csvEscape(it.Remarks),
				].join(",")
			);
		});

		const csv = [...titleRows, ...rows].join("\n");
		const blob = new Blob([csv], {type: "text/csv;charset=utf-8;"});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `CostCenterWiseGLDocument_${costCtrDisplay}_${fromDate}_${toDate}.csv`;
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
            <td class="px-2 py-2 border-l border-r border-gray-300 text-left text-xs">${it.Category || ""}</td>
            <td class="px-2 py-2 border-r border-gray-300 text-left text-xs font-mono">${it.DocNo || ""}</td>
            <td class="px-2 py-2 border-r border-gray-300 text-left text-xs">${it.DocPf || ""}</td>
            <td class="px-2 py-2 border-r border-gray-300 text-left text-xs font-mono">${it.GlCd || ""}</td>
            <td class="px-2 py-2 border-r border-gray-300 text-right text-xs font-mono">${formatNumber(
					it.TrxVal
				)}</td>
            <td class="px-2 py-2 border-r border-gray-300 text-right text-xs font-mono">${formatNumber(
					it.DrAmt
				)}</td>
            <td class="px-2 py-2 border-r border-gray-300 text-right text-xs font-mono">${formatNumber(
					it.CrAmt
				)}</td>
            <td class="px-2 py-2 border-r border-gray-300 text-left text-xs">${it.TranStatus || ""}</td>
            <td class="px-2 py-2 border-r border-gray-300 text-left text-xs">${it.SubAc || ""}</td>
            <td class="px-2 py-2 border-r border-gray-300 text-left text-xs">${it.Remarks || ""}</td>
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
  <div class="title">General Ledger Transactions Inquiry Report From ${fromDate} To ${toDate}</div>
  <div class="info">
    <div><strong>Cost Center:</strong> ${costCtrDisplay}/${deptName}</div>
  </div>
  <table style="width:100%; border-collapse:collapse; font-size:8px; border:1px solid #d1d5db;">
    <thead>
      <tr style="background:linear-gradient(to right,#7A0000,#A52A2A); color:white;">
        <th style="padding:5px 6px; width:14%;">Category</th>
        <th style="padding:5px 6px; width:10%;">Document No.</th>
        <th style="padding:5px 6px; width:8%;">Type</th>
        <th style="padding:5px 6px; width:12%;">Transaction Ledger Code</th>
        <th style="padding:5px 6px; width:10%; text-align:right;">Total Amount</th>
        <th style="padding:5px 6px; width:9%; text-align:right;">Dr Amount</th>
        <th style="padding:5px 6px; width:9%; text-align:right;">Cr Amount</th>
        <th style="padding:5px 6px; width:10%;">Status</th>
        <th style="padding:5px 6px; width:8%;">Sub</th>
        <th style="padding:5px 6px; width:10%;">Remarks</th>
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

	const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

	/* ────── RENDER ────── */
	return (
		<div className="max-w-7xl mx-auto p-6 bg-white rounded-xl shadow border border-gray-200 text-sm font-sans">
			<div className="flex justify-between items-center mb-4">
				<h2 className={`text-xl font-bold ${maroon}`}>Cost Center Wise GL Document Inquiry</h2>
			</div>

			<div className="bg-gray-50 p-4 rounded-lg mb-4 border border-gray-200">
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end mb-4">
					<div className="flex items-center gap-2">
						<label className={`text-xs font-bold ${maroon} whitespace-nowrap`}>
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
					<div className="flex items-center gap-2">
						<label className={`text-xs font-bold ${maroon} whitespace-nowrap`}>
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

				<div className="flex flex-col md:flex-row flex-wrap gap-4 items-end">
					<button
						onClick={fetchReport}
						disabled={!selectedDept || !fromDate || !toDate}
						className={`px-3 py-1.5 ${maroonGrad} text-white rounded-md text-sm font-medium hover:brightness-110 transition shadow disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1`}
					>
						<Eye className="w-3 h-3" /> View
					</button>
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
					<p className="mt-3 text-gray-600 text-sm">Loading cost centers...</p>
				</div>
			)}

			{deptError && (
				<div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 text-sm">
					{deptError}
				</div>
			)}

			{!deptLoading && !deptError && filtered.length > 0 && (
				<>
					<p className="text-xs text-gray-500 mb-2">
						Select a cost center below, then fill in the date range above and click View.
					</p>
					<div className="overflow-x-auto rounded-lg border border-gray-200">
						<div className="max-h-[50vh] overflow-y-auto">
							<table className="w-full table-fixed text-left text-xs md:text-sm">
								<thead className={`${maroonGrad} text-white sticky top-0`}>
									<tr>
										<th className="px-4 py-2 w-1/2">Cost Center Code</th>
										<th className="px-4 py-2 w-1/2">Cost Center Name</th>
									</tr>
								</thead>
								<tbody>
									{paginated.map((dept, i) => (
										<tr
											key={i}
											onClick={() => setSelectedDept(dept)}
											className={`cursor-pointer ${
												selectedDept?.DeptId === dept.DeptId
													? "bg-[#7A0000] text-white"
													: i % 2
													? "bg-white hover:bg-gray-100"
													: "bg-gray-50 hover:bg-gray-100"
											}`}
										>
											<td className="px-4 py-2 truncate">{dept.DeptId}</td>
											<td className="px-4 py-2 truncate">{dept.DeptName}</td>
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
								setPage((p) => Math.min(Math.ceil(filtered.length / PAGE_SIZE), p + 1))
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
								<p className="text-xl font-bold text-[#7A0000]">Loading Report...</p>
								<p className="text-sm text-gray-600">Fetching GL document data from server</p>
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
									General Ledger Transactions Inquiry Report From {fromDate} To {toDate}
								</h2>
								<div className="text-sm mb-3 ml-5 mr-12">
									<span className="font-bold">Cost Center:</span> {costCtrDisplay}/{deptName}
								</div>

								<div className="ml-5 mt-1 mb-5 border border-gray-200 rounded-lg overflow-x-auto print:ml-12 print:mt-12 print:overflow-visible">
									<div className="min-w-[1200px]">
										<table className="w-full text-xs border-collapse">
											<thead className={`${maroonGrad} text-white`}>
												<tr>
													<th className="px-2 py-2 border border-gray-300" style={{width: "14%"}}>
														Category
													</th>
													<th className="px-2 py-2 border border-gray-300" style={{width: "10%"}}>
														Document No.
													</th>
													<th className="px-2 py-2 border border-gray-300" style={{width: "8%"}}>
														Type
													</th>
													<th className="px-2 py-2 border border-gray-300" style={{width: "12%"}}>
														Transaction Ledger Code
													</th>
													<th className="px-2 py-2 border border-gray-300 text-right" style={{width: "10%"}}>
														Total Amount
													</th>
													<th className="px-2 py-2 border border-gray-300 text-right" style={{width: "9%"}}>
														Dr Amount
													</th>
													<th className="px-2 py-2 border border-gray-300 text-right" style={{width: "9%"}}>
														Cr Amount
													</th>
													<th className="px-2 py-2 border border-gray-300" style={{width: "10%"}}>
														Status
													</th>
													<th className="px-2 py-2 border border-gray-300" style={{width: "8%"}}>
														Sub
													</th>
													<th className="px-2 py-2 border border-gray-300" style={{width: "10%"}}>
														Remarks
													</th>
												</tr>
											</thead>
											<tbody>
												{sortedData.map((it, i) => (
													<tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
														<td className="px-2 py-2 border-l border-r border-gray-300">
															{it.Category || ""}
														</td>
														<td className="px-2 py-2 font-mono border-r border-gray-300">
															{it.DocNo || ""}
														</td>
														<td className="px-2 py-2 border-r border-gray-300">{it.DocPf || ""}</td>
														<td className="px-2 py-2 font-mono border-r border-gray-300">
															{it.GlCd || ""}
														</td>
														<td className="px-2 py-2 text-right font-mono border-r border-gray-300">
															{formatNumber(it.TrxVal)}
														</td>
														<td className="px-2 py-2 text-right font-mono border-r border-gray-300">
															{formatNumber(it.DrAmt)}
														</td>
														<td className="px-2 py-2 text-right font-mono border-r border-gray-300">
															{formatNumber(it.CrAmt)}
														</td>
														<td className="px-2 py-2 border-r border-gray-300">
															{it.TranStatus || ""}
														</td>
														<td className="px-2 py-2 border-r border-gray-300">{it.SubAc || ""}</td>
														<td className="px-2 py-2 border-r border-gray-300">{it.Remarks || ""}</td>
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

export default CostCenterWiseGLDocumentReport;