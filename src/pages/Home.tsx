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

const CARD =
  'block rounded-2xl bg-panel p-5 shadow-md ring-1 ring-panel-ring transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.99] ' +
  'dark:shadow-none dark:hover:bg-club-800'

/** Emoji-ikon i en tonad ruta, så korten känns igen blixtsnabbt. */
function CardIcon({ children }: { children: string }) {
  return (
    <span
      aria-hidden
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-xl dark:bg-emerald-950/60"
    >
      {children}
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
        <CardIcon>{icon}</CardIcon>
        <div>
          <div className="font-semibold text-ink">{title}</div>
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
          icon="🃏"
          title="Spela kort"
          description="Spela en hel giv mot datorn – bud och kortspel."
        />
        <ModeCard
          to="/budtraning"
          icon="🎯"
          title="Budträning"
          description="Öva på att hitta rätt bud, tema för tema."
        />
        <ModeCard
          to="/budvisning"
          icon="👁️"
          title="Budvisning"
          description="Titta när datorn budar alla fyra händerna."
        />
        <ModeCard
          to="/budsystem"
          icon="📖"
          title="Budsystem"
          description="Hela 2/1-systemet att läsa, sektion för sektion."
        />
      </div>
    </div>
  )
}
