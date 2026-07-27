import UserNavBar from "./components/layout/UserNavBar";
import AdminNavBar from "./components/layout/AdminNavBar";
import Sidebar from "./components/layout/Sidebar";
import AdminSidebar from "./components/layout/AdminSidebar";
import { useState } from "react";
import { FaBars } from "react-icons/fa";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useLogged } from "./contexts/UserLoggedStateContext";
import useIdleTimeout from "./hooks/useIdleTimeout";

// ─── Auto-logout configuration ───────────────────────────────────────────────
const IDLE_MINUTES = 10;   // ← change this to set idle timeout (minutes)
const WARN_MINUTES = 1;    // ← warning shown this many minutes before logout
// ─────────────────────────────────────────────────────────────────────────────

const UserLayout = ({ children }: { children: React.ReactNode }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useLogged();
  const isAdminRoute = location.pathname.startsWith("/admin") || location.pathname === "/adminhome";

  // ── Idle-timeout: warn the user, then auto-logout ──────────────────────────
  useIdleTimeout({
    idleTime: IDLE_MINUTES,
    warningTime: WARN_MINUTES,
    onWarning: () => {
      toast.warn(
        `⚠️ You will be logged out in ${WARN_MINUTES} minute${WARN_MINUTES > 1 ? 's' : ''} due to inactivity.`,
        { toastId: "idle-warning", autoClose: WARN_MINUTES * 60 * 1000 }
      );
    },
    onActive: () => {
      toast.dismiss("idle-warning");
    },
    onIdle: () => {
      toast.dismiss("idle-warning");
      toast.info("🔒 You have been logged out due to inactivity.", {
        autoClose: 4000,
      });
      logout();
      navigate("/");
    },
  });
  // ──────────────────────────────────────────────────────────────────────────

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Fixed Top Bar */}
      <div className="fixed top-0 left-0 w-full z-50">
        {isAdminRoute ? <AdminNavBar /> : <UserNavBar />}
      </div>


      {/* Mobile Sidebar Toggle Button */}
      <button
        onClick={toggleSidebar}
        className="lg:hidden fixed top-[100px] left-4 z-40 bg-[#800000] text-white p-2 rounded-md shadow-lg hover:bg-[#a00000] transition-colors duration-200"
      >
        <FaBars className="w-5 h-5" />
      </button>

      {/* Sidebar - Hidden on mobile by default */}
      <div
        className={`fixed top-[80px] left-0 h-[calc(100vh-80px)] z-30 bg-white shadow-lg transition-transform duration-300 ease-in-out ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          } lg:translate-x-0 w-64 overflow-y-auto`}
      >
        <div className="h-full flex flex-col">
          {isAdminRoute ? <AdminSidebar /> : <Sidebar />}
        </div>
      </div>

      {/* Main content area with responsive margin */}
      <div
        className={`flex-1 transition-all duration-300 ease-in-out ${isSidebarOpen ? "lg:ml-64" : "lg:ml-0"
          }`}
      >
        <main className="pt-[100px] px-4 pb-8">
          <div className="max-w-7xl mx-auto relative z-20 ml-64">
            {children}
          </div>
        </main>
      </div>



      {/* Overlay for mobile when sidebar is open */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={toggleSidebar}
        ></div>
      )}
    </div>
  );
};

export default UserLayout;
