import { FaUser, FaSignOutAlt, FaUserCog, FaCog } from "react-icons/fa";
import { useNavigate, Link } from "react-router-dom";
import { useUser } from "../../contexts/UserContext";
import { useState, useRef, useEffect } from "react";
import { useLogged } from "../../contexts/UserLoggedStateContext";

const AdminNavBar = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const { logout } = useLogged();

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const currentTime = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleClickOutside = (event: any) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleProfileClick = () => {
    navigate("/adminprofile");
    setIsOpen(false);
  };

  const handleLogout = () => {
    logout();
    setIsOpen(false);
    navigate("/");
  };

  return (
    <div
      className="w-full h-20 bg-gradient-to-r from-[#7A0000] via-[#800000] to-[#7A0000] backdrop-blur-sm border-b border-[#6A0000] shadow-lg relative"
      ref={dropdownRef}
    >
      {/* Left Side - Logo & Branding */}
      <div className="absolute left-4 sm:left-6 top-1/2 transform -translate-y-1/2">
        <Link
          to="/adminhome"
          className="flex items-center group transition-all duration-300 hover:scale-105"
          aria-label="Go to Admin Dashboard"
        >
          <div className="ml-3 sm:ml-4 flex items-center gap-2">
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-white tracking-wide">
              REPORTING System
            </div>
            <div className="text-[11px] px-2 py-0.5 rounded-full bg-white/20 text-white">
              v1.6
            </div>
          </div>
        </Link>
      </div>

      {/* Right Side - Date & Time and User Info */}
      <div className="absolute right-4 sm:right-6 top-1/2 transform -translate-y-1/2 flex items-center gap-6">
        {/* Date & Time */}
        <div className="flex flex-col items-end text-right text-white">
          <div className="text-sm font-semibold">
            {currentDate}
          </div>
          <div className="text-xs opacity-90">
            {currentTime}
          </div>
        </div>
        {/* User Info */}
        <div className="hidden sm:block text-right text-white/90">
          <div className="text-xs font-medium">{user.Name}</div>
        </div>

        <div
          className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-3 py-2 cursor-pointer hover:bg-white/20 transition-all duration-200 border border-white/20"
          onClick={handleToggle}
        >
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
            <FaUser className="w-4 h-4 text-white" />
          </div>
          <span className="text-white text-sm font-medium hidden lg:block">
            Profile
          </span>
        </div>

        {isOpen && (
          <div className="absolute right-0 top-full mt-2 bg-white shadow-2xl rounded-lg w-56 z-50 border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-[#7A0000] to-[#800000] rounded-full flex items-center justify-center">
                  <FaUser className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900 text-sm">{user.Name}</div>
                  <div className="text-xs text-gray-500">Administrator</div>
                </div>
              </div>
            </div>

            <div className="py-2">
              <button
                className="w-full px-4 py-3 text-left hover:bg-gray-50 text-sm flex items-center gap-3 transition-colors border-b border-gray-100"
                onClick={handleProfileClick}
              >
                <FaUserCog className="w-4 h-4 text-gray-600" />
                <span>My Profile</span>
              </button>
              <button
                className="w-full px-4 py-3 text-left hover:bg-gray-50 text-sm flex items-center gap-3 transition-colors border-b border-gray-100"
                onClick={() => {/* Add settings functionality */ }}
              >
                <FaCog className="w-4 h-4 text-gray-600" />
                <span>Settings</span>
              </button>
              <button
                className="w-full px-4 py-3 text-left hover:bg-red-50 text-sm flex items-center gap-3 transition-colors text-red-600"
                onClick={handleLogout}
              >
                <FaSignOutAlt className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>

            <div className="p-3 bg-gray-50 border-t border-gray-100">
              <div className="text-xs text-gray-500 text-center">
                Reporting System Portal v1.6
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminNavBar;
