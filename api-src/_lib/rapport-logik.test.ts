// Facit för den öppna rapportmottagaren (nästa nivå etapp 1, 2026-11-11):
// vem som helst får skicka felrapport/förslag/"Tyck till" utan konto, så
// granskningen på servern är enda skyddet mellan internet och ärendelistan.

import { describe, expect, it } from 'vitest'
import { anonymNyckel, granskaRapport, kallarIp, MAX_TEXT, MAX_TITEL } from './rapport-logik'

const bra = { typ: 'felrapport', titel: 'Felrapport: Felaktig budgivning (bricka 5, 3NT av N)', text: 'Nord borde inte öppnat 1NT.' }

describe('granskaRapport', () => {
  it('släpper igenom en riktig felrapport med etiketten felrapport', () => {
    const g = granskaRapport(bra)
    expect(g).toEqual({ ok: true, typ: 'felrapport', etikett: 'felrapport', titel: bra.titel, text: bra.text })
  })

  it('förslag och Tyck till får egna etiketter — de blandas aldrig med felrapporterna', () => {
    const f = granskaRapport({ typ: 'forslag', titel: 'Förslag: jag hade bjudit annorlunda (bricka 2, 4H av S)', text: 'x' })
    expect(f.ok && 'etikett' in f && f.etikett).toBe('forslag')
    const t = granskaRapport({ typ: 'tycktill', titel: 'Tyck till', text: 'Mer träning!' })
    expect(t.ok && 'etikett' in t && t.etikett).toBe('tyck-till')
  })

  it('titeln måste börja som typen säger — annars kan vem som helst skriva egna rubriker', () => {
    expect(granskaRapport({ ...bra, titel: 'Köp billiga klockor' })).toMatchObject({ ok: false, status: 400 })
    expect(granskaRapport({ typ: 'forslag', titel: 'Felrapport: x', text: 'x' })).toMatchObject({ ok: false, status: 400 })
  })

  it('okänd typ, tom text och fel form avvisas', () => {
    expect(granskaRapport({ ...bra, typ: 'annat' })).toMatchObject({ ok: false, status: 400 })
    expect(granskaRapport({ ...bra, text: '   ' })).toMatchObject({ ok: false, status: 400 })
    expect(granskaRapport(null)).toMatchObject({ ok: false, status: 400 })
    expect(granskaRapport('hej')).toMatchObject({ ok: false, status: 400 })
  })

  it('för lång titel eller text avvisas med 413', () => {
    expect(granskaRapport({ ...bra, titel: 'Felrapport: ' + 'a'.repeat(MAX_TITEL) })).toMatchObject({ ok: false, status: 413 })
    expect(granskaRapport({ ...bra, text: 'a'.repeat(MAX_TEXT + 1) })).toMatchObject({ ok: false, status: 413 })
  })

  it('lockfällan: ifyllt dolt fält = robot → tyst kvitto, inget skickas vidare', () => {
    expect(granskaRapport({ ...bra, webbplats: 'http://spam.example' })).toEqual({ ok: true, tyst: true })
  })

  it('@-omnämnanden oskadliggörs så ingen på GitHub får en notis', () => {
    const g = granskaRapport({ ...bra, titel: 'Felrapport: hej @octocat', text: 'ping @octocat och mejl a@b.se' })
    if (!g.ok || 'tyst' in g) throw new Error('skulle släppas igenom')
    expect(g.titel).not.toMatch(/@\w/)
    expect(g.text).not.toMatch(/@\w/)
    expect(g.text).toContain('octocat')
  })

  it('titeln blir alltid EN rad', () => {
    const g = granskaRapport({ ...bra, titel: 'Felrapport: rad ett\nrad två' })
    if (!g.ok || 'tyst' in g) throw new Error('skulle släppas igenom')
    expect(g.titel).not.toContain('\n')
  })

  it('den maskinläsbara given överlever granskningen orörd', () => {
    const block = '```felrapport\nversion: 1\nhand N: S:AKQ4 H:32 D:QJ2 C:T987\nbudgivning: 1NT P 3NT P P P\n```'
    const g = granskaRapport({ ...bra, text: block })
    if (!g.ok || 'tyst' in g) throw new Error('skulle släppas igenom')
    expect(g.text).toBe(block)
  })
})

describe('anonymNyckel', () => {
  const dag = '2026-11-11'
  it('ger en uuid-formad nyckel som aldrig innehåller IP-adressen', () => {
    const n = anonymNyckel('hemlig', '203.0.113.7', dag)
    expect(n).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    expect(n).not.toContain('203')
  })

  it('samma adress samma dag = samma nyckel; annan adress, dag eller hemlighet = annan', () => {
    const n = anonymNyckel('hemlig', '203.0.113.7', dag)
    expect(anonymNyckel('hemlig', '203.0.113.7', dag)).toBe(n)
    expect(anonymNyckel('hemlig', '203.0.113.8', dag)).not.toBe(n)
    expect(anonymNyckel('hemlig', '203.0.113.7', '2026-11-12')).not.toBe(n)
    expect(anonymNyckel('annan', '203.0.113.7', dag)).not.toBe(n)
  })
})

describe('kallarIp', () => {
  it('tar första adressen i x-forwarded-for, annars x-real-ip, annars "okand"', () => {
    expect(kallarIp({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' })).toBe('203.0.113.7')
    expect(kallarIp({ 'x-real-ip': '198.51.100.2' })).toBe('198.51.100.2')
    expect(kallarIp({})).toBe('okand')
  })
})
