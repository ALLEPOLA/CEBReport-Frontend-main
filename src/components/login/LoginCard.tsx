import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useUser } from "../../contexts/UserContext";
import { useLogged } from "../../contexts/UserLoggedStateContext";
import { postJSON } from "../../helpers/LoginHelper";
import InputField from "../shared/InputField";
import ceb from "../../assets/CEBLOGO.png";

const LoginCard = () => {
  const { setLogged } = useLogged();
  const { setUser } = useUser();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginType, setLoginType] = useState<"HR" | "AD">("HR");
  const [isAdmin, setIsAdmin] = useState(false);

  const handleSubmit = async (e: any, selectedLoginType?: "HR" | "AD") => {
    e.preventDefault();
    localStorage.removeItem("userData");

    try {
      let isLoginSuccess = false;

      const currentLoginType = selectedLoginType ?? loginType;

      if (currentLoginType === "HR") {
        const IsLogged = await postJSON("/CBRSAPI/CBRSUPERUserLogin", {
          Username: username,
          Password: password,
        });

        setLogged(IsLogged);
        isLoginSuccess = IsLogged?.Logged === true;
      } else {
        // AD Login
        try {
          const response = await fetch(
            "/SMART_API/api/UserManagement/ValidateADLoginCEBINFO",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ ad_user_name: username, ad_password: password }),
            }
          );

          if (response.ok) {
            let adRes: any = null;
            try {
              adRes = await response.json();
            } catch {
              adRes = null;
            }

            console.log("AD Login raw response:", adRes);
            const isSuccess =
              adRes?.isSuccess === true ||
              adRes?.IsSuccess === true ||
              adRes?.success === true ||
              String(adRes?.isSuccess).toLowerCase() === "true";

            if (isSuccess) {
              setLogged({ Logged: true, Errormsg: "" });
              isLoginSuccess = true;
            } else {
              isLoginSuccess = false;
              console.error("AD Validation failed in response body:", adRes);
              const message =
                adRes?.message ||
                adRes?.Message ||
                adRes?.error ||
                adRes?.Error ||
                "AD login rejected by server";
              toast.error(message);
            }
          } else {
            console.error("AD Validation request failed with status:", response.status);
            toast.error(`AD login request failed (${response.status})`);
          }
        } catch (adError) {
          console.error("Error during AD Validation API call:", adError);
          toast.error("AD login service is not reachable. Check deployed API URL/CORS settings.");
        }
      }

      if (isLoginSuccess) {
        // Only allow admin login if checking DB confirms they are an admin
        if (isAdmin) {
          try {
            const adminCheck = await fetch("/misapi/api/roleinfo/admin");
            if (adminCheck.ok) {
              const adminPayload = await adminCheck.json();
              const isAdminInDb = Array.isArray(adminPayload?.data) && adminPayload.data.some((a: any) =>
                String(a?.EpfNo).trim() === String(username).trim()
              );
              if (!isAdminInDb) {
                toast.error("You do not have administrative privileges.");
                setLogged({ Logged: false, Errormsg: "" });
                return; // Stop the login process
              }
            } else {
              toast.error("Failed to verify admin status.");
              setLogged({ Logged: false, Errormsg: "" });
              return;
            }
          } catch (err) {
            console.error("Admin verification error:", err);
            toast.error("Error verifying admin status.");
            setLogged({ Logged: false, Errormsg: "" });
            return;
          }
        }

        toast.success("Login successful!", { autoClose: 2000 });
        if (isAdmin) {
          navigate("/adminhome");
        } else {
          navigate("/home");
        }

        const userData = await postJSON("/CBRSAPI/CBRSEPFNOLogin", {
          Username: username,
          Password: password,
        });

        if (userData && isAdmin) {
          userData.isAdmin = true;
        }

        // Fetch access-level info (Level + BillMap code) from the real BillMap API
        try {
          const billMapRes = await fetch(`/misapi/api/billmap/${username.trim()}`);
          const billMapData = await billMapRes.json();
          const entry = Array.isArray(billMapData) ? billMapData[0] : null;

          if (entry) {
            const level = parseInt(entry.LevelNo, 10) || 0;
            const code = (entry.BillMap || "").trim();
            const name = (entry.CompanyName || "").trim();

            userData.Level = level;

            if (level >= 80) {
              // Chairman / top level — no lock needed, sees everything
            } else if (level >= 70) {
              userData.RegionCode = code;
              userData.RegionName = name;
            } else if (level >= 60) {
              userData.ProvinceCode = code;
              userData.ProvinceName = name;
            } else {
              userData.AreaCode = code;
              userData.AreaName = name;
            }
          }
        } catch (err) {
          console.error("Could not load BillMap access profile:", err);
        }

        setUser(userData);

        if (userData?.Logged) {
          console.log("User details have been fetched successfully");
        } else {
          console.log("User details can't be fetched");
        }
      } else {
        toast.error("Invalid username or password");
      }
    } catch (error) {
      console.error("Error during login:", error);
      toast.error("Network or server error");
    }
  };

  return (
    <div className="w-full">
      <div className="bg-[#ffffff] shadow-lg rounded-lg p-4 sm:p-6 md:p-8">
        <div className="flex justify-center mb-4">
          <img
            src={ceb}
            alt="CEB Logo"
            className="w-24 sm:w-32 md:w-35 h-auto"
          />
        </div>

        <div className="text-center text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">
          Sign In With Credentials
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <InputField
            label="Username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
          />
          <InputField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
          />
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                className="form-checkbox text-gray-700 w-4 h-4 cursor-pointer"
              />
              <span className="ml-2 text-sm text-gray-600">Remember Me</span>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={isAdmin}
                onChange={(e) => setIsAdmin(e.target.checked)}
                className="form-checkbox text-gray-700 w-4 h-4 cursor-pointer"
              />
              <span className="ml-2 text-sm text-gray-600">Admin User</span>
            </div>
          </div>
          <div className="mt-2 flex w-full flex-col gap-3 sm:flex-row">
            <button
              type="button"
              className={`w-full rounded-md px-4 py-2.5 text-sm font-semibold sm:text-base shadow-sm transition-all duration-150 ${loginType === "HR"
                ? "bg-[#7c0000] text-white hover:bg-[#690000]"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              onClick={(e) => {
                setLoginType("HR");
                handleSubmit(e, "HR");
              }}
            >
              HR Sign In
            </button>
            <button
              type="button"
              className={`w-full rounded-md px-4 py-2.5 text-sm font-semibold sm:text-base shadow-sm transition-all duration-150 ${loginType === "AD"
                ? "bg-[#7c0000] text-white hover:bg-[#690000]"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              onClick={(e) => {
                setLoginType("AD");
                handleSubmit(e, "AD");
              }}
            >
              AD Sign In
            </button>
          </div>
        </form>
        <div className="flex justify-between mt-4 sm:mt-6 text-xs sm:text-sm text-gray-500"></div>
      </div>
    </div>
  );
};

export default LoginCard;


// import { useState } from "react";
// import { useNavigate } from "react-router-dom";
// import { toast } from "react-toastify";
// import { useUser } from "../../contexts/UserContext";
// import { useLogged } from "../../contexts/UserLoggedStateContext";
// import { postJSON } from "../../helpers/LoginHelper";
// import InputField from "../shared/InputField";
// import ceb from "../../assets/CEBLOGO.png";

// const LoginCard = () => {
//   const { setLogged } = useLogged();
//   const { setUser } = useUser();
//   const navigate = useNavigate();

//   const [username, setUsername] = useState("");
//   const [password, setPassword] = useState("");
//   const [isLoading, setIsLoading] = useState(false);

//   const handleSubmit = async (e: any) => {
//     e.preventDefault();
//     setIsLoading(true);
//     localStorage.removeItem("userData");

//     try {
//       const IsLogged = await postJSON("/CBRSAPI/CBRSUPERUserLogin", {
//         Username: username,
//         Password: password,
//       });

//       setLogged(IsLogged);

//       if (IsLogged?.Logged) {
//         toast.success("Login successful!", { autoClose: 2000 });
//         navigate("/home");

//         const userData = await postJSON("/CBRSAPI/CBRSEPFNOLogin", {
//           Username: username,
//           Password: password,
//         });

//         setUser(userData);

//         if (userData?.Logged) {
//           console.log("User details have been fetched successfully");
//         } else {
//           console.log("User details can't be fetched");
//         }
//       } else {
//         toast.error("Invalid username or password");
//       }
//     } catch (error) {
//       console.error("Error during login:", error);
//       toast.error("Network or server error");
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   return (
//     <div className="w-full">
//       {/* Card */}
//       <div
//         style={{
//           background: "#ffffff",
//           borderRadius: "2px",
//           boxShadow: "0 4px 40px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.07)",
//           overflow: "hidden",
//         }}
//       >
//         {/* Top accent bar */}
//         <div style={{ height: "4px", background: "linear-gradient(90deg, #7c0000 0%, #b30000 60%, #e8a000 100%)" }} />

//         <div style={{ padding: "40px 44px 36px" }}>
//           {/* Logo + system name */}
//           <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "32px" }}>
//             <img
//               src={ceb}
//               alt="CEB Logo"
//               style={{ width: "80px", height: "auto", marginBottom: "14px" }}
//             />
//             {/* <h1
//               style={{
//                 fontFamily: "'Georgia', 'Times New Roman', serif",
//                 fontSize: "17px",
//                 fontWeight: "700",
//                 color: "#1a1a1a",
//                 letterSpacing: "0.03em",
//                 textAlign: "center",
//                 margin: 0,
//                 lineHeight: 1.3,
//               }}
//             >
//               Ceylon Electricity Board
//             </h1> */}
//             <p
//               style={{
//                 fontFamily: "'Georgia', 'Times New Roman', serif",
//                 fontSize: "12px",
//                 color: "#7c0000",
//                 letterSpacing: "0.12em",
//                 textTransform: "uppercase",
//                 margin: "4px 0 0",
//                 fontWeight: "600",
//               }}
//             >
//               Management Information System
//             </p>
//           </div>

//           {/* Divider */}
//           <div style={{ display: "flex", alignItems: "center", marginBottom: "28px", gap: "12px" }}>
//             <div style={{ flex: 1, height: "1px", background: "#e5e5e5" }} />
//             <span style={{ fontSize: "10px", color: "#aaa", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "sans-serif" }}>
//               Authorized Access Only
//             </span>
//             <div style={{ flex: 1, height: "1px", background: "#e5e5e5" }} />
//           </div>

//           {/* Form */}
//           <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
//             {/* Username */}
//             <div>
//               <label
//                 style={{
//                   display: "block",
//                   fontSize: "11px",
//                   fontWeight: "600",
//                   color: "#555",
//                   letterSpacing: "0.08em",
//                   textTransform: "uppercase",
//                   marginBottom: "6px",
//                   fontFamily: "sans-serif",
//                 }}
//               >
//                 Username
//               </label>
//               <InputField
//                 label=""
//                 type="text"
//                 value={username}
//                 onChange={(e) => setUsername(e.target.value)}
//                 placeholder="Enter your username"
//               />
//             </div>

//             {/* Password */}
//             <div>
//               <label
//                 style={{
//                   display: "block",
//                   fontSize: "11px",
//                   fontWeight: "600",
//                   color: "#555",
//                   letterSpacing: "0.08em",
//                   textTransform: "uppercase",
//                   marginBottom: "6px",
//                   fontFamily: "sans-serif",
//                 }}
//               >
//                 Password
//               </label>
//               <InputField
//                 label=""
//                 type="password"
//                 value={password}
//                 onChange={(e) => setPassword(e.target.value)}
//                 placeholder="Enter your password"
//               />
//             </div>

//             {/* Remember Me */}
//             <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
//               <input
//                 type="checkbox"
//                 id="rememberMe"
//                 style={{
//                   width: "15px",
//                   height: "15px",
//                   accentColor: "#7c0000",
//                   cursor: "pointer",
//                 }}
//               />
//               <label
//                 htmlFor="rememberMe"
//                 style={{
//                   fontSize: "12px",
//                   color: "#666",
//                   cursor: "pointer",
//                   fontFamily: "sans-serif",
//                   userSelect: "none",
//                 }}
//               >
//                 Remember Me
//               </label>
//             </div>

//             {/* Submit Button */}
//             <button
//               type="submit"
//               disabled={isLoading}
//               style={{
//                 width: "100%",
//                 background: isLoading ? "#a04040" : "#7c0000",
//                 color: "#fff",
//                 border: "none",
//                 borderRadius: "2px",
//                 padding: "13px 0",
//                 fontSize: "13px",
//                 fontWeight: "600",
//                 letterSpacing: "0.1em",
//                 textTransform: "uppercase",
//                 cursor: isLoading ? "not-allowed" : "pointer",
//                 fontFamily: "sans-serif",
//                 marginTop: "6px",
//                 transition: "background 0.2s, box-shadow 0.2s",
//                 boxShadow: isLoading ? "none" : "0 2px 8px rgba(124,0,0,0.18)",
//                 display: "flex",
//                 alignItems: "center",
//                 justifyContent: "center",
//                 gap: "8px",
//               }}
//               onMouseEnter={e => { if (!isLoading) (e.currentTarget as HTMLButtonElement).style.background = "#a00000"; }}
//               onMouseLeave={e => { if (!isLoading) (e.currentTarget as HTMLButtonElement).style.background = "#7c0000"; }}
//             >
//               {isLoading ? (
//                 <>
//                   <span
//                     style={{
//                       width: "14px",
//                       height: "14px",
//                       border: "2px solid rgba(255,255,255,0.4)",
//                       borderTopColor: "#fff",
//                       borderRadius: "50%",
//                       display: "inline-block",
//                       animation: "spin 0.7s linear infinite",
//                     }}
//                   />
//                   Signing In…
//                 </>
//               ) : (
//                 "Sign In"
//               )}
//             </button>
//           </form>
//         </div>

//         {/* Footer strip */}
//         <div
//           style={{
//             background: "#f7f7f7",
//             borderTop: "1px solid #ececec",
//             padding: "11px 44px",
//             display: "flex",
//             justifyContent: "space-between",
//             alignItems: "center",
//           }}
//         >
//           <span style={{ fontSize: "10px", color: "#bbb", fontFamily: "sans-serif", letterSpacing: "0.04em" }}>
//             © {new Date().getFullYear()} Electricity Distribution Lanka (Pvt) Ltd
//           </span>
//           <span style={{ fontSize: "10px", color: "#bbb", fontFamily: "sans-serif" }}>
//             v1.2
//           </span>
//         </div>
//       </div>

//       <style>{`
//         @keyframes spin { to { transform: rotate(360deg); } }
//       `}</style>
//     </div>
//   );
// };

// export default LoginCard;