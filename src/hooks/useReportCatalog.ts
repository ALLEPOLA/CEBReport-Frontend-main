import { useState, useEffect } from "react";
import { useUser } from "../contexts/UserContext";

export type CatalogReportItem = {
  path: string;
  repIdNo: string;
  repId: string;
  reportName: string;
  catCode: string;
  categoryName: string;
  description: string;
  paramList: string;
  parameterDescriptions: string[];
  favorite: number;
  active: number;
  hasAccess: boolean;
};

export type CategorySummary = {
  catCode: string;
  categoryName: string;
  totalReports: number;
};

const getCatalogDisplayName = (item: any): string => {
  const candidates = [
    item?.ReportName,
    item?.reportName,
    item?.RepName,
    item?.repname,
    item?.RepId,
    item?.repId,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return "";
};

export const useReportCatalog = () => {
  const { user } = useUser();
  const epfNo = user?.Userno || "";
  const roleId = user?.RoleId || "";

  const [reports, setReports] = useState<CatalogReportItem[]>([]);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const fetchCatalog = async () => {
      setLoading(true);
      setError(null);

      try {
        const queryParams = new URLSearchParams();
        if (epfNo) queryParams.append("epfNo", epfNo);
        if (roleId) queryParams.append("roleId", roleId);

        const response = await fetch(`/misapi/api/reportcatalog/all?${queryParams.toString()}`, {
          method: "GET",
          headers: { Accept: "application/json" },
        });

        if (!response.ok) {
          throw new Error(`Server returned status ${response.status}`);
        }

        const resData = await response.json();

        if (isCancelled) return;

        if (resData?.data?.Reports && Array.isArray(resData.data.Reports) && resData.data.Reports.length > 0) {
          const apiReports: CatalogReportItem[] = resData.data.Reports.map((item: any) => ({
            repIdNo: String(item.RepIdNo ?? item.repIdNo ?? ""),
            repId: String(item.RepId ?? item.repId ?? ""),
            reportName: getCatalogDisplayName(item),
            catCode: String(item.CatCode ?? item.catCode ?? ""),
            categoryName: String(item.CategoryName ?? item.categoryName ?? item.CatCode ?? item.catCode ?? ""),
            description: String(item.Description ?? item.description ?? ""),
            paramList: String(item.ParamList ?? item.paramList ?? ""),
            parameterDescriptions: Array.isArray(item.ParameterDescriptions ?? item.parameterDescriptions)
              ? (item.ParameterDescriptions ?? item.parameterDescriptions).map((value: any) => String(value ?? "").trim()).filter(Boolean)
              : [],
            path: String(item.Path ?? item.path ?? ""),
            favorite: Number(item.Favorite ?? item.favorite ?? 0),
            active: Number(item.Active ?? item.active ?? 1),
            hasAccess: Boolean(item.HasAccess ?? item.hasAccess ?? false),
          }));

          const apiCategories: CategorySummary[] = (resData.data.Categories || []).map((cat: any) => ({
            catCode: String(cat.CatCode || cat.catCode || ""),
            categoryName: String(cat.CategoryName || cat.categoryName || cat.CatCode || ""),
            totalReports: Number(cat.TotalReports ?? cat.totalReports ?? 0),
          }));

          setReports(apiReports);
          setCategories(apiCategories);
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.warn("Using fallback catalog data due to API notice:", err?.message);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchCatalog();

    return () => {
      isCancelled = true;
    };
  }, [epfNo, roleId]);

  return { reports, categories, loading, error };
};
