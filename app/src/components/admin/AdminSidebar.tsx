"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  name: string;
  href: string;
  icon: string;
}

interface NavSection {
  label?: string;
  items: NavItem[];
}

const navigation: NavSection[] = [
  {
    // Top section - no label
    items: [
      { name: "Uebersicht", href: "/admin", icon: "chart" },
    ],
  },
  {
    label: "VERWALTUNG",
    items: [
      { name: "Kunden", href: "/admin/customers", icon: "users" },
      { name: "Faelle", href: "/admin/cases", icon: "briefcase" },
    ],
  },
];

function NavIcon({ icon, className }: { icon: string; className?: string }) {
  const iconClass = className || "w-5 h-5 mr-3";

  switch (icon) {
    case "chart":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      );
    case "briefcase":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      );
    case "users":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      );
    default:
      return null;
  }
}

export default function AdminSidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/admin") {
      return pathname === "/admin";
    }
    return pathname.startsWith(href);
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-white border-r border-[var(--border)] flex flex-col">
      {/* Logo/Brand */}
      <div className="h-16 flex items-center px-6 border-b border-[var(--border)]">
        <Link href="/admin" className="flex items-center">
          <img
            src="/favicon.png"
            alt="Gradify"
            className="h-7 w-auto mr-3"
          />
          <span className="font-bold text-[var(--foreground)]">Gradify</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-4 overflow-y-auto">
        {navigation.map((section, sectionIndex) => (
          <div key={sectionIndex} className={sectionIndex > 0 ? "mt-6" : ""}>
            {/* Section Label */}
            {section.label && (
              <div className="px-3 mb-2">
                <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
                  {section.label}
                </span>
              </div>
            )}

            {/* Section Items */}
            <div className="space-y-1">
              {section.items.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? "bg-[var(--primary)] text-white shadow-sm"
                      : "text-[var(--secondary)] hover:bg-gray-100 hover:text-[var(--foreground)]"
                  }`}
                >
                  <NavIcon icon={item.icon} />
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-[var(--border)]">
        <div className="text-xs text-[var(--muted)]">
          <div className="font-medium">Inso-Liquiplanung</div>
          <div>Insolvenz-Kontrollcockpit</div>
        </div>
      </div>
    </aside>
  );
}
