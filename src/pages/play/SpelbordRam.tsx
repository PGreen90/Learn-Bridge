// Spelfasens RAM — EN layout för spelbordet (Spela mot datorn / Dagens tävling)
// och vänner-bordet (ägarbeslut 2026-09-24: "bara duken och korten får se olika
// ut; storlek på kort och placeringar är lika"). Här bor zonerna och deras
// marginaler: hörnknapparna, Nord-zonen, mittraden (Väst | sticket | Öst),
// bricka/zon, den svarta listen, textraderna under listen och Syds hand längst
// ner. Vyerna fyller bara slottarna — ändras en marginal här ändras den på
// båda borden, så de aldrig kan glida isär igen.
//
// Tonen (club = grön, vanner = vinröd) styr ENBART färgerna på bordets chrome
// (listens bakgrund, textens vithet, knapparnas mörka botten), aldrig ett mått.

import type { CSSProperties, ReactNode, Ref } from 'react'
import type { Deal } from '../../types/bridge'
import { Felt, type FeltTone } from '../../components/Felt'
import { VUL_TEXT } from './common'

/** Färgerna per ton — samma nycklar, bara nyanserna skiljer. */
export const RAM_TON: Record<
  FeltTone,
  {
    /** Ljus text direkt på duken (bricka/zon, förklaringsrader). */
    text: string
    /** Svag ljus text på duken ("Tryck på spelat kort …"). */
    textSvag: string
    /** Syd-listen: avdelare + tonad botten. */
    sydList: string
    /** Den svarta listen (kontrakt + ställning) och HCP-/tänker-brickorna. */
    chip: string
    /** Hörnknapparna (⋮ / i) och listens sekundärknapp. */
    knapp: string
    /** Ljus text på brickor/knappar. */
    knappText: string
  }
> = {
  club: {
    text: 'text-emerald-50/90',
    textSvag: 'text-emerald-50/50',
    sydList: 'border-emerald-100/10 bg-emerald-950/25',
    chip: 'bg-emerald-950/80',
    knapp: 'bg-emerald-950/60 ring-emerald-100/10 hover:bg-emerald-950/80 hover:ring-gold-400/40',
    knappText: 'text-emerald-50',
  },
  vanner: {
    text: 'text-rose-50/90',
    textSvag: 'text-rose-50/50',
    sydList: 'border-rose-100/10 bg-red-950/25',
    chip: 'bg-red-950/80',
    knapp: 'bg-red-950/60 ring-rose-100/10 hover:bg-red-950/80 hover:ring-gold-400/40',
    knappText: 'text-rose-50',
  },
}

/** Hela spelvyns Felt-klass (edge-to-edge, ingen ram) — samma i alla faser. */
export const SPELVY_FELT = 'flex min-h-[100dvh] w-full flex-col rounded-none border-transparent shadow-none'

/** Hörnknappen (⋮ / i): 32×32, samma på båda borden. `text` = 'text-lg' för ⋮, 'text-sm' för i. */
export function hornKnappKlass(tone: FeltTone, text: 'text-lg' | 'text-sm'): string {
  const t = RAM_TON[tone]
  return `flex h-8 w-8 items-center justify-center rounded-lg ${t.knapp} ${text} font-bold ${t.knappText} ring-1 transition-colors`
}

/** Listens sekundärknapp ("Facit" / "Hoppa till resultat"). */
export function listKnappKlass(tone: FeltTone): string {
  const t = RAM_TON[tone]
  return `rounded-lg ${t.knapp} px-2.5 py-1 text-xs font-semibold ${t.knappText} ring-1 transition-colors`
}

/** Överst på meny-/info-overlayen: strax under hörnknapparna (+ ev. sänkning). */
export function overlayTopp(sanktPx = 0): string {
  return `calc(3rem + env(safe-area-inset-top) + ${sanktPx}px)`
}

export function SpelbordRam({
  tone = 'club',
  className = '',
  style,
  hornRef,
  horn,
  overlays,
  nord,
  vast,
  mitt,
  ost,
  board,
  vulnerability,
  list,
  underList,
  syd,
  efter,
}: {
  tone?: FeltTone
  /** Extra Felt-klasser (spelbordets felt-fade-out). */
  className?: string
  style?: CSSProperties
  /** Hörnankaret (spelbordets svävande meny mäter det). */
  hornRef?: Ref<HTMLDivElement>
  /** Hörnknapparna (⋮ över i) — vyn ritar stapeln, ramen placerar den. */
  horn: ReactNode
  /** Allt som ligger ovanpå bordet: klick-utanför, menyer, overlays, dialoger. */
  overlays?: ReactNode
  /** Nord-zonen: träkarlen i kolumner / spelföraren Nord som kortrad / tom. */
  nord: ReactNode
  vast?: ReactNode
  /** Stickmitten. */
  mitt: ReactNode
  ost?: ReactNode
  board: number
  vulnerability: Deal['vulnerability']
  /** Innehållet i den svarta listen (chip + ev. knapp). */
  list: ReactNode
  /** Textraderna under listen (facit, kortförklaring, statusrader). */
  underList?: ReactNode
  /** Syds hand (+ ev. "Alla färger"-knappen ovanför). */
  syd: ReactNode
  /** Efter Syd-listen: flyglagret, claim-rutor och annat absolut placerat. */
  efter?: ReactNode
}) {
  const t = RAM_TON[tone]
  return (
    <Felt tone={tone} className={`${SPELVY_FELT} ${className}`} style={style}>
      {/* ⋮ (meny) överst, ⓘ (budgivningen) under den — staplade i övre högra
          hörnet (ägarbeslut 2026-07-31). Säker marginal för urtaget. */}
      <div ref={hornRef} data-bordsmeny-ankare className="absolute right-2.5 top-[calc(0.5rem+env(safe-area-inset-top))] z-20">
        {horn}
      </div>
      {overlays}

      {/* Toppzonen: Nord-sidans öppna hand. min-h håller platsen så bordet inte
          hoppar när träkarlen läggs upp. */}
      <div className="flex min-h-16 justify-center pt-[calc(0.75rem+env(safe-area-inset-top))]">{nord}</div>

      {/* Mittraden (Synrey, ägarbeslut 2026-08-02): träkarlen på sin egen sida
          som färghögar, sticket i mitten. Mittzonen får min-w-0 så den krymper
          när båda sidohögarna visas (felrapport #44); sidohögarna shrink-0. */}
      <div className="flex flex-1 items-center gap-1 px-1 py-2">
        {vast && <div className="shrink-0">{vast}</div>}
        <div className="flex min-w-0 flex-1 justify-center">{mitt}</div>
        {ost && <div className="shrink-0">{ost}</div>}
      </div>

      {/* Bricka + zon nere till vänster. */}
      <div className={`px-3 pb-2 text-xs leading-tight ${t.text}`}>
        <div>Bricka {board}</div>
        <div>{VUL_TEXT[vulnerability]}</div>
      </div>

      {/* Svarta listen: kontraktet + ställningen (+ knapp). */}
      <div className="flex items-center justify-center gap-2 pb-1.5">{list}</div>
      {underList}

      {/* Din hand längst ner. Säker botten-marginal (hemindikatorn) nu när
          duken går edge-to-edge. */}
      <div className={`border-t ${t.sydList} px-2 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))]`}>{syd}</div>
      {efter}
    </Felt>
  )
}

/** Listens chip (den svarta rutan med kontraktet). */
export function ListChip({ tone = 'club', children }: { tone?: FeltTone; children: ReactNode }) {
  return (
    <div className={`flex items-center gap-2 rounded-lg ${RAM_TON[tone].chip} px-3 py-1 shadow ring-1 ring-gold-400/25`}>
      {children}
    </div>
  )
}

/** "◀ Alla färger" — vägen tillbaka när bara en vald färg visas (Synrey). */
export function AllaFargerKnapp({ tone = 'club', onClick }: { tone?: FeltTone; onClick: () => void }) {
  const t = RAM_TON[tone]
  return (
    <div className="flex justify-center pb-1.5">
      <button
        type="button"
        onClick={onClick}
        className={`rounded-full ${t.knapp} px-3 py-1 text-xs font-semibold ${t.knappText} ring-1 ring-gold-400/30 transition-colors`}
      >
        ◀ Alla färger
      </button>
    </div>
  )
}

/** "[Stol] tänker …" — resonemangslagrets flytande bricka på budlådans underkant
 *  (ägarbeslut 2026-09-24: budlådan får inte ändra storlek). */
export function TankerBricka({ tone = 'club', text }: { tone?: FeltTone; text: string | null }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-1.5 z-10 flex translate-y-1/2 justify-center" aria-live="polite">
      {text && (
        <div className={`flex items-center gap-1.5 rounded-full ${RAM_TON[tone].chip} px-3 py-1 text-xs font-semibold text-white shadow-lg ring-1 ring-gold-400/30`}>
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold-300" aria-hidden />
          {text}
        </div>
      )}
    </div>
  )
}
