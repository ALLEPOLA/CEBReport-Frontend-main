// ConstructionCompletedReport.tsx
import React, {useEffect, useState} from "react";
import {Download, Printer, X, RotateCcw, Eye, Search} from "lucide-react";
import {toast} from "react-toastify";
import {useUser} from "../../contexts/UserContext";

interface Department {
	DeptId: string;
	DeptName: string;
}

interface ConstructionItem {
	District: string | null;
	ServiceDepoName: string | null;
	Electorate: string | null;
	Descr: string | null;
	StdCost: number | null;
	CPercentage: number | null;
	Wp: number | null;
	ProjectNo: string | null;
	FileNo: string | null;
	Remarks: string | null;
	CompDate: string | null;
	CctName: string | null;
}

interface ReportSummary {
	totalRecords: number;
	totalStdCost: number;
	totalWp: number;
	completedJobs: number;
	inProgressJobs: number;
}

/* ────── Constants ────── */
const MAX_RECORDS = 5000;
const FETCH_TIMEOUT_MS = 120000;
const PAGE_SIZE = 9;
const ALL_OPTION = "ALL";

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

const formatPercent = (num: number | string | null | undefined): string => {
	const n = num === null || num === undefined ? NaN : Number(num);
	if (isNaN(n)) return "";
	return `${n.toFixed(2)}%`;
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

const parseApiResponse = (response: any): any[] => {
	if (Array.isArray(response)) return response;
	if (response.data && Array.isArray(response.data)) return response.data;
	if (response.result && Array.isArray(response.result)) return response.result;
	if (response.departments && Array.isArray(response.departments)) return response.departments;
	if (response.Data && Array.isArray(response.Data)) return response.Data;
	console.warn("Unexpected API response format:", response);
	return [];
};

/* ────── MAIN COMPONENT ────── */
const ConstructionCompletedReport: React.FC = () => {
	const {user} = useUser();
	const epfNo = user?.Userno || "";
	// NOTE: assumes a role id is exposed on the user context as `RoleId`.
	// Confirm the real property name before relying on this in production —
	// the district dropdown will just come back empty if this is wrong.
	const roleId = (user as any)?.RoleId || "";

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

	/* ── Fund ID / District dropdown state ── */
	const [fundIds, setFundIds] = useState<string[]>([]);
	const [fundIdLoading, setFundIdLoading] = useState(true);
	const [selectedFundId, setSelectedFundId] = useState(ALL_OPTION);

	const [districts, setDistricts] = useState<string[]>([]);
	const [districtLoading, setDistrictLoading] = useState(true);
	const [selectedDistrict, setSelectedDistrict] = useState(ALL_OPTION);

	/* ── Report state ── */
	const [reportData, setReportData] = useState<ConstructionItem[]>([]);
	const [reportSummary, setReportSummary] = useState<ReportSummary | null>(null);
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

	/* ────── Fetch Fund IDs (once) ────── */
	useEffect(() => {
		const fetchFundIds = async () => {
			setFundIdLoading(true);
			try {
				const res = await fetch(`/misapi/api/constructioncompleted/lookups/fundids`, {
					credentials: "include",
				});
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const json = await res.json();
				const raw = parseApiResponse(json);
				const ids: string[] = raw.map((f: any) => String(f).trim()).filter(Boolean);
				setFundIds(ids);
			} catch (e: any) {
				toast.error("Failed to load fund IDs.");
			} finally {
				setFundIdLoading(false);
			}
		};
		fetchFundIds();
	}, []);

	/* ────── Fetch Districts (needs roleId) ────── */
	useEffect(() => {
		const fetchDistricts = async () => {
			if (!roleId) {
				setDistrictLoading(false);
				return;
			}
			setDistrictLoading(true);
			try {
				const res = await fetch(
					`/misapi/api/constructioncompleted/lookups/districts/${encodeURIComponent(roleId)}`,
					{credentials: "include"}
				);
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const json = await res.json();
				const raw = parseApiResponse(json);
				const list: string[] = raw.map((d: any) => String(d).trim()).filter(Boolean);
				setDistricts(list);
			} catch (e: any) {
				toast.error("Failed to load districts.");
			} finally {
				setDistrictLoading(false);
			}
		};
		fetchDistricts();
	}, [roleId]);

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
		return true;
	};

	/* ────── Fetch report ────── */
	const fetchReport = async () => {
		if (!validateInputs()) return;

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

		setReportLoading(true);
		setReportData([]);
		setReportSummary(null);
		setShowReport(true);

		try {
			const costCtrParam = encodeURIComponent(selectedDept!.DeptId);
			const fundIdParam = encodeURIComponent(selectedFundId);
			const districtParam = encodeURIComponent(selectedDistrict);
			const url = `/misapi/api/constructioncompleted/report/${fundIdParam}/${districtParam}/${costCtrParam}`;

			const res = await fetch(url, {credentials: "include", signal: controller.signal});
			clearTimeout(timeoutId);

			if (!res.ok) {
				const txt = await res.text();
				throw new Error(`HTTP ${res.status}: ${txt}`);
			}

			const json = await res.json();
			if (!json.success) throw new Error(json.message || "Failed to load data");

			const items: ConstructionItem[] = json.data || [];
			if (items.length > MAX_RECORDS)
				throw new Error(`Too many records (${items.length}). Please refine your search.`);

			setReportData(items);
			setReportSummary(json.summary || null);

			if (items.length === 0) {
				toast.warn("No completed jobs found for the selected criteria.");
			} else {
				toast.success(`${items.length} records loaded successfully.`);
			}
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
			setReportSummary(null);
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
		setSelectedFundId(ALL_OPTION);
		setSelectedDistrict(ALL_OPTION);
		setSearchId("");
		setSearchName("");
		setShowReport(false);
		setReportData([]);
		setReportSummary(null);
		toast.info("Filters cleared.");
	};

	const closeReport = () => {
		setShowReport(false);
		setReportData([]);
		setReportSummary(null);
		setReportLoading(false);
	};

	/* ────── Sorted per SQL: ORDER BY district, servicedeponame, electorate, project_no ────── */
	const sortedData = [...reportData].sort(
		(a, b) =>
			(a.District || "").localeCompare(b.District || "") ||
			(a.ServiceDepoName || "").localeCompare(b.ServiceDepoName || "") ||
			(a.Electorate || "").localeCompare(b.Electorate || "") ||
			(a.ProjectNo || "").localeCompare(b.ProjectNo || "")
	);

	const cctName = reportData.find((r) => r.CctName)?.CctName || selectedDept?.DeptName || "";
	const costCtrDisplay = selectedDept?.DeptId || "";
	const totalStdCost = reportSummary?.totalStdCost ?? sortedData.reduce((s, r) => s + (r.StdCost ?? 0), 0);
	const totalWp = reportSummary?.totalWp ?? sortedData.reduce((s, r) => s + (r.Wp ?? 0), 0);
	const completedJobs = reportSummary?.completedJobs ?? sortedData.length;
	const inProgressJobs = reportSummary?.inProgressJobs ?? 0;

	/* ────── CSV download ────── */
	const downloadCSV = () => {
		if (reportData.length === 0) return;

		const titleRows = [
			`Construction Completed - ${selectedFundId === ALL_OPTION ? "All Funds" : selectedFundId}`,
			`Cost Center: ${costCtrDisplay}/${cctName}`,
			`District: ${selectedDistrict === ALL_OPTION ? "All" : selectedDistrict}`,
			"",
		];

		const headers = [
			"Item",
			"Scheme Name",
			"Work Est. Cost (LKR)",
			"Progress %",
			"Work Progress",
			"Job No",
			"File No",
			"Remarks",
			"Completed Date",
		];
		const rows: string[] = [headers.join(",")];

		sortedData.forEach((it, i) => {
			rows.push(
				[
					csvEscape(i + 1),
					csvEscape(it.Descr),
					csvEscape(formatNumber(it.StdCost)),
					csvEscape(formatPercent(it.CPercentage)),
					csvEscape(formatNumber(it.Wp)),
					csvEscape(it.ProjectNo),
					csvEscape(it.FileNo),
					csvEscape(it.Remarks),
					csvEscape(formatDate(it.CompDate)),
				].join(",")
			);
		});

		rows.push(
			"",
			`,,Total,${csvEscape(formatNumber(totalStdCost))},,${csvEscape(formatNumber(totalWp))},,,`,
			"",
			`In progress jobs:,${inProgressJobs}`,
			`Completed jobs:,${completedJobs}`,
			"",
			"Prepared by:,,,,,,,,",
			"checked by:,,,,,,,,"
		);

		const csv = [...titleRows, ...rows].join("\n");
		const blob = new Blob([csv], {type: "text/csv;charset=utf-8;"});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `ConstructionCompleted_${costCtrDisplay}_${selectedFundId}.csv`;
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
            <td class="px-2 py-2 border-l border-r border-gray-300 text-center text-xs">${i + 1}</td>
            <td class="px-2 py-2 border-r border-gray-300 text-left text-xs">${it.Descr || ""}</td>
            <td class="px-2 py-2 border-r border-gray-300 text-right text-xs font-mono">${formatNumber(
					it.StdCost
				)}</td>
            <td class="px-2 py-2 border-r border-gray-300 text-center text-xs">${formatPercent(
					it.CPercentage
				)}</td>
            <td class="px-2 py-2 border-r border-gray-300 text-right text-xs font-mono">${formatNumber(
					it.Wp
				)}</td>
            <td class="px-2 py-2 border-r border-gray-300 text-left text-xs font-mono">${
					it.ProjectNo || ""
				}</td>
            <td class="px-2 py-2 border-r border-gray-300 text-left text-xs font-mono">${
					it.FileNo || ""
				}</td>
            <td class="px-2 py-2 border-r border-gray-300 text-left text-xs">${it.Remarks || ""}</td>
            <td class="px-2 py-2 border-r border-gray-300 text-center text-xs">${formatDate(
					it.CompDate
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
      .title { margin: 10px 8px 6px; text-align:center; font-weight:bold; color:#7A0000; font-size:13px; }
      .info { margin:4px 8px; font-size:9.5px; }
      .info div { margin-bottom:3px; }
      table { border-collapse:collapse; width:100%; font-size:8px; margin-top:10px; }
      th, td { border:1px solid #d1d5db; padding:5px 6px; word-wrap:break-word; }
      th { background:linear-gradient(to right,#7A0000,#A52A2A); color:white; text-align:center; font-weight:bold; }
      .font-mono { font-family:monospace; }
      .footer-lines { margin: 10px 8px; font-size:9.5px; }
      .footer-lines div { margin-bottom:4px; }
      .sig-row { display:flex; justify-content:space-between; margin-top:30px; padding:0 15px; font-size:9px; }
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
  <div class="title">Construction Completed - ${selectedFundId === ALL_OPTION ? "All Funds" : selectedFundId}</div>
  <div class="info">
    <div><strong>Cost Center:</strong> ${costCtrDisplay}/${cctName}</div>
    <div><strong>District:</strong> ${selectedDistrict === ALL_OPTION ? "All" : selectedDistrict}</div>
  </div>
  <table style="width:100%; border-collapse:collapse; font-size:8px; border:1px solid #d1d5db;">
    <thead>
      <tr style="background:linear-gradient(to right,#7A0000,#A52A2A); color:white;">
        <th style="padding:5px 6px; width:4%;">Item</th>
        <th style="padding:5px 6px; width:20%;">Scheme Name</th>
        <th style="padding:5px 6px; width:11%; text-align:right;">Work Est. Cost (LKR)</th>
        <th style="padding:5px 6px; width:8%;">Progress %</th>
        <th style="padding:5px 6px; width:11%; text-align:right;">Work Progress</th>
        <th style="padding:5px 6px; width:10%;">Job No</th>
        <th style="padding:5px 6px; width:10%;">File No</th>
        <th style="padding:5px 6px; width:16%;">Remarks</th>
        <th style="padding:5px 6px; width:10%;">Completed Date</th>
      </tr>
    </thead>
    <tbody>${rows}
      <tr style="background:#7A0000; color:white; font-weight:bold;">
        <td class="px-2 py-2" colspan="2">Total</td>
        <td class="px-2 py-2 text-right font-mono">${formatNumber(totalStdCost)}</td>
        <td class="px-2 py-2"></td>
        <td class="px-2 py-2 text-right font-mono">${formatNumber(totalWp)}</td>
        <td class="px-2 py-2" colspan="4"></td>
      </tr>
    </tbody>
  </table>

  <div class="footer-lines">
    <div><strong>In progress jobs:</strong> ${inProgressJobs}</div>
    <div><strong>Completed jobs:</strong> ${completedJobs}</div>
  </div>

  <div class="sig-row">
    <div>Prepared by: ____________________</div>
    <div>Checked by: ____________________</div>
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
				<h2 className={`text-xl font-bold ${maroon}`}>Construction Completed</h2>
			</div>

			<div className="bg-gray-50 p-4 rounded-lg mb-4 border border-gray-200">
				<div className="flex flex-col md:flex-row flex-wrap gap-4 items-end mb-4">
					<div className="flex flex-col">
						<label className={`text-xs font-bold ${maroon} mb-1`}>Fund ID</label>
						<select
							value={selectedFundId}
							onChange={(e) => setSelectedFundId(e.target.value)}
							disabled={fundIdLoading}
							className="pl-3 pr-3 py-1.5 w-full md:w-40 rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#7A0000] transition text-sm"
						>
							<option value={ALL_OPTION}>All Funds</option>
							{fundIds.map((f) => (
								<option key={f} value={f}>
									{f}
								</option>
							))}
						</select>
					</div>

					<div className="flex flex-col">
						<label className={`text-xs font-bold ${maroon} mb-1`}>District</label>
						<select
							value={selectedDistrict}
							onChange={(e) => setSelectedDistrict(e.target.value)}
							disabled={districtLoading}
							className="pl-3 pr-3 py-1.5 w-full md:w-48 rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#7A0000] transition text-sm"
						>
							<option value={ALL_OPTION}>All Districts</option>
							{districts.map((d) => (
								<option key={d} value={d}>
									{d}
								</option>
							))}
						</select>
					</div>

					<button
						onClick={fetchReport}
						disabled={!selectedDept}
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
						Select a cost center below, choose a Fund ID / District above if needed, then click View.
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
								<p className="text-sm text-gray-600">Fetching construction data from server</p>
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
									Construction Completed - {selectedFundId === ALL_OPTION ? "All Funds" : selectedFundId}
								</h2>
								<div className="text-sm mb-2 ml-5 mr-12">
									<span className="font-bold">Cost center:</span> {costCtrDisplay}/{cctName}
								</div>
								<div className="text-sm mb-3 ml-5 mr-12">
									<span className="font-bold">District:</span>{" "}
									{selectedDistrict === ALL_OPTION ? "All" : selectedDistrict}
								</div>

								<div className="ml-5 mt-1 mb-3 border border-gray-200 rounded-lg overflow-x-auto print:ml-12 print:mt-12 print:overflow-visible">
									<div className="min-w-[1100px]">
										<table className="w-full text-xs border-collapse">
											<thead className={`${maroonGrad} text-white`}>
												<tr>
													<th className="px-2 py-2 border border-gray-300" style={{width: "4%"}}>
														Item
													</th>
													<th className="px-2 py-2 border border-gray-300" style={{width: "20%"}}>
														Scheme Name
													</th>
													<th className="px-2 py-2 border border-gray-300 text-right" style={{width: "11%"}}>
														Work Est. Cost (LK Rs.)
													</th>
													<th className="px-2 py-2 border border-gray-300" style={{width: "8%"}}>
														Progress %
													</th>
													<th className="px-2 py-2 border border-gray-300 text-right" style={{width: "11%"}}>
														Work Progress
													</th>
													<th className="px-2 py-2 border border-gray-300" style={{width: "10%"}}>
														Job No
													</th>
													<th className="px-2 py-2 border border-gray-300" style={{width: "10%"}}>
														File No
													</th>
													<th className="px-2 py-2 border border-gray-300" style={{width: "16%"}}>
														Remarks
													</th>
													<th className="px-2 py-2 border border-gray-300" style={{width: "10%"}}>
														Completed Date
													</th>
												</tr>
											</thead>
											<tbody>
												{sortedData.map((it, i) => (
													<tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
														<td className="px-2 py-2 text-center border-l border-r border-gray-300">
															{i + 1}
														</td>
														<td className="px-2 py-2 border-r border-gray-300">{it.Descr || ""}</td>
														<td className="px-2 py-2 text-right font-mono border-r border-gray-300">
															{formatNumber(it.StdCost)}
														</td>
														<td className="px-2 py-2 text-center border-r border-gray-300">
															{formatPercent(it.CPercentage)}
														</td>
														<td className="px-2 py-2 text-right font-mono border-r border-gray-300">
															{formatNumber(it.Wp)}
														</td>
														<td className="px-2 py-2 font-mono border-r border-gray-300">
															{it.ProjectNo || ""}
														</td>
														<td className="px-2 py-2 font-mono border-r border-gray-300">
															{it.FileNo || ""}
														</td>
														<td className="px-2 py-2 border-r border-gray-300">{it.Remarks || ""}</td>
														<td className="px-2 py-2 text-center border-r border-gray-300">
															{formatDate(it.CompDate)}
														</td>
													</tr>
												))}
												<tr className={`${maroonGrad} text-white font-bold`}>
													<td className="px-2 py-2" colSpan={2}>
														Total
													</td>
													<td className="px-2 py-2 text-right font-mono">{formatNumber(totalStdCost)}</td>
													<td className="px-2 py-2"></td>
													<td className="px-2 py-2 text-right font-mono">{formatNumber(totalWp)}</td>
													<td className="px-2 py-2" colSpan={4}></td>
												</tr>
											</tbody>
										</table>
									</div>
								</div>

								<div className="ml-5 mr-12 mb-3 text-sm">
									<div>
										<span className="font-bold">In progress jobs:</span> {inProgressJobs}
									</div>
									<div>
										<span className="font-bold">Completed jobs:</span> {completedJobs}
									</div>
								</div>

								<div className="flex justify-between mt-8 ml-5 mr-12 mb-4 text-sm">
									<div>Prepared by: ____________________</div>
									<div>Checked by: ____________________</div>
								</div>
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
};

export default ConstructionCompletedReport;