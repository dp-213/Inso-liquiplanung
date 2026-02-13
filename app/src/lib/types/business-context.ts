/**
 * Business-Context API Response Types
 *
 * Definiert die Datenstruktur für den Business-Context-Endpoint,
 * der alle fallspezifischen Geschäftsdaten aggregiert zurückgibt.
 */

// =============================================================================
// MAIN RESPONSE
// =============================================================================

export interface BusinessContextResponse {
  caseMetadata: CaseMetadataContext;
  locations: LocationContext[];
  bankAccounts: BankAccountContext[];
  bankAgreements: BankAgreementContext[];
  employees: EmployeeContext[];
  settlementRules: SettlementRuleContext[];
  paymentFlows: PaymentFlowContext[];
  contacts: ContactContext[];
  openIssues: OpenIssueContext[];
  massekreditSummary: MassekreditSummaryContext | null;
}

// =============================================================================
// SUB-TYPES
// =============================================================================

export interface CaseMetadataContext {
  id: string;
  caseNumber: string;
  debtorName: string;
  courtName: string;
  openingDate: string | null;
  cutoffDate: string | null;
  status: string;
}

export interface LocationContext {
  id: string;
  name: string;
  shortName: string | null;
  address: string | null;
  displayOrder: number;
  bankAccountIds: string[];
}

export interface BankAccountContext {
  id: string;
  bankName: string;
  accountName: string;
  iban: string | null;
  accountType: string;
  isLiquidityRelevant: boolean;
  status: string;
  locationId: string | null;
  locationName: string | null;
  displayOrder: number;
}

export interface BankAgreementContext {
  id: string;
  bankAccountId: string;
  bankName: string;
  agreementStatus: string;
  agreementDate: string | null;
  agreementNote: string | null;
  hasGlobalAssignment: boolean;
  contributionRate: number | null;
  contributionVatRate: number | null;
  creditCapCents: string | null;
  isUncertain: boolean;
  uncertaintyNote: string | null;
}

export interface EmployeeContext {
  id: string;
  firstName: string;
  lastName: string;
  role: string | null;
  lanr: string | null;
  locationId: string | null;
  locationName: string | null;
  isActive: boolean;
}

export interface SettlementRuleContext {
  key: string;
  name: string;
  rhythm: string;
  lagDays: number;
  requiresServiceDate?: boolean;
  fallbackRule?: string;
  splitRules: SplitRuleContext[];
  legalReference?: string;
}

export interface SplitRuleContext {
  periodKey: string;
  altRatio: number;
  neuRatio: number;
  source: string;
  note: string;
}

export interface PaymentFlowContext {
  locationId: string;
  locationName: string;
  iskAccountId: string | null;
  iskAccountName: string | null;
  iskBankName: string | null;
  iskIban: string | null;
  topPayers: string[];
}

export interface ContactContext {
  id: string;
  role: string;
  name: string;
  organization: string | null;
  email: string | null;
  phone: string | null;
  displayOrder: number;
}

export interface OpenIssueContext {
  id: string;
  content: string;
  status: string;
  priority: string;
  author: string;
  createdAt: string;
}

export interface MassekreditSummaryContext {
  totalCapCents: string;
  banks: MassekreditBankContext[];
}

export interface MassekreditBankContext {
  bankName: string;
  agreementStatus: string;
  creditCapCents: string | null;
  contributionRate: number | null;
  contributionVatRate: number | null;
}
