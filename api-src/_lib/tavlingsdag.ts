// Vilken tävlingsdag frågar anropet efter? (Påbyggnad 3, 2026-09-13 —
// tävlingshistoriken.) Läs-endpointsen (dagens-tavling, topplista,
// giv-resultat) var låsta till idag; nu tar de `?dag=YYYY-MM-DD` för en
// tidigare dag. Framtida dagar och ogiltiga strängar avvisas (→ 400 hos
// kallaren) — morgondagens givar ligger redan i databasen (förscreeningen)
// och får ALDRIG lämnas ut i förväg.

import { stockholmDateISO, veckansMandag } from '../../src/lib/engine/daily'
import type { TavlingsForm } from '../../src/lib/engine/matchpoints'

export interface Tavlingsdag {
  /** ISO-datum (YYYY-MM-DD, Stockholmsdygn). */
  dag: string
  /** Sant när dagen är dagens tävling (då gäller tjuvkiks-grinden m.m.). */
  idag: boolean
}

const ISO_DAG = /^\d{4}-\d{2}-\d{2}$/

/** Tolka `?dag=` ur en URL: saknas → idag; giltigt datum ≤ idag → den dagen;
 *  allt annat → 'ogiltig'. `nu` kan pinnas i tester. */
export function lasDag(url: URL, nu: Date = new Date()): Tavlingsdag | 'ogiltig' {
  const idag = stockholmDateISO(nu)
  const rå = url.searchParams.get('dag')
  if (rå === null || rå === '') return { dag: idag, idag: true }
  if (!ISO_DAG.test(rå)) return 'ogiltig'
  // Kalendergiltigt? (2026-02-30 ska inte slinka igenom till databasen.)
  const d = new Date(`${rå}T12:00:00Z`)
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== rå) return 'ogiltig'
  if (rå > idag) return 'ogiltig'
  return { dag: rå, idag: rå === idag }
}

/** Tolka tävlingsformen (Dagens IMP, ägarbeslut 2026-09-26) ur `?form=` eller
 *  ur en kropps-sträng: saknas/tom → 'mp' (bakåtkompatibelt — alla gamla
 *  klienter menar MP-tävlingen), 'mp'/'imp' → den formen, allt annat →
 *  'ogiltig' (→ 400 hos kallaren). */
export function lasForm(rå: unknown): TavlingsForm | 'ogiltig' {
  if (rå === null || rå === undefined || rå === '') return 'mp'
  return rå === 'mp' || rå === 'imp' || rå === 'guld' ? rå : 'ogiltig'
}

/**
 * Tävlingens datum i databasen för en form (Veckans stjärntävling, 2026-11-11).
 * De dagliga formerna: dagen själv, oförändrat. Guld: veckans MÅNDAG — tävlingen
 * ligger som ETT set med comp_date = måndagen och är öppen hela veckan. Vilken
 * dag i veckan anropet än gäller pekar det på samma set, och `idag` betyder då
 * "veckan pågår" (tjuvkiksgrinden m.m. gäller hela veckan, inte bara måndagen).
 */
export function tavlingsdagFor(form: TavlingsForm, vald: Tavlingsdag, nu: Date = new Date()): Tavlingsdag {
  if (form !== 'guld') return vald
  const dag = veckansMandag(vald.dag)
  return { dag, idag: dag === veckansMandag(stockholmDateISO(nu)) }
}
