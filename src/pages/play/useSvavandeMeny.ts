// Svävande menyknappar (ägarbeslut 2026-09-15): ⋮/i sitter i spelbordets övre
// högra hörn. När Nord spelför ligger Nords hand som KORTRAD upptill
// (kortregeln: träkarlen i kolumner, spelföraren i kortrad), och 13 kort
// spänner 349 px på en 375 px-skärm — raden når in under knapparna. Då sänks
// knapparna mjukt till strax under raden, och svävar tillbaka upp när Nords
// hand krympt så platsen finns igen. Ren geometri ur DOM:en, inga antaganden
// om skärmbredd. Bara vilande rad mäts (vald färg gör raden tillfälligt smal —
// då skulle knapparna studsa vid varje två-trycks-spel).

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'

/** Luft mellan kortraden och knapparna, i px (åt sidan OCH nedåt). */
export const MENY_LUFT = 8

export function useSvavandeMeny(
  radRef: RefObject<HTMLElement | null>,
  ankareRef: RefObject<HTMLElement | null>,
  /** Nords hand ligger som kortrad upptill (Nord spelför och är uppvänd). */
  aktiv: boolean,
  /** En färg är vald → raden är tillfälligt smal, mät inte (behåll läget). */
  fryst: boolean,
  /** Ändras när raden kan ha ändrat bredd (antal kort i handen). */
  nyckel: number,
): number {
  const [offset, setOffset] = useState(0)
  const [tick, setTick] = useState(0)
  const senast = useRef(0)

  useEffect(() => {
    const omMat = () => setTick((t) => t + 1)
    window.addEventListener('resize', omMat)
    return () => window.removeEventListener('resize', omMat)
  }, [])

  useLayoutEffect(() => {
    let nytt = 0
    if (aktiv) {
      if (fryst) return
      const rad = radRef.current
      const ankare = ankareRef.current
      if (rad && ankare) {
        const r = rad.getBoundingClientRect()
        // Ankaret flyttas aldrig (transformen ligger på stapeln inuti) → dess
        // rect är knapparnas NATURLIGA läge.
        const a = ankare.getBoundingClientRect()
        const kolliderar = r.right + MENY_LUFT > a.left
        nytt = kolliderar ? Math.max(0, Math.round(r.bottom + MENY_LUFT - a.top)) : 0
      }
    }
    if (nytt !== senast.current) {
      senast.current = nytt
      setOffset(nytt)
    }
  }, [aktiv, fryst, nyckel, tick, radRef, ankareRef])

  return offset
}
