import React from "react";
import { CheckCircle2, Grid } from "lucide-react";
import { CATEGORY_CONFIG, DEFAULT_CATEGORY_CONFIG, normalizeCategoryKey } from "../../data/SideBarData";

interface CategoryCardProps {
  catCode: string;
  categoryName: string;
  count: number;
  isSelected: boolean;
  onSelect: (catCode: string) => void;
}

const getCategoryIcon = (categoryName: string, catCode: string) => {
  if (catCode === "ALL") {
    return Grid;
  }

  const normalizedName = normalizeCategoryKey(categoryName || "");
  const directMatch = CATEGORY_CONFIG[normalizedName];
  if (directMatch?.icon) {
    return directMatch.icon;
  }

  const fallbackMatch = Object.entries(CATEGORY_CONFIG).find(
    ([key]) => normalizeCategoryKey(key) === normalizedName
  );

  if (fallbackMatch?.[1]?.icon) {
    return fallbackMatch[1].icon;
  }

  return DEFAULT_CATEGORY_CONFIG.icon;
};

export const CategoryCard: React.FC<CategoryCardProps> = ({
  catCode,
  categoryName,
  count,
  isSelected,
  onSelect,
}) => {
  const IconComponent = catCode === "ALL" ? Grid : getCategoryIcon(categoryName, catCode);

  return (
    <div
      onClick={() => onSelect(catCode)}
      className={`group relative cursor-pointer rounded-xl p-5 border transition-all duration-300 transform hover:-translate-y-1 hover:shadow-md select-none ${
        isSelected
          ? "bg-gradient-to-br from-[#800000]/10 via-[#800000]/5 to-white border-[#800000] shadow-sm ring-1 ring-[#800000]"
          : "bg-white border-gray-200/80 hover:border-gray-300 shadow-2xs"
      }`}
    >
      <div className="flex items-start justify-between">
        <div
          className={`p-3 rounded-lg transition-colors duration-200 ${
            isSelected
              ? "bg-[#800000] text-white"
              : "bg-gray-100/80 text-gray-600 group-hover:bg-[#800000]/10 group-hover:text-[#800000]"
          }`}
        >
          <IconComponent className="w-5 h-5" />
        </div>

        {isSelected && (
          <CheckCircle2 className="w-4 h-4 text-[#800000] animate-in fade-in zoom-in-75" />
        )}
      </div>

      <div className="mt-4">
        <h3
          className={`text-base font-semibold transition-colors duration-200 ${
            isSelected ? "text-[#800000]" : "text-gray-800 group-hover:text-[#800000]"
          }`}
        >
          {categoryName}
        </h3>
        <p className="text-xs text-gray-500 mt-1 font-medium">
          {count} {count === 1 ? "Report" : "Reports"}
        </p>
      </div>

      <div
        className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-b-xl transition-all duration-300 ${
          isSelected ? "bg-[#800000]" : "bg-transparent group-hover:bg-gray-300"
        }`}
      />
    </div>
  );
};

export default CategoryCard;
