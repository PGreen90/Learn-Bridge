// Budlådan i Synrey-stil (FAS 12): rutnät med kolumnerna 1NT/1♠/1♥/1♦/1♣ och
// raderna 1–7, färgkodade chips (NT lila, ♠ svart, ♥ röd, ♦ orange, ♣ grön) och
// nedersta raden X / XX / PASS / OK. Ett klick VÄLJER budet (chipet lyfts med
// guldring), OK bekräftar. Betydelse-raden visas UNDER X/XX/PASS/OK-raden
// (ägarbeslut 2026-08-02) så knapparna aldrig flyttar sig. Otillåtna bud tonas ner.
//
// Motorns rekommenderade bud markeras med en liten grön prick och får sin äkta
// förklaring; egna bud tolkas ur auktionen (tolkande lagret) så raden aldrig är tom.

import { useEffect, useState } from 'react'
import type { Bid } from '../types/bridge'
import type { ResolvedCall } from '../lib/bidding'
import { isAlertRule } from '../lib/engine/alerts'
import { interpretCall } from '../lib/engine/auction-interpret'
import { BidChip, bidChipTone, BidChipContent } from './BidChip'
import { SuitText } from './SuitText'

const LEVELS = [1, 2, 3, 4, 5, 6, 7]
// Kolumnordning som i Synrey: NT längst till vänster, sedan ♠ ♥ ♦ ♣ (fallande).
const STRAINS = ['NT', 'S', 'H', 'D', 'C'] as const

function BoxChip({
  bid,
  ok,
  selected,
  recommended,
  onClick,
}: {
  bid: Bid
  ok: boolean
  selected: boolean
  recommended: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={!ok}
      onClick={onClick}
      className={`relative flex h-12 items-center justify-center rounded-lg text-lg font-bold shadow-sm transition-all active:scale-95 ${bidChipTone(bid)} ${
        /* Valt bud: guldring + startsidans roterande guldbåge (gold-frame,
           6 s/varv — ägarbeslut 2026-08-02: samma "levande guld" som hero-korten).
           Ringen ligger INUTI knappen (ring-inset, ägarbeslut 2026-08-02: chipet
           får inte växa när det är valt) — samma 2 px-band som bågen löper i.
           Respekterar "minskad rörelse" via samma CSS som startsidan. */
        selected ? 'ring-2 ring-inset ring-gold-400 brightness-105 gold-frame' : ''
      } disabled:opacity-25 disabled:shadow-none ${ok ? 'cursor-pointer hover:brightness-105' : ''}`}
    >
      {recommended && !selected && (
        <span
          className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-emerald-600 ring-1 ring-white"
          title="Motorns rekommenderade bud"
        />
      )}
      <BidChipContent bid={bid} />
    </button>
  )
}

export function BiddingBox({
  legal,
  onBid,
  recommendation = null,
  history = [],
  showHelp = true,
}: {
  legal: Bid[]
  onBid: (bid: Bid) => void
  /** Motorns rekommenderade bud (markeras + får äkta förklaring). */
  recommendation?: ResolvedCall | null
  /** Budföljden så här långt – så även egna bud kan tolkas (alltid en förklaring). */
  history?: ResolvedCall[]
  /** Budstöd av (false) döljer ALL hjälp: pricken, förklaringen och "Motorn hade valt". */
  showHelp?: boolean
}) {
  const allowed = new Set(legal)
  const [selected, setSelected] = useState<Bid | null>(null)
  // Tangentbordets halvskrivna bud: en tryckt siffra (1–7) som väntar på sin
  // färgbokstav (tangentbordsstyrningen, fynd #21 i granskningen).
  const [pendingLevel, setPendingLevel] = useState<number | null>(null)
  // Nollställ valet när auktionen ändras (2026-08-02): utan detta överlever ett
  // markerat bud in i NÄSTA giv, och eftersom två tryck på samma bud = OK kunde
  // ett gammalt val råka bjudas med ett enda tryck. Under motståndarnas bud kan
  // inget väljas (legal är tom), så i praktiken slår detta bara vid ny giv.
  useEffect(() => {
    setSelected(null)
    setPendingLevel(null)
  }, [history.length])
  const recBid =
    showHelp && recommendation && allowed.has(recommendation.bid) ? recommendation.bid : null

  const choose = (bid: Bid) => {
    if (!allowed.has(bid)) return
    // Två tryck = OK (ägarbeslut): första trycket väljer budet (markerar + visar
    // betydelsen), andra trycket på SAMMA bud bekräftar det direkt. Inget
    // tidsintervall som ett dubbelklick – bara samma bud igen. Ett annat bud
    // byter val i stället, och OK-knappen fungerar precis som förr.
    if (selected === bid) {
      onBid(bid)
      setSelected(null)
    } else {
      setSelected(bid)
    }
  }
  const confirm = () => {
    if (selected) {
      onBid(selected)
      setSelected(null)
    }
  }

  // Tangentbordsstyrning på dator (granskningsputsen 2026-08-03, fynd #21:
  // "tangentbord på desktop saknas helt"): siffran väljer nivån, bokstaven
  // färgen — N = sang, S = spader, H = hjärter, R/D = ruter, K/C = klöver;
  // P = pass, X = dubbelt/redubbelt, Enter = OK, Esc rensar valet. Samma
  // två-stegsflöde som klicken: budet markeras och förklaras först, Enter
  // (eller samma bud igen) bekräftar. Registreras utan deps-lista med flit —
  // billigt, och lyssnaren läser alltid färskt state (inga inaktuella stängningar).
  useEffect(() => {
    if (legal.length === 0) return // inte din tur — inga tangenter
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return // skriv i fred
      const k = e.key.toLowerCase()
      if (/^[1-7]$/.test(k)) {
        setPendingLevel(Number(k))
        return
      }
      const strain =
        k === 'n' ? 'NT'
        : k === 's' ? 'S'
        : k === 'h' ? 'H'
        : k === 'r' || k === 'd' ? 'D'
        : k === 'k' || k === 'c' ? 'C'
        : null
      if (strain !== null && pendingLevel !== null) {
        choose(`${pendingLevel}${strain}`)
        return
      }
      if (k === 'p') {
        choose('P')
        return
      }
      if (k === 'x') {
        choose(allowed.has('X') ? 'X' : 'XX')
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault() // stoppa fokuserad knapps egna Enter-klick (dubbelbud)
        confirm()
        return
      }
      if (e.key === 'Escape') {
        setSelected(null)
        setPendingLevel(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const isRec = selected !== null && selected === recBid
  // Egna bud (ej motorns rekommendation) tolkas ur auktionen – aldrig tomt.
  const selInterp =
    selected !== null && !isRec ? interpretCall([...history, { seat: 'S', bid: selected }], history.length) : null
  const selExpl = isRec
    ? recommendation?.explanation ?? 'Motorns rekommenderade bud.'
    : selInterp
      ? `${selInterp.text}${selInterp.confidence === 'gissning' ? ' (osäker tolkning)' : ''}`
      : ''
  const selAlert = isRec ? isAlertRule(recommendation?.rule) : false

  return (
    <div className="mx-auto w-full max-w-md space-y-1">
      {/* gap-1 (ägarbeslut 2026-08-02): tätt mellanrum funkar igen eftersom
          guldringen numera ligger INUTI knappen (ring-inset) och inget växer
          eller lyfts vid val — inget går in på grannknapparna. */}
      <div className="grid grid-cols-5 gap-1">
        {LEVELS.map((level) =>
          STRAINS.map((code) => {
            const bid = `${level}${code}`
            return (
              <BoxChip
                key={bid}
                bid={bid}
                ok={allowed.has(bid)}
                selected={selected === bid}
                recommended={bid === recBid}
                onClick={() => choose(bid)}
              />
            )
          }),
        )}
      </div>

      <div className="grid grid-cols-4 gap-1">
        <BoxChip bid="X" ok={allowed.has('X')} selected={selected === 'X'} recommended={recBid === 'X'} onClick={() => choose('X')} />
        <BoxChip bid="XX" ok={allowed.has('XX')} selected={selected === 'XX'} recommended={recBid === 'XX'} onClick={() => choose('XX')} />
        <BoxChip bid="P" ok={allowed.has('P')} selected={selected === 'P'} recommended={recBid === 'P'} onClick={() => choose('P')} />
        <button
          type="button"
          disabled={!selected}
          onClick={confirm}
          className="flex h-12 items-center justify-center rounded-lg bg-sky-500 text-lg font-bold text-white shadow-sm transition-all hover:bg-sky-400 active:scale-95 disabled:opacity-30 disabled:shadow-none"
        >
          OK
        </button>
      </div>

      {/* Betydelse-raden UNDER knapparna (ägarbeslut 2026-08-02): kort och
          diskret, bara när ett bud är valt (och budstödet är på). "Motorn hade
          valt" (R3-fynd #3) ligger i SAMMA stycke — en rad mindre, så handen
          inte knuffas under skärmkanten på mobil. Facit-tvång är det inte:
          du ser motorns val men bjuder som du vill. */}
      {showHelp && selected && (
        <p className="px-1 text-xs leading-snug text-emerald-50/90">
          {isRec && <span className="mr-1 rounded bg-emerald-600 px-1 text-[10px] font-bold text-white">MOTORNS BUD</span>}
          {selAlert && <span className="mr-1 rounded bg-sky-600 px-1 text-[10px] font-bold text-white">ALERT</span>}
          <SuitText>{selExpl}</SuitText>
          {recBid && selected !== recBid && (
            <>
              {' '}
              <span className="text-emerald-50/70">— Motorn hade valt</span>{' '}
              <BidChip bid={recBid} className="scale-90" />
            </>
          )}
        </p>
      )}
    </div>
  )
}
