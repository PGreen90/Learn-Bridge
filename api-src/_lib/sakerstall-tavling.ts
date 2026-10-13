// "SE TILL ATT DAGENS TÄVLING FINNS" — nattkedjans härdning (ägarbeslut
// 2026-10-13: "mer stabilt och pålitligt").
//
// Natten till 2026-10-13 skapade Vercel-cronen (generera-dagens-givar.ts)
// ingen tävling: dess egen rest() gjorde ETT databasanrop och kastade på första
// 5xx, cronen körs en gång per dygn utan omförsök, och nästa led (nattbottarna)
// kunde bara konstatera "Ingen tävling" och bli rött. Dagen räddades för hand.
//
// Nu är det här EN delad funktion med två anropare:
//   • cronen (23:05 UTC) — den normala vägen, nu med omförsök;
//   • nattbottarna (tavlingsbot.probe.test.ts) — självläkning: innan de spelar
//     anropar de samma funktion. Finns tävlingen är det två verkningslösa
//     skrivningar; saknas den skapas set + givar ur samma hemlighet och
//     frönyckel → exakt samma givar som cronen hade gett (och som valideringen
//     spelar om). Ingen kan skilja en självläkt dag från en vanlig.
//
// IDEMPOTENT hela vägen: upsert på unika (comp_date, form) och insert med
// ignore-duplicates på unika (set_id, board). Därför är omförsök ofarliga — och
// ett set som blev utan givar efter ett halvt haveri läks av nästa anrop.

import type { TavlingsForm } from '../../src/lib/engine/matchpoints'
import { genereraGivar } from './generera'
import { fronyckel } from './seed'
import { restGet, restPost } from './supabase-rest'

/** Antal brickor per tävling (Beslut B: EN 12-givarstävling, per form). */
export const TÄVLINGSSTORLEK = 12

export interface TavlingsSet {
  /** daily_sets.id */
  id: string
  size: number
  /** true = fanns inte före anropet (självläkning / första körningen idag). */
  skapad: boolean
  brickor: number[]
}

export interface SakerstallOpts {
  /** Max antal försök per databasanrop (standard 4). */
  forsok?: number
  /** Grundpaus mellan försöken, växer linjärt (standard 500 ms). */
  pausMs?: number
}

/**
 * Läser dagens set för `form`; skriver sedan set + alla givar idempotent, med
 * omförsök på 5xx/429/nätfel. Kastar på 4xx direkt och efter sista försöket —
 * med tabellnamn + status i felet, så loggen säger VAR det small.
 */
export async function sakerstallTavling(
  base: string,
  key: string,
  secret: string,
  dateISO: string,
  nummer: number,
  form: TavlingsForm,
  opts: SakerstallOpts = {},
): Promise<TavlingsSet> {
  const forsok = opts.forsok ?? 4
  const pausMs = opts.pausMs ?? 500

  const fanns = (await restGet(
    base,
    key,
    `daily_sets?comp_date=eq.${dateISO}&form=eq.${form}&select=id,size`,
    forsok,
    {},
    pausMs,
  )) as Array<{ id: string; size: number }>
  const fannsForut = Array.isArray(fanns) && fanns.length > 0

  const deals = genereraGivar(secret, fronyckel(dateISO, form), TÄVLINGSSTORLEK)

  const setSvar = await restPost(
    base,
    key,
    `daily_sets?on_conflict=${encodeURIComponent('comp_date,form')}`,
    [{ comp_date: dateISO, form, size: TÄVLINGSSTORLEK, daily_number: nummer }],
    forsok,
    { Prefer: 'resolution=merge-duplicates,return=representation' },
    pausMs,
  )
  if (!setSvar.ok) throw new Error(`daily_sets: ${setSvar.status} ${await setSvar.text()}`)
  const sets = (await setSvar.json()) as Array<{ id: string }>
  const id = sets?.[0]?.id
  if (!id) throw new Error('daily_sets gav inget id tillbaka')

  const givSvar = await restPost(
    base,
    key,
    `daily_deals?on_conflict=${encodeURIComponent('set_id,board')}`,
    deals.map((d) => ({
      set_id: id,
      board: d.board,
      dealer: d.dealer,
      vulnerability: d.vulnerability,
      hands: d.hands,
    })),
    forsok,
    { Prefer: 'resolution=ignore-duplicates,return=minimal' },
    pausMs,
  )
  if (!givSvar.ok) throw new Error(`daily_deals: ${givSvar.status} ${await givSvar.text()}`)

  return {
    id,
    size: fannsForut ? fanns[0].size : TÄVLINGSSTORLEK,
    skapad: !fannsForut,
    brickor: deals.map((d) => d.board),
  }
}
