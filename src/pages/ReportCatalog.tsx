import { useState, useMemo } from "react";
import { useReportCatalog, CatalogReportItem } from "../hooks/useReportCatalog";
import SearchBar from "../components/catalog/SearchBar";
import CategoryCard from "../components/catalog/CategoryCard";
import ReportList from "../components/catalog/ReportList";
import ReportDetails from "../components/catalog/ReportDetails";
import { Library, FolderSearch, Loader2 } from "lucide-react";

export const ReportCatalog = () => {
  const { reports, categories, loading, error } = useReportCatalog();

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedCatCode, setSelectedCatCode] = useState<string>("ALL");
  const [selectedReport, setSelectedReport] = useState<CatalogReportItem | null>(null);

  // Filtered Categories list (excluding Dashboard, Dashboard Reports, Report Catalog, and All Reports)
  const validCategories = useMemo(() => {
    return categories.filter((c) => {
      const code = (c.catCode || "").trim().toLowerCase();
      const name = (c.categoryName || "").trim().toLowerCase();
      return (
        code !== "dashboard" &&
        name !== "dashboard" &&
        name !== "main dashboard" &&
        name !== "dashboard reports" &&
        name !== "report catalog" &&
        code !== "report catalog" &&
        code !== "all reports" &&
        name !== "all reports" &&
        code !== "all" &&
        name !== "all"
      );
    });
  }, [categories]);

  // Compute category card list with an "All Reports" view-all filter card at the front
  const categoryCardsList = useMemo(() => {
    return [
      {
        catCode: "ALL",
        categoryName: "All Reports",
        totalReports: reports.length,
      },
      ...validCategories,
    ];
  }, [validCategories, reports.length]);

  // Search logic: search across all reports by Report Name or Category Name (case-insensitive)
  const filteredReports = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return reports.filter((item) => {
      const matchesReportName = (item.reportName || "").toLowerCase().includes(term);
      const matchesCategoryName = (item.categoryName || "").toLowerCase().includes(term);
      const matchesSearch = matchesReportName || matchesCategoryName;

      // If user is searching, search across ALL reports in system
      if (term) {
        return matchesSearch;
      }

      const matchesCategory =
        selectedCatCode === "ALL" ||
        item.catCode.toLowerCase() === selectedCatCode.toLowerCase();

      return matchesCategory;
    });
  }, [reports, selectedCatCode, searchTerm]);

  // Handle category card selection
  const handleSelectCategory = (catCode: string) => {
    setSelectedCatCode(catCode);
    setSelectedReport(null);
  };

  // Active selected report for details panel
  const activeReport =
    selectedReport && filteredReports.some((r) => r.repIdNo === selectedReport.repIdNo && r.repId === selectedReport.repId)
      ? selectedReport
      : filteredReports.length > 0
      ? filteredReports[0]
      : null;

  // Active category display title
  const activeCategoryTitle = useMemo(() => {
    if (searchTerm.trim()) return `Search Results (${filteredReports.length})`;
    if (selectedCatCode === "ALL") return "All System Reports";
    const found = validCategories.find(
      (c) => c.catCode.toLowerCase() === selectedCatCode.toLowerCase()
    );
    return found ? found.categoryName : selectedCatCode;
  }, [selectedCatCode, validCategories, searchTerm, filteredReports.length]);

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Header Section */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200/80 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-[#800000]/10 text-[#800000] rounded-xl">
                <Library className="w-6 h-6" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                Report Catalog
              </h1>
            </div>
            <p className="text-sm text-gray-500 max-w-2xl pt-1">
              Browse all reports available in the system. Some reports may require administrator permission.
            </p>
          </div>

          {/* Real Database Counts */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="bg-gray-100 px-3.5 py-1.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700">
              Total Categories:{" "}
              <span className="text-[#800000] font-bold">
                {validCategories.length}
              </span>
            </div>
            <div className="bg-gray-100 px-3.5 py-1.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700">
              Total Reports:{" "}
              <span className="text-[#800000] font-bold">
                {reports.length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Loading & Error States */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-gray-200/80 shadow-xs">
          <Loader2 className="w-8 h-8 text-[#800000] animate-spin mb-3" />
          <p className="text-sm text-gray-600 font-medium">
            Loading report catalog from database...
          </p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-700 text-sm">
          {error}
        </div>
      ) : (
        <>
          {/* Category Cards Section */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Report Categories ({validCategories.length})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
              {categoryCardsList.map((cat) => (
                <CategoryCard
                  key={cat.catCode}
                  catCode={cat.catCode}
                  categoryName={cat.categoryName}
                  count={cat.totalReports}
                  isSelected={selectedCatCode === cat.catCode}
                  onSelect={handleSelectCategory}
                />
              ))}
            </div>
          </div>

          {/* Search Bar Section (Positioned Directly Below Category Cards & Above Report List) */}
          <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-xs">
            <SearchBar
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              totalResults={filteredReports.length}
            />
          </div>

          {/* Report List & Details Master-Detail Layout */}
          {filteredReports.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Report List (5 cols) */}
              <div className="lg:col-span-5 h-full">
                <ReportList
                  reports={filteredReports}
                  selectedReportId={
                    activeReport ? activeReport.repIdNo || activeReport.repId : null
                  }
                  onSelectReport={setSelectedReport}
                  categoryTitle={activeCategoryTitle}
                />
              </div>

              {/* Right Column: Report Details (7 cols) */}
              <div className="lg:col-span-7 h-full">
                {activeReport && <ReportDetails report={activeReport} />}
              </div>
            </div>
          ) : (
            /* Empty State Illustration */
            <div className="bg-white rounded-2xl p-12 border border-gray-200/80 shadow-xs text-center space-y-4 max-w-lg mx-auto my-8">
              <div className="w-16 h-16 bg-red-50 text-[#800000] rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                <FolderSearch className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-gray-900">
                  {searchTerm.trim()
                    ? "No reports found matching your search."
                    : "No reports found."}
                </h3>
                <p className="text-xs text-gray-500">
                  {searchTerm.trim()
                    ? `No reports matched "${searchTerm}". Try searching by report name or category.`
                    : "There are no reports available in this category."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedCatCode("ALL");
                }}
                className="px-4 py-2 bg-[#800000] hover:bg-[#660000] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                Clear Search & Filters
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ReportCatalog;
