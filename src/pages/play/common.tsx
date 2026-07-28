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
  type Trick,
} from '../../lib/engine/play'
import { SPEED_LABEL, type PlaySpeed } from './tempo'

/** Sticksvepet (etapp 2): 'hold' = korten ligger kvar med vinnarglow,
 *  'slide' = alla fyra sveps mot vinnarens sida. null = inget svep. */
export type Sweep = { trick: Trick; phase: 'hold' | 'slide' }

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

/** Sticket sveps MOT VINNARENS sida (animationsklasserna i index.css). */
export const SWEEP_OUT: Record<Seat, string> = {
  N: 'trick-sweep-n',
  S: 'trick-sweep-s',
  W: 'trick-sweep-w',
  E: 'trick-sweep-e',
}

/** Får platsen spela just nu, styrd av dig? (för klickbarhet + markering) */
export function turnInfo(play: PlayState, contract: Contract, seat: Seat) {
  const myTurn = play.toAct === seat && controls(contract, seat) && !isComplete(play)
  const legal = myTurn ? legalCards(play, seat) : []
  return { myTurn, legalSet: new Set(legal.map((c) => `${c.suit}${c.rank}`)) }
}

/** En På/Av-rad i ⋮-menyn (Auto Claim, Budstöd, Ljud …) — samma radmönster
 *  överallt så menyerna ser likadana ut i bud- och spelfasen. */
export function MenuToggleRow({
  label,
  hint,
  on,
  onToggle,
}: {
  label: string
  hint: string
  on: boolean
  onToggle: () => void
}) {
  return (
    <div className="mt-2 flex items-center justify-between rounded-lg bg-panel-2 px-2.5 py-1.5">
      <span className="text-xs font-medium text-ink-soft">
        {label} <span className="text-ink-faint">({hint})</span>
      </span>
      <button
        type="button"
        onClick={onToggle}
        aria-label={label}
        className={`rounded-full px-3 py-0.5 text-xs font-bold ${
          on ? 'bg-emerald-600 text-white' : 'bg-panel-2 text-ink-muted ring-1 ring-line'
        }`}
      >
        {on ? 'På' : 'Av'}
      </button>
    </div>
  )
}

/** Temporaden i ⋮-menyn: Lugn/Normal/Snabb (ägarbeslut 2026-07-28). Skalar
 *  botpauser och animationslängder via tempo.ts + --motion-scale. */
export function MenuTempoRow({
  speed,
  onChange,
}: {
  speed: PlaySpeed
  onChange: (next: PlaySpeed) => void
}) {
  return (
    <div className="mt-2 flex items-center justify-between rounded-lg bg-panel-2 px-2.5 py-1.5">
      <span className="text-xs font-medium text-ink-soft">Tempo</span>
      <div className="flex gap-1">
        {(Object.keys(SPEED_LABEL) as PlaySpeed[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            aria-label={`Tempo ${SPEED_LABEL[s]}`}
            className={`rounded-full px-2 py-0.5 text-xs font-bold ${
              speed === s ? 'bg-emerald-600 text-white' : 'bg-panel-2 text-ink-muted ring-1 ring-line'
            }`}
          >
            {SPEED_LABEL[s]}
          </button>
        ))}
      </div>
    </div>
  )
}
