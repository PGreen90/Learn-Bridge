// Sticken på bordet: sticket i mitten (med ljuskäglan), förra sticket i
// miniatyr och det klickbara spelade kortet (botens motivering).

import type { Card, Seat } from '../../types/bridge'
import { SEAT_LABEL } from '../../lib/bidding'
import { isComplete, type PlayedCard, type PlayState, type Trick } from '../../lib/engine/play'
import { PlayingCard } from '../../components/PlayingCard'
import { CARD_IN, sameCard, SWEEP_OUT, type Sweep } from './common'
import type { Flight } from './useCardFlight'

/** Ett spelat kort på bordet: klickbart när boten har en motivering —
 *  trycket visar förklaringen i raden under listen. `glow` = vinnarkortet
 *  pulserar under sticksvepets paus (etapp 2). `size` = 'md' på det stora
 *  mittbordet (Synrey-känsla, 2026-07-31), 'sm' i "Förra sticket"-miniatyren. */
export function PlayedCardView({
  pc,
  winner,
  canExplain,
  onClick,
  glow = false,
  size = 'sm',
}: {
  pc: PlayedCard
  winner: boolean
  canExplain: boolean
  onClick: () => void
  glow?: boolean
  size?: 'sm' | 'smPlus' | 'md'
}) {
  const face = (
    <PlayingCard
      card={pc.card}
      size={size}
      className={`${winner ? 'ring-2 ring-amber-400' : ''} ${glow ? 'winner-glow' : ''}`}
    />
  )
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
 *  bot-hjärnan räknar). Ett färdigt stick ligger kvar med vinnarglow under
 *  svepets paus och sveps sedan mot vinnarens sida (etapp 2); klick på
 *  stickytan hoppar över svepet. Bottarnas kort är klickbara → förklaring. */
export function TrickCenterLive({
  play,
  thinking,
  sweep,
  flight = null,
  wasFlown = () => false,
  onSkipSweep,
  onCardClick,
  hasReason,
}: {
  play: PlayState
  thinking: boolean
  sweep: Sweep | null
  /** Kortet som är i luften just nu (etapp 3) — dess plats i sticket hålls dold
   *  tills klonen i FlightLayer landat. */
  flight?: Flight | null
  /** Har kortet flugit hit? Då ska det INTE få card-in-glidningen ovanpå. */
  wasFlown?: (card: Card) => boolean
  onSkipSweep: () => void
  onCardClick: (pc: PlayedCard) => void
  hasReason: (pc: PlayedCard) => boolean
}) {
  // Under svepet visas det just avslutade sticket; annars det pågående.
  // (Gamla "förra sticket ligger kvar tills nästa kort"-fallbacken är borta —
  // historiken bor i Förra sticket-panelen i hörnet.)
  const trick: PlayedCard[] = sweep ? sweep.trick.cards : play.currentTrick
  const winner = sweep?.trick.winner
  const at = (seat: Seat) => trick.find((pc) => pc.seat === seat)
  const toAct = isComplete(play) ? null : play.toAct

  const card = (seat: Seat, pos: string, rotate = '') => {
    const pc = at(seat)
    if (!pc) return null
    // Är just detta kort i luften? Wrappern (INTE kortets egen klass —
    // PlayingCards transition-all skulle annars tona fram det) hålls osynlig
    // tills klonen landat; data-flight-target är klonens landningsplats.
    const flying = flight !== null && sameCard(flight.card, pc.card)
    return (
      // key på KORTET (inte platsen): när ett nytt kort landar på samma plats i
      // nästa stick måste DOM-noden bytas, annars tänds inte inglidningen om.
      <div
        key={`${pc.card.suit}${pc.card.rank}`}
        data-flight-target={seat}
        className={`absolute ${pos} ${rotate} ${wasFlown(pc.card) ? '' : CARD_IN[seat]}`}
        style={flying ? { opacity: 0, transition: 'none' } : undefined}
      >
        <PlayedCardView
          pc={pc}
          winner={winner === seat}
          canExplain={hasReason(pc)}
          onClick={() => onCardClick(pc)}
          glow={winner === seat}
          size="smPlus"
        />
      </div>
    )
  }
  // Platsetikett som färgpiller (Synrey-känsla, 2026-07-31): S guld (du), N grön
  // (partner), V/Ö mörka (motståndare). Turljuskäglan lyser kvar bakom den aktiva
  // platsen (den som ska spela); pillret får en gul ring när det är dess tur.
  const seatPill = (seat: Seat, label: string, pos: string) => {
    const active = toAct === seat
    const role =
      seat === 'S'
        ? 'bg-gold-400 text-emerald-950'
        : seat === 'N'
          ? 'bg-emerald-600 text-white'
          : 'bg-emerald-950/80 text-emerald-100 ring-1 ring-emerald-100/15'
    return (
      <span
        className={`absolute ${pos} flex items-center justify-center`}
        title={active ? (thinking ? 'Bot-hjärnan räknar …' : 'Ska spela') : undefined}
      >
        {/* Ljuskäglan: vitt radiellt ljus som tonar ut mot kanterna. mix-blend-mode
            screen ljusar bara UPP det som ligger under — färgerna ändras inte. */}
        <span
          aria-hidden
          className={`pointer-events-none absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full transition-opacity duration-700 ${
            active ? (thinking ? 'animate-pulse' : 'opacity-100') : 'opacity-0'
          }`}
          style={{
            background:
              'radial-gradient(closest-side, rgba(255,255,255,0.34), rgba(255,255,255,0.12) 55%, transparent 78%)',
            mixBlendMode: 'screen',
          }}
        />
        <span
          className={`relative rounded-full px-2 py-0.5 text-xs font-bold shadow ${role} ${
            active ? 'ring-2 ring-yellow-300' : ''
          }`}
        >
          {label}
        </span>
      </span>
    )
  }

  return (
    // Klick var som helst på stickytan under svepet hoppar över det. Större
    // mittbord (Synrey-känsla, 2026-07-31) så korten landar stort och luftigt.
    <div className="relative h-48 w-48 shrink-0" onClick={sweep ? onSkipSweep : undefined}>
      <div className="absolute left-1/2 top-1/2 h-24 w-20 -translate-x-1/2 -translate-y-1/2 rounded-xl bg-emerald-950/50 ring-1 ring-emerald-100/10" />
      {seatPill('N', 'N', 'top-1 left-1/2 -translate-x-1/2')}
      {seatPill('S', 'S', 'bottom-1 left-1/2 -translate-x-1/2')}
      {seatPill('W', 'V', 'left-0 top-1/2 -translate-y-1/2')}
      {seatPill('E', 'Ö', 'right-0 top-1/2 -translate-y-1/2')}
      {/* Korten i en egen grupp: under 'slide' får hela gruppen svep-klassen
          och alla fyra glider ihop mot vinnarens sida medan de tonar ut. */}
      <div
        className={`absolute inset-0 ${
          sweep?.phase === 'slide' && winner ? SWEEP_OUT[winner] : ''
        }`}
      >
        {card('N', 'top-4 left-1/2 -translate-x-1/2')}
        {card('S', 'bottom-4 left-1/2 -translate-x-1/2')}
        {card('W', 'left-3 top-1/2 -translate-y-1/2', 'rotate-90')}
        {card('E', 'right-3 top-1/2 -translate-y-1/2', '-rotate-90')}
      </div>
    </div>
  )
}
