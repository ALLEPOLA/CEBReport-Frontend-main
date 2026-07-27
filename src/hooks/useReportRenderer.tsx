import type { ReactNode } from "react";
import {
	getReportComponent,
	getReportComponentLoose,
} from "../utils/reportComponentRegistry";
import { normalizeReportName } from "../utils/reportNameMatch";
import DynamicReportByRepId from "../components/shared/DynamicReportByRepId";
// import CcApplicationProgress from "../mainTopics/SolarJobs/CcApplicationProgress";
// import PHVObsoleteIdleFIFO from "../mainTopics/fifo/PHVObsoleteIdleFIFO";

/**
 * Hook to render a report component based on its name.
 * Returns the component if found, otherwise returns an error message.
 */
export const useReportRenderer = () => {
	return (subtopicName: string, repIdNo?: string): ReactNode => {
		//const repId = repIdNo?.trim() ?? "";
		// Some reports are known to use fixed repId numbers in the backend
		// that don't always match registry lookups. Render the component
		// directly for those repIds to avoid the generic fallback page.
		// if (repId === "14") {
		// 		return <CcApplicationProgress />;
		// 	}

		// if (repId === "103") {
		// 	return <PHVObsoleteIdleFIFO />;
		// }

		const normalized = normalizeReportName(subtopicName);
		const withoutLeadingNumber = normalizeReportName(
			subtopicName.replace(/^\d+(?:\s*[./-]\s*\d+)*\s*/, "")
		);

		const Component =
			getReportComponent(normalized) ??
			getReportComponent(withoutLeadingNumber) ??
			getReportComponentLoose(withoutLeadingNumber);

		if (!Component) {
			return <DynamicReportByRepId repIdNo={repIdNo ?? ""} reportName={subtopicName} />;
		}

		return <Component />;
	};
};
