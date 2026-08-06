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
				/*
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
				
								"/misapi/api/solarjobs/pending-jobs": {
									target: env.VITE_LOCAL_API,
									changeOrigin: true,
									secure: false,
									rewrite: (path) => path.replace(/^\/misapi/, ""),
								},
			*/

				"/misapi/api/reportcatalog/all": {
					target: env.VITE_LOCAL_API,
					changeOrigin: true,
					secure: false,
					rewrite: (path) => path.replace(/^\/misapi/, ""),
				},

				"/misapi/api/materialflow/gradecodes": {
					target: env.VITE_LOCAL_API,
					changeOrigin: true,
					secure: false,
					rewrite: (path) => path.replace(/^\/misapi/, ""),
				},

				"/misapi/api/quantitymatfifo": {
					target: env.VITE_LOCAL_API,
					changeOrigin: true,
					secure: false,
					rewrite: (path) => path.replace(/^\/misapi/, ""),
				},

				"/misapi/api/materialflow/report": {
					target: env.VITE_LOCAL_API,
					changeOrigin: true,
					secure: false,
					rewrite: (path) => path.replace(/^\/misapi/, ""),
				},

				"/misapi/api/pivpaidnotenagized/report": {
					target: env.VITE_LOCAL_API,
					changeOrigin: true,
					secure: false,
					rewrite: (path) => path.replace(/^\/misapi/, ""),
				},


				"/misapi": {
					target: env.VITE_SERVER_API,
					changeOrigin: true,
					secure: false,
					//rewrite: (path) => path.replace(/^\/misapi/, ""),
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
