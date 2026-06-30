// Klickbar budlåda för budfasen på "Spela kort". Visar alla 35 kontraktsbud
// (nivå 1–7 × ♣♦♥♠ NT) plus Pass / dubbelt / redubbelt. Tillåtna bud kommer från
// `legalCalls` (bridge-reglerna) – otillåtna knappar gråas ut.
//
// Tvåstegsbud (så varje bud går att inspektera innan det läggs): ett klick VÄLJER
// budet och visar dess betydelse i en infopanel; sedan bekräftar du med "Bjud".
// Motorns rekommenderade bud (det den skulle välja för din hand) markeras med en
// liten grön prick och får sin äkta förklaring; övriga bud saknar systemförklaring
// (motorn är generativ, inte tolkande) och märks "utanför systemlinjen".

import { useState } from 'react'
import type { Bid, Suit } from '../types/bridge'
import type { ResolvedCall } from '../lib/bidding'
import { isAlertRule } from '../lib/engine/alerts'
import { interpretCall } from '../lib/engine/auction-interpret'
import { SuitSymbol } from './SuitSymbol'
import { BidLabel } from './BidLabel'

const LEVELS = [1, 2, 3, 4, 5, 6, 7]
// Färgordning som i en riktig budlåda: ♣ ♦ ♥ ♠ NT (stigande).
const STRAINS: { code: string; suit: Suit | null }[] = [
  { code: 'C', suit: 'clubs' },
  { code: 'D', suit: 'diamonds' },
  { code: 'H', suit: 'hearts' },
  { code: 'S', suit: 'spades' },
  { code: 'NT', suit: null },
]

function CallButton({
  ok,
  selected = false,
  recommended = false,
  onClick,
  className = '',
  children,
}: {
  ok: boolean
  selected?: boolean
  recommended?: boolean
  onClick: () => void
  className?: string
  children: React.ReactNode
}) {
  const tone = selected
    ? 'border-sky-400 bg-sky-100 ring-2 ring-sky-300'
    : recommended
      ? 'border-emerald-500 bg-emerald-50'
      : 'border-slate-300 bg-white'
  return (
    <button
      type="button"
      disabled={!ok}
      onClick={onClick}
      className={`relative flex items-center justify-center gap-0.5 rounded-md border py-2 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-emerald-50 active:bg-emerald-100 disabled:opacity-25 disabled:shadow-none disabled:hover:bg-white ${tone} ${className}`}
    >
      {recommended && !selected && (
        <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500" title="Motorns rekommenderade bud" />
      )}
      {children}
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
    : selInterp?.text ?? ''
  const selAlert = isRec ? isAlertRule(recommendation?.rule) : false

  return (
    <div className="mx-auto w-full max-w-md space-y-2">
      <div className="grid grid-cols-5 gap-1.5">
        {LEVELS.map((level) =>
          STRAINS.map(({ code, suit }) => {
            const bid = `${level}${code}`
            return (
              <CallButton
                key={bid}
                ok={allowed.has(bid)}
                selected={selected === bid}
                recommended={bid === recBid}
                onClick={() => choose(bid)}
              >
                <span>{level}</span>
                {suit ? <SuitSymbol suit={suit} /> : <span className="text-xs text-slate-700">NT</span>}
              </CallButton>
            )
          }),
        )}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <CallButton ok={allowed.has('P')} selected={selected === 'P'} recommended={recBid === 'P'} onClick={() => choose('P')} className="!text-emerald-700">
          Pass
        </CallButton>
        <CallButton ok={allowed.has('X')} selected={selected === 'X'} recommended={recBid === 'X'} onClick={() => choose('X')} className="!text-red-600">
          Dubbelt
        </CallButton>
        <CallButton ok={allowed.has('XX')} selected={selected === 'XX'} recommended={recBid === 'XX'} onClick={() => choose('XX')} className="!text-blue-700">
          Redubbelt
        </CallButton>
      </div>

      {selected ? (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-base font-semibold">
              <BidLabel bid={selected} />
            </span>
            {isRec && (
              <span className="rounded bg-emerald-600 px-1 text-[10px] font-bold text-white align-middle">MOTORNS BUD</span>
            )}
            {selInterp && (
              <span className="rounded bg-slate-500 px-1 text-[10px] font-bold text-white align-middle uppercase" title="Hur säker tolkningen är">
                {selInterp.confidence}
              </span>
            )}
            {selAlert && (
              <span className="rounded bg-sky-600 px-1 text-[10px] font-bold text-white align-middle">ALERT</span>
            )}
          </div>
          <p className="mt-1 text-slate-700">{selExpl}</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={confirm}
              className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
            >
              Bjud <BidLabel bid={selected} />
            </button>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              Avbryt
            </button>
          </div>
        </div>
      ) : (
        <p className="text-center text-xs text-slate-500">
          Klicka ett bud för att se vad det betyder, bekräfta sedan med <span className="font-medium">Bjud</span>.
          Den gröna pricken är motorns rekommendation.
        </p>
      )}
    </div>
  )
}
