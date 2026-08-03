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
import { interpretCall } from '../lib/engine/auction-interpret'
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

// Kravnivå-badges i förklarings-popupen (bg-panel) — behöver dark-varianter,
// annars blir de bländande ljusa plåster på den mörka panelen.
const FORCING_BADGE: Record<Forcing, string> = {
  avslut: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  'ej-krav': 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  'semi-krav': 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
  inbjudan: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
  'krav-1-rond': 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
  utgangskrav: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
  slamintresse: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
}

/** Kort namn på ett bud i minimal-läget: regelnamnet med stor bokstav. */
function shortLabel(rule: string | undefined): string | null {
  return rule ? rule.charAt(0).toUpperCase() + rule.slice(1) : null
}

/** Budets SYSTEMISKA betydelse (Etapp C, informationsläckan): motorns lagrade
 *  förklaring byggs av spelarens faktiska hand — den får bara ägaren av handen
 *  se under en levande giv. Här tolkas budet i stället av tolkningslagret med
 *  regel + förklaring BORTSKALADE, så tolkningen läser enbart auktionen:
 *  intervall och färglöften, aldrig korten. */
function systemicText(calls: ResolvedCall[], index: number): string {
  const stripped = calls.map((c, i) => (i === index ? { seat: c.seat, bid: c.bid } : c))
  const interp = interpretCall(stripped, index)
  return interp.confidence === 'gissning' ? `${interp.text} (osäker tolkning)` : interp.text
}

export function AuctionGrid({
  calls,
  dealer,
  vulnerability = 'none',
  activeSeat = null,
  explanations = 'full',
  hiddenHands = false,
}: {
  calls: ResolvedCall[]
  dealer: Seat
  vulnerability?: Vulnerability
  /** Platsen som ska bjuda härnäst (dess tomma ruta markeras), eller null. */
  activeSeat?: Seat | null
  /**
   * Budstöd av (ägarbeslut 2026-07-28) → 'minimal': popupen visar bara chip +
   * kort regelnamn + ALERT (alerter finns även vid riktigt bord); kravmärket
   * och den långa förklaringen döljs. 'full' = dagens hela panel.
   */
  explanations?: 'full' | 'minimal'
  /**
   * Levande giv med dolda händer (Etapp C): andras bud förklaras systemiskt
   * (tolkningslagret, bara auktionen) — aldrig med deras faktiska hp. Av i
   * budvisningen och efterhandsvyerna, där korten är öppna med flit.
   */
  hiddenHands?: boolean
}) {
  const [selected, setSelected] = useState<number | null>(null)
  const full = explanations === 'full'

  // Buden ligger medurs från given: tomma rutor före första budet ställer varje
  // bud under rätt kolumn.
  const lead = ORDER.indexOf(dealer)
  const cells: (ResolvedCall | null)[] = [...Array<null>(lead).fill(null), ...calls]
  const activeCell = activeSeat !== null ? cells.length : -1
  while (cells.length % 4 !== 0 || cells.length <= activeCell) cells.push(null)

  const chosen = selected !== null ? cells[selected] : null
  const chosenInfo = chosen ? ruleInfo(chosen.rule) : null
  // Läckvakten: under levande giv får bara Syds egna bud visa den lagrade
  // (hand-byggda) förklaringen — andras bud tolkas systemiskt ur auktionen.
  const masked = hiddenHands && chosen !== null && chosen.seat !== 'S'
  const explanationText = chosen
    ? masked
      ? systemicText(calls, selected! - lead)
      : chosen.explanation
    : null

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
            <div
              className={`flex flex-wrap items-center gap-2 pr-12 ${full ? 'border-b border-line pb-2' : ''}`}
            >
              <BidChip bid={chosen.bid} />
              <span className="text-sm font-semibold text-ink-soft">
                {full ? (
                  <>Förklaring · {SEAT_LABEL[chosen.seat]}</>
                ) : (
                  // Minimal: bara det korta regelnamnet (sitsen om regel saknas).
                  shortLabel(chosen.rule) ?? SEAT_LABEL[chosen.seat]
                )}
              </span>
              {full && chosenInfo?.forcing && (
                <span
                  className={`rounded px-1.5 text-[10px] font-semibold ${FORCING_BADGE[chosenInfo.forcing]}`}
                  title="Kravnivå: vad budet kräver av partnern"
                >
                  {FORCING_LABEL[chosenInfo.forcing]}
                </span>
              )}
              {/* ALERT visas ALLTID — vid riktigt bord alertas konstgjorda bud
                  oavsett hur mycket förklaring man ber om (ägarbeslut). */}
              {chosenInfo?.alert && (
                <span className="rounded bg-sky-600 px-1 text-[10px] font-bold text-white">ALERT</span>
              )}
            </div>
            {full && (
              <p className="pt-2 text-sm text-ink-soft">
                {explanationText ? (
                  <SuitText>{explanationText}</SuitText>
                ) : (
                  <span className="text-ink-faint">
                    Ingen förklaring för <BidLabel bid={chosen.bid} />.
                  </span>
                )}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
