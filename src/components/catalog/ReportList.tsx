import React from "react";
import { CatalogReportItem } from "../../hooks/useReportCatalog";
import { ReportListItem } from "./ReportListItem";
import { Layers } from "lucide-react";

interface ReportListProps {
  reports: CatalogReportItem[];
  selectedReportId: string | null;
  onSelectReport: (report: CatalogReportItem) => void;
  categoryTitle: string;
}

export const ReportList: React.FC<ReportListProps> = ({
  reports,
  selectedReportId,
  onSelectReport,
  categoryTitle,
}) => {
  return (
    <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs overflow-hidden flex flex-col h-full">
      <div className="p-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-[#800000]/10 rounded-md text-[#800000]">
            <Layers className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-bold text-gray-800 tracking-wide uppercase">
            {categoryTitle}
          </h2>
        </div>
        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
          {reports.length} {reports.length === 1 ? "Report" : "Reports"}
        </span>
      </div>

      <div className="p-3 space-y-2 overflow-y-auto max-h-[600px]">
        {reports.map((report) => (
          <ReportListItem
            key={report.repIdNo + "_" + report.repId}
            report={report}
            isSelected={
              selectedReportId === report.repIdNo ||
              selectedReportId === report.repId ||
              selectedReportId === report.reportName
            }
            onSelect={onSelectReport}
          />
        ))}
      </div>
    </div>
  );
};

export default ReportList;
