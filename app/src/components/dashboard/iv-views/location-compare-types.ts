/** Shared types for Location Compare views */

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

export interface LocationCompareResponse {
  locations: LocationCompareItem[];
  unassigned: { count: number; totalCents: string };
  monthLabels: string[];
  estateFilter: string;
}
