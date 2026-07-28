// Tempot i kortspelet — ENDA sanningen om spelfasens tider (ägarbeslut
// 2026-07-28, "känsla i kortspelet"). Alla botpauser och animationslängder
// hämtas härifrån och skalas av hastighetsvalet i ⋮-menyn. Tester importerar
// konstanterna härifrån — aldrig magiska tal i testkod.

export type PlaySpeed = 'lugn' | 'normal' | 'snabb'

/** Skalfaktor per hastighetsval: lugnare = längre pauser, snabbare = kortare. */
export const SPEED_FACTOR: Record<PlaySpeed, number> = {
  lugn: 1.45,
  normal: 1,
  snabb: 0.55,
}

/** Knapptexterna i ⋮-menyns temporad. */
export const SPEED_LABEL: Record<PlaySpeed, string> = {
  lugn: 'Lugn',
  normal: 'Normal',
  snabb: 'Snabb',
}

/** Bastiderna (ms) vid Normal. Skala ALLTID via ms() — aldrig direkt. */
export const BASE = {
  /** Botens paus innan den lägger ett kort (snabba tumregelsvägen). */
  botDelay: 750,
  /** Minsta synliga "tänketid" för Monte-Carlo-svar — snabba svar från
   *  webworkern ska inte teleportera in. Watchdogen (15 s) skalas INTE. */
  mcFloor: 500,
  /** Kortflygningen hand → bordet (etapp 3). */
  flight: 280,
  /** Paus med vinnarmarkering innan sticket sveps ihop (etapp 2). */
  sweepHold: 900,
  /** Själva svepet mot vinnarens sida (etapp 2). */
  sweepSlide: 450,
  /** Claim: hur länge alla händer ligger uppe innan resultatet (etapp 5). */
  claimReveal: 2500,
  /** Bordets uttoning innan resultatdialogen (etapp 5). */
  resultOutro: 500,
  /** Giv-klar-ljudet: efter deal-in-kaskadens slut (13 kort × 35 ms + 300 ms). */
  dealSoundDelay: 760,
} as const

/** En bastid skalad efter hastighetsvalet, avrundad till hela ms. */
export function ms(key: keyof typeof BASE, speed: PlaySpeed): number {
  return Math.round(BASE[key] * SPEED_FACTOR[speed])
}

/** Har användaren bett systemet om minskad rörelse? (Flygning/svep hoppar då
 *  över det visuella; pacing-timers körs ändå så spelet förblir spelbart.) */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}
