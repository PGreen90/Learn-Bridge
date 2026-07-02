import type { Bid } from '../types/bridge'
import { bidChipTone, BidChipContent } from './BidChip'

interface Props {
  options: Bid[]
  /** Buden användaren valt, eller null om hen inte svarat än. */
  chosen: Bid | null
  answer: Bid
  onChoose: (bid: Bid) => void
}

/** Raden med budknappar som färgkodade Synrey-chips.
 *  Efter svar: grön ram = rätt, röd ram = ditt felval, övriga tonas ner. */
export function BidOptions({ options, chosen, answer, onChoose }: Props) {
  const answered = chosen !== null
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {options.map((opt) => {
        let extra = ''
        if (answered) {
          if (opt === answer) extra = 'ring-2 ring-emerald-400 -translate-y-0.5'
          else if (opt === chosen) extra = 'ring-2 ring-red-500'
          else extra = 'opacity-30'
        }
        return (
          <button
            key={opt}
            disabled={answered}
            onClick={() => onChoose(opt)}
            className={`flex h-11 min-w-16 items-center justify-center rounded-lg px-3 text-lg font-bold shadow-sm transition-all ${bidChipTone(opt)} ${
              answered ? '' : 'cursor-pointer hover:brightness-105'
            } ${extra}`}
          >
            <BidChipContent bid={opt} />
          </button>
        )
      })}
    </div>
  )
}
