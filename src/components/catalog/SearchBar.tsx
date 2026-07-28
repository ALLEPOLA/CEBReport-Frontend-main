import React from "react";
import { Search, X, Filter } from "lucide-react";

interface SearchBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  totalResults?: number;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  searchTerm,
  onSearchChange,
  totalResults,
}) => {
  return (
    <div className="relative w-full">
      <div className="relative flex items-center w-full bg-white rounded-xl shadow-xs border border-gray-200/80 hover:border-gray-300 focus-within:border-[#800000] focus-within:ring-2 focus-within:ring-[#800000]/15 transition-all duration-200">
        <div className="pl-4 text-gray-400 flex items-center pointer-events-none">
          <Search className="w-5 h-5 text-gray-400" />
        </div>

        <input
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by report name or category name..."
          className="w-full py-3.5 pl-3 pr-10 text-sm text-gray-800 placeholder-gray-400 bg-transparent focus:outline-none font-normal"
        />

        {searchTerm && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            className="pr-3 text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100 cursor-pointer"
            title="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <div className="hidden sm:flex items-center gap-1.5 pr-4 border-l border-gray-100 pl-3 text-xs text-gray-400 font-medium">
          <Filter className="w-3.5 h-3.5 text-gray-400" />
          <span>{totalResults !== undefined ? `${totalResults} found` : "Instant Filter"}</span>
        </div>
      </div>
    </div>
  );
};

export default SearchBar;
