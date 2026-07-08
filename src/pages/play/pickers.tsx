// Kontraktväljaren: menyn där ägaren väljer ett träningsmål + sök-overlayen.

import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { describeTarget, type ContractTarget } from '../../lib/engine/contract-target'

// Scenariokorten (ordning = menyn). `hint` är den korta undertexten.
const SCENARIOS: { target: ContractTarget; hint: string }[] = [
  { target: 'random', hint: 'Vad som helst, som vanligt.' },
  { target: 'major-game', hint: 'Bjud fram 4♥ eller 4♠.' },
  { target: 'minor-game', hint: 'Bjud fram 5♣ eller 5♦.' },
  { target: 'nt-game', hint: 'Bjud fram 3NT.' },
  { target: 'small-slam', hint: 'Utred och nå 6-läget.' },
  { target: 'grand-slam', hint: 'Nå 7-läget (ovanligt – tar en stund att hitta).' },
  { target: 'competitive', hint: 'Motståndarna lägger sig i budgivningen.' },
]

/** Modal där ägaren väljer träningsmål. Klick på ett kort → sök + ny giv. */
export function ScenarioPicker({
  current,
  onPick,
  onClose,
}: {
  current: ContractTarget
  onPick: (t: ContractTarget) => void
  onClose: () => void
}) {
  return (
    <Dialog onClose={onClose} className="w-full max-w-md p-4">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">Vad vill du träna på?</h2>
          <button type="button" onClick={onClose} className="text-ink-faint hover:text-ink" aria-label="Stäng">
            ✕
          </button>
        </div>
        <p className="mb-3 text-xs text-ink-muted">
          Appen letar fram en giv där ni med god budgivning ska nå målet. Sen budar du själv.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {SCENARIOS.map(({ target, hint }) => {
            const selected = target === current
            return (
              <button
                key={target}
                type="button"
                onClick={() => onPick(target)}
                className={`rounded-xl border p-2.5 text-left transition ${
                  selected
                    ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-400'
                    : 'border-line bg-panel hover:border-line-strong hover:bg-panel-2'
                }`}
              >
                <div className="text-sm font-semibold text-ink">{describeTarget(target)}</div>
                <div className="mt-0.5 text-[11px] leading-snug text-ink-muted">{hint}</div>
              </button>
            )
          })}
        </div>
    </Dialog>
  )
}

/** Overlay medan sökaren letar (eller gav upp). */
export function SearchOverlay({
  tried,
  gaveUp,
  label,
  onCancel,
  onRetry,
  onRandom,
}: {
  tried: number
  gaveUp: boolean
  label: string
  onCancel: () => void
  onRetry: () => void
  onRandom: () => void
}) {
  return (
    <Dialog className="w-full max-w-xs p-5 text-center">
        {gaveUp ? (
          <>
            <p className="mb-1 text-sm font-semibold text-ink">Hittade ingen sådan giv</p>
            <p className="mb-4 text-xs text-ink-muted">
              {label} är ovanligt och dök inte upp bland {tried.toLocaleString('sv-SE')} givar. Försök igen
              eller ta en slumpad giv.
            </p>
            <div className="flex justify-center gap-2">
              <Button variant="secondary" onClick={onRandom}>
                Slumpad giv
              </Button>
              <Button onClick={onRetry}>Försök igen →</Button>
            </div>
          </>
        ) : (
          <>
            <p className="mb-1 text-sm font-semibold text-ink">Söker en giv …</p>
            <p className="mb-4 text-xs text-ink-muted">
              {label} · {tried.toLocaleString('sv-SE')} givar prövade
            </p>
            <Button variant="secondary" onClick={onCancel}>
              Avbryt
            </Button>
          </>
        )}
    </Dialog>
  )
}
