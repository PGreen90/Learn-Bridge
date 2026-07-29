// Rondgenomgången (etapp 2): hela given förklarad i tre hopfällbara kapitel —
// Budgivningen, Spelföringen, Resultatet. All text kommer färdig ur motormodulen
// buildRondRapport (rond-rapport.ts); den här filen är bara presentation.
// DD-domen ("du borde ha tagit ett stick till") läggs till i etapp 3.

import { useMemo, useState, type ReactNode } from 'react'
import type { Deal, Seat } from '../../types/bridge'
import { SEAT_LABEL, type ResolvedCall } from '../../lib/bidding'
import type { Contract, PlayResult, Trick } from '../../lib/engine/play'
import type { ScoreLine } from '../../lib/engine/scoring'
import {
  buildRondRapport,
  type ResultatRad,
  type StickPunkt,
} from '../../lib/engine/rond-rapport'
import { BidChip } from '../../components/BidChip'
import { Button } from '../../components/Button'
import { PlayingCard } from '../../components/PlayingCard'
import { SuitText } from '../../components/SuitText'

/** Ett kapitel = en hopfällbar <details> i samma stil som Spela-sidans fördjupning. */
function Kapitel({
  rubrik,
  open = false,
  children,
}: {
  rubrik: string
  open?: boolean
  children: ReactNode
}) {
  return (
    <details open={open} className="group rounded-xl border border-line bg-panel shadow-sm">
      <summary className="flex cursor-pointer select-none list-none items-center justify-between px-4 py-3 text-sm font-semibold text-ink-soft [&::-webkit-details-marker]:hidden">
        <span>{rubrik}</span>
        <span className="text-ink-faint transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="border-t border-line px-4 pb-4 pt-3">{children}</div>
    </details>
  )
}

/** Ett stick som egen nästlad dropdown: rubrikrad + minikort + punkterna. */
function StickRad({ stick }: { stick: StickPunkt }) {
  // Tryck på ett kort med botmotivering visar den under korten (samma idé som
  // "tryck på spelat kort" på bordet). Samma kort igen stänger.
  const [visadNyckel, setVisadNyckel] = useState<string | null>(null)
  const visad = visadNyckel ? stick.botRadFor[visadNyckel] : undefined

  return (
    <details className="group/stick rounded-lg border border-line bg-panel-2">
      <summary className="flex cursor-pointer select-none list-none items-center justify-between px-3 py-2 text-sm text-ink [&::-webkit-details-marker]:hidden">
        <span>
          <SuitText>{stick.rubrik}</SuitText>
        </span>
        <span className="text-ink-faint transition-transform group-open/stick:rotate-180">▾</span>
      </summary>
      <div className="border-t border-line px-3 pb-3 pt-2">
        <div className="mb-2 flex gap-1.5">
          {stick.trick.cards.map((pc) => {
            const nyckel = `${pc.card.suit}${pc.card.rank}`
            const kort = (
              <PlayingCard
                card={pc.card}
                size="sm"
                className={pc.seat === stick.trick.winner ? 'ring-2 ring-amber-400' : ''}
              />
            )
            return stick.botRadFor[nyckel] ? (
              <button
                key={nyckel}
                type="button"
                className="cursor-pointer"
                onClick={() => setVisadNyckel((n) => (n === nyckel ? null : nyckel))}
                aria-label={`Varför ${pc.card.rank}?`}
              >
                {kort}
              </button>
            ) : (
              <span key={nyckel}>{kort}</span>
            )
          })}
        </div>
        {visad && (
          <p className="mb-2 rounded-lg bg-panel px-2 py-1 text-xs text-ink-soft">
            <SuitText>{visad}</SuitText>
          </p>
        )}
        <ul className="space-y-1">
          {stick.rader.map((rad, i) => (
            <li key={i} className="text-sm text-ink-soft">
              • <SuitText>{rad}</SuitText>
            </li>
          ))}
        </ul>
      </div>
    </details>
  )
}

const TON_KLASS: Record<ResultatRad['ton'], string> = {
  berom: 'font-medium text-accent',
  laxa: 'font-medium text-danger',
  neutral: 'text-ink-soft',
}

export function RondRapportView({
  deal,
  contract,
  calls,
  tricks,
  result,
  score,
  claimed,
  botReasons,
  onBack,
  onNewGame,
}: {
  deal: Deal
  contract: Contract
  calls: ResolvedCall[]
  tricks: Trick[]
  result: PlayResult
  score: ScoreLine | null
  claimed: { total: number; auto: boolean } | null
  botReasons: Record<string, { seat: Seat; reason: string }>
  onBack: () => void
  onNewGame: () => void
}) {
  const rapport = useMemo(
    () => buildRondRapport({ deal, contract, calls, tricks, result, score, claimed, botReasons }),
    [deal, contract, calls, tricks, result, score, claimed, botReasons],
  )

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-1">
        <h2 className="text-lg font-bold text-ink">Rondgenomgång</h2>
        <p className="text-sm text-ink-soft">
          {rapport.rubrik.brickText} · {rapport.rubrik.zonText} ·{' '}
          <SuitText>{rapport.rubrik.kontraktText}</SuitText>
        </p>
      </header>

      <Kapitel rubrik={`Budgivningen (${rapport.budgivning.length} bud)`}>
        <ol className="space-y-2">
          {rapport.budgivning.map((p, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className={`w-16 shrink-0 text-sm font-semibold ${p.du ? 'text-accent' : ''}`}>
                {SEAT_LABEL[p.seat]}
                {p.du ? ' (du)' : ''}
              </span>
              <span className="w-14 shrink-0">
                <BidChip bid={p.bid} />
              </span>
              <span className="text-sm text-ink-soft">
                {p.alert && (
                  <span className="mr-1.5 rounded bg-sky-600 px-1 text-[10px] font-bold text-white">
                    ALERT
                  </span>
                )}
                <SuitText>{p.text}</SuitText>
                {p.confidence !== 'säker' && (
                  <span className="text-ink-faint"> ({p.confidence} tolkning)</span>
                )}
              </span>
            </li>
          ))}
        </ol>
      </Kapitel>

      <Kapitel rubrik={`Spelföringen (${rapport.spelforing.length} stick)`}>
        <div className="space-y-2">
          {rapport.spelforing.map((stick) => (
            <StickRad key={stick.index} stick={stick} />
          ))}
          {claimed && (
            <p className="pt-1 text-xs text-ink-muted">
              Resten av sticken spelades aldrig — de bokfördes enligt claimen.
            </p>
          )}
        </div>
      </Kapitel>

      <Kapitel rubrik="Resultatet" open>
        <ul className="space-y-1.5">
          {rapport.resultat.map((rad, i) => (
            <li key={i} className={`text-sm ${TON_KLASS[rad.ton]}`}>
              • <SuitText>{rad.text}</SuitText>
            </li>
          ))}
        </ul>
      </Kapitel>

      <div className="flex justify-between pt-1">
        <Button variant="secondary" onClick={onBack}>
          ← Tillbaka
        </Button>
        <Button onClick={onNewGame}>Ny giv →</Button>
      </div>
    </div>
  )
}
