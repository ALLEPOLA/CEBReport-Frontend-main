import { useState, useEffect, useRef } from "react";
import edlLogo from "./EDL.png";
import eglLogo from "./EGL.png";
import nsoLogo from "./NSO.png";
import ntnspLogo from "./ntnsp.png";

export default function LoginPage({ onLogin, onLoginSuccess, isDarkMode = false, setIsDarkMode }) {
  // Authentication & form UI state management
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const canvasRef = useRef(null);

  // Helper utility to construct structured session user payload
  const formatUserData = (enteredUser, responseData, defaultCompanyId) => {
    return {
      username: enteredUser,
      email: enteredUser.includes("@") ? enteredUser : `${enteredUser}@ceb.lk`,
      companyId: responseData?.companyId || responseData?.CompanyId || defaultCompanyId,
      allocatedBranches: responseData?.allocatedBranches || [1, 2, 3, 5],
    };
  };

  // HR Authentication Handler (Server: 10.128.1.126)
  const handleHRLogin = async () => {
    if (!username || !password) {
      setErrorMsg("Please enter both username and password.");
      return;
    }

    setIsLoading(true);
    setErrorMsg("");

    try {
      const response = await fetch("/hr-api/CBRSAPI/CBRSUPERUserLogin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Username: username, Password: password }),
      });

      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error(`HR Server error (${response.status} ${response.statusText})`);
      }

      // Validates HR API success flag: {"Logged": true}
      if (response.ok && data.Logged === true) {
        const loginCallback = onLogin || onLoginSuccess;
        if (loginCallback) {
          loginCallback(formatUserData(username, data, 3));
        }
      } else {
        // Extracts error message from 'Errormsg' key
        setErrorMsg(data.Errormsg || data.message || "Invalid HR username or password.");
      }
    } catch (error) {
      console.error("HR Login Exception:", error);
      setErrorMsg(error.message || "Unable to connect to HR server (10.128.1.126).");
    } finally {
      setIsLoading(false);
    }
  };

  // Active Directory (AD) Authentication Handler (Server: smartceb.ceb:81)
  const handleADLogin = async () => {
    if (!username || !password) {
      setErrorMsg("Please enter both username and password.");
      return;
    }

    setIsLoading(true);
    setErrorMsg("");

    try {
      const response = await fetch("/ad-api/SMART_API/api/UserManagement/ValidateADLoginCEBINFO", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ad_user_name: username, ad_password: password }),
    });
      

      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error(`AD Server error (${response.status} ${response.statusText})`);
      }

      // Validates AD API boolean flags: isSuccess, Status, or isAuthenticated
      const isSuccess = response.ok && (data.isSuccess === true || data.Status === true || data.isAuthenticated === true);

      if (isSuccess) {
        const loginCallback = onLogin || onLoginSuccess;
        if (loginCallback) {
          loginCallback(formatUserData(username, data, 1));
        }
      } else {
        // Extracts message from top-level 'message' or nested 'common_exception'
        const failureMessage = data.message || data.Message || data.common_exception?.Message || "Invalid AD username or password.";
        setErrorMsg(failureMessage);
      }
    } catch (error) {
      console.error("AD Login Exception:", error);
      setErrorMsg(error.message || "Unable to connect to AD server (smartceb.ceb:81).");
    } finally {
      setIsLoading(false);
    }
  };

  // Sector utility company records
  const companies = [
    { id: 1, name: "Electricity Generation Lanka (EGL)", logo: eglLogo, url: "https://egl.lk/" },
    { id: 2, name: "National Transmission Network Service Provider (NTNSP)", logo: ntnspLogo, url: "https://ntnsp.lk/" },
    { id: 3, name: "Electricity Distribution Lanka (EDL)", logo: edlLogo, url: "https://edl.lk/" },
    { id: 4, name: "National System Operator (NSO)", logo: nsoLogo, url: "https://nso.lk/" },
  ];

  // Development bypass handler
  const handleAuth = () => {
    const loginCallback = onLogin || onLoginSuccess;
    if (loginCallback) {
      loginCallback(formatUserData(username || "demo.user@ceb.lk", null, 1));
    }
  };

  // Canvas particle background rendering lifecycle
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let animationFrameId;
    let width = (canvas.width = canvas.parentElement.offsetWidth);
    let height = (canvas.height = canvas.parentElement.offsetHeight);

    const mouse = { x: null, y: null, radius: 180 };

    const handleResize = () => {
      if (canvas && canvas.parentElement) {
        width = canvas.width = canvas.parentElement.offsetWidth;
        height = canvas.height = canvas.parentElement.offsetHeight;
      }
    };

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };

    const handleMouseLeave = () => {
      mouse.x = null;
      mouse.y = null;
    };

    window.addEventListener("resize", handleResize);
    const parentContainer = canvas.parentElement;
    parentContainer.addEventListener("mousemove", handleMouseMove);
    parentContainer.addEventListener("mouseleave", handleMouseLeave);

    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 1.2,
      vy: (Math.random() - 0.5) * 1.2,
      radius: Math.random() * 2.2 + 1.2,
      pulseSpeed: Math.random() * 0.04 + 0.02,
      pulsePhase: Math.random() * Math.PI * 2,
    }));

    const pulses = Array.from({ length: 12 }, () => ({
      p1Index: 0,
      p2Index: 0,
      progress: Math.random(),
      speed: Math.random() * 0.015 + 0.008,
    }));

    const updatePulses = () => {
      pulses.forEach((pulse) => {
        pulse.progress += pulse.speed;
        if (pulse.progress >= 1) {
          pulse.progress = 0;
          pulse.p1Index = Math.floor(Math.random() * particles.length);
          pulse.p2Index = Math.floor(Math.random() * particles.length);
        }
      });
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      const bgGradient = ctx.createLinearGradient(0, 0, width, height);
      bgGradient.addColorStop(0, "#7B080E");
      bgGradient.addColorStop(0.45, "#3A0307");
      bgGradient.addColorStop(1, "#0A0E17");
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = "rgba(253, 184, 19, 0.04)";
      ctx.lineWidth = 1;
      const gridSize = 45;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      for (let i = 0; i < particles.length; i++) {
        let p1 = particles[i];
        p1.x += p1.vx;
        p1.y += p1.vy;
        p1.pulsePhase += p1.pulseSpeed;

        if (p1.x < 0 || p1.x > width) p1.vx *= -1;
        if (p1.y < 0 || p1.y > height) p1.vy *= -1;

        const currentRadius = p1.radius + Math.sin(p1.pulsePhase) * 0.7;
        ctx.beginPath();
        ctx.arc(p1.x, p1.y, Math.max(0.5, currentRadius), 0, Math.PI * 2);
        ctx.fillStyle = "#FDB813";
        ctx.shadowBlur = 10;
        ctx.shadowColor = "#FDB813";
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          let p2 = particles[j];
          let dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);

          if (dist < 130) {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(253, 184, 19, ${0.75 - dist / 130})`;
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }
        }

        if (mouse.x !== null && mouse.y !== null) {
          let mDist = Math.hypot(p1.x - mouse.x, p1.y - mouse.y);
          if (mDist < mouse.radius) {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.strokeStyle = `rgba(253, 184, 19, ${1 - mDist / mouse.radius})`;
            ctx.lineWidth = 1.2;
            ctx.stroke();
          }
        }
      }

      updatePulses();
      pulses.forEach((pulse) => {
        const p1 = particles[pulse.p1Index];
        const p2 = particles[pulse.p2Index];
        if (p1 && p2) {
          const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
          if (dist < 140) {
            const px = p1.x + (p2.x - p1.x) * pulse.progress;
            const py = p1.y + (p2.y - p1.y) * pulse.progress;

            ctx.beginPath();
            ctx.arc(px, py, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = "#FFFFFF";
            ctx.shadowBlur = 14;
            ctx.shadowColor = "#FDB813";
            ctx.fill();
          }
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      parentContainer.removeEventListener("mousemove", handleMouseMove);
      parentContainer.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className={`ceb-container ${isDarkMode ? "dark" : "light"}`}>
      {/* Left side: Interactive animated branding banner */}
      <div className="canvas-side">
        <canvas ref={canvasRef} className="background-canvas" />

        <div className="canvas-content">
          <div className="hero-text-container">
            <h1 className="hero-title">
              Unified Power <br />
              <span className="hero-accent">Services Portal.</span>
            </h1>

            <p className="hero-desc">
              We leverage modern Information Technology solutions to support electricity generation, transmission, distribution, and system operations.
              Through digital transformation, data-driven solutions, system integration, automation, and innovative technologies, 
              we enhance operational efficiency, improve decision-making, and enable reliable and sustainable power sector operations.
            </p>

            <div className="feature-cards">
              <div className="feature-card">
                <span className="feature-icon">🛡️</span>
                <div>
                  <h4 className="feature-title">Enterprise Single Sign-On</h4>
                  <p className="feature-desc">
                    Secure corporate authentication for all official employee accounts.
                  </p>
                </div>
              </div>
            </div>

            <div className="logos-section">
              <span className="logos-title">SECTOR UTILITY COMPANIES</span>
              <div className="logos-grid">
                {companies.map((company) => (
                  <a
                    key={company.id}
                    href={company.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="logo-card"
                    title={company.name}
                  >
                    <img
                      src={company.logo}
                      alt={company.name}
                      className="logo-img"
                    />
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div className="canvas-footer">
            <span className="footer-text">
              © Utility Solutions & Automation Branch, Electricity Distribution Lanka (Private) Limited. All Rights Reserved.
            </span>
            <span className="version-badge">v1.0.0</span>
          </div>
        </div>
      </div>

      {/* Right side: Interactive login form panel */}
      <div className="login-panel">
        <div className="theme-toggle-wrapper">
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={() => setIsDarkMode && setIsDarkMode(!isDarkMode)}
          >
            {isDarkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
          </button>
        </div>

        <div className="form-wrapper">
          <div className="form-header">
            <span className="sub-title">SECURE ACCESS</span>
            <h2 className="main-title">
              Sign In to Portal<span>.</span>
            </h2>
            <p className="desc-text">Enter your corporate credentials to continue</p>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleADLogin(); }}>
            {/* Username / Email Input */}
            <div className="input-field">
              <label htmlFor="username">EMAIL/ USERNAME</label>
              <div className="input-box">
                <span className="input-icon">👤</span>
                <input
                  id="username"
                  name="username"
                  type="text"
                  className="modern-input"
                  placeholder="Enter Username or EMAIL"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="input-field">
              <div className="label-wrapper">
                <label htmlFor="password">PASSWORD</label>
                <button 
                  type="button" 
                  className="forgot-btn"
                  onClick={handleAuth}
                >
                  Forgot password?
                </button>
              </div>
              <div className="input-box">
                <span className="input-icon">🔒</span>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  className="modern-input"
                  placeholder="Enter Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="toggle-password-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? "👁️" : "🙈"}
                </button>
              </div>
            </div>

            {/* Dynamic Error Alert Banner */}
            {errorMsg && (
              <div style={{
                color: "#ef4444",
                background: "rgba(239, 68, 68, 0.1)",
                padding: "0.6rem 0.8rem",
                borderRadius: "6px",
                fontSize: "0.85rem",
                marginBottom: "1rem",
                border: "1px solid rgba(239, 68, 68, 0.3)"
              }}>
                ⚠️ {errorMsg}
              </div>
            )}

            {/* Dual Authentication Buttons */}
            <div className="button-group">
              <button
                type="button"
                className="action-btn hr-btn"
                onClick={handleHRLogin}
                disabled={isLoading}
              >
                <span>{isLoading ? "AUTHENTICATING..." : "HR LOGIN"}</span>
                <span className="btn-arrow">→</span>
              </button>

              <button
                type="button"
                className="action-btn ad-btn"
                onClick={handleADLogin}
                disabled={isLoading}
              >
                <span>{isLoading ? "AUTHENTICATING..." : "AD LOGIN"}</span>
                <span className="btn-arrow">→</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}