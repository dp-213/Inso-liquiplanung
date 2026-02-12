import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-4">
      <div className="admin-card p-8 max-w-md text-center">
        <div className="w-16 h-16 bg-[var(--accent)] rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl font-bold text-[var(--secondary)]">404</span>
        </div>
        <h1 className="text-xl font-bold text-[var(--foreground)] mb-2">
          Seite nicht gefunden
        </h1>
        <p className="text-[var(--secondary)] mb-6">
          Die angeforderte Seite existiert nicht oder wurde verschoben.
        </p>
        <Link href="/" className="btn-primary inline-block">
          Zur Startseite
        </Link>
      </div>
    </div>
  );
}
