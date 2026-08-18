// Beslut B etapp 4 (4B) — spelvyn vid vänner-bordet: bud → spel → giv-klar →
// slutresultat, allt på den vinröda duken.
//
// Ren presentation ovanpå useBordSpel (synk/kö) och bord-projektion (läget).
// Allt ritas i den VISUELLA världen — du sitter alltid Syd — och komponenterna
// är spelbordets egna (AuctionGrid, BiddingBox, HandFan, SouthFan, SuitColumns,
// SideDummyPiles, FaceDownFan, TrickCenterLive). Träkarlen du styr hamnar
// alltid visuellt i Nord (spelförarens partner), så den klickbara vägen genom
// SuitColumns räcker; en träkarl hos motståndarna ligger på sidorna
// (SideDummyPiles, oklickbar — helt rätt, den är inte din).
//
// Inte i 4B (medvetet): claim/ångra (kräver motpartsgodkännande — SENARE),
// kortflygningen och ljuden (polish när bordet bevisat sig).

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Card, Deal, Seat } from '../../types/bridge'
import { SEAT_LABEL } from '../../lib/bidding'
import { legalCalls } from '../../lib/engine/auction-live'
import { hcp } from '../../lib/engine/hand'
import { legalCards, side, type PlayState } from '../../lib/engine/play'
import { AuctionGrid } from '../../components/AuctionGrid'
import { BidChip } from '../../components/BidChip'
import { BiddingBox } from '../../components/BiddingBox'
import { Button } from '../../components/Button'
import { CompassPanel } from '../../components/CompassPanel'
import { ClickAway, Dialog } from '../../components/Dialog'
import { Felt } from '../../components/Felt'
import { FelrapportDialog } from '../../components/FelrapportDialog'
import { HandFan } from '../../components/HandFan'
import { PlayingCard } from '../../components/PlayingCard'
import { SideDummyPiles, SouthFan, SuitColumns } from '../play/hands'
import { LastTrickPanel, TrickCenterLive } from '../play/trick-views'
import { MenuTempoRow, MenuToggleRow, sameCard, STRAIN_CODE, VUL_TEXT } from '../play/common'
import { ms, type PlaySpeed } from '../play/tempo'
import { armSound, isSoundEnabled, playSound, setSoundEnabled } from '../../lib/sound'
import { stolHandling, type BordStol } from '../../lib/backend/bord'
import { annoteraSystemiskt, verkligaStick, vridStol, vridTillbaka } from './bord-projektion'
import { useBordSpel } from './useBordSpel'

/** Visuell stolordning i namnraden: som auktionsrutnätet (V N Ö S). */
const NAMN_ORDNING: Seat[] = ['W', 'N', 'E', 'S']

function NamnRad({ stolar, minStol }: { stolar: BordStol[]; minStol: Seat }) {
  const verklig = vridTillbaka(minStol)
  const perStol = new Map(stolar.map((s) => [s.stol, s]))
  return (
    <div className="mx-auto flex w-full max-w-md flex-wrap justify-center gap-x-3 gap-y-0.5 pt-1 text-[11px] text-rose-100/60">
      {NAMN_ORDNING.map((vis) => {
        const s = perStol.get(verklig(vis))
        const namn = s?.namn ?? 'Bot'
        // 4C: paus/borta = boten spelar stolen tills människan är tillbaka.
        const suffix = s?.status === 'paus' ? ' · paus' : s?.status === 'borta' ? ' · bot' : ''
        return (
          <span key={vis} className={vis === 'S' ? 'font-semibold text-gold-200' : ''}>
            {SEAT_LABEL[vis]}: {vis === 'S' ? `${namn} (du)` : namn}
            {suffix}
          </span>
        )
      })}
    </div>
  )
}

/** ⋮-menyn vid vänner-bordet (ägarönskemål 2026-08-17): samma mönster som
 *  spelbordets TableMenu — inbjudningslänken, tempot (LOKALT: styr bara hur
 *  snabbt serverns drag visas på DIN skärm), hjälptexten och vägen ut.
 *  Ägaren får dessutom "Avsluta bordet". */
function BordMeny({
  open,
  onToggle,
  kod,
  agare,
  tempoVal,
  onTempo,
  ljud,
  onLjud,
  kanRapportera,
  onRapportera,
  kanPausa,
  onPaus,
  onLamnaBord,
  onAvsluta,
  children,
}: {
  open: boolean
  onToggle: () => void
  kod: string
  agare: boolean
  tempoVal: PlaySpeed
  onTempo: (t: PlaySpeed) => void
  ljud: boolean
  onLjud: (on: boolean) => void
  /** Felrapporten kräver hela given — den låses upp när given är klar
   *  (händerna är dolda dessförinnan, av fusksäkerhetsskäl). */
  kanRapportera: boolean
  onRapportera: () => void
  /** 4C: paus (boten tar över tills du återtar) och lämna för gott. */
  kanPausa: boolean
  onPaus: () => void
  onLamnaBord: () => void
  onAvsluta: () => void
  children: ReactNode
}) {
  const navigate = useNavigate()
  const [kopierad, setKopierad] = useState(false)
  function kopieraLank() {
    const lank = `${window.location.origin}/#/bord/${kod}`
    void navigator.clipboard?.writeText(lank).then(() => {
      setKopierad(true)
      setTimeout(() => setKopierad(false), 1800)
    })
  }
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-950/60 text-lg font-bold text-rose-50 ring-1 ring-rose-100/10 hover:bg-red-950/80"
        aria-label="Meny"
      >
        ⋮
      </button>
      {open && (
        <>
          <ClickAway onClose={onToggle} />
          <div className="absolute right-0 top-11 z-40 w-64 rounded-xl bg-panel p-3 shadow-xl ring-1 ring-line">
            <Button className="w-full" variant="secondary" onClick={kopieraLank}>
              {kopierad ? 'Länk kopierad ✓' : 'Kopiera inbjudningslänk'}
            </Button>
            <MenuTempoRow speed={tempoVal} onChange={onTempo} />
            <MenuToggleRow label="Ljud" hint="diskreta kortljud" on={ljud} onToggle={() => onLjud(!ljud)} />
            {kanRapportera && (
              <button
                type="button"
                onClick={() => {
                  onToggle()
                  onRapportera()
                }}
                className="mt-2 w-full rounded-lg bg-panel-2 px-2.5 py-1.5 text-left text-xs font-medium text-ink-soft hover:bg-control-hover"
              >
                Rapportera fel i given
              </button>
            )}
            {kanPausa && (
              <button
                type="button"
                onClick={() => {
                  onToggle()
                  onPaus()
                }}
                className="mt-2 w-full rounded-lg bg-panel-2 px-2.5 py-1.5 text-left text-xs font-medium text-ink-soft hover:bg-control-hover"
              >
                Ta paus — boten tar över så länge
              </button>
            )}
            <p className="mt-3 text-xs leading-relaxed text-ink-soft">{children}</p>
            <button
              type="button"
              onClick={() => {
                onToggle()
                onLamnaBord()
              }}
              className="mt-3 w-full border-t border-line pt-2.5 text-sm font-semibold text-danger transition-opacity hover:opacity-80"
            >
              Lämna bordet för gott
            </button>
            {agare && (
              <button
                type="button"
                onClick={() => {
                  onToggle()
                  onAvsluta()
                }}
                className="mt-3 w-full border-t border-line pt-2.5 text-sm font-semibold text-danger transition-opacity hover:opacity-80"
              >
                Avsluta bordet
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/spela-med-vanner')}
              className="mt-3 w-full border-t border-line pt-2.5 text-sm font-semibold text-ink-soft transition-opacity hover:opacity-80"
            >
              ← Till Spela med vänner
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export function BordSpel({
  kod,
  minStol,
  tempo,
  givar,
}: {
  kod: string
  minStol: Seat
  tempo: PlaySpeed
  givar: number
}) {
  const navigate = useNavigate()
  // Tempot lokalt (startar på bordets inställning): presentationskön är per
  // skärm, så var och en får bläddra i sin egen takt via ⋮-menyn.
  const [tempoVal, setTempoVal] = useState<PlaySpeed>(tempo)
  const [visaMeny, setVisaMeny] = useState(false)
  const [visaInfo, setVisaInfo] = useState(false)
  const [visaAvsluta, setVisaAvsluta] = useState(false)
  const [visaRapport, setVisaRapport] = useState(false)
  const [visaLamna, setVisaLamna] = useState(false)
  const [avslutar, setAvslutar] = useState(false)
  const [stolArbete, setStolArbete] = useState(false)
  const [ljud, setLjud] = useState(isSoundEnabled)
  const {
    laddar,
    meta,
    stolar,
    begaranden,
    dinHand,
    lage,
    auktion,
    spel,
    sweep,
    fel,
    aktuell,
    redo,
    skickar,
    gorDrag,
    hoppaOverSvep,
  } = useBordSpel(kod, minStol, tempoVal)
  const [selectedSuit, setSelectedSuit] = useState<Card['suit'] | null>(null)

  async function avslutaBordet() {
    setAvslutar(true)
    await stolHandling(kod, 'avsluta')
    navigate('/spela-med-vanner')
  }

  /** 4C: stolhandlingarna (paus/lämna/återta/godkänn/neka) — synken hämtar om
   *  läget via händelsen som servern skriver. */
  async function korStol(handling: 'paus-begaran' | 'aterta' | 'godkann' | 'neka', stol?: Seat) {
    setStolArbete(true)
    await stolHandling(kod, handling, stol)
    setStolArbete(false)
  }

  async function lamnaBordet() {
    setStolArbete(true)
    const svar = await stolHandling(kod, 'lamna')
    setVisaLamna(false)
    setStolArbete(false)
    // Direkt verkställt (ägaren) → ut till lobbyn; annars väntar begäran på
    // ägarens godkännande och spelaren sitter kvar tills det kommer.
    if (svar.ok && !svar.vantar) navigate('/spela-med-vanner')
  }

  // Nollställ färgvalet när turen går vidare (samma princip som budlådan).
  const toActV = spel?.state.toAct ?? null
  useEffect(() => setSelectedSuit(null), [toActV])

  // Ljudmotorn väcks i en riktig användargest (autoplay-policyn) — billig och
  // idempotent, precis som på spelbordet.
  useEffect(() => {
    window.addEventListener('pointerdown', armSound)
    return () => window.removeEventListener('pointerdown', armSound)
  }, [])

  // Tangentbordet i kortspelet (samma som Play.tsx): ←/→/↑/↓ flyttar fokus
  // mellan spelbara kort (data-spelbart i PlayingCard), Enter spelar.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return
      const t = e.target as HTMLElement | null
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return
      const cards = [...document.querySelectorAll<HTMLButtonElement>('button[data-spelbart]')]
      if (cards.length === 0) return
      e.preventDefault()
      const fwd = e.key === 'ArrowRight' || e.key === 'ArrowDown'
      const i = cards.indexOf(document.activeElement as HTMLButtonElement)
      const next =
        i === -1 ? (fwd ? 0 : cards.length - 1) : (i + (fwd ? 1 : -1) + cards.length) % cards.length
      cards[next].focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Kortljuden (samma tre som spelbordet): knäpp per lagt kort, svisch när
  // sticket sveps, serverings-tick när en ny giv delas. Ref-vakterna skiljer
  // "nytt" från "monterad mitt i" — inget ljud vid omladdning.
  const ljudRef = useRef(ljud)
  ljudRef.current = ljud
  const kortLjudRef = useRef(-1)
  const antalKort = lage?.kort.length ?? 0
  useEffect(() => {
    if (kortLjudRef.current === -1) {
      kortLjudRef.current = antalKort
      return
    }
    if (antalKort > kortLjudRef.current && ljudRef.current) playSound('card')
    kortLjudRef.current = antalKort
  }, [antalKort])
  const svepFas = sweep?.phase ?? null
  useEffect(() => {
    if (svepFas === 'slide' && ljudRef.current) playSound('sweep')
  }, [svepFas])
  const givNr = lage?.giv ?? 0
  const givLjudRef = useRef(-1)
  useEffect(() => {
    if (givLjudRef.current === -1) {
      givLjudRef.current = givNr
      return
    }
    if (givNr > givLjudRef.current) {
      givLjudRef.current = givNr
      const id = setTimeout(() => {
        if (ljudRef.current) playSound('deal')
      }, ms('dealSoundDelay', tempoVal))
      return () => clearTimeout(id)
    }
    givLjudRef.current = givNr
  }, [givNr, tempoVal])

  const rot =
    'flex min-h-[100dvh] w-full flex-col rounded-none border-transparent shadow-none'

  if (laddar || !lage || !auktion) {
    return (
      <Felt tone="vanner" className={`${rot} items-center justify-center`}>
        <p className="text-rose-100/70">Hämtar bordet …</p>
      </Felt>
    )
  }

  // 4C: bordet avslutades (ägaren, eller sista människan lämnade) medan vyn
  // var öppen — säg det i stället för att spela vidare mot en död logg.
  if (meta?.status === 'avslutat') {
    return (
      <Felt tone="vanner" className={`${rot} items-center justify-center`}>
        <div className="max-w-sm space-y-4 text-center">
          <h1 className="text-2xl font-semibold text-rose-50">Bordet är avslutat</h1>
          <Button onClick={() => navigate('/spela-med-vanner')}>Till Spela med vänner →</Button>
        </div>
      </Felt>
    )
  }

  // 4C: min lämna-begäran godkändes (av ägaren eller automatiskt) — stolen är
  // frigjord och jag är inte längre med vid bordet.
  if (meta && !meta.dinStol) {
    return (
      <Felt tone="vanner" className={`${rot} items-center justify-center`}>
        <div className="max-w-sm space-y-4 text-center">
          <h1 className="text-2xl font-semibold text-rose-50">Du har lämnat bordet</h1>
          <p className="text-rose-100/70">Tack för spelet!</p>
          <Button onClick={() => navigate('/spela-med-vanner')}>Till Spela med vänner →</Button>
        </div>
      </Felt>
    )
  }

  // -------------------------------------------------------------------------
  // Gemensamma småbitar.

  const givBadge = (
    <div className="w-full rounded-md bg-gold-400/15 px-1.5 py-1 text-left text-[10px] font-semibold leading-tight text-gold-200 ring-1 ring-inset ring-gold-400/30">
      Giv {lage.giv} av {givar} · Bord {kod}
    </div>
  )

  const minSida = side(minStol) // 'NS' | 'EW' i den VERKLIGA världen (poängen)
  const stallningRad = (st: { ns: number; ew: number }) => {
    const ni = minSida === 'NS' ? st.ns : st.ew
    const de = minSida === 'NS' ? st.ew : st.ns
    return `Ni ${ni} – De ${de}`
  }

  const felRad = fel && (
    <p role="alert" className="px-3 py-1 text-center text-sm font-medium text-rose-200">
      {fel}
    </p>
  )

  const meny = (
    <BordMeny
      open={visaMeny}
      onToggle={() => {
        setVisaMeny((v) => !v)
        setVisaInfo(false)
      }}
      kod={kod}
      agare={meta?.duArAgare ?? false}
      tempoVal={tempoVal}
      onTempo={setTempoVal}
      ljud={ljud}
      onLjud={(on) => {
        setLjud(on)
        setSoundEnabled(on)
      }}
      kanRapportera={!!lage}
      onRapportera={() => setVisaRapport(true)}
      kanPausa={
        meta?.status === 'spelar' &&
        stolar.find((s) => s.stol === minStol)?.status === 'aktiv'
      }
      onPaus={() => void korStol('paus-begaran')}
      onLamnaBord={() => setVisaLamna(true)}
      onAvsluta={() => setVisaAvsluta(true)}
    >
      Du sitter alltid <strong>nertill</strong> oavsett stol. När din ruta i auktionen lyser
      bjuder du i budlådan; i spelet klickar du en färg och sedan kortet. Tempot styr hur
      snabbt de andras drag visas — bara på din skärm.
    </BordMeny>
  )

  // 4C: min stols status + de gemensamma närvaro-överläggen.
  const minStolStatus = stolar.find((s) => s.stol === minStol)?.status ?? 'aktiv'
  const minBegaran = begaranden.find((b) => b.stol === minStol) ?? null

  /** Ägarens banner: väntande paus-/lämna-begäranden med Godkänn/Neka. */
  const begaranBanner = (meta?.duArAgare ?? false) && begaranden.length > 0 && (
    <div className="absolute left-1/2 top-[calc(3.25rem+env(safe-area-inset-top))] z-30 w-full max-w-sm -translate-x-1/2 space-y-1.5 px-3">
      {begaranden.map((b) => (
        <div
          key={b.stol}
          className="flex items-center justify-between gap-2 rounded-xl bg-panel p-2.5 shadow-xl ring-1 ring-line"
        >
          <span className="text-sm text-ink">
            <strong>{b.namn ?? SEAT_LABEL[vridStolLabel(b.stol, minStol)]}</strong>{' '}
            {b.slag === 'paus' ? 'ber om paus' : 'vill lämna bordet'}
          </span>
          <span className="flex shrink-0 gap-1.5">
            <Button
              className="!px-2.5 !py-1 text-xs"
              disabled={stolArbete}
              onClick={() => void korStol('godkann', b.stol)}
            >
              Godkänn
            </Button>
            <Button
              variant="secondary"
              className="!px-2.5 !py-1 text-xs"
              disabled={stolArbete}
              onClick={() => void korStol('neka', b.stol)}
            >
              Neka
            </Button>
          </span>
        </div>
      ))}
    </div>
  )

  /** Min egen väntande begäran: liten kvitto-rad. */
  const vantarRad = !meta?.duArAgare && minBegaran && (
    <p className="px-3 py-1 text-center text-xs font-medium text-rose-100/70">
      {minBegaran.slag === 'paus' ? 'Paus' : 'Lämna'}-begäran skickad — väntar på ägarens
      godkännande (godkänns automatiskt efter en minut).
    </p>
  )

  /** Paus-overlayen: boten spelar min stol tills jag tar tillbaka den. */
  const pausOverlay = minStolStatus === 'paus' && (
    <Dialog className="w-full max-w-sm p-6 text-center">
      <h2 className="text-lg font-semibold text-ink">Du har paus</h2>
      <p className="mt-2 text-sm text-ink-soft">
        Boten spelar din stol så länge. Ta tillbaka den när du är redo.
      </p>
      <div className="mt-4">
        <Button disabled={stolArbete} onClick={() => void korStol('aterta')}>
          Ta tillbaka stolen
        </Button>
      </div>
    </Dialog>
  )

  const lamnaDialog = visaLamna && (
    <Dialog onClose={() => setVisaLamna(false)} className="w-full max-w-sm p-6">
      <h2 className="text-lg font-semibold text-ink">Lämna bordet för gott?</h2>
      <p className="mt-2 text-sm text-ink-soft">
        En bot tar din stol (på publika bord kan en ny spelare hoppa in).
        {!meta?.duArAgare && ' Bordets ägare godkänner först.'}
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={() => setVisaLamna(false)}>
          Avbryt
        </Button>
        <Button disabled={stolArbete} onClick={() => void lamnaBordet()}>
          Lämna bordet
        </Button>
      </div>
    </Dialog>
  )

  /** Felrapporten (ägarbeslut 2026-08-17: tillgänglig i ALLA faser — bud,
   *  spel och efter given, som i resten av rebidz). Rapporten bär det
   *  klienten vet: hela given vid reveal; under pågående giv egen hand +
   *  träkarlen (dolda händer utelämnas — fusksäkerheten) plus bordskoden i
   *  giv-id:t så given kan återskapas exakt ur bordets frö. */
  const rapportDialog =
    visaRapport &&
    lage &&
    (() => {
      const hands: Record<Seat, Card[]> = { N: [], E: [], S: [], W: [] }
      const reveal = lage.klar?.hands ?? lage.facit?.hands ?? null
      if (reveal) {
        Object.assign(hands, reveal)
      } else {
        if (dinHand) hands[minStol] = dinHand
        if (lage.trakarl) hands[lage.trakarl.stol] = lage.trakarl.hand
      }
      const rapportDeal: Deal = {
        id: `bord-${kod}-giv-${lage.giv}`,
        hands,
        dealer: lage.dealer,
        vulnerability: lage.vulnerability,
        board: lage.board,
      }
      return (
        <FelrapportDialog
          deal={rapportDeal}
          calls={lage.history}
          contract={lage.contract}
          tricks={verkligaStick(lage)}
          onClose={() => setVisaRapport(false)}
          intro={
            reveal
              ? undefined
              : 'Auktionen och de spelade korten följer med automatiskt. Under en pågående giv utelämnas dolda händer — bordskoden i giv-id:t gör att given ändå kan återskapas exakt.'
          }
        />
      )
    })()

  const narvaroOverlagg = (
    <>
      {begaranBanner}
      {pausOverlay}
      {lamnaDialog}
      {rapportDialog}
    </>
  )

  const avslutaDialog = visaAvsluta && (
    <Dialog onClose={() => setVisaAvsluta(false)} className="w-full max-w-sm p-6">
      <h2 className="text-lg font-semibold text-ink">Avsluta bordet?</h2>
      <p className="mt-2 text-sm text-ink-soft">
        Bordet stängs för alla som sitter här. Det går inte att ångra.
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={() => setVisaAvsluta(false)}>
          Avbryt
        </Button>
        <Button disabled={avslutar} onClick={() => void avslutaBordet()}>
          Avsluta bordet
        </Button>
      </div>
    </Dialog>
  )

  // -------------------------------------------------------------------------
  // Slutresultatet (bordet färdigspelat).

  if (lage.bordKlar) {
    const st = lage.bordKlar.stallning
    const ni = minSida === 'NS' ? st.ns : st.ew
    const de = minSida === 'NS' ? st.ew : st.ns
    // Läge 1 (endast budgivning) har ingen poäng — genomgången är målet.
    const baraBudgivning = meta?.spelform === 'budgivning'
    const rubrik = baraBudgivning
      ? 'Alla givar genomgångna!'
      : ni > de
        ? 'Ni vann! 🎉'
        : ni < de
          ? 'De vann den här gången'
          : 'Oavgjort!'
    return (
      <Felt tone="vanner" className={`${rot} items-center justify-center`}>
        <div className="max-w-sm space-y-4 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-300">
            {baraBudgivning ? 'Budgivningen genomgången' : 'Bordet är färdigspelat'}
          </p>
          <h1 className="text-3xl font-semibold text-rose-50">{rubrik}</h1>
          {!baraBudgivning && <p className="text-lg text-rose-100/80">{stallningRad(st)}</p>}
          <Button onClick={() => navigate('/spela-med-vanner')}>Till Spela med vänner →</Button>
        </div>
      </Felt>
    )
  }

  // -------------------------------------------------------------------------
  // Budfasen.

  if (lage.fas === 'bud') {
    const minTur = aktuell && auktion.toAct === 'S'
    return (
      <Felt tone="vanner" className={rot}>
        <div className="px-2.5 pb-1 pt-[calc(0.625rem+env(safe-area-inset-top))]">
          <div className="relative mx-auto flex w-full max-w-md items-stretch gap-2">
            <CompassPanel
              dealer={auktion.dealer}
              board={lage.board}
              vulnerability={auktion.vulnerability}
              footer={givBadge}
            />
            <AuctionGrid
              calls={auktion.calls}
              dealer={auktion.dealer}
              vulnerability={auktion.vulnerability}
              activeSeat={aktuell ? auktion.toAct : null}
              explanations="full"
              hiddenHands
            />
            {/* ⋮-menyn: i radflödet på mobil, hängd utanför kolumnen från sm:
                (samma kringflytande chrome som spelbordets budfas). */}
            <div className="shrink-0 sm:absolute sm:-right-11 sm:top-0">{meny}</div>
          </div>
          <NamnRad stolar={stolar} minStol={minStol} />
        </div>
        {felRad}
        {vantarRad}
        <div className="px-2.5 pb-1.5">
          <BiddingBox
            legal={minTur ? legalCalls(auktion.calls, 'S') : []}
            onBid={(bid) => void gorDrag({ typ: 'bud', bid })}
            recommendation={null}
            history={auktion.calls}
            showHelp
          />
        </div>
        <div className="mt-auto border-t border-rose-100/10 bg-red-950/25 px-2 pt-1.5 pb-[calc(0.25rem+env(safe-area-inset-bottom))]">
          {dinHand ? (
            <>
              {/* HCP-brickan — samma som spelbordets budfas (ägarönskemål
                  2026-08-17: se sina hp även vid vänner-bordet). */}
              <div className="relative mx-auto w-full max-w-md">
                <div className="absolute -top-4 right-0 z-10 rounded-md bg-red-950/80 px-2 py-0.5 text-xs font-semibold text-white ring-1 ring-gold-400/25">
                  HCP {hcp(dinHand)}
                </div>
              </div>
              <HandFan hand={dinHand} flat />
            </>
          ) : (
            <p className="py-6 text-center text-sm text-rose-100/60">Hämtar din hand …</p>
          )}
        </div>
        {narvaroOverlagg}
        {avslutaDialog}
      </Felt>
    )
  }

  // -------------------------------------------------------------------------
  // Läge 1 (endast budgivning, 4D): facit-genomgången — alla händer vänds upp
  // på bordet och mitten visar er budgivning sida vid sida med motorns
  // kanoniska linje ("så här bjuder 2/1-boken"). Ägaren går vidare.

  if (lage.fas === 'klar' && lage.facit) {
    const facit = lage.facit
    const vTill = vridTillbaka(minStol)
    const v = vridStol(minStol)
    const sista = lage.giv >= givar
    const agare = meta?.duArAgare ?? false
    const spelad = annoteraSystemiskt(auktion.calls)
    const linje = annoteraSystemiskt(facit.systemlinje.map((c) => ({ seat: v(c.seat), bid: c.bid })))
    const sammaLinje =
      spelad.length === linje.length &&
      spelad.every((c, i) => c.bid === linje[i].bid && c.seat === linje[i].seat)
    const ordning = facit.contract
      ? { ...facit.contract, declarer: vridStolLabel(facit.contract.declarer, minStol) }
      : { declarer: 'S' as Seat, strain: 'NT' as const, level: 1 }
    const stillaLage: PlayState = {
      contract: ordning,
      trump: ordning.strain === 'NT' ? null : ordning.strain,
      hands: { N: [], E: [], S: [], W: [] },
      leader: 'S',
      toAct: 'S',
      currentTrick: [],
      completedTricks: [],
      tricksNS: 0,
      tricksEW: 0,
    }
    return (
      <Felt tone="vanner" className={rot}>
        <div className="px-2.5 pt-[calc(0.625rem+env(safe-area-inset-top))]">
          <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-2 text-xs text-rose-100/80">
            <span className="font-semibold text-gold-200">
              Giv {lage.giv} av {givar} — budgivningen klar
            </span>
            {meny}
          </div>
          <NamnRad stolar={stolar} minStol={minStol} />
        </div>
        {felRad}

        {/* Nord uppvänd. */}
        <div className="flex justify-center px-2 pt-1">
          <SuitColumns
            hand={facit.hands[vTill('N')]}
            contract={ordning}
            play={stillaLage}
            seat="N"
            onCardClick={() => {}}
            selectedSuit={null}
          />
        </div>

        {/* Väst | jämförelsen | Öst. */}
        <div className="flex flex-1 items-start justify-between gap-1 px-2 py-2">
          <div className="shrink-0">
            <SideDummyPiles hand={facit.hands[vTill('W')]} contract={ordning} side="W" />
          </div>
          <div className="mx-auto flex max-h-[55dvh] w-full max-w-sm flex-col gap-2 overflow-y-auto rounded-2xl bg-red-950/50 p-3 ring-1 ring-rose-50/15">
            <p className="text-center font-semibold text-rose-50">
              {facit.contract ? (
                <>
                  <BidChip
                    bid={`${facit.contract.level}${STRAIN_CODE[facit.contract.strain]}`}
                  />{' '}
                  av {SEAT_LABEL[vridStolLabel(facit.contract.declarer, minStol)]}
                </>
              ) : (
                'Given passades ut'
              )}
            </p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-100/60">
              Er budgivning
            </p>
            <AuctionGrid
              calls={spelad}
              dealer={auktion.dealer}
              vulnerability={auktion.vulnerability}
              explanations="full"
              dense
            />
            {sammaLinje ? (
              <p className="text-center text-xs font-medium text-gold-200">
                Ni bjöd precis som 2/1-boken. ✓
              </p>
            ) : (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-100/60">
                  Motorns linje
                </p>
                <AuctionGrid
                  calls={linje}
                  dealer={auktion.dealer}
                  vulnerability={auktion.vulnerability}
                  explanations="full"
                  dense
                />
              </>
            )}
            <div className="text-center">
              {agare ? (
                <Button disabled={skickar} onClick={() => void gorDrag({ typ: 'nasta-giv' })}>
                  {sista ? 'Avsluta genomgången →' : 'Nästa giv →'}
                </Button>
              ) : (
                <p className="text-xs text-rose-100/60">Bordets ägare startar nästa giv.</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setVisaRapport(true)}
              className="text-[11px] font-medium text-rose-100/50 underline underline-offset-2 hover:text-rose-100/80"
            >
              Kändes något fel? Rapportera given
            </button>
          </div>
          <div className="shrink-0">
            <SideDummyPiles hand={facit.hands[vTill('E')]} contract={ordning} side="E" />
          </div>
        </div>

        {/* Din hand nere. */}
        <div className="mt-auto border-t border-rose-100/10 bg-red-950/25 px-2 pt-1.5 pb-[calc(0.25rem+env(safe-area-inset-bottom))]">
          <HandFan hand={facit.hands[vTill('S')]} flat />
        </div>
        {narvaroOverlagg}
        {avslutaDialog}
      </Felt>
    )
  }

  // -------------------------------------------------------------------------
  // Giv klar: alla 52 kort vänds upp PÅ BORDET (ägarönskemål 2026-08-17 —
  // ingen egen vy, ingen stickredovisning: 13 kort per väderstreck på sina
  // platser). Resultatet ligger i mitten där sticket annars låg, och BARA
  // ägaren startar nästa giv. Även utpassade givar landar här (giv-klar med
  // passadUt från servern).

  if (lage.fas === 'klar' && lage.klar) {
    const klar = lage.klar
    const vTill = vridTillbaka(minStol)
    const sista = lage.giv >= givar
    const poang = minSida === 'NS' ? klar.nsScore : -klar.nsScore
    const agare = meta?.duArAgare ?? false
    // Suitordningen i sidostaplarna: trumfen först när det finns ett kontrakt.
    const ordning = klar.contract
      ? { ...klar.contract, declarer: vridStolLabel(klar.contract.declarer, minStol) }
      : { declarer: 'S' as Seat, strain: 'NT' as const, level: 1 }
    // Nord ritas som bordets träkarl (SuitColumns, xl-kolumner) — ett stilla
    // syntetiskt spelläge gör kolumnerna oklickbara (turen är aldrig Nords).
    const stillaLage: PlayState = {
      contract: ordning,
      trump: ordning.strain === 'NT' ? null : ordning.strain,
      hands: { N: [], E: [], S: [], W: [] },
      leader: 'S',
      toAct: 'S',
      currentTrick: [],
      completedTricks: [],
      tricksNS: 0,
      tricksEW: 0,
    }
    return (
      <Felt tone="vanner" className={rot}>
        <div className="px-2.5 pt-[calc(0.625rem+env(safe-area-inset-top))]">
          <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-2 text-xs text-rose-100/80">
            <span className="font-semibold text-gold-200">
              Giv {lage.giv} av {givar} — klar
            </span>
            <div className="flex items-center gap-2">
              <span>Ställning: {stallningRad(klar.stallning)}</span>
              {meny}
            </div>
          </div>
          <NamnRad stolar={stolar} minStol={minStol} />
        </div>
        {felRad}

        {/* Nord uppvänd — samma kolumnvy som bordets träkarl (kortregeln). */}
        <div className="flex justify-center px-2 pt-1">
          <SuitColumns
            hand={klar.hands[vTill('N')]}
            contract={ordning}
            play={stillaLage}
            seat="N"
            onCardClick={() => {}}
            selectedSuit={null}
          />
        </div>

        {/* Väst | resultatet | Öst. */}
        <div className="flex flex-1 items-center justify-between gap-1 px-2">
          <div className="shrink-0">
            <SideDummyPiles hand={klar.hands[vTill('W')]} contract={ordning} side="W" />
          </div>
          <div className="mx-auto max-w-xs rounded-2xl bg-red-950/50 px-4 py-3 text-center ring-1 ring-rose-50/15">
            {klar.passadUt || !klar.contract ? (
              <p className="font-semibold text-rose-50">Given passades ut</p>
            ) : (
              <>
                <p className="flex items-center justify-center gap-1.5 font-semibold text-rose-50">
                  <BidChip bid={`${klar.contract.level}${STRAIN_CODE[klar.contract.strain]}`} />
                  {klar.contract.doubled && (
                    <span className="text-sm font-bold text-rose-300">{klar.contract.doubled}</span>
                  )}
                  <span>av {SEAT_LABEL[vridStolLabel(klar.contract.declarer, minStol)]}</span>
                </p>
                <p className="mt-1 text-sm text-rose-100/80">
                  {klar.declarerTricks} stick · {poang >= 0 ? `Ni +${poang}` : `De +${-poang}`}
                </p>
              </>
            )}
            <div className="mt-2">
              {agare ? (
                <Button disabled={skickar} onClick={() => void gorDrag({ typ: 'nasta-giv' })}>
                  {sista ? 'Se slutresultatet →' : 'Nästa giv →'}
                </Button>
              ) : (
                <p className="text-xs text-rose-100/60">Bordets ägare startar nästa giv.</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setVisaRapport(true)}
              className="mt-2 text-[11px] font-medium text-rose-100/50 underline underline-offset-2 hover:text-rose-100/80"
            >
              Kändes något fel? Rapportera given
            </button>
          </div>
          <div className="shrink-0">
            <SideDummyPiles hand={klar.hands[vTill('E')]} contract={ordning} side="E" />
          </div>
        </div>

        {/* Din hand nere, uppvänd som vanligt. */}
        <div className="mt-auto border-t border-rose-100/10 bg-red-950/25 px-2 pt-1.5 pb-[calc(0.25rem+env(safe-area-inset-bottom))]">
          <HandFan hand={klar.hands[vTill('S')]} flat />
        </div>
        {narvaroOverlagg}
        {avslutaDialog}
      </Felt>
    )
  }

  // -------------------------------------------------------------------------
  // Spelfasen.

  const st = spel!.state
  const dummyV = spel!.dummy
  const trakarlUppe = lage.trakarl !== null
  const jagArDummy = trakarlUppe && dummyV === 'S'

  function klick(seatV: Seat) {
    return (c: Card) => {
      // `redo` i stället för `aktuell`: ett klick mitt i sticksvepet hoppar
      // över svepet och agerar direkt ("korten fastnar"-fyndet 2026-08-17).
      if (!redo || !spel) return
      if (sweep) hoppaOverSvep()
      const s = spel.state
      if (s.toAct !== seatV) return
      const agerandeV = trakarlUppe && s.toAct === dummyV ? s.contract.declarer : s.toAct
      if (agerandeV !== 'S') return
      const legal = legalCards(s, seatV)
      if (!legal.some((x) => sameCard(x, c))) return
      const iFargen = legal.filter((x) => x.suit === c.suit)
      if (selectedSuit === c.suit || iFargen.length === 1) {
        setSelectedSuit(null)
        void gorDrag({ typ: 'kort', card: c })
      } else {
        setSelectedSuit(c.suit)
      }
    }
  }

  const kontraktText = `${st.contract.level}${STRAIN_CODE[st.contract.strain]}`
  const minTurSpel =
    aktuell &&
    (trakarlUppe && st.toAct === dummyV ? st.contract.declarer : st.toAct) === 'S'

  return (
    <Felt tone="vanner" className={rot}>
      {/* Toppraden: kontrakt, stick, giv, ställning + ⋮-menyn. */}
      <div className="px-2.5 pt-[calc(0.625rem+env(safe-area-inset-top))]">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-2 text-sm text-rose-100/80">
          <div className="flex items-center gap-1.5">
            <BidChip bid={kontraktText} />
            {st.contract.doubled && (
              <span className="text-xs font-bold text-rose-300">{st.contract.doubled}</span>
            )}
            <span className="text-xs">av {SEAT_LABEL[st.contract.declarer]}</span>
          </div>
          <div className="text-xs">
            Stick: Ni {st.tricksNS} – De {st.tricksEW}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs">
              Giv {lage.giv}/{givar} · {stallningRad(lage.stallning)}
            </span>
            {/* ⓘ: auktionen + förra sticket (samma overlay som spelbordet). */}
            <button
              type="button"
              onClick={() => {
                setVisaInfo((v) => !v)
                setVisaMeny(false)
              }}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-950/60 text-sm font-bold text-rose-50 ring-1 ring-rose-100/10 transition-colors hover:bg-red-950/80 hover:ring-gold-400/40"
              aria-label="Budgivningen och förra sticket"
            >
              i
            </button>
            {meny}
          </div>
        </div>
        <NamnRad stolar={stolar} minStol={minStol} />
        {minTurSpel && (
          <p className="pt-0.5 text-center text-xs font-semibold text-gold-200">Din tur</p>
        )}
      </div>
      {felRad}
      {vantarRad}

      {/* ⓘ-overlay: budgivningen som ledde till kontraktet + förra sticket i
          miniatyr + utspelet — samma innehåll som spelbordets overlay. */}
      {visaInfo && (
        <>
          <ClickAway onClose={() => setVisaInfo(false)} />
          <div className="absolute left-1/2 top-[calc(3.5rem+env(safe-area-inset-top))] z-40 w-full max-w-sm -translate-x-1/2 space-y-2 px-3">
            <div className="rounded-xl bg-panel p-2 shadow-xl ring-1 ring-line">
              <AuctionGrid
                calls={auktion.calls}
                dealer={auktion.dealer}
                vulnerability={auktion.vulnerability}
                explanations="full"
                hiddenHands
              />
            </div>
            {st.completedTricks.length > 0 && (
              <div className="flex justify-center rounded-xl bg-panel p-2 shadow-xl ring-1 ring-line">
                <LastTrickPanel
                  trick={st.completedTricks[st.completedTricks.length - 1]}
                  onCardClick={() => {}}
                  hasReason={() => false}
                />
              </div>
            )}
            {(() => {
              const utspel = (st.completedTricks[0] ?? { cards: st.currentTrick }).cards[0]
              if (!utspel) return null
              return (
                <div className="flex items-center justify-center gap-2 rounded-xl bg-panel p-2 shadow-xl ring-1 ring-line">
                  <span className="text-xs font-medium text-ink-muted">Utspel:</span>
                  <PlayingCard card={utspel.card} size="sm" />
                  <span className="text-xs text-ink-muted">{SEAT_LABEL[utspel.seat]}</span>
                </div>
              )
            })()}
          </div>
        </>
      )}

      {/* Nord-zonen: träkarlen som färgkolumner NÄR den sitter där — dolda
          händer visas inte alls (spelbordets regel, Play.tsx). min-h håller
          zonens plats så bordet inte hoppar när träkarlen läggs upp. */}
      <div className="flex min-h-16 justify-center pt-1">
        {trakarlUppe && dummyV === 'N' && (
          <SuitColumns
            hand={st.hands.N}
            contract={st.contract}
            play={st}
            seat="N"
            onCardClick={klick('N')}
            selectedSuit={selectedSuit}
          />
        )}
      </div>

      {/* Mitten: träkarlen på sin sida (bara när den sitter där) | sticket. */}
      <div className="flex flex-1 items-center gap-1 px-1 py-2">
        {trakarlUppe && dummyV === 'W' && (
          <div className="shrink-0">
            <SideDummyPiles hand={st.hands.W} contract={st.contract} side="W" />
          </div>
        )}
        <div className="flex min-w-0 flex-1 justify-center">
          <TrickCenterLive
            play={st}
            thinking={skickar}
            sweep={sweep}
            onSkipSweep={hoppaOverSvep}
            onCardClick={() => {}}
            hasReason={() => false}
          />
        </div>
        {trakarlUppe && dummyV === 'E' && (
          <div className="shrink-0">
            <SideDummyPiles hand={st.hands.E} contract={st.contract} side="E" />
          </div>
        )}
      </div>

      {/* Bricka + zon nere till vänster (som spelbordet) — zonen i DIN
          synvinkel (visuella världen), samma som auktionsrutnätet. */}
      <div className="px-3 pb-2 text-xs leading-tight text-rose-50/90">
        <div>Bricka {lage.board}</div>
        <div>{VUL_TEXT[auktion.vulnerability]}</div>
      </div>

      {/* Syd: din hand — klickbar när du styr den, stilla om du är träkarl. */}
      <div className="mt-auto border-t border-rose-100/10 bg-red-950/25 px-2 pt-1.5 pb-[calc(0.25rem+env(safe-area-inset-bottom))]">
        {jagArDummy && (
          <p className="pb-1 text-center text-xs text-rose-100/60">
            Du är träkarl — din partner (spelföraren) spelar dina kort.
          </p>
        )}
        {jagArDummy ? (
          <HandFan hand={st.hands.S} flat />
        ) : (
          <SouthFan
            hand={st.hands.S}
            contract={st.contract}
            play={st}
            onCardClick={klick('S')}
            selectedSuit={selectedSuit}
          />
        )}
      </div>
      {narvaroOverlagg}
      {avslutaDialog}
    </Felt>
  )
}

/** Spelförarens etikett i giv-klar-vyn: klar.contract är i VERKLIGA stolar. */
function vridStolLabel(declarerVerklig: Seat, minStol: Seat): Seat {
  const ORDER: Seat[] = ['N', 'E', 'S', 'W']
  const shift = (2 - ORDER.indexOf(minStol) + 4) % 4
  return ORDER[(ORDER.indexOf(declarerVerklig) + shift) % 4]
}
