import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Panel } from '../components/Panel'
import { Button } from '../components/Button'
import { AuctionGrid } from '../components/AuctionGrid'
import { BidOptions } from '../components/BidOptions'
import { Felt } from '../components/Felt'
import { HandFan } from '../components/HandFan'
import { SuitText } from '../components/SuitText'
import { getExercises, getTheme, resolveAuction, type ResolvedCall } from '../lib/bidding'
import { hcp } from '../lib/engine/hand'
import { startingPoints } from '../lib/engine/evaluation'
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
        <p className="text-ink-soft">Temat hittades inte.</p>
        <Link to="/budtraning" className="text-accent underline">
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
          <p className="text-lg text-ink-soft mb-1">
            Du fick <b>{score.correct}</b> av <b>{score.total}</b> rätt
          </p>
          <p className="text-ink-muted mb-6">Temat: {theme.title}</p>
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

  const hp = hcp(exercise.yourHand)
  const tp = startingPoints(exercise.yourHand).startingPoints

  return (
    <div className="space-y-4">
      {/* Tunn sidhuvud-rad: tema, framsteg och avbryt. */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div>
          <h1 className="text-lg font-bold leading-tight">{theme.title}</h1>
          <p className="text-xs text-ink-muted">
            Fråga {exIndex + 1} av {exercises.length}
          </p>
        </div>
        <Link to="/budtraning" className="shrink-0 text-sm text-accent underline">
          Avbryt
        </Link>
      </div>

      {/* Grönt filt (Synrey): auktionen överst, frågan + budchips i mitten,
          din hand som solfjäder längst ner. */}
      <Felt>
        <div className="p-2.5">
          <AuctionGrid
            calls={shownCalls}
            dealer={exercise.dealer}
            vulnerability={exercise.vulnerability}
            activeSeat={!answered && decision ? exercise.yourSeat : null}
          />
        </div>

        {decision && (
          <div className="px-3 pb-4 pt-1">
            <p className="mb-2.5 text-center text-sm font-medium text-emerald-50">{promptText}</p>
            <BidOptions
              options={decision.options}
              chosen={chosen}
              answer={decision.answer}
              onChoose={choose}
            />

            {answered && (
              <div className="mx-auto mt-4 max-w-md rounded-xl bg-panel p-3 text-left shadow-xl ring-1 ring-line">
                <p className={`mb-1 font-semibold ${isCorrect ? 'text-emerald-700' : 'text-red-600'}`}>
                  {isCorrect ? '✓ Rätt!' : '✗ Inte riktigt.'}
                </p>
                <p className="text-sm text-ink-soft">
                  <SuitText>{decision.explanation}</SuitText>
                </p>
                <div className="mt-3">
                  <Button onClick={next}>{nextLabel} →</Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Din hand + HCP/TP-bricka (Synrey). */}
        <div className="relative border-t border-emerald-100/10 bg-emerald-950/25 px-2 pb-2.5 pt-3">
          <HandFan hand={exercise.yourHand} />
          <div className="absolute bottom-2 right-2 rounded-md bg-slate-900/80 px-2 py-0.5 text-xs font-semibold text-white">
            HCP {hp} · {tp} TP
          </div>
        </div>
      </Felt>
    </div>
  )
}
