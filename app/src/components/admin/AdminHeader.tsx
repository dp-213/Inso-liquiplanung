"use client";

import { useRouter } from "next/navigation";

interface AdminHeaderProps {
  username: string;
}

export default function AdminHeader({ username }: AdminHeaderProps) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <header className="h-16 bg-white border-b border-[var(--border)] flex items-center justify-between px-6">
      <div>
        {/* Breadcrumb area - can be enhanced later */}
      </div>

      <div className="flex items-center space-x-4">
        <span className="text-sm text-[var(--secondary)]">
          Angemeldet als <span className="font-medium text-[var(--foreground)]">{username}</span>
        </span>
        <button
          onClick={handleLogout}
          className="btn-secondary flex items-center"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Abmelden
        </button>
      </div>
    </header>
  );
}
