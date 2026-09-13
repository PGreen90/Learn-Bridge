// Vilken tävlingsdag frågar anropet efter? (Påbyggnad 3, 2026-09-13 —
// tävlingshistoriken.) Läs-endpointsen (dagens-tavling, topplista,
// giv-resultat) var låsta till idag; nu tar de `?dag=YYYY-MM-DD` för en
// tidigare dag. Framtida dagar och ogiltiga strängar avvisas (→ 400 hos
// kallaren) — morgondagens givar ligger redan i databasen (förscreeningen)
// och får ALDRIG lämnas ut i förväg.

import { stockholmDateISO } from '../../src/lib/engine/daily'

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
