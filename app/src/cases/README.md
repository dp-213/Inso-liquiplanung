# Case-Specific Dashboards

This directory contains case-specific dashboard customizations. Each subdirectory corresponds to a specific insolvency case by its ID.

## Architecture

The dashboard system supports two customization layers:

1. **UI-based configuration** - Stored in database, managed via admin UI
2. **Code-based customization** - Files in this directory, requires deployment

Code customizations take precedence over UI configuration.

## Directory Structure

```
/src/cases/
  README.md                    # This file
  /_template/                  # Template files for new cases
    case.config.ts             # Configuration file template
    dashboard.view.tsx         # Custom dashboard component template
    README.md                  # Template documentation
  /[case-id]/                  # Case-specific directory (use actual case ID)
    case.config.ts             # Configuration overrides
    dashboard.view.tsx         # Custom dashboard component (optional)
    README.md                  # Documentation for this case
```

## Creating a Case-Specific Dashboard

### Step 1: Create the directory

Create a new directory using the case ID:

```bash
cp -r src/cases/_template src/cases/[your-case-id]
```

### Step 2: Configure case.config.ts

Edit `case.config.ts` to specify:

- Case ID (must match exactly)
- Display name for admin reference
- Configuration overrides
- Whether to replace UI config entirely

```typescript
import { CaseCodeConfig } from '@/lib/case-dashboard/types';
import { registerCaseConfig } from '@/lib/case-dashboard/loader';

const config: CaseCodeConfig = {
  caseId: 'your-case-id-here',
  displayName: 'Custom Dashboard for Case XYZ',
  version: '1.0.0',
  description: 'Special presentation requirements for external stakeholders',

  // Partial overrides (merged with UI config)
  configOverrides: {
    styling: {
      primaryColor: '#003366',
      firmName: 'Musterkanzlei GmbH',
    },
    emphasizedCategories: ['PERSONALKOSTEN'],
  },

  // Set to true to ignore UI config entirely
  replaceUIConfig: false,
};

registerCaseConfig(config);
export default config;
```

### Step 3: Custom Dashboard Component (Optional)

If you need a completely custom dashboard layout, create `dashboard.view.tsx`:

```typescript
import { DashboardProps } from '@/lib/case-dashboard/types';
import { DashboardCard, KPIDisplay, CategoryTable } from '@/components/dashboard';

export default function CustomDashboard(props: DashboardProps) {
  // Your custom dashboard implementation
  return (
    <div>
      {/* Custom layout using provided components */}
    </div>
  );
}
```

### Step 4: Register the Configuration

Import the config file in a central registry or ensure it's imported during app initialization.

## Configuration Options

### Available Overrides

```typescript
interface CaseDashboardConfig {
  // Which categories to show
  visibleCategories: {
    inflows: string[];   // e.g., ['ALTFORDERUNGEN', 'NEUFORDERUNGEN']
    outflows: string[];  // e.g., ['PERSONALKOSTEN', 'MIETE_LEASING']
  };

  // Custom labels for categories
  categoryLabels: Record<string, string>;

  // Display order of categories
  categoryOrder: {
    inflows: string[];
    outflows: string[];
  };

  // Highlighted categories
  emphasizedCategories: string[];

  // View-specific settings
  viewVariants: {
    internal: { enabled: boolean; config: {...} };
    external: { enabled: boolean; config: {...} };
  };

  // Display options
  aggregations: {
    groupBy: 'week' | 'month';
    showSubtotals: boolean;
    showRunningBalance: boolean;
    showEstateSubtotals: boolean;
  };

  // Custom branding
  styling: {
    primaryColor?: string;
    accentColor?: string;
    logoUrl?: string;
    firmName?: string;
    footerText?: string;
  };

  // Chart configuration
  charts: {
    visibleCharts: ChartType[];
    defaultChart: ChartType;
    showLegend: boolean;
    showDataLabels: boolean;
  };

  // Table display options
  table: {
    showWeekNumbers: boolean;
    showDateRanges: boolean;
    highlightNegative: boolean;
    compactMode: boolean;
    freezeFirstColumn: boolean;
  };

  // KPI card configuration
  kpis: {
    visibleKPIs: KPIType[];
    kpiOrder: KPIType[];
    showTrends: boolean;
  };
}
```

### Available Categories

**Inflows:**
- `ALTFORDERUNGEN` - Old receivables (pre-insolvency)
- `NEUFORDERUNGEN` - New receivables (post-insolvency)
- `KV_ZAHLUNGEN` - Purchase contract payments
- `HZV_ZAHLUNGEN` - Contractor payments
- `SONSTIGE_ERLOESE` - Other revenues
- `EINMALIGE_SONDERZUFLUESSE` - One-time special inflows

**Outflows:**
- `PERSONALKOSTEN` - Personnel costs
- `MIETE_LEASING` - Rent and leasing
- `LIEFERANTEN` - Suppliers
- `SOZIALABGABEN_STEUERN` - Social contributions and taxes
- `MASSEKOSTEN` - Estate costs
- `BANK_SICHERUNGSRECHTE` - Bank and security rights
- `SONSTIGE_LAUFENDE_KOSTEN` - Other operating costs
- `EINMALIGE_SONDERABFLUESSE` - One-time special outflows

## Important Notes

1. **Deployment Required**: Code changes require redeployment
2. **UI Config Persists**: UI configuration is saved in database even when code config exists
3. **Merge Behavior**: By default, code config merges with UI config (code wins on conflicts)
4. **Case ID Must Match**: The `caseId` in config must exactly match the database case ID
5. **No Calculation Logic**: Custom dashboards only affect presentation, never calculations

## Testing

After creating a case-specific configuration:

1. Build the application: `npm run build`
2. Navigate to Admin > Cases > [Your Case] > Dashboard
3. The config source indicator should show "Code" or "Merged"
4. Verify custom styling and configuration is applied

## Troubleshooting

### Config not loading
- Verify case ID matches exactly (case-sensitive)
- Check that `case.config.ts` exports default config
- Ensure config is registered via `registerCaseConfig()`

### Styling not applying
- Clear browser cache
- Verify color values are valid hex codes
- Check for typos in property names

### Categories not showing
- Verify category IDs are spelled correctly
- Check `visibleCategories` includes the desired categories
- Review console for validation warnings
