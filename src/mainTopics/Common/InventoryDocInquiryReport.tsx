// InventoryDocInquiryReport.tsx
import React, {useState} from "react";
import {Download, Printer, Search} from "lucide-react";
import {toast} from "react-toastify";

interface InventoryDocInquiryItem {
	DocNo: string | null;
	DocPf: string | null;
	TrxDt: string | null;
	EntBy: string | null;
	ModiBy: string | null;
	ApprvUid1: string | null;
	IsRef: string | null;
	DesDeptId: string | null;
	IssueTo: string | null;
	RcRef: string | null;
	SrcDocNo: string | null;
	SrcDeptId: string | null;
	Ref1: string | null;
	Ref2: string | null;
	Ref3: string | null;
	Ref4: string | null;
	TrxnVal: number | null;
	Remarks: string | null;
	YrInd: number | null;
	MthInd: number | null;
	TrxType: string | null;
	MatCd: string | null;
	TrxQty: number | null;
	UnitCost: number | null;
	TrxVal: number | null;
	WrhCd: string | null;
	GradeCd: string | null;
	TranStatus: string | null;
}

/* ────── Constants ────── */
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
	if (isNaN(d.getTime())) return "";
	const months = [
		"Jan", "Feb", "Mar", "Apr", "May", "Jun",
		"Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
	];
	const day = String(d.getDate()).padStart(2, "0");
	return `${day}-${months[d.getMonth()]}-${d.getFullYear()}`;
};

const csvEscape = (val: string | number | null | undefined): string => {
	if (val == null) return "";
	const str = String(val);
	if (/[,\n"]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
	return str;
};

/* ────── MAIN COMPONENT ────── */
const InventoryDocInquiryReport: React.FC = () => {
	const [docNoInput, setDocNoInput] = useState("");
	const [reportData, setReportData] = useState<InventoryDocInquiryItem[]>([]);
	const [reportLoading, setReportLoading] = useState(false);
	const [showReport, setShowReport] = useState(false);

	const maroon = "text-[#7A0000]";
	const maroonGrad = "bg-gradient-to-r from-[#7A0000] to-[#A52A2A]";

	/* ────── Fetch report ────── */
	const fetchReport = async () => {
		if (!docNoInput.trim()) {
			toast.error("Please enter a Document No.");
			return;
		}

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

		setReportLoading(true);
		setReportData([]);
		setShowReport(true);

		try {
			const docNoParam = encodeURIComponent(docNoInput.trim());
			const url = `/misapi/api/inventorydocinquiry/report?docNo=${docNoParam}`;

			const res = await fetch(url, {credentials: "include", signal: controller.signal});
			clearTimeout(timeoutId);

			if (!res.ok) {
				const txt = await res.text();
				throw new Error(`HTTP ${res.status}: ${txt}`);
			}

			const json = await res.json();
			if (!json.success) throw new Error(json.message || "Failed to load data");

			const items: InventoryDocInquiryItem[] = json.data || [];

			if (items.length === 0) {
				toast.warn("No records found for that Document No.");
				setShowReport(false);
				return;
			}

			setReportData(items);
			toast.success(`${items.length} line item(s) loaded successfully.`);
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

	const closeReport = () => {
		setShowReport(false);
		setReportData([]);
		setReportLoading(false);
	};

	// Header-level fields are identical across every row for this doc_no,
	// so take them from the first row.
	const head = reportData[0];
	const grandTotalTrxVal = reportData.reduce((s, r) => s + (r.TrxVal || 0), 0);

	/* ────── CSV download ────── */
	const downloadCSV = () => {
		if (!head) return;

		const titleRows = [
			`Document Inquiry Report(Issue/ISS-CL/RTV/RTV-CL/GRN/GRN-CL) - Document No : ${head.DocNo}`,
			"",
			`Document Profile,${csvEscape(head.DocPf)},Transaction Type,${csvEscape(head.TrxType)},Year,${csvEscape(
				head.YrInd
			)},Month,${csvEscape(head.MthInd)},Status,${csvEscape(head.TranStatus)}`,
			`Document No.,${csvEscape(head.DocNo)},Entered by,${csvEscape(head.EntBy)},Reference 1,${csvEscape(
				head.Ref1
			)},Ref_2,${csvEscape(head.Ref2)}`,
			`Transaction Date,${csvEscape(formatDate(head.TrxDt))},Validated by,${csvEscape(
				head.ModiBy
			)},Reference 3,${csvEscape(head.Ref3)},Ref_4,${csvEscape(head.Ref4)}`,
			`Transaction Amount,${csvEscape(formatNumber(head.TrxnVal))},Approved By,${csvEscape(
				head.ApprvUid1
			)},Remarks,${csvEscape(head.Remarks)}`,
			`Iss Ref / Job No,${csvEscape(head.IsRef)},Sorc_Doc_No,${csvEscape(
				head.SrcDocNo
			)},Sorc_Dept_Id,${csvEscape(head.SrcDeptId)},Des_Dept_ID,${csvEscape(
				head.DesDeptId
			)},Issue type,${csvEscape(head.IssueTo)}`,
			`Rc Ref,${csvEscape(head.RcRef)},,,,,,,Whare House,${csvEscape(head.WrhCd)}`,
			"",
		];

		const headers = ["Material Code", "Grade Code", "Trx Qty", "Unit Cost", "Trxn Value"];
		const rows: string[] = [headers.join(",")];

		reportData.forEach((it) => {
			rows.push(
				[
					csvEscape(it.MatCd),
					csvEscape(it.GradeCd),
					csvEscape(formatNumber(it.TrxQty)),
					csvEscape(formatNumber(it.UnitCost)),
					csvEscape(formatNumber(it.TrxVal)),
				].join(",")
			);
		});

		rows.push(`Total,,,,${csvEscape(formatNumber(grandTotalTrxVal))}`);

		const csv = [...titleRows, ...rows].join("\n");
		const blob = new Blob([csv], {type: "text/csv;charset=utf-8;"});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `DocInquiry_${head.DocNo?.replace(/\//g, "_")}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	};

	/* ────── PDF print ────── */
	const printPDF = () => {
		if (!head) return;

		let matRows = "";
		reportData.forEach((it, i) => {
			matRows += `
          <tr class="${i % 2 ? "bg-white" : "bg-gray-50"}">
            <td class="cell">${it.MatCd || ""}</td>
            <td class="cell">${it.GradeCd || ""}</td>
            <td class="cell right mono">${formatNumber(it.TrxQty)}</td>
            <td class="cell right mono">${formatNumber(it.UnitCost)}</td>
            <td class="cell right mono">${formatNumber(it.TrxVal)}</td>
          </tr>`;
		});

		const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    @media print {
      @page { margin: 10mm 8mm 12mm 8mm; }
      body { margin:0; font-family:Arial,Helvetica,sans-serif; font-size:10px; color:#111; }
      .title { text-align:left; font-weight:bold; font-size:13px; margin-bottom:10px; text-decoration:underline; }
      table.head { border-collapse:collapse; width:100%; font-size:9.5px; margin-bottom:14px; }
      table.head td { border:1px solid #333; padding:5px 8px; vertical-align:top; }
      .lbl { font-weight:bold; width:14%; background:#f5f5f5; }
      table.mat { border-collapse:collapse; width:100%; font-size:9.5px; }
      .cell { border:1px solid #333; padding:5px 8px; }
      .right { text-align:right; }
      .mono { font-family:monospace; }
      thead th { border:1px solid #333; background:#e5e5e5; padding:5px 8px; font-weight:bold; text-align:left; }
      tfoot td { border:1px solid #333; padding:5px 8px; font-weight:bold; }
    }
  </style>
</head>
<body>
  <div class="title">Document Inquiry Report(Issue/ISS-CL/RTV/RTV-CL/GRN/GRN-CL) - &nbsp;Document No : ${head.DocNo}</div>
  <table class="head">
    <tr>
      <td class="lbl">Document Profile</td><td>${head.DocPf || ""}</td>
      <td class="lbl">Transcation Type</td><td>${head.TrxType || ""}</td>
      <td class="lbl">Year</td><td>${formatNumber(head.YrInd).replace(".00", "")}</td>
      <td class="lbl">Month</td><td>${head.MthInd ?? ""}</td>
      <td class="lbl">Status</td><td>${head.TranStatus || ""}</td>
    </tr>
    <tr>
      <td class="lbl">Document No.</td><td>${head.DocNo || ""}</td>
      <td class="lbl">Entereded by</td><td>${head.EntBy || ""}</td>
      <td class="lbl">Reference 1</td><td>${head.Ref1 || ""}</td>
      <td class="lbl">Ref_2</td><td colspan="3">${head.Ref2 || ""}</td>
    </tr>
    <tr>
      <td class="lbl">Transaction Date</td><td>${formatDate(head.TrxDt)}</td>
      <td class="lbl">Validated by</td><td>${head.ModiBy || ""}</td>
      <td class="lbl">Reference 3</td><td>${head.Ref3 || ""}</td>
      <td class="lbl">Ref_4</td><td colspan="3">${head.Ref4 || ""}</td>
    </tr>
    <tr>
      <td class="lbl">Transaction Amount</td><td>${formatNumber(head.TrxnVal)}</td>
      <td class="lbl">Approved By</td><td>${head.ApprvUid1 || ""}</td>
      <td class="lbl">Remarks</td><td colspan="5">${head.Remarks || ""}</td>
    </tr>
    <tr>
      <td class="lbl">Iss Ref / Job No</td><td>${head.IsRef || ""}</td>
      <td class="lbl">Sorc_Doc_No</td><td>${head.SrcDocNo || ""}</td>
      <td class="lbl">Sorc_Dept_Id</td><td>${head.SrcDeptId || ""}</td>
      <td class="lbl">Des_Dept_ID</td><td>${head.DesDeptId || ""}</td>
      <td class="lbl">Issue type</td><td>${head.IssueTo || ""}</td>
    </tr>
    <tr>
      <td class="lbl">Rc Ref</td><td>${head.RcRef || ""}</td>
      <td colspan="6"></td>
      <td class="lbl">Whare House</td><td>${head.WrhCd || ""}</td>
    </tr>
  </table>

  <table class="mat">
    <thead>
      <tr>
        <th style="width:20%;">Material Code</th>
        <th style="width:20%;">Grade Code</th>
        <th style="width:20%; text-align:right;">Trx Qty</th>
        <th style="width:20%; text-align:right;">Unit Cost</th>
        <th style="width:20%; text-align:right;">Trxn Value</th>
      </tr>
    </thead>
    <tbody>${matRows}</tbody>
    <tfoot>
      <tr>
        <td colspan="4" class="right">Total</td>
        <td class="right mono">${formatNumber(grandTotalTrxVal)}</td>
      </tr>
    </tfoot>
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

	/* ────── RENDER ────── */
	return (
		<div className="max-w-5xl mx-auto p-6 bg-white rounded-xl shadow border border-gray-200 text-sm font-sans">
			<div className="flex justify-between items-center mb-4">
				<h2 className={`text-xl font-bold ${maroon}`}>Inventory Document Inquiry</h2>
			</div>

			<div className="bg-gray-50 p-4 rounded-lg mb-4 border border-gray-200">
				<div className="flex flex-col md:flex-row gap-3 items-end">
					<div className="flex flex-col flex-1">
						<label className={`text-xs font-bold ${maroon} mb-1`}>Document No</label>
						<input
							type="text"
							value={docNoInput}
							onChange={(e) => setDocNoInput(e.target.value)}
							onKeyDown={(e) => e.key === "Enter" && fetchReport()}
							placeholder="e.g. 510.11/ISS/26/0001"
							className="pl-3 pr-3 py-1.5 w-full rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#7A0000] transition text-sm"
						/>
					</div>
					<button
						onClick={fetchReport}
						disabled={!docNoInput.trim()}
						className={`px-4 py-1.5 ${maroonGrad} text-white rounded-md text-sm font-medium hover:brightness-110 transition shadow disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1`}
					>
						<Search className="w-4 h-4" /> Search
					</button>
				</div>
			</div>

			{/* ────── REPORT ────── */}
			{showReport && (
				<div className="border border-gray-200 rounded-lg p-4 relative">
					{reportLoading && (
						<div className="flex flex-col items-center justify-center py-16 gap-4">
							<div className="animate-spin rounded-full h-14 w-14 border-b-4 border-[#7A0000]"></div>
							<p className="text-lg font-bold text-[#7A0000]">Loading Document...</p>
						</div>
					)}

					{!reportLoading && head && (
						<>
							<div className="flex justify-end gap-3 mb-4">
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
							</div>

							<h3 className={`text-base font-bold underline mb-4 ${maroon}`}>
								Document Inquiry Report(Issue/ISS-CL/RTV/RTV-CL/GRN/GRN-CL) - Document No :{" "}
								{head.DocNo}
							</h3>

							{/* Header info grid, matching the reference layout */}
							<div className="border border-gray-400 text-xs md:text-sm mb-6">
								<div className="grid grid-cols-10 border-b border-gray-400">
									<div className="col-span-2 font-bold bg-gray-100 border-r border-gray-400 px-2 py-1.5">
										Document Profile
									</div>
									<div className="col-span-1 border-r border-gray-400 px-2 py-1.5">{head.DocPf}</div>
									<div className="col-span-2 font-bold bg-gray-100 border-r border-gray-400 px-2 py-1.5">
										Transcation Type
									</div>
									<div className="col-span-1 border-r border-gray-400 px-2 py-1.5">{head.TrxType}</div>
									<div className="col-span-1 font-bold bg-gray-100 border-r border-gray-400 px-2 py-1.5">
										Year
									</div>
									<div className="col-span-1 border-r border-gray-400 px-2 py-1.5">{head.YrInd}</div>
									<div className="col-span-1 font-bold bg-gray-100 px-2 py-1.5">Status</div>
								</div>
								<div className="grid grid-cols-10 border-b border-gray-400">
									<div className="col-span-2 font-bold bg-gray-100 border-r border-gray-400 px-2 py-1.5">
										Document No.
									</div>
									<div className="col-span-1 border-r border-gray-400 px-2 py-1.5">{head.DocNo}</div>
									<div className="col-span-2 font-bold bg-gray-100 border-r border-gray-400 px-2 py-1.5">
										Entereded by
									</div>
									<div className="col-span-1 border-r border-gray-400 px-2 py-1.5">{head.EntBy}</div>
									<div className="col-span-1 font-bold bg-gray-100 border-r border-gray-400 px-2 py-1.5">
										Reference 1
									</div>
									<div className="col-span-1 border-r border-gray-400 px-2 py-1.5">{head.Ref1}</div>
									<div className="col-span-1 font-bold bg-gray-100 px-2 py-1.5">
										Ref_2: {head.Ref2}
									</div>
								</div>
								<div className="grid grid-cols-10 border-b border-gray-400">
									<div className="col-span-2 font-bold bg-gray-100 border-r border-gray-400 px-2 py-1.5">
										Transaction Date
									</div>
									<div className="col-span-1 border-r border-gray-400 px-2 py-1.5">
										{formatDate(head.TrxDt)}
									</div>
									<div className="col-span-2 font-bold bg-gray-100 border-r border-gray-400 px-2 py-1.5">
										Validated by
									</div>
									<div className="col-span-1 border-r border-gray-400 px-2 py-1.5">{head.ModiBy}</div>
									<div className="col-span-1 font-bold bg-gray-100 border-r border-gray-400 px-2 py-1.5">
										Reference 3
									</div>
									<div className="col-span-1 border-r border-gray-400 px-2 py-1.5">{head.Ref3}</div>
									<div className="col-span-1 font-bold bg-gray-100 px-2 py-1.5">
										Ref_4: {head.Ref4}
									</div>
								</div>
								<div className="grid grid-cols-10 border-b border-gray-400">
									<div className="col-span-2 font-bold bg-gray-100 border-r border-gray-400 px-2 py-1.5">
										Transaction Amount
									</div>
									<div className="col-span-1 border-r border-gray-400 px-2 py-1.5">
										{formatNumber(head.TrxnVal)}
									</div>
									<div className="col-span-2 font-bold bg-gray-100 border-r border-gray-400 px-2 py-1.5">
										Approved By
									</div>
									<div className="col-span-1 border-r border-gray-400 px-2 py-1.5">{head.ApprvUid1}</div>
									<div className="col-span-1 font-bold bg-gray-100 border-r border-gray-400 px-2 py-1.5">
										Remarks
									</div>
									<div className="col-span-2 px-2 py-1.5">{head.Remarks}</div>
								</div>
								<div className="grid grid-cols-10 border-b border-gray-400">
									<div className="col-span-2 font-bold bg-gray-100 border-r border-gray-400 px-2 py-1.5">
										Iss Ref / Job No
									</div>
									<div className="col-span-1 border-r border-gray-400 px-2 py-1.5">{head.IsRef}</div>
									<div className="col-span-2 font-bold bg-gray-100 border-r border-gray-400 px-2 py-1.5">
										Sorc_Doc_No
									</div>
									<div className="col-span-1 border-r border-gray-400 px-2 py-1.5">{head.SrcDocNo}</div>
									<div className="col-span-1 font-bold bg-gray-100 border-r border-gray-400 px-2 py-1.5">
										Sorc_Dept_Id
									</div>
									<div className="col-span-1 border-r border-gray-400 px-2 py-1.5">{head.SrcDeptId}</div>
									<div className="col-span-1 font-bold bg-gray-100 px-2 py-1.5">
										{head.IssueTo}
									</div>
								</div>
								<div className="grid grid-cols-10">
									<div className="col-span-2 font-bold bg-gray-100 border-r border-gray-400 px-2 py-1.5">
										Rc Ref
									</div>
									<div className="col-span-1 border-r border-gray-400 px-2 py-1.5">{head.RcRef}</div>
									<div className="col-span-4 border-r border-gray-400 px-2 py-1.5"></div>
									<div className="col-span-2 font-bold bg-gray-100 border-r border-gray-400 px-2 py-1.5">
										Whare House
									</div>
									<div className="col-span-1 px-2 py-1.5">{head.WrhCd}</div>
								</div>
							</div>

							{/* Material line items */}
							<div className="border border-gray-400">
								<table className="w-full text-xs md:text-sm border-collapse">
									<thead className={`${maroonGrad} text-white`}>
										<tr>
											<th className="px-3 py-2 border border-gray-400 text-left">Material Code</th>
											<th className="px-3 py-2 border border-gray-400 text-left">Grade Code</th>
											<th className="px-3 py-2 border border-gray-400 text-right">Trx Qty</th>
											<th className="px-3 py-2 border border-gray-400 text-right">Unit Cost</th>
											<th className="px-3 py-2 border border-gray-400 text-right">Trxn Value</th>
										</tr>
									</thead>
									<tbody>
										{reportData.map((it, i) => (
											<tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
												<td className="px-3 py-2 border border-gray-400">{it.MatCd}</td>
												<td className="px-3 py-2 border border-gray-400">{it.GradeCd}</td>
												<td className="px-3 py-2 border border-gray-400 text-right font-mono">
													{formatNumber(it.TrxQty)}
												</td>
												<td className="px-3 py-2 border border-gray-400 text-right font-mono">
													{formatNumber(it.UnitCost)}
												</td>
												<td className="px-3 py-2 border border-gray-400 text-right font-mono">
													{formatNumber(it.TrxVal)}
												</td>
											</tr>
										))}
									</tbody>
									<tfoot>
										<tr className="bg-gray-100 font-bold">
											<td colSpan={4} className="px-3 py-2 border border-gray-400 text-right">
												Total
											</td>
											<td className="px-3 py-2 border border-gray-400 text-right font-mono">
												{formatNumber(grandTotalTrxVal)}
											</td>
										</tr>
									</tfoot>
								</table>
							</div>
						</>
					)}
				</div>
			)}
		</div>
	);
};

export default InventoryDocInquiryReport;