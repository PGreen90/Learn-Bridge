// Beslut B etapp 4 (4C) — närvarodomaren: vem är kvar, vem tar boten över,
// vilka begäranden auto-godkänns och när flyttas värdskapet.
//
// REN modul med injicerad klocka — hjärtslags-endpointen (bord.ts) läser
// stolarna + de väntande begärandena, frågar hit och VERKSTÄLLER besluten
// (PATCH + händelser). Alla tidsregler är ägarbeslut 2026-08-17:
//   • Frånkoppling ~45 s utan hjärtslag → boten tar stolen (automatiskt —
//     ofrivillig frånvaro kräver inget godkännande; kommer spelaren tillbaka
//     återtas stolen automatiskt vid nästa hjärtslag).
//   • Paus-/lämna-begäranden godkänns av ägaren; svarar ägaren inte inom
//     ~60 s godkänns de automatiskt (bordet får inte fastna).
//   • Ägaren borta > 60 s → värdskapet flyttas till människan som suttit
//     längst (äldst joined). Finns ingen aktiv människa händer inget — bordet
//     står stilla tills någon återvänder eller städningen tar det.

import type { Stol } from './bord-grund'

export const FRANVARO_MS = 45_000
export const AUTO_GODKANN_MS = 60_000

export interface NarvaroStol {
  stol: Stol
  userId: string | null
  typ: 'bot' | 'manniska'
  status: 'aktiv' | 'paus' | 'borta'
  /** Senaste hjärtslaget (ms-epoch), null = aldrig sedd. */
  lastSeen: number | null
  /** När människan satte sig (ms-epoch) — ägarbytets tur-ordning. */
  joined: number | null
}

export interface NarvaroBegaran {
  stol: Stol
  slag: 'paus' | 'lamna'
  /** När begäran gjordes (ms-epoch). */
  sedan: number
}

export type NarvaroBeslut =
  | { slag: 'bot-tar-over'; stol: Stol }
  | { slag: 'godkann'; stol: Stol; begaran: 'paus' | 'lamna' }
  | { slag: 'agarbyte'; tillUserId: string }

/** Domsluten för ett hjärtslag. Ordningen är medveten: frånvaro först (så
 *  ägarbytet ser färska statusar), sedan auto-godkännanden, sist ägarbytet. */
export function narvaroBeslut(
  stolar: NarvaroStol[],
  begaranden: NarvaroBegaran[],
  ownerId: string,
  nu: number,
): NarvaroBeslut[] {
  const beslut: NarvaroBeslut[] = []
  const borta = new Set<Stol>()

  // 1) Frånvaro: aktiv människa utan hjärtslag på FRANVARO_MS → boten tar över.
  for (const s of stolar) {
    if (s.typ !== 'manniska' || !s.userId || s.status !== 'aktiv') continue
    if (s.lastSeen !== null && nu - s.lastSeen > FRANVARO_MS) {
      beslut.push({ slag: 'bot-tar-over', stol: s.stol })
      borta.add(s.stol)
    }
  }

  // 2) Obesvarade begäranden äldre än AUTO_GODKANN_MS godkänns automatiskt.
  for (const b of begaranden) {
    if (nu - b.sedan > AUTO_GODKANN_MS) {
      beslut.push({ slag: 'godkann', stol: b.stol, begaran: b.slag })
    }
  }

  // 3) Ägarbyte: ägaren utan hjärtslag på AUTO_GODKANN_MS → äldsta aktiva
  //    människan tar värdskapet. (Ägare som LÄMNAR hanteras direkt i
  //    lämna-flödet, inte här.)
  const agare = stolar.find((s) => s.userId === ownerId)
  if (
    agare &&
    agare.lastSeen !== null &&
    nu - agare.lastSeen > AUTO_GODKANN_MS
  ) {
    const kandidater = stolar
      .filter(
        (s) =>
          s.typ === 'manniska' &&
          s.userId &&
          s.userId !== ownerId &&
          s.status === 'aktiv' &&
          !borta.has(s.stol),
      )
      .sort((a, b) => (a.joined ?? Infinity) - (b.joined ?? Infinity))
    if (kandidater.length) beslut.push({ slag: 'agarbyte', tillUserId: kandidater[0].userId! })
  }

  return beslut
}

/** De väntande begärandena ur givens händelseflöde: senaste begäran per stol
 *  som saknar ett senare svar. Händelserna kommer i seq-ordning. */
export function vantandeBegaranden(
  handelser: Array<{ typ: string; seat: Stol | null; data: unknown; tidMs: number }>,
): NarvaroBegaran[] {
  const perStol = new Map<Stol, NarvaroBegaran | null>()
  for (const h of handelser) {
    if (!h.seat) continue
    if (h.typ === 'paus-begaran') perStol.set(h.seat, { stol: h.seat, slag: 'paus', sedan: h.tidMs })
    else if (h.typ === 'lamna-begaran')
      perStol.set(h.seat, { stol: h.seat, slag: 'lamna', sedan: h.tidMs })
    else if (h.typ === 'paus-svar' || h.typ === 'lamna-svar') perStol.set(h.seat, null)
    else if (h.typ === 'stol') {
      // Stolen bytte ägare/frigjordes → gamla begäranden är inaktuella.
      const handling = (h.data as { handling?: string } | null)?.handling
      if (handling === 'lamnade' || handling === 'satte-sig' || handling === 'bot-tar-over') {
        perStol.set(h.seat, null)
      }
    }
  }
  return [...perStol.values()].filter((b): b is NarvaroBegaran => b !== null)
}
