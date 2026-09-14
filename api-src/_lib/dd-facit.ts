// DD-FACIT PÅ SERVERN (bordens SENARE-lista etapp 2, ägarbeslut 2026-09-14):
// när en giv vid vänner-bordet blir klar räknar servern hela DD-tabellen
// (20 värden: spelförare × strain) + par med bridge-dds — Bo Haglunds riktiga
// lösare kompilerad till WebAssembly, INBÄDDAD i paketets JS (base64) så
// esbuild buntar den rakt in i api/bord.js utan extra filer. Spiken
// 2026-09-14: bunten +569 kB, laddning ~12 ms (en gång per varm instans),
// tabellen 5–150 ms per giv — ryms gott i dragets tidsbudget. Resultatet bakas
// in i giv-klar-händelsens data (`dd`), ingen schemaändring. Fel i lösaren
// får ALDRIG stoppa given: då bokförs giv-klar utan facit (klienten döljer
// jämförelsen). Konventionerna (tabell[strain][säte]) är lösarens egna,
// låsta av revisor-dds.test.ts; klienten läser via src/lib/engine/dd-facit.ts.

import type { Deal, Seat, Vulnerability } from '../../src/types/bridge'
import type { DdFacit } from '../../src/lib/engine/dd-facit'
import { dealToPbn, getDds } from '../../src/lib/engine/revisor-dds'
import type { NyHandelse } from './bord-motor'

const SEAT_IDX: Record<Seat, number> = { N: 0, E: 1, S: 2, W: 3 }
const VUL_IDX: Record<Vulnerability, number> = { none: 0, all: 1, ns: 2, ew: 3 }

/** DD-tabellen + par för given, eller null om lösaren vägrar/kraschar. */
export async function beraknaDdFacit(deal: Deal): Promise<DdFacit | null> {
  try {
    const dds = await getDds()
    const res = dds.CalcDDTablePBN({ cards: dealToPbn(deal) })
    const par = dds.DealerPar(res, SEAT_IDX[deal.dealer], VUL_IDX[deal.vulnerability])
    return {
      tabell: res.resTable.map((rad) => [...rad]),
      parNS: par.score,
      parKontrakt: [...par.contracts],
    }
  } catch {
    return null
  }
}

/** Ge varje giv-klar-händelse (spelad giv, ej utpassad) sitt DD-facit i
 *  `data.dd`. Övriga händelser lämnas orörda; misslyckas lösaren lämnas
 *  giv-klar utan `dd`. */
export async function medDdFacit(handelser: NyHandelse[], deal: Deal): Promise<NyHandelse[]> {
  const behover = handelser.some((h) => h.typ === 'giv-klar' && !(h.data as { passadUt?: boolean }).passadUt)
  if (!behover) return handelser
  const dd = await beraknaDdFacit(deal)
  if (!dd) return handelser
  return handelser.map((h) =>
    h.typ === 'giv-klar' && !(h.data as { passadUt?: boolean }).passadUt ? { ...h, data: { ...(h.data as Record<string, unknown>), dd } } : h,
  )
}
