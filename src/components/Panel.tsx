import type { ReactNode } from 'react'

/** En vit "kort-ruta" som vi lägger innehåll i. Ger enhetligt utseende. */
export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`bg-panel rounded-2xl shadow-md ring-1 ring-panel-ring p-6 dark:shadow-none ${className}`}
    >
      {children}
    </div>
  )
}
