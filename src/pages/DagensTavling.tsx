// Beslut B etapp 2 (klientfasen) — "Dagens tävling"-sidan.
//
// Kräver konto (ägarbeslut 2026-08-10): utloggade möts av en logga-in-ruta.
// Hämtar dagens 12 givar från servern och låter spelaren spela dem LINJÄRT
// (giv 1 → 12) mot bottarna, med progress och paus (man kan lämna och fortsätta
// senare samma dag). Varje giv spelas i den vanliga spelskärmen (Play) i
// tävlingsläge — bottarna spelar med serverns play-frö så inskicket kan
// valideras senare (Led 2).
//
// Framstegen sparas LOKALT i Led 1 (per enhet, backend-lagret). Led 2 flyttar
// inskicket till kontot på servern och lägger till validering + topplista.

import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import { Button } from '../components/Button'
import { Felt } from '../components/Felt'
import { SuitSymbol } from '../components/SuitSymbol'
import type { Seat } from '../types/bridge'
import { loadTavlingFramsteg, saveTavlingFramsteg } from '../lib/backend'
import { formatNedrakning, msTillNastaTavling } from '../lib/engine/daily'
import {
  fetchDagensTavling,
  fetchGivResultat,
  fetchTopplista,
  slåIhopFramsteg,
  submitTavlingGiv,
  type DagensTavling as TavlingData,
  type GivKontrakt,
  type GivResultat,
  type GivResultatSvar,
  type GivResultatUtfall,
  type TavlingFramsteg,
  type TavlingsResultat,
  type TopplistaResultat,
} from '../lib/backend/tavling'
import { Play } from './Play'
import { RondRapportView } from './play/RondRapport'
import { byggGranskning } from './play/granska-tavling'
import type { TavlingSpel } from './play/tavling-mode'

/** Index i givar-listan för den första ospelade given, eller null om alla är
 *  klara. Robust mot ordning: matchar på bricknummer, inte listindex. */
function förstaOspelade(tavling: TavlingData, klara: GivResultat[]): number | null {
  const klaraBrickor = new Set(klara.map((k) => k.board))
  const i = tavling.givar.findIndex((g) => !klaraBrickor.has(g.deal.board))
  return i === -1 ? null : i
}

export function DagensTavling() {
  const { loading: authLoading, signedIn } = useAuth()
  // null = laddar; annars utfallet av hämtningen.
  const [resultat, setResultat] = useState<TavlingsResultat | null>(null)
  const [framsteg, setFramsteg] = useState<TavlingFramsteg | null>(null)
  // Index i givar-listan för given som spelas just nu (null = översikten visas).
  const [spelIndex, setSpelIndex] = useState<number | null>(null)
  // Bricknummer för giv-detaljvyn (travellern, steg 6), null = ingen.
  const [detaljBoard, setDetaljBoard] = useState<number | null>(null)
  // Index i givar-listan för given som spelas om i ÖVNINGSLÄGE (2026-08-12) från
  // giv-detaljvyn, null = ingen. Skilt från spelIndex: övningen bokför ALDRIG.
  const [övningIndex, setÖvningIndex] = useState<number | null>(null)
  // Bricknummer för given vars rondgenomgång visas (steg 5), null = ingen.
  const [granskaBoard, setGranskaBoard] = useState<number | null>(null)
  // Dagens topplista (hämtas på översikten).
  const [topplista, setTopplista] = useState<TopplistaResultat | null>(null)
  // Räknare som tvingar en ny hämtning av topplistan (uppdatera-knappen bumpar den);
  // `uppdaterar` snurrar ikonen medan den nya hämtningen pågår.
  const [uppdateraNonce, setUppdateraNonce] = useState(0)
  const [uppdaterar, setUppdaterar] = useState(false)
  // Alltid senaste framsteget (utan att fastna i en gammal closure) — så
  // bokföring på färdig giv och "nästa giv"-navigeringen läser samma sanning.
  const framstegRef = useRef<TavlingFramsteg | null>(null)
  useEffect(() => {
    framstegRef.current = framsteg
  }, [framsteg])

  // Hämta dagens tävling när vi vet att användaren är inloggad.
  useEffect(() => {
    if (!signedIn) return
    let active = true
    setResultat(null)
    fetchDagensTavling().then((r) => {
      if (active) setResultat(r)
    })
    return () => {
      active = false
    }
  }, [signedIn])

  // När tävlingen laddats: läs in lokala framsteg (bara om de hör till DAGENS
  // tävlingsnummer — gårdagens framsteg återupptas aldrig).
  useEffect(() => {
    if (!resultat || resultat.status !== 'ok') return
    const nummer = resultat.tavling.nummer
    const sparat = loadTavlingFramsteg()
    setFramsteg(sparat && sparat.nummer === nummer ? sparat : { nummer, klara: [] })
  }, [resultat])

  // Hämta topplistan när översikten visas (och efter varje giv man kommer
  // tillbaka från) — den uppdateras löpande under dagen.
  useEffect(() => {
    if (!resultat || resultat.status !== 'ok' || spelIndex !== null) return
    let active = true
    fetchTopplista().then((t) => {
      if (active) {
        setTopplista(t)
        setUppdaterar(false)
      }
    })
    return () => {
      active = false
    }
  }, [resultat, spelIndex, uppdateraNonce])

  // --- Grindar: konto krävs -------------------------------------------------
  if (authLoading) {
    return <Skärm><p className="text-emerald-100/80">Laddar …</p></Skärm>
  }
  if (!signedIn) {
    return (
      <Skärm>
        <div className="max-w-sm space-y-4 text-center">
          <h1 className="text-2xl font-semibold text-emerald-50">Dagens tävling</h1>
          <p className="text-emerald-100/80">
            Samma 12 givar för alla varje dag. I tävlingen deltar även datorspelare.
            För att spela tävlingen och komma med på topplistan behöver du ett konto.
          </p>
          <div className="flex flex-col items-center gap-2">
            <Link to="/logga-in">
              <Button>Logga in</Button>
            </Link>
            <Link
              to="/registrera"
              className="text-sm font-medium text-gold-200 underline underline-offset-2 hover:text-gold-100"
            >
              Skapa konto
            </Link>
          </div>
          <HemLänk />
        </div>
      </Skärm>
    )
  }

  // --- Laddar / fel / ingen tävling ----------------------------------------
  if (!resultat) {
    return <Skärm><p className="text-emerald-100/80">Hämtar dagens tävling …</p></Skärm>
  }
  if (resultat.status === 'ingen') {
    return (
      <Skärm>
        <div className="max-w-sm space-y-3 text-center">
          <h1 className="text-2xl font-semibold text-emerald-50">Dagens tävling</h1>
          <p className="text-emerald-100/80">
            Dagens givar är inte klara än. De skapas strax efter midnatt — titta in
            om en liten stund.
          </p>
          <HemLänk />
        </div>
      </Skärm>
    )
  }
  if (resultat.status === 'fel') {
    return (
      <Skärm>
        <div className="max-w-sm space-y-3 text-center">
          <h1 className="text-2xl font-semibold text-emerald-50">Dagens tävling</h1>
          <p className="text-emerald-100/80">{resultat.fel}</p>
          <HemLänk />
        </div>
      </Skärm>
    )
  }

  const tavling = resultat.tavling
  if (!framsteg) {
    return <Skärm><p className="text-emerald-100/80">Laddar framsteg …</p></Skärm>
  }

  // Vad översikten VISAR = lokalt framsteg (den här enheten, bär rondgenomgången)
  // hopslaget med serverns lista över dina inskickade givar (alla enheter). Så en
  // ny enhet känner igen givar du redan spelat och börjar inte om på giv 1.
  // OBS: bokföringen på färdig giv (nedan) skriver fortfarande bara det LOKALA
  // framsteget via framstegRef — servern är källan, localStorage bara denna enhet.
  const serverInskick = topplista?.status === 'ok' ? topplista.data.dinaInskick ?? [] : []
  const klara = slåIhopFramsteg(framsteg.klara, serverInskick)

  // --- Spela en giv (tävlingsläge i den vanliga spelskärmen) ----------------
  if (spelIndex !== null) {
    const giv = tavling.givar[spelIndex]
    // Sista given? (att slutföra just den här fyller serien.)
    const kvarEfterDenna = tavling.givar.filter(
      (g) => g.deal.board !== giv.deal.board && !klara.some((k) => k.board === g.deal.board),
    ).length
    const spel: TavlingSpel = {
      giv,
      nummer: tavling.nummer,
      board: giv.deal.board,
      total: tavling.storlek,
      sista: kvarEfterDenna === 0,
      onResultat: (r, inskick) => {
        // BOKFÖR i samma stund given är klar (ersätt ev. tidigare rad för samma
        // bricka). Läser/ skriver framstegRef så navigeringen efteråt ser den
        // uppdaterade listan även om React ännu inte hunnit rendera om. Auktionen
        // + korten sparas med (steg 5) så rondgenomgången kan återskapas.
        const rad: GivResultat = { ...r, history: inskick.history, plays: inskick.plays }
        const base = framstegRef.current?.klara ?? []
        const klara = [...base.filter((k) => k.board !== r.board), rad]
        const nytt: TavlingFramsteg = { nummer: tavling.nummer, klara }
        framstegRef.current = nytt
        saveTavlingFramsteg(nytt)
        setFramsteg(nytt)
        // Skicka in i bakgrunden; märk raden med serverns svar när det kommer.
        submitTavlingGiv(inskick).then((svar) => {
          setFramsteg((f) => {
            if (!f || f.nummer !== tavling.nummer) return f
            const uppd = f.klara.map((k) =>
              k.board === r.board ? { ...k, inskickStatus: svar.status } : k,
            )
            const nf: TavlingFramsteg = { ...f, klara: uppd }
            framstegRef.current = nf
            saveTavlingFramsteg(nf)
            return nf
          })
        })
      },
      // Efter en klar giv landar man på ÖVERSIKTEN (ägarbeslut 2026-08-11) — där
      // ser man sina framsteg + ställningen och startar nästa giv med "Fortsätt".
      onNästa: () => setSpelIndex(null),
      onÖversikt: () => setSpelIndex(null),
    }
    return <Play key={`tavling-${tavling.nummer}-${giv.deal.board}`} tavling={spel} />
  }

  // --- Granska en klar giv (steg 5): rondgenomgången ur den sparade given ----
  if (granskaBoard !== null) {
    const giv = tavling.givar.find((g) => g.deal.board === granskaBoard)
    const rad = klara.find((k) => k.board === granskaBoard)
    const tillbaka = () => setGranskaBoard(null)
    // Genomgången kräver den sparade given (kontrakt + kort). Saknas den (äldre
    // framsteg / utpassad giv) → vänligt meddelande i stället för en krasch.
    if (!giv || !rad || !rad.kontrakt || !rad.plays) {
      return (
        <Skärm>
          <div className="max-w-sm space-y-3 text-center">
            <p className="text-emerald-100/80">
              Genomgången är inte tillgänglig för den här given.
            </p>
            <button
              onClick={tillbaka}
              className="text-sm font-semibold text-gold-200 underline underline-offset-2 hover:text-gold-100"
            >
              ← Till översikten
            </button>
          </div>
        </Skärm>
      )
    }
    const g = byggGranskning(giv.deal, rad.plays, rad.kontrakt)
    return (
      <div className="min-h-[100dvh] bg-surface px-4 py-6">
        <RondRapportView
          deal={giv.deal}
          contract={g.contract}
          calls={rad.history ?? []}
          tricks={g.tricks}
          result={g.result}
          score={g.score}
          claimed={g.claimed}
          botReasons={{}}
          onBack={tillbaka}
        />
      </div>
    )
  }

  // --- Spela given igen: ÖVNINGSLÄGE (2026-08-12) ---------------------------
  // Öppnas ur giv-detaljvyn. Samma spelskärm, men KORREKTHETSKRAVET: onResultat
  // är en REN no-op — inget skickas in (submitTavlingGiv), framsteget rörs inte
  // (saveTavlingFramsteg/framstegRef orörda) → din riktiga MP% står kvar. Både
  // "Tillbaka" och en klar övningsgiv landar på detaljvyn (detaljBoard står
  // kvar bakom övningen). `övning: true` sätter märkning + knappar i Play.
  if (övningIndex !== null) {
    const giv = tavling.givar[övningIndex]
    const övningsSpel: TavlingSpel = {
      giv,
      nummer: tavling.nummer,
      board: giv.deal.board,
      total: tavling.storlek,
      sista: false,
      övning: true,
      onResultat: () => {
        /* ÖVNING — räknas inte: bokför inget, skicka inget in. */
      },
      onNästa: () => setÖvningIndex(null),
      onÖversikt: () => setÖvningIndex(null),
    }
    return (
      <Play key={`ovning-${tavling.nummer}-${giv.deal.board}`} tavling={övningsSpel} />
    )
  }

  // --- Giv-detalj (steg 6): hela fältets traveller för EN spelad giv ---------
  if (detaljBoard !== null) {
    const rad = klara.find((k) => k.board === detaljBoard)
    // Din egen rondgenomgång kräver den lokalt sparade given (kort + auktion).
    const kanGenomgang = !!(rad?.kontrakt && rad.history && rad.plays)
    return (
      <GivDetalj
        board={detaljBoard}
        kanGenomgang={kanGenomgang}
        onBack={() => setDetaljBoard(null)}
        onGenomgang={() => setGranskaBoard(detaljBoard)}
        onÖvning={() => {
          const i = tavling.givar.findIndex((g) => g.deal.board === detaljBoard)
          if (i >= 0) setÖvningIndex(i)
        }}
      />
    )
  }

  // --- Översikten -----------------------------------------------------------
  const antalKlara = klara.length
  const nästa = förstaOspelade(tavling, klara)

  return (
    <Skärm>
      <div className="w-full max-w-xl space-y-6">
        {/* Kompakt topp (ägaren 2026-08-11): titel vänster, nedräkning höger — allt
            på EN rad. Förklaringstexten ("12 givar — samma för alla …") borttagen
            för att raden ska rymmas på telefon. */}
        <header className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-emerald-50">
            Dagens tävling <span className="text-gold-300">#{tavling.nummer}</span>
          </h1>
          <Nedrakning />
        </header>

        {/* Spela nästa ospelade giv. Progress-stapeln + 12-rutnätet + "allt klart"-
            kortet borttagna (ägaren 2026-08-11 — kändes onödiga i alla lägen). Är
            allt spelat finns ingen ospelad giv → ingen knapp; sidan går direkt
            vidare till ställningen nedan. */}
        {nästa !== null && (
          <div className="flex justify-center">
            <Button onClick={() => setSpelIndex(nästa)}>
              {antalKlara === 0 ? 'Starta tävlingen →' : `Fortsätt – giv ${tavling.givar[nästa].deal.board} →`}
            </Button>
          </div>
        )}

        {/* Din ställning (steg 3) → dina givar (steg 4) → topplistan (Led 3). */}
        <DinStällning resultat={topplista} total={tavling.storlek} />
        <Resultattabell klara={klara} topplista={topplista} onÖppna={setDetaljBoard} />
        <TopplistaVy resultat={topplista} />

        <div className="flex justify-center">
          <HemLänk />
        </div>
      </div>

      {/* Uppdatera ställningen — liten knapp fast i nederkant höger. Hämtar
          topplistan på nytt (din placering, MP% och andras resultat uppdateras
          löpande under dagen) utan att ladda om hela sidan. */}
      <button
        type="button"
        onClick={() => {
          setUppdaterar(true)
          setUppdateraNonce((n) => n + 1)
        }}
        aria-label="Uppdatera ställningen"
        title="Uppdatera ställningen"
        className="fixed z-20 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-900/85 text-gold-200 shadow-lg ring-1 ring-gold-400/30 backdrop-blur transition-colors hover:bg-emerald-800 active:scale-95"
        style={{
          bottom: 'max(1rem, env(safe-area-inset-bottom))',
          right: 'max(1rem, env(safe-area-inset-right))',
        }}
      >
        <UppdateraIkon snurrar={uppdaterar} />
      </button>
    </Skärm>
  )
}

/** Cirkelpil (uppdatera). Snurrar medan en ny hämtning pågår. */
function UppdateraIkon({ snurrar }: { snurrar: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-5 w-5 ${snurrar ? 'animate-spin' : ''}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  )
}

/** Nedräkning till nästa tävling (midnatt svensk tid). Kompakt pill (klockikon +
 *  tid) så toppraden ryms på EN rad; texten "Nästa tävling om" ligger som tooltip.
 *  Tickar varje sekund och räknar ALLTID om mot Sthlm-midnatt (aldrig ett lagrat
 *  värde som kan driva) så den stämmer i alla tidszoner. */
function Nedrakning() {
  const [ms, setMs] = useState(() => msTillNastaTavling())
  useEffect(() => {
    const id = setInterval(() => setMs(msTillNastaTavling()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <span
      title="Tid kvar till nästa tävling"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-950/50 px-2.5 py-1 text-sm text-emerald-100/80 ring-1 ring-emerald-100/10"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5 text-emerald-100/55"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
      <span className="font-semibold tabular-nums text-gold-200">{formatNedrakning(ms)}</span>
    </span>
  )
}

/** Ditt eget läge överst i ställningen (UI-polish steg 3): placering + snitt-MP%.
 *  Visas när servern rankat dig (≥1 poängsatt giv) ELLER — preliminärt — när du
 *  skickat in givar men ingen poängsatts än (ensam spelare). I det preliminära
 *  läget visas 1:a / 100 % tydligt märkt "preliminär" (samma grepp som per-giv-
 *  cellen). Har du inte skickat in något alls är kortet tyst. */
function DinStällning({ resultat, total }: { resultat: TopplistaResultat | null; total: number }) {
  if (!resultat || resultat.status !== 'ok') return null
  const { du, topplista } = resultat.data
  const dinaInskick = resultat.data.dinaInskick ?? []
  // Preliminärt: inga poängsatta givar än (du null) men du HAR inskick.
  const prel = !du && dinaInskick.length > 0
  if (!du && !prel) return null

  const placering = du ? du.placering : 1
  const snitt = du ? du.snitt : 100
  const antalGivar = du ? du.antalGivar : dinaInskick.length
  const antalRankade = topplista.length
  const medalj = placering === 1 ? '🥇' : placering === 2 ? '🥈' : placering === 3 ? '🥉' : null
  return (
    <div className="w-full rounded-xl bg-gradient-to-br from-emerald-800/70 to-emerald-950/60 p-4 ring-1 ring-gold-400/30">
      <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-emerald-100/60">
        Din ställning{prel && <span className="text-gold-300/70"> · preliminär</span>}
      </p>
      <div className="flex items-stretch justify-around gap-4 text-center">
        <div className="flex flex-col items-center justify-center">
          <span className="flex items-baseline gap-1">
            {medalj && <span className="text-2xl leading-none">{medalj}</span>}
            <span className="font-brand text-4xl leading-none text-gold-200 tabular-nums">{placering}</span>
          </span>
          <span className="mt-1 text-xs text-emerald-100/60">
            {prel ? 'preliminärt' : `av ${antalRankade} spelare`}
          </span>
        </div>
        <div className="w-px self-stretch bg-emerald-100/10" />
        <div className="flex flex-col items-center justify-center">
          <span className="font-brand text-4xl leading-none text-gold-200 tabular-nums">
            {snitt.toFixed(1)}<span className="text-2xl"> %</span>
          </span>
          <span className="mt-1 text-xs text-emerald-100/60">
            {prel
              ? `${antalGivar} ${antalGivar === 1 ? 'giv inne' : 'givar inne'}`
              : `${antalGivar}/${total} givar`}
          </span>
        </div>
      </div>
      {prel && (
        <p className="mt-2 text-center text-[11px] text-emerald-100/50">
          Preliminärt tills minst 2 spelat samma giv.
        </p>
      )}
    </div>
  )
}

/** Spelförarens säte på svenska (kompakt, till kontraktscellen). */
const SÄTE_SV: Record<Seat, string> = { N: 'N', E: 'Ö', S: 'S', W: 'V' }

/** Resultatet relativt kontraktet: "=", "+1", "−2" (ur spelförarens sikt). */
function resultatText(k?: GivKontrakt | null): string {
  if (!k) return '—'
  if (k.diff === 0) return '='
  return k.diff > 0 ? `+${k.diff}` : `−${-k.diff}`
}

/** Kontraktscellen: nivå + färgsymbol (spader svart) + ev. dubbling + säte.
 *  `null` = utpassad giv; `undefined` = äldre framsteg utan kontraktsfält. */
function Kontraktscell({ k }: { k?: GivKontrakt | null }) {
  if (k === null) return <span className="text-emerald-100/50">Passad</span>
  if (!k) return <span className="text-emerald-100/40">—</span>
  return (
    <span className="inline-flex items-center gap-0.5 text-emerald-50">
      <span className="tabular-nums">{k.level}</span>
      {k.strain === 'NT' ? (
        <span className="font-semibold">NT</span>
      ) : (
        <SuitSymbol suit={k.strain} />
      )}
      {k.doubled && <span className="font-semibold text-danger">{k.doubled}</span>}
      <span className="ml-1 text-xs text-emerald-100/50">{SÄTE_SV[k.declarer]}</span>
    </span>
  )
}

/** Din resultattabell (UI-polish steg 4): en rad per spelad giv — kontrakt,
 *  resultat och din MP%. MP% kommer från serverns `dinaGivar` (matchat på
 *  bricka); en giv som ännu inte poängsatts (för få spelare) visar "väntar",
 *  och en avvisad giv en röd markör i stället för procent. */
function Resultattabell({
  klara,
  topplista,
  onÖppna,
}: {
  klara: GivResultat[]
  topplista: TopplistaResultat | null
  /** Klick på en giv → öppna dess detaljvy (travellern, steg 6). */
  onÖppna: (board: number) => void
}) {
  if (klara.length === 0) return null
  const mpPerBricka = new Map<number, number>()
  // Kontrakt/resultat från servern (auktoritativt) — fyller även givar spelade
  // före kontraktssparningen. `undefined` i mappen = servern sa inget (då
  // används det lokalt sparade kontraktet som reserv).
  const kontraktPerBricka = new Map<number, GivKontrakt | null>()
  if (topplista?.status === 'ok') {
    for (const g of topplista.data.dinaGivar) {
      mpPerBricka.set(g.board, g.procent)
      if (g.kontrakt !== undefined) kontraktPerBricka.set(g.board, g.kontrakt)
    }
  }
  const rader = [...klara].sort((a, b) => a.board - b.board)
  return (
    <div className="w-full space-y-2 rounded-xl bg-emerald-950/40 p-4 ring-1 ring-emerald-100/10">
      <h2 className="text-center font-brand text-lg text-gold-200">Dina givar</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-emerald-100/55">
              <th className="py-1 pr-2 text-left font-medium">Giv</th>
              <th className="px-2 py-1 text-left font-medium">Kontrakt</th>
              <th className="px-2 py-1 text-center font-medium">Resultat</th>
              <th className="py-1 pl-2 text-right font-medium">Din MP%</th>
            </tr>
          </thead>
          <tbody>
            {rader.map((r) => {
              const mp = mpPerBricka.get(r.board)
              const avvisad = r.inskickStatus === 'avvisad'
              // Servern har tagit emot given (men den kanske inte poängsatts än
              // för att du är ensam spelare). Då visas ett preliminärt 100 % i
              // stället för "väntar" — tydligare att resultatet ÄR inne.
              const inne = r.inskickStatus === 'godkand' || r.inskickStatus === 'redan'
              // Kontrakt/resultat: serverns värde vinner (fyller även äldre
              // givar); annars det lokalt sparade.
              const kontrakt = kontraktPerBricka.has(r.board)
                ? kontraktPerBricka.get(r.board)!
                : r.kontrakt
              // Varje spelad giv går att öppna → travellern (fältets resultat).
              const öppna = () => onÖppna(r.board)
              return (
                <tr
                  key={r.board}
                  className="cursor-pointer border-t border-emerald-100/5 hover:bg-emerald-900/30"
                  role="button"
                  tabIndex={0}
                  title="Visa fältets resultat"
                  onClick={öppna}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      öppna()
                    }
                  }}
                >
                  <td className="py-1.5 pr-2 tabular-nums text-emerald-100/70">
                    {r.board}
                    <span className="ml-1 text-gold-300/70">›</span>
                  </td>
                  <td className="px-2 py-1.5">
                    <Kontraktscell k={kontrakt} />
                  </td>
                  <td className="px-2 py-1.5 text-center tabular-nums text-emerald-50">
                    {resultatText(kontrakt)}
                  </td>
                  <td className="py-1.5 pl-2 text-right tabular-nums">
                    {avvisad ? (
                      <span className="text-danger" title="Inskicket avvisades">✗</span>
                    ) : mp !== undefined ? (
                      <span className="font-semibold text-gold-200">{mp.toFixed(0)} %</span>
                    ) : inne ? (
                      <span
                        className="font-semibold text-gold-200"
                        title="Preliminärt 100 % — du är ensam på given än; siffran kan ändras när fler spelat den"
                      >
                        100 %
                      </span>
                    ) : (
                      <span className="text-emerald-100/40">väntar</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-center text-[11px] text-emerald-100/45">Tryck på en giv för fältets resultat.</p>
    </div>
  )
}

/** Detaljvy för EN spelad giv (steg 6): hela fältets traveller (kontrakt ·
 *  resultat · MP%, din rad markerad) + väg till din egen rondgenomgång. */
function GivDetalj({
  board,
  kanGenomgang,
  onBack,
  onGenomgang,
  onÖvning,
}: {
  board: number
  kanGenomgang: boolean
  onBack: () => void
  onGenomgang: () => void
  /** Spela om given i övningsläge (räknas inte). */
  onÖvning: () => void
}) {
  const [utfall, setUtfall] = useState<GivResultatUtfall | null>(null)
  useEffect(() => {
    let active = true
    setUtfall(null)
    fetchGivResultat(board).then((u) => {
      if (active) setUtfall(u)
    })
    return () => {
      active = false
    }
  }, [board])

  return (
    <Skärm>
      <div className="w-full max-w-xl space-y-5">
        <header className="text-center">
          <h1 className="font-brand text-2xl text-emerald-50">Giv {board}</h1>
          <p className="text-sm text-emerald-100/70">Hela fältets resultat</p>
        </header>

        {!utfall ? (
          <p className="text-center text-sm text-emerald-100/60">Hämtar resultaten …</p>
        ) : utfall.status !== 'ok' ? (
          <p className="text-center text-sm text-emerald-100/70">{utfall.fel}</p>
        ) : (
          <TravellerTabell data={utfall.data} />
        )}

        <div className="flex flex-col items-center gap-3">
          {kanGenomgang && <Button onClick={onGenomgang}>Se hela given (bud + spel) →</Button>}
          {/* Spela om given i övningsläge (2026-08-12). Tydligt märkt "räknas
              inte" så det aldrig förväxlas med tävlingsresultatet. */}
          <Button variant="secondary" onClick={onÖvning}>
            🔄 Spela given igen — övning
          </Button>
          <p className="text-[11px] text-emerald-100/50">Övning räknas inte i tävlingen.</p>
          <button
            onClick={onBack}
            className="text-sm font-semibold text-emerald-100/70 underline underline-offset-2 hover:text-emerald-50"
          >
            ← Tillbaka till översikten
          </button>
        </div>
      </div>
    </Skärm>
  )
}

/** Travellern: en rad per spelare på brickan (bäst MP% först), din rad markerad. */
function TravellerTabell({ data }: { data: GivResultatSvar }) {
  if (data.resultat.length === 0) {
    return <p className="text-center text-sm text-emerald-100/70">Inga resultat än.</p>
  }
  const ensam = data.resultat.length < 2
  return (
    <div className="w-full space-y-2 rounded-xl bg-emerald-950/40 p-4 ring-1 ring-emerald-100/10">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-emerald-100/55">
              <th className="py-1 pr-2 text-left font-medium">Spelare</th>
              <th className="px-2 py-1 text-left font-medium">Kontrakt</th>
              <th className="px-2 py-1 text-center font-medium">Resultat</th>
              <th className="py-1 pl-2 text-right font-medium">MP%</th>
            </tr>
          </thead>
          <tbody>
            {data.resultat.map((r, i) => (
              <tr
                key={i}
                className={`border-t border-emerald-100/5 ${r.jag ? 'bg-gold-400/10' : ''}`}
              >
                <td className={`py-1.5 pr-2 ${r.jag ? 'font-semibold text-gold-200' : 'text-emerald-50'}`}>
                  {r.namn}
                  {r.jag && ' (du)'}
                </td>
                <td className="px-2 py-1.5">
                  <Kontraktscell k={r.kontrakt} />
                </td>
                <td className="px-2 py-1.5 text-center tabular-nums text-emerald-50">
                  {resultatText(r.kontrakt)}
                </td>
                <td className="py-1.5 pl-2 text-right font-semibold tabular-nums text-gold-200">
                  {r.procent.toFixed(0)} %
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {ensam && (
        <p className="text-center text-[11px] text-emerald-100/50">
          Väntar på fler spelare på den här given.
        </p>
      )}
    </div>
  )
}

/** Dagens topplista (provisorisk). Tyst medan den hämtas eller om servern inte
 *  har någon tävling/svarar — översikten fungerar ändå. */
function TopplistaVy({ resultat }: { resultat: TopplistaResultat | null }) {
  if (!resultat) {
    return <p className="text-center text-xs text-emerald-100/50">Hämtar ställningen …</p>
  }
  if (resultat.status !== 'ok') return null
  const { topplista, poängsattaGivar, minPerGiv } = resultat.data
  return (
    <div className="w-full space-y-2 rounded-xl bg-emerald-950/40 p-4 ring-1 ring-emerald-100/10">
      <h2 className="text-center font-brand text-lg text-gold-200">Ställningen</h2>
      {topplista.length === 0 ? (
        <p className="text-center text-sm text-emerald-100/70">
          Dina spelade givar är inne (se "Dina givar" ovan). Ställningen mot andra
          spelare visas när minst {minPerGiv} spelare spelat samma giv.
        </p>
      ) : (
        <>
          <ol className="space-y-1">
            {topplista.map((rad, i) => {
              const medalj = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null
              return (
                <li
                  key={`${rad.namn}-${i}`}
                  className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-sm ${
                    rad.jag
                      ? 'bg-gold-400/15 ring-1 ring-gold-400/40'
                      : 'bg-emerald-950/40'
                  }`}
                >
                  <span className={`flex items-center gap-2 ${rad.jag ? 'font-semibold text-gold-100' : 'text-emerald-50'}`}>
                    <span className="w-5 text-right tabular-nums text-emerald-100/60">
                      {medalj ?? `${i + 1}.`}
                    </span>
                    {rad.namn}
                    {rad.jag && <span className="text-xs text-gold-300/80">(du)</span>}
                  </span>
                  <span className="font-semibold text-gold-200">{rad.snitt.toFixed(1)} %</span>
                </li>
              )
            })}
          </ol>
          <p className="text-center text-[11px] text-emerald-100/50">
            {poängsattaGivar} {poängsattaGivar === 1 ? 'giv' : 'givar'} med tillräckligt många
            spelare · provisorisk
          </p>
        </>
      )}
      {/* Öppen redovisning (trebottarna, ägar-ja 2026-09-01): datorspelarna har
          människonamn och pekas aldrig ut — men att de finns sägs rakt ut. */}
      <p className="text-center text-[11px] text-emerald-100/50">
        I tävlingen deltar även datorspelare.
      </p>
    </div>
  )
}

/** Full-skärms grön yta (spelvyn är immersiv — ingen header). */
function Skärm({ children }: { children: React.ReactNode }) {
  return (
    <Felt className="flex min-h-[100dvh] w-full flex-col items-center justify-center rounded-none border-transparent px-5 py-10 shadow-none">
      {children}
    </Felt>
  )
}

function HemLänk() {
  return (
    <Link
      to="/"
      className="text-xs font-semibold text-emerald-100/70 underline underline-offset-2 transition-opacity hover:text-emerald-50"
    >
      ← Till startsidan
    </Link>
  )
}
