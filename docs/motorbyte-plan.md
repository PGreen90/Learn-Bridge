# Motorbytet — från manus till fyra spelare (ägarbeslut 2026-09-04)

> **Vad detta är:** planen för att byta budmotorns orkestrering så att varje stol
> bjuder som en människa: **egen hand + auktionen hittills → ett bud**. Inget
> förskrivet manus, ingen skillnad mellan "linjen" och "budlådan". Läs den FÖRST
> vid allt motorbytesarbete. Diagnosen som ledde hit står i §1; etapperna i §4;
> grindbesluten i §5. Ändringsloggen längst ner.

## 1. Varför — diagnosen i korthet

Ägarens ord 2026-09-04: *"Känslan är overklig och oren, ganska långt från att
spela kort i verkligheten. Vi behöver ett sätt att lösa detta permanent."*

Motorn bjuder idag inte som fyra spelare. Den skriver ett **manus**:

- `buildAuction` i `src/lib/engine/auction.ts` ser hela given och skriver hela
  auktionen på förhand (öppning → svar → återbud → svararens andra bud →
  slamutredning, plus exakt EN konkurrensrond). Den lämnar över med flaggan
  `open`.
- `decideCall` i `src/lib/engine/auction-live.ts` spelar upp manuset bud för bud.
  När verkligheten avviker (Syd bjuder något annat, eller manuset tar slut) tar
  en **ordningskritisk kedja av detektorer** över, med `offBookResponse` som
  sista utväg. Antal detektorer idag:
  `grep -c "{ id: '" src/lib/engine/auction-live.ts` → 70.

Tre skador följer av det, och alla tre syns i felrapporthistoriken:

1. **Varje ställe där manuset slutar är en söm.** "Linjen stängde för tidigt",
   "passet låg inbakat i linjen", "kravet fanns bara i linjen" — samma rotorsak
   i felrapport efter felrapport (#5, #14, #26–#27, #38, #40–#42, #53, #55–#58).
   Koden säger det själv i `auction-live.ts` ovanför `auctionForce`: *"varje ny
   kravsituation krävde en egen detektor (en per felrapport)"*.
2. **Samma beslut finns på två ställen.** Svararens konkurrensbud avgörs en gång
   i manuset (`competitiveResponderAction`) och en gång i budlådan. Kravminnet
   (`auctionForce`/`competitionForce`/`honorForce`) byggdes bara för att manuset
   bar kravet osynligt. Två hjärnor för en stol driver alltid isär.
3. **Ärlig inferens hålls av disciplin, inte av konstruktion.** Manusets slam-
   och sangfunktioner tar BÅDA parhänderna som indata (`slamInvestigation`,
   `gerberInvestigation`, `strong2NTSystemsOn`, `exclusionInvestigation`,
   `mssMinorFitContinuation`). Varje tur använder rätt hand, men inget hindrar
   en framtida rad från att kika. En stol-för-stol-motor gör kik omöjligt.

Revisionen R2 (`docs/audit/r2-arkitektur.md`, Fynd #1) pekade ut detta redan
2026-07: *"Det finns ingen abstraktion för auktionsläge/roll"*. Vi valde då att
lappa (F2 gjorde kedjan datadriven, `auctionFacts` parkerades i SENARE). Det
var en felprioritering: sömmen producerar småfel i jämn takt oavsett hur
väl kedjan är vaktad.

**Vad som är BRA och ska behållas** (R2:s bevarandelista gäller fortfarande):
rena funktioner utan dolt tillstånd, ren importtrappa, motor↔UI-gränsen tät.
Bridgekunskapen bor i egna moduler med hand-in/bud-ut-signaturer:
`openings.ts`, `responses*.ts`, `rebids.ts`, `overcalls.ts`, `doubles.ts`,
`dont.ts`, `lebensohl.ts`, `slam-auction.ts`, `nt-slam.ts`,
`defense-conventional.ts`. **De byts inte ut.** Det är orkestreringen runt dem
som byts.

Och det viktigaste faktumet: **utsidan har redan rätt form.** Spelet
(`src/pages/play/useGame.ts`), bordet (`api-src/_lib/bord-motor.ts`),
tävlingsbottarna (`botspelare.ts`), facit (`contract-target.ts`) och revisorn
(`revisor.ts`) anropar alla `decideCall(deal, history, seat)` stol för stol.
Ingen UI-fil läser manuset (`BuiltAuction`/`turns`). Bytet sker helt INNANFÖR
`decideCall`; anropssignaturen behålls.

## 2. Målbilden (låsningar)

- **EN beslutsfunktion.** `decideCall(deal, history, seat)` behåller sin
  signatur men läser bara `deal.hands[seat]`, `deal.dealer`,
  `deal.vulnerability` och `history`. Aldrig en annan hand.
- **Kikvakten** (`src/lib/engine/kikvakt.test.ts`, byggd i etapp 1): ett
  egenskapstest som byter ut de tre andra händerna mot slumpkort och kräver
  exakt samma bud. Det är ärlig inferens bevisad av maskinen, inte lovad i
  text. Kör: `npx vitest run src/lib/engine/kikvakt.test.ts`.
- **Tre steg i samma beslut** (ersätter dagens tre lager):
  1. **Betydelse** — varje bud i auktionen får sin systembetydelse (regelnamn,
     kravnivå, visat intervall/längd, konstgjort) ur auktionen ENSAM, för både
     bot och människa. Samma funktion förklarar budet för användaren.
  2. **Fakta** — ur betydelserna räknas auktionsläget: öppnare/svarare/
     inklivare/advancer, sida i krav (rond/utgång/slam), trumföverenskommelse,
     visade intervall per stol, motståndarnas senaste bud, utpassningssits,
     passad hand. Räknas EN gång per beslut.
  3. **Val** — en tabell `läge (faktavillkor) → kunskapsfunktion`. Varje regel
     har ett exakt läge, inte en plats i en kö. Ordning blir ointressant.
- **Inget manus.** `buildAuction` blir en tunn hjälpare som kör `decideCall`
  fyra stolar tills tre pass (för Budvisningen, `dealForPlay` och de tester som
  anropar den). Manuset härleds ur besluten, inte tvärtom. Flaggan `open`,
  `divergedFromLine`, `FORCED_DETECTORS`/`CONTESTED_DETECTORS` och orden
  on-book/off-book försvinner ur kod och dokumentation.
- **Bridgekunskapen behålls.** De kunskapsfunktioner som idag tar partnerns
  interna beslutsobjekt (`ResponseResult`) som indata får det ur betydelse-
  steget i stället (bud + regel ur auktionen). Deras egna facit-tester rörs inte.
- **Bud = systemriktighet, inte poäng** (ägarprincip 2026-08-06) gäller varje
  ändrat bud under bytet. Ett bud som blev rätt av fel skäl i manuset får
  ändras när den nya regeln är systemriktig.

## 3. Skyddsnätet — så vet vi att inget går sönder i tysthet

Hela sviten (`npm test`) är grunden. Ovanpå den, per etapp och per familj:

- **Auktionsdiffen (BYGGD i etapp 0, 2026-09-04).** `auktionsdump.probe.test.ts`
  har ett intervall-läge som bjuder tusentals frön och skriver JSON med regel
  OCH KÄLLA per bud (`decideCallTraced` i `auction-live.ts`: manus /
  detektor:<id> / väckning / konkurrens-slam / pass utan regel — samma beslut
  som `decideCall`, bara med vägen synlig). Skriptet `scripts/auktionsdiff.mjs`
  jämför två körningar och listar varje giv där ett bud ändrats (händer, båda
  auktionerna, första skillnaden med regel + källa + förklaring); "samma bud
  men annan regel/källa" räknas separat. Avslutningskod 1 vid ändrat bud.
  Baslinjen tas på mergepunkten före ändringen (aldrig commitad, återskapas ur
  git) och sparas undan med `DUMP_OUT`:
  ```
  $env:DUMP_RANGE='20270001-20273000'; $env:DUMP_OUT='revisor-output/auktionsdump-baslinje.json'; npx vitest run src/lib/engine/auktionsdump.probe.test.ts
  $env:DUMP_RANGE='20270001-20273000'; npx vitest run src/lib/engine/auktionsdump.probe.test.ts
  node scripts/auktionsdiff.mjs revisor-output/auktionsdump-baslinje.json revisor-output/auktionsdump.json
  ```
  (första raden på baslinje-commiten, andra på arbetsträdet; ~2 s per körning;
  full lista i `revisor-output/auktionsdiff.txt`). Intervall-läget skriver
  också `revisor-output/auktionsdump-frekvens.txt` — hur ofta varje källa och
  regel avgjorde ett bud, som styr familjeordningen i etapp 4. Varje ändrad
  giv klassas:
  **(a)** samma bud (borde vara majoriteten), **(b)** bättre enligt bokens
  paragraf (skrivs in i ändringsloggen med frö), **(c)** sämre = fel som lagas
  före merge. Inget mergas med en oklassad ändring.
- **Avvikelsedumpen (BYGGD i etapp 3 familj 2, 2026-09-04).** Auktionsdumpen
  täcker bot mot bot; `avvikelsedump.probe.test.ts` låter MÄNNISKAN öppna
  fritt (17 öppningsbud × två lägen: given öppnar / tredje hand öppnar med
  svararen som passad hand) och bottarna spela klart. Samma JSON-form → samma
  diff-skript; nyckeln är `<frö>/<läge>/<öppning>`:
  ```
  $env:AVVIK='1'; $env:AVVIK_OUT='revisor-output/avvikelsedump-baslinje.json'; npx vitest run src/lib/engine/avvikelsedump.probe.test.ts
  $env:AVVIK='1'; npx vitest run src/lib/engine/avvikelsedump.probe.test.ts
  node scripts/auktionsdiff.mjs revisor-output/avvikelsedump-baslinje.json revisor-output/avvikelsedump.json revisor-output/avvikelsediff.txt
  ```
  (~2 s per körning). Sedan familj 3 finns ett tredje läge, *svar*: boten
  öppnar ostört och människan i svararstolen bjuder vart och ett av de lagliga
  kontraktsbuden upp till 4NT (nyckel `<frö>/svar/<öppning>-<svar>`). Det är
  HÄR familjernas b-listor kommer ifrån i etapp 3: bot mot bot ändras inget
  (samma kunskapsfunktioner), skillnaden är att tabellen svarar där manuset
  saknades. Dumpen avslöjar också OLAGLIGA tabellbud (laglighetsvakten i
  `decideCallTraced` gör dem till pass med källan märkt `olagligt`) — räkna dem
  med `node -e` över JSON-filen; de ska vara noll före merge.
- **Revisorn** (bud mot par): `$env:REVISOR='1'; npx vitest run
  src/lib/engine/revisor.probe.test.ts` (standard 1000 givar, frö 20260721).
  Får inte försämras mellan etapper. Baslinjen mäts i etapp 0 och skrivs i
  ändringsloggen med datum.
- **Riggarna** `pliktsvep.probe`, `forklaringssvep.probe`, `regelsvep.probe`
  körs efter varje familj (kommandon i respektive fil).
- **Betydelsesvepet (BYGGT i etapp 1, 2026-09-04):** för varje botbud i en
  ostörd auktion jämförs den HÄRLEDDA betydelsen (regeln bortskalad, som för
  ett människobud) med regeln motorn satte, på två axlar registret kan svara
  på: kravnivå (under utgång, plus slamintresse) och alert. Avvikelse =
  betydelselagret har ett hål — lagas där, aldrig i motorn. Störda auktioner
  mäts men grindas i etapp 4. Bud där MOTORN avviker från boken listas som
  "kända motoravvikelser" med facit i `motorbyte-facit.test.ts` (utanför
  grinden, aldrig utan facit-fall):
  `$env:BETYDELSE='1'; npx vitest run src/lib/engine/auction-meaning.probe.test.ts`
  → `revisor-output/betydelsesvep.txt` (~3 s).
- **Kikvakten (BYGGD i etapp 1):** `npx vitest run src/lib/engine/kikvakt.test.ts`.
  Del 1 (betydelselagret tar ingen giv) är skarp. Del 2 (`decideCall` ger samma
  bud med tre slumpade andra händer) är `it.todo` till etapp 3; tills dess finns
  MÄTLÄGET som visar hur mycket dagens motor kikar:
  `$env:KIKVAKT='1'; npx vitest run src/lib/engine/kikvakt.test.ts` →
  `revisor-output/kikvakt.txt`.
- **Facit-testerna** behålls allihop. De filer som anropar `buildAuction`
  direkt (`grep -l "buildAuction(" src/lib/engine/*.test.ts`) fortsätter
  fungera via hjälparen; de som testar manusets INTERNA form
  (`turns`/`role`) skrivs om till budföljder när deras familj flyttar.
- **Rollback per familj:** varje familj mergas med egen `--no-ff`-mergepunkt.

## 4. Etapperna

Varje etapp är testdriven som alltid (facit före fix). Ordningen är vald så att
motorn är körbar och deploybar efter VARJE familj — aldrig ett halvbyggt läge
som måste bli klart innan appen fungerar.

### Etapp 0 — baslinje och rigg (ingen motorändring) — KLAR 2026-09-04
- Auktionsdumpens intervall-läge + JSON-utdata + diff-skriptet
  (`scripts/auktionsdiff.mjs`: två JSON-filer in, ändrade givar ut med regel
  och källa per bud). Källan kommer från `decideCallTraced` (§3).
- Baslinjer mätta och noterade i ändringsloggen: auktionsdump (frön enligt
  kommandot ovan) och revisorn.
- Pliktsvepets rester (frö 20262632 · motståndarnas fortsättning efter våra
  höjningar, frö 20261162 + 20262021, `docs/bevaka.md`) ligger som `it.todo`-
  facit i `src/lib/engine/motorbyte-facit.test.ts` — facit-kön för allt som
  hittas under bytet. När familjen landar byts `it.todo` mot `it`.
- **Klart när:** diff-skriptet visar noll skillnad mellan två körningar av
  samma kod, och baslinjerna står i loggen. ✔ Båda uppfyllda (loggen).

### Etapp 1 — betydelselagret (`auction-meaning.ts`) — KLAR 2026-09-04
- `meaningOf(history, index)` ger varje bud sin systembetydelse ur auktionen
  ensam: `{ rule, forcing, alert, text, confidence, källa }`. Bär budet en regel
  från motorn används den (källa 'regel' — regeln är en cache); saknas regel
  (människans bud, eller ett botbud med regeln bortskalad) härleds betydelsen
  (källa 'härledd'). Kärnan är den OSTÖRDA LÄSAREN: systembokens §4–§6 i kod
  (`undisturbed` → `slamZone` / sangsystemet / 2♣ / 1M / 1m / svaga tvåor /
  spärrar), som sätter registrets regelnamn där boken namnger konventionen, så
  kravnivå och alert kommer ur `rules.ts` — samma källa som motorns bud.
- `interpretCall` är en tunn läsare av `meaningOf` (texterna vaktas av
  förklaringssvepet + `auction-interpret.test.ts`; UI:t rörde vi inte).
- Betydelsesvepet och kikvakten byggda (§3). Registret fick kravnivå för 28
  regler motorn redan producerade men som saknades (`rules.test.ts` listar dem).
- Facit-kön fick tre motorfynd som `it.todo` (2♣-familjen ×2, svaga tvåor ×1).
- **Klart-villkoret uppfyllt:** betydelsesvepet noll kravnivå- och alert-
  avvikelser på ostörda auktioner (tre bud i kända motoravvikelser, alla med
  facit), auktionsdiffen noll ändrade bud, hela sviten grön (loggen).
- **Öppna bok-mot-motor-frågor** (ägarbeslut när familjen kommer, listade i
  loggen 2026-09-04): fjärde färg efter reverse · höjningen av öppnarens andra
  färg efter reverse · splintersvarens tabell efter 1♠–3♥ · 4NT över partnerns
  1NT-återbud (kvantitativt eller RKC?) · andra negativa med 4+ hp.

### Etapp 2 — faktalagret (`auction-facts.ts`) — KLAR 2026-09-04
- `auctionFacts(history, seat)` räknar auktionsläget EN gång per beslut
  (`AuctionFacts`): kontraktsbuden per sida, öppning + roller (öppnare/svarare/
  inklivare/advancer), passad hand, senaste icke-pass/kontraktsbud,
  utpassningssitsen, partnerns senast visade färg, överenskommen trumf (+ Jacoby-
  fit), kravläget, det fria budet, den starka dubblingens läge, och
  betydelsen per bud (`meaning(i)`, memoiserad läsare av `meaningOf`). De
  spridda hjälparna i `auction-live.ts` (`auctionForce`/`competitionForce`,
  `agreedTrump`, `jacobyFitTrump`, `partnerLastSuit`, `opponentsHaveBid`,
  `opponentsBidStrain`, `openingBid`, `freeBidContext`, `strongDoubleContext`)
  flyttade dit ORDAGRANT. Facit: `auction-facts.test.ts`.
- Detektorerna FÅR fakta i `DetectorCtx.facts`: de som skannade `history`
  efter sådant fakta täcker tar nu `c: DetectorCtx` / `f: AuctionFacts` och
  läser fälten. Inget bud ändrades — en ren flytt av var sanningen räknas
  (auktionsdiffen noll, loggen).
- **Klart-villkoret uppfyllt:** auktionsdiffen noll; ingen detektor läser
  `history` direkt för det fakta täcker (kvar: `legalCalls` — bridge-regeln —
  och en stol-filtrerad "mitt senaste icke-pass", som inte är ett faktum i
  lagret). Visade INTERVALL per stol (§2) byggs när familjerna kommer i etapp
  3 — registret (`rules.ts`) bär idag kravnivå och alert, inte intervall.

### Etapp 3 — den ostörda linjen utan manus (familj för familj)
Detta är den stora etappen. Beslutstabellen (`src/lib/engine/auction-decide.ts`,
`decideFromTable(hand, facts, vulnerable)`: rader `{ id, läge(fakta), välj(hand + fakta) }`,
första träffande rad väljer, ingen rad → det gamla lagret)
byggs upp familj för familj, och manusets motsvarande gren i `auction.ts`
rivs när familjen landat. Efter varje familj går alla auktioner genom
`decideCall` från första budet, med manuset kvar bara för de familjer som
inte flyttat än.

1. **Öppningen** — `classifyOpening` per stol med position 1–4 och zon.
   **KLAR 2026-09-04** (loggen): tabellens första rad, läget "ingen har
   öppnat"; manusets öppningsloop läser tabellen; kikvakten skarp för
   öppningsvarvet.
2. **Svaret** — `respondToMajor`/`respondToMinor`/`respondTo1NT`/`respondTo2C`/
   svaga tvåor/spärrar/2NT/Drury, valt ur fakta (öppningsbud, passad hand).
   **KLAR 2026-09-04** (loggen): raden *svar* (`responseDecision`), Gerber-
   handens 4♣ ur egen hand (`gerberAsk`), avvikelsedumpen byggd.
3. **Öppnarens återbud** — `openerSecondBid` och syskonen i `rebids.ts`.
   Här byggs adaptern som ger dem svararens bud + regel ur betydelselagret i
   stället för det interna `ResponseResult`. **KLAR 2026-09-05** (loggen):
   raden *återbud*, adaptern `partnerResponseAsSeen` (härleder ur den NAKNA
   auktionen), Gerber-svaret, avvikelsedumpens svar-läge.
4. **Svararens andra bud och öppnarens tredje** — fjärde färg, NMF, checkback,
   preferens, inverterade minorhöjningar, Bergen/Jacoby/splinter-fortsättningar.
5. **Slamutredningen** — `slamInvestigation`/Gerber/Exclusion/MSS per stol:
   kaptenens tur använder kaptenens hand, öppnarens tur öppnarens. Funktions-
   signaturerna smalnas till EN hand + fakta. Kikvakten blir skarp här.
6. **Manuset för ostörda auktioner rivs** ur `auction.ts`; `buildAuction` =
   hjälparen "spela ut fyra stolar".

Per familj: facit-test för läget, auktionsdiffen klassad (a/b/c), revisorn
inte sämre, hela sviten grön, egen mergepunkt. 🚪 Grindbeslut per familj (§5).

### Etapp 4 — konkurrensen (familj för familj)
Manusets enda konkurrensrond och de 70 detektorerna flyttar in i tabellen.
Varje familj tar med sig sina detektorer, och detektorn raderas när familjen
landat. Ordning efter hur ofta läget uppstår i auktionsdumpen (mätt 2026-09-04,
frekvensbilden i ändringsloggen: dubblingsfamiljen och inklivsfamiljen är
störst, `offBookResponse` — familj 4:s "partnern visade en färg" — är den
enskilt största detektorn; ordningen nedan är planens och fastställs mot
mätningen vid etapp 4:s start):

1. Inkliv och advance (`overcall`, `advanceOvercall`, `advanceTwoSuiter`,
   inklivarens fortsättningar).
2. Upplysningsdubbling, svar och dubblarens återbud (den starka dubblaren).
3. Negativ dubbling, stöddubbling, öppnarens svar på dem.
4. Svararens fria bud, öppnarens fortsättning i konkurrens, höjningar på visad
   längd, lagen om totala stick (pliktsvepets K-regler blir facit här).
5. Balansering och återöppning.
6. Försvar mot 1NT (DONT, naturligt inkliv, Lebensohl, värde-X, flykt).
7. Försvar mot svaga tvåor och spärrar, deras höjningar.
8. Konkurrens-slam (kontroll-komplett 4NT, placering).
9. Betydelsesvepet på störda auktioner till noll.

**Klart när:** `FORCED_DETECTORS`/`CONTESTED_DETECTORS` är tomma och raderas
tillsammans med `detector-chain.test.ts`, `divergedFromLine`, `open`-flaggan
och `offBookResponse`. Det som var "sista utvägen" är nu en vanlig regel i
tabellen: *partnern visade en färg → höj med fit / egen färg / sang / pass*.

### Etapp 5 — rivning och dokumentation
- `auction.ts` krymper till hjälparen + typer. `auction-live.ts` = bridge-
  reglerna (`legalCalls`, `auctionComplete`) + `decideCall`. Målet är att
  ingen motorfil är större än vad en session kan läsa i ett stycke.
- Dokumentation: `docs/status.md` §"tre auktionslager" skrivs om till "tre
  steg i ett beslut"; `docs/off-book-syd.md` arkiveras (flyttas till `ARKIV`
  i `src/docs-vakt.test.ts`); `CLAUDE.md` §"Budmotorn" byts; systembokens §9
  får loggen; `docs/README.md` uppdateras.
- Minnet: `off-book-lacks-state-model` och `off-book-ar-motorterm` uppdateras.

### Etapp 6 — efterkontroll och live
- Alla riggar en sista gång, speldiagnosen orörd (kortspelet berörs inte),
  bordets serverfunktioner testkörda (samma `decideCall`).
- Deploy enligt `deploy-verifiering`. 🚪 Ägarens live-prov: några givar i
  Spela kort, ett bord, en tävlingsgiv.

## 5. Beslutsgrindarna — ägarbeslut längs vägen

🚪 **Grind 0 (tas 2026-09-04): motorbytet blir NU.** Pliktsvepet pausas;
resterna blir facit i etapp 4. Inga fler lappar i manuset eller detektorkedjan
under bytet — en felrapport som kommer in under tiden får sitt facit-test
(`it.todo` tills familjen landar) och lagas i det NYA lagret när familjen kommer.
Är felet akut och ligger i en kunskapsmodul (inte i orkestreringen) får det
lagas direkt.

🚪 **Grind per familj (etapp 3 och 4):** Claude visar auktionsdiffens
b-lista — givarna där budet ÄNDRATS och boken säger att det nya är rätt — med
exempelhänder, precis som vid öppningsstrukturändringar. Ägaren godkänner
familjen eller pekar på en giv som ska bli ett facit-fall först. Mänsklig
input i konkreta budsituationer är här, inte i koden.

🚪 **Grind efter etapp 3:** deploya den ostörda kärnan innan konkurrensen
byggs? Rekommendation: JA, om revisorn inte är sämre — då spelar ägaren på den
nya motorn tidigt och känslan i ostörda auktioner kan bedömas i verkligheten.

🚪 **Grind efter etapp 4:** rivningen (etapp 5) är irreversibel i den meningen
att manuset inte kommer tillbaka. Tas när betydelsesvepet är grönt på störda
auktioner och ägaren spelat på etapp 4-motorn.

## 6. Arbetssättet under bytet

- **En familj per session** är rätt takt; en session får aldrig lämna en
  familj halvflyttad (regeln i `docs/arbetsrutiner.md` 🔴 punkt 3 gäller).
- **Ordval:** "regeln saknades", aldrig "off-book" (ägardirektiv 2026-09-02).
  När bytet är klart finns ordet inte längre att använda.
- **Sifferregeln** gäller loggen nedan: varje mätvärde med sitt kommando.
- **Mätning före bygge:** en familjs ordning i etapp 4 bestäms av hur ofta
  läget uppstår i auktionsdumpen, inte av vad som känns viktigast.

## 7. Vad som medvetet INTE ingår

- Kortspelet (`play-bot.ts`, `dds.ts`, utspelet) rörs inte.
- Inga nya konventioner byggs under bytet. Lebensohl-inkopplingen, 2♣-
  översynens rester och SENARE-listan väntar tills tabellen finns — de blir
  billigare att bygga då (en rad i tabellen i stället för en detektor på rätt
  plats i en kö).
- Inget andra budsystem.

## Ändringslogg

- **2026-09-05 — Etapp 3 familj 3 KLAR: öppnarens återbud.** Raden *återbud*
  i `auction-decide.ts`: läget "jag öppnade, partnern svarade (vår sidas två
  enda kontraktsbud), motståndarna bara pass, ingen X, svaret är det senaste"
  → `openerRebidDecision` = Gerber-svaret (`respondToGerber`) eller
  `openerSecondBid` med partnerns bud SOM JAG SER DET: adaptern
  `partnerResponseAsSeen` härleder bud + regel ur den NAKNA auktionen
  (`meaningOf` utan cachade regler — ett "oklart" 1NT-svar ser ut som vilket
  1NT-svar som helst). Två namn där läsaren och återbudsfunktionen skiljer sig
  översätts i adaptern ('NT-svar' → '1NT', 1NT–2NT 'inbjudan' → '2NT
  inbjudan'); två namn rättades i läsaren (3NT över svag tvåa = '3NT till spel',
  1M–4M = 'spärr till utgång'). Manusets återbud går genom samma funktion.
  Regelnamnssvepet som styrde adaptern (sond, 3000 frön, svararens bud i
  ostörda botauktioner): 1313 svar, 1235 samma namn, resten de fyra mönstren
  ovan + 'oklart'. **Kunskapsmoduler lagade med facit** (svararens nya färg kan
  ligga högre än botens billigaste nivå — avvikelsedumpen visade 30 OLAGLIGA
  återbud): `openerRebidAfterNewSuit` (svag tvåa) och
  `openerRebidAfterPreemptNewSuit` tar svarets nivå, rebjuder egen färg över
  svaret och höjer med max till UTGÅNG, aldrig förbi (facit frö 20271048:
  2♠–3♥ → 4♥, inte 5♥ — skarp i kön); `openerRebidAfter2C` passar när svaret
  redan ligger på 3NT+. Efter fixarna: 0 olagliga. **Auktionsdiffen** (baslinje
  `5b1a9dc`): 3000 givar, ÄNDRAT BUD 1 = frö 20271048 (5♥ → 4♥, klass b, facit),
  samma bud med annan källa 1263. **Avvikelsedumpen** (12678 auktioner, tre
  lägen): ÄNDRAT BUD 2131, ALLA i öppnarens återbud; svar-läget 479 ändrade —
  öppnaren svarar nu Ogust, accepterar 2NT-inbjudan, höjer Bergen/enkel
  höjning till utgång, reläar på splinter, svarar Gerber, i stället för
  gisslagrets 3NT/5♦/pass. Täckning i svar-läget: 1427 återbud ur tabellen;
  resten är svar utan systemregel (svagt hoppskift är avskaffat 2026-07-06,
  3-lägesfärg över 1NT och hopp till 4-läget saknar återbudsregel i modulen,
  4NT = RKC-detektorn) → det gamla lagret som förut. **Kikvaktens mätläge**:
  2898 bud, 208 byter (7,2 %, från 9,2 %); `tabell:återbud` 122/0.
  **Sveparna**: betydelse ostört 0/3/0, kända motoravvikelser 40 bud i 3
  mönster → **39 i 2** (svag tvåa-mönstret försvann med fixen); förklaring
  0/0; regelsvepet grönt. **Bok-mot-motor-fynd (ägarbeslut, familj 2/3):**
  (9) en PASSAD hands 2NT över 1♥/1♠ — motorns svarsfunktion faller tillbaka
  på Jacoby 2NT (utgångskrav), men §6.7 säger att passad hand är begränsad
  till utgång och läsaren läser 2NT som naturlig inbjudan 11–12; öppnaren får
  idag inget återbud ur tabellen (det gamla lagret passar). Hela sviten grön
  (`npm test`), `npx tsc` rent. **Revisorn** (kommandot i §3, 1000 givar, frö
  20260721): rätt kontrakt 20,3 % · snittförlust 268,55 — identiskt med
  baslinjen (frö 20271048 ligger inte i revisorns urval).
- **2026-09-04 — Etapp 3 familj 2 KLAR: svaret.** Raden *svar* i
  `auction-decide.ts`: läget "partnern öppnade (enda kontraktsbudet), inget
  utom pass sedan dess, jag har inte bjudit, öppningen har svarsregler
  (`RESPONDABLE`)" → `responseDecision(öppning, hand, passad hand)` = manusets
  gamla `computeResponse` (flyttad hit; manuset läser den) + Gerber-handens 4♣
  över 1NT/2NT ur egen hand (`gerberAsk` i `nt-slam.ts`, som manusets
  Gerber-sekvenser nu börjar med). `decideCallTraced` fick laglighetsvakten:
  ett olagligt tabellbud blir pass med källan märkt `(olagligt … → pass)`.
  Facit: `auction-decide.test.ts` (familj 2), kikvakten prövar nu VARJE bud
  med källa `tabell:*` i botauktionerna (växer av sig självt per familj).
  **Auktionsdiffen** (baslinje `451f692`): 3000 givar, ÄNDRAT BUD 0, samma
  bud med annan källa 1598 (manus → tabell:svar). **Avvikelsedumpen**
  (kommandot i §3, baslinje `451f692`): 10200 auktioner, ÄNDRAT BUD 4008 —
  ALLA i själva svaret, inga olagliga bud; förut svarade `offBookResponse`
  (gissning: höjde spärrar till utgång, 5♣ på 2♣ …) eller ingen regel alls
  (pass på 2♣, 3NT, 1♠ …), nu systemsvaret (analysen: 248 mönster, störst
  3NT→6NT 428, 3♠→spärr-pass 163, 2♦→spärrhöjning 124, 2♣→2♦ väntebud 122,
  2♥→Ogust 121; `scratch analys` per första skillnad). Klass (b) per
  konstruktion: samma kunskapsfunktion som manuset använder när boten
  öppnar. **Bifynd till familj 3** (syns i avvikelsedumpen, t.ex.
  `20270006/3:e hand/1H`): efter svararens Jacoby 2NT på en öppning manuset
  inte förutsåg PASSAR öppnaren — det gamla lagrets kravvakt känner inte
  Jacoby utan manus; landar när öppnarens återbud flyttar. **Kikvaktens
  mätläge**: 2898 bud, 267 byter (9,2 %, från 11,5 %); `tabell:svar` 154/0.
  **Sveparna** (betydelse/förklaring/regel): identiska med familj 1.
  Frekvensbilden: manus 11333 → 9735, `tabell:svar` 1598. Facit-kön: frö
  20271606 skarp (Nord svarar 1NT på Syds 1♠); 2♣- och svag-tvåa-fynden
  omdöpta till familj 3/4 (de rör återbud, inte svaret). Fem tester i
  `auction-live.test.ts` ("datorpartnern svarar på Syds egna bud") vaktade
  gisslagrets egna nivåer (3♠/4♠/2NT/5♦/3♦) och skrevs om till systemets
  facit (Bergen 3♦, Jacoby 2NT, semi-forcing 1NT, inverterad 2♦). Hela sviten grön
  (`npm test`), `npx tsc` rent. **Revisorn** (kommandot i §3, 1000 givar, frö
  20260721): rätt kontrakt 20,3 % · snittförlust 268,55 — identiskt med
  baslinjen (bot mot bot ändras inget).
- **2026-09-04 — Etapp 3 familj 1 KLAR: öppningen per stol.** Ny fil
  `auction-decide.ts` (beslutstabellen, §2 steg 3) med raden *öppning*: läget
  "ingen har öppnat" (`facts.opening === null`) → `classifyOpening(hand,
  sårbarhet, position)` där positionen räknas ur passen hittills. `decideCallTraced`
  frågar tabellen FÖRST (källa `tabell:öppning`); manusets öppningsloop i
  `auction.ts` läser samma tabell (manuset härleds ur besluten). Facit:
  `auction-decide.test.ts`; kikvakten skarp för öppningsvarvet
  (`kikvakt.test.ts`, 300 givar). **Auktionsdiffen** (kommandot i §3, baslinje
  på `bd8c869`): 3000 givar, ÄNDRAT BUD 0, samma bud med annan källa 3000 —
  varje öppningsvarv har bytt källa manus → tabell:öppning med samma regel;
  passen före öppnaren bär nu regeln `pass` med förklaring (förut ingen regel).
  **Ändrade bud finns bara där människan avvek i öppningsvarvet** — dagens
  motor hade ingen regel för nästa stol när människan passat en hand manuset
  "skulle" öppnat, given passades ut (sond 2026-09-04, tre facit-fall i
  `motorbyte-facit.test.ts`: frö 20270021 → Väst 1NT, 20270018 → Öst 1♠,
  20270003 → Syd 1♠ i 3:e hand). Bifynd till familj 2 (facit-kön, `it.todo`):
  öppnar människan en hand motorn inte klassar som öppning, och ingen annan
  stol gör det, svarar partnern aldrig (`ingen öppning`, frö 20271606).
  **Kikvaktens mätläge** (kommandot i §3): 2898 bud, 332 byter (11,5 %, från
  404/13,9 %); `tabell:öppning` 522 bud / 0 byter. **Betydelsesvepet** och
  **förklaringssvepet**: identiska med etapp 2-loggen (ostört 0/3/0, kända
  motoravvikelser 40 bud i 3 mönster; 0 utan förklaring, 0 gissningar).
  Frekvensbilden: manus 16679 → 11333 bud, `tabell:öppning` 5398
  (auktionsdump-frekvens.txt). Hela sviten grön (`npm test`), `npx tsc` rent.
  **Revisorn** (kommandot i §3, 1000 givar, frö 20260721): rätt kontrakt
  20,3 % · snittförlust 268,55 — identiskt med etapp 0-baslinjen (inte sämre).
- **2026-09-04 — Etapp 2 KLAR: faktalagret.** Ny fil `auction-facts.ts`
  (`auctionFacts` → `AuctionFacts`, fälten i etapp 2-avsnittet) med facit
  `auction-facts.test.ts`; hjälparna flyttade ordagrant ur `auction-live.ts`
  (som krympte från 4999 till 4592 rader: `git diff --stat` mot `b8490a7`).
  `DetectorCtx` fick `facts`; 96 icke-exporterade detektor-/mönsterfunktioner
  tar nu `c: DetectorCtx` eller `f: AuctionFacts` i stället för `(deal,)
  history, seat` (`grep -cE "^(function \w+\(|  )[cf]: (DetectorCtx|AuctionFacts)"
  src/lib/engine/auction-live.ts`). Bytet gjordes i tre mekaniska pass (flytt →
  fältläsning → resterande skanningar), med typkontroll och auktionsdiff efter
  varje. **Auktionsdiffen** (kommandot i §3, baslinje på `b8490a7`): 3000
  givar, ÄNDRAT BUD 0, samma bud med annan regel/källa 0. **Kikvaktens
  mätläge** (kommandot i §3): oförändrat 2898 bud / 404 byter (13,9 %), alla ur
  manuset. **Betydelsesvepet** (kommandot i §3): identiskt med mergepunkten —
  ostört kravnivå 0, alert 3 bud i 1 mönster (= den kända motoravvikelsen
  2♣–3♦–3♥–4♦, frö 20271084, facit i kön), registerhål 0; kända
  motoravvikelser 40 bud i 3 mönster (samma tre som i etapp 1-loggen; antalet
  räknar bud, inte mönster). **Förklaringssvepet**: 0 utan förklaring, 0
  gissningar. Hela sviten grön (`npm test`), `npx tsc` rent. Inga bud ändrade
  → inget grindbeslut; nästa: etapp 3 familj 1 (öppningen).
- **2026-09-04 — Etapp 1 KLAR: betydelselagret.** `auction-interpret.ts` →
  `auction-meaning.ts` (git mv; `meaningOf` + den ostörda läsaren, §4–§6 i
  kod), `auction-interpret.ts` = tunn läsare. Betydelsesvepet
  (`auction-meaning.probe.test.ts`) och kikvakten (`kikvakt.test.ts`) byggda.
  **Mätning före → efter** (`$env:BETYDELSE='1'; npx vitest run
  src/lib/engine/auction-meaning.probe.test.ts`, frön 20270001–20273000, 1388
  ostörda av 3000 givar, 4998 botbud med regel i ostörda auktioner): kravnivå-
  avvikelser 2826 bud/106 mönster → **0** · alert 915/37 → **0** · registerhål
  96 regler → **0** · kända motoravvikelser 3 bud/3 mönster (facit i
  `motorbyte-facit.test.ts`). Störda auktioner (etapp 4:s svep): kravnivå 1908
  bud/30 mönster, alert 958/15, registerhål 68 regler. **Auktionsdiffen**
  (kommandot i §3): 3000 givar, ÄNDRAT BUD 0, samma bud med annan regel 2 —
  de två etikettfelen som svepet hittade och som rättades i kunskapsmodulerna
  (`rebids.ts`: 1x–1NT–3m var 'rebid: egen färg' men är 'hopp i egen färg
  (inbjudan)'; `responder-rebids.ts`: 1NT–2♥–2♠–3♥ var 'utgång' men är 'ny
  färg (GF)'). Registret: `superaccept` ej-krav → inbjudan (§4.3 "inbjuder
  utgång"). **Kikvaktens mätläge** (`$env:KIKVAKT='1'; npx vitest run
  src/lib/engine/kikvakt.test.ts`, frön 20270001–20270300): 2898 bud, **404
  (13,9 %) byter bud** när de tre andra händerna byts — ALLA ur källan
  'manus', noll ur detektorerna. Det är måttet på hur mycket manuset kikar;
  ska bli 0 i etapp 3. **Förklaringssvepet** (`$env:FORKLARINGSSVEP='1'; npx
  vitest run src/lib/engine/forklaringssvep.probe.test.ts`): 0 bud utan
  förklaring, 0 gissningar. Hela sviten grön (`npm test`), `npx tsc` rent.
  **Fynd som lagret följer MOTORN i (boken säger annat — ägarbeslut vid
  familjen):** (1) fjärde färg spelas även efter reverse (§6.6 undantar);
  (2) billigaste höjningen av öppnarens andra färg efter reverse är ej krav
  (§6.6: "redan krav"); (3) splintersvaren efter 1♠–3♥ går 4♣/4♦/4♥ = ♣/♦/♥
  (§4.1 säger 3NT/4♣/4♥); (4) semi-forcing 1NT och inverterad höjning spelas
  även av passad hand. **Fynd där motorn bjuder tvetydigt (samma auktion, två
  betydelser beroende på hand — systemfel, facit i kön):** (5) 2♣–2♦–2M–3♣ är
  andra negativa med 0–3 hp men naturlig klöver med 4+ (§4.4 säger alltid
  andra negativa); (6) 4NT över partnerns 1NT-återbud är kvantitativt med jämn
  hand och RKC med egen färg (§5.7) — lagret läser RKC när frågaren visat en
  färg; (7) 2♣–3♦–3♥–4♦ (kravsteget: naturligt) mot 2♣–3♦–3♠–4♦ (manuset:
  cue); (8) öppnaren höjer partnerns kravfärg till 5M över svag tvåa.
  Motorns cue-konvention som lagret nu läser: svararen i utgångskrav sätter
  partnerns färg som trumf med ett 4-lägesbud över 3NT (högfärg: alltid,
  även egen färg; lågfärg: bara utan egen visad färg); den balanserade
  2♣-svararen cue:ar redan på 3-läget; med trumf satt av båda cue:as även i
  egen färg när partnern just cue:at.
- **2026-09-04 — Etapp 0 KLAR: rigg och baslinjer.** Byggt: `decideCallTraced`
  (källa per bud, `decideCall` = `.call` av den — inget bud ändrat), intervall-
  läget `DUMP_RANGE`/`DUMP_OUT` i `auktionsdump.probe.test.ts`, frekvensbilden,
  `scripts/auktionsdiff.mjs`, facit-kön `motorbyte-facit.test.ts` (tre `it.todo`:
  frö 20261162 → 5♣, 20262021 → 4♣, 20262632 → 4♥; facit-buden är förslag som
  ägaren bekräftar vid familjens grind). Hela sviten grön (`npm test`), `npx tsc`
  rent. Klart-villkoret: två körningar av samma kod → `ÄNDRAT BUD: 0`,
  `samma bud, annan regel/källa: 0` (diff-kommandot i §3).
  **Baslinje auktionsdump** (`$env:DUMP_RANGE='20270001-20273000'; npx vitest
  run src/lib/engine/auktionsdump.probe.test.ts` → `auktionsdump-frekvens.txt`):
  3000 givar · 2987 med öppning · 1612 störda (båda sidor bjöd) · 0 oändliga ·
  28971 bud, varav 16679 manus · 9187 pass utan regel · 52 ingen öppning ·
  11 väckning · detektorer i fallande ordning: offBookResponse 780 ·
  ownPreemptInterferenceToAnswer 210 · doublerRaisesAdvance 178 · honorForce 174
  · takeoutDoubleToAnswer 147 · negativeDoubleToAnswer 140 · answerCueRaise 138
  · openerReopensAfterPartnerPass 122 · advancerCompetesToFit 108 ·
  ntInterferenceToAnswer 105 · answerCueBidderRebid 100 (resten < 100, filen).
  Summerat per etapp 4-familj (samma fil, detektor-id → familj för hand):
  dubblingar (2) ≈ 520 · inkliv/advance (1) ≈ 400 · spärrar (7) ≈ 220 · mot 1NT
  (6) ≈ 215 · balansering (5) ≈ 195 · negativ/stöd-X (3) ≈ 195 · fria bud (4)
  ≈ 130 + offBookResponse 780.
  **Baslinje revisorn** (`$env:REVISOR='1'; npx vitest run
  src/lib/engine/revisor.probe.test.ts`, 1000 givar, frö 20260721, ~7 min):
  rätt kontrakt 20,3 % · snittförlust 268,6 · kategorier (antal/förlust):
  missad-utgang 142/48100 · fel-farg-bet 118/50260 · battre-an-facit 116/20320
  · billig-offring 109/28740 · fel-strain 92/2150 · missad-lillslam 80/49730 ·
  sald-giv 62/20130 · for-hogt 42/10140 · missad-storslam 33/38170 · utpassad
  3/810 (`revisor-output/latest.json`). Får inte försämras mellan etapperna.
  Bifynd: `docs/README.md` var dubbelkodad (cp1252-mojibake) sedan 2026-08-07
  — lagad i samma commit.
- **2026-09-04** — planen skriven efter ägarens genomgång ("total genomgång,
  lös detta permanent"). Grind 0 tagen: motorbytet är NU, pliktsvepet pausat.
