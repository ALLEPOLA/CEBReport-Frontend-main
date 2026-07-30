import React from "react";
import { FileText, CheckCircle, Lock, ChevronRight } from "lucide-react";
import { CatalogReportItem } from "../../hooks/useReportCatalog";

interface ReportListItemProps {
  report: CatalogReportItem;
  isSelected: boolean;
  onSelect: (report: CatalogReportItem) => void;
}

export const ReportListItem: React.FC<ReportListItemProps> = ({
  report,
  isSelected,
  onSelect,
}) => {
  return (
    <div
      onClick={() => onSelect(report)}
      className={`group relative p-3.5 rounded-lg border cursor-pointer transition-all duration-200 flex items-center justify-between ${
        isSelected
          ? "bg-gradient-to-r from-[#800000]/10 via-[#800000]/5 to-transparent border-[#800000] text-[#800000] shadow-xs"
          : "bg-white border-gray-200/80 hover:border-gray-300 hover:bg-gray-50/80 text-gray-700"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 pr-2">
        <div
          className={`p-2 rounded-md transition-colors flex-shrink-0 ${
            isSelected
              ? "bg-[#800000] text-white"
              : "bg-gray-100 text-gray-500 group-hover:bg-gray-200 group-hover:text-gray-700"
          }`}
        >
          <FileText className="w-4 h-4" />
        </div>

        <div className="min-w-0">
          <div
            className={`text-sm font-semibold truncate transition-colors ${
              isSelected ? "text-[#800000]" : "text-gray-800 group-hover:text-gray-900"
            }`}
          >
            {report.reportName}
          </div>
          <div className="text-xs text-gray-400 truncate mt-0.5">
            {report.categoryName}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {report.hasAccess ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span>Accessible</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200/60">
            <Lock className="w-3.5 h-3.5 text-amber-600" />
            <span>No Access</span>
          </span>
        )}

        <ChevronRight
          className={`w-4 h-4 transition-transform duration-200 ${
            isSelected ? "text-[#800000] translate-x-0.5" : "text-gray-300 group-hover:text-gray-400"
          }`}
        />
      </div>
    </div>
  );
};

export default ReportListItem;
