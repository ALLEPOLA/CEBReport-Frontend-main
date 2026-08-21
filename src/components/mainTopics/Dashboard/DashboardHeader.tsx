import React, { useState, useEffect } from "react";
import { useUser } from "../../../contexts/UserContext";

interface DashboardHeaderProps {
  title: string;
  selectedDivision?: string;
  onDivisionChange?: (id: string) => void;
  showDivisionBar?: boolean;
  selectedProvince?: string;
  onProvinceChange?: (code: string) => void;
  selectedArea?: string;
  onAreaChange?: (code: string) => void;
  areas?: { AreaCode: string; AreaName: string }[];
  areasLoading?: boolean;
  isDefaultDashboard?: boolean;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  title,
  selectedDivision: externalDivision,
  onDivisionChange,
  showDivisionBar = true,
  selectedProvince,
  onProvinceChange,
  selectedArea,
  onAreaChange,
  areas = [],
  areasLoading = false,
  isDefaultDashboard = false,
}) => {
  const [internalDivision, setInternalDivision] = useState("all");
  const selectedDivision = externalDivision !== undefined ? externalDivision : internalDivision;
  const setDivision = onDivisionChange || setInternalDivision;
  const { user } = useUser();

  const [provinces, setProvinces] = useState<{ code: string; name: string }[]>([]);
  const [provinceMap, setProvinceMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchMetadata = async () => {
      try {
        const [provRes, areasRes] = await Promise.all([
          fetch("/misapi/api/ordinary/province", { headers: { Accept: "application/json" } }),
          fetch("/misapi/api/ordinary/areas", { headers: { Accept: "application/json" } })
        ]);
        if (!active) return;

        if (provRes.ok && areasRes.ok) {
          const provJson = await provRes.json();
          const areasJson = await areasRes.json();
          
          const provData = provJson?.data || [];
          const areasData = areasJson?.data || [];
          
          setProvinces(provData.map((p: any) => ({ code: p.ProvinceCode, name: p.ProvinceName })));
          
          const map = new Map<string, string>();
          areasData.forEach((area: any) => {
            const pCode = area.ProvCode || area.provCode;
            const region = area.Region || area.region;
            if (pCode && region) {
              const match = /^R?(\d+)$/i.exec(region.trim());
              if (match) {
                map.set(pCode.trim().toUpperCase(), `d${match[1]}`.toLowerCase());
              }
            }
          });
          setProvinceMap(map);
        }
      } catch (err) {
        console.error("DashboardHeader: failed to load dynamic mappings:", err);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchMetadata();
    return () => { active = false; };
  }, []);

  const divisions = [
    { id: "all", label: "All Divisions" },
    { id: "d1", label: "D1" },
    { id: "d2", label: "D2" },
    { id: "d3", label: "D3" },
    { id: "d4", label: "D4" },
  ];

  const getProvinceDivision = (provinceCode?: string): string | null => {
    if (!provinceCode) return null;
    return provinceMap.get(provinceCode.trim().toUpperCase()) || null;
  };

  const getProvincesForRegion = (regionCode?: string) => {
    if (!regionCode) return provinces;
    const match = /^R(\d+)$/i.exec(regionCode.trim());
    if (!match) return provinces;
    const regionNum = match[1];

    const regionDiv = `d${regionNum}`.toLowerCase();
    return provinces.filter(p => provinceMap.get(p.code.trim().toUpperCase()) === regionDiv);
  };

  const showProvinceDropdown =
    user?.Level === 70 ||
    user?.Level === 60 ||
    user?.Level === 50 ||
    (user?.Level === 80 && isDefaultDashboard);

  const isRegionUser = user?.Level === 70;
  const isProvinceUser = user?.Level === 60 || user?.Level === 50;

  const showAreaDropdown =
    user?.Level === 60 ||
    user?.Level === 50 ||
    (user?.Level === 80 && isDefaultDashboard);

  const allowedProvinces = (() => {
    if (user?.Level === 50 && selectedProvince) {
      return provinces.filter(p => p.code === selectedProvince);
    }
    if (isProvinceUser && user?.ProvinceCode) {
      return provinces.filter(p => p.code === user.ProvinceCode);
    }
    if (isRegionUser) {
      return getProvincesForRegion(user?.RegionCode);
    }
    if (user?.Level === 80 && isDefaultDashboard && selectedDivision && selectedDivision !== "all") {
      const match = /^d(\d+)$/i.exec(selectedDivision);
      const reg = match ? `R${match[1]}` : undefined;
      return getProvincesForRegion(reg);
    }
    return provinces;
  })();

  const filteredDivisions = divisions.filter((division) => {
    if (user?.Level === 80 || user?.Company?.toUpperCase().trim() === "DIST") return true;

    let userDivision = "";
    if (user?.Company) {
      const match = /^DISCO(\d+)$/i.exec(user.Company.trim());
      if (match) {
        userDivision = `d${match[1]}`;
      }
    }

    if (!userDivision && user?.RegionCode) {
      const match = /^R(\d+)$/i.exec(user.RegionCode.trim());
      if (match) {
        userDivision = `d${match[1]}`;
      }
    }

    if (userDivision) {
      return division.id === userDivision.toLowerCase();
    }

    if (user?.ProvinceCode) {
      const allowedId = getProvinceDivision(user.ProvinceCode);
      return division.id === allowedId;
    }
    if (user?.Level === 50 && selectedProvince) {
      const allowedId = getProvinceDivision(selectedProvince);
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
                disabled={user?.Level === 60 || user?.Level === 50 || loading}
                className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#7A0000] focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400 cursor-pointer disabled:cursor-not-allowed"
              >
                {loading ? (
                  <option>Loading Provinces...</option>
                ) : (
                  <>
                    {(isRegionUser || user?.Level === 80) && <option value="">Select Province (All)</option>}
                    {allowedProvinces.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.name}
                      </option>
                    ))}
                  </>
                )}
              </select>
            )}

            {showAreaDropdown && (
              <select
                value={selectedArea || ""}
                onChange={(e) => onAreaChange?.(e.target.value)}
                disabled={user?.Level === 50 || areasLoading}
                className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#7A0000] focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400 cursor-pointer disabled:cursor-not-allowed"
              >
                {(user?.Level === 60 || user?.Level === 80) && <option value="">{areasLoading ? "Loading Areas..." : "Select Area (All)"}</option>}
                {user?.Level === 50 && user?.AreaCode && !areas.some(a => a.AreaCode === user.AreaCode) && (
                  <option value={user.AreaCode}>{user.AreaName || user.AreaCode}</option>
                )}
                {areas.map((a) => (
                  <option key={a.AreaCode} value={a.AreaCode}>
                    {a.AreaName || a.AreaCode}
                  </option>
                ))}
              </select>
            )}

            {showDivisionBar && user?.Level !== 50 && (
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardHeader;
