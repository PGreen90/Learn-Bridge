import type { Bid } from '../types/bridge'
import { BidLabel } from './BidLabel'

interface Props {
  options: Bid[]
  /** Buden användaren valt, eller null om hen inte svarat än. */
  chosen: Bid | null
  answer: Bid
  onChoose: (bid: Bid) => void
}

/** Raden med budknappar. Efter svar: grönt = rätt, rött = ditt felval. */
export function BidOptions({ options, chosen, answer, onChoose }: Props) {
  const answered = chosen !== null
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        let cls = 'bg-white border-slate-300 hover:bg-slate-100'
        if (answered) {
          if (opt === answer) cls = 'bg-emerald-100 border-emerald-500 text-emerald-900'
          else if (opt === chosen) cls = 'bg-red-100 border-red-500 text-red-900'
          else cls = 'bg-white border-slate-200 text-slate-400'
        }
        return (
          <button
            key={opt}
            disabled={answered}
            onClick={() => onChoose(opt)}
            className={`min-w-14 rounded-lg border px-4 py-2 text-lg font-bold transition-colors disabled:cursor-default ${cls}`}
          >
            <BidLabel bid={opt} />
          </button>
        )
      })}
    </div>
  )
}
