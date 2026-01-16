"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

interface CustomerHeaderProps {
  userName: string;
  companyName: string | null;
}

export default function CustomerHeader({
  userName,
  companyName,
}: CustomerHeaderProps) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/portal/auth/logout", { method: "POST" });
      router.push("/customer-login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <header className="bg-white border-b border-[var(--border)] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Title */}
          <Link href="/portal" className="flex items-center">
            <div className="w-8 h-8 bg-[var(--primary)] rounded-md flex items-center justify-center mr-3">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <div>
              <span className="font-semibold text-[var(--foreground)]">
                Liquiditaetsplanung
              </span>
              <span className="hidden sm:inline text-sm text-[var(--muted)] ml-2">
                Kundenportal
              </span>
            </div>
          </Link>

          {/* User Info and Actions */}
          <div className="flex items-center space-x-4">
            <div className="hidden sm:block text-right">
              <div className="text-sm font-medium text-[var(--foreground)]">
                {userName}
              </div>
              {companyName && (
                <div className="text-xs text-[var(--muted)]">{companyName}</div>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center px-3 py-2 text-sm text-[var(--secondary)] hover:text-[var(--foreground)] hover:bg-gray-100 rounded-md transition-colors"
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Abmelden
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
