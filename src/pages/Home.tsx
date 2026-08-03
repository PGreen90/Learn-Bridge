import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BrandMark, Wordmark } from '../components/BrandMark'
import { Felt } from '../components/Felt'
import { dailyNumber, dailyStreak, type DailyLog } from '../lib/engine/daily'
import { loadValue } from '../lib/storage'

// Startsidan = ETT samlat grönt hero (ägarbeslut 2026-07-31 "vi har spridit ut
// oss för mycket"): varumärkesblocket överst (frameless guldspader + tvåfärgat
// skimmer-ordmärke + tagline), och därunder de fyra MENYKNAPPARNA som leder in i
// appen — allt inne i samma gröna yta. Ingen dubblering längre: de gamla
// CTA-knapparna "Spela kort"/"Öva budgivning" var samma mål som mode-korten
// (Spela kort resp. Budträning), så de togs bort tillsammans med kortsolfjädern.

// Egna linje-ikoner i guld, ritade i samma språk som logotypen (BrandMark):
// inline-SVG → knivskarpa i alla storlekar och alltid på varumärket.
const ICON_SVG = 'h-6 w-6'
const MODE_ICONS: Record<string, ReactNode> = {
  // Spela kort: ett spelkort med brandens egen guldspader som filled pip.
  cards: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={ICON_SVG}>
      <rect x="5" y="3" width="14" height="18" rx="2.5" />
      <path
        d="M12 7 C 10 9.5, 7.5 11, 7.5 13 C 7.5 14.5, 9 15, 10 14 C 9.8 15.5, 9.2 16, 8.5 16.3 L 15.5 16.3 C 14.8 16, 14.2 15.5, 14 14 C 15 15, 16.5 14.5, 16.5 13 C 16.5 11, 14 9.5, 12 7 Z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  ),
  // Budträning: måltavla — hitta rätt bud.
  target: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={ICON_SVG}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  ),
  // Budvisning: ett öga — titta på när datorn budar.
  eye: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={ICON_SVG}>
      <path d="M2.5 12 C 6 7, 18 7, 21.5 12 C 18 17, 6 17, 2.5 12 Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  // Dagens giv: en kalender med guldpricken på dagens datum.
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={ICON_SVG}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 9.5 L 20.5 9.5" />
      <path d="M8 3 L 8 6.5 M16 3 L 16 6.5" />
      <circle cx="12" cy="15" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  ),
  // Budsystem: en uppslagen bok.
  book: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={ICON_SVG}>
      <path d="M12 6.5 C 10 5.2, 6.5 5, 4 5.5 L 4 17.5 C 6.5 17, 10 17.2, 12 18.5 C 14 17.2, 17.5 17, 20 17.5 L 20 5.5 C 17.5 5, 14 5.2, 12 6.5 Z" />
      <path d="M12 6.5 L 12 18.5" />
    </svg>
  ),
}

// Menyknapp PÅ det gröna filtet: halvgenomskinlig mörkgrön platta med ljus text
// och guld-linjeikon. Den roterande guldramen tänds vid hover (gold-frame-hover).
// Alla fyra knappar är likvärdiga (ägarbeslut 2026-07-31: ingen förmarkering av
// "Spela kort", ingen "Börja här"-markering).
const CARD =
  'group relative block rounded-2xl bg-emerald-950/30 p-4 text-left ring-1 ring-emerald-50/10 gold-frame-hover transition-all hover:-translate-y-0.5 hover:bg-emerald-950/45 active:scale-[0.99]'

/** Guld linje-ikon i en tonad ruta (mot det gröna filtet). */
function ModeIcon({ icon }: { icon: string }) {
  return (
    <span
      aria-hidden
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50/10 text-gold-300"
    >
      {MODE_ICONS[icon]}
    </span>
  )
}

function ModeCard({
  to,
  icon,
  title,
  description,
}: {
  to: string
  icon: string
  title: string
  description: string
}) {
  return (
    <Link to={to} className={CARD}>
      <div className="flex items-center gap-3">
        <ModeIcon icon={icon} />
        <div className="min-w-0">
          <div className="font-semibold text-emerald-50">{title}</div>
          <div className="text-sm text-emerald-100/70">{description}</div>
        </div>
      </div>
    </Link>
  )
}

/** Dagens giv-kortet: brett flaggskepp ovanför menyknapparna, med löpnumret
 *  och en "Spelad ✓"-bricka när dagens giv redan är avklarad (localStorage,
 *  skrivs av resultatvyn i Play). */
function DailyCard() {
  const n = dailyNumber()
  // Loggen (Etapp B) är sanningen; gamla `daily-played` läses som reserv för
  // den som spelade före loggen fanns.
  const log = loadValue<DailyLog>('daily-log', {})
  const played = log[n] !== undefined || loadValue<number | null>('daily-played', null) === n
  const streak = dailyStreak(log, n)
  return (
    <Link
      to="/spela-kort/dagens"
      className="gold-frame group relative block w-full max-w-xl rounded-2xl bg-emerald-950/45 p-4 text-left ring-1 ring-gold-400/25 transition-all hover:-translate-y-0.5 hover:bg-emerald-950/60 active:scale-[0.99]"
    >
      <div className="flex items-center gap-3">
        <ModeIcon icon="calendar" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 font-semibold text-emerald-50">
            Dagens giv <span className="text-gold-300">#{n}</span>
            {played && (
              <span className="rounded-full bg-gold-400/15 px-2 py-0.5 text-[10px] font-semibold text-gold-200 ring-1 ring-inset ring-gold-400/30">
                Spelad ✓
              </span>
            )}
            {/* Streaken (Etapp B): syns från två dagar i rad — skälet att
                komma tillbaka i morgon ska synas redan på startsidan. */}
            {streak >= 2 && (
              <span className="rounded-full bg-gold-400/15 px-2 py-0.5 text-[10px] font-semibold text-gold-200 ring-1 ring-inset ring-gold-400/30">
                🔥 {streak} dagar
              </span>
            )}
          </div>
          <div className="text-sm text-emerald-100/70">
            Samma giv för alla i dag — spela den och dela ditt resultat.
          </div>
        </div>
      </div>
    </Link>
  )
}

export function Home() {
  return (
    // ETT samlat grönt hero. Avboxat (frameless, mjuk kant via felt-melt) med luft.
    <Felt
      rounded="rounded-[2.75rem]"
      className="felt-melt border-transparent px-5 py-14 shadow-[0_30px_80px_-45px_rgba(0,0,0,0.5)] sm:px-10 sm:py-20"
    >
      {/* Svag stor spader-vattenstämpel bakom = öppen grön yta (base44-idén). */}
      <BrandMark
        bare
        className="pointer-events-none absolute left-1/2 top-40 h-72 w-72 -translate-x-1/2 opacity-[0.07] sm:top-48"
      />
      <div className="relative flex flex-col items-center gap-6 text-center text-emerald-50">
        {/* Varumärkesblocket (den stora "ramen"): spader + ordmärke + tagline. */}
        <BrandMark bare className="h-16 w-16 drop-shadow-md" />
        <h1 className="text-5xl sm:text-6xl">
          <Wordmark />
        </h1>
        {/* Taglinen (ägarbeslut 2026-08-02): kort och koncis — tre ord. */}
        <p className="max-w-md text-lg text-emerald-50/90">Träna, spela, tävla</p>

        {/* Dagens giv — FLAGGSKEPPET (2026-08-02, Wordle-mekaniken): samma giv
            för alla varje dag, delbart resultat. Enda kortet med den ständigt
            roterande guldramen (gold-frame) — det unika ska synas. */}
        <DailyCard />

        {/* Menyknapparna: vägen in i appen, en per del. */}
        <div className="grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
          <ModeCard
            to="/spela-kort"
            icon="cards"
            title="Spela kort"
            description="Spela en hel giv mot datorn – bud och kortspel."
          />
          <ModeCard
            to="/budtraning"
            icon="target"
            title="Budträning"
            description="Öva på att hitta rätt bud, tema för tema."
          />
          <ModeCard
            to="/budvisning"
            icon="eye"
            title="Budvisning"
            description="Titta när datorn budar alla fyra händerna."
          />
          <ModeCard
            to="/budsystem"
            icon="book"
            title="Budsystem"
            description="Hela 2/1-systemet att läsa, sektion för sektion."
          />
        </div>
      </div>
    </Felt>
  )
}
