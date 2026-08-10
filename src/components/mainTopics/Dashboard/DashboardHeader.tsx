import React, { useState } from "react";
import { useUser } from "../../../contexts/UserContext";

interface DashboardHeaderProps {
  title: string;
  selectedDivision?: string;
  onDivisionChange?: (id: string) => void;
  showDivisionBar?: boolean;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  title,
  selectedDivision: externalDivision,
  onDivisionChange,
  showDivisionBar = true,
}) => {
  const [internalDivision, setInternalDivision] = useState("all");
  const selectedDivision = externalDivision !== undefined ? externalDivision : internalDivision;
  const setDivision = onDivisionChange || setInternalDivision;
  const { user } = useUser();

  const divisions = [
    { id: "all", label: "All Divisions" },
    { id: "d1", label: "D1" },
    { id: "d2", label: "D2" },
    { id: "d3", label: "D3" },
    { id: "d4", label: "D4" },
  ];

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

    return true;
  });

  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-10 transition-all duration-1000 opacity-100">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {showDivisionBar && (
            <div className="ml-auto flex items-center justify-end">
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
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardHeader;
