import { useUser } from "../contexts/UserContext";

export type Category = "Area" | "Province" | "Region" | "Entire CEB";
interface LockedValue { code: string; name: string; }

export function useReportScope() {
  const { user } = useUser();
  const level = user.Level ?? 0;

  let allowedCategories: Category[];
  const locked: Partial<Record<Category, LockedValue>> = {};

  if (level >= 80) {
    allowedCategories = ["Area", "Province", "Region", "Entire CEB"];
  } else if (level >= 70) {
    allowedCategories = ["Area", "Province", "Region"];
    locked["Region"] = { code: user.RegionCode || "", name: "" };
  } else if (level >= 60) {
    allowedCategories = ["Area", "Province"];
    locked["Province"] = { code: user.ProvinceCode || "", name: user.ProvinceName || "" };
  } else {
    allowedCategories = ["Area"];
    locked["Area"] = { code: user.AreaCode || "", name: user.AreaName || "" };
  }

  return { level, allowedCategories, locked };
}