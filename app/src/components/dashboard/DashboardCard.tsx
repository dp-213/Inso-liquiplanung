"use client";

import { ReactNode } from "react";

interface DashboardCardProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  headerAction?: ReactNode;
  noPadding?: boolean;
}

/**
 * Reusable card component for dashboard sections
 */
export default function DashboardCard({
  title,
  subtitle,
  children,
  className = "",
  headerAction,
  noPadding = false,
}: DashboardCardProps) {
  return (
    <div className={`admin-card ${className}`}>
      {(title || headerAction) && (
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <div>
            {title && (
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-sm text-[var(--muted)] mt-0.5">{subtitle}</p>
            )}
          </div>
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      <div className={noPadding ? "" : "p-6"}>{children}</div>
    </div>
  );
}
