// ProvinceCashBookInquiryReport.tsx
import React, {useEffect, useState} from "react";
import {Download, Printer, X, RotateCcw, Eye, Search} from "lucide-react";
import {toast} from "react-toastify";
import {useUser} from "../../contexts/UserContext";

interface Province {
	CompId: string;
	CompName: string;
}

interface ProvinceCashBookInquiryItem {
	Category: string | null;
	DeptId: string | null;
	DocDt: string | null;
	NonTaxabl: number | null;
	DocNo: string | null;
	ApprvUid1: string | null;
	ApprDt1: string | null;
	TranStatus: string | null;
	Payee: string | null;
	ChqDt: string | null;
	ChqNo: string | null;
	PymtDocNo: string | null;
	PpStatus: string | null;
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
	if (isNaN(d.getTime())) return dateStr;
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
const ProvinceCashBookInquiryReport: React.FC = () => {
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
	const [curDate, setCurDate] = useState("");
	const [selectedProvince, setSelectedProvince] = useState<Province | null>(null);
	const [reportData, setReportData] = useState<ProvinceCashBookInquiryItem[]>([]);
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
		if (!curDate) {
			toast.error("Please select a Date");
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
			const url = `/misapi/api/provincecashbookinquiry/report/${curDate}/${compIdParam}`;

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

			const items: ProvinceCashBookInquiryItem[] = json.data || [];
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
		setCurDate("");
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

	/* ────── Single flat table, matches ORDER BY dept_id,category,doc_no ────── */
	const sortedData = [...reportData].sort(
		(a, b) =>
			(a.DeptId || "").localeCompare(b.DeptId || "") ||
			(a.Category || "").localeCompare(b.Category || "") ||
			(a.DocNo || "").localeCompare(b.DocNo || "")
	);

	const grandTotalAmount = reportData.reduce((s, r) => s + (r.NonTaxabl || 0), 0);
	const provinceName =
		reportData.find((r) => r.BranchName)?.BranchName || selectedProvince?.CompName || "";
	const provinceDisplay = selectedProvince?.CompId || "";

	const endDateDisplay = (() => {
		if (!curDate) return "";
		const d = new Date(curDate);
		d.setDate(d.getDate() + 7);
		return formatDate(d.toISOString());
	})();

	/* ────── CSV download ────── */
	const downloadCSV = () => {
		if (reportData.length === 0) return;

		const titleRows = [
			`Province Pay slips inquiry report From ${curDate} (Within 7 days)`,
			`Province/Branch : ${provinceDisplay}/${provinceName}`,
			"",
		];

		const headers = [
			"No",
			"Category",
			"Dept Id",
			"Transaction",
			"Payslip No",
			"Amount",
			"Approved By",
			"Approved Date",
			"Payslip Status",
			"Payee",
			"Cheque Date",
			"Cheque No",
			"PP No",
			"Cheque Status",
		];
		const rows: string[] = [headers.join(",")];

		sortedData.forEach((it, i) => {
			rows.push(
				[
					csvEscape(i + 1),
					csvEscape(it.Category),
					csvEscape(it.DeptId),
					csvEscape(formatDate(it.DocDt)),
					csvEscape(it.DocNo),
					csvEscape(formatNumber(it.NonTaxabl)),
					csvEscape(it.ApprvUid1),
					csvEscape(it.ApprDt1),
					csvEscape(it.TranStatus),
					csvEscape(it.Payee),
					csvEscape(it.ChqDt),
					csvEscape(it.ChqNo),
					csvEscape(it.PymtDocNo),
					csvEscape(it.PpStatus),
				].join(",")
			);
		});

		rows.push(`Total,,,,,${csvEscape(formatNumber(grandTotalAmount))},,,,,,,,`);

		const csv = [...titleRows, ...rows].join("\n");
		const blob = new Blob([csv], {type: "text/csv;charset=utf-8;"});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `ProvinceCashBookInquiry_${curDate}.csv`;
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
            <td class="px-2 py-2 border-l border-r border-gray-300 text-center text-xs">${
					i + 1
				}</td>
            <td class="px-2 py-2 border-r border-gray-300 text-left text-xs">${
					it.Category || ""
				}</td>
            <td class="px-2 py-2 border-r border-gray-300 text-left text-xs font-mono">${
					it.DeptId || ""
				}</td>
            <td class="px-2 py-2 border-r border-gray-300 text-center text-xs">${formatDate(
					it.DocDt
				)}</td>
            <td class="px-2 py-2 border-r border-gray-300 text-left text-xs font-mono">${
					it.DocNo || ""
				}</td>
            <td class="px-2 py-2 border-r border-gray-300 text-right text-xs font-mono">${formatNumber(
					it.NonTaxabl
				)}</td>
            <td class="px-2 py-2 border-r border-gray-300 text-left text-xs">${
					it.ApprvUid1 || ""
				}</td>
            <td class="px-2 py-2 border-r border-gray-300 text-left text-xs">${
					it.ApprDt1 || ""
				}</td>
            <td class="px-2 py-2 border-r border-gray-300 text-left text-xs">${
					it.TranStatus || ""
				}</td>
            <td class="px-2 py-2 border-r border-gray-300 text-left text-xs break-words">${
					it.Payee || ""
				}</td>
            <td class="px-2 py-2 border-r border-gray-300 text-left text-xs">${
					it.ChqDt || ""
				}</td>
            <td class="px-2 py-2 border-r border-gray-300 text-left text-xs font-mono">${
					it.ChqNo || ""
				}</td>
            <td class="px-2 py-2 border-r border-gray-300 text-left text-xs font-mono">${
					it.PymtDocNo || ""
				}</td>
            <td class="px-2 py-2 border-r border-gray-300 text-left text-xs">${
					it.PpStatus || ""
				}</td>
          </tr>`;
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
      table { border-collapse:collapse; width:100%; font-size:7.5px; }
      th, td { border:1px solid #d1d5db; padding:4px 5px; word-wrap:break-word; }
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
  <div class="title">Province Pay slips inquiry report From ${curDate} (Within 7 days)</div>
  <div class="info">
    <div><strong>Province/Branch :</strong> ${provinceDisplay}/${provinceName}</div>
  </div>
  <table style="width:100%; border-collapse:collapse; font-size:7.5px; border:1px solid #d1d5db;">
    <thead>
      <tr style="background:linear-gradient(to right,#7A0000,#A52A2A); color:white;">
        <th style="padding:4px 5px;">No</th>
        <th style="padding:4px 5px;">Category</th>
        <th style="padding:4px 5px;">Dept Id</th>
        <th style="padding:4px 5px;">Transaction</th>
        <th style="padding:4px 5px;">Payslip No</th>
        <th style="padding:4px 5px; text-align:right;">Amount</th>
        <th style="padding:4px 5px;">Approved By</th>
        <th style="padding:4px 5px;">Approved Date</th>
        <th style="padding:4px 5px;">Payslip Status</th>
        <th style="padding:4px 5px;">Payee</th>
        <th style="padding:4px 5px;">Cheque Date</th>
        <th style="padding:4px 5px;">Cheque No</th>
        <th style="padding:4px 5px;">PP No</th>
        <th style="padding:4px 5px;">Cheque Status</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr>
        <td colspan="5" style="text-align:right; padding:4px 5px; border:1px solid #d1d5db;">Total</td>
        <td style="text-align:right; padding:4px 5px; border:1px solid #d1d5db; font-family:monospace;">${formatNumber(
			grandTotalAmount
		)}</td>
        <td colspan="8" style="border:1px solid #d1d5db;"></td>
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
					Province Cash Book Details Inquiry
				</h2>
			</div>

			<div className="bg-gray-50 p-4 rounded-lg mb-4 border border-gray-200">
				<div className="flex flex-col md:flex-row gap-3 items-stretch md:items-end">
					<div className="flex-1 flex items-center gap-2">
						<label
							className={`text-xs font-bold ${maroon} whitespace-nowrap`}
						>
							Date:
						</label>
						<input
							type="date"
							value={curDate}
							onChange={(e) => setCurDate(e.target.value)}
							min={minDate}
							max={maxDate}
							className="pl-3 pr-3 py-1.5 w-full rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#7A0000] transition text-sm"
						/>
						{curDate && (
							<span className="text-xs text-gray-500 whitespace-nowrap">
								through {endDateDisplay}
							</span>
						)}
					</div>
					<button
						onClick={clearAll}
						className="flex items-center justify-center gap-1 px-3 py-1.5 border border-gray-300 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm"
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
													disabled={!curDate}
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
					<div className="relative bg-white w-[95vw] sm:w-[92vw] md:w-[90vw] lg:w-[88vw] xl:w-[85vw] max-w-[1600px] rounded-2xl shadow-2xl border border-gray-200 overflow-hidden mt-16 md:mt-24 lg:mt-32 lg:ml-64 mx-auto print:relative print:w-full print:max-w-none print:rounded-none print:shadow-none print:border-none print:overflow-visible">
						{reportLoading && (
							<div className="absolute inset-0 bg-white/95 z-50 flex flex-col items-center justify-center gap-4">
								<div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#7A0000]"></div>
								<p className="text-xl font-bold text-[#7A0000]">
									Loading Report...
								</p>
								<p className="text-sm text-gray-600">
									Fetching cash book data from server
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
									Province Pay slips inquiry report From {curDate} (Within 7 days)
								</h2>
								<div className="text-sm mb-3 ml-5 mr-12">
									<span className="font-bold">Province/Branch :</span>{" "}
									{provinceDisplay}/{provinceName}
								</div>

								<div className="ml-5 mt-1 mb-5 border border-gray-200 rounded-lg overflow-x-auto print:ml-12 print:mt-12 print:overflow-visible">
									<div className="min-w-[1700px]">
										<table className="w-full text-xs border-collapse">
											<thead className={`${maroonGrad} text-white`}>
												<tr>
													<th className="px-2 py-2 border border-gray-300">No</th>
													<th className="px-2 py-2 border border-gray-300">Category</th>
													<th className="px-2 py-2 border border-gray-300">Dept Id</th>
													<th className="px-2 py-2 border border-gray-300">Transaction</th>
													<th className="px-2 py-2 border border-gray-300">Payslip No</th>
													<th className="px-2 py-2 border border-gray-300 text-right">Amount</th>
													<th className="px-2 py-2 border border-gray-300">Approved By</th>
													<th className="px-2 py-2 border border-gray-300">Approved Date</th>
													<th className="px-2 py-2 border border-gray-300">Payslip Status</th>
													<th className="px-2 py-2 border border-gray-300">Payee</th>
													<th className="px-2 py-2 border border-gray-300">Cheque Date</th>
													<th className="px-2 py-2 border border-gray-300">Cheque No</th>
													<th className="px-2 py-2 border border-gray-300">PP No</th>
													<th className="px-2 py-2 border border-gray-300">Cheque Status</th>
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
														<td className="px-2 py-2 border-l border-r border-gray-300 text-center">
															{i + 1}
														</td>
														<td className="px-2 py-2 border-r border-gray-300">
															{it.Category || ""}
														</td>
														<td className="px-2 py-2 font-mono border-r border-gray-300">
															{it.DeptId || ""}
														</td>
														<td className="px-2 py-2 text-center border-r border-gray-300">
															{formatDate(it.DocDt)}
														</td>
														<td className="px-2 py-2 font-mono border-r border-gray-300">
															{it.DocNo || ""}
														</td>
														<td className="px-2 py-2 text-right font-mono border-r border-gray-300">
															{formatNumber(it.NonTaxabl)}
														</td>
														<td className="px-2 py-2 border-r border-gray-300">
															{it.ApprvUid1 || ""}
														</td>
														<td className="px-2 py-2 border-r border-gray-300">
															{it.ApprDt1 || ""}
														</td>
														<td className="px-2 py-2 border-r border-gray-300">
															{it.TranStatus || ""}
														</td>
														<td className="px-2 py-2 border-r border-gray-300 break-words">
															{it.Payee || ""}
														</td>
														<td className="px-2 py-2 border-r border-gray-300">
															{it.ChqDt || ""}
														</td>
														<td className="px-2 py-2 font-mono border-r border-gray-300">
															{it.ChqNo || ""}
														</td>
														<td className="px-2 py-2 font-mono border-r border-gray-300">
															{it.PymtDocNo || ""}
														</td>
														<td className="px-2 py-2 border-r border-gray-300">
															{it.PpStatus || ""}
														</td>
													</tr>
												))}
											</tbody>
											<tfoot>
												<tr className="bg-[#d3d3d3] font-bold">
													<td colSpan={5} className="px-2 py-2 text-right border border-gray-300">
														Total
													</td>
													<td className="px-2 py-2 text-right font-mono border border-gray-300">
														{formatNumber(grandTotalAmount)}
													</td>
													<td colSpan={8} className="border border-gray-300"></td>
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

export default ProvinceCashBookInquiryReport;