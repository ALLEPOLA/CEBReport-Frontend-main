// reportnamematch.ts
export const normalizeReportName = (value: string) => {
	return value
		.toLowerCase()
		.replace(/[\u2013\u2014]/g, "-")
		.replace(/\s+/g, " ")  // Normalize spaces
		.replace(/[^a-z0-9\s/()\-]/g, "") // Keep important characters
		.replace(/\bcentre(s)?\b/g, "center$1")
		.trim();
};

export const matchesReportName = (actual: string, expected: string) => {
	const normalizedActual = normalizeReportName(actual);
	const normalizedExpected = normalizeReportName(expected);
	
	// First try exact match
	if (normalizedActual === normalizedExpected) {
		return true;
	}
	
	// Try matching without the leading numbers (e.g., "5. " or "5 - ")
	const actualWithoutNumber = normalizedActual.replace(/^\d+[\s./-]*/, "");
	const expectedWithoutNumber = normalizedExpected.replace(/^\d+[\s./-]*/, "");
	
	return actualWithoutNumber === expectedWithoutNumber;
};