"use client";

interface Week {
  weekOffset: number;
  weekLabel: string;
  openingBalanceCents: string;
  totalInflowsCents: string;
  totalOutflowsCents: string;
  netCashflowCents: string;
  closingBalanceCents: string;
}

interface Category {
  categoryName: string;
  flowType: string;
  estateType: string;
  totalCents: string;
  weeklyTotals: string[];
  lines: {
    lineName: string;
    totalCents: string;
    weeklyValues: {
      weekOffset: number;
      effectiveCents: string;
    }[];
  }[];
}

interface LiquidityTableProps {
  weeks: Week[];
  categories: Category[];
  openingBalance: bigint;
  showLineItems?: boolean;
  compact?: boolean;
  periodSources?: ("IST" | "PLAN" | "MIXED")[];
}

export default function LiquidityTable({
  weeks,
  categories,
  openingBalance,
  showLineItems = false,
  compact = false,
  periodSources,
}: LiquidityTableProps) {
  // Kompakte Währungsformatierung für enge Spalten
  const formatCurrency = (cents: bigint | string): string => {
    const value = typeof cents === "string" ? BigInt(cents) : cents;
    const euros = Number(value) / 100;
    if (compact) {
      // Kompakt: 1.234.567 → 1,2M / 123.456 → 123K
      const abs = Math.abs(euros);
      if (abs >= 1000000) return `${(euros / 1000000).toFixed(1)}M`;
      if (abs >= 10000) return `${Math.round(euros / 1000)}K`;
      return Math.round(euros).toLocaleString("de-DE");
    }
    return euros.toLocaleString("de-DE", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  const getCellClass = (cents: bigint | string): string => {
    const value = typeof cents === "string" ? BigInt(cents) : cents;
    if (value < BigInt(0)) return "value-negative";
    if (value > BigInt(0)) return "value-positive";
    return "";
  };

  // Group categories by type and filter out empty ones
  const hasData = (cat: Category): boolean => {
    const total = BigInt(cat.totalCents || "0");
    return total !== BigInt(0);
  };

  const inflowCategories = categories.filter((c) => c.flowType === "INFLOW" && hasData(c));
  const outflowCategories = categories.filter((c) => c.flowType === "OUTFLOW" && hasData(c));

  // Calculate totals
  const totalInflows = weeks.map((w) => BigInt(w.totalInflowsCents));
  const totalOutflows = weeks.map((w) => BigInt(w.totalOutflowsCents));
  const netCashflows = weeks.map((w) => BigInt(w.netCashflowCents));
  const closingBalances = weeks.map((w) => BigInt(w.closingBalanceCents));

  const sumInflows = totalInflows.reduce((a, b) => a + b, BigInt(0));
  const sumOutflows = totalOutflows.reduce((a, b) => a + b, BigInt(0));
  const sumNet = netCashflows.reduce((a, b) => a + b, BigInt(0));

  // Spaltenbreite basierend auf compact-Modus
  const colWidth = compact ? "min-w-[60px]" : "min-w-[90px]";
  const posWidth = compact ? "min-w-[140px]" : "min-w-[200px]";
  const sumWidth = compact ? "min-w-[70px]" : "min-w-[100px]";
  const fontSize = compact ? "text-xs" : "text-sm";

  return (
    <div className={compact ? "" : "table-scroll-container custom-scrollbar"}>
    <table className={`liquidity-table ${fontSize}`}>
      <thead>
        <tr>
          <th className={posWidth}>Position</th>
          {weeks.map((week, idx) => (
            <th key={week.weekOffset} className={`${colWidth} ${compact ? "px-1" : ""}`}>
              <div className="flex flex-col items-center gap-0.5">
                <span className={compact ? "text-[10px]" : ""}>{week.weekLabel}</span>
                {periodSources && periodSources[idx] && (
                  <span className={`inline-block w-2 h-2 rounded-full ${
                    periodSources[idx] === "IST" ? "bg-green-500" :
                    periodSources[idx] === "PLAN" ? "bg-purple-500" : "bg-amber-500"
                  }`} title={periodSources[idx]} />
                )}
              </div>
            </th>
          ))}
          <th className={sumWidth}>Summe</th>
        </tr>
      </thead>
      <tbody>
        {/* Opening Balance */}
        <tr className="row-total">
          <td>Anfangsbestand</td>
          {weeks.map((week, idx) => (
            <td key={week.weekOffset}>
              {idx === 0 ? formatCurrency(openingBalance) : formatCurrency(weeks[idx - 1].closingBalanceCents)}
            </td>
          ))}
          <td>-</td>
        </tr>

        {/* Inflows Section */}
        <tr className="row-category">
          <td colSpan={weeks.length + 2}>Einzahlungen</td>
        </tr>
        {inflowCategories.map((category) => (
          <CategoryRows key={category.categoryName} category={category} formatCurrency={formatCurrency} getCellClass={getCellClass} showLineItems={showLineItems} />
        ))}
        <tr className="row-subtotal">
          <td>Summe Einzahlungen</td>
          {totalInflows.map((value, idx) => (
            <td key={idx} className={getCellClass(value)}>
              {formatCurrency(value)}
            </td>
          ))}
          <td className={getCellClass(sumInflows)}>{formatCurrency(sumInflows)}</td>
        </tr>

        {/* Outflows Section */}
        <tr className="row-category">
          <td colSpan={weeks.length + 2}>Auszahlungen</td>
        </tr>
        {outflowCategories.map((category) => (
          <CategoryRows key={category.categoryName} category={category} formatCurrency={formatCurrency} getCellClass={getCellClass} isOutflow showLineItems={showLineItems} />
        ))}
        <tr className="row-subtotal">
          <td>Summe Auszahlungen</td>
          {totalOutflows.map((value, idx) => (
            <td key={idx} className="value-negative">
              -{formatCurrency(value)}
            </td>
          ))}
          <td className="value-negative">-{formatCurrency(sumOutflows)}</td>
        </tr>

        {/* Net Cashflow */}
        <tr className="row-subtotal">
          <td>Netto-Cashflow</td>
          {netCashflows.map((value, idx) => (
            <td key={idx} className={getCellClass(value)}>
              {formatCurrency(value)}
            </td>
          ))}
          <td className={getCellClass(sumNet)}>{formatCurrency(sumNet)}</td>
        </tr>

        {/* Closing Balance */}
        <tr className="row-total">
          <td>Endbestand</td>
          {closingBalances.map((value, idx) => (
            <td key={idx} className={value < BigInt(0) ? "!text-red-300" : ""}>
              {formatCurrency(value)}
            </td>
          ))}
          <td className={closingBalances[closingBalances.length - 1] < BigInt(0) ? "!text-red-300" : ""}>
            {formatCurrency(closingBalances[closingBalances.length - 1])}
          </td>
        </tr>
      </tbody>
    </table>
    </div>
  );
}

interface CategoryRowsProps {
  category: Category;
  formatCurrency: (cents: bigint | string) => string;
  getCellClass: (cents: bigint | string) => string;
  isOutflow?: boolean;
  showLineItems?: boolean;
}

function CategoryRows({ category, formatCurrency, getCellClass, isOutflow, showLineItems = false }: CategoryRowsProps) {
  return (
    <>
      {/* Category header row */}
      <tr className="bg-gray-50">
        <td className="font-medium text-[var(--secondary)]">
          {category.categoryName}
        </td>
        {category.weeklyTotals.map((value, idx) => (
          <td key={idx} className={`font-medium ${isOutflow ? "" : getCellClass(value)}`}>
            {isOutflow ? `-${formatCurrency(value)}` : formatCurrency(value)}
          </td>
        ))}
        <td className={`font-medium ${isOutflow ? "" : getCellClass(category.totalCents)}`}>
          {isOutflow ? `-${formatCurrency(category.totalCents)}` : formatCurrency(category.totalCents)}
        </td>
      </tr>
      {/* Individual line items - only show if enabled */}
      {showLineItems && category.lines.map((line) => (
        <tr key={line.lineName}>
          <td className="pl-6 text-[var(--secondary)]">{line.lineName}</td>
          {line.weeklyValues.map((wv) => (
            <td key={wv.weekOffset} className={isOutflow ? "" : getCellClass(wv.effectiveCents)}>
              {isOutflow && BigInt(wv.effectiveCents) > BigInt(0)
                ? `-${formatCurrency(wv.effectiveCents)}`
                : formatCurrency(wv.effectiveCents)
              }
            </td>
          ))}
          <td className={isOutflow ? "" : getCellClass(line.totalCents)}>
            {isOutflow && BigInt(line.totalCents) > BigInt(0)
              ? `-${formatCurrency(line.totalCents)}`
              : formatCurrency(line.totalCents)
            }
          </td>
        </tr>
      ))}
    </>
  );
}
