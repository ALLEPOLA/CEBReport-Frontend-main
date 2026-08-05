import { FormEvent, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { ChevronDown, Pin, PinOff, RefreshCw, Search } from "lucide-react";
import { useUser } from "../../../contexts/UserContext";

type RoleType = "admin" | "user";

type RoleRecord = {
	epfNo: string;
	roleId: string;
	roleName: string;
	company: string;
	assignedCompanies: string[];
	motherCompany: string;
	userGroup: string;
	costCentre: string;
	costCentres: string[];
	userType: string;
};

type CreateRoleForm = {
	name: string;
	epfNo: string;
	roleId: string;
	userType: string;
	businessCompany: string;
	userGroup: string;
	motherCompany: string;
	costCentres: string[];
};

type MotherCompanyOption = {
	companyId: string;
	companyName: string;
};

type CostCentreOption = {
	costCentreId: string;
	departmentName: string;
	lvlNo: number;
	costCentreName: string;
	costCentreDisplay: string;
};

type UserGroupOption = {
	userGroupId: string;
	userGroupName: string;
};

const businessCompanyOptions = ["EDL", "NTNSP", "EGL", "NSO"];
const roleTypeOptions: Array<{ label: string; value: string; tab: RoleType }> = [
	{ label: "USER", value: "USER", tab: "user" },
	{ label: "ADMINISTRATOR", value: "ADMINISTRATOR", tab: "admin" },
];
const rolesPerPage = 10;
const pinnedStorageKey = "user-role-pins";

const initialForm: CreateRoleForm = {
	name: "",
	epfNo: "",
	roleId: "",
	userType: "USER",
	businessCompany: "EDL",
	userGroup: "",
	motherCompany: "",
	costCentres: [],
};

const endpointMap: Record<RoleType, string[]> = {
	admin: ["/misapi/api/roleinfo/ADMIN", "/misapi/api/roleinfo/admin"],
	user: ["/misapi/api/roleinfo/USER", "/misapi/api/roleinfo/user"],
};

const fieldBaseClass =
	"w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-800 shadow-sm outline-none transition focus:border-[#7A0000] focus:ring-2 focus:ring-[#7A0000]/10";

const normalizeText = (value: unknown): string =>
	(value ?? "").toString().trim();

const normalizeKey = (value: unknown): string =>
	normalizeText(value).toUpperCase();

const normalizeRoleKey = (epfNo: unknown, userType: unknown): string =>
	`${normalizeKey(epfNo)}|${normalizeKey(userType)}`;

const splitDelimitedValues = (value: unknown): string[] =>
	normalizeText(value)
		.split(/[;,\|/\s]+/)
		.map((item) => item.trim())
		.filter(Boolean);

const toAssignedCompanyValues = (value: unknown): string[] => {
	if (Array.isArray(value)) {
		return value
			.flatMap((item) => {
				if (item && typeof item === "object") {
					const company = item as Record<string, unknown>;
					return splitDelimitedValues(
						company.CompanyId ??
						company.companyId ??
						company.Company ??
						company.company ??
						company.MotherCompany ??
						company.motherCompany
					);
				}
				return splitDelimitedValues(item);
			})
			.filter(Boolean);
	}

	return splitDelimitedValues(value);
};

const uniqueByNormalizedKey = (values: string[]): string[] => {
	const seen = new Set<string>();

	return values.filter((value) => {
		const key = normalizeKey(value);
		if (!key || seen.has(key)) {
			return false;
		}
		seen.add(key);
		return true;
	});
};

const resolveAssignedCompanyIds = (
	companyValues: string[],
	motherCompanies: MotherCompanyOption[]
): string[] => {
	const isAll = companyValues.some((companyId) => normalizeKey(companyId) === "ALL");

	return uniqueByNormalizedKey(isAll
		? motherCompanies.map((company) => company.companyId)
		: companyValues.map((companyValue) => {
			const normalizedValue = normalizeKey(companyValue);
			const normalizedPrefix = normalizeKey(normalizeText(companyValue).split(/[-:]/)[0]);
			const matched = motherCompanies.find(
				(company) =>
					normalizeKey(company.companyId) === normalizedValue ||
					normalizeKey(company.companyName) === normalizedValue ||
					normalizeKey(company.companyId) === normalizedPrefix
			);
			return matched ? matched.companyId : companyValue;
		}));
};

const normalizeCostCentreId = (value: unknown): string => {
	const text = normalizeText(value);
	return text.includes(" - ") ? text.split(" - ")[0].trim() : text;
};

const uniqueCostCentreIds = (values: string[]): string[] =>
	uniqueByNormalizedKey(values.map(normalizeCostCentreId).filter(Boolean));

const getRoleKey = (role: Pick<RoleRecord, "epfNo" | "userType">): string =>
	normalizeRoleKey(role.epfNo, role.userType);

const handleResponse = async (response: Response) => {
	if (!response.ok) {
		const text = await response.text();
		if (text.trim().startsWith("<")) {
			throw new Error(`Server returned error ${response.status} (${response.statusText}). WebDAV module or IIS URL routing might be blocking PUT/DELETE methods.`);
		}
		try {
			const json = JSON.parse(text);
			throw new Error(json?.errorMessage ?? `Request failed with status ${response.status}`);
		} catch {
			throw new Error(text || `Request failed with status ${response.status}`);
		}
	}
	return response.json();
};

const actionButtonPrimaryClass =
	"rounded-lg bg-[#7A0000] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#620000] disabled:cursor-not-allowed disabled:opacity-60";

const actionButtonSoftClass =
	"rounded-lg bg-[#7A0000]/85 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#620000] disabled:cursor-not-allowed disabled:opacity-50";

const actionButtonDarkClass =
	"rounded-lg bg-stone-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50";

const actionButtonLightClass =
	"rounded-lg border border-[#7A0000]/20 bg-white px-5 py-2.5 text-sm font-semibold text-[#7A0000] transition hover:bg-[#7A0000]/5";

const UserRoles = () => {
	const { user } = useUser();
	const [activeTab, setActiveTab] = useState<RoleType>("user");
	const [roles, setRoles] = useState<RoleRecord[]>([]);
	const [selectedRoleKey, setSelectedRoleKey] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isCompaniesLoading, setIsCompaniesLoading] = useState(false);
	const [isCostCentresLoading, setIsCostCentresLoading] = useState(false);
	const [currentPage, setCurrentPage] = useState(1);
	const [motherCompanies, setMotherCompanies] = useState<MotherCompanyOption[]>([]);
	const [costCentres, setCostCentres] = useState<CostCentreOption[]>([]);
	const [userGroups, setUserGroups] = useState<UserGroupOption[]>([]);
	const [isUserGroupsLoading, setIsUserGroupsLoading] = useState(false);
	const [form, setForm] = useState<CreateRoleForm>(initialForm);
	const [assignedCompanies, setAssignedCompanies] = useState<string[]>([]);
	const [isAddingCostCentresToRole, setIsAddingCostCentresToRole] = useState(false);
	const [tableSearch, setTableSearch] = useState("");
	const [companySearch, setCompanySearch] = useState("");
	const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);
	const [pinnedRoles, setPinnedRoles] = useState<string[]>(() => {
		try {
			const stored = localStorage.getItem(pinnedStorageKey);
			if (!stored) {
				return [];
			}

			const nextPinned = JSON.parse(stored);
			return Array.isArray(nextPinned)
				? nextPinned.map((value) => normalizeKey(value)).filter(Boolean)
				: [];
		} catch {
			return [];
		}
	});

	const loadMotherCompanies = async () => {
		setIsCompaniesLoading(true);

		try {
			const response = await fetch("/misapi/api/roleinfo/companies");

			if (!response.ok) {
				throw new Error(`Failed to load companies. (${response.status})`);
			}

			const payload = await response.json();

			if (payload?.errorMessage) {
				throw new Error(payload.errorMessage);
			}

			const nextCompanies: MotherCompanyOption[] = Array.isArray(payload?.data)
				? payload.data.map((item: any) => ({
					companyId: normalizeText(item?.CompanyId),
					companyName: normalizeText(item?.CompanyName),
				}))
				: [];

			setMotherCompanies(nextCompanies);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to load companies.";
			toast.error(message);
			setMotherCompanies([]);
		} finally {
			setIsCompaniesLoading(false);
		}
	};

	useEffect(() => {
		let isMounted = true;

		const fetchAllCostCentres = async () => {
			if (assignedCompanies.length === 0) {
				setCostCentres([]);
				setIsCostCentresLoading(false);
				return;
			}

			setIsCostCentresLoading(true);

			try {
				let results: any[] = [];

				if (assignedCompanies.length === motherCompanies.length && motherCompanies.length > 0) {
					// Optimization: Fetch all cost centres at once if all companies are selected
					const response = await fetch("/misapi/api/roleinfo/companies/ALL/costcentres");
					if (!response.ok) {
						throw new Error(`Failed to load cost centres for all companies. (${response.status})`);
					}
					const payload = await response.json();
					if (payload?.errorMessage) {
						throw new Error(payload.errorMessage);
					}
					results = [payload?.data ?? []];
				} else {
					const promises = assignedCompanies.map(async (companyId) => {
						const response = await fetch(
							`/misapi/api/roleinfo/companies/${encodeURIComponent(companyId)}/costcentres`
						);
						if (!response.ok) {
							throw new Error(`Failed to load cost centres for company ${companyId}. (${response.status})`);
						}
						const payload = await response.json();
						if (payload?.errorMessage) {
							throw new Error(payload.errorMessage);
						}
						return Array.isArray(payload?.data) ? payload.data : [];
					});
					results = await Promise.all(promises);
				}

				if (!isMounted) return;

				const nextCostCentres: CostCentreOption[] = [];
				const seenIds = new Set<string>();

				for (const data of results) {
					for (const item of data) {
						const costCentreId = item?.costCentre ?? item?.CostCentreId ?? item?.DepartmentId ?? "";
						if (costCentreId && !seenIds.has(costCentreId.toUpperCase())) {
							seenIds.add(costCentreId.toUpperCase());
							nextCostCentres.push({
								costCentreId: costCentreId,
								departmentName: item?.departmentName ?? item?.DepartmentName ?? item?.CostCentreName ?? "",
								lvlNo: Number(item?.lvlNo ?? item?.LvlNo ?? 0),
								costCentreName: item?.costCentreName ?? item?.CostCentreName ?? item?.DepartmentName ?? "",
								costCentreDisplay: item?.costCentreDisplay ?? item?.CostCentreDisplay ?? "",
							});
						}
					}
				}

				setCostCentres(nextCostCentres);
			} catch (error) {
				if (isMounted) {
					const message =
						error instanceof Error ? error.message : "Failed to load cost centres.";
					toast.error(message);
					setCostCentres([]);
				}
			} finally {
				if (isMounted) {
					setIsCostCentresLoading(false);
				}
			}
		};

		fetchAllCostCentres();

		return () => {
			isMounted = false;
		};
	}, [assignedCompanies, motherCompanies]);

	const loadRoles = async (type: RoleType) => {
		setIsLoading(true);

		try {
			let payload: any = null;
			let lastError: Error | null = null;

			for (const endpoint of endpointMap[type]) {
				try {
					const response = await fetch(endpoint);

					if (!response.ok) {
						throw new Error(`Failed to load roles. (${response.status})`);
					}

					const nextPayload = await response.json();

					if (nextPayload?.errorMessage) {
						throw new Error(nextPayload.errorMessage);
					}

					payload = nextPayload;
					break;
				} catch (error) {
					lastError =
						error instanceof Error
							? error
							: new Error("Failed to load roles.");
				}
			}

			if (!payload) {
				throw lastError ?? new Error("Failed to load roles.");
			}

			const nextRoles: RoleRecord[] = Array.isArray(payload?.data)
				? payload.data.map((item: any) => ({
					epfNo: normalizeText(item?.EpfNo),
					roleId: normalizeText(item?.RoleId),
					roleName: normalizeText(item?.RoleName),
					company: normalizeText(item?.Company),
					assignedCompanies: uniqueByNormalizedKey(toAssignedCompanyValues(
						item?.AssignedCompanies ??
						item?.assignedCompanies ??
						item?.Companies ??
						item?.companies ??
						item?.Company
					)),
					motherCompany: normalizeText(item?.MotherCompany),
					userGroup: normalizeText(item?.UserGroup),
					costCentre: normalizeText(item?.CostCentre),
					costCentres: uniqueCostCentreIds(Array.isArray(item?.CostCentres)
						? item.CostCentres.map((value: any) => normalizeText(value)).filter(Boolean)
						: String(item?.CostCentre ?? "")
							.split(/[;,]+/)
							.map((value: string) => normalizeText(value))
							.filter((value: string) => value.length > 0)),
					userType: normalizeText(item?.UserType),
				}))
				: [];

			setRoles(nextRoles);
			setCurrentPage(1);
			setSelectedRoleKey((current) =>
				current && nextRoles.some((role: RoleRecord) => getRoleKey(role) === current)
					? current
					: null
			);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to load roles.";
			toast.error(message);
			setRoles([]);
			setSelectedRoleKey(null);
		} finally {
			setIsLoading(false);
		}
	};

	const loadUserGroups = async () => {
		setIsUserGroupsLoading(true);

		try {
			const response = await fetch("/misapi/api/roleinfo/usergroups");

			if (!response.ok) {
				throw new Error(`Failed to load user groups. (${response.status})`);
			}

			const payload = await response.json();

			if (payload?.errorMessage) {
				throw new Error(payload.errorMessage);
			}

			const groups: UserGroupOption[] = Array.isArray(payload?.data)
				? payload.data.map((item: any) => ({
					userGroupId: normalizeText(item?.UserGroupId),
					userGroupName: normalizeText(item?.UserGroupName),
				}))
				: [];
			setUserGroups(groups);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to load user groups.";
			toast.error(message);
			setUserGroups([]);
		} finally {
			setIsUserGroupsLoading(false);
		}
	};

	useEffect(() => {
		loadRoles(activeTab);
	}, [activeTab]);

	useEffect(() => {
		loadMotherCompanies();
		loadUserGroups();
	}, []);



	useEffect(() => {
		try {
			localStorage.setItem(pinnedStorageKey, JSON.stringify(pinnedRoles));
		} catch {
			// Ignore storage failures and keep the feature session-only.
		}
	}, [pinnedRoles]);

	const handleFieldChange = (field: keyof CreateRoleForm, value: string) => {
		const normalizedValue =
			field === "roleId" || field === "userType"
				? value.toUpperCase()
				: value;

		setForm((current) => ({ ...current, [field]: normalizedValue }));
	};

	const handleReset = () => {
		setForm(initialForm);
		setAssignedCompanies([]);
		setCostCentres([]);
		setSelectedRoleKey(null);
		setCompanySearch("");
	};

	const handleCostCentreToggle = (costCentreId: string) => {
		const normalizedCostCentreId = normalizeCostCentreId(costCentreId);

		setForm((current) => ({
			...current,
			costCentres: current.costCentres.some((value) => normalizeKey(normalizeCostCentreId(value)) === normalizeKey(normalizedCostCentreId))
				? current.costCentres.filter((value) => normalizeKey(normalizeCostCentreId(value)) !== normalizeKey(normalizedCostCentreId))
				: uniqueCostCentreIds([...current.costCentres, normalizedCostCentreId]),
		}));
	};

	const selectAllCostCentres = () => {
		setForm((current) => ({
			...current,
			costCentres: uniqueCostCentreIds(costCentres.map((item) => item.costCentreId)),
		}));
	};

	const invertCostCentreSelection = () => {
		setForm((current) => ({
			...current,
			costCentres: uniqueCostCentreIds(costCentres
				.map((item) => item.costCentreId)
				.filter((costCentreId) => !current.costCentres.some((value) => normalizeKey(normalizeCostCentreId(value)) === normalizeKey(costCentreId)))),
		}));
	};

	const clearCostCentreSelection = () => {
		setForm((current) => ({
			...current,
			costCentres: [],
		}));
	};

	const togglePinnedRole = (role: RoleRecord) => {
		const roleKey = getRoleKey(role);

		setPinnedRoles((current) =>
			current.includes(roleKey)
				? current.filter((value) => value !== roleKey)
				: [...current, roleKey]
		);
	};

	const handleAddCostCentresToSelectedRole = async () => {
		if (!selectedRole) {
			toast.warning("Please select a role first.");
			return;
		}

		if (assignedCompanies.length === 0) {
			toast.warning("Please select a company first.");
			return;
		}

		const selectedCostCentresForCompany = costCentres
			.map((item) => item.costCentreId)
			.filter((costCentreId) => form.costCentres.includes(costCentreId));

		const requestedCostCentres = selectedCostCentresForCompany.filter(
			(costCentreId) =>
				!selectedRole.costCentres.some(
					(existingCostCentre) => normalizeKey(existingCostCentre) === normalizeKey(costCentreId)
				)
		);

		if (requestedCostCentres.length === 0) {
			toast.warning("Please select at least one new cost centre for the selected company.");
			return;
		}

		setIsAddingCostCentresToRole(true);

		try {
			const response = await fetch(
				`/misapi/api/roleinfo/${encodeURIComponent(selectedRole.epfNo)}/${encodeURIComponent(selectedRole.userType)}/costcentres`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						costCentres: requestedCostCentres,
					}),
				}
			);

			const payload = await handleResponse(response);

			if (payload?.errorMessage) {
				throw new Error(payload.errorDetails ? `${payload.errorMessage} Details: ${payload.errorDetails}` : payload.errorMessage);
			}

			toast.success(payload?.data?.message ?? "Cost centres added successfully.");
			setForm((current) => ({
				...current,
				costCentres: Array.from(new Set([...current.costCentres, ...requestedCostCentres])),
			}));
			await loadRoles(activeTab);
			setSelectedRoleKey(getRoleKey(selectedRole));
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to add cost centres.";
			toast.error(message);
		} finally {
			setIsAddingCostCentresToRole(false);
		}
	};

	const buildRolePayload = (originalEpfNo?: string) => {
		const roleNameTrim = form.name.trim();
		const userTypeUpper = form.userType.trim().toUpperCase();

		const payload: any = {
			originalEpfNo: originalEpfNo?.trim() ?? "",
			epfNo: form.epfNo.trim(),
			roleId: form.roleId.trim().toUpperCase(),
			userType: userTypeUpper,
			company: assignedCompanies.join(","),
			motherCompany: form.businessCompany.trim(),
			userGroup: form.userGroup.trim(),
			costCentre: form.costCentres[0] ?? "",
			costCentres: form.costCentres,
			lvlNo: 1,
			addUser: user?.Userno || "",
			updateUser: user?.Userno || "",
		};

		// Omit roleName when blank so backend can accept empty names
		if (roleNameTrim) {
			payload.roleName = roleNameTrim;
		}

		return payload;
	};

	const handleRoleSelect = (role: RoleRecord) => {
		setSelectedRoleKey(getRoleKey(role));
		const roleCompanies = role.assignedCompanies.length > 0
			? role.assignedCompanies
			: splitDelimitedValues(role.company || role.motherCompany);
		const resolvedCompanies = resolveAssignedCompanyIds(roleCompanies, motherCompanies);
		setAssignedCompanies(resolvedCompanies);

		const primaryCompany = resolvedCompanies[0] ?? "";

		// Denormalize userType: backend stores "ADMIN" but form needs "ADMINISTRATOR"
		const userTypeForForm = role.userType === "ADMIN" ? "ADMINISTRATOR" : role.userType;

		setForm({
			name: role.roleName,
			epfNo: role.epfNo,
			roleId: role.roleId,
			userType: userTypeForForm,
			businessCompany: role.motherCompany,
			userGroup: role.userGroup || initialForm.userGroup,
			motherCompany: primaryCompany,
			costCentres: role.costCentres,
		});



		setActiveTab(userTypeForForm.trim().toUpperCase().startsWith("USER") ? "user" : "admin");
	};

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		// Validation: Check if EPF No and User Type combined already exists
		const normalizedUserType = form.userType === "ADMINISTRATOR" ? "ADMIN" : form.userType;
		const isDuplicate = roles.some(
			(r) =>
				normalizeKey(r.epfNo) === normalizeKey(form.epfNo) &&
				normalizeKey(r.userType) === normalizeKey(normalizedUserType)
		);
		if (isDuplicate) {
			toast.error("A role with this EPF Number and User Type already exists.");
			return;
		}

		setIsSubmitting(true);

		try {
			const response = await fetch("/misapi/api/roleinfo", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(buildRolePayload()),
			});

			const payload = await handleResponse(response);

			if (payload?.errorMessage) {
				throw new Error(payload.errorDetails ? `${payload.errorMessage} Details: ${payload.errorDetails}` : payload.errorMessage);
			}

			toast.success(payload?.data?.message ?? "Role created successfully.");

			handleReset();
			const nextTab =
				form.userType.trim().toUpperCase().startsWith("USER") ? "user" : "admin";
			setActiveTab(nextTab);
			await loadRoles(nextTab);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to create role.";
			toast.error(message);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleEdit = async () => {
		if (!selectedRole) {
			return;
		}

		// Validation: Check if EPF No and User Type combined already exists on a different role
		const normalizedUserType = form.userType === "ADMINISTRATOR" ? "ADMIN" : form.userType;
		const isDuplicate = roles.some(
			(r) =>
				getRoleKey(r) !== getRoleKey(selectedRole) &&
				normalizeKey(r.epfNo) === normalizeKey(form.epfNo) &&
				normalizeKey(r.userType) === normalizeKey(normalizedUserType)
		);
		if (isDuplicate) {
			toast.error("A role with this EPF Number and User Type already exists.");
			return;
		}

		setIsSubmitting(true);

		try {
			const response = await fetch(
				`/misapi/api/roleinfo/${encodeURIComponent(selectedRole.epfNo)}/${encodeURIComponent(selectedRole.userType)}/update`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						...buildRolePayload(selectedRole.epfNo),
						originalUserType: selectedRole.userType,
					}),
				}
			);
			const payload = await handleResponse(response);

			if (payload?.errorMessage) {
				throw new Error(payload.errorDetails ? `${payload.errorMessage} Details: ${payload.errorDetails}` : payload.errorMessage);
			}

			toast.success(payload?.data?.message ?? "Role updated successfully.");
			const nextTab =
				form.userType.trim().toUpperCase().startsWith("USER") ? "user" : "admin";
			setActiveTab(nextTab);
			await loadRoles(nextTab);
			setSelectedRoleKey(
				normalizeRoleKey(
					form.epfNo,
					form.userType === "ADMINISTRATOR" ? "ADMIN" : form.userType
				)
			);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to update role.";
			toast.error(message);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDelete = async () => {
		if (!selectedRole) {
			return;
		}

		setIsSubmitting(true);

		try {
			const response = await fetch(
				`/misapi/api/roleinfo/${encodeURIComponent(selectedRole.epfNo)}/${encodeURIComponent(selectedRole.userType)}/delete`,
				{ method: "POST" }
			);
			const payload = await handleResponse(response);

			if (payload?.errorMessage) {
				throw new Error(payload.errorDetails ? `${payload.errorMessage} Details: ${payload.errorDetails}` : payload.errorMessage);
			}

			toast.success(payload?.data?.message ?? "Role deleted successfully.");
			handleReset();
			await loadRoles(activeTab);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to delete role.";
			toast.error(message);
		} finally {
			setIsSubmitting(false);
		}
	};

	const selectedRole = selectedRoleKey
		? roles.find((role) => getRoleKey(role) === selectedRoleKey) ?? null
		: null;

	useEffect(() => {
		if (!selectedRole) {
			return;
		}

		const roleCompanies = selectedRole.assignedCompanies.length > 0
			? selectedRole.assignedCompanies
			: splitDelimitedValues(selectedRole.company || selectedRole.motherCompany);
		const resolvedCompanies = resolveAssignedCompanyIds(roleCompanies, motherCompanies);

		setAssignedCompanies((current) => {
			const currentKey = uniqueByNormalizedKey(current).map(normalizeKey).join("|");
			const nextKey = resolvedCompanies.map(normalizeKey).join("|");
			return currentKey === nextKey ? current : resolvedCompanies;
		});
	}, [motherCompanies, selectedRole]);

	const filteredRoles = roles.filter((role) => {
		const query = normalizeKey(tableSearch);

		if (!query) {
			return true;
		}

		const haystack = [role.epfNo, role.roleId, role.roleName]
			.map((item) => normalizeKey(item))
			.join(" ");

		return haystack.includes(query);
	});
	const sortedRoles = [...filteredRoles].sort((left, right) => {
		const leftPinned = pinnedRoles.includes(getRoleKey(left));
		const rightPinned = pinnedRoles.includes(getRoleKey(right));

		if (leftPinned !== rightPinned) {
			return leftPinned ? -1 : 1;
		}

		return left.roleName.localeCompare(right.roleName) || left.epfNo.localeCompare(right.epfNo) || left.userType.localeCompare(right.userType);
	});
	const totalPages = Math.max(1, Math.ceil(filteredRoles.length / rolesPerPage));
	const paginatedRoles = sortedRoles.slice(
		(currentPage - 1) * rolesPerPage,
		currentPage * rolesPerPage
	);

	useEffect(() => {
		setCurrentPage(1);
	}, [tableSearch, activeTab]);

	const changePage = (page: number) => {
		if (page < 1 || page > totalPages) {
			return;
		}
		setCurrentPage(page);
	};

	const filteredMotherCompanies = motherCompanies.filter((company) => {
		const query = normalizeKey(companySearch);

		if (!query) {
			return true;
		}

		return [company.companyId, company.companyName]
			.map((value) => normalizeKey(value))
			.join(" ")
			.includes(query);
	});
	const hasAllCompaniesSelected = assignedCompanies.some((companyId) => normalizeKey(companyId) === "ALL");
	const isCompanySelected = (companyId: string): boolean =>
		hasAllCompaniesSelected ||
		assignedCompanies.some((selectedCompanyId) => normalizeKey(selectedCompanyId) === normalizeKey(companyId));
	const selectedCompanyCount = hasAllCompaniesSelected
		? motherCompanies.length
		: motherCompanies.filter((company) => isCompanySelected(company.companyId)).length;

	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(122,0,0,0.08),_transparent_35%),linear-gradient(180deg,_#faf7f2_0%,_#f3efe7_100%)] px-2 py-4 text-stone-900">
			<div className="mx-auto max-w-7xl space-y-6">
				<section className="grid gap-6 xl:grid-cols-[minmax(0,40%)_minmax(0,60%)] xl:items-start">
					<form
						onSubmit={handleSubmit}
						className="w-full rounded-[28px] border border-[#7A0000]/10 bg-white p-6 shadow-[0_16px_50px_rgba(122,0,0,0.08)] xl:order-1"
					>
						<div className="flex items-start justify-between gap-4">
							<div>
								<h2 className="text-2xl font-semibold text-stone-900">User Role Form</h2>
							</div>
							<button
								type="button"
								onClick={() => loadRoles(activeTab)}
								className="inline-flex items-center gap-2 rounded-full border border-[#7A0000]/20 px-4 py-2 text-sm font-medium text-[#7A0000] transition hover:border-[#7A0000]/40 hover:bg-[#7A0000]/5"
							>
								<RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
								Refresh
							</button>
						</div>

						<div className="mt-6 space-y-6">
							<div className="grid gap-4">
								<Input
									label="Name (optional)"
									value={form.name}
									onChange={(value) => handleFieldChange("name", value)}
								/>
								<Input label="Role ID" value={form.roleId} onChange={(value) => handleFieldChange("roleId", value)} />
								<Input label="EPF Number" value={form.epfNo} onChange={(value) => handleFieldChange("epfNo", value)} />
							</div>

							<SelectionGroup
								label="User Type"
								groupName="userType"
								options={roleTypeOptions.map((option) => ({
									label: option.label,
									value: option.value,
								}))}
								value={form.userType}
								onChange={(value) => {
									handleFieldChange("userType", value);
									if (!selectedRole) {
										setActiveTab(value === "USER" ? "user" : "admin");
									}
								}}
							/>

							<Select
								label="User Group"
								value={form.userGroup}
								onChange={(value) => handleFieldChange("userGroup", value)}
								options={userGroups.map((g) => `${g.userGroupId} - ${g.userGroupName}`)}
								optionValues={userGroups.map((g) => g.userGroupId)}
								placeholder={isUserGroupsLoading ? "Loading user groups..." : "Select user group"}
							/>

							<SelectionGroup
								label="Mother Company"
								groupName="company"
								options={businessCompanyOptions.map((option) => ({ label: option, value: option }))}
								value={form.businessCompany}
								onChange={(value) => handleFieldChange("businessCompany", value)}
							/>

							<div className="grid gap-4 md:grid-cols-[1fr]">
								<div className="relative">
									<label className="block">
										<span className="mb-1.5 block text-sm font-medium text-stone-700">Select Companies</span>
										<button
											type="button"
												onClick={() => {
													setIsCompanyDropdownOpen((current) => !current);
													if (!isCompanyDropdownOpen) {
														setCompanySearch("");
													}
												}}
											className={`${fieldBaseClass} flex items-center justify-between`}
										>
											<span className="truncate">
												{selectedCompanyCount === 0
													? "Select companies"
													: `${selectedCompanyCount} companies selected`}
											</span>
											<ChevronDown className={`h-4 w-4 text-stone-500 transition-transform ${isCompanyDropdownOpen ? "rotate-180" : ""}`} />
										</button>
									</label>

									{isCompanyDropdownOpen && (
										<>
											<div className="fixed inset-0 z-10" onClick={() => setIsCompanyDropdownOpen(false)} />
											<div className="absolute z-20 mt-1 w-full rounded-xl border border-stone-200 bg-white p-3 shadow-lg">
												<div className="mb-2 flex items-center justify-between border-b border-stone-100 pb-2">
													<div className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
														Options
													</div>
													<div className="flex gap-2">
														<button
															type="button"
															onClick={() => {
																const allCompanyIds = motherCompanies.map(c => c.companyId);
																setAssignedCompanies(allCompanyIds);
																if (allCompanyIds.length > 0) {
																	handleFieldChange("motherCompany", allCompanyIds[0]);
																}
															}}
															className="rounded border border-stone-300 bg-white px-2 py-0.5 text-xs text-stone-700 hover:bg-stone-100"
														>
															Select All
														</button>
														<button
															type="button"
															onClick={() => {
																setAssignedCompanies([]);
																handleFieldChange("motherCompany", "");
															}}
															className="rounded border border-stone-300 bg-white px-2 py-0.5 text-xs text-stone-700 hover:bg-stone-100"
														>
															Clear All
														</button>
													</div>
												</div>
												<div className="mb-2 flex items-center gap-2">
													<div className="relative flex-1">
														<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
														<input
															type="text"
															value={companySearch}
															onChange={(e) => setCompanySearch(e.target.value)}
															placeholder="Search companies..."
															className="w-full rounded-md border border-stone-300 bg-white py-2 pl-10 pr-4 text-sm text-stone-800 shadow-sm outline-none transition focus:border-[#7A0000] focus:ring-2 focus:ring-[#7A0000]/10"
														/>
													</div>
													{companySearch ? (
														<button
															type="button"
															onClick={() => setCompanySearch("")}
															className="rounded-md border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 transition hover:bg-stone-100"
														>
															Clear
														</button>
													) : null}
												</div>
												<div className="max-h-48 overflow-y-auto pr-2">
													{isCompaniesLoading ? (
														<div className="text-sm text-stone-500">Loading companies...</div>
													) : motherCompanies.length === 0 ? (
														<div className="text-sm text-stone-500">No companies available.</div>
													) : filteredMotherCompanies.length === 0 ? (
														<div className="text-sm text-stone-500">No matching companies found.</div>
													) : (
														<ul className="space-y-2">
																{filteredMotherCompanies.map((company) => {
																	const isChecked = isCompanySelected(company.companyId);
																	return (
																		<li key={company.companyId} className="flex items-center gap-2 text-sm text-stone-800">
																			<input
																				type="checkbox"
																				checked={isChecked}
																				onChange={(e) => {
																					const checked = e.target.checked;
																					setAssignedCompanies((current) => {
																						if (checked) {
																							const normalized = normalizeKey(company.companyId);
																							if (!normalized || current.some((item) => normalizeKey(item) === normalized)) {
																								return current;
																							}
																							return uniqueByNormalizedKey([...current, company.companyId]);
																						}
																						if (current.some((id) => normalizeKey(id) === "ALL")) {
																							return motherCompanies
																								.map((item) => item.companyId)
																								.filter((id) => normalizeKey(id) !== normalizeKey(company.companyId));
																						}
																						return current.filter((id) => normalizeKey(id) !== normalizeKey(company.companyId));
																					});
																					if (checked) {
																						handleFieldChange("motherCompany", company.companyId);
																					}
																				}}
																				className="h-4 w-4 rounded border-stone-400 text-[#7A0000] focus:ring-[#7A0000]"
																			/>
																			<span>
																				{company.companyId} - {company.companyName}
																			</span>
																		</li>
																	);
																})}
														</ul>
													)}
												</div>
											</div>
										</>
									)}
								</div>
							</div>

							<div>
								<div className="mb-2 flex items-center justify-between gap-3">
									<span className="text-sm font-medium text-stone-700">Department / Cost Center</span>
									<button
										type="button"
										onClick={handleAddCostCentresToSelectedRole}
										aria-label="Add cost centers"
										disabled={!selectedRole || isAddingCostCentresToRole || isSubmitting}
										className="inline-flex items-center gap-2 rounded-md bg-[#7A0000] px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-[#620000] border border-transparent focus:outline-none focus:ring-2 focus:ring-[#7A0000]/30"
									>
										<span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-[#7A0000] font-semibold">+</span>
										<span className="text-sm">{isAddingCostCentresToRole ? "Adding..." : "Add cost centers"}</span>
									</button>
								</div>

								{/* Available Departments */}
								<div className="rounded-2xl border border-stone-200 bg-stone-50 p-3">
									<div className="mb-2 text-xs font-semibold text-stone-700 uppercase tracking-wide">
										Available Departments
									</div>
									{isCostCentresLoading ? (
										<div className="text-sm text-stone-500">Loading cost centres...</div>
									) : costCentres.length === 0 ? (
										<div className="text-sm text-stone-500">
											{assignedCompanies.length > 0
												? "No departments or cost centres found for the selected companies."
												: "Select a company to load departments and cost centres."}
										</div>
									) : (
										<>
											<div className="mb-3 flex flex-wrap gap-2">
												<button type="button" onClick={selectAllCostCentres} className="rounded border border-stone-300 bg-white px-2.5 py-1 text-xs text-stone-700 hover:bg-stone-100">select all</button>
												<button type="button" onClick={invertCostCentreSelection} className="rounded border border-stone-300 bg-white px-2.5 py-1 text-xs text-stone-700 hover:bg-stone-100">invert selection</button>
												<button type="button" onClick={clearCostCentreSelection} className="rounded border border-stone-300 bg-white px-2.5 py-1 text-xs text-stone-700 hover:bg-stone-100">select none</button>
												<button type="button" onClick={clearCostCentreSelection} className="rounded border border-stone-300 bg-white px-2.5 py-1 text-xs text-stone-700 hover:bg-stone-100">reset</button>
											</div>
											<ul className="space-y-2">
												{costCentres
													.map((item) => {
														const isChecked = form.costCentres.some(
															(costCentreId) => normalizeKey(normalizeCostCentreId(costCentreId)) === normalizeKey(item.costCentreId)
														);

														return (
														<li key={item.costCentreId} className="flex items-center gap-2 text-sm text-stone-800">
															<input
																type="checkbox"
																checked={isChecked}
																onChange={() => handleCostCentreToggle(item.costCentreId)}
																className="h-4 w-4 rounded border-stone-400 text-[#7A0000] focus:ring-[#7A0000]"
															/>
															<span>
																{item.costCentreId} - {item.departmentName || item.costCentreName}
															</span>
														</li>
													);
												})}
											</ul>
										</>
									)}
								</div>
							</div>
						</div>

						<div className="mt-8 flex flex-wrap gap-3">
							<button
								type="submit"
								disabled={isSubmitting}
								className={actionButtonPrimaryClass}
							>
								{isSubmitting ? "Saving..." : "ADD"}
							</button>
							<button
								type="button"
								disabled={!selectedRole || isSubmitting}
								onClick={handleEdit}
								className={actionButtonSoftClass}
							>
								EDIT
							</button>
							<button
								type="button"
								disabled={!selectedRole || isSubmitting}
								onClick={handleDelete}
								className={actionButtonDarkClass}
							>
								DELETE
							</button>
							<button
								type="button"
								onClick={handleReset}
								className={actionButtonLightClass}
							>
								RESET
							</button>
						</div>
					</form>

					<section className="w-full rounded-[28px] border border-stone-200 bg-white p-6 shadow-[0_16px_50px_rgba(70,40,20,0.06)] xl:order-2">
						<div className="flex flex-wrap items-center justify-between gap-4">
							<div>
								<h2 className="text-2xl font-semibold text-stone-900">User Role Table</h2>
								</div>

							<div className="inline-flex rounded-full border border-stone-200 bg-stone-100 p-1">
								<TabButton
									label="USER ROLES"
									active={activeTab === "user"}
									onClick={() => setActiveTab("user")}
								/>
								<TabButton
									label="ADMIN ROLES"
									active={activeTab === "admin"}
									onClick={() => setActiveTab("admin")}
								/>
							</div>
						</div>

						<div className="mt-4 flex items-center gap-2">
							<div className="relative flex-1">
								<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
								<input
									type="text"
									value={tableSearch}
									onChange={(e) => setTableSearch(e.target.value)}
									placeholder="Search by EPF No, Role ID, or User Name"
									className={`${fieldBaseClass} pl-10`}
								/>
							</div>
							<button
								type="button"
								onClick={() => setTableSearch("")}
								className="inline-flex items-center gap-2 rounded-xl border border-[#7A0000]/25 bg-white px-6 py-2 text-sm font-semibold text-[#7A0000] transition hover:bg-[#7A0000]/5"
							>
								<Search className="h-4 w-4" />
								Clear
							</button>
						</div>

						<div className="mt-6 overflow-hidden rounded-2xl border border-stone-200 bg-stone-50/40">
							<div className="overflow-x-auto">
								<table className="min-w-full divide-y divide-stone-200 text-sm">
									<thead className="bg-stone-100 text-left text-xs uppercase tracking-[0.15em] text-stone-500">
										<tr>
											<th className="px-4 py-3">EPF No</th>
											<th className="px-4 py-3">Role ID</th>
											<th className="px-4 py-3">Role Name</th>
											<th className="px-4 py-3">Mother Company</th>
											<th className="px-4 py-3">User Group</th>
											<th className="px-4 py-3"></th>
										</tr>
									</thead>
									<tbody className="divide-y divide-stone-100 bg-white">
										{isLoading ? (
											<tr>
												<td colSpan={6} className="px-4 py-10 text-center text-stone-500">
													Loading roles...
												</td>
											</tr>
										) : filteredRoles.length === 0 ? (
											<tr>
												<td colSpan={6} className="px-4 py-10 text-center text-stone-500">
													No matching roles found.
												</td>
											</tr>
										) : (
											paginatedRoles.map((role) => {
												const isSelected = selectedRoleKey ? getRoleKey(role) === selectedRoleKey : false;
												const isPinned = pinnedRoles.includes(getRoleKey(role));
												return (
													<tr
														key={`${role.epfNo}-${role.userType}`}
														onClick={() => handleRoleSelect(role)}
														className={`cursor-pointer transition ${isSelected ? "bg-[#7A0000]/8" : "hover:bg-stone-50"
															}`}
													>
														<td className="px-4 py-3">{role.epfNo || "-"}</td>
														<td className="px-4 py-3 font-semibold text-stone-900">{role.roleId}</td>
														<td className="px-4 py-3">{role.roleName || "-"}</td>
														<td className="px-4 py-3">{role.motherCompany || "-"}</td>
														<td className="px-4 py-3">{role.userGroup || "-"}</td>
														<td className="px-4 py-3">
															<button
																type="button"
																onClick={(event) => {
																	event.stopPropagation();
																	togglePinnedRole(role);
																}}
																aria-label={isPinned ? `Unpin ${role.roleName || role.epfNo}` : `Pin ${role.roleName || role.epfNo}`}
																className={`inline-flex items-center justify-center h-8 w-8 rounded-full border transition ${isPinned ? "border-[#7A0000]/30 bg-[#7A0000]/10 text-[#7A0000]" : "border-stone-300 bg-white text-stone-600 hover:border-[#7A0000]/25 hover:text-[#7A0000]"}`}
															>
																{isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
															</button>
														</td>
													</tr>
												);
											})
										)}
									</tbody>
								</table>
							</div>
						</div>

						{filteredRoles.length > 0 && (
							<div className="mt-4 flex items-center justify-between gap-3 text-sm">
								<div className="text-stone-600">
										Page {currentPage} of {totalPages} ({filteredRoles.length} shown, {pinnedRoles.length} pinned)
								</div>
								<div className="flex items-center gap-2">
									<button
										type="button"
										onClick={() => changePage(currentPage - 1)}
										disabled={currentPage === 1}
										className="rounded-md border border-stone-300 px-3 py-1.5 text-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
									>
										Previous
									</button>
									<button
										type="button"
										onClick={() => changePage(currentPage + 1)}
										disabled={currentPage === totalPages}
										className="rounded-md border border-stone-300 px-3 py-1.5 text-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
									>
										Next
									</button>
								</div>
							</div>
						)}

						<div className="mt-5 rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-4 text-sm text-stone-600">
							{selectedRole ? (
								<div className="grid gap-1 md:grid-cols-2">
									<div>
										<span className="font-semibold text-stone-800">Selected Role:</span> {selectedRole.roleId}
									</div>
									<div>
										<span className="font-semibold text-stone-800">Role Name:</span> {selectedRole.roleName || "-"}
									</div>
									<div>
										<span className="font-semibold text-stone-800">EPF No:</span> {selectedRole.epfNo || "-"}
									</div>
									<div>
										<span className="font-semibold text-stone-800">User Type:</span> {selectedRole.userType || "-"}
									</div>
									<div className="md:col-span-2">
										<span className="font-semibold text-stone-800">Assigned Companies:</span> {selectedRole.company || "-"}
									</div>
								</div>
							) : (
								<span>Select a row to prepare future edit or delete actions.</span>
							)}
						</div>
					</section>
				</section>
			</div>
		</div>
	);
};

const Input = ({
	label,
	value,
	onChange,
	type = "text",
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	type?: string;
}) => (
	<label className="block">
		<span className="mb-1.5 block text-sm font-medium text-stone-700">{label}</span>
		<input
			type={type}
			value={value}
			onChange={(event) => onChange(event.target.value)}
			className={fieldBaseClass}
		/>
	</label>
);

const Select = ({
	label,
	value,
	onChange,
	options,
	optionValues,
	placeholder,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	options: string[];
	optionValues?: string[];
	placeholder?: string;
}) => (
	<label className="block">
		<span className="mb-1.5 block text-sm font-medium text-stone-700">{label}</span>
		<select
			value={value}
			onChange={(event) => onChange(event.target.value)}
			className={fieldBaseClass}
		>
			<option value="">{placeholder ?? "Select an option"}</option>
			{options.map((option, index) => (
				<option key={option} value={optionValues?.[index] ?? option}>
					{option}
				</option>
			))}
		</select>
	</label>
);

const SelectionGroup = ({
	label,
	groupName,
	options,
	value,
	onChange,
}: {
	label: string;
	groupName: string;
	options: Array<{ label: string; value: string }>;
	value: string;
	onChange: (value: string) => void;
}) => (
	<div>
		<div className="mb-2 text-sm font-medium text-stone-700">{label}</div>
		<div className="flex flex-wrap items-center gap-5 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2">
			{options.map((option) => {
				const isActive = option.value === value;

				return (
					<label
						key={option.value}
						className="inline-flex cursor-pointer items-center gap-2 text-sm text-stone-800"
					>
						<input
							type="radio"
							name={groupName}
							checked={isActive}
							onChange={() => onChange(option.value)}
							className="h-4 w-4 border-stone-400 text-[#7A0000] focus:ring-[#7A0000]"
						/>
						<span>{option.label}</span>
					</label>
				);
			})}
		</div>
	</div>
);

const TabButton = ({
	label,
	active,
	onClick,
}: {
	label: string;
	active: boolean;
	onClick: () => void;
}) => (
	<button
		type="button"
		onClick={onClick}
		className={`rounded-full px-4 py-2 text-sm font-semibold transition ${active ? "bg-[#7A0000] text-white shadow" : "text-stone-600 hover:text-stone-900"
			}`}
	>
		{label}
	</button>
);

export default UserRoles;
