// ProvinceMaterialReqDetailReport.tsx
import React, {useEffect, useState} from "react";
import {Download, Printer, X, RotateCcw, Eye, Search} from "lucide-react";
import {toast} from "react-toastify";
import {useUser} from "../../contexts/UserContext";

interface Province {
	CompId: string;
	CompName: string;
}

interface ProvinceMaterialReqDetailItem {
	Category: string | null;
	DeptId: string | null;
	DocNo: string | null;
	DocPf: string | null;
	ReqDt: string | null;
	EntBy: string | null;
	ModiBy: string | null;
	AprUid1: string | null;
	TranStatus: string | null;
	BranchName: string | null;
}

type RenderRow =
	| {kind: "data"; item: ProvinceMaterialReqDetailItem}
	| {kind: "subtotal"; status: string; count: number};

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

/* ────── Build render rows with subtotal after each status group ────── */
const buildRenderRows = (sorted: ProvinceMaterialReqDetailItem[]): RenderRow[] => {
	const rows: RenderRow[] = [];
	let i = 0;
	while (i < sorted.length) {
		const status = sorted[i].TranStatus || "";
		let count = 0;
		while (i < sorted.length && (sorted[i].TranStatus || "") === status) {
			rows.push({kind: "data", item: sorted[i]});
			count++;
			i++;
		}
		rows.push({kind: "subtotal", status, count});
	}
	return rows;
};

/* ────── MAIN COMPONENT ────── */
const ProvinceMaterialReqDetailReport: React.FC = () => {
	const {user} = useUser();
	const epfNo = user?.Userno || "";

	/* ── Province list state ── */
	const [provinces, setProvinces] = useState<Province[]>([]);
	const [filtered, setFiltered] = useState<Province[]>([]);
	const [searchId, setSearchId] = useState("");
	const [searchName, setSearchName] = useState("");
	const [page, setPage] = useState(1);
	const [provinceLoading, setProvinceLoading] = useState(true);
	const [provinceError, setProvinceError] = useState<string | null>(null);

	/* ── Report state ── */
	const [fromDate, setFromDate] = useState("");
	const [toDate, setToDate] = useState("");
	const [selectedProvince, setSelectedProvince] = useState<Province | null>(null);
	const [reportData, setReportData] = useState<ProvinceMaterialReqDetailItem[]>([]);
	const [reportLoading, setReportLoading] = useState(false);
	const [showReport, setShowReport] = useState(false);

	const maroon = "text-[#7A0000]";
	const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";

	/* ────── Fetch Provinces ────── */
	useEffect(() => {
		const fetchProvinces = async () => {
			if (!epfNo) {
				setProvinceError("No EPF number available.");
				toast.error("Login required.");
				setProvinceLoading(false);
				return;
			}

			setProvinceLoading(true);
			try {
				const res = await fetch(
					`/misapi/api/incomeexpenditure/Usercompanies/${epfNo}/60`
				);
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const txt = await res.text();
				const parsed = JSON.parse(txt);
				const raw = Array.isArray(parsed) ? parsed : parsed.data || [];
				const list: Province[] = raw.map((c: any) => ({
					CompId: c.CompId,
					CompName: c.CompName,
				}));
				setProvinces(list);
				setFiltered(list);
			} catch (e: any) {
				setProvinceError(e.message);
				toast.error("Failed to load provinces.");
			} finally {
				setProvinceLoading(false);
			}
		};
		fetchProvinces();
	}, [epfNo]);

	/* ────── Filter Provinces ────── */
	useEffect(() => {
		const f = provinces.filter(
			(p) =>
				(!searchId ||
					p.CompId.toLowerCase().includes(searchId.toLowerCase())) &&
				(!searchName ||
					p.CompName.toLowerCase().includes(searchName.toLowerCase()))
		);
		setFiltered(f);
		setPage(1);
	}, [searchId, searchName, provinces]);

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

	/* ────── Fetch report for a selected Province ────── */
	const fetchReport = async (province: Province) => {
		if (!validateInputs()) return;

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

		setSelectedProvince(province);
		setReportLoading(true);
		setReportData([]);
		setShowReport(true);

		try {
			const compIdParam = encodeURIComponent(province.CompId);
			const url = `/misapi/api/provincematerialreqdetail/report/${fromDate}/${toDate}/${compIdParam}`;

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

			const items: ProvinceMaterialReqDetailItem[] = json.data || [];
			if (items.length > MAX_RECORDS)
				throw new Error(
					`Too many records (${items.length}). Please refine your search.`
				);

			if (items.length === 0) {
				toast.warn("No records found for the selected criteria.");
				setShowReport(false);
				setSelectedProvince(null);
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
			setSelectedProvince(null);
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
		setSelectedProvince(null);
		toast.info("Filters cleared.");
	};

	const closeReport = () => {
		setShowReport(false);
		setReportData([]);
		setSelectedProvince(null);
		setReportLoading(false);
	};

	/* ────── Sort by Status first (to group), then Doc Pf/No/Date ────── */
	const sortedData = [...reportData].sort(
		(a, b) =>
			(a.TranStatus || "").localeCompare(b.TranStatus || "") ||
			(a.DocPf || "").localeCompare(b.DocPf || "") ||
			(a.DocNo || "").localeCompare(b.DocNo || "") ||
			(a.ReqDt || "").localeCompare(b.ReqDt || "")
	);

	const renderRows = buildRenderRows(sortedData);
	const provinceName =
		reportData.find((r) => r.BranchName)?.BranchName || selectedProvince?.CompName || "";
	const provinceDisplay = selectedProvince?.CompId || "";

	/* ────── CSV download ────── */
	const downloadCSV = () => {
		if (reportData.length === 0) return;

		const titleRows = [
			`Material Requisition Inquiry Report From ${fromDate} To ${toDate}`,
			`Branch/Province : ${provinceDisplay}/${provinceName}`,
			"",
		];

		const headers = [
			"No",
			"Category",
			"Department ID",
			"Document ID",
			"Type",
			"Transaction Date",
			"Entered By",
			"Checked By",
			"Approved By",
			"Status",
		];
		const rows: string[] = [headers.join(",")];

		let rowNum = 0;
		renderRows.forEach((r) => {
			if (r.kind === "data") {
				rowNum++;
				const it = r.item;
				rows.push(
					[
						csvEscape(rowNum),
						csvEscape(it.Category),
						csvEscape(it.DeptId),
						csvEscape(it.DocNo),
						csvEscape(it.DocPf),
						csvEscape(formatDate(it.ReqDt)),
						csvEscape(it.EntBy),
						csvEscape(it.ModiBy),
						csvEscape(it.AprUid1),
						csvEscape(it.TranStatus),
					].join(",")
				);
			} else {
				rows.push(
					`,,,,,,,,,${csvEscape(`No of Status in ${r.status}: ${r.count}`)}`
				);
			}
		});

		const csv = [...titleRows, ...rows].join("\n");
		const blob = new Blob([csv], {type: "text/csv;charset=utf-8;"});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `ProvinceMaterialReqDetail_${fromDate}_${toDate}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	};

	/* ────── PDF print ────── */
	const printPDF = () => {
		if (reportData.length === 0) return;

		let rows = "";
		let rowNum = 0;
		renderRows.forEach((r) => {
			if (r.kind === "data") {
				rowNum++;
				const it = r.item;
				rows += `
          <tr class="${rowNum % 2 ? "bg-white" : "bg-gray-50"}">
            <td class="px-3 py-2 border-l border-r border-gray-300 text-center text-xs">${rowNum}</td>
            <td class="px-3 py-2 border-r border-gray-300 text-left text-xs">${it.Category || ""}</td>
            <td class="px-3 py-2 border-r border-gray-300 text-left text-xs font-mono">${it.DeptId || ""}</td>
            <td class="px-3 py-2 border-r border-gray-300 text-left text-xs font-mono">${it.DocNo || ""}</td>
            <td class="px-3 py-2 border-r border-gray-300 text-left text-xs font-mono">${it.DocPf || ""}</td>
            <td class="px-3 py-2 border-r border-gray-300 text-center text-xs">${formatDate(it.ReqDt)}</td>
            <td class="px-3 py-2 border-r border-gray-300 text-left text-xs">${it.EntBy || ""}</td>
            <td class="px-3 py-2 border-r border-gray-300 text-left text-xs">${it.ModiBy || ""}</td>
            <td class="px-3 py-2 border-r border-gray-300 text-left text-xs">${it.AprUid1 || ""}</td>
            <td class="px-3 py-2 border-r border-gray-300 text-left text-xs">${it.TranStatus || ""}</td>
          </tr>`;
			} else {
				rows += `
          <tr class="bg-[#e8e0d0] font-bold">
            <td colspan="10" class="px-3 py-2 border border-gray-300 text-left text-xs">No of Status in ${r.status}: ${r.count}</td>
          </tr>`;
			}
		});

		const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    @media print {
      @page { size: landscape; margin: 8mm 5mm 10mm 5mm; }
      body { margin:0; font-family:Arial,Helvetica,sans-serif; }
      .title { margin: 10px 8px 20px; text-align:center; font-weight:bold; color:#7A0000; font-size:13px; }
      .info { margin:6px 8px; font-size:9px; }
      table { border-collapse:collapse; width:100%; font-size:8px; }
      th, td { border:1px solid #d1d5db; padding:5px 6px; word-wrap:break-word; }
      th { background:linear-gradient(to right,#7A0000,#A52A2A); color:white; text-align:center; font-weight:bold; }
      .bg-\\[\\#e8e0d0\\] { background:#e8e0d0; }
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
  <div class="title">Material Requisition Inquiry Report From ${fromDate} To ${toDate}</div>
  <div class="info">
    <div><strong>Branch/Province :</strong> ${provinceDisplay}/${provinceName}</div>
  </div>
  <table style="width:100%; border-collapse:collapse; font-size:8px; border:1px solid #d1d5db;">
    <thead>
      <tr style="background:linear-gradient(to right,#7A0000,#A52A2A); color:white;">
        <th style="padding:5px 6px; width:4%;">No</th>
        <th style="padding:5px 6px; width:16%;">Category</th>
        <th style="padding:5px 6px; width:10%;">Department ID</th>
        <th style="padding:5px 6px; width:11%;">Document ID</th>
        <th style="padding:5px 6px; width:9%;">Type</th>
        <th style="padding:5px 6px; width:10%;">Transaction Date</th>
        <th style="padding:5px 6px; width:11%;">Entered By</th>
        <th style="padding:5px 6px; width:11%;">Checked By</th>
        <th style="padding:5px 6px; width:9%;">Approved By</th>
        <th style="padding:5px 6px; width:9%;">Status</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
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
					Province Material Requisition Details Inquiry
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

			{/* ────── Province List ────── */}
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

			{provinceLoading && (
				<div className="flex flex-col items-center justify-center py-12">
					<div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#7A0000]"></div>
					<p className="mt-3 text-gray-600 text-sm">
						Loading provinces...
					</p>
				</div>
			)}

			{provinceError && (
				<div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 text-sm">
					{provinceError}
				</div>
			)}

			{!provinceLoading && !provinceError && filtered.length > 0 && (
				<>
					<div className="overflow-x-auto rounded-lg border border-gray-200">
						<div className="max-h-[50vh] overflow-y-auto">
							<table className="w-full table-fixed text-left text-xs md:text-sm">
								<thead
									className={`${maroonGrad} text-white sticky top-0`}
								>
									<tr>
										<th className="px-4 py-2 w-1/4">
											Province Code
										</th>
										<th className="px-4 py-2 w-1/2">
											Province Name
										</th>
										<th className="px-4 py-2 w-1/4 text-center">
											Action
										</th>
									</tr>
								</thead>
								<tbody>
									{paginated.map((province, i) => (
										<tr
											key={i}
											className={i % 2 ? "bg-white" : "bg-gray-50"}
										>
											<td className="px-4 py-2 truncate">
												{province.CompId}
											</td>
											<td className="px-4 py-2 truncate">
												{province.CompName}
											</td>
											<td className="px-4 py-2 text-center">
												<button
													onClick={() => fetchReport(province)}
													disabled={!fromDate || !toDate}
													className={`px-3 py-1 rounded text-xs font-medium hover:brightness-110 transition shadow disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 mx-auto
                            ${
											selectedProvince?.CompId === province.CompId &&
											reportLoading
												? "bg-green-600 text-white"
												: selectedProvince?.CompId === province.CompId
												? "bg-green-600 text-white"
												: `${maroonGrad} text-white`
										}`}
												>
													<Eye className="w-3 h-3" />
													{selectedProvince?.CompId === province.CompId &&
													reportLoading
														? "Viewing"
														: selectedProvince?.CompId === province.CompId
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
			{showReport && selectedProvince && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/90 print:static print:inset-auto print:p-0 print:bg-white">
					<div className="relative bg-white w-[95vw] sm:w-[92vw] md:w-[88vw] lg:w-[84vw] xl:w-[80vw] max-w-[1500px] rounded-2xl shadow-2xl border border-gray-200 overflow-hidden mt-16 md:mt-24 lg:mt-32 lg:ml-64 mx-auto print:relative print:w-full print:max-w-none print:rounded-none print:shadow-none print:border-none print:overflow-visible">
						{reportLoading && (
							<div className="absolute inset-0 bg-white/95 z-50 flex flex-col items-center justify-center gap-4">
								<div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#7A0000]"></div>
								<p className="text-xl font-bold text-[#7A0000]">
									Loading Report...
								</p>
								<p className="text-sm text-gray-600">
									Fetching material requisition data from server
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
									Material Requisition Inquiry Report From {fromDate} To {toDate}
								</h2>
								<div className="text-sm mb-3 ml-5 mr-12">
									<span className="font-bold">Branch/Province :</span>{" "}
									{provinceDisplay}/{provinceName}
								</div>

								<div className="ml-5 mt-1 mb-5 border border-gray-200 rounded-lg overflow-x-auto print:ml-12 print:mt-12 print:overflow-visible">
									<div className="min-w-[1400px]">
										<table className="w-full text-xs border-collapse">
											<thead className={`${maroonGrad} text-white`}>
												<tr>
													<th className="px-3 py-2 border border-gray-300" style={{width: "4%"}}>
														No
													</th>
													<th className="px-3 py-2 border border-gray-300" style={{width: "16%"}}>
														Category
													</th>
													<th className="px-3 py-2 border border-gray-300" style={{width: "10%"}}>
														Department ID
													</th>
													<th className="px-3 py-2 border border-gray-300" style={{width: "11%"}}>
														Document ID
													</th>
													<th className="px-3 py-2 border border-gray-300" style={{width: "9%"}}>
														Type
													</th>
													<th className="px-3 py-2 border border-gray-300" style={{width: "10%"}}>
														Transaction Date
													</th>
													<th className="px-3 py-2 border border-gray-300" style={{width: "11%"}}>
														Entered By
													</th>
													<th className="px-3 py-2 border border-gray-300" style={{width: "11%"}}>
														Checked By
													</th>
													<th className="px-3 py-2 border border-gray-300" style={{width: "9%"}}>
														Approved By
													</th>
													<th className="px-3 py-2 border border-gray-300" style={{width: "9%"}}>
														Status
													</th>
												</tr>
											</thead>
											<tbody>
												{(() => {
													let rowNum = 0;
													return renderRows.map((r, idx) => {
														if (r.kind === "data") {
															rowNum++;
															const it = r.item;
															return (
																<tr
																	key={idx}
																	className={
																		rowNum % 2 === 0
																			? "bg-white"
																			: "bg-gray-50"
																	}
																>
																	<td className="px-3 py-2 border-l border-r border-gray-300 text-center">
																		{rowNum}
																	</td>
																	<td className="px-3 py-2 border-r border-gray-300">
																		{it.Category || ""}
																	</td>
																	<td className="px-3 py-2 font-mono border-r border-gray-300">
																		{it.DeptId || ""}
																	</td>
																	<td className="px-3 py-2 font-mono border-r border-gray-300">
																		{it.DocNo || ""}
																	</td>
																	<td className="px-3 py-2 font-mono border-r border-gray-300">
																		{it.DocPf || ""}
																	</td>
																	<td className="px-3 py-2 text-center border-r border-gray-300">
																		{formatDate(it.ReqDt)}
																	</td>
																	<td className="px-3 py-2 border-r border-gray-300">
																		{it.EntBy || ""}
																	</td>
																	<td className="px-3 py-2 border-r border-gray-300">
																		{it.ModiBy || ""}
																	</td>
																	<td className="px-3 py-2 border-r border-gray-300">
																		{it.AprUid1 || ""}
																	</td>
																	<td className="px-3 py-2 border-r border-gray-300">
																		{it.TranStatus || ""}
																	</td>
																</tr>
															);
														}
														return (
															<tr key={idx} className="bg-[#e8e0d0] font-bold">
																<td
																	colSpan={10}
																	className="px-3 py-2 border border-gray-300 text-left"
																>
																	No of Status in {r.status}: {r.count}
																</td>
															</tr>
														);
													});
												})()}
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

export default ProvinceMaterialReqDetailReport;