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
  size?: 'sm' | 'smPlus' | 'md' | 'lg'
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

/** Den pekande handen (stickväntan, ägarbeslut 2026-09-14): tänds efter
 *  sweepHint när sticket väntar på DITT tryck och pulserar mjukt (CSS-klassen
 *  stick-hint). Ren illustration — hela stickytan är träffytan, så handen
 *  själv släpper igenom trycket. */
function StickHint() {
  return (
    <span aria-hidden className="stick-hint pointer-events-none absolute left-1/2 top-1/2 z-20 text-gold-200">
      <svg
        width="44"
        height="44"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.65))' }}
      >
        {/* Pekfingret + de tre böjda fingrarna och tummen */}
        <path d="M9 11.5V4.75a1.5 1.5 0 0 1 3 0V11" />
        <path d="M12 10.5a1.5 1.5 0 0 1 3 0V12" />
        <path d="M15 11.5a1.5 1.5 0 0 1 3 0V13" />
        <path d="M18 12.5a1.5 1.5 0 0 1 3 0V16a6 6 0 0 1-6 6h-2.2a6 6 0 0 1-4.9-2.5L4.1 15.4a1.6 1.6 0 0 1 2.5-2L9 16.2" />
        {/* Tryck-ringarna vid fingertoppen */}
        <path d="M6.6 3.6a4.9 4.9 0 0 1 7.8 0" opacity="0.7" />
        <path d="M5 2a7.5 7.5 0 0 1 11 0" opacity="0.4" />
      </svg>
    </span>
  )
}

/** Stickväntans ring (ägarens skiss 2026-09-14): när BOTEN leder nästa stick
 *  fylls en tunn guldring RUNT hela stickhögen, utanför väderstreckspillren,
 *  medurs från klockan tolv — exakt under bot-pausen (`holdMs`, inline så ring
 *  och JS-timer slutar samtidigt). Så förstår spelaren att bordet väntar med
 *  flit och hur länge. Ren illustration (pointer-events none); trycket på
 *  stickytan sveper som vanligt. Diametern 200 px kring den 160 px stora ytan:
 *  ~20 px utanför pillren, aldrig över kort eller pillren.
 *  Ringen tonar IN de första och UT de sista RING_FADE_MS av pausen (ägar-
 *  önskan: 0,5 s vardera, som DEL av tiden — inte ovanpå): två opacitets-
 *  animationer, ut-fasen fördröjd `ms − RING_FADE_MS`, båda inline ur samma tal. */
export const RING_FADE_MS = 500
function HoldRing({ ms }: { ms: number }) {
  const r = 98
  const c = 2 * Math.PI * r
  const fade = Math.min(RING_FADE_MS, Math.floor(ms / 2))
  return (
    <svg
      aria-hidden
      className="stick-ring pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      width="200"
      height="200"
      viewBox="0 0 200 200"
      style={{ animationDuration: `${fade}ms, ${fade}ms`, animationDelay: `0ms, ${ms - fade}ms` }}
    >
      <circle cx="100" cy="100" r={r} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="2" />
      <circle
        className="stick-ring-fill"
        cx="100"
        cy="100"
        r={r}
        fill="none"
        stroke="rgba(253, 230, 138, 0.75)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c}
        transform="rotate(-90 100 100)"
        style={{ animationDuration: `${ms}ms` }}
      />
    </svg>
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
    // Stickhögen (ägarbeslut 2026-08-02): korten överlappar 25 % → senare
    // spelat kort ligger ÖVER tidigare, precis som vid ett riktigt bord.
    const order = trick.findIndex((p) => p === pc)
    return (
      // key på KORTET (inte platsen): när ett nytt kort landar på samma plats i
      // nästa stick måste DOM-noden bytas, annars tänds inte inglidningen om.
      <div
        key={`${pc.card.suit}${pc.card.rank}`}
        data-flight-target={seat}
        className={`absolute ${pos} ${rotate} ${wasFlown(pc.card) ? '' : CARD_IN[seat]}`}
        style={flying ? { opacity: 0, transition: 'none', zIndex: order + 1 } : { zIndex: order + 1 }}
      >
        <PlayedCardView
          pc={pc}
          winner={winner === seat}
          canExplain={hasReason(pc)}
          onClick={() => onCardClick(pc)}
          glow={winner === seat}
          size="lg"
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
    // Klick var som helst på stickytan under svepet hoppar över det. Kompakt
    // stickHÖG (ägarbeslut 2026-08-02, ersätter det stora luftiga mittbordet):
    // ytan krympt 192 → 160 px och korten samlade i mitten så att grannkorten
    // överlappar varandra med 25 %. Fasta lg-kort (48×64, samma alla skärmar):
    // N/S centrerade ±24 px från mitten (topp-/bottenkant 24 px in → 16 px =
    // 25 % av 64 i N/S-överlapp), V/Ö vridna med boxvänsterkant 32 px in →
    // samma 25 % av den vridna bredden. Spelordningen styr z-index i card().
    <div
      className={`relative h-40 w-40 shrink-0 ${sweep && sweep.phase !== 'slide' ? 'cursor-pointer' : ''}`}
      onClick={sweep ? onSkipSweep : undefined}
      aria-label={sweep?.phase === 'vanta' ? 'Tryck för att gå vidare till nästa stick' : undefined}
    >
      <div className="absolute left-1/2 top-1/2 h-24 w-20 -translate-x-1/2 -translate-y-1/2 rounded-xl bg-emerald-950/50 ring-1 ring-emerald-100/10" />
      {sweep?.phase === 'vanta' && sweep.hint && <StickHint />}
      {sweep?.phase === 'hold' && sweep.holdMs !== undefined && <HoldRing ms={sweep.holdMs} />}
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
        {card('N', 'top-6 left-1/2 -translate-x-1/2')}
        {card('S', 'bottom-6 left-1/2 -translate-x-1/2')}
        {card('W', 'left-8 top-1/2 -translate-y-1/2', 'rotate-90')}
        {card('E', 'right-8 top-1/2 -translate-y-1/2', '-rotate-90')}
      </div>
    </div>
  )
}
