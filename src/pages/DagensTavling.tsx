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
//
// Dagens IMP (ägarbeslut 2026-09-26, docs/imp-tavling-plan.md): samma sida bär
// BÅDA tävlingarna — `?form=imp` är IMP-tävlingen (egna givar, egen ställning,
// eget framsteg i localStorage), utan parameter MP% som förr. Formen går med i
// varje hämtning och inskick; sidan monteras om (key) när den byts.

import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import { Button } from '../components/Button'
import { loadTavlingFramsteg, saveTavlingFramsteg } from '../lib/backend'
import { formatNedrakning, msTillNastaTavling } from '../lib/engine/daily'
import {
  fetchDagensTavling,
  fetchTopplista,
  behöverSkickasOm,
  inskickUrFramsteg,
  slåIhopFramsteg,
  submitTavlingGiv,
  formTitel,
  type BrickaRad,
  type DagensTavling as TavlingData,
  type GivResultat,
  type InskickStatus,
  type TavlingFramsteg,
  type TavlingInskick,
  type TavlingsForm,
  type TavlingsResultat,
  type TopplistaResultat,
} from '../lib/backend/tavling'
import { Play } from './Play'
import { RondRapportView } from './play/RondRapport'
import { byggGranskning } from './play/granska-tavling'
import type { TavlingSpel } from './play/tavling-mode'
import { MOTORSTAMPEL } from '../lib/build'
import { GivGranskning } from './tavling/GivGranskning'
import {
  DinStällning,
  GivDetalj,
  HemLänk,
  Resultattabell,
  Skärm,
  TopplistaVy,
} from './tavling/TavlingDelar'

/** Index i givar-listan för den första ospelade given, eller null om alla är
 *  klara. Robust mot ordning: matchar på bricknummer, inte listindex. */
function förstaOspelade(tavling: TavlingData, klara: GivResultat[]): number | null {
  const klaraBrickor = new Set(klara.map((k) => k.board))
  const i = tavling.givar.findIndex((g) => !klaraBrickor.has(g.deal.board))
  return i === -1 ? null : i
}

/** Sidan: läser tävlingsformen ur `?form=` och monterar om innehållet när den
 *  byts (key), så framsteg/spelläge/ställning aldrig läcker mellan MP och IMP. */
export function DagensTavling() {
  const [params] = useSearchParams()
  const form: TavlingsForm = params.get('form') === 'imp' ? 'imp' : 'mp'
  return <DagensTavlingInner key={form} form={form} />
}

function DagensTavlingInner({ form }: { form: TavlingsForm }) {
  const titel = formTitel(form)
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
  // Genomgången "Så spelade X given" (Påbyggnad 3): vilken spelares rad i
  // travellern som stegas igenom, null = ingen. `rapport` = din EGEN givs
  // rondgenomgång med förklaringar (steg 5), öppnas ur genomgången.
  const [granska, setGranska] = useState<{ board: number; rad: BrickaRad } | null>(null)
  const [rapport, setRapport] = useState<{ board: number; rad: BrickaRad } | null>(null)
  // Dagens topplista (hämtas på översikten).
  const [topplista, setTopplista] = useState<TopplistaResultat | null>(null)
  // Räknare som tvingar en ny hämtning av topplistan (uppdatera-knappen bumpar den);
  // `uppdaterar` snurrar ikonen medan den nya hämtningen pågår.
  const [uppdateraNonce, setUppdateraNonce] = useState(0)
  const [uppdaterar, setUppdaterar] = useState(false)
  // Bumpas när en omsändning av tappade inskick landat, så topplistan hämtas
  // om och den omsända given får sin MP% (2026-09-13).
  const [omsäntNonce, setOmsäntNonce] = useState(0)
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
    fetchDagensTavling(undefined, form).then((r) => {
      if (active) setResultat(r)
    })
    return () => {
      active = false
    }
  }, [signedIn, form])

  // När tävlingen laddats: läs in lokala framsteg (bara om de hör till DAGENS
  // tävlingsnummer — gårdagens framsteg återupptas aldrig).
  useEffect(() => {
    if (!resultat || resultat.status !== 'ok') return
    const nummer = resultat.tavling.nummer
    const sparat = loadTavlingFramsteg(form)
    setFramsteg(sparat && sparat.nummer === nummer ? sparat : { nummer, klara: [] })
  }, [resultat, form])

  // OMSÄNDNING (2026-09-13): ett inskick som aldrig kom fram (nätfel, tillfälligt
  // serverfel → status 'fel', eller sidan laddades om mitt i → inget svar)
  // låg förr kvar för evigt som "spelad" lokalt medan servern saknade given —
  // travellern svarade 403 och given räknades aldrig. Nu skickas sådana givar om
  // när sidan öppnas och när uppdatera-knappen trycks. "Första inskicket står"
  // på servern gör omsändningen ofarlig (409 → 'redan').
  useEffect(() => {
    if (!resultat || resultat.status !== 'ok') return
    const nummer = resultat.tavling.nummer
    const f = framstegRef.current?.nummer === nummer ? framstegRef.current : loadTavlingFramsteg(form)
    if (!f || f.nummer !== nummer) return
    const osända = f.klara.filter(behöverSkickasOm)
    if (osända.length === 0) return
    let active = true
    ;(async () => {
      const statusar = new Map<number, InskickStatus>()
      for (const rad of osända) {
        const inskick = inskickUrFramsteg(rad, form)
        if (!inskick) continue
        const svar = await submitTavlingGiv(inskick)
        statusar.set(rad.board, svar.status)
      }
      if (!active) return
      setFramsteg((prev) => {
        if (!prev || prev.nummer !== nummer) return prev
        const klara = prev.klara.map((k) =>
          statusar.has(k.board) ? { ...k, inskickStatus: statusar.get(k.board) } : k,
        )
        const nf: TavlingFramsteg = { ...prev, klara }
        framstegRef.current = nf
        saveTavlingFramsteg(nf, form)
        return nf
      })
      if ([...statusar.values()].some((s) => s !== 'fel')) setOmsäntNonce((n) => n + 1)
    })()
    return () => {
      active = false
    }
  }, [resultat, uppdateraNonce, form])

  // Hämta topplistan när översikten visas (och efter varje giv man kommer
  // tillbaka från) — den uppdateras löpande under dagen.
  useEffect(() => {
    if (!resultat || resultat.status !== 'ok' || spelIndex !== null) return
    let active = true
    fetchTopplista(undefined, form).then((t) => {
      if (active) {
        setTopplista(t)
        setUppdaterar(false)
      }
    })
    return () => {
      active = false
    }
  }, [resultat, spelIndex, uppdateraNonce, omsäntNonce, form])

  // --- Grindar: konto krävs -------------------------------------------------
  if (authLoading) {
    return <Skärm><p className="text-emerald-100/80">Laddar …</p></Skärm>
  }
  if (!signedIn) {
    return (
      <Skärm>
        <div className="max-w-sm space-y-4 text-center">
          <h1 className="text-2xl font-semibold text-emerald-50">{titel}</h1>
          <p className="text-emerald-100/80">
            {form === 'imp'
              ? 'Samma 12 givar för alla varje dag, räknade i IMP. '
              : 'Samma 12 givar för alla varje dag. '}
            I tävlingen deltar även datorspelare.
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
    return <Skärm><p className="text-emerald-100/80">Hämtar {titel} …</p></Skärm>
  }
  if (resultat.status === 'ingen') {
    return (
      <Skärm>
        <div className="max-w-sm space-y-3 text-center">
          <h1 className="text-2xl font-semibold text-emerald-50">{titel}</h1>
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
          <h1 className="text-2xl font-semibold text-emerald-50">{titel}</h1>
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
      form,
      board: giv.deal.board,
      total: tavling.storlek,
      sista: kvarEfterDenna === 0,
      onResultat: (r, oStamplat) => {
        // Motorstämpeln sätts HÄR, i spelögonblicket (inte vid sändningen) — se
        // build.ts. Formen går med så servern väljer rätt set + frönyckel.
        const inskick: TavlingInskick = {
          ...oStamplat,
          form,
          ...(MOTORSTAMPEL ? { motor: MOTORSTAMPEL } : {}),
        }
        // BOKFÖR i samma stund given är klar (ersätt ev. tidigare rad för samma
        // bricka). Läser/ skriver framstegRef så navigeringen efteråt ser den
        // uppdaterade listan även om React ännu inte hunnit rendera om. Auktionen
        // + korten sparas med (steg 5) så rondgenomgången kan återskapas.
        const rad: GivResultat = { ...r, history: inskick.history, plays: inskick.plays, declarerTricks: inskick.declarerTricks, motor: inskick.motor }
        const base = framstegRef.current?.klara ?? []
        const klara = [...base.filter((k) => k.board !== r.board), rad]
        const nytt: TavlingFramsteg = { nummer: tavling.nummer, klara }
        framstegRef.current = nytt
        saveTavlingFramsteg(nytt, form)
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
            saveTavlingFramsteg(nf, form)
            return nf
          })
        })
      },
      // Efter en klar giv landar man på ÖVERSIKTEN (ägarbeslut 2026-08-11) — där
      // ser man sina framsteg + ställningen och startar nästa giv med "Fortsätt".
      onNästa: () => setSpelIndex(null),
      onÖversikt: () => setSpelIndex(null),
    }
    return <Play key={`tavling-${form}-${tavling.nummer}-${giv.deal.board}`} tavling={spel} />
  }

  // --- Din egen rondgenomgång med förklaringar (steg 5), öppnad ur genomgången.
  // Serverns payload (auktion + kort ur travellern) vinner — så den fungerar
  // även på en annan enhet än den du spelade på; det lokala framsteget är reserv.
  if (rapport !== null) {
    const giv = tavling.givar.find((g) => g.deal.board === rapport.board)
    const lokal = klara.find((k) => k.board === rapport.board)
    const kontrakt = rapport.rad.kontrakt ?? lokal?.kontrakt
    const plays = rapport.rad.plays ?? lokal?.plays
    const history = rapport.rad.history ?? lokal?.history ?? []
    const tillbaka = () => setRapport(null)
    if (!giv || !kontrakt || !plays) {
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
              ← Tillbaka
            </button>
          </div>
        </Skärm>
      )
    }
    const g = byggGranskning(giv.deal, plays, kontrakt)
    return (
      <div className="min-h-[100dvh] bg-surface px-4 py-6">
        <RondRapportView
          deal={giv.deal}
          contract={g.contract}
          calls={history}
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

  // --- "Så spelade X given" (Påbyggnad 3): stega vilken spelares giv som helst.
  if (granska !== null) {
    const giv = tavling.givar.find((g) => g.deal.board === granska.board)
    if (giv) {
      return (
        <GivGranskning
          deal={giv.deal}
          rad={granska.rad}
          onBack={() => setGranska(null)}
          onRapport={granska.rad.jag ? () => setRapport(granska) : undefined}
        />
      )
    }
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
      form,
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
      <Play key={`ovning-${form}-${tavling.nummer}-${giv.deal.board}`} tavling={övningsSpel} />
    )
  }

  // --- Giv-detalj (steg 6): hela fältets traveller för EN spelad giv ---------
  if (detaljBoard !== null) {
    return (
      <GivDetalj
        board={detaljBoard}
        form={form}
        onBack={() => setDetaljBoard(null)}
        onGranska={(rad) => setGranska({ board: detaljBoard, rad })}
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
            {titel} <span className="text-gold-300">#{tavling.nummer}</span>
          </h1>
          <Nedrakning />
        </header>

        {/* Den andra dagliga tävlingen (Dagens IMP, 2026-09-26) — en länk, så man
            aldrig undrar var den andra formen tog vägen. */}
        <div className="-mt-3 flex justify-center">
          <Link
            to={form === 'imp' ? '/spela-kort/tavling' : '/spela-kort/tavling?form=imp'}
            className="text-xs font-semibold text-emerald-100/70 underline underline-offset-2 hover:text-emerald-50"
          >
            {form === 'imp' ? 'Till Dagens MP% →' : 'Till Dagens IMP →'}
          </Link>
        </div>

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
        <Resultattabell klara={klara} topplista={topplista} onÖppna={setDetaljBoard} form={form} />
        <TopplistaVy resultat={topplista} />

        {/* Tidigare dagar + medaljtabellen (Påbyggnad 3, etapp D3). */}
        <div className="flex justify-center">
          <Link
            to={form === 'imp' ? '/spela-kort/tavling/historik?form=imp' : '/spela-kort/tavling/historik'}
            className="text-sm font-semibold text-gold-200 underline underline-offset-2 hover:text-gold-100"
          >
            Tidigare tävlingar & medaljer →
          </Link>
        </div>

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
