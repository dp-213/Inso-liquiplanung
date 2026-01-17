export default function CasesLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Fälle</h1>
          <p className="text-[var(--secondary)] mt-1">
            Alle Insolvenzverfahren verwalten
          </p>
        </div>
        <div className="h-10 w-40 bg-gray-200 rounded animate-pulse"></div>
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="admin-card p-4">
            <div className="h-4 bg-gray-100 rounded w-16 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded w-12"></div>
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Schuldner</th>
              <th>Aktenzeichen</th>
              <th>Projekt</th>
              <th>Status</th>
              <th>Plan</th>
              <th>Freigaben</th>
              <th>Aktualisiert</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5].map((i) => (
              <tr key={i} className="animate-pulse">
                <td>
                  <div className="h-5 bg-gray-200 rounded w-32"></div>
                </td>
                <td>
                  <div className="h-4 bg-gray-100 rounded w-24"></div>
                </td>
                <td>
                  <div className="h-4 bg-gray-100 rounded w-20"></div>
                </td>
                <td>
                  <div className="h-6 bg-gray-100 rounded w-16"></div>
                </td>
                <td>
                  <div className="h-4 bg-gray-100 rounded w-8"></div>
                </td>
                <td>
                  <div className="h-4 bg-gray-100 rounded w-12"></div>
                </td>
                <td>
                  <div className="h-4 bg-gray-100 rounded w-20"></div>
                </td>
                <td>
                  <div className="h-4 bg-gray-100 rounded w-12"></div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
