// DOKUMENTVAKTEN (2026-07-25) — automatiskt skydd mot att dokumenten glider
// ifrån koden.
//
// BAKGRUNDEN: genomgången 2026-07-25 visade att docs kontrollerades mot ANDRA
// docs i stället för mot verkligheten. Två fel hade överlevt flera manuella
// genomgångar: `status.md` beskrev en komponent som var raderad, och siffran
// "1626 tester" (som aldrig gick att reproducera — repot hade 48 testfiler den
// dagen) hade spridits till fem filer och fått en egen arbetsregel. Läsning
// hittade dem inte. Därför ligger kontrollen här, i testsviten, som Vercels
// deploygrind kör före varje publicering.
//
// Vakten är MEDVETET trubbig: den kollar sådant som går att avgöra maskinellt
// och lämnar bedömningsfrågor till människan.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

// === Vilka dokument är LEVANDE (ska stämma just nu)? ========================
// Arkivfiler beskriver hur det såg ut DÅ och ska inte skrivas om — de undantas.

const LEVANDE = [
  'CLAUDE.md',
  'README.md',
  'docs/README.md',
  'docs/arbetsrutiner.md',
  'docs/beslut-b-plan.md',
  'docs/bevaka.md',
  'docs/bord-plan.md',
  'docs/bot-hjarna.md',
  'docs/budsystem-revision.md',
  'docs/budsystem.md',
  'docs/framtid-multiplayer-plattform.md',
  'docs/handvardering.md',
  'docs/konkurrensplan.md',
  'docs/kortspel.md',
  'docs/off-book-syd.md',
  'docs/oversikt.md',
  'docs/senare.md',
  'docs/speldiagnos.md',
  'docs/status.md',
  'docs/systemrevisorn.md',
]

const ARKIV = [
  'AUDIT_PROMPTS.md',
  'docs/arbetslista.md',
  'docs/historik.md',
  'docs/sanningskarta.md',
  'docs/tp-arbetslista.md',
]

const läs = (f: string) => readFileSync(f, 'utf8')

// === 1. Varje kodfil som ett levande dokument nämner måste finnas ===========

// Filer som nämns men medvetet INTE finns i repot (genereras vid körning).
const GENERERADE = new Set(['manifest.json', 'latest.json', 'speldiagnos-latest.json'])

function källfiler(): Set<string> {
  const namn = new Set<string>()
  const gå = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) gå(join(dir, e.name))
      else namn.add(e.name)
    }
  }
  gå('src')
  gå('api-src') // serverfunktionerna är också källkod som docs refererar
  return namn
}

describe('dokumentvakten: docs pekar på kod som finns', () => {
  const namn = källfiler()

  it.each(LEVANDE)('%s nämner inga kodfiler som saknas', (doc) => {
    const träffar = [...läs(doc).matchAll(/`([A-Za-z0-9_\-./]+\.(?:ts|tsx|css|json))`/g)]
    const saknas = träffar
      .map((m) => m[1])
      .filter((ref) => {
        const bas = ref.split('/').pop() as string
        if (GENERERADE.has(bas)) return false
        return !namn.has(bas) && !existsSync(ref)
      })
    expect([...new Set(saknas)]).toEqual([])
  })
})

// === 2. Inga absoluta testantal i levande dokument ==========================
// Det var så "1626" kunde skrivas, spridas och överleva. Ett antal som ingen
// kan reproducera hör inte hemma i ett levande dokument — skriv "hela sviten
// grön" i stället. Historiska antal får stå kvar i arkivet.

// Två undantag, båda medvetna:
//  · en rad som bär ett DATUM är en loggpost — där är siffran en tidsstämpel
//    över något som hände, inte ett påstående om nuläget.
//  · `budsystem.md` §9 är ändringsloggen (visas inte ens på appens sida) och
//    läses som arkiv.
const ÄNDRINGSLOGG: Record<string, RegExp> = { 'docs/budsystem.md': /^## 9\. Ändringslogg/m }

describe('dokumentvakten: inga oreproducerbara testantal', () => {
  it.each(LEVANDE)('%s skriver inte ut ett absolut testantal', (doc) => {
    let text = läs(doc)
    const logg = ÄNDRINGSLOGG[doc] ? text.search(ÄNDRINGSLOGG[doc]) : -1
    if (logg >= 0) text = text.slice(0, logg)

    const brott = text
      .split('\n')
      .map((rad, i) => ({ rad: rad.trim(), nr: i + 1 }))
      .filter(({ rad }) => /testsvit\s+\d{2,}|\d{3,}\s+(?:tester|test\b)/i.test(rad))
      .filter(({ rad }) => !/20\d\d-\d\d-\d\d/.test(rad))
      // Sista utvägen: `<!-- vakt-ok: skäl -->` på samma rad. Kräver ett
      // utskrivet skäl och syns i källan — använd bara när siffran ÄR poängen
      // (t.ex. när vi citerar en felaktig siffra som varnande exempel).
      .filter(({ rad }) => !/<!--\s*vakt-ok:.+-->/.test(rad))
      .map(({ rad, nr }) => `rad ${nr}: ${rad}`)
    expect(brott).toEqual([])
  })
})

// === 3. CLAUDE.md ska förbli en KARTA, inte ett bibliotek ===================
// Den laddas i sin helhet varje session. Växer den tillbaka mot 44 kB slutar
// den fungera som karta.

it('dokumentvakten: CLAUDE.md håller sig under 16 kB', () => {
  expect(statSync('CLAUDE.md').size).toBeLessThan(16 * 1024)
})

// === 4. Storleksangivelserna i docs-indexet stämmer =========================
// En siffra får stå i ett levande dokument om den kontrolleras maskinellt.

it('dokumentvakten: kB-siffrorna i docs/README.md stämmer', () => {
  const fel: string[] = []
  for (const m of läs('docs/README.md').matchAll(/\*\*([a-z\-./]+\.md)\*\*\s*\((\d+)\s*kB\)/g)) {
    const fil = m[1].includes('/') ? m[1] : 'docs/' + m[1]
    const påstått = Number(m[2])
    const faktiskt = Math.round(statSync(fil).size / 1024)
    if (Math.abs(faktiskt - påstått) > 5) fel.push(`${fil}: dokumentet säger ${påstått} kB, filen är ${faktiskt} kB`)
  }
  expect(fel).toEqual([])
})

// === 5. Docs-indexet är komplett ===========================================

it('dokumentvakten: varje fil i docs/ är listad i docs/README.md', () => {
  const index = läs('docs/README.md')
  const osaknade = readdirSync('docs')
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .filter((f) => !index.includes(f))
  expect(osaknade).toEqual([])
})

// === 6. KOPPLINGSVAKTEN: ingen budmodul får tyst tappa kontakten ============
// Lebensohl fanns byggd, testad och nedskriven i systemboken — men ingen
// produktionsfil importerade den, så bottarna spelade den aldrig. Ingen
// upptäckte det på tre veckor. Den här vakten gör en sådan frånkoppling
// omöjlig att göra av misstag: nya bortkopplade moduler ger rött test.

// Moduler som medvetet INTE nås från appens budgivning. Varje rad måste ha ett
// skäl. Lägg ALDRIG till en rad här för att få testet grönt — då är det just
// det felet vakten finns för.
const MEDVETET_EJ_INKOPPLAD: Record<string, string> = {
  'mc-worker.ts': 'Web worker — laddas via new Worker(new URL(...)) i usePlayTable.ts, inte via import.',
  'rapport-worker.ts': 'Web worker — laddas via new Worker(new URL(...)) i useDdAnalys.ts, inte via import.',
  'revisor-dds.ts': 'Mätriggens DD-orakel (bridge-dds, dev-beroende) — körs bara av revisor.probe.test.ts.',
  'spela-giv.ts': 'Speldiagnosens helgivsspelare (docs/speldiagnos.md) — körs bara av probes/facittester; appen spelar via usePlayTable.',
  'speldiagnos.ts': 'Speldiagnosens aggregator (docs/speldiagnos.md) — körs bara av speldiagnos.probe.test.ts.',
  'botspelare.ts': 'Tävlingsbotens givspelare (beslut-b-plan.md, påbyggnaden) — driftvägen ÄR nattjobbet tavlingsbot.probe.test.ts (Actions); appen spelar via usePlayTable.',
}

it('dokumentvakten: varje motormodul är inkopplad i produktionskoden', () => {
  const dir = 'src/lib/engine'
  const moduler = readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))

  // Läs varje produktionsfil EN gång. Tidigare låg readFileSync inne i
  // filter-loopen, alltså ~90 moduler × ~150 filer = över 13 000 läsningar av
  // samma innehåll. Det tog nästan 5 sekunder och timeoutade slumpvis under
  // last (sett 2026-07-28), vilket gör deploygrinden opålitlig — och en grind
  // man inte kan lita på slutar man läsa.
  const prodkod: { fil: string; text: string }[] = []
  const gå = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name)
      if (e.isDirectory()) gå(p)
      else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name))
        prodkod.push({ fil: p, text: readFileSync(p, 'utf8') })
    }
  }
  gå('src')
  // api-src/ ÄR produktionskod (Vercel-serverfunktionerna, Beslut B) — motor-
  // moduler som bara servern använder (t.ex. matchpoints.ts via topplista.ts)
  // räknas därför som inkopplade, inte döda.
  gå('api-src')

  const bortkopplade = moduler.filter((m) => {
    const bas = m.replace(/\.tsx?$/, '')
    const importeras = new RegExp(`from\\s+['"][^'"]*/${bas}['"]|from\\s+['"]\\./${bas}['"]`)
    return !prodkod.some((f) => !f.fil.endsWith(m) && importeras.test(f.text))
  })

  const nya = bortkopplade.filter((m) => !(m in MEDVETET_EJ_INKOPPLAD))
  expect(nya).toEqual([])

  // Andra hållet: en modul som kopplats in ska tas bort ur undantagslistan, så
  // listan aldrig ljuger om att något är dött när det lever.
  const felaktigtUndantagna = Object.keys(MEDVETET_EJ_INKOPPLAD).filter((m) => !bortkopplade.includes(m))
  expect(felaktigtUndantagna).toEqual([])
})

// === 7. Arkivfiler ska vara märkta som arkiv ===============================
// Så att ingen läser en gammal sanning som dagens.

describe('dokumentvakten: arkivet är märkt', () => {
  it.each(ARKIV)('%s är listad som arkiv i docs/README.md', (doc) => {
    const namn = doc.split('/').pop() as string
    expect(läs('docs/README.md')).toContain(namn)
  })
})
