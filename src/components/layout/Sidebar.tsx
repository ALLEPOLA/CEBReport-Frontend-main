import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  loadRoleBasedSidebarData,
  type Topic,
  type Subtopic,
} from "../../data/SideBarData";
import { useUser } from "../../contexts/UserContext";

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();
  const epfNo = user?.Userno || "";

  const [sidebarData, setSidebarData] = useState<Topic[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [billMap, setBillMap] = useState<string | null>(null);
  const [levelNo, setLevelNo] = useState<string | null>(null);

  const handleClick = (id: number, path: string, subtopics: Subtopic[]) => {
    setActiveId(id);
    navigate(path, { state: { subtopics } });
  };

  useEffect(() => {
    let cancelled = false;

    const loadSidebar = async () => {
      setLoading(true);
      setMessage(null);

      const result = await loadRoleBasedSidebarData(epfNo);
      if (cancelled) {
        return;
      }

      setSidebarData(result.data);
      setMessage(result.message);
      setBillMap(result.billMap);
      setLevelNo(result.levelNo);
      setLoading(false);
    };

    void loadSidebar();

    return () => {
      cancelled = true;
    };
  }, [epfNo]);

  useEffect(() => {
    const currentPath = location.pathname;

    // // Special handling for home page - don't redirect and clear activeId
    // if (currentPath === "/dashboard") {
    //   setActiveId(null); // Clear any active selection
    //   return; // Exit early, don't interfere with home page
    // }

    if (sidebarData.length === 0) {
      setActiveId(null);
      return;
    }

    const exactMatch = sidebarData.find((topic) => topic.path === currentPath);

    if (exactMatch) {
      if (activeId !== exactMatch.id) {
        setActiveId(exactMatch.id);
      }
      return;
    }

    const prefixMatch = sidebarData.find((topic) =>
      currentPath.startsWith(topic.path)
    );

    if (prefixMatch) {
      if (activeId !== prefixMatch.id) {
        setActiveId(prefixMatch.id);
      }
    } else if (activeId !== null) {
      setActiveId(null);
    }
  }, [location.pathname, sidebarData, activeId]);

  return (
    <div
      className="w-full bg-gradient-to-b from-gray-50 to-white border-r border-gray-100 p-2 sm:p-3 text-gray-700 font-normal cursor-pointer overflow-y-auto h-full"
      data-bill-map={billMap ?? ""}
      data-level-no={levelNo ?? ""}
    >
      <div className="pt-12">
        <div className="px-4 mb-6">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Main Navigation
          </h2>
        </div>
        {loading && (
          <div className="px-4 pb-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="h-4 w-4 rounded-full border-2 border-gray-300 border-t-[#800000] animate-spin" />
              <span>Loading reports...</span>
            </div>
          </div>
        )}
        {message && !loading && (
          <div className="mx-4 mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {message}
          </div>
        )}
        <div className="space-y-0.5">
          {sidebarData.map((topic) => {
            const isActive = activeId === topic.id;

            return (
              <div key={topic.id} className="relative">
                <div
                  className={`relative px-4 py-2.5 cursor-pointer flex items-center transition-all duration-200 ${
                    isActive
                      ? "bg-gradient-to-r from-[#800000]/10 via-[#800000]/5 to-transparent text-[#800000] border-l-2 border-[#800000]"
                      : "text-gray-600 hover:text-[#800000] hover:bg-gray-50/80"
                  }`}
                  onClick={() =>
                    handleClick(topic.id, topic.path, topic.subtopics)
                  }
                >
                  <div className="flex items-center w-full">
                    <div className="flex-shrink-0 mr-3">
                      <topic.icon
                        className={`w-4 h-4 transition-colors duration-200 ${
                          isActive ? "text-[#800000]" : "text-gray-400"
                        }`}
                      />
                    </div>
                    <div
                      className={`text-sm tracking-wide transition-all duration-200 ${
                        isActive ? "font-medium" : "font-normal"
                      }`}
                    >
                      {topic.name}
                    </div>
                  </div>
                  {isActive && (
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#800000]/20 rounded-l-full" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;