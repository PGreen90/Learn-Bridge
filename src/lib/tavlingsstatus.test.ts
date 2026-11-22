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
    expect(tavlingsStatus('mp', null, NU)).toEqual({ text: '12 givar', lage: 'ny', antal: 0 })
    expect(tavlingsStatus('imp', null, NU)).toEqual({ text: '12 givar', lage: 'ny', antal: 0 })
  })

  it('guld utan framsteg säger hur länge den är öppen', () => {
    expect(tavlingsStatus('guld', null, NU)).toEqual({ text: 'Öppen till söndag', lage: 'ny', antal: 0 })
  })

  it('påbörjad i dag → "x av 12 spelade"', () => {
    expect(tavlingsStatus('mp', { nummer: idagNr, klara: klara(5) }, NU)).toEqual({
      text: '5 av 12 spelade',
      lage: 'pagar',
      antal: 5,
    })
  })

  it('alla tolv spelade → klar', () => {
    expect(tavlingsStatus('imp', { nummer: idagNr, klara: klara(12) }, NU)).toEqual({
      text: 'Klar ✓',
      lage: 'klar',
      antal: 12,
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

// Läget följer KONTOT, inte enheten (ägarbeslut 2026-11-22): spelade man klart
// på telefonen ska datorn inte säga "Spela". Servern svarar med antal inskickade
// givar per pågående tävling; startsidan tar det HÖGSTA av lokalt och server.
describe('tavlingsStatus med serverns läge', () => {
  it('inget lokalt men servern har tolv → klar', () => {
    expect(tavlingsStatus('mp', null, NU, { nummer: idagNr, antal: 12 }).lage).toBe('klar')
  })

  it('inget lokalt men servern har fem → påbörjad med rätt antal', () => {
    expect(tavlingsStatus('imp', null, NU, { nummer: idagNr, antal: 5 })).toEqual({
      text: '5 av 12 spelade',
      lage: 'pagar',
      antal: 5,
    })
  })

  it('lokalt ligger före servern (inskick på väg) → det lokala gäller', () => {
    const s = tavlingsStatus('mp', { nummer: idagNr, klara: klara(7) }, NU, { nummer: idagNr, antal: 6 })
    expect(s.antal).toBe(7)
  })

  it('serverns svar för en ANNAN tävling (gårdagens nummer) räknas inte', () => {
    expect(tavlingsStatus('mp', null, NU, { nummer: idagNr - 1, antal: 12 }).lage).toBe('ny')
  })

  it('guld jämförs mot veckans nummer', () => {
    const veckoNr = guldNummer(veckansMandag(stockholmDateISO(NU)))
    expect(tavlingsStatus('guld', null, NU, { nummer: veckoNr, antal: 12 }).lage).toBe('klar')
  })

  it('trasigt serversvar fäller inte startsidan', () => {
    expect(tavlingsStatus('mp', null, NU, { nummer: idagNr } as never).lage).toBe('ny')
    expect(tavlingsStatus('mp', null, NU, 'skräp' as never).lage).toBe('ny')
  })
})
