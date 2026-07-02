import type { Card, Suit } from '../types/bridge'
import { SUIT_TEXT } from '../lib/suitColors'

const SYMBOL: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
}

type Size = 'sm' | 'md' | 'lg'

// Mått per storlek: [bredd, höjd, valör-text, mitt-symbol].
const SIZES: Record<Size, { box: string; rank: string; pip: string }> = {
  sm: { box: 'w-7 h-10 rounded', rank: 'text-[10px]', pip: 'text-sm' },
  md: { box: 'w-10 h-14 rounded-md', rank: 'text-xs', pip: 'text-xl' },
  lg: { box: 'w-12 h-16 rounded-md', rank: 'text-sm', pip: 'text-2xl' },
}

interface Props {
  /** Kortet som visas. Utelämnas (eller faceDown) → baksida. */
  card?: Card
  faceDown?: boolean
  size?: Size
  /** Får spelas just nu: grön ram + hover, klickbart. */
  playable?: boolean
  /** Spelbart kort men inte lagligt just nu: nedtonat. */
  dimmed?: boolean
  /**
   * Hörnindexen på ANDRA diagonalen (nere-vänster + uppe-höger i stället för
   * uppe-vänster + nere-höger). Behövs när ett vridet kort ska visa valören mot
   * bordets mitt (Östs sidostapel) – rotation ensam kan aldrig byta diagonal.
   */
  mirrorCorners?: boolean
  onClick?: () => void
  className?: string
}

/**
 * Ett spelkort som ser ut som ett riktigt kort: valör + färgsymbol i hörnet
 * och en stor symbol i mitten. Återanvänds i handen, träkarlen och mitten.
 * Med `faceDown` visas en baksida. Byggsten för hela bordet (Synrey-känsla).
 */
export function PlayingCard({
  card,
  faceDown = false,
  size = 'md',
  playable = false,
  dimmed = false,
  mirrorCorners = false,
  onClick,
  className = '',
}: Props) {
  const s = SIZES[size]
  const base = `${s.box} shrink-0 select-none border transition-all`

  if (faceDown || !card) {
    return (
      <div
        aria-hidden
        className={`${base} border-2 border-white bg-[#7b1f2c] ${className}`}
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, rgba(255,255,255,.14) 0 3px, transparent 3px 7px)',
        }}
      />
    )
  }

  // Fyrfärgslek: ♠ svart, ♥ röd, ♦ orange, ♣ grön.
  const ink = SUIT_TEXT[card.suit]
  const corner = (
    <div className={`flex flex-col items-center leading-none ${ink} ${s.rank} font-semibold`}>
      <span>{card.rank}</span>
      <span>{SYMBOL[card.suit]}</span>
    </div>
  )

  const inner = mirrorCorners ? (
    // Andra diagonalen OCH indexen 180-vridna: när kortet sedan roteras 90° blir
    // texten läsbar åt motsatt håll mot ett vanligt vridet kort (Öst speglar Väst).
    <>
      <div className="absolute bottom-0.5 left-0.5 rotate-180">{corner}</div>
      <div className={`${s.pip} ${ink} leading-none`}>{SYMBOL[card.suit]}</div>
      <div className="absolute top-0.5 right-0.5">{corner}</div>
    </>
  ) : (
    <>
      <div className="absolute top-0.5 left-0.5">{corner}</div>
      <div className={`${s.pip} ${ink} leading-none`}>{SYMBOL[card.suit]}</div>
      <div className="absolute bottom-0.5 right-0.5 rotate-180">{corner}</div>
    </>
  )

  const look = playable
    ? 'border-emerald-500 ring-2 ring-emerald-400 bg-white shadow-md z-0 hover:-translate-y-2 hover:z-20 cursor-pointer'
    : dimmed
      ? 'border-slate-200 bg-white opacity-50'
      : 'border-slate-300 bg-white shadow-sm'

  const cls = `${base} ${look} relative flex items-center justify-center ${className}`

  if (onClick && playable) {
    return (
      <button type="button" onClick={onClick} className={cls}>
        {inner}
      </button>
    )
  }
  return <div className={cls}>{inner}</div>
}
