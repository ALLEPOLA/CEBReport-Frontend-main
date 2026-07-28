import React from "react";
import {
  FileText,
  CheckCircle,
  Lock,
  SlidersHorizontal,
  Info,
  ExternalLink,
} from "lucide-react";
import { CatalogReportItem } from "../../hooks/useReportCatalog";
import { SamplePreview } from "./SamplePreview";
import { useNavigate } from "react-router-dom";
import { CATEGORY_CONFIG } from "../../data/SideBarData";

interface ReportDetailsProps {
  report: CatalogReportItem;
}

const getCategoryPath = (categoryName: string): string => {
  const norm = (categoryName || "").trim();
  if (CATEGORY_CONFIG[norm]) {
    return CATEGORY_CONFIG[norm].path;
  }
  const match = Object.entries(CATEGORY_CONFIG).find(
    ([key]) => key.trim().toLowerCase() === norm.toLowerCase()
  );
  if (match) {
    return match[1].path;
  }
  // Default slug fallback
  const slug = norm
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
  return `/report/${slug || "all reports"}`;
};

export const ReportDetails: React.FC<ReportDetailsProps> = ({ report }) => {
  const navigate = useNavigate();
  const parameters = (report.parameterDescriptions || []).filter(Boolean);

  const handleGoToReport = () => {
    const targetPath = getCategoryPath(report.categoryName);
    navigate(targetPath, {
      state: {
        selectedSubtopicId: report.repIdNo,
        reportName: report.reportName,
      },
    });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs overflow-hidden h-full flex flex-col">
      {/* Header Banner - Application Maroon Theme Color */}
      <div className="p-6 bg-gradient-to-r from-[#7A0000] via-[#800000] to-[#7A0000] text-white relative overflow-hidden">
        <div className="relative z-10 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/15 text-white backdrop-blur-sm border border-white/20">
              {report.categoryName}
            </span>
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-white/90" />
            <span>{report.reportName}</span>
          </h2>
        </div>
      </div>

      {/* Main Body */}
      <div className="p-6 space-y-6 flex-1 overflow-y-auto">
        {/* Access Status Box */}
        <div className="rounded-xl border transition-all">
          {report.hasAccess ? (
            <div className="bg-emerald-50/70 border-emerald-200/80 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-emerald-600 text-white rounded-lg flex-shrink-0 mt-0.5">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-emerald-900">
                    ✅ You have access to this report.
                  </h4>
                  <p className="text-xs text-emerald-700 mt-1">
                    Your assigned role grants permission to generate this report.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoToReport}
                className="flex items-center gap-2 px-4 py-2 bg-[#800000] hover:bg-[#660000] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex-shrink-0 cursor-pointer"
              >
                <span>Generate Report</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            /* No Access Section - Information Only, NO BUTTON */
            <div className="bg-amber-50/70 border-amber-200/80 p-4 rounded-xl flex items-start gap-3">
              <div className="p-2 bg-amber-600 text-white rounded-lg flex-shrink-0 mt-0.5">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-amber-900">
                  🔒 You currently do not have permission to generate this report.
                </h4>
                <p className="text-xs text-amber-800 mt-1">
                  You do not currently have permission to access this report. Please contact the system administrator if you require access.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Description Section */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <Info className="w-4 h-4 text-gray-400" />
            <span>Description</span>
          </h3>
          <p className="text-sm text-gray-700 leading-relaxed bg-gray-50/70 p-4 rounded-xl border border-gray-100 font-normal">
            {report.description && report.description.trim()
              ? report.description
              : "No description provided for this report."}
          </p>
        </div>

        {/* Report Parameters Section - ONLY PARAMETERS WITH VALUE = 1 */}
        {parameters.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <SlidersHorizontal className="w-4 h-4 text-gray-400" />
              <span>Configurable Parameters ({parameters.length})</span>
            </h3>
            <div className="flex flex-wrap gap-2">
              {parameters.map((param, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200/80 shadow-2xs"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#800000] mr-2" />
                  {param}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Sample Output Preview Component */}
        <SamplePreview report={report} />
      </div>
    </div>
  );
};

export default ReportDetails;
