export default function ProjectsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Projekte</h1>
          <p className="text-[var(--secondary)] mt-1">
            Insolvenzverwaltungen und Mandate verwalten
          </p>
        </div>
        <div className="h-10 w-44 bg-gray-200 rounded animate-pulse"></div>
      </div>

      {/* Projects grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="admin-card p-6 animate-pulse">
            <div className="flex items-start justify-between mb-4">
              <div className="h-6 bg-gray-200 rounded w-32"></div>
              <div className="h-6 bg-gray-100 rounded w-16"></div>
            </div>
            <div className="h-4 bg-gray-100 rounded w-full mb-2"></div>
            <div className="h-4 bg-gray-100 rounded w-3/4 mb-4"></div>
            <div className="flex justify-between items-center pt-4 border-t border-[var(--border)]">
              <div className="h-4 bg-gray-100 rounded w-20"></div>
              <div className="h-4 bg-gray-100 rounded w-16"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
