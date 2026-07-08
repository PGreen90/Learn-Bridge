// Delade småbitar för Spela kort-sidan (budfas + spelfas). Ren hjälpkod utan
// eget tillstånd — allt tillstånd bor i useGame/usePlayTable.

import type { Card, Deal, Seat } from '../../types/bridge'
import { SuitSymbol } from '../../components/SuitSymbol'
import {
  isComplete,
  legalCards,
  side,
  type Contract,
  type PlayState,
} from '../../lib/engine/play'

/** Spelar ägaren (Syd) den här platsen? Vi spelar = både N och S; vi försvarar = bara S. */
export function controls(contract: Contract, seat: Seat): boolean {
  return side(contract.declarer) === 'NS' ? side(seat) === 'NS' : seat === 'S'
}

export function sameCard(a: Card, b: Card) {
  return a.suit === b.suit && a.rank === b.rank
}

/** Ett kort som text: valör + färgsymbol (t.ex. "K♥"), för "Varför?"-raden. */
export function CardLabel({ card }: { card: Card }) {
  return (
    <span className="whitespace-nowrap font-semibold">
      {card.rank}
      <SuitSymbol suit={card.suit} />
    </span>
  )
}

export const VUL_TEXT: Record<Deal['vulnerability'], string> = {
  none: 'Ingen i zon',
  ns: 'NS i zon',
  ew: 'ÖV i zon',
  all: 'Alla i zon',
}

export const STRAIN_CODE: Record<string, string> = {
  clubs: 'C',
  diamonds: 'D',
  hearts: 'H',
  spades: 'S',
  NT: 'NT',
}

/** Spelat kort glider in från spelarens håll (animationsklasserna i index.css). */
export const CARD_IN: Record<Seat, string> = {
  N: 'card-in-n',
  S: 'card-in-s',
  W: 'card-in-w',
  E: 'card-in-e',
}

/** Får platsen spela just nu, styrd av dig? (för klickbarhet + markering) */
export function turnInfo(play: PlayState, contract: Contract, seat: Seat) {
  const myTurn = play.toAct === seat && controls(contract, seat) && !isComplete(play)
  const legal = myTurn ? legalCards(play, seat) : []
  return { myTurn, legalSet: new Set(legal.map((c) => `${c.suit}${c.rank}`)) }
}
