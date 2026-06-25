import { Panel } from '../components/Panel'
import { Button } from '../components/Button'
import { HandView } from '../components/HandView'
import type { Hand } from '../types/bridge'

// Tillfällig exempelhand bara för att visa designen.
// Riktiga givar kommer från en JSON-datafil senare.
const SAMPLE_HAND: Hand = [
  { suit: 'spades', rank: 'A' }, { suit: 'spades', rank: 'K' }, { suit: 'spades', rank: '5' },
  { suit: 'hearts', rank: 'Q' }, { suit: 'hearts', rank: 'J' }, { suit: 'hearts', rank: '4' },
  { suit: 'diamonds', rank: 'A' }, { suit: 'diamonds', rank: '9' }, { suit: 'diamonds', rank: '3' },
  { suit: 'clubs', rank: 'K' }, { suit: 'clubs', rank: '7' }, { suit: 'clubs', rank: '6' }, { suit: 'clubs', rank: '2' },
]

const SAMPLE_OPTIONS = ['Pass', '1♣', '1♦', '1NT']

export function BiddingPractice() {
  return (
    <div className="space-y-6">
      <Panel>
        <h1 className="text-2xl font-bold mb-1">Budträning</h1>
        <p className="text-slate-600">Du sitter som öppnare. Vad öppnar du med?</p>
      </Panel>

      <Panel>
        <p className="text-sm text-slate-500 mb-3">Din hand:</p>
        <HandView hand={SAMPLE_HAND} />
      </Panel>

      <Panel>
        <p className="text-sm text-slate-500 mb-3">Välj ditt bud:</p>
        <div className="flex flex-wrap gap-2">
          {SAMPLE_OPTIONS.map((opt) => (
            <Button key={opt} variant="secondary" disabled>
              {opt}
            </Button>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-4">
          ⚙️ Det här är bara en förhandstitt på utseendet. Knapparna kopplas in
          när vi bygger själva budträningen.
        </p>
      </Panel>
    </div>
  )
}
