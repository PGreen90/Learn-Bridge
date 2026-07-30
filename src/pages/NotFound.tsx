import { Link } from 'react-router-dom'
import { Felt } from '../components/Felt'

// 404-sidan (konkurrensplanen Fas 0 c): en felskriven eller död adress ska landa
// mjukt här med en tydlig väg hem, i stället för på en tom sida. Håller
// varumärket: gröna filtet, guldknappen, samma ton som startsidan.
export function NotFound() {
  return (
    <Felt className="px-6 py-14 sm:px-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-3 rounded-2xl border border-gold-400/40"
      />
      <div className="flex flex-col items-center gap-4 text-center">
        <div aria-hidden className="font-display text-6xl font-bold text-gold-400">
          404
        </div>
        <h1 className="text-2xl font-semibold text-white sm:text-3xl">
          Sidan hittades inte
        </h1>
        <p className="max-w-md text-emerald-50/90">
          Adressen finns inte (längre). Kanske en felskrivning, eller en gammal
          länk — men härifrån hittar du snabbt tillbaka.
        </p>
        <Link
          to="/"
          className="mt-1 rounded-xl bg-gold-400 px-6 py-3 font-display font-bold text-emerald-950 shadow-md transition-all hover:-translate-y-0.5 hover:bg-gold-300 active:scale-[0.98]"
        >
          ← Till start
        </Link>
      </div>
    </Felt>
  )
}
