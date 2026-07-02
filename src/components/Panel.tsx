import type { ReactNode } from 'react'

/** En vit "kort-ruta" som vi lägger innehåll i. Ger enhetligt utseende. */
export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`bg-white rounded-2xl shadow-md ring-1 ring-emerald-950/5 p-6 dark:bg-club-900 dark:shadow-none dark:ring-emerald-100/10 ${className}`}
    >
      {children}
    </div>
  )
}
