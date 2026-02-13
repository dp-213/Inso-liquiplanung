/** Shared types for Location Compare views */

export type Perspective = "POST" | "PRE";

export interface LocationCompareItem {
  id: string;
  name: string;
  shortName: string | null;
  totals: {
    revenueCents: string;
    costsCents: string;
    netCents: string;
    coverageBps: number;
    entryCount: number;
  };
  revenue: { kv: string; hzv: string; pvs: string; other: string };
  costs: { personal: string; betriebskosten: string; other: string };
  months: Record<string, MonthData>;
  employees: { total: number; doctors: number };
}

export interface MonthData {
  revenueCents: string;
  costsCents: string;
  netCents: string;
  coverageBps: number;
  revenue: { kv: string; hzv: string; pvs: string; other: string };
  costs: { personal: string; betriebskosten: string; other: string };
}

export interface LocationCompareMeta {
  hasIskAccounts: boolean;
  hasGeschaeftskonten: boolean;
}

export interface LocationCompareResponse {
  locations: LocationCompareItem[];
  unassigned: { count: number; totalCents: string };
  monthLabels: string[];
  estateFilter: string;
  perspective: Perspective;
  meta: LocationCompareMeta;
}

/** Delta-View: Vergleich Pre vs Post pro Standort */
export interface LocationDeltaRow {
  locationName: string;
  locationShortName: string | null;
  pre: { revenueCentsAvg: number; costsCentsAvg: number; netCentsAvg: number; coverageBps: number; monthCount: number };
  post: { revenueCentsAvg: number; costsCentsAvg: number; netCentsAvg: number; coverageBps: number; monthCount: number };
  delta: { revenueCents: number; costsCents: number; netCents: number; coveragePP: number };
  deltaPercent: { revenue: number | null; costs: number | null; net: number | null };
}
