// Klickbar budlåda för budfasen på "Spela kort". Visar alla 35 kontraktsbud
// (nivå 1–7 × ♣♦♥♠ NT) plus Pass / dubbelt / redubbelt. Tillåtna bud kommer från
// `legalCalls` (bridge-reglerna) – otillåtna knappar gråas ut. Komponenten är
// "dum": den ritar bara och säger till via onBid när du klickar ett lagligt bud.

import type { Bid, Suit } from '../types/bridge'
import { SuitSymbol } from './SuitSymbol'

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
  onClick,
  className = '',
  children,
}: {
  ok: boolean
  onClick: () => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      disabled={!ok}
      onClick={onClick}
      className={`flex items-center justify-center gap-0.5 rounded-md border border-slate-300 bg-white py-2 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-emerald-50 active:bg-emerald-100 disabled:opacity-25 disabled:shadow-none disabled:hover:bg-white ${className}`}
    >
      {children}
    </button>
  )
}

export function BiddingBox({ legal, onBid }: { legal: Bid[]; onBid: (bid: Bid) => void }) {
  const allowed = new Set(legal)

  return (
    <div className="mx-auto w-full max-w-md space-y-2">
      <div className="grid grid-cols-5 gap-1.5">
        {LEVELS.map((level) =>
          STRAINS.map(({ code, suit }) => {
            const bid = `${level}${code}`
            return (
              <CallButton key={bid} ok={allowed.has(bid)} onClick={() => onBid(bid)}>
                <span>{level}</span>
                {suit ? <SuitSymbol suit={suit} /> : <span className="text-xs text-slate-700">NT</span>}
              </CallButton>
            )
          }),
        )}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <CallButton ok={allowed.has('P')} onClick={() => onBid('P')} className="!text-emerald-700">
          Pass
        </CallButton>
        <CallButton ok={allowed.has('X')} onClick={() => onBid('X')} className="!text-red-600">
          Dubbelt
        </CallButton>
        <CallButton ok={allowed.has('XX')} onClick={() => onBid('XX')} className="!text-blue-700">
          Redubbelt
        </CallButton>
      </div>
    </div>
  )
}
