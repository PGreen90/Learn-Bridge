// Förberedelse för punkt 28 (facit för stick via en double-dummy solver).
//
// STATUS: blockerad på en fungerande solver. Vi utvärderade npm-paketet
// `bridge-dds` (Apache-2.0, bär Bo Haglunds DDS som självständig, base64-inbäddad
// WebAssembly – rätt form för GitHub Pages). Men i nuvarande Chrome/V8 (juni
// 2026) **kraschar** själva uträkningen: `loadDds()` och lätta anrop
// (`SetMaxThreads`) fungerar, men `CalcDDtablePBN`/`SolveBoardPBN` ger
// `RuntimeError: null function` i den tunga lösar-koden. Det gäller den
// publicerade 1.4.0-byggen (1.3.0 saknar inbäddad wasm och är sämre). Paketet
// är alltså inte användbart som det är – se docs/arbetslista.md punkt 28.
//
// Det som ÄR klart och testat: omvandlingen av en giv till PBN-strängen som
// vilken DDS-solver som helst tar emot. Den ligger kvar här som byggsten till
// den dag en fungerande solver (annat paket, ny version, eller egen wasm-bygge)
// kopplas in.

import type { Deal, Hand, Rank, Seat } from '../../types/bridge'

// PBN skriver tian som "T" och listar färgerna spader.hjärter.ruter.klöver.
const RANK_TO_PBN: Record<Rank, string> = {
  A: 'A', K: 'K', Q: 'Q', J: 'J', '10': 'T', '9': '9', '8': '8',
  '7': '7', '6': '6', '5': '5', '4': '4', '3': '3', '2': '2',
}
const RANK_HIGH_TO_LOW: Rank[] = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2']
const PBN_SUIT_ORDER: Array<Hand[number]['suit']> = ['spades', 'hearts', 'diamonds', 'clubs']
const PBN_SEAT_ORDER: Seat[] = ['N', 'E', 'S', 'W'] // medurs från Nord

/** En hand som PBN-grupp "S.H.D.C", t.ex. "AK7.QJ.T98.6532". */
function handToPbn(hand: Hand): string {
  return PBN_SUIT_ORDER.map((suit) =>
    hand
      .filter((c) => c.suit === suit)
      .sort((a, b) => RANK_HIGH_TO_LOW.indexOf(a.rank) - RANK_HIGH_TO_LOW.indexOf(b.rank))
      .map((c) => RANK_TO_PBN[c.rank])
      .join(''),
  ).join('.')
}

/** Hela given som PBN-strängen "N:<N> <E> <S> <W>" (medurs från Nord). */
export function dealToPbn(deal: Deal): string {
  return 'N:' + PBN_SEAT_ORDER.map((seat) => handToPbn(deal.hands[seat])).join(' ')
}
