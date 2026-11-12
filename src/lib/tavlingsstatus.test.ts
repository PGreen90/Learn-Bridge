// Facit för startsidans tävlingsstatus (UI/UX-punkt 2, 2026-11-12): kortet ska
// säga VAR man står i tävlingen — inte tre gånger "Kräver konto".

import { describe, expect, it } from 'vitest'
import { dailyNumber, guldNummer, veckansMandag, stockholmDateISO } from './engine/daily'
import { tavlingsStatus } from './tavlingsstatus'

const NU = new Date('2026-11-12T10:00:00Z') // torsdag
const idagNr = dailyNumber(NU)
const klara = (n: number) => Array.from({ length: n }, (_, i) => ({ board: i + 1 }))

describe('tavlingsStatus', () => {
  it('inget sparat → standardtexten', () => {
    expect(tavlingsStatus('mp', null, NU)).toEqual({ text: '12 givar', lage: 'ny' })
    expect(tavlingsStatus('imp', null, NU)).toEqual({ text: '12 givar', lage: 'ny' })
  })

  it('guld utan framsteg säger hur länge den är öppen', () => {
    expect(tavlingsStatus('guld', null, NU)).toEqual({ text: 'Öppen till söndag', lage: 'ny' })
  })

  it('påbörjad i dag → "x av 12 spelade"', () => {
    expect(tavlingsStatus('mp', { nummer: idagNr, klara: klara(5) }, NU)).toEqual({
      text: '5 av 12 spelade',
      lage: 'pagar',
    })
  })

  it('alla tolv spelade → klar', () => {
    expect(tavlingsStatus('imp', { nummer: idagNr, klara: klara(12) }, NU)).toEqual({
      text: 'Klar ✓',
      lage: 'klar',
    })
  })

  it('gårdagens framsteg räknas inte — ny dag börjar rent', () => {
    expect(tavlingsStatus('mp', { nummer: idagNr - 1, klara: klara(12) }, NU).lage).toBe('ny')
  })

  it('noll klara i dagens tävling är inte "påbörjad"', () => {
    expect(tavlingsStatus('mp', { nummer: idagNr, klara: [] }, NU).lage).toBe('ny')
  })

  it('guld följer VECKANS nummer, inte dagens', () => {
    const veckoNr = guldNummer(veckansMandag(stockholmDateISO(NU)))
    expect(tavlingsStatus('guld', { nummer: veckoNr, klara: klara(3) }, NU).text).toBe('3 av 12 spelade')
    expect(tavlingsStatus('guld', { nummer: veckoNr - 1, klara: klara(12) }, NU).lage).toBe('ny')
  })

  it('trasigt sparat värde fäller inte startsidan', () => {
    expect(tavlingsStatus('mp', { nummer: idagNr } as never, NU).lage).toBe('ny')
    expect(tavlingsStatus('mp', 'skräp' as never, NU).lage).toBe('ny')
  })
})
