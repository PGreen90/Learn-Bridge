import { Link } from 'react-router-dom'
import { SuitSymbol } from '../components/SuitSymbol'

// Startsidan är en väljare: ett klickbart kort per läge, flaggskeppet
// "Spela kort" överst med hedersplats. Korten ÄR förklaringen av appen.

const CARD =
  'block rounded-2xl bg-white p-5 shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg ' +
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
      <header className="mb-6">
        <h1 className="text-2xl font-bold mb-1">
          Välkommen! <SuitSymbol suit="spades" /> <SuitSymbol suit="hearts" />{' '}
          <SuitSymbol suit="diamonds" /> <SuitSymbol suit="clubs" />
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Lär dig att buda och spela bridge enligt 2/1-systemet – i din egen takt.
        </p>
      </header>

      {/* Flaggskeppet: hela spelupplevelsen. Grön ram + "Börja här". */}
      <Link to="/spela-kort" className={`${CARD} ring-2 ring-emerald-500 dark:ring-emerald-600`}>
        <span className="mb-2 inline-block rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
          Börja här
        </span>
        <div className="flex items-center gap-3">
          <CardIcon>🃏</CardIcon>
          <div>
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100">Spela kort</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Buda och spela hela givar mot datorn – med facit och omspelning.
            </div>
          </div>
          <span className="ml-auto text-xl text-emerald-600 dark:text-emerald-400">→</span>
        </div>
      </Link>

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
