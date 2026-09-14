// RONDGENOMGÅNG PER GIV vid vänner-bordet (bordens SENARE-lista etapp 1,
// 2026-09-14): stega igenom auktionen och sticken för den giv som just
// spelats — samma perspektivfria vy som tävlingens "Så spelade X given"
// (PlayReplay), på vänner-ytans vinröda duk. Nås från giv-klar-vyn av ALLA
// vid bordet medan ägaren väntar med nästa giv; startar ägaren nästa giv
// stängs genomgången av BordSpel. Inga botmotiveringar (serverns resonemang
// skickas aldrig till klienten) och ingen "du"-text — perspektivet är
// bordets verkliga stolar, med namnen från stolarna.

import { SEAT_LABEL } from '../../lib/bidding'
import type { Seat } from '../../types/bridge'
import type { BordStol } from '../../lib/backend/bord'
import { BidChip } from '../../components/BidChip'
import { PlayReplay } from '../../components/PlayReplay'
import { STRAIN_CODE } from '../play/common'
import type { BordGenomgang as Genomgang } from './bord-genomgang'

/** Verklig stolordning i namnraden: som auktionsrutnätet (V N Ö S). */
const NAMN_ORDNING: Seat[] = ['W', 'N', 'E', 'S']

export function BordGenomgang({
  genomgang,
  stolar,
  givNr,
  givar,
  minStol,
  onBack,
}: {
  genomgang: Genomgang
  stolar: BordStol[]
  givNr: number
  givar: number
  /** Din verkliga stol — markeras i namnraden. */
  minStol: Seat
  onBack: () => void
}) {
  const { deal, contract, calls, tricks, declarerTricks, nsScore } = genomgang
  const perStol = new Map(stolar.map((s) => [s.stol, s]))
  const diff = declarerTricks - (6 + contract.level)
  const resultat = diff === 0 ? 'jämnt hem' : diff > 0 ? `+${diff}` : `${diff}`
  return (
    <div className="min-h-[100dvh] bg-red-950">
      {/* Topprad: tillbaka + rubrik + kontrakt/resultat på EN rad. */}
      <div className="flex items-center justify-between gap-3 bg-red-950/90 px-4 py-2 pt-[calc(0.5rem+env(safe-area-inset-top))] text-sm text-rose-50">
        <button
          onClick={onBack}
          className="shrink-0 font-semibold text-rose-100/80 underline underline-offset-2 hover:text-rose-50"
        >
          ← Tillbaka
        </button>
        <h1 className="min-w-0 flex-1 truncate text-center font-brand text-base text-gold-200">
          Genomgång av giv {givNr} av {givar}
        </h1>
        <span className="flex shrink-0 items-center gap-1.5 tabular-nums">
          <BidChip bid={`${contract.level}${STRAIN_CODE[contract.strain]}`} />
          {contract.doubled && <span className="text-xs font-bold text-rose-300">{contract.doubled}</span>}
          <span>
            av {SEAT_LABEL[contract.declarer]} · {declarerTricks} stick ({resultat}) ·{' '}
            {nsScore >= 0 ? `NS +${nsScore}` : `ÖV +${-nsScore}`}
          </span>
        </span>
      </div>
      {/* Namnraden i VERKLIGA stolar — genomgången är gemensam för bordet. */}
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 bg-red-950/90 px-4 pb-1.5 text-[11px] text-rose-100/60">
        {NAMN_ORDNING.map((s) => (
          <span key={s} className={s === minStol ? 'font-semibold text-gold-200' : ''}>
            {SEAT_LABEL[s]}: {perStol.get(s)?.namn ?? 'Bot'}
            {s === minStol ? ' (du)' : ''}
          </span>
        ))}
      </div>

      <PlayReplay key={deal.id} deal={deal} contract={contract} tricks={tricks} calls={calls} tone="vanner" />

      <p className="px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-center text-[11px] text-rose-100/50">
        Stega sticken med pilarna. Tryck på ett bud för dess betydelse.
      </p>
    </div>
  )
}
