"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";

interface AdminShellProps {
  username: string;
  children: React.ReactNode;
}

const navItems = [
  { name: "Übersicht", href: "/admin" },
  { name: "Kunden", href: "/admin/customers" },
  { name: "Fälle", href: "/admin/cases" },
];

export default function AdminShell({ username, children }: AdminShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Close menu on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  const isActive = (href: string) => {
    if (href === "/admin") {
      return pathname === "/admin";
    }
    return pathname.startsWith(href);
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/";
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Top Bar */}
      <header className="h-14 bg-[var(--card)] border-b border-[var(--border)] sticky top-0 z-40">
        <div className="h-full flex items-center justify-between px-4 sm:px-6">
          {/* Left: Logo + Nav */}
          <div className="flex items-center gap-6">
            <Link href="/admin" className="flex items-center shrink-0">
              <img src="/favicon.png" alt="Gradify" className="h-7 w-auto mr-2" />
              <span className="font-bold text-[var(--foreground)] hidden sm:inline">Gradify Cases</span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                      : "text-[var(--secondary)] hover:text-[var(--foreground)] hover:bg-[var(--accent)]"
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>

          {/* Right: Theme + User + Logout */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <span className="hidden sm:inline text-sm text-[var(--secondary)]">
              Angemeldet als{" "}
              <span className="font-medium text-[var(--foreground)]">{username}</span>
            </span>
            <button onClick={handleLogout} className="btn-secondary flex items-center py-1.5 px-3">
              <svg className="w-4 h-4 sm:mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:inline text-sm">Abmelden</span>
            </button>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center -mr-2 text-[var(--secondary)] hover:text-[var(--foreground)]"
              aria-label={menuOpen ? "Menü schließen" : "Menü öffnen"}
              aria-expanded={menuOpen}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {menuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile dropdown – animiert mit max-height + opacity */}
        <nav
          className={`md:hidden bg-[var(--card)] border-b border-[var(--border)] shadow-lg overflow-hidden transition-all duration-200 ease-out ${
            menuOpen
              ? "max-h-60 opacity-100"
              : "max-h-0 opacity-0 border-b-0"
          }`}
        >
          <div className="px-4 py-2 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-3 py-3 rounded-md text-sm font-medium ${
                  isActive(item.href)
                    ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                    : "text-[var(--secondary)] hover:bg-[var(--accent)]"
                }`}
              >
                {item.name}
              </Link>
            ))}
          </div>
        </nav>
      </header>

      {/* Main content - full width */}
      <main className="p-4 sm:p-6">{children}</main>
    </div>
  );
}
