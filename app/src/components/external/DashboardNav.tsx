"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface DashboardNavProps {
  caseId: string;
}

const navItems = [
  { href: "", label: "Uebersicht", icon: "chart" },
  { href: "/revenue", label: "Einnahmen", icon: "money" },
  { href: "/security", label: "Sicherungsrechte", icon: "shield" },
  { href: "/estate", label: "Masseuebersicht", icon: "folder" },
  { href: "/compare", label: "Vergleich", icon: "compare" },
];

export default function DashboardNav({ caseId }: DashboardNavProps) {
  const pathname = usePathname();
  const basePath = `/portal/cases/${caseId}`;

  const isActive = (href: string) => {
    if (href === "") {
      return pathname === basePath;
    }
    return pathname === `${basePath}${href}`;
  };

  const getIcon = (icon: string) => {
    switch (icon) {
      case "chart":
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
        );
      case "money":
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case "shield":
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        );
      case "folder":
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        );
      case "compare":
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <nav className="flex flex-wrap gap-2 p-1 bg-gray-100 rounded-lg">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={`${basePath}${item.href}`}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            isActive(item.href)
              ? "bg-white text-[var(--primary)] shadow-sm"
              : "text-[var(--secondary)] hover:text-[var(--foreground)] hover:bg-white/50"
          }`}
        >
          {getIcon(item.icon)}
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
