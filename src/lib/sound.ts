// Ljuden i kortspelet (etapp 4, "känsla i kortspelet", ägarbeslut 2026-07-28):
// tre diskreta, SYNTETISERADE ljud via Web Audio — inga ljudfiler, inga nya
// beroenden, ingen PWA-ändring. Standard PÅ, toggle i spelbordets ⋮-meny.
//
// Recepten (allt lågmält, gain ≤ 0.15 — det ska kännas, inte höras "om"):
//   card  — kort brusknäpp genom lågpass ~1,8 kHz, 50 ms: kort mot filtduk.
//   sweep — 200 ms brus genom bandpass som glider 400→1200 Hz: ett svisch.
//   deal  — tre snabba tick med stigande ton: given är serverad.
//
// Webbläsarnas autoplay-policy: en AudioContext får bara starta i en riktig
// användargest. armSound() kopplas därför till pointerdown (Play-sidan) och
// är billig + idempotent. Allt no-op:ar tyst där Web Audio saknas (jsdom) —
// ljudet får ALDRIG kunna krascha spelet.

import { loadSound, saveSound } from './backend'

export type SoundKind = 'card' | 'sweep' | 'deal'

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
      // Given är serverad: tre korta tick med stigande ton.
      const freqs = [660, 830, 1040]
      freqs.forEach((f, i) => {
        const t = t0 + i * 0.09
        const osc = ctx!.createOscillator()
        osc.type = 'triangle'
        osc.frequency.value = f
        const g = ctx!.createGain()
        g.gain.setValueAtTime(0.08, t)
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.06)
        osc.connect(g).connect(ctx!.destination)
        osc.start(t)
        osc.stop(t + 0.07)
      })
    }
  } catch {
    // Ett ljud som inte kan spelas ska aldrig störa spelet.
  }
}
