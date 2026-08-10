// Facit för visningsnamnets regler (Beslut B etapp 1, steg 5a).

import { describe, it, expect } from 'vitest'
import { validateDisplayName } from './display-name'

describe('validateDisplayName', () => {
  it('godkänner giltiga namn (4–10 tecken, tillåtna tecken, inkl. å ä ö)', () => {
    for (const name of ['Anna', 'björn_2', 'Kalle-42', 'ÅsaÖ', 'spelare10']) {
      expect(validateDisplayName(name)).toEqual({ ok: true })
    }
  })

  it('nekar för kort och för långt namn', () => {
    expect(validateDisplayName('abc').ok).toBe(false) // 3 tecken
    expect(validateDisplayName('abcdefghijk').ok).toBe(false) // 11 tecken
  })

  it('nekar otillåtna tecken (mellanslag, punkt, emoji)', () => {
    expect(validateDisplayName('a b c').ok).toBe(false)
    expect(validateDisplayName('kalle.42').ok).toBe(false)
    expect(validateDisplayName('kalle😀').ok).toBe(false)
  })

  it('nekar reserverade ord — även med skiftläge, l33t och avdelare', () => {
    expect(validateDisplayName('admin').ok).toBe(false)
    expect(validateDisplayName('ADMIN').ok).toBe(false)
    expect(validateDisplayName('adm1n').ok).toBe(false) // 1 → i
    expect(validateDisplayName('a_dmin').ok).toBe(false) // avdelare bort
    expect(validateDisplayName('rebidz').ok).toBe(false)
  })

  it('nekar grova ord men INTE oskyldiga namn som råkar likna dem', () => {
    expect(validateDisplayName('fuck').ok).toBe(false)
    // "Stefan" innehåller "fan" men får ALDRIG nekas (Scunthorpe-skyddet).
    expect(validateDisplayName('Stefan')).toEqual({ ok: true })
    // "Thora" innehåller "hora" men "hora" är exakt-match, inte delsträng.
    expect(validateDisplayName('Thora')).toEqual({ ok: true })
  })

  it('trimmar omgivande blanksteg innan bedömning', () => {
    expect(validateDisplayName('  Anna  ')).toEqual({ ok: true })
  })
})
