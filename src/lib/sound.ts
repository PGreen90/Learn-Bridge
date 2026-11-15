// Ljuden i kortspelet (etapp 4, "känsla i kortspelet", ägarbeslut 2026-07-28):
// tre diskreta, SYNTETISERADE ljud via Web Audio — inga ljudfiler, inga nya
// beroenden, ingen PWA-ändring. Standard PÅ, toggle i spelbordets ⋮-meny.
//
// Recepten (allt lågmält, gain ≤ 0.15 — det ska kännas, inte höras "om"):
//   card  — kort brusknäpp genom lågpass ~1,8 kHz, 50 ms: kort mot filtduk.
//   sweep — 200 ms brus genom bandpass som glider 400→1200 Hz: ett svisch.
//   deal  — tre snabba tick med stigande ton: given är serverad.
// Etapp D (2026-11-15) — fem till, ännu lägre (gain ≤ 0.07), samma av/på-val:
//   turn        — en mjuk ton: bordet väntar på DIG.
//   trickWon    — två korta stigande toner: din sida tog sticket.
//   trickLost   — en dov ton: motståndarna tog det.
//   resultGood  — fyra stigande toner: given slutade bra för dig.
//   resultBad   — två fallande toner: den gjorde det inte.
// Sticktonerna börjar 120 ms in så de inte krockar med fjärde kortets knäpp.
//
// Webbläsarnas autoplay-policy: en AudioContext får bara starta i en riktig
// användargest. armSound() kopplas därför till pointerdown (Play-sidan) och
// är billig + idempotent. Allt no-op:ar tyst där Web Audio saknas (jsdom) —
// ljudet får ALDRIG kunna krascha spelet.

import { loadSound, saveSound } from './backend'

export type SoundKind =
  | 'card'
  | 'sweep'
  | 'deal'
  | 'turn'
  | 'trickWon'
  | 'trickLost'
  | 'resultGood'
  | 'resultBad'

/** Tonrecepten: [frekvens Hz, start s, längd s, gain]. */
const TONER: Partial<Record<SoundKind, { typ: OscillatorType; noter: [number, number, number, number][] }>> = {
  deal: { typ: 'triangle', noter: [[660, 0, 0.06, 0.08], [830, 0.09, 0.06, 0.08], [1040, 0.18, 0.06, 0.08]] },
  turn: { typ: 'sine', noter: [[880, 0, 0.09, 0.05]] },
  trickWon: { typ: 'sine', noter: [[660, 0.12, 0.07, 0.05], [880, 0.2, 0.09, 0.05]] },
  trickLost: { typ: 'triangle', noter: [[330, 0.12, 0.12, 0.045]] },
  resultGood: { typ: 'triangle', noter: [[523, 0, 0.16, 0.07], [659, 0.11, 0.16, 0.07], [784, 0.22, 0.16, 0.07], [1047, 0.33, 0.24, 0.07]] },
  resultBad: { typ: 'triangle', noter: [[392, 0, 0.22, 0.06], [330, 0.17, 0.3, 0.06]] },
}

/** Kort vibration när DITT kort spelas (etapp D). Bara där webbläsaren stöder
 *  det (Android — iPhone saknar stödet); tyst no-op annars. Följer ljudvalet:
 *  anroparen frågar `sound` först. */
export function vibrera(): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(12)
  } catch {
    // Får aldrig störa spelet.
  }
}

let ctx: AudioContext | null = null

/** Finns Web Audio i den här miljön? (jsdom: nej → allt no-op:ar) */
function available(): boolean {
  return typeof AudioContext === 'function'
}

/** Skapa/väck ljudmotorn — anropas från en pointerdown (autoplay-policyn).
 *  Idempotent och billig: säkert att koppla till varje klick. */
export function armSound(): void {
  if (!available()) return
  try {
    if (!ctx) ctx = new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    ctx = null // ingen ljudmotor → playSound no-op:ar
  }
}

/** Av/på-valet, sparat under learnbridge:sound (standard PÅ). */
export function isSoundEnabled(): boolean {
  return loadSound()
}

export function setSoundEnabled(on: boolean): void {
  saveSound(on)
}

/** En buffert med vitt brus — råvaran för knäppen och sveppet. */
function noiseBuffer(c: AudioContext, seconds: number): AudioBuffer {
  const buf = c.createBuffer(1, Math.max(1, Math.ceil(c.sampleRate * seconds)), c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buf
}

/** Spela ett av ljuden. Kräver att armSound() hunnit köras i en användargest —
 *  annars (eller utan Web Audio) händer ingenting, tyst och ofarligt. */
export function playSound(kind: SoundKind): void {
  if (!ctx || ctx.state !== 'running') return
  try {
    const t0 = ctx.currentTime
    if (kind === 'card') {
      // Kort mot filt: 50 ms brusknäpp, dovt genom lågpasset.
      const src = ctx.createBufferSource()
      src.buffer = noiseBuffer(ctx, 0.05)
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 1800
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.15, t0)
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.05)
      src.connect(lp).connect(g).connect(ctx.destination)
      src.start(t0)
      src.stop(t0 + 0.06)
    } else if (kind === 'sweep') {
      // Svischet: brus genom ett bandpass som glider uppåt medan det tonar ut.
      const src = ctx.createBufferSource()
      src.buffer = noiseBuffer(ctx, 0.2)
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.Q.value = 1
      bp.frequency.setValueAtTime(400, t0)
      bp.frequency.exponentialRampToValueAtTime(1200, t0 + 0.2)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t0)
      g.gain.exponentialRampToValueAtTime(0.1, t0 + 0.05)
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.2)
      src.connect(bp).connect(g).connect(ctx.destination)
      src.start(t0)
      src.stop(t0 + 0.21)
    } else {
      // Tonljuden (given serverad, din tur, stick, resultat): korta toner ur
      // recepten i TONER — mjuk ansats så de aldrig knäpper.
      const recept = TONER[kind]
      if (!recept) return
      for (const [f, start, langd, gain] of recept.noter) {
        const t = t0 + start
        const osc = ctx.createOscillator()
        osc.type = recept.typ
        osc.frequency.value = f
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.0001, t)
        g.gain.exponentialRampToValueAtTime(gain, t + 0.012)
        g.gain.exponentialRampToValueAtTime(0.001, t + langd)
        osc.connect(g).connect(ctx.destination)
        osc.start(t)
        osc.stop(t + langd + 0.01)
      }
    }
  } catch {
    // Ett ljud som inte kan spelas ska aldrig störa spelet.
  }
}
