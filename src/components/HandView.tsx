import type { Hand, Suit, Rank } from '../types/bridge'
import { SuitSymbol } from './SuitSymbol'
import { hcp } from '../lib/engine/hand'
import { deferredShortness, playingTricks, startingPoints } from '../lib/engine/evaluation'

// Bridge-konvention: visa färgerna i ordningen spader, hjärter, ruter, klöver,
// och korten från högst (A) till lägst (2).
const SUIT_ORDER: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']
const RANK_ORDER: Rank[] = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2']

function sortRanks(ranks: Rank[]): Rank[] {
  return [...ranks].sort((a, b) => RANK_ORDER.indexOf(a) - RANK_ORDER.indexOf(b))
}

/** Skriver tal med tecken: 0 → "0", 2 → "+2", −1 → "−1". */
function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0'
}

/** Spelstick snyggt: 8 → "8", 8.5 → "8½". */
function fmtTricks(t: number): string {
  const whole = Math.floor(t)
  return t - whole >= 0.5 ? `${whole}½` : `${whole}`
}

/**
 * Visar en hand grupperad per färg, som man skriver upp en bridge-hand.
 * Med `showPoints` visas även "15 HP (17 TP)" + en utfällbar uträkning av
 * totalpoängen (Bergens Adjust-3, se docs/handvardering.md).
 */
export function HandView({ hand, showPoints = false }: { hand: Hand; showPoints?: boolean }) {
  return (
    <div className="w-full bg-emerald-50 rounded-xl p-3">
      {SUIT_ORDER.map((suit) => {
        const ranks = sortRanks(hand.filter((c) => c.suit === suit).map((c) => c.rank))
        return (
          <div key={suit} className="flex items-center gap-2 text-xl leading-relaxed whitespace-nowrap">
            <SuitSymbol suit={suit} className="w-5 shrink-0 text-center" />
            <span className="font-mono tracking-normal text-slate-800">
              {ranks.length ? ranks.join(' ') : '—'}
            </span>
          </div>
        )
      })}
      {showPoints && <PointsLine hand={hand} />}
    </div>
  )
}

/** "15 HP (17 TP)" med en utfällbar uträkning av totalpoängen. */
function PointsLine({ hand }: { hand: Hand }) {
  const e = startingPoints(hand)
  const hp = hcp(hand)
  const shortness = deferredShortness(hand)
  const tricks = playingTricks(hand)

  // Bara de delar som faktiskt ändrar poängen visas i uträkningen.
  const rows: { label: string; value: number }[] = [{ label: 'Honnörspoäng (Hp)', value: hp }]
  if (e.adjust3 !== 0) rows.push({ label: 'Adjust-3 (ess/tior vs D/kn)', value: e.adjust3 })
  if (e.length !== 0) rows.push({ label: 'Längd (kort över 4)', value: e.length })
  if (e.dubiousHonors !== 0) rows.push({ label: 'Tvivelaktiga honnörer', value: e.dubiousHonors })
  if (e.suitQuality !== 0) rows.push({ label: 'Kvalitetsfärg', value: e.suitQuality })
  if (e.flatness !== 0) rows.push({ label: 'Flathet', value: e.flatness })

  return (
    <details className="mt-2 border-t border-emerald-200 pt-2 text-sm">
      <summary className="cursor-pointer text-slate-700 marker:text-emerald-500">
        <span className="font-semibold text-slate-900">{hp} HP</span>{' '}
        <span className="text-emerald-700">({e.startingPoints} TP · {fmtTricks(tricks)} spelstick)</span>
        <span className="ml-2 text-xs text-slate-400">– så räknas TP</span>
      </summary>
      <table className="mt-2 w-full max-w-xs text-slate-600">
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="py-0.5 pr-3">{r.label}</td>
              <td className="py-0.5 text-right font-mono tabular-nums">
                {r.label.startsWith('Honnör') ? r.value : signed(r.value)}
              </td>
            </tr>
          ))}
          <tr className="border-t border-emerald-200 font-semibold text-slate-900">
            <td className="py-0.5 pr-3">Totalpoäng (TP)</td>
            <td className="py-0.5 text-right font-mono tabular-nums">{e.startingPoints}</td>
          </tr>
          {shortness > 0 && (
            <tr className="text-slate-400 italic">
              <td className="py-0.5 pr-3">Kortfärg (räknas först vid fit)</td>
              <td className="py-0.5 text-right font-mono tabular-nums">({signed(shortness)})</td>
            </tr>
          )}
        </tbody>
      </table>
      {shortness > 0 && (
        <p className="mt-1 text-xs text-slate-400">
          Singel/dubbel/renons ger poäng först när en trumffärg är hittad – då
          blir handen värd ungefär {e.startingPoints + shortness} TP.
        </p>
      )}
    </details>
  )
}
