import { describe, expect, test } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// ARBETSFLÖDESVAKTEN (2026-10-05). `tavling-granskning.yml` blev ogiltig YAML
// 2026-09-26: en redigering kapade en rad vid "$'" och klistrade in resten av
// filen en gång till. GitHub kör då inte flödet alls — varken på schemat eller
// för hand — och det enda spåret är en röd "startup failure" per push, som ingen
// ser. Nattgranskningen och den slutliga tävlingsställningen (daily_standings)
// stod därför still i nio dygn: historiken visade "provisorisk"/"spelade inte".
//
// Deploygrinden kör inte flödena, så den upptäckte inget. Den här vakten läser
// varje arbetsflödesfil och kräver den grundform ett trasigt klipp bryter:
// rätt toppnycklar, inget skräp i kolumn 0, inga tabbar, jämna citattecken i
// varje skalrad och inga dubblerade stegnamn.
const KATALOG = '.github/workflows'
const filer = readdirSync(KATALOG).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))

describe('arbetsflödesvakten: varje fil i .github/workflows har hel grundform', () => {
  test('det finns arbetsflöden att vakta', () => {
    expect(filer).toContain('ci-deploy.yml')
    expect(filer).toContain('tavling-granskning.yml')
  })

  for (const fil of filer) {
    const text = readFileSync(join(KATALOG, fil), 'utf8').replace(/\r\n/g, '\n')
    const rader = text.split('\n')

    test(`${fil}: toppnycklarna name/on/jobs finns, och inget annat står i kolumn 0`, () => {
      const kolumn0 = rader.filter((r) => r.length > 0 && !r.startsWith(' ') && !r.startsWith('#'))
      const nycklar = kolumn0.map((r) => /^([A-Za-z_-]+):/.exec(r)?.[1] ?? `SKRÄP: ${r.slice(0, 40)}`)
      expect(nycklar.filter((n) => n.startsWith('SKRÄP'))).toEqual([])
      for (const krav of ['name', 'on', 'jobs']) expect(nycklar, `${krav} saknas`).toContain(krav)
      expect(new Set(nycklar).size, 'dubblerad toppnyckel').toBe(nycklar.length)
    })

    test(`${fil}: inga tabbar och jämna enkelcitat i varje skalrad`, () => {
      expect(rader.filter((r) => r.includes('\t'))).toEqual([])
      // En kapad rad lämnar ett öppet citat: '^[0-9]{4}-… utan avslutande '.
      const udda = rader.filter((r) => !r.trimStart().startsWith('#') && /\b(grep|echo|date)\b/.test(r) && (r.match(/'/g) ?? []).length % 2 === 1)
      expect(udda).toEqual([])
    })

    test(`${fil}: inga dubblerade stegnamn (en inklistrad kopia av filens slut)`, () => {
      const steg = rader.map((r) => /^\s+- name: (.+)$/.exec(r)?.[1]).filter((n): n is string => !!n)
      expect(steg.filter((n, i) => steg.indexOf(n) !== i)).toEqual([])
    })
  }
})
