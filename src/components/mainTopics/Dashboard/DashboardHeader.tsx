import React, { useState } from "react";
import { useUser } from "../../../contexts/UserContext";

interface DashboardHeaderProps {
  title: string;
  selectedDivision?: string;
  onDivisionChange?: (id: string) => void;
  selectedProvince?: string;
  onProvinceChange?: (code: string) => void;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  title,
  selectedDivision: externalDivision,
  onDivisionChange,
  selectedProvince,
  onProvinceChange,
}) => {
  const [internalDivision, setInternalDivision] = useState("all");
  const selectedDivision = externalDivision !== undefined ? externalDivision : internalDivision;
  const setDivision = onDivisionChange || setInternalDivision;
  const { user } = useUser();

  const provinces = [
    { code: "1", name: "Western Province North" },
    { code: "2", name: "Western Province South" },
    { code: "3", name: "Colombo City" },
    { code: "4", name: "Northern Province" },
    { code: "5", name: "Central Province" },
    { code: "6", name: "Uva Province" },
    { code: "7", name: "Eastern Province" },
    { code: "8", name: "North Western Province" },
    { code: "9", name: "Sabaragamuwa Province" },
    { code: "A", name: "North Central Province" },
    { code: "B", name: "Southern Province" },
    { code: "C", name: "Western Province South 2" },
    { code: "D", name: "North Western Province 2" },
    { code: "E", name: "Central Province 2" },
    { code: "F", name: "Southern Province 2" }
  ];

  const divisions = [
    { id: "all", label: "All Divisions" },
    { id: "d1", label: "D1" },
    { id: "d2", label: "D2" },
    { id: "d3", label: "D3" },
    { id: "d4", label: "D4" },
  ];

  const getProvinceDivision = (provinceCode?: string): string | null => {
    if (!provinceCode) return null;
    const code = provinceCode.trim().toUpperCase();
    const d1 = ["1", "3", "8", "D"];
    const d2 = ["5", "7", "A", "E"];
    const d3 = ["2", "6", "9", "C"];
    const d4 = ["4", "B", "F"];
    
    if (d1.includes(code)) return "d1";
    if (d2.includes(code)) return "d2";
    if (d3.includes(code)) return "d3";
    if (d4.includes(code)) return "d4";
    return null;
  };

  const getProvincesForRegion = (regionCode?: string) => {
    if (!regionCode) return provinces;
    const match = /^R(\d+)$/i.exec(regionCode.trim());
    if (!match) return provinces;
    const regionNum = match[1];
    
    if (regionNum === "1") return provinces.filter(p => ["1", "3", "8", "D"].includes(p.code));
    if (regionNum === "2") return provinces.filter(p => ["5", "7", "A", "E"].includes(p.code));
    if (regionNum === "3") return provinces.filter(p => ["2", "6", "9", "C"].includes(p.code));
    if (regionNum === "4") return provinces.filter(p => ["4", "B", "F"].includes(p.code));
    return provinces;
  };

  const showProvinceDropdown = user?.Level === 70 || user?.Level === 60;
  const isRegionUser = user?.Level === 70;
  const isProvinceUser = user?.Level === 60;

  const allowedProvinces = (() => {
    if (isProvinceUser && user?.ProvinceCode) {
      return provinces.filter(p => p.code === user.ProvinceCode);
    }
    if (isRegionUser) {
      return getProvincesForRegion(user?.RegionCode);
    }
    return provinces;
  })();

  const filteredDivisions = divisions.filter((division) => {
    if (user?.Level === 80) return true;
    if (user?.RegionCode) {
      const match = /^R(\d+)$/i.exec(user.RegionCode.trim());
      if (match) {
        const allowedId = `d${match[1]}`.toLowerCase();
        return division.id === allowedId;
      }
    }
    if (user?.ProvinceCode) {
      const allowedId = getProvinceDivision(user.ProvinceCode);
      return division.id === allowedId;
    }
    return true;
  });

  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-10 transition-all duration-1000 opacity-100">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <div className="ml-auto flex items-center justify-end gap-3">
            {showProvinceDropdown && (
              <select
                value={selectedProvince || ""}
                onChange={(e) => onProvinceChange?.(e.target.value)}
                disabled={isProvinceUser}
                className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#7A0000] focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400 cursor-pointer disabled:cursor-not-allowed"
              >
                {isRegionUser && <option value="">Select Province (All)</option>}
                {allowedProvinces.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
              {filteredDivisions.map((division) => {
                const isSelected = selectedDivision === division.id;

                return (
                  <button
                    key={division.id}
                    type="button"
                    onClick={() => setDivision(division.id)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                      isSelected
                        ? "bg-white shadow-sm text-gray-900"
                        : "text-gray-600 hover:bg-white/50"
                    }`}
                  >
                    {division.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardHeader;
