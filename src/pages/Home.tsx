import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BrandMark, Wordmark } from '../components/BrandMark'
import { Felt } from '../components/Felt'
import { PlayingCard } from '../components/PlayingCard'
import type { Card } from '../types/bridge'

// Startsidan är RebidZ ansikte utåt: en hero på det gröna filtet (logotyp,
// tagline, kortsolfjäder, tydlig "Spela"-knapp) och därunder ett lägeskort per
// del av appen. Sidan ÄR förklaringen av produkten.

// Dekorativ solfjäder i heron – visar upp kortdesignen (fyrfärgslek).
const HERO_CARDS: Card[] = [
  { suit: 'spades', rank: 'A' },
  { suit: 'hearts', rank: 'K' },
  { suit: 'diamonds', rank: 'Q' },
  { suit: 'clubs', rank: 'J' },
]
const HERO_TILT = ['-rotate-12 translate-y-2', '-rotate-4', 'rotate-4', 'rotate-12 translate-y-2']

// Egna linje-ikoner i guld, ritade i samma språk som logotypen (BrandMark):
// inline-SVG → knivskarpa i alla storlekar och alltid på varumärket. Ersatte
// emoji 2026-07-31 (faceliften, Fas 1) — emoji bröt mot guldserifen intill och
// drog ner "anrik kortklubb"-intrycket. currentColor = guld sätts av plattan.
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
  // Budsystem: en uppslagen bok.
  book: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={ICON_SVG}>
      <path d="M12 6.5 C 10 5.2, 6.5 5, 4 5.5 L 4 17.5 C 6.5 17, 10 17.2, 12 18.5 C 14 17.2, 17.5 17, 20 17.5 L 20 5.5 C 17.5 5, 14 5.2, 12 6.5 Z" />
      <path d="M12 6.5 L 12 18.5" />
    </svg>
  ),
}

// Kortet lyfts en aning och tänder en guld-hårlinje vid hover — samma
// guldram-motiv som runt ordmärket i heron, så hela sidan hänger ihop.
const CARD_BASE =
  'group block rounded-2xl p-5 shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.99] dark:shadow-none'
const CARD_NEUTRAL = 'bg-panel ring-1 ring-panel-ring hover:ring-gold-400/50 dark:hover:bg-club-800'
// Flaggskeppet "Spela kort": ligger på en varm guldton med guldring redan i
// vila, så ögat vet var det ska börja.
const CARD_FEATURED =
  'bg-gold-400/[0.07] ring-1 ring-gold-400/40 hover:ring-gold-400/70 dark:bg-gold-400/10'

/** Guld linje-ikon i en tonad ruta, så korten känns igen blixtsnabbt. */
function ModeIcon({ icon, featured }: { icon: string; featured?: boolean }) {
  return (
    <span
      aria-hidden
      className={
        'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-gold-600 dark:text-gold-400 ' +
        (featured
          ? 'bg-gold-400/15 ring-1 ring-gold-400/30'
          : 'bg-emerald-100 dark:bg-emerald-950/60')
      }
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
  featured,
}: {
  to: string
  icon: string
  title: string
  description: string
  featured?: boolean
}) {
  return (
    <Link to={to} className={`${CARD_BASE} ${featured ? CARD_FEATURED : CARD_NEUTRAL}`}>
      <div className="flex items-center gap-3.5">
        <ModeIcon icon={icon} featured={featured} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-ink">{title}</span>
            {featured && (
              <span className="rounded-full bg-gold-400/20 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-gold-700 dark:text-gold-300">
                Börja här
              </span>
            )}
          </div>
          <div className="text-sm text-ink-muted">{description}</div>
        </div>
      </div>
    </Link>
  )
}

export function Home() {
  return (
    <div className="space-y-4">
      {/* Heron: varumärket + vägen in i spelet. Tunn guldram som i ägarens
          logo-vision (bild 3): en inre border på filtet. */}
      <Felt className="px-6 py-10 sm:px-10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-3 rounded-2xl border border-gold-400/40"
        />
        <div className="flex flex-col items-center gap-4 text-center">
          <BrandMark className="h-14 w-14 drop-shadow-md" />
          <h1 className="text-5xl sm:text-6xl">
            <Wordmark framed />
          </h1>
          <p className="max-w-md text-emerald-50/90">
            Spela och lär dig bridge mot en partner som kan 2/1-systemet — direkt i
            webbläsaren.
          </p>

          {/* Solfjädern: ren dekoration, delas ut med kaskadanimationen. */}
          <div aria-hidden className="flex justify-center pt-1">
            {HERO_CARDS.map((c, i) => (
              <PlayingCard
                key={c.suit}
                card={c}
                size="lg"
                className={`deal-in origin-bottom shadow-md ${i > 0 ? '-ml-4' : ''} ${HERO_TILT[i]}`}
                style={{ animationDelay: `${i * 90}ms` }}
              />
            ))}
          </div>

          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link
              to="/spela-kort"
              className="rounded-xl bg-gold-400 px-6 py-3 font-display font-bold text-emerald-950 shadow-md transition-all hover:-translate-y-0.5 hover:bg-gold-300 active:scale-[0.98]"
            >
              Spela kort →
            </Link>
            <Link
              to="/budtraning"
              className="rounded-xl bg-white/10 px-6 py-3 font-medium text-white ring-1 ring-white/25 transition-all hover:bg-white/20 active:scale-[0.98]"
            >
              Öva budgivning
            </Link>
          </div>
        </div>
      </Felt>

      <div className="grid gap-4 sm:grid-cols-2">
        <ModeCard
          to="/spela-kort"
          icon="cards"
          title="Spela kort"
          description="Spela en hel giv mot datorn – bud och kortspel."
          featured
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
  )
}
