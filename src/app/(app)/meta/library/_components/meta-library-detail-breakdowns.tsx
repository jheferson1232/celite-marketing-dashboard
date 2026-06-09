"use client"

import type { MetaLibraryAnalytics } from "@/lib/services/meta/library/meta-library-analytics"

export function MetaLibraryDetailBreakdowns({
  analytics,
  domain,
}: {
  analytics: MetaLibraryAnalytics
  domain: string | null
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-2xl border bg-card p-4 shadow-sm">
        <h3 className="mb-4 font-semibold">Anuncios por formato</h3>
        {analytics.formats.length > 0 ? (
          <ul className="space-y-3">
            {analytics.formats.map((row) => (
              <li key={row.format}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>{row.label}</span>
                  <span className="text-muted-foreground">
                    {row.percent}% ({row.count})
                  </span>
                </div>
                <div className="bg-muted h-2 overflow-hidden rounded-full">
                  <div
                    className="h-full rounded-full bg-orange-500"
                    style={{ width: `${Math.max(row.percent, 4)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">Sin datos de formato.</p>
        )}
      </section>

      <section className="rounded-2xl border bg-card p-4 shadow-sm">
        <h3 className="mb-4 font-semibold">Páginas de destino principales</h3>
        {analytics.landingPages.length > 0 ? (
          <ul className="space-y-3">
            {analytics.landingPages.map((row) => (
              <li key={row.fullUrl}>
                <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                  <a
                    href={row.fullUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary truncate hover:underline"
                    title={row.fullUrl}
                  >
                    {domain ? `${domain}${row.path}` : row.path}
                  </a>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {row.percent}% ({row.count})
                  </span>
                </div>
                <div className="bg-muted h-2 overflow-hidden rounded-full">
                  <div
                    className="h-full rounded-full bg-orange-500"
                    style={{ width: `${Math.max(row.percent, 4)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">
            Sin enlaces de destino en los anuncios.
          </p>
        )}
      </section>
    </div>
  )
}
