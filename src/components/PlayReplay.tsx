import { useState } from 'react'
import type { Card, Deal, Seat } from '../types/bridge'
import { SEAT_LABEL } from '../lib/bidding'
import type { Contract, Trick } from '../lib/engine/play'
import { bySuit, orderedSuits } from '../lib/cardLayout'
import { PlayingCard } from './PlayingCard'
import { Button } from './Button'

const key = (c: Card) => `${c.suit}${c.rank}`

/** För varje plats: en karta kort → vilket stick (0..12) kortet spelades i. */
function trickIndexBySeat(tricks: Trick[]): Record<Seat, Record<string, number>> {
  const out = { N: {}, E: {}, S: {}, W: {} } as Record<Seat, Record<string, number>>
  tricks.forEach((t, i) => {
    for (const pc of t.cards) out[pc.seat][key(pc.card)] = i
  })
  return out
}

/**
 * Omspelning av en färdigspelad giv: alla fyra händer ligger upplagda SORTERADE
 * I FÄRG (som vid bordet), och man stegar stick för stick. Kortet som spelades i
 * det aktuella sticket lyfts fram (gul ram). Mitten visar det aktuella sticket
 * placerat mot rätt väderstreck med vinnaren inramad.
 */
export function PlayReplay({
  deal,
  contract,
  tricks,
}: {
  deal: Deal
  contract: Contract
  tricks: Trick[]
}) {
  const [step, setStep] = useState(0)
  const last = tricks.length - 1
  const trickOf = trickIndexBySeat(tricks)
  const current = tricks[step]
  const cardAt = (seat: Seat) => current?.cards.find((c) => c.seat === seat)?.card

  const groupsFor = (seat: Seat) =>
    orderedSuits(seat, contract)
      .map((suit) => ({ suit, cards: bySuit(deal.hands[seat], suit) }))
      .filter((g) => g.cards.length > 0)

  // Ett kort i omspelningen. `here` = kortet spelades i det aktuella sticket
  // (gulmarkeras och lyfts överst). `z` styr stapelordningen i en intuckad rad.
  const replayCard = (seat: Seat, c: Card, overlap: string, z: number) => {
    const t = trickOf[seat][key(c)]
    const here = t === step
    return (
      <button
        key={key(c)}
        type="button"
        onClick={() => setStep(t)}
        title={`Stick ${t + 1}`}
        style={{ zIndex: here ? 50 : z }}
        className={`${overlap} transition-all`}
      >
        <PlayingCard card={c} size="sm" className={here ? 'relative ring-2 ring-amber-400' : ''} />
      </button>
    )
  }

  // Nord/Syd: färgerna som vågräta grupper bredvid varandra (höga kort vänster).
  function topBottomHand(seat: Seat) {
    return (
      <div className="flex items-end gap-1.5">
        {groupsFor(seat).map(({ suit, cards }) => (
          <div key={suit} className="flex">
            {cards.map((c, i) => replayCard(seat, c, i > 0 ? '-ml-5' : '', cards.length - i))}
          </div>
        ))}
      </div>
    )
  }

  // Väst/Öst (Fun Bridge): färgerna som vågräta rader STAPLADE på varandra. I varje
  // rad ligger det HÖGSTA kortet fullt synligt INÅT mot mitten (Öst: vänster, Väst:
  // höger), de lägre intuckade utåt. `innerLeft` = höga kort åt vänster (Öst).
  function sideHand(seat: Seat, innerLeft: boolean) {
    return (
      <div className={`flex flex-col gap-1 ${innerLeft ? 'items-start' : 'items-end'}`}>
        {groupsFor(seat).map(({ suit, cards }) => {
          // Öst: hög→låg (hög vänster). Väst: låg→hög (hög höger). Inre kortet överst.
          const ordered = innerLeft ? cards : [...cards].reverse()
          return (
            <div key={suit} className="flex">
              {ordered.map((c, i) =>
                replayCard(seat, c, i > 0 ? '-ml-4' : '', innerLeft ? ordered.length - i : i + 1),
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // Mitten: aktuellt stick mot rätt väderstreck, vinnaren inramad.
  const slot = (seat: Seat, pos: string) => {
    const c = cardAt(seat)
    return (
      <div className={`absolute ${pos}`}>
        {c && (
          <PlayingCard card={c} size="sm" className={current?.winner === seat ? 'ring-2 ring-amber-400' : ''} />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button variant="secondary" onClick={() => setStep(0)} disabled={step === 0}>
          ⏮
        </Button>
        <Button variant="secondary" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          ◀ Föregående
        </Button>
        <span className="min-w-28 text-center text-sm font-medium">
          Stick {step + 1} / {tricks.length}
          <span className="ml-2 text-slate-500">{SEAT_LABEL[current.winner]} vann</span>
        </span>
        <Button variant="secondary" onClick={() => setStep((s) => Math.min(last, s + 1))} disabled={step === last}>
          Nästa ▶
        </Button>
        <Button variant="secondary" onClick={() => setStep(last)} disabled={step === last}>
          ⏭
        </Button>
      </div>

      <div
        className="overflow-hidden rounded-3xl border border-emerald-950/30 px-4 py-5 shadow-inner"
        style={{ background: 'radial-gradient(circle at 50% 40%, #15795b 0%, #0f5e49 70%, #0b4a3a 100%)' }}
      >
        <div className="flex flex-col items-center gap-3">
          <ReplaySeatTag seat="N" contract={contract} />
          {topBottomHand('N')}
          <div className="flex w-full items-center justify-between gap-2">
            <div className="flex flex-col items-center gap-1">
              <ReplaySeatTag seat="W" contract={contract} />
              {sideHand('W', false)}
            </div>
            <div className="relative h-32 w-32 shrink-0 rounded-2xl bg-emerald-900/25 ring-1 ring-emerald-100/10">
              {slot('N', 'top-1 left-1/2 -translate-x-1/2')}
              {slot('S', 'bottom-1 left-1/2 -translate-x-1/2')}
              {slot('W', 'left-1 top-1/2 -translate-y-1/2')}
              {slot('E', 'right-1 top-1/2 -translate-y-1/2')}
            </div>
            <div className="flex flex-col items-center gap-1">
              <ReplaySeatTag seat="E" contract={contract} />
              {sideHand('E', true)}
            </div>
          </div>
          {topBottomHand('S')}
          <ReplaySeatTag seat="S" contract={contract} />
        </div>
      </div>
      <p className="text-center text-xs text-slate-500">
        Korten ligger sorterade i färg. Klicka ett kort eller använd knapparna för att stega
        genom sticken; det aktuella stickets kort är gulmarkerat. Bricka {deal.board}.
      </p>
    </div>
  )
}

function ReplaySeatTag({ seat, contract }: { seat: Seat; contract: Contract }) {
  const role = contract.declarer === seat ? 'spelförare' : ''
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-950/40 px-2.5 py-0.5 text-xs font-medium text-emerald-50">
      <span>{SEAT_LABEL[seat]}</span>
      {seat === 'S' && <span className="opacity-80">(du)</span>}
      {role && <span className="opacity-70">· {role}</span>}
    </div>
  )
}
