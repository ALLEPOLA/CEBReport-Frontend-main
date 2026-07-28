import React, { useState, useEffect } from "react";
import { ImageOff, FileText, ZoomIn, X, Plus, Minus, RotateCcw } from "lucide-react";
import { CatalogReportItem } from "../../hooks/useReportCatalog";

interface SamplePreviewProps {
  report: CatalogReportItem;
}

export const resolveImagePath = (rawPath: unknown): string | null => {
  if (!rawPath || typeof rawPath !== "string") return null;
  let path = rawPath.trim();
  if (!path) return null;

  // 1. Data URLs or Absolute HTTP/HTTPS URLs
  if (
    path.startsWith("data:") ||
    path.startsWith("http://") ||
    path.startsWith("https://")
  ) {
    return path;
  }

  // Normalize all backslashes to forward slashes
  path = path.replace(/\\/g, "/");

  // Fix common typo in database sample report paths (e.g. CashSheetRepoet -> CashSheetReport)
  path = path.replace(/Repoet/gi, "Report");

  // If path contains src/assets
  if (path.includes("src/assets/")) {
    const assetPath = path.substring(path.indexOf("src/assets/"));
    return `/${assetPath}`;
  }

  // If path contains SampleReports
  if (path.includes("SampleReports/")) {
    const samplePath = path.substring(path.indexOf("SampleReports/"));
    return `/src/assets/${samplePath}`;
  }

  // Extract filename
  const filename = path.split("/").pop();

  // If simple filename or ends with image extension
  if (filename && /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(filename)) {
    return `/src/assets/SampleReports/${filename}`;
  }

  // Relative paths starting with assets/
  if (path.startsWith("assets/")) {
    return `/src/${path}`;
  }

  // Absolute paths starting with /
  if (path.startsWith("/")) {
    return path;
  }

  // Default fallback through API prefix
  return `/misapi/${path}`;
};

export const SamplePreview: React.FC<SamplePreviewProps> = ({ report }) => {
  const [imageError, setImageError] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const resolvedUrl = resolveImagePath(report.path);

  // Reset image error state and modal whenever selected report changes
  useEffect(() => {
    setImageError(false);
    setIsModalOpen(false);
    setZoomLevel(1);
  }, [report.repIdNo, report.repId, report.path]);

  // Handle ESC key press to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsModalOpen(false);
      }
    };
    if (isModalOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isModalOpen]);

  const adjustZoom = (delta: number) => {
    setZoomLevel((prev) => Math.min(3, Math.max(1, Number((prev + delta).toFixed(2)))));
  };

  return (
    <>
      <div className="bg-gradient-to-b from-gray-50/70 to-white border border-gray-200/90 rounded-xl overflow-hidden mt-4">
        {/* Top Header */}
        <div className="p-3 bg-gray-100/70 border-b border-gray-200/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-500" />
            <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Report Output
            </span>
          </div>
          {resolvedUrl && !imageError && (
            <span className="text-[11px] text-gray-400 font-medium hidden sm:inline">
              Click image to enlarge
            </span>
          )}
        </div>

        {/* Output Content */}
        <div className="p-4 flex items-center justify-center min-h-[200px]">
          {resolvedUrl && !imageError ? (
            <div
              onClick={() => setIsModalOpen(true)}
              className="group relative w-full flex justify-center cursor-pointer rounded-lg overflow-hidden"
              title="Click to open enlarged preview"
            >
              <img
                src={resolvedUrl}
                alt={`${report.reportName} Screenshot`}
                onError={() => setImageError(true)}
                className="max-w-full max-h-[500px] object-contain rounded-lg border border-gray-200 shadow-2xs group-hover:opacity-95 transition-opacity"
              />
              {/* Subtle hover overlay badge */}
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-medium text-xs rounded-lg backdrop-blur-[1px]">
                <div className="bg-black/70 px-3.5 py-1.5 rounded-full flex items-center gap-1.5 shadow-md">
                  <ZoomIn className="w-4 h-4" />
                  <span>Click to Enlarge</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center space-y-2 text-gray-400">
              <div className="p-3 bg-gray-100 rounded-full text-gray-400">
                <ImageOff className="w-6 h-6" />
              </div>
              <p className="text-xs font-medium text-gray-500">
                Sample report output is not available.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Enlarged Image Lightbox Modal (Constrained to Main Content Area) */}
      {isModalOpen && resolvedUrl && !imageError && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
          className="fixed top-[80px] left-0 lg:left-64 right-0 bottom-0 z-40 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 sm:p-6 transition-all duration-200"
        >
          <div className="relative max-w-5xl max-h-[85vh] w-full bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-700/30">
            {/* Modal Header */}
            <div className="px-5 py-3 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white flex items-center justify-between border-b border-gray-800 gap-3">
              <div className="flex items-center gap-2.5 min-w-0 pr-4">
                <FileText className="w-4 h-4 text-gray-300 flex-shrink-0" />
                <h3 className="text-sm font-semibold truncate text-gray-100">
                  {report.reportName} — Sample Preview
                </h3>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/10 px-1.5 py-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      adjustZoom(-0.25);
                    }}
                    className="p-1.5 text-gray-300 hover:text-white rounded-md hover:bg-white/10 transition-colors cursor-pointer"
                    title="Zoom out"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="min-w-[46px] text-center text-[11px] font-semibold text-gray-100">
                    {zoomLevel.toFixed(2)}x
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      adjustZoom(0.25);
                    }}
                    className="p-1.5 text-gray-300 hover:text-white rounded-md hover:bg-white/10 transition-colors cursor-pointer"
                    title="Zoom in"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setZoomLevel(1);
                    }}
                    className="p-1.5 text-gray-300 hover:text-white rounded-md hover:bg-white/10 transition-colors cursor-pointer"
                    title="Reset zoom"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer flex-shrink-0"
                  title="Close preview (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Image Viewport - Zoomable */}
            <div className="p-4 bg-gray-950/90 flex-1 flex items-center justify-center overflow-auto min-h-[300px]">
              <img
                src={resolvedUrl}
                alt={`${report.reportName} Full Screenshot`}
                className="max-w-full max-h-[75vh] object-contain rounded-md shadow-lg select-none transition-transform duration-200"
                style={{ transform: `scale(${zoomLevel})` }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SamplePreview;
