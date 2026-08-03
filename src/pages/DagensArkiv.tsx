// Kalenderarkivet för Dagens giv (granskningsputsen 2026-08-03): en månads-
// kalender från premiären 2026-08-02 och framåt. Spelade dagar visar ditt
// resultat (stick ur loggen `daily-log`), missade dagar går att spela i
// EFTERHAND via #/spela-kort/dagens?dag=N — men efterhandsspel räknas aldrig
// in i streaken (ärlighetsregeln i daily.ts: ett igenfyllt hål väcker inte en
// bruten svit). Framtida dagar är låsta — morgondagens giv är en överraskning.

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { dailyDateFromNumber, dailyNumber, type DailyLog } from '../lib/engine/daily'
import { loadValue } from '../lib/storage'

// Måndag först, som svenska kalendrar. getDay() räknar söndag = 0 → (d+6)%7.
const WEEKDAYS = ['M', 'T', 'O', 'T', 'F', 'L', 'S']
const mondayFirst = (d: Date) => (d.getDay() + 6) % 7

/** En månad som jämförbart tal (år·12+månad) — för att klampa bläddringen. */
const monthKey = (y: number, m: number) => y * 12 + m

/** "augusti 2026" med stor bokstav. */
function monthLabel(y: number, m: number): string {
  const label = new Date(y, m, 1).toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** `now` finns för testerna (fryst "i dag") — appen använder riktiga klockan. */
export function DagensArkiv({ now = new Date() }: { now?: Date }) {
  const todayNr = dailyNumber(now)
  const premiere = dailyDateFromNumber(1)
  const log = loadValue<DailyLog>('daily-log', {})

  // Bläddringen: en månad i taget, klampad mellan premiärmånaden och nu.
  const [shown, setShown] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const minKey = monthKey(premiere.getFullYear(), premiere.getMonth())
  const maxKey = monthKey(now.getFullYear(), now.getMonth())
  const shownKey = monthKey(shown.y, shown.m)
  const step = (delta: number) =>
    setShown(({ y, m }) => {
      const d = new Date(y, m + delta, 1)
      return { y: d.getFullYear(), m: d.getMonth() }
    })

  // Månadens rutor: tomrum fram till första veckodagen, sedan alla datum.
  const daysInMonth = new Date(shown.y, shown.m + 1, 0).getDate()
  const leadingBlanks = mondayFirst(new Date(shown.y, shown.m, 1))

  return (
    <div className="space-y-6">
      <PageHeader title="Kalenderarkivet">
        Varje dag sedan premiären har sin egen giv — samma för alla. Missade du en dag? Spela den i
        efterhand här: resultatet bokförs i kalendern, men bara givar spelade på sin egen dag räknas
        in i din 🔥-svit.
      </PageHeader>

      <div className="mx-auto w-full max-w-md">
        {/* Månadsväljaren: ‹ Månad År › — klampad så man inte bläddrar ut ur arkivet. */}
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            aria-label="Föregående månad"
            onClick={() => step(-1)}
            disabled={shownKey <= minKey}
            className="flex h-9 w-9 items-center justify-center rounded-lg ring-1 ring-line text-ink transition-colors hover:bg-panel disabled:opacity-30"
          >
            ‹
          </button>
          <h2 className="text-lg font-semibold text-ink">{monthLabel(shown.y, shown.m)}</h2>
          <button
            type="button"
            aria-label="Nästa månad"
            onClick={() => step(1)}
            disabled={shownKey >= maxKey}
            className="flex h-9 w-9 items-center justify-center rounded-lg ring-1 ring-line text-ink transition-colors hover:bg-panel disabled:opacity-30"
          >
            ›
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((w, i) => (
            <div key={i} className="pb-1 text-center text-xs font-semibold text-ink-muted">
              {w}
            </div>
          ))}
          {Array.from({ length: leadingBlanks }, (_, i) => (
            <div key={`blank-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const date = new Date(shown.y, shown.m, i + 1)
            const nr = dailyNumber(date)
            // Utanför arkivet: före premiären eller i framtiden → låst ruta.
            if (nr < 1 || nr > todayNr) {
              return (
                <div
                  key={i + 1}
                  className="flex aspect-square items-center justify-center rounded-lg text-sm text-ink-muted opacity-40"
                >
                  {i + 1}
                </div>
              )
            }
            const entry = log[nr]
            const isToday = nr === todayNr
            return (
              <Link
                key={i + 1}
                to={`/spela-kort/dagens?dag=${nr}`}
                title={
                  entry
                    ? `Giv #${nr} — ${entry.myTricks} av 13 stick${entry.late ? ' (spelad i efterhand)' : ''}`
                    : `Giv #${nr} — ospelad`
                }
                className={`flex aspect-square flex-col items-center justify-center rounded-lg ring-1 transition-all hover:-translate-y-0.5 ${
                  isToday ? 'ring-2 ring-gold-400' : 'ring-line'
                } ${entry ? 'bg-emerald-700/10' : 'hover:bg-panel'}`}
              >
                <span className={`text-xs ${entry ? 'text-ink-muted' : 'font-semibold text-ink'}`}>
                  {i + 1}
                </span>
                {entry && (
                  /* Resultatet i guldserif — spoilerfritt (bara DINA stick). */
                  <span className="font-brand text-sm font-bold leading-none text-gold-600 dark:text-gold-300">
                    {entry.myTricks}
                    <span className="font-sans text-[9px] font-normal text-ink-muted"> st</span>
                  </span>
                )}
              </Link>
            )
          })}
        </div>

        <p className="mt-4 text-center text-xs text-ink-muted">
          Guldram = i dag · siffran i guld = dina stick av 13 · tomma dagar går att spela i efterhand.
        </p>
      </div>
    </div>
  )
}
