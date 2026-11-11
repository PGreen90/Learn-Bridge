// Facit för ägarrapporten: antalen ska stämma, bottar räknas aldrig, och
// rapporten får aldrig innehålla något som pekar ut en person.

import { describe, expect, it } from 'vitest'
import { agarrapportText, byggAgarrapport, type Kontorad, type Resultatrad } from './agarrapport'

const NU = new Date('2026-11-11T12:00:00Z')
const kl = (dag: string) => `${dag}T11:00:00Z`

const konton: Kontorad[] = [
  { id: 'gammal', created_at: kl('2026-08-01'), is_bot: false },
  { id: 'trogen', created_at: kl('2026-10-20'), is_bot: false }, // 22 dagar sedan
  { id: 'tappad', created_at: kl('2026-10-25'), is_bot: false }, // 17 dagar sedan, spelade aldrig
  { id: 'ny', created_at: kl('2026-11-09'), is_bot: false }, // 2 dagar sedan
  { id: 'bot', created_at: kl('2026-08-01'), is_bot: true },
]

const resultat: Resultatrad[] = [
  // gammal: förra veckan OCH den här
  { user_id: 'gammal', created_at: kl('2026-11-02') },
  { user_id: 'gammal', created_at: kl('2026-11-10') },
  { user_id: 'gammal', created_at: kl('2026-11-10') }, // två givar samma dag = en aktiv dag
  // trogen: bara förra veckan
  { user_id: 'trogen', created_at: kl('2026-11-03') },
  // ny: i dag
  { user_id: 'ny', created_at: kl('2026-11-11') },
  // boten spelar varje dag men ska inte synas
  { user_id: 'bot', created_at: kl('2026-11-10') },
  { user_id: 'bot', created_at: kl('2026-11-11') },
  // okänt konto (raderat) räknas inte
  { user_id: 'raderad', created_at: kl('2026-11-11') },
]

describe('byggAgarrapport', () => {
  const r = byggAgarrapport(konton, resultat, NU)

  it('räknar konton utan bottar, och nya i 7- och 30-dagarsfönstret', () => {
    expect(r.dag).toBe('2026-11-11')
    expect(r.konton).toEqual({ totalt: 4, nya7: 1, nya30: 3 })
  })

  it('aktiva = olika människor som spelat, per fönster', () => {
    expect(r.aktiva).toEqual({ senaste7: 2, foregaende7: 2, senaste30: 3 })
  })

  it('återkomsten: av förra veckans två spelare kom en tillbaka', () => {
    expect(r.aterkomst).toEqual({ av: 2, komTillbaka: 1 })
  })

  it('nya som kom igång: av två konton från 8–30 dagar sedan har ett spelat', () => {
    expect(r.nyaSomSpelat).toEqual({ av: 2, spelat: 1 })
  })

  it('per dag: 14 dagar, äldst först, flera givar samma dag räknas en gång', () => {
    expect(r.perDag).toHaveLength(14)
    expect(r.perDag[0].dag).toBe('2026-10-29')
    expect(r.perDag[13]).toEqual({ dag: '2026-11-11', aktiva: 1 })
    expect(r.perDag.find((d) => d.dag === '2026-11-10')?.aktiva).toBe(1)
  })

  it('tomt underlag ger nollor, inga fel', () => {
    const tom = byggAgarrapport([], [], NU)
    expect(tom.konton.totalt).toBe(0)
    expect(agarrapportText(tom)).toContain('(–)')
  })
})

describe('agarrapportText', () => {
  it('innehåller bara antal — aldrig konto-id:n', () => {
    const text = agarrapportText(byggAgarrapport(konton, resultat, NU))
    for (const k of konton) expect(text).not.toContain(k.id)
    expect(text).toContain('Totalt: **4**')
    expect(text).toContain('(50 %)')
  })
})
