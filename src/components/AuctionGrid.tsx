// Auktionen i Synrey-stil (FAS 12): mörkgrön platta, kolumnerna Väst/Nord/Öst/Syd,
// varje lagt bud som färgkodat chip och rutan för nästa bud markerad (turkos) så
// man ser vems tur det är. Klick på ett chip öppnar en vit "Förklaring"-popup
// (som Synreys Instruction) med betydelse + kravnivå + ev. ALERT — allt ur SAMMA
// regel via ruleInfo (FAS 12 punkt 56).

import { useState } from 'react'
import type { Forcing, Seat, Vulnerability } from '../types/bridge'
import type { ResolvedCall } from '../lib/bidding'
import { SEAT_LABEL } from '../lib/bidding'
import { FORCING_LABEL, ruleInfo } from '../lib/engine/rules'
import { BidChip } from './BidChip'
import { BidLabel } from './BidLabel'
import { ClickAway } from './Dialog'
import { SuitText } from './SuitText'

// Kolumnordning V N Ö S (medurs), så Syd – din plats – står längst till höger.
const ORDER: Seat[] = ['W', 'N', 'E', 'S']

/** Är platsen i zon (sårbar)? Zon gäller paret, inte en enskild spelare. */
function vulnerable(seat: Seat, v: Vulnerability): boolean {
  if (v === 'all') return true
  if (v === 'ns') return seat === 'N' || seat === 'S'
  if (v === 'ew') return seat === 'E' || seat === 'W'
  return false
}

const FORCING_BADGE: Record<Forcing, string> = {
  avslut: 'bg-slate-200 text-slate-700',
  'ej-krav': 'bg-slate-200 text-slate-700',
  'semi-krav': 'bg-amber-100 text-amber-800',
  inbjudan: 'bg-amber-100 text-amber-800',
  'krav-1-rond': 'bg-orange-100 text-orange-800',
  utgangskrav: 'bg-red-100 text-red-800',
  slamintresse: 'bg-purple-100 text-purple-800',
}

export function AuctionGrid({
  calls,
  dealer,
  vulnerability = 'none',
  activeSeat = null,
}: {
  calls: ResolvedCall[]
  dealer: Seat
  vulnerability?: Vulnerability
  /** Platsen som ska bjuda härnäst (dess tomma ruta markeras), eller null. */
  activeSeat?: Seat | null
}) {
  const [selected, setSelected] = useState<number | null>(null)

  // Buden ligger medurs från given: tomma rutor före första budet ställer varje
  // bud under rätt kolumn.
  const lead = ORDER.indexOf(dealer)
  const cells: (ResolvedCall | null)[] = [...Array<null>(lead).fill(null), ...calls]
  const activeCell = activeSeat !== null ? cells.length : -1
  while (cells.length % 4 !== 0 || cells.length <= activeCell) cells.push(null)

  const chosen = selected !== null ? cells[selected] : null
  const chosenInfo = chosen ? ruleInfo(chosen.rule) : null

  return (
    <div className="relative flex-1 rounded-lg bg-emerald-950/60 p-2 ring-1 ring-emerald-100/10">
      <div className="grid grid-cols-4 gap-y-1">
        {ORDER.map((seat) => (
          <div
            key={seat}
            className={`pb-0.5 text-center text-xs font-semibold sm:text-sm ${
              vulnerable(seat, vulnerability) ? 'text-red-300' : 'text-yellow-100/90'
            } ${dealer === seat ? 'underline underline-offset-4 decoration-yellow-300' : ''}`}
            title={dealer === seat ? 'Given (börjar buda)' : undefined}
          >
            {SEAT_LABEL[seat]}
          </div>
        ))}
        {cells.map((cell, i) => (
          <div key={i} className="flex h-6 items-center justify-center">
            {cell ? (
              <button type="button" onClick={() => setSelected((s) => (s === i ? null : i))}>
                <BidChip
                  bid={cell.bid}
                  className={`cursor-pointer hover:brightness-110 ${
                    selected === i ? 'ring-2 ring-sky-300' : ''
                  }`}
                />
              </button>
            ) : i === activeCell ? (
              <span className="h-6 w-10 animate-pulse rounded-md bg-teal-300/90 shadow" title="Väntar på bud" />
            ) : null}
          </div>
        ))}
      </div>

      {/* Vit förklarings-popup (Synreys "Instruction"): budet + kravnivå + ALERT + text. */}
      {chosen && (
        <>
          {/* Tryck var som helst utanför bubblan stänger den. */}
          <ClickAway onClose={() => setSelected(null)} />
          <div className="absolute inset-x-1 top-8 z-40 rounded-xl bg-panel p-3 shadow-xl ring-1 ring-line">
            {/* Stäng-kryss: förankrat i övre högra hörnet så det ALDRIG kan
                knuffas utanför bild. iPhone-glas: frostad genomskinlig cirkel
                (backdrop-blur), ljus kant + glansdager på övre halvan. */}
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="absolute right-1.5 top-1.5 z-10 flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-slate-900/45 text-xl leading-none text-white shadow-lg ring-1 ring-white/40 backdrop-blur-md transition-colors hover:bg-slate-900/60"
              aria-label="Stäng"
            >
              {/* Glansdager: ljus topp som tonar ut → blank glas-look. */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/60 to-transparent"
              />
              <span className="relative drop-shadow-sm">✕</span>
            </button>
            <div className="flex flex-wrap items-center gap-2 border-b border-line pb-2 pr-12">
              <BidChip bid={chosen.bid} />
              <span className="text-sm font-semibold text-ink-soft">
                Förklaring · {SEAT_LABEL[chosen.seat]}
              </span>
              {chosenInfo?.forcing && (
                <span
                  className={`rounded px-1.5 text-[10px] font-semibold ${FORCING_BADGE[chosenInfo.forcing]}`}
                  title="Kravnivå: vad budet kräver av partnern"
                >
                  {FORCING_LABEL[chosenInfo.forcing]}
                </span>
              )}
              {chosenInfo?.alert && (
                <span className="rounded bg-sky-600 px-1 text-[10px] font-bold text-white">ALERT</span>
              )}
            </div>
            <p className="pt-2 text-sm text-ink-soft">
              {chosen.explanation ? (
                <SuitText>{chosen.explanation}</SuitText>
              ) : (
                <span className="text-ink-faint">
                  Ingen förklaring för <BidLabel bid={chosen.bid} />.
                </span>
              )}
            </p>
          </div>
        </>
      )}
    </div>
  )
}
