// ChequeCancellationDivisionReport.tsx
import React, {useEffect, useState} from "react";
import {Download, Printer, X, RotateCcw, Eye, Search} from "lucide-react";
import {toast} from "react-toastify";
import {useUser} from "../../contexts/UserContext";

interface Division {
	CompId: string;
	CompName: string;
}

interface ChequeCancellationDivisionItem {
	DeptId: string | null;
	DocNo: string | null;
	ChqDt: string | null;
	ChqNo: string | null;
	ChqAmt: number | null;
	ChqRun: string | null;
	RunDt: string | null;
	BranchName: string | null;
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
const ChequeCancellationDivisionReport: React.FC = () => {
	const {user} = useUser();
	const epfNo = user?.Userno || "";

	/* ── Division list state ── */
	const [divisions, setDivisions] = useState<Division[]>([]);
	const [filtered, setFiltered] = useState<Division[]>([]);
	const [searchId, setSearchId] = useState("");
	const [searchName, setSearchName] = useState("");
	const [page, setPage] = useState(1);
	const [divisionLoading, setDivisionLoading] = useState(true);
	const [divisionError, setDivisionError] = useState<string | null>(null);

	/* ── Report state ── */
	const [fromDate, setFromDate] = useState("");
	const [toDate, setToDate] = useState("");
	const [selectedDivision, setSelectedDivision] = useState<Division | null>(null);
	const [reportData, setReportData] = useState<ChequeCancellationDivisionItem[]>([]);
	const [reportLoading, setReportLoading] = useState(false);
	const [showReport, setShowReport] = useState(false);

	const maroon = "text-[#7A0000]";
	const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";

	/* ────── Fetch Divisions ────── */
	// NOTE: endpoint assumed to mirror the departments endpoint pattern.
	// Update the URL below to your actual division/company list API if different.
	useEffect(() => {
		const fetchDivisions = async () => {
			if (!epfNo) {
				setDivisionError("No EPF number available.");
				toast.error("Login required.");
				setDivisionLoading(false);
				return;
			}

			setDivisionLoading(true);
			try {
				const res = await fetch(
					`/misapi/api/incomeexpenditure/Usercompanies/${epfNo}/70`
				);
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const txt = await res.text();
				const parsed = JSON.parse(txt);
				const raw = Array.isArray(parsed)
					? parsed
					: parsed.data || [];
				const list: Division[] = raw.map((c: any) => ({
					CompId: c.CompId,
					CompName: c.CompName,
				}));
				setDivisions(list);
				setFiltered(list);
			} catch (e: any) {
				setDivisionError(e.message);
				toast.error("Failed to load divisions.");
			} finally {
				setDivisionLoading(false);
			}
		};
		fetchDivisions();
	}, [epfNo]);

	/* ────── Filter Divisions ────── */
	useEffect(() => {
		const f = divisions.filter(
			(d) =>
				(!searchId ||
					d.CompId.toLowerCase().includes(searchId.toLowerCase())) &&
				(!searchName ||
					d.CompName.toLowerCase().includes(searchName.toLowerCase()))
		);
		setFiltered(f);
		setPage(1);
	}, [searchId, searchName, divisions]);

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

	/* ────── Fetch report for a selected Division ────── */
	const fetchReport = async (division: Division) => {
		if (!validateInputs()) return;

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

		setSelectedDivision(division);
		setReportLoading(true);
		setReportData([]);
		setShowReport(true);

		try {
			const compIdParam = encodeURIComponent(division.CompId);
			const url = `/misapi/api/chequecancellationdivision/report/${fromDate}/${toDate}/${compIdParam}`;

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

			const items: ChequeCancellationDivisionItem[] = json.data || [];
			if (items.length > MAX_RECORDS)
				throw new Error(
					`Too many records (${items.length}). Please refine your search.`
				);

			if (items.length === 0) {
				toast.warn("No records found for the selected criteria.");
				setShowReport(false);
				setSelectedDivision(null);
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
			setSelectedDivision(null);
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
		setSelectedDivision(null);
		toast.info("Filters cleared.");
	};

	const closeReport = () => {
		setShowReport(false);
		setReportData([]);
		setSelectedDivision(null);
		setReportLoading(false);
	};

	/* ────── Single flat table, sorted by Dept then Cheque date/no ────── */
	const sortedData = [...reportData].sort(
		(a, b) =>
			(a.DeptId || "").localeCompare(b.DeptId || "") ||
			(a.ChqDt || "").localeCompare(b.ChqDt || "") ||
			(a.ChqNo || "").localeCompare(b.ChqNo || "")
	);

	const grandTotalChqAmt = reportData.reduce((s, r) => s + (r.ChqAmt || 0), 0);
	const divisionName =
		reportData.find((r) => r.BranchName)?.BranchName || selectedDivision?.CompName || "";
	const divisionDisplay = selectedDivision?.CompId || "";

	/* ────── CSV download ────── */
	const downloadCSV = () => {
		if (reportData.length === 0) return;

		const titleRows = [
			`Cheque Details From ${fromDate} To ${toDate}`,
			`Division/Region : ${divisionDisplay}/${divisionName}`,
			"",
		];

		const headers = [
			"No",
			"Department Id",
			"Cheque Cancellation Date",
			"Cheque No.",
			"Cheque Cancellation No",
			"Total Cheque Amount",
			"PP No",
			"PP Date",
		];
		const rows: string[] = [headers.join(",")];

		sortedData.forEach((it, i) => {
			rows.push(
				[
					csvEscape(i + 1),
					csvEscape(it.DeptId),
					csvEscape(formatDate(it.ChqDt)),
					csvEscape(it.ChqNo),
					csvEscape(it.DocNo),
					csvEscape(formatNumber(it.ChqAmt)),
					csvEscape(it.ChqRun),
					csvEscape(formatDate(it.RunDt)),
				].join(",")
			);
		});

		rows.push(`Total,,,,,${csvEscape(formatNumber(grandTotalChqAmt))},,`);

		const csv = [...titleRows, ...rows].join("\n");
		const blob = new Blob([csv], {type: "text/csv;charset=utf-8;"});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `ChequeCancellationDivision_${fromDate}_${toDate}.csv`;
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
					it.DeptId || ""
				}</td>
            <td class="px-3 py-2 border-r border-gray-300 text-center text-xs">${formatDate(
					it.ChqDt
				)}</td>
            <td class="px-3 py-2 border-r border-gray-300 text-left text-xs font-mono">${
					it.ChqNo || ""
				}</td>
            <td class="px-3 py-2 border-r border-gray-300 text-left text-xs font-mono">${
					it.DocNo || ""
				}</td>
            <td class="px-3 py-2 border-r border-gray-300 text-right text-xs font-mono">${formatNumber(
					it.ChqAmt
				)}</td>
            <td class="px-3 py-2 border-r border-gray-300 text-left text-xs font-mono">${
					it.ChqRun || ""
				}</td>
            <td class="px-3 py-2 border-r border-gray-300 text-center text-xs">${formatDate(
					it.RunDt
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
  <div class="title">Cheque Details From ${fromDate} To ${toDate}</div>
  <div class="info">
    <div><strong>Division/Region :</strong> ${divisionDisplay}/${divisionName}</div>
    <div style="font-weight:600; color:#4B5563;">Currency : LKR</div>
  </div>
  <table style="width:100%; border-collapse:collapse; font-size:8.5px; border:1px solid #d1d5db;">
    <thead>
      <tr style="background:linear-gradient(to right,#7A0000,#A52A2A); color:white;">
        <th style="padding:6px 8px; width:5%;">No</th>
        <th style="padding:6px 8px; width:12%;">Department Id</th>
        <th style="padding:6px 8px; width:14%;">Cheque Cancellation Date</th>
        <th style="padding:6px 8px; width:12%;">Cheque No.</th>
        <th style="padding:6px 8px; width:14%;">Cheque Cancellation No</th>
        <th style="padding:6px 8px; width:15%; text-align:right;">Total Cheque Amount</th>
        <th style="padding:6px 8px; width:14%;">PP No</th>
        <th style="padding:6px 8px; width:14%;">PP Date</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr>
        <td colspan="5" style="text-align:right; padding:6px 8px; border:1px solid #d1d5db;">Total</td>
        <td style="text-align:right; padding:6px 8px; border:1px solid #d1d5db; font-family:monospace;">${formatNumber(
			grandTotalChqAmt
		)}</td>
        <td colspan="2" style="border:1px solid #d1d5db;"></td>
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
					Cheque Cancellation (Division)
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

			{/* ────── Division List ────── */}
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

			{divisionLoading && (
				<div className="flex flex-col items-center justify-center py-12">
					<div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#7A0000]"></div>
					<p className="mt-3 text-gray-600 text-sm">
						Loading divisions...
					</p>
				</div>
			)}

			{divisionError && (
				<div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 text-sm">
					{divisionError}
				</div>
			)}

			{!divisionLoading && !divisionError && filtered.length > 0 && (
				<>
					<div className="overflow-x-auto rounded-lg border border-gray-200">
						<div className="max-h-[50vh] overflow-y-auto">
							<table className="w-full table-fixed text-left text-xs md:text-sm">
								<thead
									className={`${maroonGrad} text-white sticky top-0`}
								>
									<tr>
										<th className="px-4 py-2 w-1/4">
											Division Code
										</th>
										<th className="px-4 py-2 w-1/2">
											Division Name
										</th>
										<th className="px-4 py-2 w-1/4 text-center">
											Action
										</th>
									</tr>
								</thead>
								<tbody>
									{paginated.map((division, i) => (
										<tr
											key={i}
											className={i % 2 ? "bg-white" : "bg-gray-50"}
										>
											<td className="px-4 py-2 truncate">
												{division.CompId}
											</td>
											<td className="px-4 py-2 truncate">
												{division.CompName}
											</td>
											<td className="px-4 py-2 text-center">
												<button
													onClick={() => fetchReport(division)}
													disabled={!fromDate || !toDate}
													className={`px-3 py-1 rounded text-xs font-medium hover:brightness-110 transition shadow disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 mx-auto
                            ${
											selectedDivision?.CompId === division.CompId &&
											reportLoading
												? "bg-green-600 text-white"
												: selectedDivision?.CompId === division.CompId
												? "bg-green-600 text-white"
												: `${maroonGrad} text-white`
										}`}
												>
													<Eye className="w-3 h-3" />
													{selectedDivision?.CompId === division.CompId &&
													reportLoading
														? "Viewing"
														: selectedDivision?.CompId === division.CompId
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
			{showReport && selectedDivision && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/90 print:static print:inset-auto print:p-0 print:bg-white">
					<div className="relative bg-white w-[95vw] sm:w-[90vw] md:w-[85vw] lg:w-[80vw] xl:w-[75vw] max-w-7xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden mt-20 md:mt-32 lg:mt-40 lg:ml-64 mx-auto print:relative print:w-full print:max-w-none print:rounded-none print:shadow-none print:border-none print:overflow-visible">
						{reportLoading && (
							<div className="absolute inset-0 bg-white/95 z-50 flex flex-col items-center justify-center gap-4">
								<div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#7A0000]"></div>
								<p className="text-xl font-bold text-[#7A0000]">
									Loading Report...
								</p>
								<p className="text-sm text-gray-600">
									Fetching cheque cancellation data from server
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
									Cheque Details From {fromDate} To {toDate}
								</h2>
								<div className="flex justify-between text-sm mb-3 ml-5 mr-12">
									<div>
										<span className="font-bold">Division/Region :</span>{" "}
										{divisionDisplay}/{divisionName}
									</div>
									<div className="font-semibold text-gray-600">
										Currency : LKR
									</div>
								</div>

								<div className="ml-5 mt-1 mb-5 border border-gray-200 rounded-lg overflow-x-auto print:ml-12 print:mt-12 print:overflow-visible">
									<div className="min-w-[1100px]">
										<table className="w-full text-xs border-collapse">
											<thead className={`${maroonGrad} text-white`}>
												<tr>
													<th className="px-4 py-2 border border-gray-300" style={{width: "5%"}}>
														No
													</th>
													<th className="px-4 py-2 border border-gray-300" style={{width: "12%"}}>
														Department Id
													</th>
													<th className="px-4 py-2 border border-gray-300" style={{width: "14%"}}>
														Cheque Cancellation Date
													</th>
													<th className="px-4 py-2 border border-gray-300" style={{width: "12%"}}>
														Cheque No.
													</th>
													<th className="px-4 py-2 border border-gray-300" style={{width: "14%"}}>
														Cheque Cancellation No
													</th>
													<th className="px-4 py-2 border border-gray-300 text-right" style={{width: "15%"}}>
														Total Cheque Amount
													</th>
													<th className="px-4 py-2 border border-gray-300" style={{width: "14%"}}>
														PP No
													</th>
													<th className="px-4 py-2 border border-gray-300" style={{width: "14%"}}>
														PP Date
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
															{it.DeptId || ""}
														</td>
														<td className="px-4 py-2 text-center border-r border-gray-300">
															{formatDate(it.ChqDt)}
														</td>
														<td className="px-4 py-2 font-mono border-r border-gray-300">
															{it.ChqNo || ""}
														</td>
														<td className="px-4 py-2 font-mono border-r border-gray-300">
															{it.DocNo || ""}
														</td>
														<td className="px-4 py-2 text-right font-mono border-r border-gray-300">
															{formatNumber(it.ChqAmt)}
														</td>
														<td className="px-4 py-2 font-mono border-r border-gray-300">
															{it.ChqRun || ""}
														</td>
														<td className="px-4 py-2 text-center border-r border-gray-300">
															{formatDate(it.RunDt)}
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
														Total
													</td>
													<td className="px-4 py-2 text-right font-mono border border-gray-300">
														{formatNumber(grandTotalChqAmt)}
													</td>
													<td colSpan={2} className="border border-gray-300"></td>
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

export default ChequeCancellationDivisionReport;