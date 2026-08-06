import {Routes, Route, Navigate} from "react-router-dom";
import {ToastContainer} from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./index.css";

import LoginPage from "./pages/LoginPage";
import Layout from "./Layout";
import HomePage from "./pages/HomePage.tsx";
import UserDetails from "./pages/UserDetails";
import MaterialDetails from "./mainTopics/inventory/MaterialDetails";
import ReportRoutes from "./routes/ReportRoutes";
import CostCenterTrial from "./mainTopics/TrialBalance/CostCenterTrial";
// import SelectCostCenterTrial from "./mainTopics/TrialBalance/SelectCostCeneterTrial";

import AdminHome from "./pages/AdminHome";
import Dashboard from "./pages/Dashboard.tsx";

function App() {
	return (
		<>
			<Routes>
				<Route path="/" element={<LoginPage />} />

        <Route
          path="/adminhome"
          element={
            <Layout>
              <AdminHome />
            </Layout>
          }
        />

				<Route
					path="/adminprofile"
					element={
						<Layout>
							<UserDetails />
						</Layout>
					}
				/>

				<Route
					path="/home"
					element={<Navigate to="/report/report-catalog" replace />}
				/>

				<Route
					path="/dashboard"
					element={
						<Layout>
							<Dashboard />
						</Layout>
					}
				/>

				<Route
					path="/dashboard/:dashboardId"
					element={
						<Layout>
							<Dashboard />
						</Layout>
					}
				/>

				{/* <Route
					path="/report/dashboard"
					element={
						<Layout>
							<HomePage />
						</Layout>
					}
				/>

				<Route
					path="/report/Dashboard"
					element={
						<Layout>
							<HomePage />
						</Layout>
					}
				/> */}

				<Route
					path="/user"
					element={
						<Layout>
							<UserDetails />
						</Layout>
					}
				/>

				<Route
					path="/report/inventory/material-details/:matCd"
					element={
						<Layout>
							<MaterialDetails />
						</Layout>
					}
				/>

				<Route
					path="/report/TrialBalance/costcenters"
					element={
						<Layout>
							<CostCenterTrial />
						</Layout>
					}
				/>

				{/* <Route
  path="/report/TrialBalance/select-cost-center/:compId"
  element={
    <Layout>
      <SelectCostCenterTrial />
    </Layout>
  }
/> */}

				{ReportRoutes()}
			</Routes>

			<ToastContainer />
		</>
	);
}

export default App;
