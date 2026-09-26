// Tävlingshistoriken + medaljtabellen (Påbyggnad 3, ägarönskemål 2026-09-13,
// etapp D3): "hur gick det igår och tidigare?"
//
// Två vyer i samma sida, styrda av `?dag=`:
//   · LISTVYN (ingen ?dag): medaljtabellen (topp 5 i guld/silver/brons över
//     alla dagar, bottarna räknas inte — sägs rakt ut) + alla avslutade dagar
//     med din placering. Klick på en dag → dagvyn.
//   · DAGVYN (?dag=YYYY-MM-DD, delbar länk): den dagens Din ställning +
//     ställning (slutlig) + alla brickor; klick på en bricka → travellern
//     (GivDetalj) → klick på en spelare → genomgången (GivGranskning). Samma
//     delade vyer som dagens tävling (tavling/TavlingDelar.tsx), bara med `dag`.
//     Övningsläget ("Spela given igen") finns även här — det skickar aldrig in.
//
// Kräver konto (som tävlingen). Under /spela-kort så vyn är immersiv.
//
// Dagens IMP (ägarbeslut 2026-09-26): `?form=imp` visar IMP-tävlingens dagar
// och medaljtabell (en medaljtabell per form); utan parameter MP% som förr.
// Listvyn har en växling MP% / IMP.

import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import { Button } from '../components/Button'
import {
  enhetText,
  fetchDagensTavling,
  fetchTavlingHistorik,
  fetchTopplista,
  formTitel,
  givTal,
  talText,
  type TavlingsForm,
  type BrickaRad,
  type HistorikDag,
  type HistorikResultat,
  type Medaljrad,
  type TavlingsResultat,
  type TopplistaResultat,
} from '../lib/backend/tavling'
import { Play } from './Play'
import type { TavlingSpel } from './play/tavling-mode'
import { GivGranskning } from './tavling/GivGranskning'
import { DinStällning, GivDetalj, HemLänk, Kontraktscell, resultatText, Skärm, TopplistaVy } from './tavling/TavlingDelar'

const MÅNAD = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

/** "12 sep" ur YYYY-MM-DD (deterministiskt, ingen locale-magi). */
export function kortDatum(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${d} ${MÅNAD[(m ?? 1) - 1] ?? ''}`
}

/** Svensk ordningsföljd: 1:a, 2:a, 3:e, 4:e … */
export function placeringText(n: number): string {
  return `${n}:${n === 1 || n === 2 ? 'a' : 'e'}`
}

export function TavlingHistorik() {
  const { loading: authLoading, signedIn } = useAuth()
  const [params, setParams] = useSearchParams()
  const dag = params.get('dag')
  const form: TavlingsForm = params.get('form') === 'imp' ? 'imp' : 'mp'
  const formParam: Record<string, string> = form === 'imp' ? { form: 'imp' } : {}

  if (authLoading) return null
  if (!signedIn) {
    return (
      <Skärm>
        <div className="max-w-sm space-y-4 text-center">
          <h1 className="font-brand text-2xl text-emerald-50">Tidigare tävlingar</h1>
          <p className="text-emerald-100/80">Historiken och medaljtabellen kräver ett konto.</p>
          <Link to="/logga-in" className="inline-block">
            <Button>Logga in</Button>
          </Link>
          <div>
            <HemLänk />
          </div>
        </div>
      </Skärm>
    )
  }
  if (dag) return <Dagvy key={`${form}-${dag}`} dag={dag} form={form} onTillbaka={() => setParams(formParam)} />
  return (
    <Listvy
      key={form}
      form={form}
      onVäljDag={(d) => setParams({ ...formParam, dag: d })}
      onVäljForm={(f) => setParams(f === 'imp' ? { form: 'imp' } : {})}
    />
  )
}

// ---------------------------------------------------------------------------
// Listvyn: medaljtabellen + dagarna
// ---------------------------------------------------------------------------

function Listvy({
  form,
  onVäljDag,
  onVäljForm,
}: {
  form: TavlingsForm
  onVäljDag: (dag: string) => void
  onVäljForm: (form: TavlingsForm) => void
}) {
  const [historik, setHistorik] = useState<HistorikResultat | null>(null)
  useEffect(() => {
    let active = true
    fetchTavlingHistorik(form).then((h) => {
      if (active) setHistorik(h)
    })
    return () => {
      active = false
    }
  }, [form])

  return (
    <Skärm>
      <div className="w-full max-w-xl space-y-6">
        <header className="text-center">
          <h1 className="font-brand text-2xl text-emerald-50">Tidigare tävlingar</h1>
          <p className="text-sm text-emerald-100/70">Alla dagar sparas — och medaljerna räknas.</p>
        </header>

        {/* Växlingen MP% / IMP (Dagens IMP, 2026-09-26): dagarna OCH
            medaljtabellen hör till en form i taget. */}
        <div className="flex justify-center gap-2" role="tablist" aria-label="Tävlingsform">
          {(['mp', 'imp'] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={f === form}
              onClick={() => onVäljForm(f)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold ring-1 transition-colors ${
                f === form
                  ? 'bg-gold-400/20 text-gold-100 ring-gold-400/50'
                  : 'bg-emerald-950/40 text-emerald-100/70 ring-emerald-100/10 hover:bg-emerald-900/40'
              }`}
            >
              {formTitel(f)}
            </button>
          ))}
        </div>

        {!historik ? (
          <p className="text-center text-sm text-emerald-100/60">Hämtar historiken …</p>
        ) : historik.status !== 'ok' ? (
          <p className="text-center text-sm text-emerald-100/70">{historik.fel}</p>
        ) : (
          <>
            <Medaljtabell medaljer={historik.data.medaljer} />
            <Daglista dagar={historik.data.dagar} form={form} onVälj={onVäljDag} />
          </>
        )}

        <div className="flex flex-col items-center gap-2">
          <Link
            to={form === 'imp' ? '/spela-kort/tavling?form=imp' : '/spela-kort/tavling'}
            className="text-sm font-semibold text-gold-200 underline underline-offset-2 hover:text-gold-100"
          >
            ← {formTitel(form)}
          </Link>
          <HemLänk />
        </div>
      </div>
    </Skärm>
  )
}

/** Topp 5 i guld/silver/brons. Datorspelarna räknas inte — sägs rakt ut. */
function Medaljtabell({ medaljer }: { medaljer: Medaljrad[] }) {
  return (
    <div className="w-full space-y-2 rounded-xl bg-emerald-950/40 p-4 ring-1 ring-emerald-100/10">
      <h2 className="text-center font-brand text-lg text-gold-200">Medaljtabellen</h2>
      {medaljer.length === 0 ? (
        <p className="text-center text-sm text-emerald-100/70">
          Inga medaljer utdelade än — de räknas när en tävlingsdag avslutats.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-emerald-100/55">
              <th className="py-1 pr-2 text-left font-medium">Spelare</th>
              <th className="px-2 py-1 text-center font-medium">🥇</th>
              <th className="px-2 py-1 text-center font-medium">🥈</th>
              <th className="px-2 py-1 text-center font-medium">🥉</th>
            </tr>
          </thead>
          <tbody>
            {medaljer.map((m, i) => (
              <tr key={`${m.namn}-${i}`} className={`border-t border-emerald-100/5 ${m.jag ? 'bg-gold-400/10' : ''}`}>
                <td className={`py-1.5 pr-2 ${m.jag ? 'font-semibold text-gold-200' : 'text-emerald-50'}`}>
                  <span className="mr-2 inline-block w-4 text-right tabular-nums text-emerald-100/60">{i + 1}.</span>
                  {m.namn}
                  {m.jag && <span className="ml-1 text-xs text-gold-300/80">(du)</span>}
                </td>
                <td className="px-2 py-1.5 text-center tabular-nums text-emerald-50">{m.guld}</td>
                <td className="px-2 py-1.5 text-center tabular-nums text-emerald-50">{m.silver}</td>
                <td className="px-2 py-1.5 text-center tabular-nums text-emerald-50">{m.brons}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="text-center text-[11px] text-emerald-100/60">
        Topp 5 · guld/silver/brons = plats 1/2/3 en tävlingsdag med minst två spelare · datorspelare
        räknas inte i medaljtabellen.
      </p>
    </div>
  )
}

/** Alla avslutade dagar, nyast först, med din placering. */
function Daglista({ dagar, form, onVälj }: { dagar: HistorikDag[]; form: TavlingsForm; onVälj: (dag: string) => void }) {
  if (dagar.length === 0) {
    return <p className="text-center text-sm text-emerald-100/70">Inga avslutade tävlingsdagar än.</p>
  }
  return (
    <div className="w-full space-y-2 rounded-xl bg-emerald-950/40 p-4 ring-1 ring-emerald-100/10">
      <h2 className="text-center font-brand text-lg text-gold-200">Tävlingsdagar</h2>
      <ol className="space-y-1">
        {dagar.map((d) => {
          const välj = () => onVälj(d.dag)
          const medalj =
            d.du?.placering === 1 ? '🥇' : d.du?.placering === 2 ? '🥈' : d.du?.placering === 3 ? '🥉' : null
          return (
            <li
              key={d.dag}
              role="button"
              tabIndex={0}
              title={`Visa tävling #${d.nummer}`}
              onClick={välj}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  välj()
                }
              }}
              className="flex cursor-pointer items-center justify-between gap-3 rounded-lg bg-emerald-950/40 px-3 py-2 text-sm hover:bg-emerald-900/30"
            >
              <span className="text-emerald-50">
                <span className="text-emerald-100/60">#{d.nummer}</span> · {kortDatum(d.dag)}
                {!d.slutlig && <span className="ml-1 text-[11px] text-emerald-100/60">(provisorisk)</span>}
              </span>
              <span className="flex items-center gap-2 tabular-nums">
                {d.du ? (
                  <>
                    {medalj && <span>{medalj}</span>}
                    <span className="text-emerald-50">
                      {placeringText(d.du.placering)}
                      {d.antalSpelare !== null && <span className="text-emerald-100/60"> av {d.antalSpelare}</span>}
                    </span>
                    <span className="font-semibold text-gold-200">{talText(d.du.snitt, form, 1)} {enhetText(form)}</span>
                  </>
                ) : (
                  <span className="text-emerald-100/60">spelade inte</span>
                )}
                <span className="text-gold-300/70">›</span>
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dagvyn: en avslutad dag — ställning, brickor, traveller, genomgång, övning
// ---------------------------------------------------------------------------

function Dagvy({ dag, form, onTillbaka }: { dag: string; form: TavlingsForm; onTillbaka: () => void }) {
  const [tavling, setTavling] = useState<TavlingsResultat | null>(null)
  const [topplista, setTopplista] = useState<TopplistaResultat | null>(null)
  const [detaljBoard, setDetaljBoard] = useState<number | null>(null)
  const [granska, setGranska] = useState<{ board: number; rad: BrickaRad } | null>(null)
  const [övningBoard, setÖvningBoard] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    setTavling(null)
    setTopplista(null)
    setDetaljBoard(null)
    setGranska(null)
    fetchDagensTavling(dag, form).then((t) => {
      if (active) setTavling(t)
    })
    fetchTopplista(dag, form).then((t) => {
      if (active) setTopplista(t)
    })
    return () => {
      active = false
    }
  }, [dag, form])

  if (!tavling) {
    return (
      <Skärm>
        <p className="text-sm text-emerald-100/60">Hämtar tävlingen {kortDatum(dag)} …</p>
      </Skärm>
    )
  }
  if (tavling.status !== 'ok') {
    return (
      <Skärm>
        <div className="max-w-sm space-y-3 text-center">
          <p className="text-emerald-100/80">
            {tavling.status === 'ingen' ? 'Ingen tävling den dagen.' : tavling.fel}
          </p>
          <button onClick={onTillbaka} className="text-sm font-semibold text-gold-200 underline underline-offset-2">
            ← Alla tävlingsdagar
          </button>
        </div>
      </Skärm>
    )
  }
  const t = tavling.tavling

  // Övningsläge (räknas inte): samma spelskärm, onResultat är en no-op.
  if (övningBoard !== null) {
    const giv = t.givar.find((g) => g.deal.board === övningBoard)
    if (giv) {
      const spel: TavlingSpel = {
        giv,
        nummer: t.nummer,
        form,
        board: giv.deal.board,
        total: t.storlek,
        sista: false,
        övning: true,
        onResultat: () => {
          /* ÖVNING — räknas inte: bokför inget, skicka inget in. */
        },
        onNästa: () => setÖvningBoard(null),
        onÖversikt: () => setÖvningBoard(null),
      }
      return <Play key={`historik-ovning-${form}-${t.nummer}-${giv.deal.board}`} tavling={spel} />
    }
  }

  if (granska !== null) {
    const giv = t.givar.find((g) => g.deal.board === granska.board)
    if (giv) {
      return <GivGranskning deal={giv.deal} rad={granska.rad} onBack={() => setGranska(null)} />
    }
  }

  if (detaljBoard !== null) {
    return (
      <GivDetalj
        board={detaljBoard}
        dag={dag}
        form={form}
        onBack={() => setDetaljBoard(null)}
        onGranska={(rad) => setGranska({ board: detaljBoard, rad })}
        onÖvning={() => setÖvningBoard(detaljBoard)}
      />
    )
  }

  return (
    <Skärm>
      <div className="w-full max-w-xl space-y-6">
        <header className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-emerald-50">
            {form === 'imp' ? 'IMP' : 'MP%'} <span className="text-gold-300">#{t.nummer}</span>
          </h1>
          <span className="text-sm text-emerald-100/70">{kortDatum(t.dag)}</span>
        </header>

        <DinStällning resultat={topplista} total={t.storlek} />
        <Bricklista tavling={t} topplista={topplista} form={form} onÖppna={setDetaljBoard} />
        <TopplistaVy resultat={topplista} />

        <div className="flex flex-col items-center gap-2">
          <button onClick={onTillbaka} className="text-sm font-semibold text-gold-200 underline underline-offset-2 hover:text-gold-100">
            ← Alla tävlingsdagar
          </button>
          <HemLänk />
        </div>
      </div>
    </Skärm>
  )
}

/** Alla brickor den dagen: ditt kontrakt/resultat/MP% där du spelade, annars
 *  "spelade inte". Alla är klickbara → travellern (en avslutad dag har inget
 *  att tjuvkika på). */
function Bricklista({
  tavling,
  topplista,
  form,
  onÖppna,
}: {
  tavling: { givar: Array<{ deal: { board: number } }> }
  topplista: TopplistaResultat | null
  form: TavlingsForm
  onÖppna: (board: number) => void
}) {
  const data = topplista?.status === 'ok' ? topplista.data : null
  const imp = form === 'imp'
  const mp = new Map(data?.dinaGivar.map((g) => [g.board, givTal(g)]) ?? [])
  const kontrakt = new Map(data?.dinaInskick.map((i) => [i.board, i.kontrakt]) ?? [])
  return (
    <div className="w-full space-y-2 rounded-xl bg-emerald-950/40 p-4 ring-1 ring-emerald-100/10">
      <h2 className="text-center font-brand text-lg text-gold-200">Givarna</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-emerald-100/55">
              <th className="py-1 pr-2 text-left font-medium">Giv</th>
              <th className="px-2 py-1 text-left font-medium">Ditt kontrakt</th>
              <th className="px-2 py-1 text-center font-medium">Resultat</th>
              <th className="py-1 pl-2 text-right font-medium">{imp ? 'Dina IMP' : 'Din MP%'}</th>
            </tr>
          </thead>
          <tbody>
            {tavling.givar.map((g) => {
              const board = g.deal.board
              const spelad = kontrakt.has(board)
              const k = kontrakt.get(board)
              const procent = mp.get(board)
              const öppna = () => onÖppna(board)
              return (
                <tr
                  key={board}
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
                    {board}
                    <span className="ml-1 text-gold-300/70">›</span>
                  </td>
                  <td className="px-2 py-1.5">
                    {spelad ? <Kontraktscell k={k} /> : <span className="text-emerald-100/60">spelade inte</span>}
                  </td>
                  <td className="px-2 py-1.5 text-center tabular-nums text-emerald-50">{spelad ? resultatText(k) : ''}</td>
                  <td className="py-1.5 pl-2 text-right tabular-nums">
                    {procent !== undefined ? (
                      <span className="font-semibold text-gold-200">
                        {talText(procent, form, imp ? 1 : 0)}{imp ? '' : ' %'}
                      </span>
                    ) : (
                      <span className="text-emerald-100/60">{spelad ? '—' : ''}</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-center text-[11px] text-emerald-100/60">Tryck på en giv för fältets resultat.</p>
    </div>
  )
}
