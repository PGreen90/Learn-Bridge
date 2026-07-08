// Sticken på bordet: sticket i mitten (med ljuskäglan), förra sticket i
// miniatyr och det klickbara spelade kortet (botens motivering).

import type { Seat } from '../../types/bridge'
import { SEAT_LABEL } from '../../lib/bidding'
import { isComplete, type PlayedCard, type PlayState, type Trick } from '../../lib/engine/play'
import { PlayingCard } from '../../components/PlayingCard'
import { CARD_IN } from './common'

/** Ett spelat kort på bordet: klickbart när boten har en motivering —
 *  trycket visar förklaringen i raden under listen. */
export function PlayedCardView({
  pc,
  winner,
  canExplain,
  onClick,
}: {
  pc: PlayedCard
  winner: boolean
  canExplain: boolean
  onClick: () => void
}) {
  const face = <PlayingCard card={pc.card} size="sm" className={winner ? 'ring-2 ring-amber-400' : ''} />
  if (!canExplain) return face
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer"
      aria-label={`Varför spelade ${SEAT_LABEL[pc.seat]} det här kortet?`}
    >
      {face}
    </button>
  )
}

/** Förra (senast färdigspelade) sticket i miniatyr uppe i hörnet (ägarönskemål
 *  2026-07-03): korten i kompassläge, vinnarkortet gulmarkerat. Bottarnas kort
 *  är klickbara → samma förklaringsrad som sticket i mitten. */
export function LastTrickPanel({
  trick,
  onCardClick,
  hasReason,
}: {
  trick: Trick
  onCardClick: (pc: PlayedCard) => void
  hasReason: (pc: PlayedCard) => boolean
}) {
  const at = (seat: Seat) => trick.cards.find((pc) => pc.seat === seat)
  const card = (seat: Seat, pos: string, rotate = '') => {
    const pc = at(seat)
    if (!pc) return null
    return (
      <div className={`absolute ${pos} ${rotate}`}>
        <PlayedCardView
          pc={pc}
          winner={trick.winner === seat}
          canExplain={hasReason(pc)}
          onClick={() => onCardClick(pc)}
        />
      </div>
    )
  }
  return (
    <div className="rounded-xl bg-emerald-950/45 px-1.5 pb-1.5 pt-0.5 ring-1 ring-emerald-100/10">
      <div className="pb-0.5 text-center text-[10px] font-medium text-emerald-50/70">Förra sticket</div>
      <div className="relative h-32 w-26">
        {card('N', 'top-0 left-1/2 -translate-x-1/2')}
        {card('S', 'bottom-0 left-1/2 -translate-x-1/2')}
        {card('W', 'left-0 top-1/2 -translate-y-1/2', 'rotate-90')}
        {card('E', 'right-0 top-1/2 -translate-y-1/2', '-rotate-90')}
      </div>
    </div>
  )
}

/** Sticket i mitten (live): mörk platta, väderstrecken runt om — en mjuk
 *  ljuskägla (spotlight) lyser upp platsen som är i tur (pulserar när
 *  bot-hjärnan räknar). Mellan sticken ligger det senast vunna sticket kvar
 *  med vinnarkortet gulmarkerat; bottarnas kort är klickbara → förklaring. */
export function TrickCenterLive({
  play,
  thinking,
  onCardClick,
  hasReason,
}: {
  play: PlayState
  thinking: boolean
  onCardClick: (pc: PlayedCard) => void
  hasReason: (pc: PlayedCard) => boolean
}) {
  const last =
    play.completedTricks.length > 0 ? play.completedTricks[play.completedTricks.length - 1] : undefined
  const trick: PlayedCard[] = play.currentTrick.length > 0 ? play.currentTrick : last?.cards ?? []
  const winner = play.currentTrick.length === 0 ? last?.winner : undefined
  const at = (seat: Seat) => trick.find((pc) => pc.seat === seat)
  const toAct = isComplete(play) ? null : play.toAct

  const card = (seat: Seat, pos: string, rotate = '') => {
    const pc = at(seat)
    if (!pc) return null
    return (
      <div className={`absolute ${pos} ${rotate} ${CARD_IN[seat]}`}>
        <PlayedCardView
          pc={pc}
          winner={winner === seat}
          canExplain={hasReason(pc)}
          onClick={() => onCardClick(pc)}
        />
      </div>
    )
  }
  const letter = (seat: Seat, label: string, pos: string) => {
    const active = toAct === seat
    return (
      <span
        className={`absolute ${pos} flex items-center justify-center text-sm font-semibold text-yellow-300`}
        title={active ? (thinking ? 'Bot-hjärnan räknar …' : 'Ska spela') : undefined}
      >
        {/* Ljuskäglan: vitt radiellt ljus som tonar ut mot kanterna. mix-blend-mode
            screen ljusar bara UPP det som ligger under — färgerna ändras inte. */}
        <span
          aria-hidden
          className={`pointer-events-none absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full transition-opacity duration-700 ${
            active ? (thinking ? 'animate-pulse' : 'opacity-100') : 'opacity-0'
          }`}
          style={{
            background:
              'radial-gradient(closest-side, rgba(255,255,255,0.34), rgba(255,255,255,0.12) 55%, transparent 78%)',
            mixBlendMode: 'screen',
          }}
        />
        <span className="relative">{label}</span>
      </span>
    )
  }

  return (
    <div className="relative h-44 w-40 shrink-0">
      <div className="absolute left-1/2 top-1/2 h-24 w-20 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-emerald-950/50 ring-1 ring-emerald-100/10" />
      {letter('N', 'N', 'top-4 left-1/2 -translate-x-1/2')}
      {letter('S', 'S', 'bottom-4 left-1/2 -translate-x-1/2')}
      {letter('W', 'V', 'left-4 top-1/2 -translate-y-1/2')}
      {letter('E', 'Ö', 'right-4 top-1/2 -translate-y-1/2')}
      {card('N', 'top-0 left-1/2 -translate-x-1/2')}
      {card('S', 'bottom-0 left-1/2 -translate-x-1/2')}
      {card('W', 'left-0 top-1/2 -translate-y-1/2', 'rotate-90')}
      {card('E', 'right-0 top-1/2 -translate-y-1/2', '-rotate-90')}
    </div>
  )
}
