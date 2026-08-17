import type { ComponentType } from "react";

//Report Catalog
import ReportCatalog from "../pages/ReportCatalog";

// PIV reports
import ProvincePIV from "../mainTopics/PIV/ProvincePIV";
import ProvincePIVProvincial from "../mainTopics/PIV/ProvincePIVProvincial";
import ProvincePIVAll from "../mainTopics/PIV/ProvincePIVAll";
import ProvincePivOtherCC from "../mainTopics/PIV/ProvincePivOtherCC";
import OtherCCtoProvince from "../mainTopics/PIV/OtherCCtoProvince";
import BranchWisePivBoth from "../mainTopics/PIV/BranchWisePivBoth";
import PivByBanks from "../mainTopics/PIV/PivByBanks";
import PIVCollectionsByPeoplesBank from "../mainTopics/PIV/PIVCollectionsByPeoplesBank";
import PivBySLT from "../mainTopics/PIV/PIVCollectionsBySLT";
import PIVDetailsReport from "../mainTopics/PIV/PIVDetailsReport";
import ProvinceWisePIVStampDuty from "../mainTopics/PIV/ProvinceWisePIVStampDuty";
import RegionalPIVStampDutyReport from "../mainTopics/PIV/RegionalPIVStampDutyReport";
import PivChequeDepositReport from "../mainTopics/PIV/PivChequeDepositReport";
import PivSearchReport from "../mainTopics/PIV/PivSearchReport";
import TypewisePIV from "../mainTopics/PIV/TypewisePIV";
import ConsolidatedOutputVAT from "../mainTopics/PIV/ConsolidatedOutputVAT";
import StampDutyDetailedReport from "../mainTopics/PIV/StampDutyDetailedReport";
import ProvincialConsolidatedOutputVAT from "../mainTopics/PIV/ProvincialConsolidatedOutputVAT";
import RegionWiseVatReport from "../mainTopics/PIV/RegionWiseVatReport";
import ProvinceSetOffReport from "../mainTopics/PIV/ProvinceSetOffReport";
import ProvinceManualSetOffReport from "../mainTopics/PIV/ProvinceManualSetOffReport";
import PosPaidPivTabulationSummaryAfmhq from "../mainTopics/PIV/PosPaidPivTabulationSummaryAfmhq";
import AccountCodesWisePivReport from "../mainTopics/PIV/AccountCodesWisePivReport";
import AccCodeWisePivNotAfmhqReport from "../mainTopics/PIV/AccCodeWisePivNotAfmhqReport";
import RefundedPivReport from "../mainTopics/PIV/RefundedPivReport";
import RegionPivFromOtherCC from "../mainTopics/PIV/RegionPivFromOtherCC";
import BankPivTabulation from "../mainTopics/PIV/BankPivTabulation";
import BankPaidPIVDetails from "../mainTopics/PIV/BankPaidPIVDetails";
import CostCenterwisePivDetails from "../mainTopics/PIV/CostCenterwisePivDetails";

// Analysis reports
import DebtorsAnalysis from "../mainTopics/Analysis/DebtorsAnalysis";
import AgeAnalysis from "../mainTopics/Analysis/AgeAnalysis";
import SolarAgeAnalysis from "../mainTopics/Analysis/SolarAgeAnalysis";

// Customer Details
import CustomerDetails from "../mainTopics/billing&payment/CustomerDetails";
import PaymentInquiry from "../mainTopics/CustomerDetails/PaymentInquiry";
import TransactionHistoryOrdinary from "../mainTopics/CustomerDetails/TransactionHistoryOrdinary";

// Collections reports
import DishonouredCheques from "../mainTopics/Collections/DishonouredCheques";
import HeadOfficeCollectionTotal from "../mainTopics/Collections/CollectionTot";
import ReceivablePosition from "../mainTopics/Collections/ReceivablePosition";
import HeadOfficePOSCollection from "../mainTopics/Collections/HeadOfficePOSCollection";
import SalesAndCollection from "../mainTopics/Collections/SalesAndCollection";
import CustomersHighestOutstanding from "../mainTopics/Collections/CustomersHighestOutstanding";
import SuspensePaymentDetails from "../mainTopics/Collections/SuspensePaymentDetails";

// CashBook reports
import CashBookDetailsReport from "../mainTopics/CashBook/CashBookDetailsReport";
import DocumentInquiry from "../mainTopics/CashBook/DocumentInquiry";
import CashSheetReport from "../mainTopics/CashBook/CashSheetReport";
import CashSheetDateRangePayeeReport from "../mainTopics/CashBook/CashSheetDateRangePayeeReport.tsx";
import ChequeDetailsExp from "../mainTopics/CashBook/ChequeDetailsExp";
import ChequeDetailsExpRegionReport from "../mainTopics/CashBook/ChequeDetailsExpRegionReport";
import PriceVarianceReport from "../mainTopics/CashBook/PriceVarianceReport";
import ChequeDetailWPReport from "../mainTopics/CashBook/ChequeDetailsWP";
import PriceVarianceWHReport from "../mainTopics/CashBook/PriceVarianceWHReport";
import ChequeSummaryReport from "../mainTopics/CashBook/ChequeSummaryReport";
import RegionPeriodStatusReport from "../mainTopics/CashBook/Regionperiodstatusreport";
import ProvinceWisePeriodStatus from "../mainTopics/CashBook/ProvincePeriodStatusReport";
import CurrentAcctBalCC from "../mainTopics/CashBook/CurrentAcctBalCC";
import AreaWiseCashBookInquiryReport from "../mainTopics/CashBook/AreaWiseCashBookInquiryReport.tsx";
import CashbookInquiryDrCrReport from "../mainTopics/CashBook/CashBookInquiryDrCrReport.tsx";

// General reports
import ActiveCustomersSalesByTariff from "../mainTopics/general/ActiveCustomersSalesByTariff";
import BillCalculation from "../mainTopics/general/BillCalculation";
import RegisteredConsumersForSMSAlerts from "../mainTopics/general/RegisteredConsumersForSMSAlerts";
import Securitydepositcontractdemandbulk from "../mainTopics/general/Securitydepositcontractdemandbulk";
import ListOfGovernmentAccounts from "../mainTopics/general/ListOfGovernmentAccounts";
import Arreasposition from "../mainTopics/general/Arreasposition";
import ListingofCustomers from "../mainTopics/general/ListingofCustomers";
import LargestCus from "../mainTopics/general/LargestCus";
import Largest100CustomerDetails from "../mainTopics/general/Largest100CustomerDetails";
import TariffBlockWiseConsumption from "../mainTopics/general/TariffBlockWiseConsumption";
import FinalizedAccounts from "../mainTopics/general/FinalizedAccounts";

// Income & Expenditure reports
import CostCenterIncomeExpenditure from "../mainTopics/IncomeExpenditure/CostCenterIncomeExpenditure";
import ProvinceExpenditure from "../mainTopics/IncomeExpenditure/ProvinceExpenditure";
import RegionExpenditure from "../mainTopics/IncomeExpenditure/RegionExpenditure";
import IncomeExpenditureRegionDetailed from "../mainTopics/IncomeExpenditure/IncomeExpenditureRegionDetailed";

// Inventory reports
import MaterialMaster from "../mainTopics/inventory/MaterialMaster";
import CostCenterQuantityHnad from "../mainTopics/inventory/CostCenterQuantityHnad";
import AverageConsumptions from "../mainTopics/inventory/AverageConsumptions";
import AverageConsumptionSelected from "../mainTopics/inventory/AverageConsumptionSelected";
import QtyOnHandAllRegion from "../mainTopics/inventory/QtyOnHandAllRegions";
import ProvincialQtyHand from "../mainTopics/inventory/provincialQtyHand";
import ProvinceWiseQuantityOnHand from "../mainTopics/inventory/ProvinceWiseQuantityOnHand";
import MaterialMasterAI from "../mainTopics/inventory/MateriallMasterAI";
import CCWiseIssue from "../mainTopics/inventory/Ccwiseissue";
import IssueReceiptWPReport from "../mainTopics/inventory/IssueReceiptWPreport";
import IssuesRaisedForJobsReport from "../mainTopics/inventory/Issuesraisedforjobsreport";
import GrnRaisedForPurchasingReport from "../mainTopics/inventory/Grnraisedforpurchasingreport";
import CcGrnNotGenReport from "../mainTopics/inventory/Ccgrnnotgenreport";
import BranchGrnNotGenReport from "../mainTopics/inventory/BranchGrnNotGenReport";
import MaterialFlowReport from "../mainTopics/inventory/MaterialFlowReport.tsx";
import IssueSummaryProvinceReport from "../mainTopics/inventory/IssueSummaryProvinceReport";

// JobCard reports
import JobCardInfo from "../mainTopics/JobCards/JobCardInfo";
import JobCardMaterials from "../mainTopics/JobCards/JobCardMaterials";
import JobSearchOrdinary from "../mainTopics/JobCards/JobSearchOrdinary";

// Ledger Card reports
import LedgerCardReport from "../mainTopics/LedgerCard/LedgerCardReport";
import LCWithoutSubAcc from "../mainTopics/LedgerCard/LCWithoutSubAcc";
import LedgerCardSubAccountTotal from "../mainTopics/LedgerCard/LedgerCardSubAccountTotal";
import DivisionalLedgerCard from "../mainTopics/LedgerCard/DivisionalLedgerCard";
import CostCenterTransferVouchers from "../mainTopics/LedgerCard/CostCenterTransferVouchers";
import Report71_8 from "../mainTopics/LedgerCard/Report71_8";

// Physical Verification reports
import PHVEntryForm from "../mainTopics/PhysicalVerification/PHVEntryForm";
import PHVValidation from "../mainTopics/PhysicalVerification/PHVValidation";
import PHVValidationWarehousewise from "../mainTopics/PhysicalVerification/PHVValidationWarehousewise";
import AnnualVerificationSheetSignature from "../mainTopics/PhysicalVerification/AnnualVerificationSheetSignature";
import AnnualVerificationWHwiseSignature from "../mainTopics/PhysicalVerification/AnnualVerificationWHwiseSignature";
import PHVSlowNonMovingWHwise from "../mainTopics/PhysicalVerification/PHVSlowNonMovingWHwise";
import PHVShortageSurplusWHwise from "../mainTopics/PhysicalVerification/PHVShortageSurplusWHwise";
import PHVObsoleteIdle from "../mainTopics/PhysicalVerification/PHVObsoleteIdle";
import PHVDamage from "../mainTopics/PhysicalVerification/PHVDamage";
import PHVNonMovingWHwiseBOS from "../mainTopics/PhysicalVerification/PHVNonMovingWHwiseBOS";
import PHVObsoleteIdleBOS from "../mainTopics/PhysicalVerification/PHVObsoleteIdleBOS";
import PHVDamageBOS from "../mainTopics/PhysicalVerification/PHVDamageBOS";
import LastDocNo from "../mainTopics/PhysicalVerification/LastDocNo";

// Phisical Verification FIFO reports
import PHVObsoleteIdleFIFO from "../mainTopics/PHVFIFO/PHVObsoleteIdleFIFO.tsx";
import PHVDamageFIFO from "../mainTopics/PHVFIFO/PHVDamageFIFO.tsx";
import PHVSlowMovingWHReport from "../mainTopics/PHVFIFO/PHVSlowMovingWHReport.tsx";
import PHVNonMovingWHReport from "../mainTopics/PHVFIFO/PHVNonMovingWHReport.tsx";
import PHVDamageBOSReport from "../mainTopics/PHVFIFO/PHVDamageBOSReport.tsx";
import PHVObsoleteBOSReport from "../mainTopics/PHVFIFO/PHVObsoleteBOSReport.tsx";
import PHVNonMovingBOSReport from "../mainTopics/PHVFIFO/PHVNonMovingBOSReport.tsx";

// PUCSL/LISS reports
import PUCSLSolarConnection from "../mainTopics/PUCSL/PUCSLSolarConnection";
import PUCSLSolarCustomers from "../mainTopics/PUCSL/PUCSLSolarCustomers";
import SolarDataForUNT from "../mainTopics/PUCSL/SolarDataForUNT";

// Solar Information reports
import SolarPVBilling from "../mainTopics/SolarInformation/SolarPVBilling";
import SolarPVCapacityInformation from "../mainTopics/SolarInformation/SolarPVCapacityInformation";
import SolarProgressClarificationOrdinary from "../mainTopics/SolarInformation/SolarProgressClarificationOrdinary";
import SolarProgressClarificationBulk from "../mainTopics/SolarInformation/SolarProgressClarificationBulk";
import SolarPaymentRetail from "../mainTopics/SolarInformation/SolarPaymentRetail";
import SolarPaymentBulk from "../mainTopics/SolarInformation/SolarPaymentBulk";
import SolarConnectionDetailsRetail from "../mainTopics/SolarInformation/SolarConnectionDetailsRetail";
import SolarConnectionDetailsBulk from "../mainTopics/SolarInformation/SolarConnectionDetailsBulk";
import SolarCustomerInformation from "../mainTopics/SolarInformation/SolarCustomerInformation";
import RoofTopSolarInputData from "../mainTopics/SolarInformation/RoofTopSolarInputData";

// Solar Jobs reports
import SolarBillingReport from "../mainTopics/SolarJobs/SolarBillingReport";
import SolarPendingJobsReport from "../mainTopics/SolarJobs/SolarPendingJobsReport";
import CcApplicationProgress from "../mainTopics/SolarJobs/CcApplicationProgress";
import CCSolarPendingReport from "../mainTopics/SolarJobs/CCSolarPendingReport.tsx";

// Solar Religious Purpose reports
import AreaWiseSRPApplicationPIV from "../mainTopics/SRP/AreaWiseSRPApplicationPIV";
import AreaWiseSRPApplicationPIVPaidReport from "../mainTopics/SRP/AreaWiseSRPApplicationPIVPaidReport";
import DivisionWiseSRPApplicationPIVPaidReport from "../mainTopics/SRP/DivisionWiseSRPApplicationPIVPaidReport";
import AreaWiseSRPEstimationPIVPaidReport from "../mainTopics/SRP/AreaWiseSRPEstimationPIVPaidReport";
import DivisionWiseSRPEstimationPIVPaidReport from "../mainTopics/SRP/DivisionWiseSRPEstimationPIVPaidReport";
import AreaWiseSRPApplicationPIVStatus from "../mainTopics/SRP/AreaWiseSRPApplicationPIVStatus";
import AreaWiseSRPEstimationPIV from "../mainTopics/SRP/AreaWiseSRPEstimationPIV";

// Trial Balance reports
import CostCenterTrial from "../mainTopics/TrialBalance/CostCenterTrial";
import ProvintionalWiseTrial from "../mainTopics/TrialBalance/ProvintionalWiseTrial";
import ReagionTrial from "../mainTopics/TrialBalance/ReagionTrial";
import AreaTrialBalance from "../mainTopics/TrialBalance/AreaTrialBalance";

// Work In Progress reports
import AgeAnalysisCostCenter from "../mainTopics/WorkInProgress/AgeAnalysisCostCenter";
import CompletedCostCenterWise from "../mainTopics/WorkInProgress/CompletedCostCenterWise";

// Dashboard pages
import DefaultDashboardPage from "../mainTopics/Dashboard/DefaultDashboardPage";
import FinancialDashboardPage from "../mainTopics/Dashboard/FinancialDashboardPage";
import DgmDashboardPage from "../mainTopics/Dashboard/DgmDashboardPage";
import OperationsDashboardPage from "../mainTopics/Dashboard/OperationsDashboardPage";
import AnalyticsDashboardPage from "../mainTopics/Dashboard/AnalyticsDashboardPage";
import SolarDashboardPage from "../mainTopics/Dashboard/SolarDashboardPage";
import CollectionsDashboardPage from "../mainTopics/Dashboard/CollectionsDashboardPage";
import ExecutiveDashboardPage from "../mainTopics/Dashboard/ExecutiveDashboardPage";
import InventoryDashboardPage from "../mainTopics/Dashboard/InventoryDashboardPage";
import AreaEngineerDashboardPage from "../mainTopics/Dashboard/AreaEngineerDashboardPage";

//SMC - Management Information
import SmcJobProgressReport from "../mainTopics/SMC-ManagementInfo/SMCJobProgressReport";
import CCT1T2T3Report from "../mainTopics/SMC-ManagementInfo/CCT1T2T3Report";
import PivIIPaidNotEnagizedReport from "../mainTopics/SMC-ManagementInfo/PIVIIPaidNotEnagizedReport";
import JobRegisterCCReport from "../mainTopics/SMC-ManagementInfo/JobRegisterCCReport";
import JobRegCCNCReport from "../mainTopics/SMC-ManagementInfo/JobRegCCNCReport";
import SMCAllApplicationReport from "../mainTopics/SMC-ManagementInfo/SMCAllApplicationReport.tsx";

//FIFO reports
import IssueReceiptSummaryReport from "../mainTopics/fifo/IssueReceiptSummaryReport";
import QuantityMatFIFOReport from "../mainTopics/fifo/QuantityMatFIFOReport";

// Construction 
import BulkConnectionDetailsReport from "../mainTopics/Construction/BulkConnectionDetailsReport";
import ConstructionAllReport from "../mainTopics/Construction/ConstructionAllReport";
import ConstructionCompletedReport from "../mainTopics/Construction/ConstructionCompletedReport";

//Common Reports
import InventoryDocInquiryReport from "../mainTopics/Common/InventoryDocInquiryReport.tsx";
import BranchPendingDocInquiryReport from "../mainTopics/Common/BranchPendingDocInquiryReport.tsx";
import MaterialRequisitionWithIssueDetailsReport from "../mainTopics/Common/MaterialRequisitionWithIssueDetailsReport .tsx";
import CCDocInquiryPendingReport from "../mainTopics/Common/CCDocInquiryPendingReport.tsx";

//General Ledger Reports
import CostCenterWiseGLDocumentReport from "../mainTopics/GeneralLedger/CostcenterwiseGlDocumentReport.tsx";

export type ReportComponentRegistry = Record<string, ComponentType>;

/**
 * Central registry mapping normalized report names to React components.
 * Add an entry for each report that should render a specific component.
 * The key should match the normalized (lowercase, punctuation-stripped) report name.
 */
export const reportComponentRegistry: ReportComponentRegistry = {
	// PIV reports
	"1 branch province wise piv collections paid to bank": ProvincePIV,
	"branch province wise piv collections paid to bank": ProvincePIV,
	"2 branch province wise piv collections by provincial pos relevant to the province": ProvincePIVProvincial,
	"branch province wise piv collections by provincial pos relevant to the province": ProvincePIVProvincial,
	"3 branch province wise piv collections paid to provincial pos": ProvincePIVAll,
	"branch province wise piv collections paid to provincial pos": ProvincePIVAll,
	"4 piv collections by provincial pos relevant to other cost centers": ProvincePivOtherCC,
	"piv collections by provincial pos relevant to other cost centers": ProvincePivOtherCC,
	"5 piv collections by other cost centers relevant to the province": OtherCCtoProvince,
	"piv collections by other cost centers relevant to the province": OtherCCtoProvince,
	"6 branch wise piv tabulation both bank and pos": BranchWisePivBoth,
	"branch wise piv tabulation both bank and pos": BranchWisePivBoth,
	"7 piv collections by banks": PivByBanks,
	"piv collections by banks": PivByBanks,
	"7 1 piv collections by peoples banks": PIVCollectionsByPeoplesBank,
	"piv collections by peoples banks": PIVCollectionsByPeoplesBank,
	"7 2 piv collections by ipg slt": PivBySLT,
	"piv collections by ipg slt": PivBySLT,
	"8 piv details report piv amount not tallied with paid amount": PIVDetailsReport,
	"piv details report piv amount not tallied with paid amount": PIVDetailsReport,
	"9 province wise piv stamp duty": ProvinceWisePIVStampDuty,
	"province wise piv stamp duty": ProvinceWisePIVStampDuty,
	"10 regional piv stamp duty": RegionalPIVStampDutyReport,
	"regional piv stamp duty": RegionalPIVStampDutyReport,
	"11 piv details for cheque deposits": PivChequeDepositReport,
	"piv details for cheque deposits": PivChequeDepositReport,
	"12 piv search": PivSearchReport,
	"piv search": PivSearchReport,
	"13 piv type wise piv details": TypewisePIV,
	"piv type wise piv details": TypewisePIV,
	"14 consolidated output vat schedule": ConsolidatedOutputVAT,
	"consolidated output vat schedule": ConsolidatedOutputVAT,
	"15 piv stamp duty detail report": StampDutyDetailedReport,
	"piv stamp duty detail report": StampDutyDetailedReport,
	"16 province wise vat report": ProvincialConsolidatedOutputVAT,
	"province wise vat report": ProvincialConsolidatedOutputVAT,
	"17 region wise vat report": RegionWiseVatReport,
	"region wise vat report": RegionWiseVatReport,
	"18 province wise system set off piv details": ProvinceSetOffReport,
	"province wise system set off piv details": ProvinceSetOffReport,
	"18 1 province wise manual set off piv details": ProvinceManualSetOffReport,
	"province wise manual set off piv details": ProvinceManualSetOffReport,
	"19 pos paid piv tabulation summary report afmhq": PosPaidPivTabulationSummaryAfmhq,
	"pos paid piv tabulation summary report afmhq": PosPaidPivTabulationSummaryAfmhq,
	"20 piv details issued and paid cost centers afmhq only": AccountCodesWisePivReport,
	"piv details issued and paid cost centers afmhq only": AccountCodesWisePivReport,
	"21 piv details paid cost center 913 00 and issued other company": AccCodeWisePivNotAfmhqReport,
	"piv details paid cost center 913 00 and issued other company": AccCodeWisePivNotAfmhqReport,
	"22 refunded piv details": RefundedPivReport,
	"refunded piv details": RefundedPivReport,
	"23 region wise piv collections by provincial pos relevant to other cost centers": RegionPivFromOtherCC,
	"region wise piv collections by provincial pos relevant to other cost centers": RegionPivFromOtherCC,
	"24 bank piv tabulation": BankPivTabulation,
	"bank piv tabulation": BankPivTabulation,
	"25 bank paid piv details": BankPaidPIVDetails,
	"bank paid piv details": BankPaidPIVDetails,
	"26 cost center wise piv details status report": CostCenterwisePivDetails,
	"cost center wise piv details status report": CostCenterwisePivDetails,

	// Analysis reports
	"total debtors analysis": DebtorsAnalysis,
	"debtors age analysis individual customers": AgeAnalysis,
	"age analysis of solar power consumers": SolarAgeAnalysis,

	// Customer Details
	"customer information": CustomerDetails,
	"transaction history ordinary": TransactionHistoryOrdinary,
	"payment inquiries": PaymentInquiry,

	// Collections reports
	"sales and collection": SalesAndCollection,
	"head office collection total": HeadOfficeCollectionTotal,
	"head office pos collection": HeadOfficePOSCollection,
	"suspense payment details": SuspensePaymentDetails,
	"receivable position": ReceivablePosition,
	"dishonoured cheques": DishonouredCheques,
	"customers with highest outstanding balance": CustomersHighestOutstanding,

	// Consumption Analysis reports
	"tariff block wise consumption report": TariffBlockWiseConsumption,
	"tariff and block wise consumption analysis": TariffBlockWiseConsumption,
	"transformer wise consumption analysis": TariffBlockWiseConsumption,
	"business category wise consumption analysis": TariffBlockWiseConsumption,

	// CashBook reports
	"selected payee within date range": CashBookDetailsReport,
	"cost center wise document inquiry cash book with cheque details": DocumentInquiry,
	"cash sheet report": CashSheetReport,
	"cash sheet within date range for selected payee": CashSheetDateRangePayeeReport,
	"cheque details with exp code region": ChequeDetailsExpRegionReport,
	"cheque details with expcode": ChequeDetailsExp,
	"price variance": PriceVarianceReport,
	"cheque details within period": ChequeDetailWPReport,
	"price variance wh wise": PriceVarianceWHReport,
	"cheque summary": ChequeSummaryReport,
	"region wise period status": RegionPeriodStatusReport,
	"province wise period status" : ProvinceWisePeriodStatus,
    "cost center wise current account balance" : CurrentAcctBalCC,
	"area wise cash book inquiry": AreaWiseCashBookInquiryReport,
	"cash book inquiry debit credit": CashbookInquiryDrCrReport,

	// General reports
	"tariff block wise consumption": TariffBlockWiseConsumption,
	"active customers and sales by tariff": ActiveCustomersSalesByTariff,
	"bill calculation": BillCalculation,
	"listing of customers": ListingofCustomers,
	"list of government accounts": ListOfGovernmentAccounts,
	"largest 50 customers details ordinary": LargestCus,
	"largest 100 customer details": Largest100CustomerDetails,
	"arrears position meter reader wise": Arreasposition,
	"registered consumers for sms alerts": RegisteredConsumersForSMSAlerts,
	"finalized accounts": FinalizedAccounts,
	"security deposit contract demand bulk": Securitydepositcontractdemandbulk,

	// Income & Expenditure reports
	"cost center wise income expenditure": CostCenterIncomeExpenditure,
	"province wise income expenditure": ProvinceExpenditure,
	"region wise income expenditure": RegionExpenditure,
	"region wise income expenditure detailed": IncomeExpenditureRegionDetailed,

	// Inventory reports
	"material details": MaterialMaster,
	"cost center wise quantity on hand": CostCenterQuantityHnad,
	"average consumptions all material codes": AverageConsumptions,
	"average consumptions selected maerial codes": AverageConsumptionSelected,
	"material master(both active and inactive)": MaterialMasterAI,
	"c/c wise issue": CCWiseIssue,
	"issue receipt within period": IssueReceiptWPReport,
	"issues raised by edl for jobs": IssuesRaisedForJobsReport,
	"grn raised by edl for purchasing": GrnRaisedForPurchasingReport,
	"c/c grn value tv not generated by own cost center": CcGrnNotGenReport,
	"branch wise grn not generated issues": BranchGrnNotGenReport,
	"province wise quantity on hand": ProvinceWiseQuantityOnHand,
	"provincial quantity on hand cross tab": ProvincialQtyHand,
	"quantity on hand all region material active online": QtyOnHandAllRegion,
	"flow report": MaterialFlowReport,
	"issue summary province usage": IssueSummaryProvinceReport,

	// JobCard reports
	"job card details": JobCardInfo,
	"job card material details": JobCardMaterials,
	"job search ordinary": JobSearchOrdinary,

	// Ledger Card reports
	"ledger card with subaccounts": LedgerCardReport,
	"ledger card without subaccounts": LCWithoutSubAcc,
	"ledger card subaccounts total": LedgerCardSubAccountTotal,
	"sub accounts transactions for account code within selected company": DivisionalLedgerCard,
	"cost center transfer vouchers": CostCenterTransferVouchers,
	"71/8 report": Report71_8,


	// Physical Verification FIFO reports
	"1. physical verification obsolete idle - av/7a (fifo)": PHVObsoleteIdleFIFO,
	"2. physical verification damage - av/7b (fifo)": PHVDamageFIFO,
	"3. physical verification slow moving wh wise - av/6 (fifo)": PHVSlowMovingWHReport,
	"4. physical verification non moving wh wise - av/6b (fifo)": PHVNonMovingWHReport,
	"5. physical verification damage bos - av/7b/bos": PHVDamageBOSReport,
	"6. physical verification obsolete idle bos - av/7a/bos": PHVObsoleteBOSReport,
	"7. physical verification non-moving wh wise (fifo) - av/6/bos": PHVNonMovingBOSReport,

	// Physical Verification reports
	"1 phv entry form": PHVEntryForm,
	"2 1 phv validation": PHVValidation,
	"2 2 phv validation warehousewise": PHVValidationWarehousewise,
	"3 1 annual verification sheet signature av 1 a": AnnualVerificationSheetSignature,
	"3 2 annual verification sheet whwise signature av 1 a": AnnualVerificationWHwiseSignature,
	"4 physical verification non moving slow moving wh wise av 6": PHVSlowNonMovingWHwise,
	"5 physical verification shortage surplus wh wise av 1 b": PHVShortageSurplusWHwise,
	"6 1 physical verification obsolete idle grade code av 7a": PHVObsoleteIdle,
	"6 2 physical verification damage av 7b": PHVDamage,
	"7 physical verification non moving wh wise bos av 6 bos": PHVNonMovingWHwiseBOS,
	"8 physical verification obsolete idle bos av 7a bos": PHVObsoleteIdleBOS,
	"9 physical verification damage bos av 7b bos": PHVDamageBOS,
	"last document no selected year": LastDocNo,

	// PUCSL/LISS reports
	"pucsl reports solar connections new": PUCSLSolarConnection,
	"pucsl solar customers": PUCSLSolarCustomers,
	"solar data for unt calculation": SolarDataForUNT,

	// Solar Information reports
	"solar pv billing information": SolarPVBilling,
	"solar pv capacity information": SolarPVCapacityInformation,
	"solar progress clarification ordinary": SolarProgressClarificationOrdinary,
	"solar progress clarification bulk": SolarProgressClarificationBulk,
	"solar payment information retail": SolarPaymentRetail,
	"solar payment information bulk": SolarPaymentBulk,
	"solar connection details incl reading and usage retail": SolarConnectionDetailsRetail,
	"solar connection details incl reading and usage bulk": SolarConnectionDetailsBulk,
	"solar customer information": SolarCustomerInformation,
	"rooftop solar input data portal for t and d loss calculation": RoofTopSolarInputData,

	// Solar Jobs reports
	"area wise solar sent to billing details": SolarBillingReport,
	"solar retail rooftop pending jobs after piv2 paid": SolarPendingJobsReport,
	"c/c solar application progress": CcApplicationProgress,
	"cost center wise solar retail rooftop pending jobs after piv2 paid": CCSolarPendingReport,

	// Solar Religious Purpose reports
	"area wise srp application piv pivi to be paid report": AreaWiseSRPApplicationPIV,
	"area wise srp application piv pivi paid report": AreaWiseSRPApplicationPIVPaidReport,
	"division wise srp application piv pivi to be paid report": DivisionWiseSRPApplicationPIVPaidReport,
	"area wise srp estimation piv pivii paid report": AreaWiseSRPEstimationPIVPaidReport,
	"division wise srp estimation piv pivii paid report": DivisionWiseSRPEstimationPIVPaidReport,
	"area wise srp application all pivs pivi": AreaWiseSRPApplicationPIVStatus,
	"area wise srp estimation piv pivii to be paid report": AreaWiseSRPEstimationPIV,

	// Trial Balance reports
	"cost center trial balance": CostCenterTrial,
	"provincial trial balance": ProvintionalWiseTrial,
	"region trial balance": ReagionTrial,
	"area wise trial balance": AreaTrialBalance,

	// Catalog reports
	"all reports": ReportCatalog,
	"all-reports": ReportCatalog,
	"report catalog": ReportCatalog,
	"reportcatalog": ReportCatalog,
	"catalog": ReportCatalog,

	// Work In Progress reports
	"cost center wise work in progress with age analysis": AgeAnalysisCostCenter,
	"cost center wise work in progress completed projects": CompletedCostCenterWise,

	// Dashboard pages
	"main dashboard": DefaultDashboardPage,
	"default dashboard": DefaultDashboardPage,
	"financial dashboard": FinancialDashboardPage,
	"dgm dashboard": DgmDashboardPage,
	"operations dashboard": OperationsDashboardPage,
	"analytics dashboard": AnalyticsDashboardPage,
	"solar dashboard": SolarDashboardPage,
	"collections dashboard": CollectionsDashboardPage,
	"collections payments dashboard": CollectionsDashboardPage,
	"collections & payments dashboard": CollectionsDashboardPage,
	"executive dashboard": ExecutiveDashboardPage,
	"inventory dashboard": InventoryDashboardPage,
	"area general manager dashboard": AreaEngineerDashboardPage,

	//SMC - Management Information
	"smc job progress": SmcJobProgressReport,
	"cost center wise t1 t2 t3 report": CCT1T2T3Report,
	"piv ii paid not enagized": PivIIPaidNotEnagizedReport,
	"cost center wise job register": JobRegisterCCReport,
	"cost center wise new connection job register": JobRegCCNCReport,
	"area wise smc all details": SMCAllApplicationReport,

	//FIFO reports
	"issue and receipt summary": IssueReceiptSummaryReport,
	"quantity on hand material wise fifo": QuantityMatFIFOReport,

	// Construction Reports
	"bulk connection details": BulkConnectionDetailsReport,
	"construction all data": ConstructionAllReport,
	"construction completed": ConstructionCompletedReport,

	//Common Reports
	"inventory document inquiry": InventoryDocInquiryReport,
	"branch province pending document inquiry": BranchPendingDocInquiryReport,
	"material requisition with issue details": MaterialRequisitionWithIssueDetailsReport,
	"cost center document inquiry pending": CCDocInquiryPendingReport,

	//General Ledger Reports
	"cost center wise gl document inquiry": CostCenterWiseGLDocumentReport,
};

/**
 * Get a report component by its normalized name.
 * If no component is registered, returns null.
 */
export const getReportComponent = (normalizedReportName: string): ComponentType | null => {
	return reportComponentRegistry[normalizedReportName] || null;
};

const normalizeForLooseLookup = (value: string): string =>
	value.replace(/[^a-z0-9]+/g, "").toLowerCase();

export const getReportComponentLoose = (normalizedReportName: string): ComponentType | null => {
	const query = normalizeForLooseLookup(normalizedReportName);
	if (!query) {
		return null;
	}

	for (const [key, component] of Object.entries(reportComponentRegistry)) {
		const normalizedKey = normalizeForLooseLookup(key);
		if (normalizedKey.includes(query) || query.includes(normalizedKey)) {
			return component;
		}
	}

	return null;
};
