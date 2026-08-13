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

Samma dump för en **tävlingsbricka** (byggd 2026-08-12; kräver
`DAILY_SEED_SECRET` i `.env.local`, precis som förscreeningen — hemligheten
skrivs aldrig i utdata):

```
Bash:  DUMP_TAVLING=<YYYY-MM-DD>:<bricka> npx vitest run src/lib/engine/speldump.probe.test.ts
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

### S0 — baslinjen (2026-08-12)

200 givar, frö 20260721, fyra parallella skivor. Omkörning:
`SPELDIAG=1 SPELDIAG_DEALS=50 SPELDIAG_OFFSET=<0|50|100|150> SPELDIAG_OUT=speldiagnos-s0-<a|b|c|d>.json npx vitest run src/lib/engine/speldiagnos.probe.test.ts`

- Alla 200 bedömda (0 auktionsfel, 0 olösbara).
- **Bud:** 17,0 % rätt kontrakt (34/200), snittapp 263 poäng/giv — i nivå med
  M-seriens baslinje (samma givuniversum).
- **Spel:** 20/200 givar utan DD-rörelse. Flaggade stick: spelförarsidan 358
  (151 givar), försvaret 257 (133), utspelet 54 (52). Netto spelförare mot DD:
  −47 stick/200 givar ≈ −0,24/giv — sidorna tar nästan ut varandra (väntat
  utan facitinsyn).
- Första granskningsrundan (fyra dumpade givar) och klassningen: se
  `revisor-output/speldiagnos-rapport-2026-08-12.md`. Fynd: regellös
  4♥-höjning på 2-kortsstöd (frö 20260772, bud) · träkarlen lägger honnör
  under ett kort som redan vinner (20260731, ren kodbugg) · spelföraren sakar
  ess i stället för att ruffa + MC kopplas inte in (20260772) ·
  trumfdragningen ser inte sitsen (20260731) · "vinn billigast" i stället för
  mask i trumfdragning (20260730) · två ärliga missar (ingen åtgärd) · ett
  oklart trumfutspel (20260807).

*(Läsning: baslinjen är satt. Inga fixar ingår i S0 — nästa mätpunkt S1 körs
efter första godkända fixen.)*

### S1 — de tre första fixarna (2026-08-12, ägarval "2 → 3 → 1")

Samma 200 givar och kommando som S0 (byt `s0` mot `s1` i OUT-namnen). S1 mäter
de TRE fixarna ihop (en mätpunkt, inte tre — fixarna byggdes i följd samma
pass): säkra-vinnaren-mot-liggande-kort (`play-bot.test.ts`) ·
spelförarsidans ruff i stället för sak (`play-bot.test.ts`) · cue-svarets
färg = 4 + cue-advancerns dom (§7.3, `auction-konkurrens-fortsattning.test.ts`).

- **Bud:** 17,5 % rätt (35/200; S0 34), snitt **259 poäng/giv** (S0 263).
  Lyftet bor nästan helt i skiva B där frö 20260772 gick från 4♥−6 till 3NT
  (≈ 700 poäng på en giv).
- **Spel:** flaggade stick spelförarsidan **349** (S0 358), försvaret **238**
  (S0 257), utspelet 55 (S0 54); rent spelade 20/200 (oförändrat).
- **Läsning (ärlig):** buddeltat är verkligt och spårbart till fixen.
  Speldeltana ska läsas FÖRSIKTIGT — varje ändrat kort ger en helt ny
  genomspelning nedströms (dokumentets regel: jämför aldrig kort för kort
  mellan versioner), så −9/−19 ligger inom omtärningsbruset. Fixarnas
  verkliga lås är facit-testerna; aggregaten bekräftar främst att inget
  BLEV SÄMRE. MC-urfallet (sampleLayouts 0 lägen, frö 20260772) är
  fortfarande olagat och står i `docs/bevaka.md`.

### S2 — trumfdragningen, rapportens fynd 4–5 (2026-08-12, ägarval "kör vi 4–6")

Samma 200 givar och kommando som S0 (byt `s0` mot `s2` i OUT-namnen). S2 mäter
TVÅ fixar ihop (byggda i följd samma pass, facit i `play-bot.test.ts`):
**led inte trumf in i en känd gaffel** (`hopelessTrumpLead` — show-out har
placerat all kvarvarande trumf hos EN motståndare, toppen över vår och minst
lika lång som vår längsta trumfhand → sidofärg i stället; att driva ut en
kortare mästartrumf är kvar) · **spelförarsidans tredje hand följer
färgkombinationen** (`declarerThirdHandSuitCard` — simulerar sticket + resten
av färgen med `suitTricks`, byter bara kort när det är strikt bättre än
"billigaste vinnaren"; Q ur Q753 mot KJ982 i stället för 7:an).

- **Bud:** 17,5 % rätt (35/200), snitt 259 poäng/giv — identiskt med S1
  (väntat: inga budregler rördes).
- **Spel:** flaggade stick spelförarsidan **338** (S1 349), försvaret **230**
  (S1 238), utspelet 55 (55); rent spelade 21/200 (S1 20).
- **Läsning (ärlig):** deltana pekar åt rätt håll men ligger inom
  omtärningsbruset (dokumentets regel: jämför aldrig kort för kort mellan
  versioner). Fixarnas verkliga lås är facit-testerna; på de dumpade fröna är
  effekten konkret: 20260730 gick från 8 till 10 stick (4♥ jämnt hem) och
  20260731 slapp −2-trumfvarvet. Samma runda byggdes **tävlingsspeldumpen**
  (`DUMP_TAVLING`, se ovan) och fynd 6 (trumfutspelet 20260807) utreddes:
  korsruff-regeln räknar CUE-BUD som bjudna färger — ägarbeslut väntar,
  inget lagat.

### S3 — cue-bud räknas inte som bjuden färg i utspelet (2026-08-12, ägarens ja på fynd 6)

Samma 200 givar och kommando som S0 (byt `s0` mot `s3` i OUT-namnen). EN fix:
`analyzeAuctionForLead` hoppar över bud vars regelnamn börjar på "cue" —
kontrollbud visar ess/renons, ingen längd, så cue-färgen varken triggar
korsruff-regeln ("3+ bjudna färger") eller undviks som "deras färg".
Facit: `play-bot.test.ts` ("fynd 6"). Paragraf: `docs/budsystem.md` §8.3 + §9.

- **Bud:** 17,5 % rätt (35/200), snitt 259 poäng/giv — identiskt med S1/S2
  (inga budregler rörda).
- **Spel:** flaggade stick spelförarsidan **342** (S2 338), försvaret **236**
  (S2 230), utspelet **57** (S2 55); rent spelade 20/200 (S2 21).
- **Läsning (ärlig):** aggregatet rörde sig marginellt ÅT FEL HÅLL men helt
  inom omtärningsbruset (cue-auktioner är sällsynta; varje ändrat utspel ger
  en ny genomspelning nedströms). Fixen är principiell — RÄTT, inte max
  stick: regeln läste ett kontrollbud som färglöfte. På frö 20260807 leder
  Syd nu passivt ♥10 (topp av inre sekvens) i stället för trumf; DD ogillar
  även det (spelförarens ♥Q var singel — osynligt för Syd, ärlig miss).

### S4 — tävlingslarmens tre fixar (2026-08-13, ägarval "laga allt, en i taget")

Samma 200 givar och kommando som S0 (byt `s0` mot `s4` i OUT-namnen). Runda 4
granskade tävlingen 2026-08-11 (bricka 8 förartapp 6, bricka 1 förartapp 5)
med nya tävlingsdumpen; TRE fixar byggdes i följd, var och en med facit-test
FÖRE fix i `play-bot.test.ts`:

1. **Ruffa inte partnerns säkra stick** — vakt i S1-ruffregeln: synlig partner
   med boss i ledd färg (slår utspelet + alla osedda, ingen visad renons
   emellan) → saka i stället (bricka 1, stick 10).
2. **Andra hand täcker billigt mot partnerns boss** — träkarlen lägger 8:an ur
   J1084 på ledd 7:a när spelföraren håller AK2 (gratis försök, sparar
   bossen); kräver äkta billigt försök + ingen ruffrisk (bricka 8, stick 1).
3. **Trumfdragningsplanen** (`shouldDrawTrumps`) — på lead räknas styrkeprovet
   i trumffärgen (kombinerad trumf mot osedda, neutrala varvräkningen);
   vinner vår sida MINST lika många varv dras trumf tills deras är slut.
   Jämnt prov dras också (första versionen släppte vid 2–2 och fick ♣K
   ruffad). Gaffel-vakten har företräde; svag trumf drar inte.

- **Bud:** 17,5 % rätt (35/200), snitt 259 poäng/giv — identiskt (inga
  budregler rörda).
- **Spel:** flaggade stick spelförarsidan **307** (S3 342 — största lyftet i
  serien; S0 358), försvaret **217** (S3 236), utspelet 57 (57); rent spelade
  19/200 (20).
- **Läsning (ärlig):** −35 på spelförarsidan är utanför det brus tidigare
  mätpunkter rört sig i och bär trumfdragningsplanens signatur (den fyrar i
  många trumfgivar). På tävlingsbrickorna: bricka 8 förartapp 6 → 4, bricka 1
  5 → 3. Kvar på bricka 1 (−3) är dragningens RIKTNING (masktekniken "leda
  MOT kombinationen" är en känd förenkling — planen leder från handen som är
  inne) — SENARE-kandidat, liksom #32-grindens ♥A-cash på bricka 8.
