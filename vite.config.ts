import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), "");

	return {
		plugins: [react(), tailwindcss()],
		server: {
			proxy: {
				"/smsapi": {
					target: env.VITE_SERVER_API,
					changeOrigin: true,
					secure: false,
					rewrite: (path) => path.replace(/^\/smsapi/, ""),
				},
				"/CBRSAPI": {
					target: env.VITE_SERVER_API,
					changeOrigin: true,
					secure: false,
				},
				"/CEBINFO_API_2025": {
					target: env.VITE_SERVER_API,
					changeOrigin: true,
					secure: false,
				},

				"/misapi/api/phv-obsolete-idle-fifo": {
					target: env.VITE_LOCAL_API,
					changeOrigin: true,
					secure: false,
					rewrite: (path) => path.replace(/^\/misapi/, ""),
				},
				"/misapi/api/phv-damage-fifo": {
					target: env.VITE_LOCAL_API,
					changeOrigin: true,
					secure: false,
					rewrite: (path) => path.replace(/^\/misapi/, ""),
				},

				"/misapi/api/areatrialbalance": {
					target: env.VITE_LOCAL_API,
					changeOrigin: true,
					secure: false,
					rewrite: (path) => path.replace(/^\/misapi/, ""),
				},

				"/misapi/api/solarjobs/ccapplication": {
					target: env.VITE_LOCAL_API,
					changeOrigin: true,
					secure: false,
					rewrite: (path) => path.replace(/^\/misapi/, ""),
				},

			"/misapi/api/divisionwise-srp-estimation": {
				target: "http://localhost:44381",
				changeOrigin: true,
				secure: false,
				rewrite: (path) => path.replace(/^\/misapi/, ""),
			},
			"/misapi/api/area-wise-srp-piv-pending": {
				target: "http://localhost:44381",
				changeOrigin: true,
				secure: false,
				rewrite: (path) => path.replace(/^\/misapi/, ""),
			},
			"/misapi/api/area-wise-srp-piv-paid": {
				target: "http://localhost:44381",
				changeOrigin: true,
				secure: false,
				rewrite: (path) => path.replace(/^\/misapi/, ""),
			},
			"/misapi/api/area-wise-srp-estimation-piv-paid": {
				target: "http://localhost:44381",
				changeOrigin: true,
				secure: false,
				rewrite: (path) => path.replace(/^\/misapi/, ""),
			},
			"/misapi/api/areawisesrpestimationpiv": {
				target: "http://localhost:44381",
				changeOrigin: true,
				secure: false,
				rewrite: (path) => path.replace(/^\/misapi/, ""),
			},
			"/misapi/api/areawisesrpapplicationpiv": {
				target: "http://localhost:44381",
				changeOrigin: true,
				secure: false,
				rewrite: (path) => path.replace(/^\/misapi/, ""),
			},
			"/misapi/api/areawisesrpapplicationpivstatus": {
				target: "http://localhost:44381",
				changeOrigin: true,
				secure: false,
				rewrite: (path) => path.replace(/^\/misapi/, ""),
			},
			/*
			"/misapi/api/cashsheet": {
				target: "http://localhost:44381",
				changeOrigin: true,
				secure: false,
				rewrite: (path) => path.replace(/^\/misapi/, ""),
			},
*/
/*
			"/misapi/api/cashsheetdaterangepayee": {
				target: "http://localhost:44381",
				changeOrigin: true,
				secure: false,
				rewrite: (path) => path.replace(/^\/misapi/, ""),
			},

*/

			"/misapi/api/currentacctbalcc": {
							target: env.VITE_LOCAL_API,
							changeOrigin: true,
							secure: false,
							rewrite: (path) => path.replace(/^\/misapi/, ""),
						},

			

			

			"/misapi/api/chequesummary": {
				target: "http://localhost:44381",
				changeOrigin: true,
				secure: false,
				rewrite: (path) => path.replace(/^\/misapi/, ""),
			},
				"/misapi/api/solarjobs/pending-jobs": {
					target: env.VITE_LOCAL_API,
					changeOrigin: true,
					secure: false,
					rewrite: (path) => path.replace(/^\/misapi/, ""),
				},

				"/misapi/api/issuereceiptwp": {
					target: env.VITE_LOCAL_API,
					changeOrigin: true,
					secure: false,
					rewrite: (path) => path.replace(/^\/misapi/, ""),
				},

				"/misapi/api/issuesraisedforjobs/report": {
					target: env.VITE_LOCAL_API,
					changeOrigin: true,
					secure: false,
					rewrite: (path) => path.replace(/^\/misapi/, ""),
				},

				"/misapi/api/grnraisedforpurchasing/report": {
					target: env.VITE_LOCAL_API,
					changeOrigin: true,
					secure: false,
					rewrite: (path) => path.replace(/^\/misapi/, ""),
				},

				"/misapi/api/ccgrnnotgen/report": {
					target: env.VITE_LOCAL_API,
					changeOrigin: true,
					secure: false,
					rewrite: (path) => path.replace(/^\/misapi/, ""),
				},

				"/misapi/api/branchgrnnotgen/report": {
					target: env.VITE_LOCAL_API,
					changeOrigin: true,
					secure: false,
					rewrite: (path) => path.replace(/^\/misapi/, ""),
				},

				"/misapi/api/phvslowmovingwh/report": {
					target: env.VITE_LOCAL_API,
					changeOrigin: true,
					secure: false,
					rewrite: (path) => path.replace(/^\/misapi/, ""),
				},

				"/misapi/api/phvnonmovingwh/report": {
					target: env.VITE_LOCAL_API,
					changeOrigin: true,
					secure: false,
					rewrite: (path) => path.replace(/^\/misapi/, ""),
				},

				"/misapi/api/regionperiodstatus/report": {
					target: env.VITE_LOCAL_API,
					changeOrigin: true,
					secure: false,
					rewrite: (path) => path.replace(/^\/misapi/, ""),
				},
				"/misapi/api/provincewiseperiodstatus/report": {
                    target: env.VITE_LOCAL_API,
                    changeOrigin: true,
                    secure: false,
                    rewrite: (path) => path.replace(/^\/misapi/, ""),
                },
                

				"/misapi": {
					target: env.VITE_SERVER_API,
					changeOrigin: true,
					secure: false,
				},
				"/api": {
					target: env.VITE_SERVER_API,
					changeOrigin: true,
					secure: false,
				},

				"/SMART_API": {
					target: env.VITE_SMART_API,
					changeOrigin: true,
					secure: false,
				},
				"/MRMSAPI": {
					target: env.VITE_MRMS_API,
					changeOrigin: true,
					secure: false,
				},
			},
		},
	};
});
