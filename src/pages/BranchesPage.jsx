import { useState } from "react";

// Local PNG Logos Import
import edlLogo from "./EDL.png";
import eglLogo from "./EGL.png";
import nsoLogo from "./NSO.png";
import ntnspLogo from "./ntnsp.png";

export default function BranchesPage({ onLogout, isDarkMode = false, setIsDarkMode }) {
  const [selectedBranch, setSelectedBranch] = useState("Circuit Bungalow Reservation System");
  const [selectedSubBranch, setSelectedSubBranch] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedBranch, setExpandedBranch] = useState(1);

  // Active Systems (1-7) & Placeholder Slots (8-33)
  const branches = [
    { 
      id: 1, 
      name: "Circuit Bungalow Reservation System", 
      type: "System", 
      code: "CBRS",
      subBranches: [
        { id: "1a", name: "Bungalow Booking Portal", code: "CBRS-BKG" },
        { id: "1b", name: "Availability Calendar & Rates", code: "CBRS-CAL" },
        { id: "1c", name: "Payment & Approvals", code: "CBRS-PMT" }
      ]
    },
    { id: 2, name: "Reporting System", type: "System", code: "REP" },
    { id: 3, name: "SPS", type: "System", code: "SPS" },
    { id: 4, name: "SMC", type: "System", code: "SMC" },
    { id: 5, name: "Billing", type: "System", code: "BIL" },
    { id: 6, name: "FIFO", type: "System", code: "FIFO" },
    { id: 7, name: "NCRE", type: "System", code: "NCRE" },

    ...Array.from({ length: 26 }, (_, i) => {
      const slotNum = i + 8;
      return {
        id: slotNum,
        name: `System Slot #${slotNum}`,
        type: "System",
        code: `SYS-${String(slotNum).padStart(2, "0")}`
      };
    })
  ];

  // 4 Entities / Companies Data
  const companies = [
    {
      id: 1,
      name: "Electricity Generation Lanka (Private) Limited",
      shortName: "EGL",
      logo: eglLogo,
      url: "https://egl.lk/",
      desc: "Responsible for managing and expanding state-owned power generation assets, driving reliable, cost-effective, and sustainable energy production."
    },
    {
      id: 2,
      name: "National Transmission Network Service Provider (Private) Limited",
      shortName: "NTNSP",
      logo: ntnspLogo,
      url: "https://ntnsp.lk/",
      desc: "Operates and maintains the high-voltage transmission grid infrastructure to ensure stable, efficient, and high-capacity power dispatch nationwide."
    },
    {
      id: 3,
      name: "Electricity Distribution Lanka (Private) Limited",
      shortName: "EDL",
      logo: edlLogo,
      url: "https://edl.lk/",
      desc: "Oversees national electricity distribution networks, managing last-mile grid connectivity, sub-stations, and regional retail customer operations."
    },
    {
      id: 4,
      name: "National System Operator (Private) Limited",
      shortName: "NSO",
      logo: nsoLogo,
      url: "https://nso.lk/",
      desc: "Ensures real-time power grid balance, economic dispatch, system frequency control, and overall security and stability of the national power system."
    }
  ];

  // Search filter logic
  const filteredBranches = branches.filter((b) => {
    const query = searchTerm.toLowerCase();
    const matchesMain = b.name.toLowerCase().includes(query) || b.code.toLowerCase().includes(query);
    const matchesSub = b.subBranches?.some(
      (sub) => sub.name.toLowerCase().includes(query) || sub.code.toLowerCase().includes(query)
    );
    return matchesMain || matchesSub;
  });

  const handleBranchClick = (b) => {
    setSelectedBranch(b.name);
    setSelectedSubBranch(null);
    if (b.subBranches && b.subBranches.length > 0) {
      setExpandedBranch(expandedBranch === b.id ? null : b.id);
    }
  };

  const handleSubBranchClick = (mainBranchName, sub) => {
    setSelectedBranch(mainBranchName);
    setSelectedSubBranch(sub.name);
  };

  return (
    <div className={`v2-wrapper ${isDarkMode ? "dark" : "light"}`}>
      {/* Left Sidebar */}
      <aside className="v2-sidebar">
        <div className="v2-sidebar-header">
          <div className="v2-brand">
            <div className="v2-brand-logo">⚡</div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: "800" }}>CEB PORTAL</h3>
            </div>
          </div>
          <input
            type="text"
            className="v2-search-input"
            placeholder="Search system or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="v2-branch-list">
          {filteredBranches.map((b) => {
            const hasSub = b.subBranches && b.subBranches.length > 0;
            const isExpanded = expandedBranch === b.id || (searchTerm.trim() !== "" && hasSub);
            const isMainActive = selectedBranch === b.name && !selectedSubBranch;

            return (
              <div key={b.id} className="v2-branch-group">
                <button
                  className={`v2-branch-item ${isMainActive ? "active" : ""}`}
                  onClick={() => handleBranchClick(b)}
                >
                  <div>
                    <span>{b.id}. {b.name}</span>
                    {hasSub && (
                      <span style={{ display: "block", fontSize: "0.7rem", opacity: 0.65 }}>
                        {b.subBranches.length} Sub-branches
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span className="v2-badge">{b.code}</span>
                    {hasSub && <span style={{ fontSize: "0.7rem", opacity: 0.8 }}>{isExpanded ? "▲" : "▼"}</span>}
                  </div>
                </button>

                {/* Sub-branches Expand Directly inside Sidebar */}
                {hasSub && isExpanded && (
                  <div className="v2-sub-branch-list">
                    {b.subBranches.map((sub) => {
                      const isSubActive = selectedSubBranch === sub.name;
                      return (
                        <a
                          key={sub.id}
                          href="#"
                          className={`v2-sub-branch-item ${isSubActive ? "sub-active" : ""}`}
                          onClick={(e) => {
                            e.preventDefault();
                            handleSubBranchClick(b.name, sub);
                          }}
                        >
                          <span>└─ {sub.name}</span>
                          <span style={{ fontSize: "0.7rem", opacity: 0.85 }}>{sub.code} →</span>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      {/* Right Main Content */}
      <main className="v2-main-content">
        <div className="v2-top-bar">
          <div>
            <span className="v2-accent-label">ENTERPRISE PORTAL</span>
            <h2 style={{ margin: 0, fontSize: "1.4rem" }}>Enterprise Overview Dashboard</h2>
          </div>
          <div style={{ display: "flex", gap: "0.8rem" }}>
            <button onClick={() => setIsDarkMode && setIsDarkMode(!isDarkMode)}>
              {isDarkMode ? "☀️ Light" : "🌙 Dark"}
            </button>
            <button className="v2-logout-btn" style={{ background: "#7b080e", color: "#fff", border: "none" }} onClick={onLogout}>
              Logout 🚪
            </button>
          </div>
        </div>

        {/* Selected Branch Status Bar */}
        <div className="v2-selected-status">
          <div>
            <span style={{ fontSize: "0.8rem", opacity: 0.7 }}>ACTIVE SYSTEM SELECTED:</span>
            <h4 style={{ margin: 0, fontSize: "1.1rem" }}>
              {selectedBranch} {selectedSubBranch ? ` → ${selectedSubBranch}` : ""}
            </h4>
          </div>
          <button
            style={{
              background: "#7b080e",
              color: "#fff",
              border: "none",
              padding: "0.5rem 1rem",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "bold"
            }}
          >
            Access Selected Portal →
          </button>
        </div>

        {/* Hero Section */}
        <div className="v2-hero-card">
          <div className="v2-glow-orb"></div>
          <div className="v2-hero-content">
            <span style={{ background: "#fdb813", color: "#000", padding: "3px 10px", borderRadius: "20px", fontSize: "0.75rem", fontWeight: "bold" }}>
              ESTABLISHED 1969
            </span>
            <h1 className="v2-hero-title">Ceylon Electricity <span>Board</span></h1>
            <p className="v2-hero-desc">
              We leverage modern Information Technology solutions to support electricity generation, transmission, distribution, and system operations. Through digital transformation, data-driven solutions, system integration, automation, and innovative technologies, we enhance operational efficiency, improve decision-making, and enable reliable and sustainable power sector operations.
            </p>
          </div>
        </div>

        {/* 4 Entities / Companies Grid */}
        <h3 style={{ margin: "0 0 0.3rem 0" }}>National Power Sector Entities</h3>
        <p style={{ margin: "0 0 1.2rem 0", opacity: 0.7, fontSize: "0.9rem" }}>
          Key operational companies driving Sri Lanka's unbundled energy grid.
        </p>

        <div className="v2-company-grid">
          {companies.map((comp) => (
            <div key={comp.id} className="v2-company-card">
              <div>
                <div className="v2-company-logo-box">
                  <img src={comp.logo} alt={comp.shortName} />
                </div>
                <h3>{comp.name}</h3>
                <p>{comp.desc}</p>
              </div>
              <a
                href={comp.url}
                target="_blank"
                rel="noopener noreferrer"
                className="v2-company-link"
              >
                Visit Official Portal ({comp.shortName}.lk) ↗
              </a>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}