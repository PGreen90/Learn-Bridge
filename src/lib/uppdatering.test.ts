// Facit för "appen uppdaterar sig själv på lugna sidor" (ägarbeslut 2026-11-12):
// den som öppnar rebidz ska få nya versionen utan att behöva trycka Uppdatera —
// men en pågående giv, en övning eller halvskriven text får ALDRIG kastas.

// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { farUppdateraSjalv, lugnSida } from './uppdatering'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('lugnSida', () => {
  it('startsidan och läs-sidorna är lugna', () => {
    for (const p of ['/', '/om', '/budsystem', '/sa-bjuder-rebidz', '/budtraning']) {
      expect(lugnSida(p), p).toBe(true)
    }
  })

  it('allt där man spelar, övar eller skriver är INTE lugnt', () => {
    for (const p of [
      '/spela-kort',
      '/spela-kort/tavling', // översikten OCH given ligger på samma adress
      '/spela-kort/tavling/historik', // övningsomspel ligger här
      '/bord/ABC234',
      '/budtraning/oppna-eller-passa', // mitt i en övning
      '/budvisning',
      '/logga-in',
      '/registrera',
      '/konto',
      '/spela-med-vanner',
    ]) {
      expect(lugnSida(p), p).toBe(false)
    }
  })
})

describe('farUppdateraSjalv', () => {
  it('lugn sida utan något öppet → ja', () => {
    expect(farUppdateraSjalv('/', document)).toBe(true)
  })

  it('en öppen dialog (t.ex. Tyck till) stoppar uppdateringen', () => {
    document.body.innerHTML = '<div role="dialog"><textarea></textarea></div>'
    expect(farUppdateraSjalv('/', document)).toBe(false)
  })

  it('ett fält med fokus stoppar uppdateringen', () => {
    document.body.innerHTML = '<input id="f" />'
    ;(document.getElementById('f') as HTMLInputElement).focus()
    expect(farUppdateraSjalv('/om', document)).toBe(false)
  })

  it('en sida som inte är lugn → nej, oavsett', () => {
    expect(farUppdateraSjalv('/spela-kort', document)).toBe(false)
  })
})
