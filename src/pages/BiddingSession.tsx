import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Panel } from '../components/Panel'
import { Button } from '../components/Button'
import { HandView } from '../components/HandView'
import { AuctionView } from '../components/AuctionView'
import { BidOptions } from '../components/BidOptions'
import { getExercises, getTheme, resolveAuction, type ResolvedCall } from '../lib/bidding'
import { saveValue } from '../lib/storage'
import type { Bid } from '../types/bridge'

export function BiddingSession() {
  const { themeId = '' } = useParams()
  // key={themeId} ser till att vyn startar om från noll när man byter tema,
  // så att gammalt tillstånd (t.ex. en resultatsida) aldrig hänger med.
  return <Session key={themeId} themeId={themeId} />
}

function Session({ themeId }: { themeId: string }) {
  const theme = getTheme(themeId)
  const exercises = useMemo(() => getExercises(themeId), [themeId])

  const [exIndex, setExIndex] = useState(0)
  const [numAnswered, setNumAnswered] = useState(0)
  const [chosen, setChosen] = useState<Bid | null>(null)
  const [score, setScore] = useState({ correct: 0, total: 0 })
  const [finished, setFinished] = useState(false)

  if (!theme || exercises.length === 0) {
    return (
      <Panel>
        <p className="text-slate-600">Temat hittades inte.</p>
        <Link to="/budtraning" className="text-emerald-700 underline">
          Tillbaka till budträning
        </Link>
      </Panel>
    )
  }

  if (finished) {
    return (
      <div className="space-y-6">
        <Panel className="text-center">
          <h1 className="text-2xl font-bold mb-2">Klart! 🎉</h1>
          <p className="text-lg text-slate-700 mb-1">
            Du fick <b>{score.correct}</b> av <b>{score.total}</b> rätt
          </p>
          <p className="text-slate-500 mb-6">Temat: {theme.title}</p>
          <div className="flex flex-wrap gap-2 justify-center">
            <Button onClick={restart}>Träna igen</Button>
            <Link to="/budtraning">
              <Button variant="secondary">Till temalistan</Button>
            </Link>
          </div>
        </Panel>
      </div>
    )
  }

  const exercise = exercises[exIndex]
  const state = resolveAuction(exercise, numAnswered)
  const decision = state.current
  const answered = chosen !== null

  // Visa ditt valda bud direkt i budgivningstabellen när du svarat.
  const shownCalls: ResolvedCall[] =
    answered && decision
      ? [...state.resolved, { seat: exercise.yourSeat, bid: decision.answer }]
      : state.resolved

  const promptText = state.resolved.length === 0 ? 'Vad öppnar du med?' : 'Din tur – vad bjuder du?'

  function choose(bid: Bid) {
    if (chosen !== null || !decision) return
    setChosen(bid)
    setScore((s) => ({
      correct: s.correct + (bid === decision.answer ? 1 : 0),
      total: s.total + 1,
    }))
  }

  function next() {
    const afterThis = resolveAuction(exercise, numAnswered + 1)
    if (!afterThis.done) {
      // Fler beslut kvar i samma budgivning.
      setNumAnswered((n) => n + 1)
      setChosen(null)
      return
    }
    if (exIndex < exercises.length - 1) {
      // Nästa övning i temat.
      setExIndex((i) => i + 1)
      setNumAnswered(0)
      setChosen(null)
      return
    }
    // Hela temat klart – spara resultatet.
    saveValue(`theme:${themeId}`, score)
    setFinished(true)
  }

  function restart() {
    setExIndex(0)
    setNumAnswered(0)
    setChosen(null)
    setScore({ correct: 0, total: 0 })
    setFinished(false)
  }

  const isCorrect = answered && decision && chosen === decision.answer
  const moreInThisAuction = answered && !resolveAuction(exercise, numAnswered + 1).done
  const nextLabel = moreInThisAuction
    ? 'Fortsätt budgivningen'
    : exIndex < exercises.length - 1
      ? 'Nästa fråga'
      : 'Se resultat'

  return (
    <div className="space-y-6">
      <Panel>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">{theme.title}</h1>
            <p className="text-sm text-slate-500">
              Fråga {exIndex + 1} av {exercises.length}
            </p>
          </div>
          <Link to="/budtraning" className="text-sm text-emerald-700 underline shrink-0">
            Avbryt
          </Link>
        </div>
      </Panel>

      {shownCalls.length > 0 && (
        <Panel>
          <p className="text-sm text-slate-500 mb-3">Budgivningen hittills:</p>
          <AuctionView calls={shownCalls} dealer={exercise.dealer} />
        </Panel>
      )}

      <Panel>
        <p className="text-sm text-slate-500 mb-3">Din hand (Syd):</p>
        <HandView hand={exercise.yourHand} />
      </Panel>

      {decision && (
        <Panel>
          <p className="font-semibold text-slate-800 mb-3">{promptText}</p>
          <BidOptions
            options={decision.options}
            chosen={chosen}
            answer={decision.answer}
            onChoose={choose}
          />

          {answered && (
            <div className="mt-5">
              <div
                className={`rounded-xl p-4 ${
                  isCorrect ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-900'
                }`}
              >
                <p className="font-semibold mb-1">{isCorrect ? '✓ Rätt!' : '✗ Inte riktigt.'}</p>
                <p className="text-sm">{decision.explanation}</p>
              </div>
              <div className="mt-4">
                <Button onClick={next}>{nextLabel} →</Button>
              </div>
            </div>
          )}
        </Panel>
      )}
    </div>
  )
}
