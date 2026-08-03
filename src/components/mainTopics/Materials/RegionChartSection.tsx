import React from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

interface MaterialStock {
  Region: string;
  QtyOnHand: number;
  MatCd: string;
}

interface RegionChartSectionProps {
  materials: MaterialStock[];
  chartType: "bar" | "donut" | "pie";
  setChartType: (type: "bar" | "donut" | "pie") => void;
  selectedRegion: string | null;
  setSelectedRegion: (region: string | null) => void;
  REGION_COLORS: string[];
  mapRegionName: (region: string) => string;
  handleRegionClick: (e: any, index: number) => void;
  clearRegionSelection: () => void;
  renderCustomTooltip: (props: any) => React.ReactNode;
}

const RegionChartSection: React.FC<RegionChartSectionProps> = ({
  materials,
  chartType,
  setChartType,
  selectedRegion,
  setSelectedRegion,
  REGION_COLORS,
  mapRegionName,
  handleRegionClick,
  clearRegionSelection,
  renderCustomTooltip
}) => {
  const allMaterialsZero = materials.length > 0 && materials.every((m) => m.QtyOnHand === 0);

  // Calculate total quantity for all regions
  const totalQuantity = materials.reduce((sum, material) => sum + material.QtyOnHand, 0);

  return (
    <div className="w-full md:w-1/2 flex flex-col md:flex-row gap-4">
      <div className="flex-1 bg-gradient-to-br from-white via-gray-50 to-gray-100 rounded-xl shadow-lg border border-gray-200 p-4 flex flex-col min-h-[420px] relative">
        <div className="flex justify-between items-center mb-3 pb-1 border-b border-gray-100">
          <h3 className="text-[13px] font-semibold text-gray-700 tracking-tight flex items-center gap-2">
            Divisional Quantity On Hand
          </h3>
          <select
            value={chartType}
            onChange={(e) => setChartType(e.target.value as "donut" | "bar" | "pie")}
            className="px-2 py-1 text-xs bg-white border border-gray-300 rounded shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="donut">Donut</option>
            <option value="bar">Bar</option>
            <option value="pie">Pie</option>
          </select>
        </div>

        {/* Total Display */}
        <div className="mb-2 text-center">
          <div className="inline-block bg-blue-50 border border-blue-200 rounded-lg px-3 py-1">
            <span className="text-xs text-blue-600 font-medium">Total Quantity: </span>
            <span className="text-xs font-bold text-blue-800">
              {totalQuantity.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center items-center">
          {allMaterialsZero ? (
            <div className="flex items-center justify-center h-full text-red-500 font-semibold text-base">
              There is no material in stock for this material (Divition Wise).
            </div>
          ) : materials.length > 0 ? (
            <div className="w-full h-[280px] flex items-center justify-center">
              {chartType === "donut" && (
                <div className="w-full h-full flex items-center justify-center bg-white/70 rounded-lg shadow-inner relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={materials}
                        dataKey="QtyOnHand"
                        nameKey="Region"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={110}
                        paddingAngle={0}
                        cornerRadius={0}
                        onClick={handleRegionClick}
                      >
                        {materials.map((_, index) => (
                          <Cell
                            key={`donut-${index}`}
                            fill={REGION_COLORS[index % REGION_COLORS.length]}
                            stroke={selectedRegion === mapRegionName(materials[index].Region) ? "#000" : "#fff"}
                            strokeWidth={selectedRegion === mapRegionName(materials[index].Region) ? 2 : 1}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={renderCustomTooltip} />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center total display for donut chart */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                      <div className="text-xs text-gray-500 font-medium">Total</div>
                      <div className="text-sm font-bold text-gray-700">
                        {totalQuantity.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {chartType === "bar" && (
                <div className="w-full h-full flex items-center justify-center bg-white/70 rounded-lg shadow-inner">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={materials}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      onClick={handleRegionClick}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="Region" tickFormatter={mapRegionName} fontSize={11} />
                      <YAxis fontSize={11} />
                      <Tooltip content={renderCustomTooltip} />
                      <Bar dataKey="QtyOnHand" fill="#1E40AF" radius={[4, 4, 0, 0]} onClick={handleRegionClick}>
                        {materials.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={REGION_COLORS[index % REGION_COLORS.length]}
                            stroke={selectedRegion === mapRegionName(entry.Region) ? "#000" : "#fff"}
                            strokeWidth={selectedRegion === mapRegionName(entry.Region) ? 2 : 1}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {chartType === "pie" && (
                <div className="w-full h-full flex items-center justify-center bg-white/70 rounded-lg shadow-inner">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={materials}
                        dataKey="QtyOnHand"
                        nameKey="Region"
                        cx="50%"
                        cy="50%"
                        outerRadius={110}
                        paddingAngle={0}
                        cornerRadius={0}
                        onClick={handleRegionClick}
                      >
                        {materials.map((_, index) => (
                          <Cell
                            key={`pie-${index}`}
                            fill={REGION_COLORS[index % REGION_COLORS.length]}
                            stroke={selectedRegion === mapRegionName(materials[index].Region) ? "#000" : "#fff"}
                            strokeWidth={selectedRegion === mapRegionName(materials[index].Region) ? 2 : 1}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={renderCustomTooltip} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 italic">
              No region data available
            </div>
          )}
        </div>
      </div>
      {/* Region Data Table */}
      <div className="w-full md:w-[180px] bg-white rounded-xl shadow border border-gray-200 flex flex-col ml-0 md:ml-2 mt-4 md:mt-0 max-h-[420px] overflow-y-auto">
        <div className="sticky top-0 bg-gray-50 px-3 py-2 border-b border-gray-100 flex justify-between items-center z-10">
          <h4 className="text-xs font-semibold text-gray-600 tracking-wide">
            All Divitions
          </h4>
          {selectedRegion && (
            <button
              onClick={clearRegionSelection}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              Clear
            </button>
          )}
        </div>
        <div className="divide-y divide-gray-100">
          {materials.map((region, index) => (
            <div
              key={index}
              className={`px-3 py-2 flex items-center hover:bg-blue-50 cursor-pointer transition-colors ${selectedRegion === mapRegionName(region.Region) ? "bg-blue-50" : ""
                }`}
              onClick={() => {
                const mappedRegion = mapRegionName(region.Region);
                setSelectedRegion(selectedRegion === mappedRegion ? null : mappedRegion);
              }}
            >
              <div
                className="w-3 h-3 rounded-sm mr-2 flex-shrink-0 border border-gray-200"
                style={{
                  backgroundColor: REGION_COLORS[index % REGION_COLORS.length],
                }}
              ></div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-700 truncate" title={mapRegionName(region.Region)}>
                  {mapRegionName(region.Region)}
                  {selectedRegion === mapRegionName(region.Region) && (
                    <span className="ml-1 text-blue-600">(selected)</span>
                  )}
                </div>
                <div className="text-[11px] text-gray-500">
                  Quantity: {region.QtyOnHand.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RegionChartSection;