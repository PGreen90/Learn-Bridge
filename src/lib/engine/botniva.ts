// TRE TÄVLINGSBOTTAR I NIVÅER (ägarbeslut 2026-09-01) — nybörjare/medel/expert
// i dagliga tävlingen, så det alltid finns någon i sin egen styrkeklass att
// mäta sig mot.
//
// Grundlåsningar (CLAUDE.md, projektkartan):
//   • ALL nivåskillnad ligger i SYDS kortbeslut. Partner och motståndare spelas
//     alltid av standardmotorn — valideringen (validera.ts) kräver motorns bud
//     på N/Ö/V, och nattgranskningen (tavlingsgranskning.probe) replayar deras
//     kort exakt. Auktionen är därför identisk för alla nivåer.
//   • Expert = dagens bot, orörd (tomma opts → exakt samma kodväg).
//   • Svagare nivåer = spelhjärnans befintliga rattar (SmartOpts), inga nya
//     beteenderegler: MC-fönstret (maxCardsForMC), MC-budgeten (samples) och
//     signalavkodningen (decodeSignals).
//   • Människonamn utan nivåkoppling i UI:t (ägarbeslut: bara ägaren vet vilka
//     som är bottar; nivåkopplingen dokumenteras HÄR och i docs, aldrig i
//     gränssnittet). Info-raden "I tävlingen deltar även datorspelare" i
//     klienten är den öppna redovisningen.
//
// Nivårattarna mäts med netto-metoden (botniva.probe.test.ts) — EN ratt i
// taget, S6-lärdomen: bygg-mät-besluta, aldrig anta.

import type { SmartOpts } from './play-bot'

export type BotNiva = 'nyborjare' | 'medel' | 'expert'

export interface Tavlingsbot {
  /** Visningsnamn (4–10 tecken ur profiles-teckenmängden, unikt). */
  namn: string
  /** Kontots mejladress (bekräftas av admin-API:t, ingen inkorg bakom). */
  epost: string
  niva: BotNiva
  /** Tidigare visningsnamn — nattjobbet döper om kontot första gången det
   *  hittar det under det gamla namnet (slår igenom retroaktivt: listorna
   *  slår upp namn via id). */
  gammaltNamn?: string
}

/** De tre bottarna i dagliga tävlingen. Namnen är LÅSTA (ägarbeslut
 *  2026-09-01); nivåkopplingen står bara här och i dokumentationen. */
export const TAVLINGSBOTTAR: Tavlingsbot[] = [
  { namn: 'Gunnar52', epost: 'bot@rebidz.com', niva: 'expert', gammaltNamn: 'rebidz-bot' },
  { namn: 'Lasse68', epost: 'bot-lasse68@rebidz.com', niva: 'medel' },
  { namn: 'Emma03', epost: 'bot-emma03@rebidz.com', niva: 'nyborjare' },
]

/**
 * Spelhjärnans rattar per nivå — appliceras BARA på de säten Syd styr
 * (spelaBotGiv). Tomt objekt = standardmotorn (expert).
 *
 *   • expert: dagens bot, orörd.
 *   • medel: litet MC-fönster (4 i st.f. 8 kort), stramare budget (8 sampel i
 *     st.f. adaptiva 30/24/12) och ingen avkodning av partnerns markeringar —
 *     spelar fortfarande "med huvudet" i det sena slutspelet men missar mer.
 *     Fönster 4 är MÄTT fram (botniva.probe, frö 20260902 — kommandot i
 *     probens filhuvud): på 24 givar gav fönster 6 +1 (≈ ingen skillnad,
 *     FÖRKASTAD), fönster 5 gav 0, fönster 4 gav −2, fönster 0 gav −6;
 *     bekräftat på 48 givar: medel −8, nybörjare −18 — mätbart isär i rätt
 *     ordning.
 *   • nybörjare: ingen Monte-Carlo alls (maxCardsForMC 0) — enbart de ärliga
 *     tumreglerna (botCard), som en nybörjare som följer grundprinciperna.
 *     Utspelsdoktrinen (trick 1) gäller alla nivåer — den ligger före
 *     MC-fönstret och är nybörjarstoff i verkligheten också.
 */
export function nivaSmartOpts(niva: BotNiva): SmartOpts {
  switch (niva) {
    case 'expert':
      return {}
    case 'medel':
      return { maxCardsForMC: 4, samples: 8, decodeSignals: false }
    case 'nyborjare':
      return { maxCardsForMC: 0 }
  }
}
