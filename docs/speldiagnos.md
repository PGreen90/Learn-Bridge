# Speldiagnosen — bottar som spelar, felsöker och rapporterar

> **Byggd 2026-08-12 (ägarbeslut).** Kortspelets och helhetens motsvarighet till
> systemrevisorn (`docs/systemrevisorn.md`): bottarna spelar hela givar
> (auktion + alla 52 kort), varje kort får DD-facit, och varje giv får en dom
> som delar upp tappet i **budtapp** och **speltapp**. Rapporten läses av
> ägaren som väljer vad som lagas — ingen reparation utan ägarens ja.

## Bärande princip: RÄTT, inte max antal stick (ägaren 2026-08-12)

Diagnosen handlar inte om att ta flest stick — den handlar om att bjuda och
spela **rätt**. Det förlänger de låsta principerna "bedöm aldrig ett bud på
DD/poäng på enskild giv" (2026-08-06) och "ärliga slamportar" (bottarna spelar
på VISAD information, aldrig på facit) till hela kedjan:

- **DD-facit är larmklockan, inte domaren.** Ett DD-tapp pekar ut en giv och
  ett kort som är VÄRT ATT GRANSKA — det är inte i sig ett fel. DD ser alla
  52 korten; boten får bara sin ärliga information.
- **Varje larm klassas i agent-steget (`/speldiagnos`) som en av tre:**
  **systemfel** (boten bröt mot systemet/`docs/budsystem.md` eller sund
  spelteknik med den information den hade → kandidat att laga) ·
  **ärlig miss** (rätt beslut, facit råkade ligga fel — masken satt fel, dold
  fördelning → INGEN åtgärd, det är så bridge ska spelas) ·
  **oklart** (ägarens omdöme behövs). Endast systemfel föreslås för reparation.
- **Aggregatsiffrorna är trendmätare mellan körningar, aldrig mål i sig.**
  En fix som "höjer siffran" genom att kika eller chansa är fel även om den
  vinner stick.

## Riggen — moduler och kommandon

| Modul | Vad den gör |
|---|---|
| `src/lib/engine/spela-giv.ts` | Delad helgivsspelare: `spelaHelGiv`/`spelaVidare` + `spelaMedFro` (per-beslut-frön via `botDecisionSeed` — samma väg som tävlingen → 100 % reproducerbart ur fröet). |
| `src/lib/engine/revisor-dds.ts` | `analyseSpel` — per-kort-DD-facit via bridge-dds `AnalysePlayPBN` (49 värden för en full giv: värde 0 = före utspelet, värde i = efter kort i; DDS analyserar t.o.m. kort 48, sista sticket är tvunget). Konventionerna låsta av `revisor-dds-analyse.test.ts`. |
| `src/lib/engine/speldom.ts` | `bedomSpel` — attribuerar varje DD-rörelse till kort/säte/roll (utspel/spelförare/försvar); `helDom` — delar upp givens tapp i budtapp (par vs kontraktet vid DD-spel) och speltapp (DD-spel vs faktiskt spel). Facit: `speldom.test.ts`. |
| `src/lib/engine/speldiagnos.ts` | Aggregatorn `korSpeldiagnos` + `formatSpeldiagnos`. Facit: `speldiagnos.test.ts`. |

**Mätkörningen** (skriver JSON + läsbar rapport till `revisor-output/`, gitignorad):

```
PowerShell:  $env:SPELDIAG='1'; npx vitest run src/lib/engine/speldiagnos.probe.test.ts
Bash:        SPELDIAG=1 npx vitest run src/lib/engine/speldiagnos.probe.test.ts
```

Rattar: `SPELDIAG_DEALS` (standard 200), `SPELDIAG_SEED` (standard 20260721 —
SAMMA givuniversum som M-serien så budsiffrorna är direkt jämförbara),
`SPELDIAG_OFFSET` + `SPELDIAG_OUT` (parallella skivor: 4 terminaler med
OFFSET 0/50/100/150, DEALS 50, egna OUT-namn), `SPELDIAG_EXAMPLES`.
Kostnaden bor i botens Monte-Carlo per beslut — DD-analysen kostar bara
sekunder; kör skivorna parallellt när hela serien behövs.

**Repro av EN giv** (kort för kort, botens eget skäl per kort, ⚠ där DD rörde
sig — det agenten läser för att hitta regeln som felade):

```
Bash:  DUMP_SPEL=<frö> npx vitest run src/lib/engine/speldump.probe.test.ts
```

**Förscreening av tävlingsgivar** (spelar en tävlingsdags 12 brickor INNAN de
går live; kräver `DAILY_SEED_SECRET` i `.env.local` — gitignorad via `*.local`,
ALDRIG i `.env` som är spårad av git):

```
Bash:  TAVLING_DIAG=<YYYY-MM-DD> npx vitest run src/lib/engine/tavlingsdiagnos.probe.test.ts
```

Ratt: `TAVLING_DAGAR` (dagar i följd, standard 1). **Ärlig begränsning:**
förscreeningen spelar alla fyra säten med boten — även Syd, som i tävlingen är
en människa. Fel som bara uppstår vid mänskliga val syns inte; den fångar
krascher, icke-terminerande auktioner, absurda kontrakt och botlarm på just de
12 givarna. Komplement till `/felrapporter`, inte ersättning.

## Arbetsgången (kodifierad i `/speldiagnos`)

1. Kör proben (eller läs färsk `revisor-output/speldiagnos-latest.json`).
2. Gruppera larmen; för topp-frön kör `speldump` och identifiera regeln.
3. **Systemriktighetsdomen:** klassa varje larm systemfel/ärlig miss/oklart.
4. Skriv diagnosrapport på enkel svenska till
   `revisor-output/speldiagnos-rapport-<datum>.md`. **Ingen reparation här.**
5. Ägaren väljer. Varje fix = egen runda: facit-test FÖRE fix →
   `docs/budsystem.md`-paragraf vid budregeländring → omkörning = ny mätpunkt
   S<N> nedan.

## Kända fällor

- **DD ser alla kort.** Läs mönster, inte enskilda givar — precis som
  systemrevisorns "Kända fällor". Ett larm är en kandidat, aldrig en dom.
- **Spelet är deterministiskt per frö** (`spelaMedFro`) — en omkörning med
  samma kod ger exakt samma kortföljd. Ändras spelkoden ändras kortföljden;
  jämför S-mätningar bara på aggregaten, aldrig kort för kort mellan versioner.
- **Budsidan i rapporten = M-seriens måttstock** (par-jämförelse vid DD-spel av
  kontraktet). Spelsidan (roll-tappen) är NY och har ingen M-historik.
- Träkarlens kort spelas av samma bot som spelföraren → båda räknas som rollen
  "spelförarsidan".

## S-serien — mätloggen (nyast sist)

> Varje spelpåverkande fix får en mätpunkt här: datum, vad som fixades, vilket
> facit-test som låser det, omkörningskommandot och en ärlig läsning av deltat.
> Baslinjen S0 körs när ägaren godkänt riggen.

*(Inga mätningar ännu — S0 = första fulla körningen.)*
