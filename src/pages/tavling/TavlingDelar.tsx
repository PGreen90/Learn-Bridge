// Delade småbitar för tävlingsvyerna (Påbyggnad 3, 2026-09-13): kontraktscellen
// och resultattexten används av översikten (DagensTavling), travellern och
// genomgången — och av historiksidan (etapp D3). Lyfta hit ur DagensTavling.tsx
// så ingen vy importerar en annan sida.

import { SuitSymbol } from '../../components/SuitSymbol'
import type { Seat } from '../../types/bridge'
import type { GivKontrakt } from '../../lib/backend/tavling'

/** Spelförarens säte på svenska (kompakt, till kontraktscellen). */
export const SÄTE_SV: Record<Seat, string> = { N: 'N', E: 'Ö', S: 'S', W: 'V' }

/** Resultatet relativt kontraktet: "=", "+1", "−2" (ur spelförarens sikt). */
export function resultatText(k?: GivKontrakt | null): string {
  if (!k) return '—'
  if (k.diff === 0) return '='
  return k.diff > 0 ? `+${k.diff}` : `−${-k.diff}`
}

/** Kontraktscellen: nivå + färgsymbol (spader svart) + ev. dubbling + säte.
 *  `null` = utpassad giv; `undefined` = äldre framsteg utan kontraktsfält. */
export function Kontraktscell({ k }: { k?: GivKontrakt | null }) {
  if (k === null) return <span className="text-emerald-100/50">Passad</span>
  if (!k) return <span className="text-emerald-100/40">—</span>
  return (
    <span className="inline-flex items-center gap-0.5 text-emerald-50">
      <span className="tabular-nums">{k.level}</span>
      {k.strain === 'NT' ? (
        <span className="font-semibold">NT</span>
      ) : (
        <SuitSymbol suit={k.strain} />
      )}
      {k.doubled && <span className="font-semibold text-danger">{k.doubled}</span>}
      <span className="ml-1 text-xs text-emerald-100/50">{SÄTE_SV[k.declarer]}</span>
    </span>
  )
}
