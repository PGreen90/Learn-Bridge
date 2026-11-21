// Övningsomspelets fiktiva jämförelse i resultatdialogen (ägarönskemål
// 2026-11-21): när en tävlingsgiv spelats om i övningsläge visas vad
// resultatet HADE gett mot fältet, bredvid det riktiga tävlingsresultatet.
// Räkningen bor i lib/engine/ovningsjamforelse.ts; den här filen hämtar
// fältets resultat (samma endpoint som resultatlistan) och ritar rutan.
//
// Ingenting skickas in och ingenting sparas — rutan är en ren läsning. Går
// hämtningen inte (utloggad, nätfel) eller har ingen annan spelat given ritas
// ingenting: övningen fungerar precis som förut.

import { useEffect, useState } from 'react'
import { fiktivJamforelse, type FaltRad, type OvningsJamforelse } from '../../lib/engine/ovningsjamforelse'
import { raknesatt } from '../../lib/engine/matchpoints'
import { fetchGivResultat, givTal, talText, type TavlingsForm } from '../../lib/backend/tavling'

export interface JamforelseText {
  /** Det riktiga tävlingstalet, t.ex. "31 %" / "−3.0 IMP". null = saknas. */
  tavling: string | null
  /** Övningens fiktiva tal. */
  ovning: string
  /** "47 procentenheter bättre" / "2.5 IMP sämre" / "Samma resultat". null =
   *  inget riktigt tal att jämföra med. */
  skillnad: string | null
  riktning: 'upp' | 'ner' | 'lika' | null
}

/** Texterna i rutan, i formens enhet. MP visas i hela procent (som i
 *  resultatlistan) och skillnaden räknas på de VISADE talen, så raden alltid
 *  går ihop för ögat; IMP med en decimal. */
export function jamforelseText(j: OvningsJamforelse, form: TavlingsForm | undefined): JamforelseText {
  const imp = raknesatt(form) === 'imp'
  const visat = (tal: number) => (imp ? Math.round(tal * 10) / 10 : Math.round(tal))
  const text = (tal: number) => (imp ? `${talText(tal, 'imp', 1)} IMP` : `${talText(tal, 'mp', 0)} %`)
  const ovning = text(j.ovning)
  if (j.tavling === null) return { tavling: null, ovning, skillnad: null, riktning: null }
  const diff = visat(j.ovning) - visat(j.tavling)
  const storlek = imp ? Math.abs(diff).toFixed(1) : String(Math.abs(diff))
  const enhet = imp ? 'IMP' : Math.abs(diff) === 1 ? 'procentenhet' : 'procentenheter'
  const riktning = Math.abs(diff) < 0.05 ? 'lika' : diff > 0 ? 'upp' : 'ner'
  const skillnad =
    riktning === 'lika' ? 'Samma resultat' : `${storlek} ${enhet} ${riktning === 'upp' ? 'bättre' : 'sämre'}`
  return { tavling: text(j.tavling), ovning, skillnad, riktning }
}

/** Rutan i resultatdialogen (ljus panel). `nsScore` = övningens N/S-poäng. */
export function OvningsJamforelseRuta({
  board,
  dag,
  form,
  nsScore,
  demoFalt,
}: {
  board: number
  /** Tävlingsdag (historiken); utelämnad = pågående tävling. */
  dag?: string
  form?: TavlingsForm
  nsScore: number
  /** DEV-förhandsvisning: ett påhittat fält i stället för hämtningen. */
  demoFalt?: FaltRad[]
}) {
  const [j, setJ] = useState<OvningsJamforelse | null>(null)
  useEffect(() => {
    let active = true
    setJ(null)
    if (demoFalt) {
      setJ(fiktivJamforelse(demoFalt, nsScore, form))
      return
    }
    fetchGivResultat(board, dag, form).then((u) => {
      if (!active || u.status !== 'ok') return
      setJ(
        fiktivJamforelse(
          u.data.resultat.map((r) => ({ jag: r.jag, nsScore: r.nsScore, tal: givTal(r) })),
          nsScore,
          u.data.form ?? form,
        ),
      )
    })
    return () => {
      active = false
    }
  }, [board, dag, form, nsScore, demoFalt])

  if (!j) return null
  const t = jamforelseText(j, form)
  const farg = t.riktning === 'upp' ? 'text-accent' : t.riktning === 'ner' ? 'text-danger' : 'text-ink-muted'
  return (
    <section
      aria-label="Fiktiv jämförelse mot fältet"
      className="mb-3 rounded-lg bg-panel-2 px-3 py-2 text-center"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Fiktivt mot fältet</p>
      <p className="mt-0.5 text-sm tabular-nums text-ink">
        {t.tavling && (
          <>
            Tävlingen <span className="font-semibold">{t.tavling}</span>
            <span aria-hidden="true" className="mx-1.5 text-ink-muted">→</span>
          </>
        )}
        Övningen <span className="font-bold">{t.ovning}</span>
      </p>
      {t.skillnad && <p className={`text-sm font-semibold ${farg}`}>{t.skillnad}</p>}
      <p className="mt-0.5 text-[11px] text-ink-muted">
        Mot {j.andra} {j.andra === 1 ? 'annan spelare' : 'andra spelare'} · räknas inte i tävlingen
      </p>
    </section>
  )
}
