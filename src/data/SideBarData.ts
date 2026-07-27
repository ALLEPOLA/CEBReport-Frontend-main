import type { ComponentType } from "react";
import { MdPayment, MdPower, MdAssignmentTurnedIn, MdBuild, MdInventory2, MdDashboard } from "react-icons/md";
import { RiBankLine } from "react-icons/ri";
import { FaBoxes, FaFileInvoiceDollar, FaBalanceScale, FaBookOpen, FaMoneyCheckAlt } from "react-icons/fa";
import { BsFolder2Open } from "react-icons/bs";
import { GiSolarPower } from "react-icons/gi";
import { FiBriefcase } from "react-icons/fi";
import { FaArrowDownShortWide } from "react-icons/fa6";
import { TbReportAnalytics } from "react-icons/tb";

type ApiEnvelope<T> = {
  data: T;
  errorMessage: string | null;
};

type RoleLikeObject = {
  RoleId?: unknown;
  roleId?: unknown;
  roleid?: unknown;
  UserNo?: unknown;
  userNo?: unknown;
  userno?: unknown;
  EPFNo?: unknown;
  EpfNo?: unknown;
  epfNo?: unknown;
  epfno?: unknown;
  BillMap?: unknown;
  billMap?: unknown;
  bill_map?: unknown;
  LevelNo?: unknown;
  levelNo?: unknown;
  level_no?: unknown;
};

type UserRoleInfo = {
  roleId: string;
  billMap: string | null;
  levelNo: string | null;
};

type RoleReportApiItem = {
  RepIdNo?: unknown;
  CategoryName?: unknown;
  ReportName?: unknown;
  repIdNo?: unknown;
  categoryName?: unknown;
  reportName?: unknown;
  repid_no?: unknown;
  catname?: unknown;
  repname?: unknown;
};

type CategoryConfig = {
  icon: TopicIcon;
  path: string;
};

export type TopicIcon = ComponentType<{ className?: string }>;

export type Subtopic = {
  id: number;
  repIdNo: string;
  name: string;
};

export type Topic = {
  id: number;
  name: string;
  icon: TopicIcon;
  subtopics: Subtopic[];
  path: string;
};

export type SidebarResult = {
  data: Topic[];
  message: string | null;
  billMap: string | null;
  levelNo: string | null;
};

const USER_ROLE_ENDPOINTS = [
  "/misapi/api/userrole",
];
const ROLE_REPORTS_ENDPOINTS = [
  "/misapi/api/reprolereports/get",
  
];

const DEFAULT_CATEGORY_CONFIG: CategoryConfig = {
  icon: TbReportAnalytics,
  path: "/report/reports",
};

// Backward-compatibility export for existing imports until all pages are moved to API-loaded data.
export const data: Topic[] = [];

export const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  Dashboard: { icon: MdDashboard, path: "/dashboard" },
  DashBoard: { icon: MdDashboard, path: "/dashboard" },
  "Main Dashboard": { icon: MdDashboard, path: "/dashboard" },
  "DB-Dashboard": { icon: MdDashboard, path: "/dashboard" },
  "DB-DASHBOARD": { icon: MdDashboard, path: "/dashboard" },
  "Dashboards": { icon: MdDashboard, path: "/dashboard" },
  General: { icon: MdPayment, path: "/report/general" },
  "Customer Details": { icon: RiBankLine, path: "/report/billing-payment" },
  Analysis: { icon: FaBoxes, path: "/report/analysis" },


  Collections: { icon: BsFolder2Open, path: "/report/collections" },
  "Consumption Analysis": { icon: MdAssignmentTurnedIn, path: "/report/consumption-analysis" },
  "Solar Information - Billing": { icon: GiSolarPower, path: "/report/solar-information" },
  "Solar Information Billing": { icon: GiSolarPower, path: "/report/solar-information" },
  "Solar Information - Jobs": { icon: GiSolarPower, path: "/report/SolarInformationJobs" },
  "PUCSL/LISS": { icon: GiSolarPower, path: "/report/pucsl-liss" },
  Inventory: { icon: MdInventory2, path: "/report/inventory" },
  "Trial Balance": { icon: FaBalanceScale, path: "/report/trialBalance" },
  "Income & Expenditure": { icon: FaArrowDownShortWide, path: "/report/IncomeExpenditure" },
  "Work In Progress": { icon: MdBuild, path: "/report/WorkInProgress" },
  Jobs: { icon: FiBriefcase, path: "/report/jobs" },
  "Ledger Cards": { icon: FaBookOpen, path: "/report/LedgerCards" },
  "Cash Book": { icon: FaMoneyCheckAlt, path: "/report/CashBook" },
  PIV: { icon: TbReportAnalytics, path: "/report/PIV" },
  "PIV Details": { icon: TbReportAnalytics, path: "/report/PIV" },
  "Physical Verification": { icon: TbReportAnalytics, path: "/report/PhysicalVerification" },
  "Billing Finance Reports": { icon: FaFileInvoiceDollar, path: "/report/billing-finance-reports" },
  "Transmission Billing": { icon: MdPower, path: "/report/transmission-billing" },
  "Solar Religious Purpose (SRP)": { icon: GiSolarPower, path: "/report/SRP" },
  "Physical Verification - FIFO": { icon: TbReportAnalytics, path: "/report/PhysicalVerification/FIFO" },
};

const normalizeCategoryKey = (value: string): string =>
  value
    .trim()
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s*-\s*/g, " - ")
    .replace(/\s+/g, " ");

const normalizeText = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/\s+/g, " ");
};

const toSlug = (value: string): string => {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

  return slug || "reports";
};

const toIdNumber = (repIdNo: string, fallback: number): number => {
  const parsed = Number.parseInt(repIdNo, 10);
  if (Number.isFinite(parsed)) {
    return parsed;
  }

  return fallback;
};

const normalizeId = (value: string): string => value.trim().toLowerCase();

const readUserIdFromObject = (value: RoleLikeObject): string | null => {
  const raw =
    value.UserNo ??
    value.userNo ??
    value.userno ??
    value.EPFNo ??
    value.EpfNo ??
    value.epfNo ??
    value.epfno;

  if (raw === undefined || raw === null) {
    return null;
  }

  const userId = String(raw).trim();
  return userId.length > 0 ? userId : null;
};

const readRoleIdFromObject = (value: RoleLikeObject): string | null => {
  const raw = value.RoleId ?? value.roleId ?? value.roleid;
  if (raw === undefined || raw === null) {
    return null;
  }

  const roleId = String(raw).trim();
  return roleId.length > 0 ? roleId : null;
};

const readBillMapFromObject = (value: RoleLikeObject): string | null => {
  const raw = value.BillMap ?? value.billMap ?? value.bill_map;
  if (raw === undefined || raw === null) {
    return null;
  }
  const billMap = String(raw).trim();
  return billMap.length > 0 ? billMap : null;
};

const readLevelNoFromObject = (value: RoleLikeObject): string | null => {
  const raw = value.LevelNo ?? value.levelNo ?? value.level_no;
  if (raw === undefined || raw === null) {
    return null;
  }
  const levelNo = String(raw).trim();
  return levelNo.length > 0 ? levelNo : null;
};

const extractRoleInfoList = (value: unknown, epfNo?: string): UserRoleInfo[] => {
  const infos: UserRoleInfo[] = [];
  const normalizedEpfNo = epfNo ? normalizeId(epfNo) : "";

  const tryAdd = (item: RoleLikeObject) => {
    const userId = readUserIdFromObject(item);
    const isMatchingUser =
      !normalizedEpfNo ||
      !userId ||
      normalizeId(userId) === normalizedEpfNo;

    if (!isMatchingUser) return;

    const roleId = readRoleIdFromObject(item);
    if (!roleId) return;

    infos.push({
      roleId,
      billMap: readBillMapFromObject(item),
      levelNo: readLevelNoFromObject(item),
    });
  };

  if (Array.isArray(value)) {
    for (const item of value) {
      if (item && typeof item === "object") {
        tryAdd(item as RoleLikeObject);
      }
    }
  } else if (value && typeof value === "object") {
    tryAdd(value as RoleLikeObject);
  }

  return infos;
};



const toRoleReportItems = (value: unknown): RoleReportApiItem[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item) => item && typeof item === "object") as RoleReportApiItem[];
};

const getReportRepId = (report: RoleReportApiItem): string =>
  String(report.RepIdNo ?? report.repIdNo ?? report.repid_no ?? "").trim();

const getReportCategoryName = (report: RoleReportApiItem): string =>
  normalizeCategoryKey(
    normalizeText(report.CategoryName ?? report.categoryName ?? report.catname)
  );

const getReportName = (report: RoleReportApiItem): string =>
  normalizeText(report.ReportName ?? report.reportName ?? report.repname);

const getCategoryConfig = (categoryName: string): CategoryConfig => {
  const normalized = normalizeCategoryKey(categoryName);
  const configured =
    CATEGORY_CONFIG[normalized] ??
    Object.entries(CATEGORY_CONFIG).find(
      ([key]) => normalizeCategoryKey(key).toLowerCase() === normalized.toLowerCase()
    )?.[1];
  if (configured) {
    return configured;
  }

  return {
    icon: DEFAULT_CATEGORY_CONFIG.icon,
    path: `/report/${toSlug(normalized)}`,
  };
};

export const buildTopics = (roleReports: RoleReportApiItem[]): Topic[] => {
  const grouped = new Map<string, RoleReportApiItem[]>();

  for (const report of roleReports) {
    const categoryName = getReportCategoryName(report);
    const reportName = getReportName(report);
    if (!categoryName || !reportName) {
      continue;
    }

    if (!grouped.has(categoryName)) {
      grouped.set(categoryName, []);
    }

    grouped.get(categoryName)?.push({
      RepIdNo: report.RepIdNo,
      CategoryName: categoryName,
      ReportName: reportName,
    });
  }

  const topics: Topic[] = [];
  let topicIndex = 1;

  for (const [categoryName, reports] of grouped.entries()) {
    const { icon, path } = getCategoryConfig(categoryName);
    const usedSubtopicIds = new Set<number>();

    const subtopics: Subtopic[] = reports.map((report, index) => {
      const repIdNo = getReportRepId(report);
      const fallbackId = topicIndex * 1000 + index + 1;
      let id = toIdNumber(repIdNo, fallbackId);

      while (usedSubtopicIds.has(id)) {
        id += 1;
      }

      usedSubtopicIds.add(id);

      return {
        id,
        repIdNo,
        name: getReportName(report),
      };
    });

    topics.push({
      id: topicIndex,
      name: categoryName,
      icon,
      path,
      subtopics,
    });

    topicIndex += 1;
  }

  topics.sort((a, b) => {
    const aIsDashboard = a.path.toLowerCase() === "/dashboard";
    const bIsDashboard = b.path.toLowerCase() === "/dashboard";

    if (aIsDashboard && !bIsDashboard) {
      return -1;
    }

    if (!aIsDashboard && bIsDashboard) {
      return 1;
    }

    return 0;
  });

  return topics;
};

const fetchJson = async <T>(url: string): Promise<ApiEnvelope<T>> => {
  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  });

  let payload: ApiEnvelope<T> | null = null;

  try {
    payload = (await response.json()) as ApiEnvelope<T>;
  } catch {
    // Intentionally ignored, handled below with a friendly message.
  }

  if (!response.ok) {
    const errorMessage = payload?.errorMessage?.trim();
    const httpMessage = errorMessage || `Request failed (${response.status})`;
    throw new Error(httpMessage);
  }

  if (!payload) {
    throw new Error("Received an invalid response from the server.");
  }

  return payload;
};

const fetchJsonFromCandidates = async <T>(urls: string[]): Promise<ApiEnvelope<T>> => {
  let lastError: Error | null = null;

  for (const url of urls) {
    try {
      return await fetchJson<T>(url);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Request failed.");
    }
  }

  throw lastError ?? new Error("Request failed.");
};

export const loadRoleBasedSidebarData = async (epfNo: string): Promise<SidebarResult> => {
  const trimmedEpfNo = epfNo.trim();

  if (!trimmedEpfNo) {
    return {
      data: [],
      message: "Unable to load reports because user information is missing.",
      billMap: null,
      levelNo: null,
    };
  }

  try {
    const roleResponse = await fetchJsonFromCandidates<unknown>(
      USER_ROLE_ENDPOINTS.map(
        (endpoint) => `${endpoint}/${encodeURIComponent(trimmedEpfNo)}`
      )
    );

    if (roleResponse.errorMessage) {
      return {
        data: [],
        message: roleResponse.errorMessage,
        billMap: null,
        levelNo: null,
      };
    }

    const roleInfoList = extractRoleInfoList(roleResponse.data, trimmedEpfNo);
    const roleIds = roleInfoList.map((r) => r.roleId);
    const billMap = roleInfoList.find((r) => r.billMap)?.billMap ?? null;
    const levelNo = roleInfoList.find((r) => r.levelNo)?.levelNo ?? null;

    if (roleIds.length === 0) {
      return {
        data: [],
        message: "No role was assigned to this user.",
        billMap: null,
        levelNo: null,
      };
    }

    const allReports: RoleReportApiItem[] = [];

    for (const roleId of roleIds) {
      const reportsResponse = await fetchJsonFromCandidates<unknown>(
        ROLE_REPORTS_ENDPOINTS.map(
          (endpoint) => `${endpoint}?roleId=${encodeURIComponent(roleId)}`
        )
      );

      if (reportsResponse.errorMessage) {
        continue;
      }

      allReports.push(...toRoleReportItems(reportsResponse.data));
    }

    const reportsByKey = new Map<string, RoleReportApiItem>();
    for (const report of allReports) {
      const repIdNo = getReportRepId(report);
      const categoryName = getReportCategoryName(report);
      const reportName = getReportName(report);

      if (!categoryName || !reportName) {
        continue;
      }

      const dedupeKey = `${repIdNo}::${categoryName}::${reportName}`;
      if (!reportsByKey.has(dedupeKey)) {
        reportsByKey.set(dedupeKey, {
          RepIdNo: repIdNo,
          CategoryName: categoryName,
          ReportName: reportName,
        });
      }
    }

    const reports = Array.from(reportsByKey.values());

    // // Inject the FIFO report under Physical Verification (as an accordion item) and under FIFO category
    // const hasFifoReport = reports.some(
    //   (r) =>
    //     getReportRepId(r) === "fifo-obsolete-idle" ||
    //     getReportName(r).toLowerCase().includes("fifo")
    // );
    // if (!hasFifoReport) {
    //   reports.push({
    //     RepIdNo: "fifo-obsolete-idle",
    //     CategoryName: "Physical Verification",
    //     ReportName: "PHV Obsolete / Idle (FIFO)",
    //   });
    //   reports.push({
    //     RepIdNo: "fifo-obsolete-idle-cat",
    //     CategoryName: "Physical Verification - FIFO",
    //     ReportName: "PHV Obsolete / Idle (FIFO)",
    //   });
    // }

    const topics = buildTopics(reports);

    if (topics.length === 0) {
      return {
        data: [],
        message: "No reports are available for your role.",
        billMap,
        levelNo,
      };
    }

    return {
      data: topics,
      message: null,
      billMap,
      levelNo,
    };
  } catch {
    return {
      data: [],
      message: "Failed to load sidebar reports. Please try again in a moment.",
      billMap: null,
      levelNo: null,
    };
  }
};
