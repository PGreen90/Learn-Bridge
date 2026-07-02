import { Link } from 'react-router-dom'
import { BrandMark } from '../components/BrandMark'
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
  'block rounded-2xl bg-white p-5 shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.99] ' +
  'dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800 dark:hover:bg-slate-800'

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
          <div className="font-semibold text-slate-900 dark:text-slate-100">{title}</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">{description}</div>
        </div>
      </div>
    </Link>
  )
}

export function Home() {
  return (
    <div className="space-y-4">
      {/* Heron: varumärket + vägen in i spelet. */}
      <Felt className="px-6 py-10 sm:px-10">
        <div className="flex flex-col items-center gap-4 text-center">
          <BrandMark className="h-14 w-14 drop-shadow-md" />
          <h1 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Rebid<span className="text-gold-400">Z</span>
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
          to="/budtraning"
          icon="🎯"
          title="Budträning"
          description="Öva på att hitta rätt bud, tema för tema."
        />
        <ModeCard
          to="/spela"
          icon="👁️"
          title="Budvisning"
          description="Titta när datorn budar alla fyra händerna."
        />
      </div>

      <ModeCard
        to="/budsystem"
        icon="📖"
        title="Budsystem"
        description="Hela 2/1-systemet att läsa, sektion för sektion."
      />
    </div>
  )
}
