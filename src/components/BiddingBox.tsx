// Budlådan i Synrey-stil (FAS 12): rutnät med kolumnerna 1NT/1♠/1♥/1♦/1♣ och
// raderna 1–7, färgkodade chips (NT lila, ♠ svart, ♥ röd, ♦ orange, ♣ grön) och
// nedersta raden X / XX / PASS / OK. Ett klick VÄLJER budet (chipet markeras och
// en kort betydelse-rad visas), OK bekräftar. Otillåtna bud tonas ner.
//
// Motorns rekommenderade bud markeras med en liten grön prick och får sin äkta
// förklaring; egna bud tolkas ur auktionen (tolkande lagret) så raden aldrig är tom.

import { useState } from 'react'
import type { Bid } from '../types/bridge'
import type { ResolvedCall } from '../lib/bidding'
import { isAlertRule } from '../lib/engine/alerts'
import { interpretCall } from '../lib/engine/auction-interpret'
import { bidChipTone, BidChipContent } from './BidChip'

const LEVELS = [1, 2, 3, 4, 5, 6, 7]
// Kolumnordning som i Synrey: NT längst till vänster, sedan ♠ ♥ ♦ ♣ (fallande).
const STRAINS = ['NT', 'S', 'H', 'D', 'C'] as const

function BoxChip({
  bid,
  ok,
  selected,
  recommended,
  onClick,
}: {
  bid: Bid
  ok: boolean
  selected: boolean
  recommended: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={!ok}
      onClick={onClick}
      className={`relative flex h-10 items-center justify-center rounded-lg text-lg font-bold shadow-sm transition-all ${bidChipTone(bid)} ${
        selected ? 'ring-2 ring-white brightness-105 -translate-y-0.5' : ''
      } disabled:opacity-25 disabled:shadow-none ${ok ? 'cursor-pointer hover:brightness-105' : ''}`}
    >
      {recommended && !selected && (
        <span
          className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-emerald-600 ring-1 ring-white"
          title="Motorns rekommenderade bud"
        />
      )}
      <BidChipContent bid={bid} />
    </button>
  )
}

export function BiddingBox({
  legal,
  onBid,
  recommendation = null,
  history = [],
}: {
  legal: Bid[]
  onBid: (bid: Bid) => void
  /** Motorns rekommenderade bud (markeras + får äkta förklaring). */
  recommendation?: ResolvedCall | null
  /** Budföljden så här långt – så även egna bud kan tolkas (alltid en förklaring). */
  history?: ResolvedCall[]
}) {
  const allowed = new Set(legal)
  const [selected, setSelected] = useState<Bid | null>(null)
  const recBid = recommendation && allowed.has(recommendation.bid) ? recommendation.bid : null

  const choose = (bid: Bid) => {
    if (allowed.has(bid)) setSelected((s) => (s === bid ? null : bid))
  }
  const confirm = () => {
    if (selected) {
      onBid(selected)
      setSelected(null)
    }
  }

  const isRec = selected !== null && selected === recBid
  // Egna bud (ej motorns rekommendation) tolkas ur auktionen – aldrig tomt.
  const selInterp =
    selected !== null && !isRec ? interpretCall([...history, { seat: 'S', bid: selected }], history.length) : null
  const selExpl = isRec
    ? recommendation?.explanation ?? 'Motorns rekommenderade bud.'
    : selInterp
      ? `${selInterp.text}${selInterp.confidence === 'gissning' ? ' (osäker tolkning)' : ''}`
      : ''
  const selAlert = isRec ? isAlertRule(recommendation?.rule) : false

  return (
    <div className="mx-auto w-full max-w-md space-y-1.5">
      <div className="grid grid-cols-5 gap-1.5">
        {LEVELS.map((level) =>
          STRAINS.map((code) => {
            const bid = `${level}${code}`
            return (
              <BoxChip
                key={bid}
                bid={bid}
                ok={allowed.has(bid)}
                selected={selected === bid}
                recommended={bid === recBid}
                onClick={() => choose(bid)}
              />
            )
          }),
        )}
      </div>

      {/* Betydelse-raden: kort och diskret, bara när ett bud är valt. */}
      {selected && (
        <p className="px-1 text-xs leading-snug text-emerald-50/90">
          {isRec && <span className="mr-1 rounded bg-emerald-600 px-1 text-[10px] font-bold text-white">MOTORNS BUD</span>}
          {selAlert && <span className="mr-1 rounded bg-sky-600 px-1 text-[10px] font-bold text-white">ALERT</span>}
          {selExpl}
        </p>
      )}

      <div className="grid grid-cols-4 gap-1.5">
        <BoxChip bid="X" ok={allowed.has('X')} selected={selected === 'X'} recommended={recBid === 'X'} onClick={() => choose('X')} />
        <BoxChip bid="XX" ok={allowed.has('XX')} selected={selected === 'XX'} recommended={recBid === 'XX'} onClick={() => choose('XX')} />
        <BoxChip bid="P" ok={allowed.has('P')} selected={selected === 'P'} recommended={recBid === 'P'} onClick={() => choose('P')} />
        <button
          type="button"
          disabled={!selected}
          onClick={confirm}
          className="flex h-10 items-center justify-center rounded-lg bg-sky-500 text-lg font-bold text-white shadow-sm transition-all hover:bg-sky-400 disabled:opacity-30 disabled:shadow-none"
        >
          OK
        </button>
      </div>
    </div>
  )
}
