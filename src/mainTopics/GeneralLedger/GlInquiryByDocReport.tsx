// GlInquiryByDocReport.tsx
import React, {useState} from "react";
import {Download, Printer, X, Search} from "lucide-react";
import {toast} from "react-toastify";

interface GlInquiryByDocItem {
	DocNo: string | null;
	DeptId: string | null;
	DocPf: string | null;
	DocDt: string | null;
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
const FETCH_TIMEOUT_MS = 60000;

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

/* ────── MAIN COMPONENT ────── */
const GlInquiryByDocReport: React.FC = () => {
	const [docNoInput, setDocNoInput] = useState("");
	const [searchedDocNo, setSearchedDocNo] = useState("");
	const [reportData, setReportData] = useState<GlInquiryByDocItem[]>([]);
	const [reportLoading, setReportLoading] = useState(false);
	const [showReport, setShowReport] = useState(false);

	const maroon = "text-[#7A0000]";
	const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";

	/* ────── Input validation ────── */
	const validateInputs = (): boolean => {
		if (!docNoInput.trim()) {
			toast.error("Please enter a Document No.");
			return false;
		}
		return true;
	};

	/* ────── Fetch report ────── */
	const fetchReport = async () => {
		if (!validateInputs()) return;

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

		const trimmedDocNo = docNoInput.trim();
		setSearchedDocNo(trimmedDocNo);
		setReportLoading(true);
		setReportData([]);
		setShowReport(true);

		try {
			const url = `/misapi/api/glinquirybydoc/report?docNo=${encodeURIComponent(
				trimmedDocNo
			)}`;

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

			const items: GlInquiryByDocItem[] = json.data || [];
			if (items.length > MAX_RECORDS)
				throw new Error(
					`Too many records (${items.length}). Please refine your search.`
				);

			if (items.length === 0) {
				toast.warn("No records found for the given Document No.");
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

	const clearAll = () => {
		setDocNoInput("");
		setSearchedDocNo("");
		setShowReport(false);
		setReportData([]);
		toast.info("Cleared.");
	};

	const closeReport = () => {
		setShowReport(false);
		setReportData([]);
		setReportLoading(false);
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") fetchReport();
	};

	const grandTotalTrxVal = reportData.reduce((s, r) => s + (r.TrxVal || 0), 0);
	const grandTotalDrAmt = reportData.reduce((s, r) => s + (r.DrAmt || 0), 0);
	const grandTotalCrAmt = reportData.reduce((s, r) => s + (r.CrAmt || 0), 0);

	/* ────── CSV download ────── */
	const downloadCSV = () => {
		if (reportData.length === 0) return;

		const titleRows = [
			`General Ledger transaction inquiry document no - ${searchedDocNo}`,
			"",
		];

		const headers = [
			"No",
			"Document No.",
			"Type",
			"Document Date",
			"Ledger Code",
			"Total Amount",
			"Debit Amount",
			"Credit Amount",
			"Status",
			"Sub A/C",
			"Dept. ID",
			"Remarks",
		];
		const rows: string[] = [headers.join(",")];

		reportData.forEach((it, i) => {
			rows.push(
				[
					csvEscape(i + 1),
					csvEscape(it.DocNo),
					csvEscape(it.DocPf),
					csvEscape(formatDate(it.DocDt)),
					csvEscape(it.GlCd),
					csvEscape(formatNumber(it.TrxVal)),
					csvEscape(formatNumber(it.DrAmt)),
					csvEscape(formatNumber(it.CrAmt)),
					csvEscape(it.TranStatus),
					csvEscape(it.SubAc),
					csvEscape(it.DeptId),
					csvEscape(it.Remarks),
				].join(",")
			);
		});

		rows.push(
			`Total,,,,,${csvEscape(formatNumber(grandTotalTrxVal))},${csvEscape(
				formatNumber(grandTotalDrAmt)
			)},${csvEscape(formatNumber(grandTotalCrAmt))},,,,`
		);

		const csv = [...titleRows, ...rows].join("\n");
		const blob = new Blob([csv], {type: "text/csv;charset=utf-8;"});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `GlInquiryByDoc_${searchedDocNo.replace(/[\/\\]/g, "_")}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	};

	/* ────── PDF print ────── */
	const printPDF = () => {
		if (reportData.length === 0) return;

		let rows = "";
		reportData.forEach((it, i) => {
			rows += `
          <tr class="${i % 2 ? "bg-white" : "bg-gray-50"}">
            <td class="px-3 py-2 border-l border-r border-gray-300 text-center text-xs">${
					i + 1
				}</td>
            <td class="px-3 py-2 border-r border-gray-300 text-left text-xs font-mono">${
					it.DocNo || ""
				}</td>
            <td class="px-3 py-2 border-r border-gray-300 text-left text-xs">${
					it.DocPf || ""
				}</td>
            <td class="px-3 py-2 border-r border-gray-300 text-center text-xs">${formatDate(
					it.DocDt
				)}</td>
            <td class="px-3 py-2 border-r border-gray-300 text-left text-xs font-mono">${
					it.GlCd || ""
				}</td>
            <td class="px-3 py-2 border-r border-gray-300 text-right text-xs font-mono">${formatNumber(
					it.TrxVal
				)}</td>
            <td class="px-3 py-2 border-r border-gray-300 text-right text-xs font-mono">${formatNumber(
					it.DrAmt
				)}</td>
            <td class="px-3 py-2 border-r border-gray-300 text-right text-xs font-mono">${formatNumber(
					it.CrAmt
				)}</td>
            <td class="px-3 py-2 border-r border-gray-300 text-left text-xs">${
					it.TranStatus || ""
				}</td>
            <td class="px-3 py-2 border-r border-gray-300 text-left text-xs font-mono">${
					it.SubAc || ""
				}</td>
            <td class="px-3 py-2 border-r border-gray-300 text-left text-xs font-mono">${
					it.DeptId || ""
				}</td>
            <td class="px-3 py-2 border-r border-gray-300 text-left text-xs break-words">${
					it.Remarks || ""
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
      table { border-collapse:collapse; width:100%; font-size:8px; }
      th, td { border:1px solid #d1d5db; padding:5px 6px; word-wrap:break-word; }
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
  <div class="title">General Ledger transaction inquiry document no - ${searchedDocNo}</div>
  <table style="width:100%; border-collapse:collapse; font-size:8px; border:1px solid #d1d5db;">
    <thead>
      <tr style="background:linear-gradient(to right,#7A0000,#A52A2A); color:white;">
        <th style="padding:5px 6px; width:4%;">No</th>
        <th style="padding:5px 6px; width:14%;">Document No.</th>
        <th style="padding:5px 6px; width:7%;">Type</th>
        <th style="padding:5px 6px; width:9%;">Document Date</th>
        <th style="padding:5px 6px; width:8%;">Ledger Code</th>
        <th style="padding:5px 6px; width:9%; text-align:right;">Total Amount</th>
        <th style="padding:5px 6px; width:9%; text-align:right;">Debit Amount</th>
        <th style="padding:5px 6px; width:9%; text-align:right;">Credit Amount</th>
        <th style="padding:5px 6px; width:10%;">Status</th>
        <th style="padding:5px 6px; width:7%;">Sub A/C</th>
        <th style="padding:5px 6px; width:7%;">Dept. ID</th>
        <th style="padding:5px 6px; width:7%;">Remarks</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr>
        <td colspan="5" style="text-align:right; padding:5px 6px; border:1px solid #d1d5db;">Total</td>
        <td style="text-align:right; padding:5px 6px; border:1px solid #d1d5db; font-family:monospace;">${formatNumber(
			grandTotalTrxVal
		)}</td>
        <td style="text-align:right; padding:5px 6px; border:1px solid #d1d5db; font-family:monospace;">${formatNumber(
			grandTotalDrAmt
		)}</td>
        <td style="text-align:right; padding:5px 6px; border:1px solid #d1d5db; font-family:monospace;">${formatNumber(
			grandTotalCrAmt
		)}</td>
        <td colspan="3" style="border:1px solid #d1d5db;"></td>
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
					General Ledger Inquiry by Document No
				</h2>
			</div>

			<div className="bg-gray-50 p-4 rounded-lg mb-4 border border-gray-200">
				<div className="flex flex-col md:flex-row gap-3 items-stretch md:items-end">
					<div className="flex-1 flex items-center gap-2">
						<label
							className={`text-xs font-bold ${maroon} whitespace-nowrap`}
						>
							Document No:
						</label>
						<input
							type="text"
							value={docNoInput}
							onChange={(e) => setDocNoInput(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder="e.g. 914.00/PSA/26/0100"
							className="pl-3 pr-3 py-1.5 w-full rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#7A0000] transition text-sm"
						/>
					</div>
					<div className="flex gap-2">
						<button
							onClick={fetchReport}
							disabled={reportLoading}
							className={`flex items-center justify-center gap-1 px-4 py-1.5 rounded-md text-sm font-medium text-white shadow disabled:opacity-50 disabled:cursor-not-allowed ${maroonGrad} hover:brightness-110`}
						>
							<Search className="w-4 h-4" /> Search
						</button>
						<button
							onClick={clearAll}
							className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm"
						>
							<X className="w-3 h-3" /> Clear
						</button>
					</div>
				</div>
			</div>

			{/* ────── REPORT MODAL ────── */}
			{showReport && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/90 print:static print:inset-auto print:p-0 print:bg-white">
					<div className="relative bg-white w-[95vw] sm:w-[90vw] md:w-[85vw] lg:w-[80vw] xl:w-[75vw] max-w-7xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden mt-20 md:mt-32 lg:mt-40 lg:ml-64 mx-auto print:relative print:w-full print:max-w-none print:rounded-none print:shadow-none print:border-none print:overflow-visible">
						{reportLoading && (
							<div className="absolute inset-0 bg-white/95 z-50 flex flex-col items-center justify-center gap-4">
								<div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#7A0000]"></div>
								<p className="text-xl font-bold text-[#7A0000]">
									Loading Report...
								</p>
								<p className="text-sm text-gray-600">
									Fetching general ledger data from server
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
									General Ledger transaction inquiry document no - {searchedDocNo}
								</h2>

								<div className="ml-5 mt-1 mb-5 border border-gray-200 rounded-lg overflow-x-auto print:ml-12 print:mt-12 print:overflow-visible">
									<div className="min-w-[1400px]">
										<table className="w-full text-xs border-collapse">
											<thead className={`${maroonGrad} text-white`}>
												<tr>
													<th className="px-4 py-2 border border-gray-300" style={{width: "4%"}}>
														No
													</th>
													<th className="px-4 py-2 border border-gray-300" style={{width: "14%"}}>
														Document No.
													</th>
													<th className="px-4 py-2 border border-gray-300" style={{width: "7%"}}>
														Type
													</th>
													<th className="px-4 py-2 border border-gray-300" style={{width: "9%"}}>
														Document Date
													</th>
													<th className="px-4 py-2 border border-gray-300" style={{width: "8%"}}>
														Ledger Code
													</th>
													<th className="px-4 py-2 border border-gray-300 text-right" style={{width: "9%"}}>
														Total Amount
													</th>
													<th className="px-4 py-2 border border-gray-300 text-right" style={{width: "9%"}}>
														Debit Amount
													</th>
													<th className="px-4 py-2 border border-gray-300 text-right" style={{width: "9%"}}>
														Credit Amount
													</th>
													<th className="px-4 py-2 border border-gray-300" style={{width: "10%"}}>
														Status
													</th>
													<th className="px-4 py-2 border border-gray-300" style={{width: "7%"}}>
														Sub A/C
													</th>
													<th className="px-4 py-2 border border-gray-300" style={{width: "7%"}}>
														Dept. ID
													</th>
													<th className="px-4 py-2 border border-gray-300" style={{width: "7%"}}>
														Remarks
													</th>
												</tr>
											</thead>
											<tbody>
												{reportData.map((it, i) => (
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
														<td className="px-4 py-2 font-mono border-r border-gray-300">
															{it.DocNo || ""}
														</td>
														<td className="px-4 py-2 border-r border-gray-300">
															{it.DocPf || ""}
														</td>
														<td className="px-4 py-2 text-center border-r border-gray-300">
															{formatDate(it.DocDt)}
														</td>
														<td className="px-4 py-2 font-mono border-r border-gray-300">
															{it.GlCd || ""}
														</td>
														<td className="px-4 py-2 text-right font-mono border-r border-gray-300">
															{formatNumber(it.TrxVal)}
														</td>
														<td className="px-4 py-2 text-right font-mono border-r border-gray-300">
															{formatNumber(it.DrAmt)}
														</td>
														<td className="px-4 py-2 text-right font-mono border-r border-gray-300">
															{formatNumber(it.CrAmt)}
														</td>
														<td className="px-4 py-2 border-r border-gray-300">
															{it.TranStatus || ""}
														</td>
														<td className="px-4 py-2 font-mono border-r border-gray-300">
															{it.SubAc || ""}
														</td>
														<td className="px-4 py-2 font-mono border-r border-gray-300">
															{it.DeptId || ""}
														</td>
														<td className="px-4 py-2 border-r border-gray-300 break-words">
															{it.Remarks || ""}
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
														{formatNumber(grandTotalTrxVal)}
													</td>
													<td className="px-4 py-2 text-right font-mono border border-gray-300">
														{formatNumber(grandTotalDrAmt)}
													</td>
													<td className="px-4 py-2 text-right font-mono border border-gray-300">
														{formatNumber(grandTotalCrAmt)}
													</td>
													<td colSpan={3} className="border border-gray-300"></td>
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

export default GlInquiryByDocReport;