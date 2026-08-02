import type { ReactNode } from 'react'

/**
 * Sidhuvudet på de inre sidorna (Budträning, Budvisning, Budsystem,
 * Inställningar) — faceliftens yta 4 (2026-08-02). Ett gemensamt utseende i
 * varumärkesspråket: rubriken i klubbserifen (h1 ärver font-brand från
 * index.css), och under den en kort guldhårlinje som ekar guldlinjen under
 * menyraden — klubbtemat följer med ner på sidan. Ingen panel runt (rubriken
 * ligger direkt på sidytan), ingen extra spader (ägarbeslut 2026-07-31:
 * "för många spader"). Guld sparsamt, enligt tokenreglerna i index.css.
 */
export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header>
      <h1 className="text-3xl font-semibold text-ink">{title}</h1>
      <div
        aria-hidden
        className="mt-2 h-0.5 w-14 rounded-full bg-gradient-to-r from-gold-400 via-gold-300 to-transparent"
      />
      {children && <p className="mt-3 max-w-2xl text-ink-soft">{children}</p>}
    </header>
  )
}
