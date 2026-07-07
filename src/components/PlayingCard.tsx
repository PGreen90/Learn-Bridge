import type { CSSProperties } from 'react'
import type { Card, Suit } from '../types/bridge'
import { SUIT_TEXT } from '../lib/suitColors'

const SYMBOL: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
}

type Size = 'sm' | 'smPlus' | 'md' | 'lg'

// Mått per storlek: [bredd, höjd, valör-text, mitt-symbol, ess-symbol].
// Esset får en större mittsymbol – som i en riktig kortlek.
// `md` (spelarens egen hand) är STÖRRE på mobil och krymper till sitt vanliga
// mått från `sm:`-brytpunkten (≥640 px) och uppåt – lättare att träffa på telefon
// (ägarbeslut 2026-07-07), oförändrad på desktop.
const SIZES: Record<Size, { box: string; rank: string; pip: string; acePip: string }> = {
  sm: { box: 'w-7 h-10 rounded', rank: 'text-[10px]', pip: 'text-sm', acePip: 'text-base' },
  // `smPlus` = träkarlen + sidostaplarna (Ö/V/N): större på mobil (som `md` på
  // desktop, 40×56) men krymper till vanligt `sm` (28×40) från `sm:` och uppåt.
  // Ägarbeslut 2026-07-07: dessa var för små att läsa på telefon.
  smPlus: {
    box: 'w-10 h-14 rounded-md sm:w-7 sm:h-10 sm:rounded',
    rank: 'text-xs sm:text-[10px]',
    pip: 'text-xl sm:text-sm',
    acePip: 'text-2xl sm:text-base',
  },
  md: {
    box: 'w-12 h-16 rounded-md sm:w-10 sm:h-14',
    rank: 'text-sm sm:text-xs',
    pip: 'text-2xl sm:text-xl',
    acePip: 'text-3xl sm:text-2xl',
  },
  lg: { box: 'w-12 h-16 rounded-md', rank: 'text-sm', pip: 'text-2xl', acePip: 'text-3xl' },
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
  /** Inline-stil, t.ex. animationDelay för utdelningskaskaden. */
  style?: CSSProperties
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
  style,
}: Props) {
  const s = SIZES[size]
  // Tunn 1px-ram runt varje kort → luftig separation mellan korten. Svart med
  // låg opacitet (läser som mjuk grå, inte hård linje).
  // Ägarbeslut 2026-07-06, ersätter det ramfria beslutet 2026-07-03.
  const base = `${s.box} shrink-0 select-none transition-all border border-black/20`

  if (faceDown || !card) {
    // RebidZ-baksidan: vit kortram, mörk smaragdpanel med guldram + rutmönster.
    return (
      <div
        aria-hidden
        className={`${base} relative bg-white shadow-sm ${className}`}
        style={style}
      >
        <div
          className="absolute inset-[3px] rounded-[3px] ring-1 ring-inset ring-gold-400/50"
          style={{
            background:
              'repeating-linear-gradient(45deg, rgba(255,255,255,.07) 0 2px, transparent 2px 6px), ' +
              'repeating-linear-gradient(-45deg, rgba(255,255,255,.07) 0 2px, transparent 2px 6px), ' +
              'linear-gradient(135deg, #047857 0%, #065f46 55%, #022c22 100%)',
          }}
        />
      </div>
    )
  }

  // Fyrfärgslek: ♠ svart, ♥ röd, ♦ orange, ♣ grön.
  const ink = SUIT_TEXT[card.suit]
  const pip = card.rank === 'A' ? s.acePip : s.pip
  const corner = (
    <div
      className={`flex flex-col items-center leading-none ${ink} ${s.rank} font-display font-bold`}
    >
      <span>{card.rank}</span>
      <span>{SYMBOL[card.suit]}</span>
    </div>
  )

  // ETT hörnindex per kort (det andra flöt ihop med mittsymbolen på små,
  // fullt synliga kort). Mittsymbolen knuffas en aning diagonalt BORT från
  // hörnet så de aldrig nuddar varandra.
  const inner = mirrorCorners ? (
    // Hörnet på andra diagonalen OCH 180-vridet: när kortet sedan roteras 90°
    // blir texten läsbar åt motsatt håll mot ett vanligt vridet kort (Öst
    // speglar Väst).
    <>
      <div className="absolute bottom-0.5 left-0.5 rotate-180">{corner}</div>
      <div className={`${pip} ${ink} leading-none translate-x-[2px] -translate-y-[2px]`}>
        {SYMBOL[card.suit]}
      </div>
    </>
  ) : (
    <>
      <div className="absolute top-0.5 left-0.5">{corner}</div>
      <div className={`${pip} ${ink} leading-none translate-x-[2px] translate-y-[2px]`}>
        {SYMBOL[card.suit]}
      </div>
    </>
  )

  // Framsidan: svag lodrät gradient (vit → ljusgrå) ger korten "papperskänsla".
  // Ramen sätts på `base` (tunn svart 1px); spelbarhet syns genom att ospelbara
  // kort tonas ner, inte genom en grön ring.
  const face = 'bg-gradient-to-b from-white to-slate-100'
  const look = playable
    ? `${face} shadow-md z-0 hover:-translate-y-2 hover:shadow-lg hover:z-20 cursor-pointer`
    : dimmed
      ? `${face} opacity-50`
      : `${face} shadow-sm`

  const cls = `${base} ${look} relative flex items-center justify-center ${className}`

  if (onClick && playable) {
    return (
      <button type="button" onClick={onClick} className={cls} style={style}>
        {inner}
      </button>
    )
  }
  return <div className={cls} style={style}>{inner}</div>
}
