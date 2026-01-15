# Case Dashboard Template

This is a template for creating case-specific dashboard customizations.

## Quick Start

1. Copy this entire `_template` directory to a new directory named with your case ID:
   ```bash
   cp -r src/cases/_template src/cases/[your-case-id]
   ```

2. Edit `case.config.ts`:
   - Update `caseId` to match your case's database ID
   - Update `displayName` with a descriptive name
   - Uncomment and modify the configuration overrides you need

3. (Optional) Edit `dashboard.view.tsx` if you need a completely custom layout

4. Import the config in your app (or ensure auto-discovery is set up)

5. Build and deploy: `npm run build`

## Files

### case.config.ts (Required)

Configuration file that defines:
- Case identification
- Configuration overrides
- Whether to replace or merge with UI config

This file must register the configuration using `registerCaseConfig()`.

### dashboard.view.tsx (Optional)

Custom React component for the dashboard. Only needed if:
- You want a completely different layout
- You need to add custom sections
- You have complex conditional rendering requirements

If not provided, the standard `ConfigurableDashboard` component is used.

### README.md (Recommended)

Documentation for this specific case. Include:
- Why custom configuration was needed
- What customizations were made
- Contact person for questions
- Any special considerations

## Configuration vs Custom Component

**Use configuration only when:**
- You need to change colors, logos, labels
- You want to show/hide certain categories
- You want to reorder elements
- You need different settings for internal/external views

**Create a custom component when:**
- You need a completely different layout structure
- You want to add custom sections or widgets
- You have complex business logic for display
- You need to integrate case-specific data sources

## Testing Your Customization

1. After deployment, navigate to:
   Admin > Cases > [Your Case] > Dashboard

2. Check that:
   - Config source shows "Code" or "Merged"
   - Custom styling is applied
   - Categories appear in correct order
   - Both internal and external views work

3. Test the configuration page:
   Admin > Cases > [Your Case] > Konfiguration
   - Verify your code config is detected
   - Check that warnings appear if conflicts exist
