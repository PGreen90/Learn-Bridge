// RONDGENOMGÅNG PER GIV vid vänner-bordet (bordens SENARE-lista etapp 1,
// ägarbeslut 2026-09-14). REN modul: bordets projicerade givläge → allt
// genomgångsvyn behöver. Datat finns redan i händelseloggen: auktionen
// (`history`), varje spelat kort i ordning (`kort`) och reveal av alla fyra
// händerna i giv-klar (`klar.hands` = hela den utdelade given). Sticken byggs
// ur korthändelserna med motorns stickvinnarlogik (`verkligaStick`) och buden
// tolkas SYSTEMISKT ur auktionen (`annoteraSystemiskt`) — aldrig ur någons
// hand (ärlig inferens; serverns budhändelser bär inga förklaringar).
// Perspektivet är VERKLIGA stolar: genomgången är gemensam för alla vid bordet.

import type { Deal } from '../../types/bridge'
import type { ResolvedCall } from '../../lib/bidding'
import type { Contract, Trick } from '../../lib/engine/play'
import type { DdFacit } from '../../lib/engine/dd-facit'
import { annoteraSystemiskt, verkligaStick, type BordSpelLage } from './bord-projektion'

export interface BordGenomgang {
  deal: Deal
  contract: Contract
  /** Auktionen i verkliga stolar med systemiska förklaringar. */
  calls: ResolvedCall[]
  /** Färdiga stick i spelordning (verkliga stolar). */
  tricks: Trick[]
  declarerTricks: number
  nsScore: number
  /** DD-facit ur giv-klar (etapp 2), null när servern inte kunde räkna. */
  dd: DdFacit | null
}

/** Genomgångens indata ur ett KLART givläge, eller null när given inte går att
 *  gå igenom (inte klar, utpassad, eller inga färdiga stick). `kod` = bordets
 *  kod, bara för givens id. */
export function byggBordGenomgang(lage: BordSpelLage, kod: string): BordGenomgang | null {
  const klar = lage.klar
  if (!klar || klar.passadUt || !klar.contract) return null
  const tricks = verkligaStick(lage)
  if (tricks.length === 0) return null
  const deal: Deal = {
    id: `bord-${kod}-giv-${lage.giv}`,
    dealer: lage.dealer,
    vulnerability: lage.vulnerability,
    board: lage.board,
    hands: klar.hands,
  }
  return {
    deal,
    contract: klar.contract,
    calls: annoteraSystemiskt(lage.history),
    tricks,
    declarerTricks: klar.declarerTricks,
    nsScore: klar.nsScore,
    dd: klar.dd ?? null,
  }
}
