import type { ReactNode } from 'react'

/** En vit "kort-ruta" som vi lägger innehåll i. Ger enhetligt utseende. */
export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`bg-white rounded-2xl shadow-md p-6 dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800 ${className}`}
    >
      {children}
    </div>
  )
}
