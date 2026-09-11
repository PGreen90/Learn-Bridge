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
  saknades. (Svar-läget bär också familj 4a: bottens andra bud på människans
  öppning syns i direkt/3:e hand-lägena.) Sedan familj 4b finns ett fjärde
  läge, *svar2*: bottarna bjuder ostört fram till svararens ANDRA tur
  (öppning–P–svar–P–återbud–P) och människan bjuder vart och ett av de
  lagliga kontraktsbuden upp till 4NT samt 5♣/5♦ (nyckel
  `<frö>/svar2/<öppning>-<svar>-<återbud>-<bud>`) — bottens tredje bud är
  familj 4b:s b-lista. Dumpen avslöjar också OLAGLIGA tabellbud (laglighetsvakten i
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
   Delad 2026-09-05: **4a svararens andra bud KLAR 2026-09-05** (loggen): raden
   *svar2* med `responderSecondDecision` (manusets grenordning; varje slamgren
   ger kaptenens första steg ur egen hand — `slamCaptainFirstStep`,
   `exclusionFirstStep`, `mssFirstStep`, `gerberRebidFirstStep`,
   `systemsOnFirstStep`) och adaptern `rebidAsSeen`. **4b öppnarens tredje bud
   KLAR 2026-09-05** (loggen): raden *tredje* med `openerThirdDecision`
   (manusets grenar: 2/1 försenat stöd · NMF · fjärde färg · 1NT-auktionens
   inbjudan · semi-forcing 1NT · egen höjning + inbjudan · inverterad broms ·
   reverse + preferens · 2NT-checkback · 5-3-jakt) och adaptern `secondAsSeen`;
   svararens tredje bud (placeringarna efter NMF/fjärde färg/checkback/broms)
   ligger kvar i manuset och det gamla lagret tills familj 5.
5. **Slamutredningen** — `slamInvestigation`/Gerber/Exclusion/MSS per stol:
   kaptenens tur använder kaptenens hand, öppnarens tur öppnarens. Funktions-
   signaturerna smalnas till EN hand + fakta. Kikvakten blir skarp här.
   **KLAR 2026-09-05** (loggen): stegmaskinerna `slamTurn`/`gerberTurn`/
   `exclusionTurn`/`mssTurn` (en tur ur EN hand), raden *slam*
   (`slamSituation` läser uppsättningen ur auktionen), raden *svar3*
   (svararens tredje bud: slamsteg efter försenat stöd/NMF-stöd, placeringarna
   efter NMF/fjärde färg/broms/checkback, systems on) och raden *fjärde*
   (Smolen-valet efter 2♣–2♦–2NT). Manuset = förare över samma steg. Tvetydigt
   4NT utan bjuden fit tiger tills ägarbeslut (fynd 14).
6. **Manuset för ostörda auktioner rivs** ur `auction.ts`. **KLAR 2026-09-05**
   (loggen): den ostörda fortsättningen är en loop som frågar beslutstabellen
   stol för stol (samma beslut som vid bordet); adapterkedjan, de två Gerber-
   blocken och tvåhandsförarna för slamsekvenserna är borta. Kvar i
   `buildAuction` tills etapp 4: den modellerade konkurrensronden och flaggan
   `open` (får det gamla lagrets konkurrensdetektorer bjuda vidare när
   tabellen tiger?) — reglerna för flaggan är de rivna grenarnas, oförändrade.
   `buildAuction` blir hjälparen "spela ut fyra stolar" när konkurrensronden
   flyttat in (etapp 4), eftersom det gamla lagret behöver linjen till dess.

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
   inklivarens fortsättningar). **KLAR & LIVE 2026-09-08 (loggen; mergepunkt
   `26687c9`):** raderna *inkliv* (direkt sits + balansering, även passet),
   *advance* (1-/2-lägesinkliv, tvåfärg, 1NT-inklivets systems on), *inkliv2*
   (inklivarens andra tur) och *advance2* (advancerns senare bud); kunskapen
   i `overcall-continuations.ts`. Konkurrens-slaminvitet (etapp 7 hål D)
   blev tabellraden *konkurrens-slam* (`competitive-slam.ts`) med samma
   företräde som steget hade. Bridge-reglerna (`legalCalls` m.fl.) i
   `auction-rules.ts`. Tio detektorer rivna. Kvar i det gamla lagret tills
   familj 2: allt där någon på vår sida dubblat (dubblarens vakter går före),
   inkl. en tunn `advancerCompetesToFit` för de lägena; hoppinklivets advance
   (spärrhöjningen i `raiseWithFit`); advancern efter deras vidarebud över
   ett 1-lägesinkliv (K3 i `raiseWithFit`) → familj 4:s "partnern visade en
   färg".
2. Upplysningsdubbling, svar och dubblarens återbud (den starka dubblaren).
   **KLAR & LIVE 2026-09-08 (loggen; mergepunkt `d3f7116`):** raderna *dubbling*
   (X efter två bjudna färger — även den vanliga 4-4:an), *x-svar*
   (advancerns tvungna/fria svar, responsiv X först), *x-dubblaren*
   (cue-svaret, höjningen av svaret, det starka X-flödet, 3NT över 2NT) och
   *x-advancern* (stödstegen, domen på 3-hoppet, svaret på dubblarens cue);
   kunskapen i `double-continuations.ts`. Deras X av vårt svar = systems on
   i de ostörda raderna (och i betydelselagret). Tio detektorer rivna.
   Familjegräns: deras FÄRGöppning krävs — DONT-X över 1NT (familj 6) och
   dubblingar på vår öppning (familj 3) stannar i det gamla lagret.
3. Negativ dubbling, stöddubbling, öppnarens svar på dem. **KLAR & LIVE
   2026-09-08 (loggen; mergepunkt `2ae5d05`):** raderna *svar-stört*
   (svararens första bud när LHO stört partnerns 1-läges färgöppning — hela
   manusets konkurrenssvar: negativ X, fritt bud, cue, konkurrenshöjning, NT
   med stopp, K3-tabellen, Jordan/XX), *stöd-x* / *stöd-x-svar* /
   *stöd-x-öppnaren*, *negativ-x-öppnaren* / *negativ-dubblaren*,
   *jordan-öppnaren* / *jordan-svararen*; kunskapen i
   `contested-opening.ts`, höjningslogiken utbruten till `fit-raise.ts`
   (familj 4:s hem). Sex detektorer rivna. Manusets stöddubblingsrond
   (kik i öppnarens hand) riven utan ersättning: **RHO:s inkliv över vårt
   svar bjuds i botauktionerna först i familj 4** — provet visade att utan
   öppnarens konkurrensåterbud i tabellen faller återbudet till det gamla
   lagrets catch-all (4♠ på 13 hp, reverse på 14, cue som partnern passar).
4. Svararens fria bud, öppnarens fortsättning i konkurrens, höjningar på visad
   längd, lagen om totala stick (pliktsvepets K-regler blir facit här). **Tar
   med sig från familj 3:** RHO:s inkliv över vårt svar (raden byggs när
   öppnarens rad finns; `overcall` mot svaret med tredje-färgs-/stoppvakt),
   svararens svar på öppnarens cue i konkurrens (frö 20270156-mönstret:
   cuet passades), negativ-dubblarens ojämna 13+-händer utan stopp.
   **KLAR & LIVE 2026-09-09 (loggen; mergepunkt `4fa2604`, grinden godkänd):**
   raderna *inkliv-över-svaret*
   (sandwich-sitsen ur RHO:s egen hand, `overcallOfResponse`),
   *öppnaren-stört* (svaret på cue-höjningen, §5.4, §5.10, det fria budets
   höjning + det NYA återbudet utan stöd, §5.8 med fit mätt mot vad svaret
   lovade, §5.9 A/B, svaret på partnerns cue) och *svararen-stört* (maximal/
   2NT-domen, fortsättningen efter höjt fritt bud, cue-höjarens fortsättning,
   NYTT: svaret på återöppningsdubblingen, svaret på öppnarens cue, negativ-
   dubblarens 13+-cue, fortsättningen efter fritt bud utan höjning); kunskapen
   i `contested-continuations.ts`. Tolv detektorer rivna. Kvar åt senare
   familjer: advancerns bud efter deras negativa dubbling/höjning av
   inklivet (familj 1:s rest, `offBookResponse`:s största kvarvarande post),
   öppnarens fortsättning efter deras X + partnerns höjning (1x–(X)–2x–…),
   svararen som passat och sedan möter öppnarens andra X (K1-resten).
5. Balansering och återöppning. **KLAR & LIVE 2026-09-09 (loggen; mergepunkt
   `78735c2`, grinden godkänd "pcd"):** raderna *advance2* (advancern efter
   deras X/höjning, `advancerActsInCompetition`), *öppnaren-stört* (öppnaren
   efter deras X + höjning, `openerActsInCompetition`) och *svararen-stört*
   (K1-resten: den negativa dubblaren svarar på öppnarens ANDRA X,
   `responderAnswersSecondDouble`); ny modul `balancing-continuations.ts`.
   `offBookResponse` 711→223 (den största kvarvarande detektorn nästan halverad;
   lever kvar för familj 6–9 + rena advancern). Svar-stört-rättelsen (höjning i
   stället för negativ X med 3+ stöd i partnerns högfärg — familj 3) ÅTGÄRDAD &
   LIVE 2026-09-09 (loggen nedan).
6. Försvar mot 1NT (DONT, naturligt inkliv, Lebensohl, värde-X, flykt). **KLAR &
   LIVE 2026-09-09 (loggen; mergepunkt `d07cdd8`):** raderna *försvar-1nt*
   (DONT/naturligt mot deras 1NT, direkt + balansering), *dont-advance* (advancern
   + egen DONT-rättelse) och *vårt-1nt-stört* (Lebensohl, värde-X, flykt över vårt
   1NT); ny modul `nt-defense-continuations.ts`. Manusets 1NT-försvarsrond riven
   (ask→tabell), elva detektorer rivna. Bot mot bot 0 ändrade bud; avvikelsedumpen
   250 nya försvar (boten passade förr deras 1NT via `decideCall`).
7. Försvar mot svaga tvåor och spärrar, deras höjningar. **KLAR & LIVE
   2026-09-09 (loggen; mergepunkt `47c6e6f`):** raderna *försvar-svag2*
   (vår sidas första försvar mot deras svaga tvåa/spärr — direkt, balansering
   och efter deras spärrhöjning, `defendTheirPreempt` via `conventionalDefense`/
   `defendPreempt`) och *svag2-fortsättning* (advancerns svar på partnerns
   tvåfärgs-cue + svararens svar på störning av VÅR svaga tvåa/spärr); ny modul
   `preempt-defense-continuations.ts`. Manusets två §7.6-ronder + väckningen
   rivna, tre detektorer borta. Bot mot bot 0 ändrade bud; avvikelsedumpen 2331
   nya försvar (boten sålde förr deras svaga tvåa/spärr via `decideCall`).
8. Konkurrens-slam (kontroll-komplett 4NT, placering). **KLAR & LIVE
   2026-09-10 (loggen; mergepunkt `df930d9`):** steg 1 (kontroll-komplett 4NT)
   flyttades redan i familj 1 (raden *konkurrens-slam*), och steg 2 (cue-frontend
   för kontroll-ofullständiga händer) är PARKERAT (ny konvention, `senare.md`).
   Familjen blev därför **slam-svarssvepet**: de sex kvarvarande slam-detektorer
   som fyrade när linjen tog slut (människan/inklivet förde budet förbi manuset)
   → raden *slam-forts* (ny modul `slam-answer-continuations.ts`): essfrågan 4NT
   (1430 RKC) + kungfrågan 5NT besvaras oavsett hur trumfen sattes (#9/#10/
   R1-fynd #3), rättelsen över stoppet (#60), 3NT→6NT-höjningen (#42) och
   3NT-stoppen (etapp 7 hål 2). Raden ligger SIST i tabellen (samma sista-utväg-
   företräde detektorerna hade). Ren klass a — 0 ändrade bud. Kvar i det gamla
   lagret: catch-all-vakterna (`offBookResponse`, `honorForce`,
   `answerTransferGameChoice`, `maybePenaltyDouble`) → sista städfamiljen.
9. Betydelsesvepet på störda auktioner till noll. **KLAR 2026-09-10 (loggen):**
   betydelselagret räknar kravnivå/alert i konkurrens ur rollen; störda grinden
   0/0/0; de kortberoende resterna dokumenterade som `STÖRDA_UNDANTAG` utanför
   grinden (ägarbeslut "noll på det avgörbara + lista resten"). 0 ändrade bud.

**Klart när:** `FORCED_DETECTORS`/`CONTESTED_DETECTORS` är tomma och raderas
tillsammans med kedjevakten (detector-chain-testet, raderat 2026-09-11),
`divergedFromLine`, `open`-flaggan och `offBookResponse`. Det som var "sista utvägen" är nu en vanlig regel i
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

## 4b. Slutkärnan — sessionsplan A/B/C + etapp 6 (designen vald 2026-09-11)

Etapp 5 familj 1 (sju döda detektorer, `9b74b6b`) och familj 2 (fyra små
catch-all-rader, `9d45c31`) är live. Kvar i det gamla lagret: exakt **två
detektorer** (`offBookResponse`, `honorForce` i `CONTESTED_DETECTORS`),
**manus-grinden** (`buildAuction` → `open`-flaggan + `divergedFromLine` i
`decideCallTraced`) och allt som refererar dem.

Första försöket att flytta de två detektorerna som ogatade tabellrader
(2026-09-10, `aa103f0`, reverterat) misslyckades **inte på kunskapen utan på
gaten**: de fyrar idag bara när `built.open || offBook`; som ogatade rader
(frågas FÖRST) återöppnade de AVGJORDA auktioner — kärnexemplet
`1NT–2♥–2♠–2NT–3♠ → 4♠` där partnern redan avböjt inbjudan (31 bot + 109 avvik
ändrade bud). Slutsatsen: **designa ett troget faktabaserat villkor FÖRST, prova
inte gates.**

### Vad `built.open` betyder (mätt ur `auction.ts`, inte gissat)
Grinden (`auction-live.ts:408`) släpper fram detektorerna när människan avvikit
(`offBook`) ELLER linjen tog slut och `open`. I konkurrens är `open` ≈ "alltid"
(störda catch-all-lägena är sedan familj 5 egna rader). Ostört är `open` en
**djup-proxy** för "ingen har placerat kontraktet än": öppen när tabellen tiger
efter svar/återbud/svar2/tredje (turns ≤ 4), öppen vid svararens tredje bud
(turns = 5) bara om svararens andra bud var fjärde färg/NMF, annars stängd
(turns ≥ 6, slamraden bjudit, partnerns bud var `avslut`, eller stolen passade).
Det är proxyn som ersätts med sanningen.

### Kärndesignen: `partnerSignedOff(f)` — ett faktum ur betydelselagret
Sanningen bakom "auktionen är avgjord" är **betydelsen av partnerns senaste
bud**: ett avslut (kravnivå `avslut`) eller ett obestritt utgångsbud.
Betydelselagret bär redan axeln (`f.meaning(i).forcing` för både botbud och
människobud). Nytt fält i `AuctionFacts`, räknat ur auktionen ensam (kikvakten
gäller):
1. Hitta partnerns senaste bud `i` (kontraktsbud/X/XX — pass räknas inte; inget → `false`).
2. Någon motståndare gjort kontraktsbud/X efter `i` → `false` (auktionen lever; konkurrensraderna äger den).
3. `f.meaning(i).forcing === 'avslut'` → `true`.
4. Annars: partnerns senaste kontraktsbud är utgång+ och obestritt (dagens `partnerGameBidStandsUnopposed`, flyttas in i fakta) → `true`.
5. Annars `false`. **`ej-krav` räknas som LEVANDE** (t.ex. `1♠–1NT–2♦` ska kunna få preferens/höjning).

**Troget, inte en gate:** de tre c-mönstren var alla "höjer partnerns avböjda
inbjudan/preferens". Bedöms de som levande beror det på att budets kravnivå INTE
är `avslut` — då lagas det i **betydelselagret/registret** (familj 9:s metod),
inte med en gate.

### De två nya raderna (sist i tabellen, efter *slam-forts*)
Ordningen speglar det gamla lagret: alla slam-detektorer låg FÖRE
`offBookResponse`, `honorForce` var sista vakten.

| Rad | `läge(f)` | `välj` | Kunskap |
|---|---|---|---|
| **`partner-färg`** | `f.partnerLastSuit !== null && !f.partnerSignedOff` | `partnerSuitResponse(hand, f)` | finns redan i `balancing-continuations.ts` (ordagrant `offBookResponse`) — exporteras; behåll `outstandingArtificialForce`-vakten. |
| **`krav-minimibud`** | `f.force !== null && !f.partnerSignedOff` | `forcedMinimumBid(hand, f)` | flyttas ordagrant ur `auction-live.ts` till `catch-all-continuations.ts`. |

Källorna blir `tabell:partner-färg` / `tabell:krav-minimibud`; kikvaktens
300-givarssvep täcker dem (`källa.startsWith('tabell:')`).

### Session A — Etapp 5 familj 3: slutkärnan (rader + villkor), MÄTT — KLAR 2026-09-11 (loggen)
- **A0.** Baslinjer på `aa103f0` (auktionsdump 3000 + avvikelsedump, mätprotokollet). Revisorns baslinje 20,7 % · 270,43 (`df930d9`) — kör efter bygget och jämför.
- **A1. Facit FÖRE fix** (`motorbyte-facit.test.ts`, block `etapp 5 slutkärnan`): `1NT–2♥–2♠–2NT–3♠` m. fit → **pass**; djupt ostört 2/1 där tabellen tiger under utgång → **ett bud, aldrig pass** (`it.todo` tills given vald ur A4); `auction-facts.test.ts`: `partnerSignedOff` (i) avslut→true (ii) obestritt utgång→true (iii) motst. bjöd efter→false (iv) `ej-krav`→false (v) pass→false.
- **A2. Betydelserättelse INNAN raderna:** alla "stannar/avböjer"-svar är redan `avslut` UTOM två: `1NT–2♥–2♠–2NT–3♠` (`rebids.ts` `openerThirdBidIn1NTAuction`, idag `preferens`) och `1M–1NT–2M–2NT–3M` (`rebids.ts`, idag `rebid: egen färg`) → nytt regelnamn **`avböjer inbjudan: rättelse`** = `avslut`. `preferens` förblir `ej-krav`. Bygget: `rules.ts` (`FORCING_BY_RULE` + `ALL_ENGINE_RULES`), de två producenterna, härledda läsaren i `auction-meaning.ts` (`overNaturalNT`-grenen), förklaringstexten oförändrad. Budneutralt; betydelsesvep ostört 0/0/0.
- **Känt hål (facit-kö, INTE bygge i A):** öppnarens svar på `1x–1y–1NT–2NT` saknar gren i raden *tredje* — idag `offBookResponse`/pass; efter A ger *partner-färg* samma bud (klass a). `it.todo` (pass 12–13 / 3NT 14 / 3y-fit).
- **A3. Bygget:** (1) `auction-facts.ts` `partnerSignedOff` (+ flytt av `partnerGameBidStandsUnopposed`); (2) `catch-all-continuations.ts` `forcedMinimumBid(hand, f)`; (3) `balancing-continuations.ts` export `partnerSuitResponse`, dess `partnerGameBidStandsUnopposed`-anrop → `f.partnerSignedOff`; (4) `auction-decide.ts` raderna sist; (5) `auction-live.ts` wrapparna bort, `CONTESTED_DETECTORS` tom (listorna + grinden står kvar till B); (6) kedjevakten (detector-chain-testet) raderas; (7) `npx tsc`.
- **A4. Mätning och klassning (kärnan):** auktionsdiff + avvikelsediff mot baslinjerna, aggregera första skillnad per mönster; `olagligt` = 0. Väntat: `offBookResponse→partner-färg`/`honorForce→krav-minimibud` samma bud = **a**; `pass`/`manus`→`krav-minimibud` i ostörd 2/1-/2♣ under utgång = **b** (frö i loggen, visas ägaren); `pass`→`partner-färg` på djup ≥ 6 granskas en och en (systemriktig höjning = **b**; "partnern hade stannat" = betydelsehål → A2-rättelse, aldrig gate); höjning av fjärde färg/NMF → nu pass/kravbud = **b**; allt annat = **c** lagas före merge. **Kräver ett c-mönster en GATE → STOPP, rapportera ägaren.** Sveparna: pliktsvep, förklaringssvep, regelsvep, betydelsesvep (ostört 0/0/0, stört grind 0), kikvakt (skarp; deterministisk assertion på `krav-minimibud` om svepet < 5 träffar), `npm test`, revisorn 1000 (inte sämre).
- **A5. Docs + grind:** planens §4 etapp 5-rad + logg, CLAUDE.md NU, budsystem §9. 🚪 **Grind familj 3:** b-lista med exempelhänder → godkänt → `--no-ff`-mergepunkt → PCD.

### Session B — Etapp 5 familj 4: rivningen av manuset (0 ändrade bud)
Efter A kan det gamla lagret bara ge pass → rivningen är 0-diff **per
konstruktion**, bevisas med dumparna.
- **B0.** Baslinjer på A:s mergepunkt.
- **B1.** `auction-live.ts` → bridge-reglerna + `decideCall` (fakta → `decideFromTable` → laglighetsvakt → `pass (ingen regel)`). Bort: `DetectorCtx`, `LiveDetector`, `FORCED_/CONTESTED_DETECTORS`, `divergedFromLine`, `buildAuction`/`turnsToCalls`-importerna.
- **B2.** `auction.ts` → tunn hjälpare: `buildAuctionCore` raderas; ny `buildAuction` kör `decideCall` stol för stol (återanvänd `simulateAuction`); `BuiltAuction` tappar `open`; `DecidedCall.avslut` blir död → bort (sanningen bor i `partnerSignedOff`); `auction-contract.ts` behåller bara `contractFromCalls`.
- **B3.** Testmigrering (24 filer anropar `buildAuction`): `open`-assertioner stryks, hela-`turns`-jämförelser i störda auktioner → budföljd (`simulateAuction(deal).map(c=>c.bid)`), **inget förväntat bud ändras**. Kikvakten skärps: `källa.startsWith('tabell:')`-filtret bort (varje bud oförändrat när tre händer byts).
- **B4. Bevis:** `npx tsc`; auktionsdiff **0** + avvikelsediff **0**; `npm test` grön; sveparna oförändrade; kikvakten total grön; revisorn identisk.
- **B5.** Logg + CLAUDE.md; 🚪 ingen b-lista (0 diff) → godkänt + PCD, mergepunkt.

### Session C — Etapp 5 familj 5: dokumentation, minne, CLAUDE.md
Efter C ska "off-book"/"on-book"/"manus" bara finnas i historik. `docs/status.md`
§"tre auktionslager" → "tre steg i ett beslut"; `docs/off-book-syd.md` → ARKIV;
`docs/README.md`; `CLAUDE.md` NU-blocket + §"Budmotorn" + en låsning "Motorbytet
KLART & LIVE"; `docs/budsystem.md` §9 + de renderade off-book-omnämnandena;
`.claude/commands/felrapporter.md`; minnet (`motorbytet-manus-till-spelare` KLART,
`off-book-lacks-state-model` historisk, `MEMORY.md`).

### Etapp 6 — efterkontroll och live
Alla riggar en sista gång på C:s mergepunkt (kikvakt total, dumparna,
betydelsesvep, revisorn 1000, `npm test`, `npx tsc`); speldiagnosen orörd;
bordets serverfunktioner (`bord-motor.ts`/`validera.ts` via `decideCall`)
testkörda + ett lokalt bord. Deploy enligt `deploy-verifiering`. 🚪 Ägarens
live-prov: några givar i Spela kort (minst en "utanför boken"), ett bord, en
tävlingsgiv.

### Mätprotokoll (kommandon — sifferregeln)
```
$env:DUMP_RANGE='20270001-20273000'; $env:DUMP_OUT='revisor-output/auktionsdump-slutkarna-baslinje.json'; npx vitest run src/lib/engine/auktionsdump.probe.test.ts
$env:AVVIK='1'; $env:AVVIK_OUT='revisor-output/avvikelsedump-slutkarna-baslinje.json'; npx vitest run src/lib/engine/avvikelsedump.probe.test.ts
$env:DUMP_RANGE='20270001-20273000'; npx vitest run src/lib/engine/auktionsdump.probe.test.ts
$env:AVVIK='1'; npx vitest run src/lib/engine/avvikelsedump.probe.test.ts
node scripts/auktionsdiff.mjs revisor-output/auktionsdump-slutkarna-baslinje.json revisor-output/auktionsdump.json
node scripts/auktionsdiff.mjs revisor-output/avvikelsedump-slutkarna-baslinje.json revisor-output/avvikelsedump.json revisor-output/avvikelsediff.txt
$env:PLIKT='1'; npx vitest run src/lib/engine/pliktsvep.probe.test.ts
$env:BETYDELSE='1'; npx vitest run src/lib/engine/auction-meaning.probe.test.ts
npx vitest run src/lib/engine/kikvakt.test.ts
$env:REVISOR='1'; npx vitest run src/lib/engine/revisor.probe.test.ts
npx tsc; npm test
```
Olagliga tabellbud räknas med `node -e` över JSON-filen (källa `olagligt`) — 0.
Motorfilerna är CRLF: patcha med node-skript som fil i scratchpad, aldrig heredoc.

### Risker (lärdomar som gäller)
- **Ingen gate i `läge`.** Kräver ett c-mönster en gate → stopp + ägarfråga.
- Raderna ligger SIST → positionsraderna äger sina bud (familj 8:s lärdom); kolla ändå att `krav-minimibud` inte fyrar där en rad medvetet returnerar `null`.
- `f.force` i konkurrens = bara rondkrav (`competitionForce`) — ingen breddning.
- CLAUDE.md-vakten (16 kB): mät `git show :CLAUDE.md | wc -c` (LF) före push.
- Kikvakten total kan avslöja `pass (ingen regel)`-ändring vid människoöppning utan svarsregel (`!RESPONDABLE`) — hål i raden *svar*, facit-kö, inte undantag.


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
**TAGEN 2026-09-05: JA** — familj 1–6 är live (sista mergepunkt `f05bfef`),
revisorn identisk med familj 5.

🚪 **Grind efter etapp 4:** rivningen (etapp 5) är irreversibel i den meningen
att manuset inte kommer tillbaka. Tas när betydelsesvepet är grönt på störda
auktioner och ägaren spelat på etapp 4-motorn.

## 5b. Ägarbeslut på etapp 3:s bok-mot-motor-fynd (påbörjat 2026-09-05, svepet KLART 2026-09-05)

Etapp 3 samlade 15 numrerade bok-mot-motor-fynd (loggen; kartan sa "sexton" —
nr 10 finns inte, det försvann när familj 4a:s slam-buggar lagades direkt).
Ägaren tar besluten en i taget. Här förs varje beslut in när det tas; själva
bygget (systembok §, facit-test FÖRE fix, regeln i det nya lagret) görs
test-drivet efter svepet och deployas inte utan ägarens PCD.

- **Beslut 1 — fynd 6 + 15 (4NT och 4♣ över 1NT-återbudet), 2026-09-05.**
  Ägarbeslut: efter `1x–1M–1NT` (öppnaren 12–14 jämnt), svararens andra bud —
  (1) **färg att visa → 2♣ NMF**, sedan rebjud färgen (slam med känd färg går
  aldrig via 4♣/4NT); (2) **jämn hand utan färg, sikte på NT-slutkontrakt,
  styrkan räcker (kan räkna ~33 mot partnerns minimum 12) → 4♣ Gerber** —
  förstahandsvalet, för mot ett så snävt intervall (12–14) är essen den verkliga
  okända, styrkan räknar svararen själv; (3) **jämn hand på gränsen (slam bara om
  partnern max, ~19–20) → 4NT kvantitativt**; (4) ingen slamambition → 3NT.
  Motorn knyter idag 4♣ Gerber till att man HAR en färg — det vänds: 4♣ = jämn
  NT-hand UTAN färg, färgen sköts av NMF. §5.7:s gamla "klöverinbjudan 4m"
  försvinner (ersätts av NMF-vägen). Tröskel Gerber/4NT: "kan jag räkna 33 mot
  partnerns minimum?" → Gerber, annars 4NT. Rör §5.7 + §6.4.
  **BYGGT & LIVE 2026-09-05 (mergepunkt `3491ece`; ägaren godkände 5♣ på frö 20261109 som systemriktig miss):** NMF-vägen med
  färgvisning 3M/3m + öppnarens 4M / 3NT / 4m + slamsekvens på prefix 7;
  Gerber-med-färgplacering och 5M/4♦-inbjudan borta; facit "§5b beslut 1" i
  `motorbyte-facit.test.ts`; mätningarna i loggen nedan och systembokens §9.

- **Beslut 2 — fynd 1 (fjärde färg efter reverse), 2026-09-05.** Ägarbeslut:
  behåll motorns linje — fjärde färg efter en reverse (`1♦–1♠–2♥–3♣`) är
  **konstlad** (håll-/beskrivningsfråga), inte naturlig. Auktionen är redan
  utgångskrav, men håll-frågan till 3NT är verklig. Rätta boken §6.6 (som idag
  undantar reverse). Rör §6.6.
  **BYGGT & LIVE 2026-09-07 (mergepunkt `f7d5c72`, Actions grön, rebidz.com aliasad; loggen nedan).** Utöver bokrättelsen fick
  det nya lagret öppnarens SVAR på fjärde färgen på 3-läget (efter reverse
  ligger den där): förr rebjöd det gamla lagret alltid öppningsfärgen (och
  höjde fjärde färgen till 5♣ med fyra klöver), nu samma prioritet som i
  grundmönstret — 3-stöd, extra längd, 3NT med håll, höjning med fyra.

- **Beslut 3 — fynd 2 (höjning av öppnarens andra färg efter reverse),
  2026-09-05.** Ägarbeslut: efter en reverse går man nästan alltid till utgång,
  så höjningen delas i "fast arrival" — **billig höjning (`1♦–1♠–2♥–3♥`) = stark,
  slamintresse, minst poäng till egen öppning (~12+), 3+ stöd**, öppnar 4-nivån
  för kontrollbud ([[cue-bids-reinstated]]); **hopp till utgång (`…–4♥`) = den
  svagare handen med 3+ stöd, ingen slamambition**. Ingen svag delkontrakts-
  escape behövs (minimihanden hoppar till 4♥). Ersätter både motorns "ej krav"
  och bokens odelade "krav". Rör §6.6.
  **BYGGT & LIVE 2026-09-06 (mergepunkt `1a6adf0`; ägaren bekräftade 4+ stöd):** 3M/4M i `fourthSuit`,
  öppnaren öppnar cue-ronden (`SlamSetup.partnerStarts`, prefix 4 i
  `slamSituation`), betydelselagret läser 3M/4M och kontrollbud i egen färg;
  bygget kräver **4+ stöd** (beslutstexten säger 3+ — reversens färg är 4
  kort; ägaren avgör). Mätningar i loggen nedan och systembokens §9.

- **Beslut 4 — fynd 3 (kortfärgen efter `1♠–3♥–3♠`, tvetydig splinter),
  2026-09-05.** Ägarbeslut: **rena steg** — kort ♣→3NT, kort ♦→4♣, kort ♥→4♦
  (lägst möjligt hela vägen = mest rum för kontrollbud, samma logik som beslut
  3). Ersätter motorns "bjud din korta färg" (4♣/4♦/4♥) och bokens
  4♦-överhopp (3NT/4♣/4♥). `1♥–3♠–3NT`-tabellen (4♣=♣/4♦=♦/4♥=♠) är redan
  rena steg — lämnas. Rör §4.1 (bara `1♠`-tabellen) + splinter-reläsvaret i
  motorn.
  **BYGGT & LIVE 2026-09-07 (mergepunkt `26b05ac`, Actions grön, rebidz.com aliasad; loggen nedan).** Stegbytet var litet, men
  det avslöjade att FORTSÄTTNINGEN efter kortfärgssvaret låg i det gamla
  lagret: 3NT-svaret passades som ett sangkontrakt, och förr bjöd öppnaren
  5♣/5♦ i kaptenens KORTA färg eller passade 4♥-svaret. Nu: slamraden
  (prefix 4, öppnaren startar som efter reverse-höjningen i beslut 3) —
  billigaste kontrollbud under 4M eller 4M-avslut, med K/D/J mittemot
  partnerns kortfärg nedvärderade (`SlamContext.captainShort`); kaptenen
  räknar mot visade 12. Betydelselagret: den tvetydiga splintern sätter nu
  trumfen redan i läsaren (förr lästes kortfärgssvaret 4♣ som ett
  trumfsättande kontrollbud).

- **Beslut 5 — fynd 4 (passad hands semi-forcing 1NT + inverterad minorhöjning),
  2026-09-05.** Ägarbeslut: **Del A** semi-forcing 1NT av passad hand behålls
  (naturligt icke-krav, öppnaren får passa) — skrivs bara in att det gäller efter
  pass. **Del B** inverterat är i praktiken AV för passad hand: `pass–…–1♦–2♦` =
  **6–11, icke-krav, enkel höjning**; öppnaren (1♦-budet) avgör om budgivningen
  går vidare. 3♦ kvar för den svaga formstarka höjningen (5+ ruter, under 6,
  tävlande). Samma för 2♣ efter `pass–…–1♣`. Rör §4 (minorhöjningarna) + motorns
  svarsfunktion för passad hand.

- **Beslut 6 — fynd 5 (`2♣–2♦–2M–3♣`), 2026-09-05.** Ägarbeslut: 3♣ görs
  **naturligt** — **0–7 hp, 5+ klöver** (bjud din riktiga färg, håll auktionen
  levande så 2♣-öppnaren får beskriva en gång till). Symmetriskt: **3♦ = 0–7,
  5+ ruter**, 5-korts högfärg visas naturligt. Den konstlade "jag har inget"-
  varningen (suit-lös bottenhand, 0–3, ingen fit) **flyttar till 2NT**. Hela
  svarsstrukturen efter `2♣–2♦–2M` blir därmed naturlig och tvetydigheten
  (andra negativa vs naturlig klöver) försvinner. Ersätter §4.4:s "3♣ = alltid
  andra negativa". Rör §4.4 + motorns 2♣-svarsgren.

- **Beslut 7 — fynd 7 (`2♣–3♦–3M–4♦`, samma bud två betydelser), 2026-09-05.**
  Ägarbeslut: **4♦ är naturligt i båda fallen** (3♥ och 3♠) — rebud av egen
  färg, 6+ ruter eller bra 5 utan 3-stöd i öppnarens högfärg, utgångskravet
  står. Stöd visas i stället: **3-stöd + slamintresse → kontrollbud i NY färg**
  (4♣ över 3♥/3♠, 4♥ över 3♠) som sätter öppnarens högfärg; **3-stöd + minimum
  → 4M direkt** (fast arrival, samma logik som beslut 3). Ersätter motorns
  cue-läsning i 3♠-fallet (frö 20271411: Syd bjuder 4♠ direkt i stället för
  cue 4♦, samma slutkontrakt; frö 20271084 oförändrat naturligt). Rör §4.4 (en
  mening om 3♠-fallet + stödreglerna) + betydelselagrets `impliedCueTrump`
  (undantaget "även i egen visad färg" tas bort) + facit-köns fynd 7-post.
  **BYGGT & LIVE 2026-09-06 (mergepunkt `820ab71`, Actions grön, rebidz.com aliasad; loggen nedan).** Claudes tolkningar utöver
  beslutstexten, för ägaren att bekräfta: (1) "bra 5" = två av A/K/Q, eller
  5 med singel/renons; **5-3-3-2 bjuder sang** även med bra färg (frö
  20271242); (2) **ingen 5M-inbjudan** efter öppnarens egen högfärg — utan
  kontrollbud i ny färg bjuds 4M (33+ → 4NT); (3) svararen utan stöd och
  rebud bjuder **3NT direkt** (aldrig 2NT), och **öppnaren rättar till 4M med
  6+** (ny regel i raden tredje — utan den passade 2♣-öppnaren 3NT med sex
  spader, frö 20271242).

- **Beslut 8 — fynd 8 (öppnaren höjde partnerns kravfärg till 5M över svag
  tvåa), 2026-09-05.** Ägarbeslut: **bekräftar familj 3:s fix** — med stöd +
  maximum höjer öppnaren till utgången, aldrig förbi (frö 20271048: `2♠–3♥` →
  4♥, inte 5♥). Redan byggt, i §4.5:s ändringslogg och grönt i facit-kön.
  Inget mer att bygga.

- **Beslut 9 — fynd 9 (passad hands stödsvar över 1♥/1♠), 2026-09-05.**
  Ägarbeslut: **passad hand spelar Jacoby AV och Bergen AV; Drury tar alla
  limithöjningar.** Strukturen efter pass: **2♣/2♦ Drury** = limithöjning
  **10–12 stödpoäng** (3 resp. 4+ trumf — tröskeln på stödpoäng, inte hp, så
  handen med 4 trumf + kortfärg hamnar här och aldrig i Jacoby); **2M** = 6–9
  med 3+ stöd; **3M** = spärr, 4+ stöd under 6; **2NT** = naturlig inbjudan,
  ~11 hp balanserad utan 3-stöd (öppnaren 3NT med 14+, annars pass);
  **3♣/3♦** = naturliga, 6+ färg, ej krav. Exempel: frö 20271423 (`P–P–P–1♥–
  P–3♦ Bergen limit` → blir 2♦ Drury, samma 4♥), frö 20272394 (`3♣ Bergen
  konstruktiv` med 7 hp → blir 2♥ enkel höjning). Boken §6.7 och
  betydelselagret säger redan detta; motorn följer efter. Rör §6.7 (tabellen
  utökas) + `respondToMajorPassed` (inget fall får falla till Jacoby/Bergen) +
  öppnarens svar på passad hands 2NT i tabellen (raden återbud).

- **Beslut 11 — fynd 11 (svararens nya färg på 3-läget efter `1M–1NT–2x`),
  2026-09-05.** Ägarbeslut: **naturlig inbjudan med 6+ kort** — ny färg på
  3-läget efter semi-forcing 1NT och öppnarens 2-lägesåterbud (`1♠–1NT–2♠–3♥`,
  `1♠–1NT–2♣–3♦`, `1♥–1NT–2♦–3♣`) = **6+ kort, 10–11 hp, inbjudan, ej krav,
  förnekar 3-korts stöd i M**. Svagare 6+-händer bjuder färgen på 2-läget om
  det ryms (#59), annars preferens/pass. Öppnaren svarar: **pass** = minimum
  med tolerans (2+ kort); **3M** = rättelse, 6+ egen färg utan tolerans; **4 i
  svararens färg** = maximum (14–15) med 3-korts stöd eller bra dubbelton;
  **3NT** = maximum med håll runtom. Boten bjuder budet själv (idag 2NT/pass
  med 6-kortsfärgen). Budet förekom 0 gånger i 3000 botgivar (sonden i
  sessionen) — fyndet syns när en människa bjuder det. Rör §5.1 (svararens
  andra bud + öppnarens svarstabell) + `responderRebidAfterSemiForcing1NT` +
  raden tredje + betydelselagrets läsare (returnerar null idag).

- **Beslut 12 — fynd 12 (svararens hopp till 4m efter `1m–2m'–2NT`),
  2026-09-05.** Ägarbeslut: **hoppet 4m = trumf satt + slamdriv, förbi 3NT** —
  4+ stöd, driv mot slam (33+ mot visat minimum 12, kaptensregeln §5.2) och
  ingen sanghand (kortfärg någonstans). Öppnaren svarar som i cue-ronden
  (§6.2): billigaste kontrollbud (4♥/4♠), annars 5m utan kontroll att visa;
  kaptenen (svararen) frågar 4NT när den vill. Boten fortsätter själv bjuda
  det billiga 3m (#58; mer rum för kontrollbud under utgång) — beslutet är en
  läsregel + öppnarens svar. Samma för `1♣–2♦–2NT–4♣`. Förkastat: 4m till spel
  (dagens kravvakt 5m, kastar slammen) och Minorwood (ny konvention, §7 —
  SENARE-kandidat). Rör §5.3 + `responderSecondAfter2over1` (läsaren) +
  raden tredje (cue-ronden i stället för kravvaktens 5m).

- **Beslut 13 — fynd 13 (fjärde färg i 2/1-form, `1♠–2♣–2♦–2♥`),
  2026-09-05.** Ägarbeslut: **fjärde färg finns inte när 2/1 är satt** —
  utgångskravet räcker en gång; svararens nya färg efter 2/1 är **naturlig
  (4+ kort)**, man ska kunna bjuda sina färger utan att stoppas av en
  konvention. Ägarens ord: "det räcker med game force en gång". (Claude
  rekommenderade konstgjord fjärde färg som hållfråga; ägaren valde bokens
  §6.6-linje.) Konsekvens: svararen utan håll i fjärde färgen och utan
  naturligt bud bjuder preferens/egen färg, och öppnaren — som vet att kravet
  står — bjuder sang med håll. Gäller alla 2/1-former (`1♥–2♣–2♦–2♠`,
  `1♠–2♥–3♣–3♦`, `1♥–2♦–3♣–3♠`). Rör betydelselagrets `isFourthSuit`
  (undanta 2/1, som boken) + `responderRebidIn2over1Auction` steg 3b (spärren
  "fjärde färg har konventionell mening" bort: 4+ i färgen → naturligt bud) +
  öppnarens svar på svararens naturliga tredje färg i raden tredje (höjning
  med 4, annars beskrivning: sang med håll / egen längd / preferens).
  **BYGGT & LIVE 2026-09-07 (mergepunkt `158e23f`, Actions grön, rebidz.com aliasad; loggen nedan).** Två preciseringar i
  bygget: (1) svararens 4-korts högfärg som FJÄRDE färg visas bara utan håll
  i den — med håll går 3NT före, eftersom öppnaren med två visade färger
  redan nekat en 4-korts högfärg (felrapportens facit ♠3 ♥QJ72 ♦AKQJ9 ♣T76 →
  3NT står); (2) öppnarens svar och svararens placering byggdes samtidigt
  (raden tredje + svar3) — utan placeringen passade det gamla lagret
  öppnarens 2NT mitt i utgångskravet (facit "hela auktionen").

- **Beslut 14 — fynd 14 (naket 4NT utan satt trumf), 2026-09-05.** Ägarbeslut:
  **naket 4NT = essfråga i den senast naturligt bjudna färgen** ("last bid
  suit"); ägarens ord på det öppna fallet: `1♦–1♠–2♥–4NT` (reverse) = **essfråga
  i hjärter**. Samma regel ger `2♣–2♠–3♥–4NT` = hjärter (redan byggt, familj 6)
  och `1♠–2♣–2♦–4NT` = ruter. Över partnerns sangbud (1NT/2NT-återbud,
  sangöppning) är 4NT kvantitativt (beslut 1, §5.7). Boten själv sätter alltid
  trumfen först (billig höjning efter reverse = beslut 3, kontrollbud i ny färg
  = beslut 7), så tvetydigheten uppstår bara efter en människas bud (frö
  20272351: Nord bjuder 3♥ i stället för naket 4NT). Rör §6.1 (en mening om
  trumfen när inget är satt) + `slamTrumpFromAuction` (reverse/hoppskift-grenen
  returnerar senast bjudna färg för 4NT; öppnaren tiger inte längre) +
  facit-köns fynd 14-post (blir `it`).
  **BYGGT & LIVE 2026-09-06 (mergepunkt `4be2ba3`, Actions grön, rebidz.com aliasad; loggen nedan).** Två följder utöver
  beslutstexten: (1) kaptenen med fit bara i öppnarens FÖRSTA färg efter
  reverse/hoppskift frågar inte längre naket 4NT (det läses i den andra) —
  hon visar slamintresset med inbjudningsbudet 5M/4m, som namnger trumfen,
  även i drivzonen (`SlamContext.inviteOnly`); (2) §4.4:s gamla "utan trumf:
  RKC med egen självbärande färg" är borta — den solida egna färgen rebjuds
  naturligt (beslut 7) och slammen söks i fortsättningen, som i 2♣-linjen
  ligger i det gamla lagret (känt hål, loggen).

- **Beslut 16 — fynd 16 (5m efter partnerns 4m, slaminbjudan i lågfärgsfit),
  2026-09-05.** Ägarbeslut: **bekräftar linjen — 5m efter partnerns 4m är
  utgången, till spel; inbjudan i lågfärgsfit ÄR kontrollbudet.** Med trumf
  satt i utgångskrav är cue under utgång gratis (§6.2): 4♦/4♥/4♠ över 4♣,
  4♥/4♠ över 4♦; kaptenen med 31–32 visar billigaste kontroll, partnern cue:ar
  tillbaka med extra (→ 4NT) eller bjuder 5m med minimum; 33+ frågar 4NT
  direkt. Handen utan billig kontroll bjuder 5m — systemriktig miss. Inget
  bud ändras. Förkastat: 4NT som inbjudan (kolliderar med essfrågan) och
  Minorwood/kickback (ny konvention, §7 — SENARE-kandidat med beslut 12).
  Rör §6.2 (en mening: cue-ronden är lågfärgens inbjudan förbi 4m) + ett
  facit-test på cue-ronden efter 4m.

**SVEPET KLART 2026-09-05: alla 15 fynd har ägarbeslut (1–9, 11–14, 16; nr 10
och 15 ingår i 1 resp. finns inte).** Nästa steg: bygg besluten test-drivet
(facit FÖRE fix, systembok-§, regeln i det nya lagret), en per commit, sedan
PCD. Byggordning (beroenden först): 1 (§5.7/§6.4 Gerber/NMF — LIVE
2026-09-05, `3491ece`) → 3 (fast
arrival efter reverse — LIVE 2026-09-06, `1a6adf0`) → 7 (4♦ naturligt, cue i ny färg) → 14 (naket 4NT) →
2 (fjärde färg efter reverse) → 13 (fjärde färg bort efter 2/1) → 4 (rena
steg i splinterreläet) → 5 (passad hand i minor — LIVE 2026-09-07,
`ca954b4`) → 9 (passad hand över 1M — LIVE 2026-09-07, `47a5c8f`) →
6 (naturliga 3♣/3♦ efter 2♣–2♦–2M, 2NT = andra negativa — LIVE 2026-09-07,
`f4cbe74`) → 11 (ny färg på
3-läget efter 1M–1NT–2x — LIVE 2026-09-08, `b06c673`) → 12 (hopp till 4m =
driv — LIVE 2026-09-08, `3cd2cfa`) → 16 (bara bok + facit — LIVE 2026-09-08,
`226882b`) →
8 (redan byggt, bara låst).

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

- **2026-09-11 — Etapp 5 SLUTKÄRNAN (session A) KLAR: de två sista catch-allerna
  → tabellrader, gatade med faktumet `partnerSignedOff` (ägaren godkände familjen
  "kör 1").** `offBookResponse`/`honorForce` (det gamla lagrets sista två
  detektorer) blev raderna *partner-färg* (`f.partnerLastSuit && !f.partnerSignedOff`
  → `partnerSuitResponse`, exporterad ur `balancing-continuations.ts`) och
  *krav-minimibud* (`f.force && !f.partnerSignedOff` → `forcedMinimumBid`, flyttad
  ordagrant till `catch-all-continuations.ts`), **sist** i tabellen (positionsraderna
  äger sina bud). Manusets djup-proxy `built.open` ersatt av **`partnerSignedOff(f)`**
  (nytt faktum i `auction-facts.ts`): partnerns senaste bud betyder ett avslut
  (kravnivå `avslut`) ELLER är ett obestritt utgångsbud ELLER partnern passade vårt
  stående kontrakt → catch-allen får inte återöppna. `CONTESTED_DETECTORS` TOM;
  kedjevakten (detector-chain-testet) raderad. **A2 (betydelserättelse, budneutral):**
  nya regeln `avböjer inbjudan: rättelse` = avslut för `1NT–2♥–2♠–2NT–3♠` (rebids.ts
  1135) och `1M–1NT–2M–2NT–3M` (1064) + transfer-läsaren i `auction-meaning.ts`, så
  öppnarens avböjande läses som avslut (förr `preferens`/`rebid: egen färg` = ej-krav).
  **Faktalagerhål som de nya raderna avslöjade:** `partnerSignedOff` såg inte
  partnerns AVSLUTANDE pass (partnern passade vårt stående kontrakt) → catch-allen
  återöppnade; lagat med steg 0 (inte en gate). **Reverse-quirken som INTE lagades:**
  `auctionForce`s ostörda reverse-koll läser `1x–1M–2M` (öppnarens höjning av
  svararens färg) som en reverse → falskt rondkrav; en fix (undantaget som
  `competitionForce` har, felrapport #55) PROVADES men REVERTERADES: felrapport
  #42:s ostörda slam-auktion (`1C–1H–1S–2D–2H–3D–3NT–6NT`) förlitar sig på just det
  kravet för att driva kaptenens 21-poängshand förbi 2♥ — utan det passar Nord 2♥.
  Quirken ger rimliga bud (invit-höjningar) och blir en känd rest tills kaptenens
  stora hand får en egen fortsättningsregel (SENARE); i konkurrens faller
  `1x–(X)–1M–2M` till catch-allen (facit-kö). **Mätningar** (baslinjer `*-slutkarna-baslinje.json` på `aa103f0`, kommandon
  i mätprotokollet §4b/§3): auktionsdiff bot **29 ändrade bud** (25 → pass = catch-allen
  slutar köra över avslut · 4 krav-minimibud = kravhedrande minimum) + 288 källbyten;
  avvikelsediff **61 ändrade bud** (44 → pass · 17 krav-minimibud) + 1645 källbyten;
  **0 olagliga tabellbud**; betydelsesvep ostört **0/0/0**; kikvakt grön; A2 budneutral
  (0 ändrade bud); revisorn 1000 **20,7 % / 270,57** (baslinje 20,7 % / 270,43 — inte
  sämre); `npx tsc` rent; hela sviten grön (`npx vitest run`) utom CLAUDE.md-storleken
  lokalt (CRLF-artefakt, `git show :CLAUDE.md | wc -c` = 16357 < 16384, grön på CI).
  **Klass a+b** (ägaren godkände): själva bytet — catch-allen respekterar partnerns
  avslut, och den tvivelaktiga naturliga sangen i dubblade auktioner (gamla
  `offBookResponse`) ersätts av balancing-kunskapens strikta pass. **Kända rester
  (facit-kö `motorbyte-facit.test.ts` "etapp 5 slutkärnan – kända rester", it.todo):**
  A = kontrerad NMF (`1D–(X)–1S–1NT–2C` ger grovt 2♦ i stället för NMF-svaret 2♠;
  SENARE: kontrerad checkback) · B = `1NT–(X DONT)–2♠(flykt)` höjs 3♠ i stället för
  pass (frö 20270254/20270765; smalt force-/betydelsehål). Alla tre är smala fall i
  KONKURRENS, inte sämre än det gamla off-book-lagret, lagas i betydelse-/force-lagret
  eller som SENARE — aldrig med en gate. **Nästa gång:** etapp 5 session B — riv
  manuset (`buildAuction`-linjen, `open`, `divergedFromLine`); 0-diff per konstruktion.
- **2026-09-11 — Slutkärnans design vald + planen införd (§4b).** Efter det
  reverterade försöket (posten nedan) planerades slutförandet i detalj: rotorsaken
  är att grinden `built.open` är en **djup-proxy**, och kärnfallet
  `1NT–2♥–2♠–2NT–3♠ → 4♠` är ett **betydelsehål** (avböjandet bär `preferens`/
  `ej-krav`, borde vara `avslut`). Designen ersätter proxyn med faktumet
  **`partnerSignedOff(f)`** (ur betydelselagret: kravnivå `avslut` eller obestritt
  utgångsbud) och lägger de två sista catch-allerna (`offBookResponse`/`honorForce`)
  som ogatade tabellrader SIST (*partner-färg* / *krav-minimibud*). Järnregel:
  **inga gates i tabellen** — kräver ett c-mönster en gate stannar Claude och frågar
  ägaren (det är signalen att betydelselagret saknar något). Sessionsordning:
  A (rader + villkor, mätt) → B (riv manuset, 0-diff per konstruktion) →
  C (docs/minne) → etapp 6 (live). Hela planen: §4b ovan. Ingen kod ändrad; HEAD
  `aa103f0`.
- **2026-09-10 — Etapp 5 slutkärnan (offBookResponse + honorForce): FÖRSÖKT &
  REVERTERAD.** Försök att flytta de två sista catch-all-detektorerna till tabellrader
  (*off-book-svar* = `partnerSuitResponse`, *krav-minimibud* = `forcedMinimumBid`),
  tömma detektorlistorna och riva manus-grinden. **Blockeraren (mätt, inte gissad):**
  `offBookResponse`/`honorForce` fyrar idag bara när `built.open || offBook` ("linjen
  styr inte längre"). Som tabellrader (frågas FÖRST) fyrar de i AVGJORDA auktioner och
  återöppnar dem — tre klass-c-mönster bot mot bot (höjer partnerns preferens/
  inbjudningssvar som redan avböjts, t.ex. `1NT–2♥–2♠–2NT–3S` → 4♠ i stället för pass).
  Gate-heuristiker träffar fel: `ourContractBids.length ≤ 4` tappar legitima djupa
  ostörda fyrningar; `f.force` för brett. Full flytt gav **31 bot + 109 avvik ändrade
  bud** — reverterad hellre än gate-hackad på den oåterkalleliga kärnan. **Nästa gång:**
  designa FÖRST ett troget faktabaserat "auktionen lever / är inte avgjord"-villkor
  (motsvarande `built.open`: ostört ≈ linjen tog slut tidigt eller fjärde färg/NMF), mät
  mot det. Alternativ mellansteg: behåll ett tunt post-tabell-fallback i `decideCallTraced`
  med exakt `built.open`-gaten och riv bara LiveDetector-wrappern (0-diff, men river inte
  manus). HEAD kvar 9d45c31 (familj 2); ingen kod ändrad.
- **2026-09-10 — Etapp 5 familj 2: de fyra små catch-all-detektorerna → tabellen
  (0 ändrade bud bot mot bot, en klass-b-förbättring i avvik).** Ny kunskapsmodul
  `catch-all-continuations.ts` (funktioner av EN hand + fakta) och fyra tabellrader
  före *slam-forts*: *transfer-utgång* (`answerTransferGameChoice`, felrapport #13
  — gatad till **1NT-öppningen**, eftersom 2NT-transferns utgångsval redan ägs av
  raden *tredje* i systems-on-2NT; utan gaten stal raden 2NT-passet från *tredje*
  och sänkte `auction-decide.test.ts`),
  *straff-x* (`maybePenaltyDouble`, ägarbeslut 2026-07-04), *fjärde-färg-placering*
  (`placeGameAfterFourthSuit`, frö 20260743) och *2/1-utgång* (`answerTwoOverOneRaise`,
  felrapport #27). De fyra detektorerna + hjälparna (`transferGameChoiceToAnswer`,
  `twoOverOneRaiseToAnswer`) rivna ur `auction-live.ts`; **FORCED_DETECTORS nu TOM**;
  CONTESTED kvar = bara `offBookResponse` + `honorForce`. **Mätt** (baslinjer
  `*-f2-baslinje.json`, kommandon §3): auktionsdiff **0 ändrade bud** / 23 källbyten
  (6 straff-x + 17 pass som blev *manus* när de nya raderna gjorde linjen aningen
  längre); avvikelsediff **1 ändrat bud** + 153 källbyten. Det enda ändrade budet
  (frö 20270031/direkt/1NT, klass b, ägaren godkände): människan öppnar en 10-hp-1NT
  som ingen bot öppnar → `buildAuction` gav 'ingen öppning' och kortslöt före den
  gamla detektorkedjan, så svararen passade 3NT-erbjudandet trots 3-korts stöd; som
  tabellrad (frågas FÖRST) väljer stolen nu 4♠ (systemriktigt, 5-3-fiten). Facit
  `etapp 5 familj 2` i `motorbyte-facit.test.ts`. Kvar till slutkärnan:
  `offBookResponse` + `honorForce` + manus-grinden (`open`/`divergedFromLine`).
- **2026-09-10 — Etapp 5 påbörjad, rivning familj 1: sju döda detektorer bort
  (ren radering, 0 ändrade bud).** Frekvensmätningen av det gamla lagret (bot mot
  bot `auktionsdump-frekvens.txt` + människo-öppnad `avvikelsedump`) delade de 13
  kvarvarande detektorerna i LEVANDE (fyrar bud) och DÖDA (tabellen täcker redan).
  Sju fyrade aldrig i någondera dumpen och revs ur `auction-live.ts`:
  `fourthSuitToAnswer`, `nmfToAnswer`, `nmfPlacementToAnswer`,
  `openerRebidAfterPartnersTwoOverOne`, `respondToStrong2NTRebid`,
  `answerPartnerNTOpening`, `openerAnswersNTResponse` — plus hjälparna `answered`
  och `cleanNTOpening` och deras nu föräldralösa imports (`openerAnswer*`/
  `respondTo1NT`/`respondTo2NT`/`responderPlaceAfterNMF`/`ntResponseRule`).
  Deras lägen (fjärde färg / NMF-svar+placering / off-book 2/1-återbud /
  2♣–2♦–2NT / off-book-sangsystemet) besvaras sedan etapp 3–4 av beslutstabellen
  (raderna *återbud*/*tredje*/*svar2*/*svar*). **Bevis:** `tsc` grön;
  auktionsdiffen 0/0 över 3000 bot-mot-bot-givar och avvikelsediffen 0/0 över
  13959 människo-öppnade scenarier (baslinjer `*-etapp5-baslinje.json`, kommando
  i §3). Kvar i det gamla lagret (levande, migreras familj för familj):
  `offBookResponse`, `honorForce`, `answerTransferGameChoice`, `maybePenaltyDouble`,
  `placeGameAfterFourthSuit`, `answerTwoOverOneRaise`. **Fältfynd loggat samma dag**
  (ägaren spelade på etapp 4-motorn): svararen rymmer inte till femkorts högfärg
  (naturligt 3M) över ett starkt 2NT-återbud i KONKURRENS — facit-kö
  (`motorbyte-facit.test.ts`, `it.todo`) + `docs/bevaka.md`, ägarbeslut B: byggs
  som konkurrensfortsättning EFTER etapp 5.
- **2026-09-10 — Etapp 4 familj 9 KLAR (sista etapp 4-familjen): betydelsesvepet
  på störda auktioner till noll (ägarbeslut om "noll" 2026-09-10, AskUserQuestion:
  "noll på det avgörbara + lista resten").** Till skillnad från familj 1–8 flyttade
  den här INGA detektorer och ändrade INGA bud — den täppte hålen i
  BETYDELSELAGRET (`auction-meaning.ts` + registret `rules.ts`) så att den härledda
  betydelsen (regeln bortskalad, som ett människobud) stämmer med registret även i
  konkurrens. **Bygget:** den härledda läsaren räknar nu kravnivå/alert i konkurrens
  ur ROLLEN (öppnare/svarare/inklivare/advancer/dubblare), aldrig ur handen
  (kikvakten): fritt bud vs inkliv/advance/öppnarens återbud (ny färg), hoppinkliv
  (spärr, ej krav), konkurrenshöjning (även hopphöjning, preemptiv), rebjuden färg
  per roll, cue-bud roll-uppdelat (advancerns limithöjning-cue vs öppnarens/
  dubblarens utgångskrav-cue), dubblingsfamiljen (negativ/upplysning/stöd/
  återöppning/straff/maximal med registernamn), Jordan/ovanlig 2NT/Lebensohl 2NT/
  2NT-inkliv (`interpretCompetitive2NT`), DONT över deras 1NT + fortsättningarna
  (`interpretNTDefenseSuit`), upplysningsdubbling av spärr (nivå ≤3), spärrhöjning
  = avslut, dubblarens starka återbud/inbjudande höjning, svar på negativ dubbling.
  Registret fick kravnivå för **37 störda regler** och gjordes KONSEKVENT på cue:
  alla cue-BUD alertas (`cue-bid`/`cue (`/`öppnarens cue`/`negativ-dubblarens cue`/
  `stöd-cue`/`fritt bud: cue`), medan deras naturliga fortsättningar/avslut
  (`cue-höjningens fortsättning`, `cue: avslut`) INTE alertas längre (de alertades
  förr av misstag via det breda `cue`-prefixet). **Golvet (ägarbeslut):** ~halva
  resten är KORTBEROENDE — samma störda auktion kan bära inbjudan/ej krav/stark
  beroende på handen, vilket en nakenauktions-läsare aldrig kan avgöra (ärlig
  inferens). De ligger som dokumenterade `STÖRDA_UNDANTAG` i probet (50 mönster,
  183 bud, skälkoder K/C/D/L/M), räknade UTANFÖR grinden precis som ostördas kända
  motoravvikelser; probet har nu en `expect(grind).toBe(0)`-assertion + vakt mot
  döda undantagsrader. **Mätningar** (kommandon i §3; baslinjer på `df930d9`):
  betydelsesvepet störda grind **kravnivå 2557→0 · alert 991→0 · registerhål
  515→0** (`$env:BETYDELSE='1'; npx vitest run …auction-meaning.probe.test.ts`);
  ostörda grinden orörd 0/0/0; auktionsdiffen 3000 givar **ÄNDRAT BUD 0** (helt
  budneutralt → revisorn oförändrad per konstruktion); `npx tsc` rent; hela sviten
  grön (`npx vitest run`, 2436) inkl. nytt facit-block "etapp 4 familj 9" (8 fall,
  i grinden); förklaringssvep + regelsvep gröna. **Nästa gång börjar vi med:**
  etapp 5 — rivningen och den avslutande städningen (catch-all-vakterna
  `offBookResponse`/`honorForce`/`answerTransferGameChoice`/`maybePenaltyDouble`,
  `FORCED_/CONTESTED_DETECTORS`, `divergedFromLine`, `open`-flaggan) + docs/minne.
  🚪 Grinden (familj 9): ingen b-lista (0 ändrade bud) — ägaren godkänner resultatet
  + PCD.
- **2026-09-10 — Etapp 4 familj 8 KLAR & LIVE: slam-svarssvepet i tabellen
  (grinden godkänd av ägaren 2026-09-10 "Pcd"; mergepunkt `df930d9`).**
  Familjens namn var "konkurrens-slam", men steg 1 (kontroll-komplett 4NT)
  flyttades redan i familj 1 (raden *konkurrens-slam*, `competitive-slam.ts`, 0
  träffar på 3000 bot-givar — sällsynt) och steg 2 (cue-frontend för de
  kontroll-ofullständiga händerna) är PARKERAT (ny konvention, §7/`senare.md`).
  Ägaren valde därför **slam-svarssvepet** (2026-09-10, AskUserQuestion): flytta
  de sex kvarvarande slam-detektorerna ur `auction-live.ts`. De fyrade bara när
  linjen tog slut (människan/inklivet förde budet förbi manuset — därför 0 i
  bot-dumpen; `rkcToAnswer` 196 i avvikelsedumpen). **Bygget:** ny modul
  `slam-answer-continuations.ts` — funktioner av EN hand + fakta: `answerRKC`
  (1430 RKC, trumf ur `slamAskTrump` som flyttade med — #9 överenskommen, #10
  spärrfärgen, R1-fynd #3 Jacoby), `answerKingAsk` (Sjöberg 5NT), `rkcCorrection`
  (#60 rättelsen över stoppet), `raise3NTToSlam` (#42 kaptenens 3NT→6NT),
  `openerTry3NTStop`/`answer3NTStopTry` (etapp 7 hål 2). Raden *slam-forts*
  (`slamAnswerContinuation` i detektorkedjans ordning: 3NT-stoppens svar före
  RKC-svaret). **c-fix under diffvarven:** raden hamnade först före
  positionsraderna och stal ett direkt 4NT över 2♣ (8 avvik-givar → RKC-i-klöver
  i stället för öppnarens naturliga rebud, `slamAskTrump` läser artificiella 2♣
  som färg) → flyttad SIST i tabellen (samma sista-utväg-företräde detektorerna
  hade; en positionsrad som äger budet behåller det). Sex detektorer + nio
  hjälpfunktioner/konstanter rivna ur `auction-live.ts`. **Ingen b-lista:** ren
  klass a — varje bud identiskt, bara källan bytte. **Mätningar** (kommandon i
  §3; baslinjer på `47c6e6f`): hela sviten grön (`npm test`, 2427), `npx tsc`
  rent; auktionsdiffen 3000 givar: ÄNDRAT BUD 0, samma bud/annan källa 2 (slam-
  detektorer → `tabell:slam-forts`); avvikelsedumpen 13959 givar: ÄNDRAT BUD 0,
  samma bud/annan källa 196 (alla `detektor:rkcToAnswer` → `tabell:slam-forts`);
  olagliga tabellbud 0 i båda. Frekvens: `tabell:slam-forts` 4 (bot) / 196
  (avvik). Pliktsvep oförändrad (0 auktionsfel; K1 13, K2 4, K3 6, K4 1);
  förklaringssvep grönt (0 oförklarade, 0 gissningar); regelsvep grönt (306
  regler, 0 auktioner utan slut); betydelsesvepets ostörda grind 0/0/0; kikvakten
  skarp grön (ny deterministisk *slam-forts*-assertion på frö 20261020). Revisorn
  1000 givar: 20,7 % · 270,43 (identisk med baslinjen — bot mot bot ändrades
  inte). **Nästa gång börjar vi med:** familj 9 (betydelsesvepet på störda
  auktioner till noll) — den sista etapp 4-familjen; catch-all-vakterna
  (`offBookResponse`/`honorForce`/`answerTransferGameChoice`/`maybePenaltyDouble`)
  rivs i den avslutande städningen inför etapp 5.
- **2026-09-09 — Etapp 4 familj 7 KLAR & LIVE: försvar mot svaga tvåor och
  spärrar i tabellen (grinden godkänd av ägaren 2026-09-09 "Godkänt — kör PCD";
  mergepunkt `47c6e6f`, deployen grön och aliasad).** Test-drivet:
  familj 7-blocket i `motorbyte-facit.test.ts` (direkt X/2NT-balansering,
  spärrhöjningens X, tvåfärgs-cue-svaret, XX på störning av vår svaga tvåa).
  **Bygget:** ny modul `preempt-defense-continuations.ts` — funktioner av EN
  hand + fakta. Två delar: **(1) vårt försvar mot deras svaga tvåa/spärr** (raden
  *försvar-svag2*, `defendTheirPreempt`): direkt sits, balansering ("låna en
  kung") OCH efter deras spärrhöjning (2♠–P–3♠) — kunskapen oförändrad
  (`conventionalDefense`/`defendPreempt`); manusets två §7.6-ronder bytta mot
  `ask`→tabell, väckningsdetektorn `defendRaisedPreempt` + dess inbakade
  specialfall rivna (tabellen frågas FÖRST). **(2) preempt-konkurrensens
  fortsättningar** (raden *svag2-fortsättning*, `respondInPreemptCompetition`):
  advancern svarar partnerns tvåfärgs-cue (`answerWeakTwoCue`, krav) och svararen
  svarar på störning av VÅR svaga tvåa/spärr (`answerPreemptInterference`, XX/
  fortsatt spärr) — två detektorer flyttade; kunskapshandlaren
  (`answerPreemptInterference`) bor kvar i `contested-openings.ts`. Tre
  detektorer + fyra hjälpfunktioner rivna ur `auction-live.ts`. **b-listan
  (klass b):** boten försvarar nu deras svaga tvåa/spärr vid bordet (via
  `decideCall`) i människo-öppnade sekvenser där den förr PASSADE (sålde given) —
  manusets §7.6-rond fanns bara i den ostörda bot-linjen. **Mätningar** (kommandon
  i §3; baslinjer på `d07cdd8`): hela sviten grön (`npm test`, 2422), `npx tsc`
  rent; auktionsdiffen 3000 givar: ÄNDRAT BUD 0, samma bud/annan källa 186 (alla
  manus/väckning/detektor → `tabell:försvar-svag2`); avvikelsedumpen: ÄNDRAT BUD
  2331 (alla pass → försvar, klass b); olagliga tabellbud 0 i båda. Frekvens
  (3000): `tabell:försvar-svag2` 186 (ur manus/väckning) · `tabell:svag2-fortsättning`
  215 (ur `ownPreemptInterferenceToAnswer` 210 + `answerWeakTwoCue` 5). Pliktsvep
  oförändrad (K1 13, 0 auktionsfel); förklaringssvep grönt (0 oförklarade, 0
  gissningar); regelsvep grönt (306 regler, 0 auktioner utan slut); betydelse-
  svepets ostörda grind 0/0/0; kikvakten skarp grön (*försvar-svag2*/
  *svag2-fortsättning* vaktade). Revisorn 1000 givar: 20,7 % · 270,43 (oförändrad
  — bot mot bot ändrades inte). **Nästa gång börjar vi med:** familj 8 (konkurrens-
  slam) med nya baslinjer (§3) på `47c6e6f`.
- **2026-09-09 — Etapp 4 familj 6 KLAR & LIVE: försvar mot 1NT i tabellen
  (grinden godkänd av ägaren 2026-09-09 "kör klart hela familj 6 nu ... grind +
  PCD"; mergepunkt `d07cdd8`, deployen grön och aliasad).** Test-drivet:
  familj 6-blocket i `motorbyte-facit.test.ts` (DONT-2färg/naturligt/DONT-X,
  advancerns 2♣-relä, Lebensohl 2NT, värde-X 2NT). **Bygget:** ny modul
  `nt-defense-continuations.ts` — funktioner av EN hand + fakta. Tre delar:
  **(1) försvar mot deras 1NT** (raden *försvar-1nt*, `defendTheirNT`): naturligt
  inkliv före DONT i direkt sits (golv 8), DONT i balansering (golv 6) — manusets
  1NT-försvarsrond bytt mot `ask`→tabell i `auction.ts`. **(2) advancern +
  rättelsen** (raden *dont-advance*: `advancePartnerDONT`/`correctOwnDONTX`/
  `correctOwnDONTTwoSuiter`) — tre detektorer flyttade. **(3) störning över vårt
  1NT** (raden *vårt-1nt-stört*, `respondToOurNTInterference`): Lebensohl-stegen,
  värde-X-flödet (öppnaren beskriver, dubblaren placerar), ntInterference och
  flykt-straffet — åtta detektorer flyttade; kunskapshandlarna (answerNTInterference,
  lebensohlAfter1NT/Rebid) bor kvar i sina moduler. Elva detektorer + manusronden
  rivna (`auction-live.ts` ~370 rader kortare). **b-listan (klass b):** boten
  försvarar nu deras 1NT vid bordet (via `decideCall`) i människo-öppnade
  sekvenser där den förr PASSADE — manusets försvarsrond fanns bara i den ostörda
  bot-linjen. **Mätningar** (kommandon i §3; baslinjer på `78735c2`/`ff006d7`):
  hela sviten grön (`npm test`), `npx tsc` rent; auktionsdiffen 3000 givar: ÄNDRAT
  BUD 0, samma bud/annan källa 111; avvikelsedumpen: ÄNDRAT BUD 250 (alla
  pass → försvar-1nt, klass b), samma bud/annan källa 10; olagliga tabellbud 0 i
  båda. Frekvens (3000): `tabell:försvar-1nt` 111 (ur manus) · `tabell:dont-advance`
  54 (ur detektorer) · `tabell:vårt-1nt-stört` 160 (ur detektorer). Pliktsvep
  oförändrad (K1 13, K2 4, K3 6, K4 1, K5 9, K6 29, 0 auktionsfel); förklaringssvep
  grönt (0 oförklarade, 0 gissningar); regelsvep grönt (306 regler, 0 auktioner
  utan slut); betydelsesvepets ostörda grind 0/0/0; kikvakten skarp grön
  (*försvar-1nt*/*vårt-1nt-stört* vaktade). Revisorn 1000 givar: 20,7 % · 270,43
  (oförändrad — bot mot bot ändrades inte). **Nästa gång börjar vi med:** familj 7
  (försvar mot svaga tvåor och spärrar, deras höjningar) med nya baslinjer (§3).
- **2026-09-09 — Etapp 4 familj 5 KLAR & LIVE: balansering & återöppning i
  tabellen (grinden godkänd av ägaren 2026-09-09, "pcd"; mergepunkt `78735c2`,
  deployen grön och aliasad).** Test-drivet: familj 5-blocket i
  `motorbyte-facit.test.ts` (advancer 20270013/20270007, öppnaren 20270024,
  K1-resten 20271643/20272221). **Bygget:** ny modul `balancing-continuations.ts`
  — funktioner av EN hand + fakta (kikvakten skarp grön, ny *advance2*-assertion).
  Kärnan `partnerSuitResponse` är `offBookResponse`:s kropp (raiseWithFit ??
  respondWithoutFit), avgränsad per läge; sang-grenen i den porterade
  respondWithoutFit begränsad till en HELT ostörd auktion (en ren dubbling
  räknades förr som ostört → 3NT). Raderna: *advance2* +
  `advancerActsInCompetition` (advancern efter deras X/höjning, konkurrensgräns:
  motståndarna aktiva EFTER partnerns inkliv — rena advancern kvar i gamla
  lagret), *öppnaren-stört* + `openerActsInCompetition`, *svararen-stört* +
  `responderActsInCompetition` (K1-resten `responderAnswersSecondDouble` prövas
  först: fit → graderad `raiseWithFit`, annars den utbrutna
  `answerReopeningDoubleCore`). Ur `contested-continuations.ts` bröts
  `answerReopeningDoubleCore` ut ur `responderAnswersReopeningDouble` (familj 4,
  oförändrad för sin första-tur-guard). Ett utestående artificiellt krav
  (fjärde färg / NMF) lämnas åt FORCED-detektorerna (`outstandingArtificialForce`
  läser regeln ur betydelselagret) — annars kapade tabellen
  `placeGameAfterFourthSuit` (frö 20270219 i avvikelsedumpen: 4♠ på dubbelton i
  en FSF-auktion). **b-listan (klass b — enbart K1-resten):** den negativa
  dubblaren svarar nu på öppnarens återöppningsdubbling i stället för att passa
  den (8 bot + 7 avvik ändrade bud). T.ex. frö 20272221 (`1♥–(3♣)–X–(4♣)–X–P`,
  Syd ♠KQT53 ♥742 ♦K42 ♣T8 → 4♠, Nord 18 hp, 8-korts spaderfit; förr pass →
  4♣X hos motståndarna); frö 20270064 (människan öppnar; Nord ♠AKJ6 ♥7 ♦96
  ♣KJ9642 → 4♣ och Syd 5♣, 11-korts klöverfit; förr pass → 2♦X). Situation a
  (advancern) + b (öppnaren) var rena flyttar (0 ändrade bud). **c-fix under
  diffvarven:** FSF/NMF-kapningen ovan (frö 20270219) och den dubiösa 3NT-efter-
  dubbling i respondWithoutFit-porten. **Köat fynd (2026-09-09):** svar-stört
  (`contestedResponse`, familj 3) prövar negativ dubbling FÖRE stödhöjningen, så
  med 3-korts stöd i partnerns HÖGFÄRG döljs fiten bakom X (frö 20272221:
  `1♥–(3♣)` gav X i stället för 3♥). Egen princip (openerMajorFit) finns men är
  bara kopplad till fritt-bud-grenen. **ÅTGÄRDAD & LIVE 2026-09-09** (ägaren:
  "Man får INTE bjuda negativ dubbel när man har stöd i partners öppnade
  högfärg"): dubblingen gatad bakom `openerMajorFit`, 3+ stöd → höjning/cue,
  stödet går före sidofärg; budsystem §7.4 + §9; 51 bot + 45 avvik ändrade bud
  (alla X → höjning/cue, klass b); revisorn 20,7 % · 270,43 (liten förbättring).
  **Mätningar** (kommandon i §3; baslinjer på `4fa2604`): hela sviten grön
  (`npm test`), `npx tsc` rent; auktionsdiffen 3000 givar: ÄNDRAT
  BUD 0, samma bud/annan källa 376; avvikelsedumpen: ÄNDRAT BUD 7 (K1-resten);
  botdiffen (ur auktionsdumpen efter K1-fixen): 8 ändrade bud; olagliga
  tabellbud 0 i båda. Frekvens (3000): `detektor:offBookResponse` 711 → 223 ·
  `tabell:advance2` 95 → 313 · `tabell:öppnaren-stört` 495 → 593 ·
  `tabell:svararen-stört` 223 → 406. Pliktsvep: K1 20 → 13 (resten = korrekta
  straffpass + redouble-/reverse-sekvenser utanför familj 5), K2 4, K3 6, K4 1,
  K5 9, K6 29; förklaringssvep grönt (0 oförklarade, 0 gissningar); regelsvep
  grönt (306 regler, 0 auktioner utan slut). Betydelsesvepet: ostörda grinden
  kravnivå 0 · alert 0 · registerhål 0 · kända motoravvikelser 0. Kikvakten
  skarp grön (advance2/öppnaren-stört/svararen-stört vaktade). Revisorn 1000
  givar: rätt kontrakt 20,4 % · snittförlust 270,85 (baslinje `4fa2604`: 20,4 %
  · 270,55, dvs. +0,30 per giv = brus; ingen regel tunad på poäng).
  **Nästa gång börjar vi med:** familj 6 (försvar mot 1NT) med nya baslinjer
  (§3) på `78735c2`.
- **2026-09-08 — Etapp 4 familj 4 KLAR & LIVE: öppnarens och svararens
  fortsättning när de stört, i tabellen (grinden godkänd av ägaren 2026-09-09,
  "Godkänt, kör PCD"; mergepunkt `4fa2604`, deployen grön och aliasad).** Test-drivet: facit-
  filen `auction-etapp4-familj4.test.ts` (raderna, det nya, det rivna) + frö
  20262632 ur facit-kön (`motorbyte-facit.test.ts`, 1♦–(1♠)–2♥–P–3♦–P →
  4♥). **Bygget:** `contested-continuations.ts` (lägesläsarna
  `openerContestedSeat`/`responderContestedSeat` = vår 1-i-färg-öppning +
  motståndarna har bjudit eller dubblat; `partnerCueRaiseToAnswer`,
  `openerMaximalToAnswer`, `partnerCueToAnswer` — och kunskapen som funktioner
  av EN hand + fakta: de tolv flyttade detektorerna + det nya) och
  `overcallOfResponse` i `overcalls.ts` (sandwich-inklivet). Raderna:
  *inkliv-över-svaret* (samma läge som *dubbling*; svarar alltid, så manuset
  lägger RHO:s inkliv ur RHO:s egen hand — familj 3:s rivna kik-rond ersatt),
  *öppnaren-stört* (kedjan i det gamla lagrets ordning: cue-höjningens svar,
  §5.4, §5.10, fritt bud → höjning / NYTT återbud utan stöd, 3M-invitens dom,
  §5.8, §5.9 A, §5.9 B, NYTT svar på partnerns cue; null → det gamla lagret som
  förut), *svararen-stört* (maximal-domen, NYTT svar på återöppningsdubblingen,
  2NT-domen, efter höjt fritt bud, cue-höjarens fortsättning, NYTT svar på
  öppnarens cue, NYTT negativ-dubblarens 13+-cue, NYTT fortsättningen efter
  fritt bud utan höjning). Rivet ur `auction-live.ts`: answerCueRaise,
  answerCueBidderRebid, openerCompetesAfterRaise, answerOpenerMaximal,
  openerStrongNTAfterMinorRaise, answerOpenerNTInvite, openerRaisesFreeBid,
  responderAfterFreeBidRaise, openerAnswersFreeBidInvite,
  openerRondTwoInCompetition, openerReopensAfterPartnerPass,
  openerReopensBalancing (filen 2533 → 1806 rader, `git diff --stat`).
  **c-fixar under diffvarven (lagade före merge):** (1) svararens dom på
  öppnarens 2NT-inbjudan försvann när motståndarna bara DUBBLAT (frö
  20270877) → lägena läser "bjudit eller dubblat"; (2) partnerns rebud i VÅR
  egen färg lästes som cue när de cue-bjudit den (20270117: 1♥–(2♣)–P–(2♥)–3♥
  gav 3NT på 1 hp; 20271921) → egen färg är aldrig cue; (3) 4♠ på 8 hp efter
  fritt bud (20270204: längdpoäng utan honnörer) → 4M kräver 10+ hp; (4)
  stresstestet: svararen passade öppnarens reverse efter sitt fria bud (giv
  1909) → reverse/hopp lämnas åt kravvakten; (5) straffpasset mot
  återöppningsdubblingen krävde bara 4 kort + 7 hp (20260800: ♣T642) → längd
  OCH honnörer i deras färg. **b-listan (bokens §5.5/§5.8/§5.9/§7.3/§7.4 — allt
  i §9):** (1) **sandwich-inklivet** bjuds ur RHO:s egen hand: 32 av 3000
  botgivar (t.ex. 20270139: (1♦)–P–(1♥) med ♠KQJ98763 ♥3 ♦A4 ♣A9 → 1♠;
  20271001: (1♣)–P–(1♠) med ♠A ♥QJ8762 ♦KQT94 ♣9 → 2♥); (2) **svaret på
  öppnarens återöppningsdubbling** (pliktsvepet K1 blottade 62 passade X när
  regeln fick kravnivå): 46 givar (20261000: 1♥–(2♦)–P–P–X–P med ♠T64 ♥94
  ♦6532 ♣K954 → 3♣, förr pass och 2♦X spelades); (3) **öppnarens återbud utan
  stöd efter fritt bud** i stället för catch-allens reverse/kravbud: 20270503
  (1♦–(1♠)–2♥–P med ♠Q84 ♥A4 ♦AK43 ♣T932 → 2NT, förr 3♣ "krav – ny färg"),
  20270869 (utan stopp → 3♦, förr 2NT), 20272627 (1♣–(1♥)–1♠–P → 2♣ med 14,
  förr reverse 2♦), 20271260/20270896 (6+ → 3♦); (4) **svararens fortsättning
  efter fritt bud**: 20270055 (1♦–(1♠)–2♥–P–3♦–P med ♠2 ♥AKQT74 ♦8 ♣QJ943 →
  4♥, förr pass), 20270204 (♠A96543 8 hp → 2♠ rebud, förr pass), 20271043
  (♠Q8732 ♥AKJ7 ♦53 ♣Q2 → pass, förr 5♦), 20272991 (♣Q76 mot 6+ klöver → 3♣
  inbjudan, förr 4♣), 20272932 (♠KQ742 ♥962 ♦AQ2 ♣K5 → cue 2♥, förr 3NT utan
  stopp); (5) **svaret på partnerns cue**: 20270221 (1♣–(1♠)–2♦–(2♠)–3♠–P med
  ♠KJ73 ♥K52 ♦QJ542 ♣J → 3NT, förr pass = 20270156-mönstret), 20271441
  (♦KQJT74 → 4♦, öppnaren 5♦); (6) **negativ-dubblarens cue**: 20270127
  (1♠–(2♣)–X–P–2♠–P med ♠9 ♥AK92 ♦QJT87 ♣AK8 → 3♣, öppnaren 4♠; förr pass i
  2♠ med 17 hp), 20271003 → 2♥. Kikvakten skarp grön (de tre nya raderna
  vaktas i `kikvakt.test.ts`). **Mätningar** (kommandon i §3; baslinjer på
  `2ae5d05`): hela sviten grön (`npm test`), `npx tsc` rent; auktionsdiffen
  3000 givar: ÄNDRAT BUD 111 (b-listan; per regel i
  `revisor-output/auktionsdiff-f4-klass.txt`), samma bud/annan källa 818;
  revisorintervallet (20260721–20261720): ÄNDRAT BUD 34, samma bud/annan
  källa 303; avvikelsedumpen: ÄNDRAT BUD 122, samma bud/annan källa 1537, 66
  nycklar bara i ena filen (nya sekvenser); olagliga tabellbud 0 i alla tre.
  Frekvensbilden (3000): `tabell:öppnaren-stört` 495 · `tabell:inkliv-över-
  svaret` 474 · `tabell:svararen-stört` 223; `manus` 3623 → 3110,
  `detektor:honorForce` 150 → 132, `detektor:offBookResponse` 706 → 711 (dess
  största poster är advancerns bud efter deras negativa X/höjning — familj
  1:s rest — och öppnaren efter deras X + partnerns höjning). Kikvaktens
  mätläge: 2941 bud, 28 byter (1,0 %, alla ur manus); de tre raderna 49/53/27
  bud, 0 byten. Betydelsesvepet: ostörda grinden kravnivå 0 · alert 0 ·
  registerhål 0 · kända motoravvikelser 0; störda (familj 9) kravnivå 2098 →
  2505 bud (fler störda auktioner nu när sandwich-inklivet finns) · alert
  1009 → 1019 · registerhål 942 → 547 (familjens regelnamn registrerade i
  `rules.ts`). Pliktsvep: K1 19 → 20 (varav 14 = svararen passar öppnarens
  återöppningsdubbling i lägen raden inte tar: negativ-dubblaren som möter
  öppnarens ANDRA X, passad hand — familj 5), K2 3 → 4, K3 5 → 6, K4 0 → 1
  (nya sekvenser ur sandwich-inklivet), K5 9, K6 29; förklaringssvep grönt (0
  oförklarade, 0 gissningar); regelsvep grönt (284 → 305 regler, 0 auktioner
  utan slut). Revisorn 1000 givar: rätt kontrakt 20,4 % · snittförlust 270,55
  (baslinje 2ae5d05: 20,3 % · 271,06, dvs. −0,51 per giv = brus); kategorier
  (antal/förlust): fel-farg-bet 126/53830 · missad-lillslam 77/50110 ·
  missad-utgang 138/46630 · missad-storslam 35/39950 · billig-offring
  114/31230 · battre-an-facit 111/17810 · sald-giv 58/17480 · for-hogt
  45/10670 · fel-strain 89/2030 · utpassad 3/810 (revisor-output/latest.json).
  34 av revisorns 1000 givar bytte slutkontrakt (ur revisorintervallets diff:
  t.ex. 20260771 2♣ → 4♠ via egen 6+ efter fritt bud, 20260800 2♣X → 2♠ via
  svaret på återöppningsdubblingen, 20260860 2♥ → 4♥ via negativ-dubblarens
  cue) — alla b-mönster; ingen regel tunad på poäng (ägarprincip 2026-08-06).
- **2026-09-08 — Etapp 4 familj 3 KLAR & LIVE: när de stör vår öppning (negativ
  dubbling, stöddubbling, Jordan, svararens konkurrenssvar) i tabellen
  (grinden godkänd av ägaren samma dag, "pcd"; mergepunkt `2ae5d05`).**
  Test-drivet: facit-blocket "etapp 4 familj 3" i `motorbyte-facit.test.ts`
  (frö 20270004 → X / 3NT / XX, 20270008 → X, 20270007 → 1♠, 20270269 → 2♥)
  + `auction-etapp4-familj3.test.ts` (raderna, lägesgränserna, det rivna).
  **Bygget:** `contested-opening.ts` (lägesläsarna `contestedResponseSeat`,
  `supportDoubleSeat`, `supportDoubleToAnswer`, `supportDoubleFollowUpToAnswer`,
  `negativeDoubleToAnswer`, `negativeDoublerSeat`, `jordanToAnswer`,
  `jordanSignoffToAnswer` + kunskapen som funktioner av EN hand + fakta:
  `contestedResponse` = manusets hela konkurrenssvar, flyttat) och
  `fit-raise.ts` (`raiseWithFit` + `fitLengthNeeded`/`partnerSimpleOvercalled`/
  `partnerJumpOvercalled`/`partnerBalanced` utbrutna ur det gamla lagret, som
  behåller en tunn detektorform — familj 4:s hem). Raderna: *svar-stört*
  (partnern öppnade 1 i färg, LHO störde, min första tur: negativ X, fritt
  bud, cue, konkurrenshöjning, NT med stopp, K3-tabellen mot 1NT/tvåfärg,
  Jordan/XX/höjning mot deras X — svarar alltid), *stöd-x* (exakt 3 stöd → X
  efter 1x–(P)–1M–(färginkliv); annars null → familj 4), *stöd-x-svar* /
  *stöd-x-öppnaren*, *negativ-x-öppnaren* (rondkrav, aldrig pass),
  *negativ-dubblaren* (höjning med fit ur `fit-raise` → 13+ utan fit → 3NT →
  svag preferens (K2) → invit-fortsättning → 2NT), *jordan-öppnaren* /
  *jordan-svararen*. Manuset (`auction.ts`): svararens konkurrensbud kommer ur
  tabellen (`ask(responderSeat)`); `competitiveResponderAction` och
  stöddubblingsronden borta. Rivet ur `auction-live.ts`: detektorerna
  `supportDoubleToAnswer`, `supportDoubleFollowUpToAnswer`, `jordanToAnswer`,
  `jordanSignoffToAnswer`, `negativeDoubleToAnswer`, `negativeDoublerContinues`
  med lägesläsare. Tvåfärgsinklivet över vår öppning läses ur AUKTIONEN (2NT
  direkt = ovanlig, cue av öppningsfärgen = Michaels) — förr ur motståndarens
  regeletikett, som inte finns vid bordet.
  **Diffvarvet som revs:** raden *inkliv-över-svaret* (RHO:s naturliga inkliv
  över vårt 1-lägessvar ur RHO:s egen hand — det manuset förr bara lade när
  ÖPPNAREN hade exakt tre stöd, en kik) byggdes och gav 103 ändrade givar där
  öppnarens återbud föll till det gamla lagrets catch-all: 4♠ på 13 hp med
  4-korts stöd (frö 20270008), reverse 2♥ på 14 utan fit (20270060/20270104),
  öppnarens cue som svararen passade (20270156). Det är familj 4:s stol
  (öppnarens konkurrensåterbud) → raden revs; kik-ronden revs ändå, så
  botauktionen är ostörd där tills familj 4 (regel: bygg aldrig en ny
  motståndaraktion innan MOTTAGARENS rad finns).
  **b-listan (bokens §7.4/§7.8 b/d/e, §5.7 — allt i §9):** (1) **svararen tar
  sitt konkurrensbeslut ur tabellen vid bordet** — avvikelsedumpen (människan
  öppnade, boten klev in) visar 700 givar där svararen förr fick catch-allens
  bud: cue (limithöjning+) 192 (frö 20270002: 1♣–(1♥) med ♠64 ♥T85 ♦A
  ♣AKQT532 → 2♥, förr 5♣), negativ dubbling 193 (20270004: 1♦–(1♠) med ♠54
  ♥AJ54 ♦AJ6 ♣KJ98 → X, förr 2♣), konkurrenshöjning 143 (20270001: 1♣–(1NT)
  med 8 hp och 4 klöver → 2♣, förr 3♣), straff-X mot 1NT 36 (20270008 → X,
  förr 3NT), fritt bud 37 (20270007: 1♣–(1♥) med ♠QT863 → 1♠, förr 5♣), XX
  46, Jordan 17, 4M/3M mot tvåfärg 12, NT med stopp 9, pass 43 (20270001:
  1 hp → pass, förr "enkel höjning" 2♣); (2) **"Jordan 2NT" bara efter
  1♥/1♠** — över 1♣/1♦ med 4+ stöd och 10+ → XX (15 av 3000 botgivar, t.ex.
  20270093: ♠A6 ♥T8653 ♦K5 ♣KT54 efter 1♣–(X) → XX; förr 2NT som öppnaren
  passade ut); (3) **negativ-dubblarens utgång**: 13+ utan fit → 3NT mot
  partnerns sangsvar eller jämn med stopp (20272408: ♠A ♥QT52 ♦J984 ♣AK65
  efter 1♣–(1♠)–X–P–1NT → 3NT, förr 5♣; 20272188 → 3NT, förr 2♠) och 2NT =
  10–12 mot sangsvaret (20271063: ♠Q986 ♥KQ72 ♦K9 ♣432 → 2NT, förr pass);
  (4) **NMF gäller passad hand** — den ostörda linjen bjöd redan NMF (svar2)
  medan läsaren nekade, så öppnarens svar föll ur tabellen (20270269:
  P–P–P–1♦–P–1♥–P–1NT–P–2♣ → 2♥ ur raden *tredje*; avvikelsedumpen 24 givar
  där honorForce/catch-all förr gav 3♣/2♠/3NT); (5) betydelselagret: 4m-
  hopphöjning efter hoppskift = slaminbjudan (20270453: 1♦–1♠–3♣–4♦, förr
  "naturligt, utgångskravet står" — ostörda grinden tillbaka på 0). Kvar åt
  familj 4 (facit/anteckning i §4): ojämna 13+ negativ-dubblare utan stopp,
  svararens svar på öppnarens cue i konkurrens, RHO:s inkliv över svaret.
  **Mätningar** (kommandon i §3; baslinjer på `d3f7116`): hela sviten grön
  (`npm test`), `npx tsc` rent; auktionsdiffen 3000 givar: ÄNDRAT BUD 57 (37
  = kik-ronden borta, ostörd linje i stället — a; 15 Jordan → XX; 3 → 3NT;
  2 → 2NT), samma bud/annan källa 1164; revisorintervallet (20260721–20261720):
  ÄNDRAT BUD 22 (17/3/1/1, samma mönster), samma bud/annan källa 406;
  avvikelsedumpen: ÄNDRAT BUD 768 (b-listan + 10 kik-rond), samma bud/annan
  källa 434, 92 nycklar bara i baslinjen (svar2-läget nås inte när RHO förr
  klev in), olagliga tabellbud 0 i alla tre. Frekvensbilden (3000):
  `tabell:svar-stört` 1184 · `tabell:negativ-x-öppnaren` 140 ·
  `tabell:negativ-dubblaren` 73 · `tabell:jordan-öppnaren` 8 ·
  `tabell:jordan-svararen` 3 (stöd-x-raderna nås bara vid bordet tills familj
  4); `manus` 4785 → 3623 bud, `pass (ingen regel)` 8799 → 8773,
  `detektor:offBookResponse` 746 → 706, 56 → 55 källor. Betydelsesvepet:
  ostörda grinden kravnivå 0 · alert 0 · registerhål 0 · kända motoravvikelser
  0; störda (familj 9) kravnivå 2105 → 2098 bud · alert 1061 → 1009 ·
  registerhål 1018 → 942 (familjens regelnamn registrerade i `rules.ts`).
  Pliktsvep: K1 19, K2 3, K3 5, K4 0, K5 9, K6 29 (oförändrade);
  förklaringssvep grönt (0 oförklarade); regelsvep grönt (284 regler, 0
  auktioner utan slut). Kikvakten skarp grön (nytt krav `tabell:svar-stört`
  > 50). Revisorn 1000 givar: rätt kontrakt 20,3 % · snittförlust 271,06
  (baslinje d3f7116: 20,4 % · 270,27, dvs. +0,79 per giv = brus); kategorier
  (antal/förlust): fel-farg-bet 122/51520 · missad-lillslam 76/49080 ·
  missad-utgang 142/48170 · missad-storslam 34/39190 · billig-offring
  115/32410 · battre-an-facit 115/19500 · sald-giv 61/18850 · for-hogt
  40/9540 · fel-strain 89/1990 · utpassad 3/810 (revisor-output/latest.json).
  19 av revisorns 1000 givar bytte slutkontrakt — nästan alla för att RHO:s
  inkliv över svaret inte längre läggs i botauktionen (kik-ronden riven, t.ex.
  20260884 5♦ → 3NT = etapp 6-facitgiven, nu ostörd; 20260742: RHO med 8-korts
  spader tiger → 2♣ passas ut — priset för att vänta med inklivet till familj
  4, som bygger det med öppnarens återbud på plats); resten Jordan → XX
  (20260756 2NT → 2♣, 20261121 2NT → 2♦) och negativ-dubblarens 3NT
  (20261115 2♦ → 3NT). Ingen regel tunad på poäng (ägarprincip 2026-08-06).
- **2026-09-08 — Etapp 4 familj 2 KLAR & LIVE: dubblingsfamiljen i tabellen (grinden godkänd av ägaren samma dag, "Godkänt, kör PCD"; mergepunkt `d3f7116`).**
  Test-drivet: facit-blocket "etapp 4 familj 2" i `motorbyte-facit.test.ts`
  (frö 20270004 → 3NT, frö 20270461 → 3♠) + `auction-etapp4-familj2.test.ts`
  (raderna, lägesgränserna, systems on över deras X, det rivna). **Bygget:**
  `double-continuations.ts` (lägesläsarna `doubleFamily` [vår sidas FÖRSTA
  X i tid = dubblaren; kräver deras färgöppning], `takeoutOfResponseSeat`,
  `takeoutDoubleToAnswer`, `takeoutDoubleOverbidToAnswer`,
  `cueAfterOurDoubleToAnswer` [generaliserad: även dubblarens cue efter
  advancerns responsiva X] + kunskapen flyttad som funktioner av EN hand +
  fakta). Raderna: *dubbling* (`takeoutOfResponse`; passet lämnas åt det gamla
  lagret — samma stol äger inklivet över svaret, som manuset bara bjuder i
  stöddubblingsronden = familj 3), *x-svar* (tvunget svar / responsiv X efter
  svararens 2-lägeshöjning / fritt svar / uttryckligt pass), *x-dubblaren*
  (cue-svar → `doublerWeighsAdvance` → `ownStrongDoubleRebid` →
  `strongDoublerSecondRebid` → 3NT över 2NT → straff-X → preferens/tävla),
  *x-advancern* (cue-svar → stödstegen → domen på 3-hoppet → straff-X →
  preferens/tävla). Manuset (`auction.ts`) läser tabellen för X-sitsen efter
  två färger och för advancerns svar när svararen bjöd över X:et. **Systems on
  över deras X av vårt svar:** raderna återbud/svar2/tredje/svar3/fjärde
  tolererar deras enda X direkt efter svaret (`xOfResponse`), och
  betydelselagrets `undisturbed` likaså — utan det föll öppnarens återbud till
  `offBookResponse` (2NT på 12 hp, 3NT på 14, hopp till 3♠ på 13, pass med
  7-korts ruter; revisorintervallets frön 20260836/20261592/20261707/20261497).
  Rivet ur `auction-live.ts`: `takeoutDoubleToAnswer`,
  `takeoutDoubleOverbidToAnswer`, `advancerCueToAnswer`,
  `doublerRaisesAdvance`, `maybeTakeoutOfResponse`, `ownStrongDoubleRebid`,
  `advanceStrongDoubleRebid`, `strongDoublerSecondRebid`,
  `answerStrongDoubleGameForce` och den tunna `advancerCompetesToFit`.
  **Tre diffvarv:** (1) raden *dubbling* svarade uttryckligt pass → tystade
  manusets inkliv över svaret (fyra röda stöddubblingstester) → null vid pass;
  (2) manusets responsiva dubbling tystades av det fria svaret (44 givar) →
  responsiv X först i *x-svar*, bara efter SVARARENS höjning (inte öppnarens
  rebud); (3) 4-4-dubblingen gav öppnaren catch-all-återbud → systems on.
  **Familjegränsen:** det starka X-flödet slog förr till på DONT-X över 1NT
  (`ownStrongDoubleRebid` krävde bara nivå 1) — frö 20271222/20271334 höjde
  en DONT-enfärg till utgång på 8 hp (nu pass = bättre), frö 20272187 (19 hp,
  6 spader) visade sin färg 3♠ av rätt skäl fel väg → `it.todo` åt familj 6;
  frö 20271153 (5♣ på 5-läget mot 4♠) → pass, försvarbart.
  **b-listan (bokens §7.3/§7.4/§7.8 f, allt i §9):** (1) **den vanliga
  4-4-dubblingen efter två bjudna färger** bjuds nu i bottarnas egna auktioner
  (16 av 3000 givar; förr medvetet live-only, `senare.md`) — frö 20270009:
  1♦–P–1♥, N ♠AQ72 ♥K9752 ♦– ♣KQ92 → X; frö 20270236: ♠KJ65 ♥2 ♦QT85 ♣AJ53 →
  X; (2) **dubblaren höjer partnerns 2NT till 3NT med 14+** (frö 20270004,
  20272095: ♠K92 ♥Q ♦KJT62 ♣KQT2 → 3NT); (3) **advancern svarar dubblarens cue
  efter sin responsiva X** (frö 20270461 → 3♠; 20271444: ♠8764 ♥932 ♦Q5 ♣AJ74
  → 3♠, sedan 4♠; 20261404 → 4♦; 20261378 → 4♣); (4) **systems on över deras X
  av vårt svar** (frö 20261592: S ♠KJ4 ♥T6 ♦T95 ♣AKQJT → 1NT i stället för
  3NT; 20260836 → 1NT i stället för 2NT; 20261707 → 2♠ i stället för 3♠;
  20261497 → 2♦ i stället för pass; 20271041: 1♠–3♠(Bergen spärr)–X → 4♠, samma
  som ostört); (5) **responsiv X även vid bordet** (avvikelsedumpen: 17 givar
  där människan öppnat och advancern förr bjöd 3NT/2NT/cue eller passade —
  nu X, samma företräde som manuset alltid gav den i bot-auktioner). Kandidat
  till ägarbeslut (ej byggt): responsiv X med 12+ → 3NT/cue direkt i stället?
  **Mätningar** (kommandon i §3; baslinjer på `26687c9`): hela sviten grön
  (`npm test`), `npx tsc` rent; auktionsdiffen 3000 givar: ÄNDRAT BUD 32
  (b-listan + 4 DONT-fall), samma bud/annan källa 329; avvikelsedumpen: ÄNDRAT
  BUD 79 (12 dubblingar, 17 responsiva X, ~45 systems on-återbud/andra bud som
  förr gick till `offBookResponse`/`honorForce`), samma bud/annan källa 447,
  96 svar2-nycklar bara i baslinjen (auktionen är inte längre ostörd fram till
  svararens andra tur när RHO dubblar 4-4), olagliga tabellbud 0;
  revisorintervallet (20260721–20261720, baslinje via `git stash`): ÄNDRAT
  BUD 10 (samma mönster). Frekvensbilden: `tabell:x-svar` 371 ·
  `tabell:x-dubblaren` 257 · `tabell:x-advancern` 43 · `tabell:dubbling`
  17; `manus` 4862 → 4785 bud, `pass (ingen regel)` 8892 → 8799,
  `detektor:maybePenaltyDouble` 16 → 9 (straff-X:en i dubblingsläget går via
  raderna), 61 → 56 källor. Betydelsesvepet: ostörda grinden kravnivå 0 · alert 0 · registerhål 0 · kända motoravvikelser 0; störda (familj 9) kravnivå 2100 → 2105 bud · alert 1045 → 1061 · registerhål 1030 → 1018. Pliktsvep: K1 25 → 19 (de sex "dubblarens partner passar cue (krav)" är borta = facit 20270461-mönstret), K2 3, K3 5, K4 0, K5 9, K6 29 (oförändrade); förklaringssvep grönt (0 oförklarade); regelsvep grönt (0 auktioner utan slut). Kikvakten skarp grön (alla tabellkällor). Revisorn 1000 givar: rätt kontrakt 20,4 % · snittförlust 270,27 (baslinje 26687c9: 20,4 % · 270,16, dvs. +0,11 per giv = brus); kategorier (antal/förlust): fel-farg-bet 118/50150 · missad-lillslam 76/49080 · missad-utgang 139/47460 · missad-storslam 34/39190 · billig-offring 116/32300 · battre-an-facit 118/20540 · sald-giv 58/18430 · for-hogt 42/10220 · fel-strain 92/2090 · utpassad 3/810 (revisor-output/latest.json). 4 av revisorns 1000 givar bytte slutkontrakt (20260728 3NT → 4♣ efter systems on-passet över 1♦–3♦–X; 20261239 4♣ → 5♣; 20261378 4♠ → 5♣ och 20261404 3♥ → 5♥ via svaret på dubblarens cue) — alla b-mönster; ingen regel tunad på poäng (ägarprincip 2026-08-06).
  🚪 Grinden TAGEN 2026-09-08 ("Godkänt, kör PCD"). Nästa: etapp 4 familj 3 (negativ dubbling, stöddubbling, öppnarens svar) med nya baslinjer på `d3f7116`.

- **2026-09-08 — Etapp 4 familj 1 KLAR & LIVE: inkliv och advance i tabellen
  (grinden godkänd av ägaren samma dag; mergepunkt `26687c9`, Actions grön,
  rebidz.com aliasad).** Test-drivet: facit-blocket "etapp 4 familj 1" i
  `motorbyte-facit.test.ts` (frö 20261162 → 5♣, frö 20262021 → 4♣) +
  `auction-etapp4-familj1.test.ts` (22 fall: raderna, lägesgränserna, det
  rivna). **Bygget:** `auction-rules.ts` (bridge-reglerna utbrutna ur
  `auction-live.ts`, som re-exporterar — annars cirkelimport tabell ↔ gamla
  lagret); `overcall-continuations.ts` (lägesläsarna `overcallSeat`,
  `advanceSeat`, `twoSuiterAdvanceSeat`, `our1NTOvercall`,
  `overcallerSecondTurn`, `ownTwoSuiterSeat`, `cueBidderTurn` + kunskapen
  som funktioner av EN hand + fakta); `competitive-slam.ts` (konkurrens-
  slaminvitet ordagrant flyttat). Raderna: *konkurrens-slam* (före familjens
  rader — steget låg före detektorerna i det gamla lagret; utan raden pre-
  emptade advance2 ett 4NT i avvikelsedumpen), *inkliv* (`overcall`, direkt +
  balansering, svarar alltid inkl. pass), *advance* (`advanceOvercall` 1-/2-
  läget, `advanceTwoSuiter` med `overCall`-parametern, `respondTo1NT`),
  *inkliv2* (straffdubblingen först, cue-svar tyst/tävlat, fit-jump-svaret,
  stöd åt advancern, 1NT-fullföljd, Michaels-svaret på pass-eller-rätta,
  tvåfärgsinklivets flykt/fortsättning, sist "tävla till fiten" för
  inklivaren), *advance2* (straffdubblingen först, preferens till
  inklivsfärgen, tävla till fiten, cue-bjudarens fortsättning). Manuset
  (`auction.ts`) läser tabellen för LHO:s inkliv, advancern och
  balanseringen (`history`/`ask`/`layOpp` flyttade upp före konkurrens-
  ronden). Rivet ur `auction-live.ts`: `maybeOvercall`,
  `partnerTwoSuiterToAnswer`, `ownDoubledTwoSuiterRescue`,
  `advancerRespondsTo1NTOvercall`, `overcallerAnswersAdvance`,
  `overcallerRaiseAdvance`, `overcallerCompetesAfterCueRaise`,
  `overcallerAnswersCueRaise`, `advancerPrefersOvercallSuit` och
  konkurrens-slam-steget; `answerCueBidderRebid` = tunt anrop till den
  delade `cueBidderContinues(…, 'öppnare')` tills familj 4.
  **Familjegränsen som kostade tre diffvarv:** all X på VÅR sida är
  dubblingsfamiljens läge — tabellraderna inkliv2/advance2 tiger då
  (`ourSideDoubled`) och det gamla lagret behåller en tunn detektor
  `advancerCompetesToFit` (preferens ?? tävla, bara med X på vår sida) EFTER
  dubblarens vakter. Utan gränsen pre-emptade raden "dubblaren nöjer sig"-
  passen (26 c-fall) och den starka dubblingens återbud. Samma sak med
  straffdubblingen (`maybePenaltyDouble` låg före fortsättningarna: två
  X → 5♦ i revisorns intervall) → `penaltyDoubleFirst` först i båda raderna.
  Regeln att ta med till familj 2–8: en rad som flyttar en catch-all-detektor
  ska behålla dess räckvidd men utesluta lägen där en TIDIGARE detektor i
  kedjan ägde beslutet — diffen avslöjar det som "före: <detektor A> → efter:
  tabell:<rad>".
  **b-listan (bokens paragraf i budsystem §7.1–7.2, alla i §9):**
  (1) advancern svarar på ett **2-lägesinkliv** med §7.1-tabellen — cue 3+/11+
  (frö 20270035: 1♦–(2♣)–P: ♠K ♥KT9 ♦K9765 ♣Q976 → 2♦ i stället för 5♣; sedan
  3♣ minimum, 3NT), höjning från 6 stödpoäng (frö 20270262: ♠93 ♥KT52 ♦AQ62
  ♣T83 → 3♣ i stället för pass), ny färg 5+/8+ på 2-läget aldrig deras färg
  (frö 20270120: ♠54 ♥AK94 ♦KT9743 ♣8 → 2♦), 2NT 11+ med stopp (frö 20271567:
  ♠AT3 ♥QT3 ♦K3 ♣KJ753 → 2NT; frö 20270968 → 2NT i stället för 4-korts 2♠),
  fit-jump (frö 20270356: ♠7 ♥KQT96 ♦AKQ62 ♣T8 → 4♦ i stället för 4♥);
  (2) advancerns nya färg på **billigaste nivån** (frö 20270592: 1♣–(1♥)–P
  med ♠QJ976 → 1♠, förr hoppet 2♠); (3) **tvåfärgspreferens efter deras
  höjning** (frö 20270044: 1♠–(2NT)–3♠ med ♦AQ954 → 4♦; frö 20262021 → 4♣)
  med spelrum för pass (4-läget: 4+ kort eller 8+ hp; 5-läget: båda — frö
  20270138 ♣Q2 10 hp → pass, frö 20270064 fem hjärter 1 hp → pass; p/c-3♣
  aldrig på 5-läget); (4) **inklivaren svarar fit-jumpen** (frö 20270356: Öst
  ♥AJ752 9 hp → 4♥ i stället för gamla lagrets 5♦-höjning av sidofärgen) och
  **Michaels-svaret på pass-eller-rätta** (frö 20272323: ♣J9854 → pass i stället
  för 5♣); (5) **tvåfärgsinklivarens flykt/fortsättning** (frö 20261162 →
  5♣); (6) boten kliver in över människans öppning även när ingen bot skulle
  öppna (avvikelsedumpen 20270031: "ingen öppning" → 2♣/1♥). **Familj 2-fynd
  (14 bot-mot-bot-givar):** det gamla lagrets tvåfärgsläsare tog partnerns
  2NT/cue EFTER vår upplysningsdubbling för Michaels/ovanlig 2NT och "gav
  preferens" (frö 20270004: 3♣; 20270461: 3♠); nu pass = regeln saknas
  (dubblarens fortsättning efter advancerns fria 2NT / cue) → `it.todo` i
  facit-kön (20270004 → 3NT, 20270461 → 3♠); pliktsvepets K1 visar dem som
  "dubblarens partner passar cue (krav)" (6 träffar).
  **Mätningar** (kommandon i §3; baslinjer på `226882b`): hela sviten grön
  (`npm test`), `npx tsc` rent; auktionsdiffen 3000 givar: ÄNDRAT BUD 86
  (b-listan + familj 2-fynden; a-mönster: manusets LHO-inkliv/advance/
  balansering + inklivarens/advancerns flyttade fortsättningar), samma
  bud/annan källa 2138; avvikelsedumpen: ÄNDRAT BUD 136 (samma mönster; 11 st
  "2-lägesadvance passar i stället för 4-korts ny färg på 12+"), samma bud/
  annan källa 5092, olagliga tabellbud 0; revisorns intervall
  (20260721–20261720, baslinje via `git stash`): ÄNDRAT BUD 30 (samma
  mönster). Frekvensbilden (`auktionsdump-frekvens.txt`): `tabell:inkliv`
  2317 · `tabell:advance` 321 · `tabell:inkliv2` 120 · `tabell:advance2`
  102; `manus` 7330 → 4862 bud, `pass (ingen regel)` 8993 → 8892, `detektor:advancerCompetesToFit` 108 → 10 (bara X-lägena), 101 → 89 källor. Betydelsesvepet: ostörda grinden kravnivå 0 · alert 0 ·
  registerhål 0 · kända motoravvikelser 0; störda (etapp 4 familj 9)
  kravnivå 1907 → 2100 bud · alert 958 → 1045 · registerhål 1315 → 1030 (fler cue-advance och fit-jumps att läsa; grindas i familj 9). Pliktsvep: K1 19 → 25 (de sex nya = "dubblarens partner passar cue (krav)" = familj 2-fyndet), K2 2 → 3, K3 5 → 5, K4 0, K6-inventeringen 12 → 29 (fler cue-advance); förklaringssvep grönt; regelsvep grönt.
  Kikvakten skarp för alla tabellkällor (300 givar; nya krav `tabell:inkliv`
  > 100, `tabell:advance` > 0). Revisorn 1000 givar: rätt kontrakt 20,4 % · snittförlust 270,16 (baslinje 226882b: 20,4 % · 268,38, dvs. +1,78 per giv ≈ en givs förlust på tusen); kategorier (antal/förlust): fel-farg-bet 117/49760 · missad-lillslam 76/49080 · missad-utgang 139/47460 · missad-storslam 34/39190 · billig-offring 116/32300 · battre-an-facit 119/20810 · sald-giv 58/18430 · for-hogt 42/10230 · fel-strain 92/2090 · utpassad 3/810 (revisor-output/latest.json). 29 av revisorns 1000 givar bytte slutkontrakt (listan ur auktionsdump-revrange-diffen: t.ex. 20260806 4♠ → 4♥ Ö/V via tvåfärgspreferens, 20261162 4♥ → 5♣ = facit-fröet, 20261601 5♣ → 4♣ via fit-jump) — alla b-mönster; ingen regel tunad på poäng (ägarprincip 2026-08-06).
  🚪 Grinden TAGEN 2026-09-08 ("Godkänt, kör PCD"). Nästa: etapp 4 familj 2 (upplysningsdubbling, svar, dubblarens återbud) med nya
  baslinjer på familj 1:s mergepunkt.

- **2026-09-08 — §5b beslut 16 KLAR & LIVE (lågfärgsfit i utgångskrav: 5m är
  utgången, inbjudan är kontrollbudet — bara bok + facit; mergepunkt `226882b`,
  Actions grön, rebidz.com aliasad). HELA §5b ÄR DÄRMED BYGGD OCH LIVE — nästa:
  etapp 4 familj 1.** Facit-blocket "§5b beslut 16" i
  `motorbyte-facit.test.ts` (tre fall) låser linjen: efter 1♦–2♣–2NT–3♦–4♦
  cue:ar kaptenen 4♥/4♠ med 31–32 (jämn 19 mot visade 12), bjuder 5♦ utan
  första-rondskontroll (systemriktig miss), frågar 4NT med 33+; partnern
  cue:ar tillbaka med extra eller avslutar 5♦; betydelselagret läser 4♥ som
  cue och 5♦ som utgång. Sonden före bygget visade att motorn redan gjorde
  allt detta — inget bud ändras. Enda kodtillägg: partnerns uttryckliga pass
  ur slamraden när kaptenen avslutar direkt i 5m (`slamTurn`; förr gamla
  lagret — samma bud, ny källa). Systembok §6.2 (en mening) + §9.
  **Mätningar** (kommandon i §3; baslinjer på `3cd2cfa`): hela sviten grön
  (`npm test`), `npx tsc` rent; auktionsdiffen 3000 givar: ÄNDRAT BUD 0, samma
  bud/annan källa 15 (partnerns pass efter kaptenens utgångsavslut ur
  slamraden/manuset — a); avvikelsedumpen: ÄNDRAT BUD 0, samma bud/annan källa
  43 (samma pass), olagliga tabellbud 0; betydelsesvepet kravnivå 0 · alert 0 ·
  registerhål 0 · kända motoravvikelser 0; pliktsvep/förklaringssvep/regelsvep
  gröna; revisorn 1000 givar: rätt kontrakt 20,4 % · snittförlust 268,38
  (identiskt med beslut 12 — inget bud ändras).
- **2026-09-08 — §5b beslut 12 KLAR & LIVE (hopp till 4m efter 1m–2m′–2NT =
  trumf satt + slamdriv; mergepunkt `3cd2cfa`, Actions grön, rebidz.com
  aliasad).** Test-drivet:
  facit-blocket "§5b beslut 12" i `motorbyte-facit.test.ts` (fyra fall). Bara
  läsregel + öppnarens svar — boten bjuder själv fortfarande det billiga 3m
  (#58). Nya lagret: betydelselagret `responderSecondAfter2over1` läser 4m som
  '2/1: hopphöjning (slamdriv)' (nytt regelnamn, kravnivå slamintresse;
  registret + testkatalogen); tabellens slamrad (`slamSituation`, ny gren:
  prefix 4, `partnerStarts`, partnerMin 12, GF) — öppnaren cue:ar billigaste
  första-rondskontroll under 5m eller avslutar 5m, kaptenen fortsätter
  (cue/4NT) eller passar. Två hål som dök upp under bygget: (1) 1♣–2♦–2NT–4♣
  lästes som Gerber — Gerber-läsaren (fråga och svar) fick undantaget
  `jumpRaise2over1`; (2) kaptenens tur efter partnerns direkta 5m-avslut gav
  null i `slamTurn` (föll till gamla lagret) — nu uttryckligt 'svararens
  pass' i `partnerStarts`-grenen, vilket också gäller beslut 3/4-flödena
  (samma bud, ny källa). `auction-decide.test.ts`: "4m lämnas åt gamla
  lagret" omskrivet (öppnaren svarar 5♦). Systembok §5.3 + §9.
  **Mätningar** (kommandon i §3; baslinjer på `b06c673`): hela sviten grön
  (`npm test`), `npx tsc` rent; auktionsdiffen 3000 givar: ÄNDRAT BUD 0,
  samma bud/annan källa 7 (kaptenens pass efter partnerns utgångsavslut kommer
  nu ur slamraden — a); avvikelsedumpen: 1 ändrad (b: människans 4♦ → öppnaren
  cue:ar 4♥ i stället för gamla lagrets "krav – stödjer partnern" 5♦) + 14
  omdöpta (a), 0 c, olagliga tabellbud 0; betydelsesvepet kravnivå 0 · alert
  0 · registerhål 0 · kända motoravvikelser 0; pliktsvep/förklaringssvep/
  regelsvep gröna; revisorn 1000 givar: rätt kontrakt 20,4 % · snittförlust
  268,38 (identiskt med beslut 11 — boten bjuder inte hoppet själv).
- **2026-09-08 — §5b beslut 11 KLAR & LIVE (svararens nya färg på 3-läget efter
  1M–1NT–2x = 6+ kort, 10–11, inbjudan; mergepunkt `b06c673`, Actions grön,
  rebidz.com aliasad).** Test-drivet: facit-blocket "§5b beslut 11" i `motorbyte-facit.test.ts`
  (fem fall, alla röda före fixen). Nya lagret: `inviteSuit` i
  `responderRebidAfterSemiForcing1NT` (6+ färg, 10–11, under 3-korts stöd →
  3x, efter både 2M-rebudet och en ny 2-lägesfärg; limithöjningen 3M går
  före; den svaga 2-lägesfärgen från #59 står kvar under 10); öppnaren i
  `openerThirdBidAfterSemiForcing1NT` (pass = minimum med tolerans 2+; 3M =
  6+ utan tolerans; 4 i svararens högfärg = 14+ med 3-korts stöd eller
  A/K/Q-dubbelton; 3NT = 14+ med håll i de två objudna; 5m = 14+ med 4-korts
  stöd utan håll; annars pass); svararen passar (raden svar3).
  Betydelselagret: 3x efter 1M–1NT–2x = 'inbjudan (ny färg)' (nytt regelnamn,
  kravnivå inbjudan, ingen alert — registret + testkatalogen), öppnarens svar
  ('rebid: egen färg' / 'accepterar inbjudan'). Systembok §5.1 (nytt stycke +
  svarstabell) + §9. **Följd för felrapport #59 (flaggad för ägaren):**
  brickans Nord (♠A ♥QJ943 ♦KJT852 ♣T, 11 hp) bjuder nu 3♦ i stället för 2♦ —
  beslutstexten säger 10–11 → 3-läget, #59:s "svagare" är under 10;
  `responder-rebids.test.ts` omskrivet. Claudes tolkningar utöver
  beslutstexten: maximum = 14+ hp; "bra dubbelton" = A/K/Q; lågfärg: 3NT med
  håll, annars 5m bara med 4-korts stöd; maximum utan fit och utan håll →
  pass.
  **Mätningar** (kommandon i §3; baslinjer på `f4cbe74`): hela sviten grön
  (`npm test`), `npx tsc` rent; auktionsdiffen 3000 givar: ÄNDRAT BUD 4 — alla
  b (frön 20270042, 20270188, 20271951, 20272049: 6-kortsfärgen bjuds 3♦/3♥
  som inbjudan i stället för pass/2NT/2♦; öppnaren rättar 3♠ utan tolerans
  eller passar); avvikelsedumpen: 25 ändrade + 4 omdöpta — alla b (människans
  3x: öppnaren passar med minimum och tolerans 11 ggr och accepterar 3NT/4♥
  3 ggr där gamla lagret förr drev via honorForce 3♠/3♥/4♥ eller
  offBookResponse 4♠/5♦/5♣; bottens egna 3♦/3♥/3♣ 6 ggr; svararens pass på
  öppnarens svar 4 ggr), 0 c, olagliga tabellbud 0; betydelsesvepet kravnivå
  0 · alert 0 · registerhål 0 · kända motoravvikelser 0; pliktsvep/
  förklaringssvep/regelsvep gröna; revisorn 1000 givar: rätt kontrakt 20,4 % ·
  snittförlust 268,38 (beslut 6: 20,4 % · 268,39).
- **2026-09-07 — §5b beslut 6 KLAR & LIVE (naturliga 3♣/3♦ efter 2♣–2♦–2M, andra
  negativa = 2NT; mergepunkt `f4cbe74`, Actions grön, rebidz.com aliasad).** Test-drivet:
  facit-blocket "§5b beslut 6" i `motorbyte-facit.test.ts` (fem fall) + frö
  20271509 (förr `it.todo`, nu skarpt: 3♣ naturligt med 5 hp och 5 klöver).
  Nya lagret: `responderSecondBidAfter2C` — 2NT = andra negativa bara med 0–3,
  ingen fit (under 3 i högfärgen) och ingen 5-kortsfärg; 3♣/3♦/2♠/3♥ naturliga
  (5+) oavsett styrka; stöd → 4M som förut. Öppnarens tredje bud efter 2NT i
  tabellen (raden tredje, `openerThirdAfterSecondNegative`): 4M med 6+ trumf
  och 24+ eller 9½+ spelstick ('utgång'), 3M med 6+ ('rebid: egen färg', ej
  krav), annars andra 4+-färgen ('rebid: ny färg', ej krav), annars 3M.
  Svararens placering (raden svar3, `responderAfterSecondNegative`): pass,
  4M med 3 trumf och 2+ hp ('höjning'), preferens till kravfärgen; öppnarens
  fjärde bud efter placeringen = pass (raden fjärde). Betydelselagret:
  `isSecondNegative` läser 2NT, 3♣/3♦ efter 2M naturliga (0–7, 5+), öppnarens
  andra färg 'rebid: ny färg', svararens 'höjning'/'preferens'. Inga nya
  regelnamn. Betydelsesvepets kända motoravvikelse (2♣–2♦–2M–3♣) struken —
  listan är nu tom. Claudes tolkningar utöver beslutstexten (flaggade för
  ägaren): 3+ stöd höjer till 4M även med 0–3 (som förut); 4M på egen hand =
  24+ eller 9½ spelstick; svararen höjer 3M → 4M med 3 trumf och 2+ hp.
  Systembok §4.4 (svarsstrukturen + "Vid miss") + §9.
  **Mätningar** (kommandon i §3; baslinjer på `47a5c8f`): hela sviten grön
  (`npm test`), `npx tsc` rent; auktionsdiffen 3000 givar: ÄNDRAT BUD 1 — b
  (frö 20272063: 3 hp med tre hjärter höjer 4♥ direkt i stället för 3♣ + gamla
  lagrets 3♥/4♦-kaos); samma bud/annan regel 1 (frö 20272202: 3♣ heter nu
  'ny färg (GF)', klass a); avvikelsedumpen: 13 ändrade + 3 omdöpta — alla b
  (människans 2NT och bottens svar: 4 naturliga 3♦/2♠, 4 höjningar, 2 andra
  negativa 2NT, öppnarens 4♥ på 9½ spelstick där gamla lagret förr drev via
  honorForce, 3♦ andra färg + preferens där gamla lagret förr bjöd 5♦), 0 c,
  olagliga tabellbud 0; betydelsesvepet kravnivå 0 · alert 0 · registerhål 0 ·
  kända motoravvikelser 0 (förr 2); pliktsvep/förklaringssvep/regelsvep
  gröna; revisorn 1000 givar: rätt kontrakt 20,4 % · snittförlust 268,39
  (beslut 9: 20,3 % · 268,58).
- **2026-09-07 — §5b beslut 9 KLAR & LIVE (passad hand över 1♥/1♠: Jacoby/Bergen/
  splinter AV, Drury på stödpoäng, 2NT naturlig inbjudan; mergepunkt `47a5c8f`,
  Actions grön, rebidz.com aliasad).** Test-drivet: facit-blocket "§5b beslut 9" i
  `motorbyte-facit.test.ts` (sex fall, alla röda före fixen). Nya lagret:
  `respondToMajorPassed` omskriven (3M spärr under 6 med 4+ · 4M 5+ trumf under
  10 stödpoäng · Drury på 10+ stödpoäng med 3+ trumf · 2M 6–9 med 3+ · 1♠ · 3♣/3♦
  6+ svag · 2NT 11–12 jämn utan stöd · annars det vanliga schemat, som utan fit
  aldrig når Jacoby/Bergen); öppnaren `openerRebidAfterPassedMajorResponse`
  (2NT: 14+ → 3NT/4M med 6+, minimum 6+ → 3M 'rebid: stanna', annars pass;
  3M-spärr: 4M bara med 18+; 3♣/3♦: pass, 3NT 16+ jämn, 4M 16+ med 6+, egen
  färg igen med singel/renons i partnerns färg); svararen passar öppnarens
  placering; betydelselagret läser passad hands 3♣/3♦ som 'ny färg' (ej krav,
  ingen alert), 3M som 'spärrhöjning', öppnarens svar som 'rebid: stanna'/
  'rebid: utgång'/'rebid: 3NT'/'rebid: egen färg'. Inga nya regelnamn.
  Claudes tolkningar utöver beslutstexten (flaggade för ägaren): 4M-spärren
  behålls för 5+ trumf under 10 stödpoäng (med kortfärg blir det Drury —
  tröskeln går på stödpoäng, precis som ägaren sa); 2NT-inbjudan 11–12, en
  passad 13–15 jämn (bara människan) går 3NT som förut; 3♣/3♦ = 6–9.
  Systembok §6.7 (hela tabellen), §4.1-not, §9. `responses-drury.test.ts`:
  "för svag för Drury" ger nu 2♥ (förr Bergen 3♣).
  **Mätningar** (kommandon i §3; baslinjer på `ca954b4`): hela sviten grön
  (`npm test`), `npx tsc` rent; auktionsdiffen 3000 givar: ÄNDRAT BUD 10 —
  alla b (frön 20270448, 20270495, 20271834, 20272372 = 3♣ naturligt i stället
  för 1NT; 20271113 = 3♠ spärr med 4 hp och 4 trumf i stället för pass;
  20271144 = 2♣ Drury på 10 stödpoäng med 3 trumf; 20271423 och 20272394 =
  ägarens exempel, Bergen → Drury/2♥; 20271706, 20272996 = 2NT-inbjudan med
  11 jämn); avvikelsedumpen: 144 ändrade + 9 samma bud/annan regel — alla b
  (109 Drury där den syntetiskt "passade" boten förr bjöd Jacoby/splinter/
  2-över-1/1NT med 10+ stödpoäng, 9 öppnarpass på passad hands 3♣/3♦/3M där
  Bergen-svaret förr gav 4M, 7 naturliga 3♣/3♦, 5 2NT-inbjudningar, 6
  höjningar, 4 spärrar, 2 öppnarsvar på 2NT som förr var "pass (ingen
  regel)", 2 egen färg igen med renons/singel i partnerns lågfärg), 0 c,
  olagliga tabellbud 0; betydelsesvepet kravnivå 0 · alert 0 · registerhål 0;
  pliktsvep/förklaringssvep/regelsvep gröna; revisorn 1000 givar: rätt
  kontrakt 20,3 % · snittförlust 268,58 (beslut 5: 20,3 % · 268,77).
- **2026-09-07 — §5b beslut 5 KLAR & LIVE (passad hand i minor: semi-forcing 1NT
  behålls, inverterat AV; mergepunkt `ca954b4`, Actions grön, rebidz.com aliasad).** Test-drivet:
  facit-blocket "§5b beslut 5" i `motorbyte-facit.test.ts` (sju fall, alla röda
  före fixen). **Del A** (1NT över 1♥/1♠ av passad hand): ingen motorändring —
  betydelselagrets text säger nu "passad hand" (limithöjningen gick via Drury),
  boken §4.1/§5.1/§6.7. **Del B** i det nya lagret: `respondToMinor(hand, m,
  passed)` — 2m = enkel höjning 6–11 med 4+ stöd (regeln 'enkel höjning', ej
  krav), 3m svag under 6 med 5+, 2-över-1 finns inte (en passad 12+ med 5+ i
  andra lågfärgen bjuder den naturligt, 'ny färg (2-läget)'; en passad ojämn/
  16+ med stöd höjer enkelt hellre än "oklart" — bara människohänder);
  betydelselagret läser 2m/3m/öppnarens fortsättning/bromsen/tredje budet i
  passad-hand-läget; öppnaren `openerRebidAfterPassedMinorRaise` (under 15
  startpoäng golvade vid hp → pass · 18+ med håll överallt → 3NT · jämn 15–17 →
  2NT-inbjudan · annars billigaste äkta stopp, fantomstopp) och
  `openerThirdBidAfterPassedBrake` (≤17 pass · 18+ 3NT/andra stopp/5m);
  svararen `responderRebidAfterPassedMinorRaise` (3NT med 9+ på 2NT · 3NT med
  10+ och håll på stopp-visningen, annars broms 3m — även 10–11 utan håll, 5m
  på 25 hp är för tunt) och raden svar3 (efter andra stopp-visningen: 3NT/5m,
  delad med den inverterade bromsen). Regelnamnen `passad höjning: 2NT/
  stopp-visning/3NT/broms` i registret + testkatalogen. Systembok §4.2 nytt
  avsnitt "Passad hand", §4.1/§5.1/§6.7 noter, §9.
  **Mätningar** (kommandon i §3; baslinjer på `609d555`): hela sviten grön
  (`npm test`), `npx tsc` rent; auktionsdiffen 3000 givar: ÄNDRAT BUD 10 — alla
  b (själva beslutet: passad hands 2m i stället för inverterad 2m/"gap-hand
  1NT", öppnaren passar med 12–14 där han förr bjöd 2NT 12–14 som ändå passades;
  frön 20270406, 20270864, 20270993, 20271161, 20271176, 20271250, 20271424,
  20271713, 20272838, 20272944 — 20271713 är enda given där regeln avstår en
  25-hp 3NT: platt 14:a mittemot 11, boken säger pass); avvikelsedumpen:
  55 ändrade + 8 samma bud/annan regel — alla b (25 öppnarpass med 12–14, 12
  enkla höjningar, 7 "högfärgen först" för passad 12+ med 5-korts lågfärg, 6
  sangplaceringar för passad jämn 12+, 3 utgångar efter inbjudan/stopp, 2 pass),
  0 c, 0 "oklart", olagliga tabellbud 0; betydelsesvepet kravnivå 0 · alert 0 ·
  registerhål 0; pliktsvep/förklaringssvep/regelsvep gröna; revisorn 1000
  givar: rätt kontrakt 20,3 % · snittförlust 268,77 (beslut 4: 20,2 % · 268,99).
- **2026-09-07 — §5b beslut 4 KLAR & LIVE (rena steg i splinterreläet efter
  1♠–3♥–3♠ + fortsättningen; mergepunkt `26b05ac`, Actions grön, rebidz.com aliasad).** Test-drivet:
  facit-blocket "§5b beslut 4" i `motorbyte-facit.test.ts` (fem fall).
  Regeln i det nya lagret: `responderRevealSplinterShortness` (stegen per
  trumf: 3NT/4♣/4♦ efter 1♠, 4♣/4♦/4♥ efter 1♥), betydelselagrets
  kortfärgsläsning + `conventionalTrump` redan vid det konstgjorda svaret,
  slamraden prefix 4 för kortfärgssvaret (`partnerStarts`,
  `SlamContext.captainShort`: `partnerFirstStep` avslutar 4M med ≥ 2
  bortkastade honnörspoäng mittemot kortheten och under 14 kvar, annars
  billigaste cue; `inviteAnswer` drar av dem). Systembok §4.1
  (1♠-tabellen + "Fortsättningen") + §9. `responder-rebids.test.ts`
  omskrivet för 1♠-fallet.
  **Mätningar** (kommandon i §3; baslinjer på `158e23f`): hela sviten grön
  (`npm test`), `npx tsc` rent; auktionsdiffen 3000 givar: ÄNDRAT BUD 4 — b: frön 20270485 (3NT-steget →
  4♠, förr 5♣ i kaptenens KORTA färg), 20271314 (öppnaren avslutar 4♥, förr
  5♦ i den korta färgen), 20272100 (4♣-steget → 4♠, förr 5♦); a: 20270758
  (samma 4♠); avvikelsedumpen: 25 ändrade — alla a/b, 0 c (stegbytet i
  1♠-fallet; öppnarens fortsättning ur slamraden: 4M-avslut med slöseri
  mittemot kortheten eller cue-rond — två slammar hittas nu, frö 20270104
  och 20270215 i båda lägena, där det gamla lagret bjöd 5♣ i den korta
  färgen); olagliga tabellbud 0;
  betydelsesvepet kravnivå 0 · alert 0 · registerhål 0; pliktsvep/
  förklaringssvep/regelsvep gröna; revisorn 1000 givar: rätt kontrakt 20,2 % · snittförlust 268,99 (beslut 13: 20,2 % · 269,55).
- **2026-09-07 — §5b beslut 13 KLAR & LIVE (ingen fjärde färg efter 2/1;
  mergepunkt `158e23f`, Actions grön, rebidz.com aliasad).** Test-drivet: facit-blocket "§5b beslut 13" i
  `motorbyte-facit.test.ts` (fem fall, fyra röda före fixen). Regeln i det
  nya lagret: `responderRebidIn2over1Auction` (steg 6b: ny 4+ färg under 3NT
  är naturlig — högfärg före lågfärg, efter 3NT-med-håll och eget 6+),
  `openerAnswerNaturalThirdSuit` i raden tredje ('2/1: svar på ny färg':
  höj med fyra · 6+ egen · 5+ andra · sang med jämn hand · preferens 3+ ·
  sang), svararens placering i raden svar3 ('2/1: placerar utgång': 4M i
  höjd egen högfärg / 4M mot öppnarens 6+ / 3NT); betydelselagret
  `isFourthSuit` undantar 2/1 och `openerThirdAfter2over1` läser
  öppnarens svar (förr tom regel → adaptern tystnade). Registret: två nya
  regler. Systembok §5.3 (stycket "ny färg i rond 2" + öppnarens svar), §6.6
  (undantaget 2/1 förklarat), §9.
  **Mätningar** (kommandon i §3; baslinjer på `f7d5c72`): hela sviten grön
  (`npm test`), `npx tsc` rent; auktionsdiffen 3000 givar: ÄNDRAT BUD 4 — a: frön 20270257/20270477 (den nya
  färgen visas naturligt i stället för preferens/höjning på dubbelton, samma
  4♥); b: 20270497 (3NT i stället för 4♥ på 6-1 efter preferens på singel),
  20272636 (svararen placerar 3NT i stället för det gamla lagrets 5♦);
  avvikelsedumpen: 25 ändrade — 7 a, 18 b, 0 c (naturlig ny färg i stället
  för preferens/höjning; öppnarens svar ur tabellen; svararens placering där
  det gamla lagret passade 2NT, rebjöd 4-korts högfärg eller hittade på 5m); olagliga tabellbud 0;
  betydelsesvepet kravnivå 0 · alert 0 · registerhål 0; pliktsvep/
  förklaringssvep/regelsvep gröna; revisorn 1000 givar: rätt kontrakt 20,2 % · snittförlust 269,55 (beslut 2: 20,2 % · 268,83). Skillnaden är EN giv (auktionsdiffen på revisorns frön 20260721–20261720 mot stash-baslinjen): frö 20261274, 1♦–2♣–2♦–2♠–3♦ — svararen (♠KJ73 ♥A83 ♦8 ♣KQJ52) placerar nu 3NT (regeln: partnern rebjöd sin lågfärg, ingen fit) där det gamla lagret rebjöd 4♣ → 5♣; systemriktig placering, facit-tabellen straffar den på just den given (bud = systemriktighet, inte poäng på enskild giv).
- **2026-09-06 — §5b beslut 2 KLAR & LIVE 2026-09-07 (fjärde färg gäller även efter reverse;
  mergepunkt `f7d5c72`, Actions grön, rebidz.com aliasad).** Test-drivet: facit-blocket "§5b beslut 2" i
  `motorbyte-facit.test.ts` (tre fall; två röda före fixen — svararens 3♣ och
  betydelselagrets läsning var redan rätt, öppnarens svar saknades). Regeln i
  det nya lagret: `openerAnswerFourthSuit` tar nivån (2 i grundmönstret, 3
  efter reverse) och `openerThirdDecision` dispatchar även reverse-mönstret;
  betydelselagrets `isFourthSuit`-kommentar rättad. Systembok §6.6 (undantaget
  "öppnaren har reverserat" borttaget, exempel + öppnarens svar) + §9.
  **Mätningar** (kommandon i §3; baslinjer på `0b1f056`): hela sviten grön
  (`npm test`), `npx tsc` rent; auktionsdiffen 3000 givar: ÄNDRAT BUD 0 (bot
  mot bot bjöd redan så); avvikelsedumpen: 2 ändrade, båda b — människans
  fjärde färg efter reverse (1♣–1♠–2♦–3♥) besvaras nu ur tabellen: frö
  20270080 3♠ (3-stöd) → 4♠ i stället för 4♣-rebud, frö 20270156 3NT (håll)
  i stället för 4♣ → 5♣; olagliga tabellbud 0; betydelsesvepet kravnivå 0 ·
  alert 0 · registerhål 0; pliktsvep/förklaringssvep/regelsvep gröna;
  revisorn 1000 givar: rätt kontrakt 20,2 % · snittförlust 268,83 (beslut 14: 20,2 % · 268,83).
- **2026-09-06 — §5b beslut 14 KLAR & LIVE (naket 4NT = essfråga i senast bjudna
  färg; mergepunkt `4be2ba3`, Actions grön, rebidz.com aliasad).** Test-drivet: facit-blocket "§5b beslut 14" i
  `motorbyte-facit.test.ts` (fyra fall; fynd 14-posten ersatt), det gamla
  facitet "20261372: 4NT med egen färg som trumf" omskrivet (4♣ naturligt;
  hela auktionen till 6♣ = `it.todo` för 2♣-linjens svar3-rad). Regeln i
  det nya lagret: `slamTrumpFromAuction` (reverse/hoppskift + 4NT →
  reversens färg; öppnaren svarar ur tabellen), `responderSecondDecision`
  (fit i öppnarens första färg → bara inbjudan, `SlamContext.inviteOnly`;
  2♣-grenens "egen solid färg → 4NT" borttagen), betydelselagret
  (`askTrumpFallback` i stället för frågarens egen färg). Systembok §6.1
  (regeln), §4.4 ("utan trumf"-stycket omskrivet), §9.
  **Mätningar** (kommandon i §3; baslinjer på `cdf37d5`): hela sviten grön
  (`npm test`), `npx tsc` rent; auktionsdiffen 3000 givar: ÄNDRAT BUD 1 —
  b: frö 20271008 (Syd ♠KQJ972 rebjuder 3♠ i stället för naket 4NT som
  öppnaren läste i hjärter; fortsättningen 4♥ på 6-1 kommer ur det gamla
  lagret, se hålet nedan — förr 6♠ av en slump: kaptenen placerade för
  spader på ett hjärtersvar); avvikelsedumpen: 15 ändrade, alla b (10 ×
  egen solid färg efter 2♣ rebjuds i stället för 4NT, 2 × 6NT direkt över
  3NT-återbudet, 3 × kaptenen fullföljer människans 4NT efter reverse/
  hoppskift i reversens färg — förr pass utan regel); olagliga tabellbud 0;
  betydelsesvepet kravnivå 0 · alert 0 · registerhål 0; pliktsvep/
  förklaringssvep/regelsvep gröna; revisorn 1000 givar: rätt kontrakt 20,2 % · snittförlust 268,83 (beslut 7: 20,2 % · 268,83). **Ett utkast förkastades**
  (fyra gamla tester röda, frö 20271425 tappade 6♥): slamporten i öppnarens
  första färg efter reverse/hoppskift togs bort helt, fast inbjudningsbudet
  där är otvetydigt — bara det nakna 4NT ska bort. **Känt hål (gamla lagret,
  etapp 4-kandidat, samma som beslut 7:s):** 2♣-linjens svar3/tredje-rader —
  efter svararens naturliga rebud rebjuder öppnaren sin färg och svararen
  passar utgången (frö 20271008 → 4♥ på 6-1; 20261372 → 4♥ i stället för
  6♣). Slammen med egen solid färg efter 2♣ hittas alltså inte förrän den
  raden byggs.
- **2026-09-06 — §5b beslut 7 KLAR & LIVE (4♦ naturligt efter 2♣–3♦–3M; kontrollbud i
  ny färg sätter öppnarens högfärg; mergepunkt `820ab71`, Actions grön, rebidz.com aliasad).** Test-drivet:
  facit-blocket "§5b beslut 7" i `motorbyte-facit.test.ts` (nio fall, sex röda
  före fixen; fynd 7-posten `it.todo` → `it`). Regeln i det nya lagret:
  `slamContextFor` 2♣-grenen (`SlamContext.noCueIn` = kaptenens egen färg,
  cue-golv 3NT även i högfärgslinjen, ingen 5M-inbjudan efter öppnarens egen
  högfärg), `responderSecondDecision` (fast arrival 4M utan cue; utan stöd:
  rebud 6+ / 5 med korthet / bra 5 i annat än 5-3-3-2 → ny färg under 3NT →
  3NT), `openerThirdDecision` (öppnaren rättar partnerns 3NT till 4M med 6+ —
  'rättelse till högfärg'), `slamTrumpFromAuction` (cue-läsningen kräver
  4-läget efter färgpositivt). Betydelselagret: `impliedCueTrump` tar aldrig
  egen visad färg som cue (2♣–3♦–3M–4♦ = '2♣: rebud egen färg (GF)'), det
  trumfsättande kontrollbudet sätter `agreed` så öppnarens cue i svararens färg
  läses som cue (2♣–3♦–3♥–4♣–4♦). Registret: '2♣: rebud egen färg (GF)',
  'rättelse till högfärg'. Systembok §4.4 (tre stycken) + §9.
  **Mätningar** (kommandon i §3; baslinjer på `148d170`): hela sviten grön
  (`npm test`), `npx tsc` rent; auktionsdiffen 3000 givar: ÄNDRAT BUD 4 — b:
  frö 20271411 (ägarens exempel, 4♠ direkt i stället för cue 4♦), 20271024
  (3NT i stället för 4♣ → 4♥ på 5-2), 20272253 (öppnaren rättar 3NT till 4♥
  med sex hjärter, förr pass); a: 20271242 (samma 4♠ via 3NT + rättelse);
  avvikelsedumpen: 27 ändrade — 17 b, 10 a, 0 c (grupperna: 3NT/rättelse 12,
  kontrollbud i ny färg 6, 4NT med 33+ 5, fast arrival 1, lågfärgsinbjudan 1,
  finaste färgen 2); olagliga tabellbud 0; betydelsesvepet kravnivå 0 · alert 0
  (förr 4) · registerhål 0; pliktsvep/förklaringssvep/regelsvep gröna;
  revisorn 1000 givar: rätt kontrakt 20,2 % · snittförlust 268,83 (identiskt med beslut 1 och 3). **Två utkast förkastades på diffen** (c-fall): "bra 5" utan
  formkrav skickade 5-3-3-2-händer förbi 3NT (4♦ → 5♦), 3NT bjöds med singel i
  partnerns färg, och 2♣-öppnaren passade partnerns 3NT med sex spader —
  rättelseregeln i raden tredje kom därav. **Känt hål kvar (gamla lagret,
  etapp 4-kandidat):** svararens tredje bud i 2♣-linjen (honorForce rebjuder
  en 5-kortsfärg på 4-läget med singel i partnerns 6-kortsfärg, frön
  20270462/20271752 → 4♥ på 5-0/5-2 i stället för 4♠).
- **2026-09-06 — §5b beslut 3 KLAR & LIVE (fast arrival efter reverse i högfärg;
  mergepunkt `1a6adf0`, Actions grön, rebidz.com aliasad; ägaren bekräftade 4+ stöd).** Test-drivet: facit-blocket "§5b beslut 3" i
  `motorbyte-facit.test.ts` (nio fall, röda före fixen). Regeln i det nya
  lagret: `fourthSuit` (3M = 12+ stödpoäng/4+ stöd, annars 4M),
  `responderSecondDecision` (ingen slamport direkt över högfärgsreversen),
  `slamSituation` prefix 4 med `SlamSetup.partnerStarts` — öppnaren öppnar
  cue-ronden (`partnerFirstStep`: billigaste kontroll under utgång, annars
  4M; `cuePhaseTurn` tar partnern som startare; avslutar öppnaren direkt i
  4M fortsätter kaptenen som över en utgångsplacering: 4NT 33+, 5M 31–32).
  Betydelselagret: `reverseMajorRaise` — 3M 'reverse: höjning (stark)'
  (utgångskrav), 4M 'reverse: utgång', utgångskrav i `gameForced`, och
  4-lägesbud i EGEN färg läses som kontrollbud i det läget (både
  `naturalSuits` och slamzonens cue-läsare). Registret i `rules.ts`.
  Systembok §6.6 (undantag a omskrivet), §5 (slamporten efter reverse),
  §9. **Mätningar** (kommandon i §3; baslinjer på `b86d004`): hela sviten
  grön (`npm test`), `npx tsc` rent; auktionsdiffen 3000 givar: ÄNDRAT BUD
  1, klass b (frö 20272351 — fynd 14:s nakna 4NT efter reverse — går nu
  3♥ → 3♠ → 4♣ → 4♦ → 4NT → 6♥); avvikelsedumpen: 1 ändrad, klass b (frö
  20270106: människans 1♠, botens 3♥ passades förr av öppnaren, nu cue 3♠
  → 4♥); olagliga tabellbud 0; betydelsesvepet kravnivå 0 · alert 4
  (oförändrat) · registerhål 0; pliktsvep/förklaringssvep/regelsvep gröna;
  revisorn 1000 givar: rätt kontrakt 20,2 % · snittförlust 268,83
  (identiskt med beslut 1). **Öppen ägarfråga:** beslutstexten säger "3+
  stöd", bygget kräver 4+ (reversens färg är 4 kort; 4-3 är ingen trumf).
  Kvar: fynd 14:s facit i kön blir `it` vid beslut 14 (4NT-läsningen).
- **2026-09-05 — §5b beslut 1 KLAR & LIVE (Gerber/NMF över 1NT-återbudet; mergepunkt
  `3491ece`, Actions grön, rebidz.com aliasad).** Test-drivet: facit-blocket "§5b beslut 1" i
  `motorbyte-facit.test.ts` (sju fall, röda före fixen) + omskrivna facit i
  `auction-decide.test.ts`, `auction-slam-1nt-rebid.test.ts`,
  `new-minor-forcing.test.ts`. Regeln i det nya lagret: `newMinorForcingBid`
  (5+ i öppnarens lågfärg + 19 hp = `NMF_SLAM_ZONE_HP` går NMF),
  `responderPlaceAfterNMF` (6+ högfärg → 4M), `responderThirdDecision` (3M /
  3m med slamvärden), `openerFourthDecision` (4M "NMF: trumfen satt" /
  `openerAfterDelayedMinorSupport(…, 'NMF')`), `slamSituation` prefix 7
  (kaptenen räknar hp mot 12; lågfärg: cue-golv 3NT, inbjudan 4m över 3NT);
  bortrivet: `familyAFitTrump`, Gerbers `placeSuit`, 1NT-grenarna i
  `slamContextFor`/`slamTrumpFromAuction`, `gerberRebidInvestigation`.
  Betydelselagret: `nmfSuitShown`/`afterNMFSuitShow` (3M/3m/4M/3NT/4m med
  kravnivå i `rules.ts`), 5M direkt över 1NT-återbudet = till spel. Systembok
  §5.7 (Krav, Din placering, Färgvisning med slamvärden, Slam efter
  1NT-återbudet), §6.4, §9. **Mätningar** (kommandon i §3; baslinjer tagna på
  `81ca5eb`): hela sviten grön (`npm test`), `npx tsc` rent; auktionsdiffen
  3000 givar: ÄNDRAT BUD 4, alla klass b (frö 20270949 via NMF till samma 6♥;
  20272165/20272519/20272533: 6-korts högfärg → 4♠ i stället för 3NT);
  avvikelsedumpen: 12 ändrade — 7 × människans 4♦ över 1♦–1M–1NT (förr
  ruterinbjudan, nu "pass (ingen regel)": budet finns inte i systemet, klass
  b med känt hål) + 5 × botens 4M i stället för 3NT (klass b); olagliga
  tabellbud 0; betydelsesvepet: kravnivå 0, alert 4 (oförändrat), registerhål
  0 efter `rules.ts`-posterna; pliktsvep/förklaringssvep/regelsvep gröna;
  revisorn 1000 givar: rätt kontrakt 20,2 % · snittförlust 268,83 (familj 6:
  20,3 % · 268,55) — frö 20260897 (4♥ i stället för 3NT) och frö 20261109
  (5♣ efter cue-ronden, 6♣ satt men Nord blott minimum — systemriktig miss;
  ägaren godkände i grinden). Kända hål till SENARE: människans direkta 4♦/5M
  över 1NT-återbudet saknar regel (boten passar); 5-korts högfärg + 21 hp utan
  fit efter NMF placerar 3NT.
- **2026-09-05 — Etapp 3 familj 6 KLAR & LIVE (mergepunkt `f05bfef`; grinden
  godkänd av ägaren samma dag inkl. §5.7-regeländringen, och grinden efter
  etapp 3 togs med deployen): manuset för ostörda auktioner rivet.** `buildAuctionCore` i `auction.ts` består nu av öppningen
  (tabellen, som förut), den modellerade konkurrensronden (oförändrad, etapp 4)
  och EN loop: fråga beslutstabellen stol för stol (`decideFromTable`, egen
  hand + auktionen), motståndarna passar, tills tabellen tiger eller någon
  passar. Adapterkedjan (`hittills`/`f2`…`f5`), de två Gerber-blocken och
  tvåhandsförarna för slamsekvenserna är borta (`git diff --stat` mot
  `c4f486f`; filen 706 → 608 rader). Manuset avgör INGA bud i ostörda
  auktioner längre — vakt: `auction-decide.test.ts` "familj 6" (3000
  botauktioner, ingen källa `manus` från vår sida när motståndarna bara
  passat). Det enda manuset tillför är `open`-flaggan; reglerna är de rivna
  grenarnas, återskapade exakt (sond över 3000 frön före rivningen: bara ÖPPNA
  linjer får detektorbud efter linjens slut, stängda bara pass): slamraden har
  bjudit och tiger → stängd; pass eller partnerns `avslut`-bud → stängd (nytt
  fält `DecidedCall.avslut`, satt av raden svar2 för manusets gamla
  `final`-plan: 2♣-utgångsplaceringen, 6NT-avslutet, 2/1-utgången); vår sidas
  2:a–4:e tur utan regel → öppen; 5:e tur utan regel → öppen bara efter fjärde
  färg/NMF; därefter stängd. Lärdom: `slamSituation(f) !== null` duger inte som
  "sekvens pågår" (läser trumf även när 3NT var 'till spel' → två auktioner
  bytte `open`, frö 20271779/20271997) — källan `tabell:slam` är rätt signal.
  `buildAuction` blir hjälparen "spela ut fyra stolar" först när
  konkurrensronden flyttat (etapp 4): det gamla lagret behöver linjen för
  `offBook`/`lineExhaustedOpen`, och en `decideCall`-baserad `buildAuction`
  vore rekursiv.
  **Rivningen avslöjade tre kikhål som lagades i det nya lagret:** (1) den
  2♣-positiva slamgrenen — `slamTrumpFromAuction` läser nu **4NT efter
  2♣–positivt–3y som essfrågan i y** (senast bjudna färg = det gamla lagrets
  `slamAskTrump`-regel), **slaminbjudan i y** (5M / 4m över 3m — hittad av
  revisorn: frö 20261494, 2♣–2NT–3♠–5♠ passades tills öppnaren fick döma ur
  tabellen) och **ett kontrollbud i ny färg som sätter y**
  (betydelselagrets konvention från etapp 1: den balanserade 2NT-svararen
  cue:ar från 3-läget, efter färgpositivt bara högfärgen; rebud i egen färg
  förblir naturligt, fynd 7); förut svarade manuset med kaptenens hand som
  facit (frö 20271008: 5♥ "för spader" → nu 5♦ = tre nyckelkort i hjärter,
  kaptenen placerar ändå 6♠ ur sin egen avsikt — fynd 14-bevis). (2)
  **Kaptenens egen avsikt när trumfen är oläsbar** (`captainOwnSituation`):
  reverse–4NT (frö 20272351) placeras nu av kaptenen själv; förut spelade
  manuset. (3) **4NT direkt över 1NT-återbudet var två bud i ett** (fynd 6):
  kvantitativ inbjudan (jämn 19–20) OCH RKC för en egen självbärande färg —
  bara manuset kunde hålla isär dem, och båda facit-testerna i
  `auction-slam-1nt-rebid.test.ts` föll utan kik. **Regeländring (§5.7,
  systembokens §9):** 4NT direkt över sang-återbudet är alltid kvantitativt
  (standard-2/1; öppnaren dömer på sin hand, raden slam `kind: 'kvantitativ'`),
  och kaptenen med egen självbärande färg frågar med **Gerber 4♣** och placerar
  6 i färgen (`gerberTurn(…, placeSuit)`; öppnaren svarar ess och passar
  placeringen utan att behöva veta färgen). Betydelselagret följer med
  (`ownSuitOverNTRebid` borttagen; 4NT över partnerns sang-återbud förklaras
  kvantitativt). Facit: `auction-decide.test.ts` "familj 6" (kvantitativ
  accept/avböj, Gerber → 6♠ / stopp 5♠, öppnarens ess-svar och pass).
  **Auktionsdiffen** (kommandot i §3, baslinje `c4f486f` = familj 5-koden):
  3000 givar, ÄNDRAT BUD 3 — alla klass b: frö 20271008 (ovan), 20271809 och
  20272312 (2♣–2NT–3♦–4♣: öppnaren cue:ar 4♥ och paret når 6♦ resp. stannar i
  5♦ där honorForce förut improviserade 4♦); samma bud med annan källa 17 (de
  sista manusbuden i ostörda auktioner → `tabell:slam`, två motståndarpass →
  `pass (ingen regel)`). **Avvikelsedumpen** (kommandot i §3, fyra lägen):
  ÄNDRAT BUD 100, 0 olagliga — 94 är slamsekvenser som nu fullföljs efter
  MÄNNISKANS 2♣ (förut `pass (ingen regel)` mitt i sekvensen: nyckelkortssvar,
  placeringar, cue-ronden; mönstren: slamavslut 47, cue: avslut 14, 1430 RKC
  14, cue-bid 13, RKC: stopp 5, Sjöberg 1), 4 är öppnarens 6NT-accept på
  människans kvantitativa 4NT över 1NT-återbudet, 2 är öppnarens dom på
  människans slaminbjudan 5M efter 2♣. **Kikvaktens mätläge**
  (kommandot i §3): 2898 bud, 131 byter (4,5 %) — alla ur källan `manus`, dvs.
  konkurrensronden (etapp 4); varje `tabell:*`-källa 0 byten. Frekvensbilden:
  `tabell:slam` 61 → 117 bud, `manus` 7320 → 7266 (`auktionsdump-frekvens.txt`).
  **Sveparna** (kommandona i §3): betydelse ostört 0/4/0 (samma kända mönster
  som familj 5, frö 20271084), kända 37 bud i 2 mönster; förklaring 0 utan
  förklaring, 0 gissningar; regelsvep 0 oändliga; pliktsvep 0 auktionsfel,
  identiskt med baslinjen. Hela sviten grön (`npm test`), `npx tsc` rent.
  **Revisorn** (kommandot i §3, 1000 givar, frö 20260721): rätt kontrakt
  20,3 % · snittförlust 268,75 — identiskt med familj 5 (auktionsdiff på
  revisorns frön 20260721–20261720 mot baslinjen ur `git stash`: ÄNDRAT BUD 0;
  före inbjudningsfixet var det 1 giv, frö 20261494, och 269,44).
  🚪 **Grindbeslut för ägaren:** (a) familj 6:s b-lista ovan; (b) §5.7-
  regeländringen (Gerber i stället för 4NT för den självbärande färgen) — kan
  vändas till "kaptenen sätter trumfen via NMF först" om ägaren hellre vill det
  (fynd 14:s riktning); (c) grinden efter etapp 3: deploya?
- **2026-09-05 — Etapp 3 familj 5 KLAR: slamutredningen per stol + svararens
  tredje bud.** Varje tur i en slamsekvens tas nu ur EN hand + auktionen:
  `slam-auction.ts` fick stegmaskinen `slamTurn(role, hand, setup, sofar)`
  (kaptenens första steg → cue-ronden → 4NT → svar → placering → 5NT →
  kungsvar → storslam; stoppbudet + partnerns rättelse; inbjudan + partnerns
  dom), `exclusionTurn`, `mssTurn`; `nt-slam.ts` fick `gerberTurn` (ess-svar,
  placering, kungfråga, kungsvar, 6NT/7NT; partnern passar uttryckligen på
  kaptenens placering så 4NT-stoppet aldrig läses som essfråga). De gamla
  sekvensfunktionerna (`slamInvestigation`, `exclusionInvestigation`,
  `mssMinorFitContinuation`, `gerberInvestigation` …) är tunna FÖRARE som
  spelar stegfunktionen växelvis med de två händerna — manuset härleds ur
  besluten, och `auction-decide.test.ts` vaktar att varje `tabell:slam`-bud i
  3000 botauktioner är manusets bud. Raden *slam* i `auction-decide.ts`:
  `slamSituation(facts)` läser sekvensen ur AUKTIONEN ensam (ostört, kaptenens
  första slambud finns): uppsättningen `SlamSetup` (trumf, `SlamContext` ur
  `slamContextFor`/`slamContextAfterThird` — samma funktioner som kaptenens
  första steg, så manus och bord räknar mot samma visade minimum). Trumfen ur
  auktionen där den är entydig (Jacoby, inverterad, hopphöjning, hopp i egen
  minor, 2♣ med stöd, försenat stöd, NMF-stöd, MSS, Exclusion) eller namngiven
  av inbjudningsbudet; kaptenen spelar upp sitt eget beslut på prefixet
  (`captainIntent`) och får sin egen avsikt. Raden *svar3*
  (`responderThirdDecision`): slamsekvensens första steg efter 2/1-försenat
  stöd och NMF-stöd, placeringarna efter NMF (`responderPlaceAfterNMF`), fjärde
  färg (bara över öppnarens bud), inverterad broms, 2NT-checkback, och systems
  on-placeringen efter 2♣–2♦–2NT. Raden *fjärde* (`openerFourthDecision`):
  Smolen-valet / 3NT-erbjudandet efter 2♣–2♦–2NT (`openerChoosesAfterSystemsOn`
  i `strong-2nt-systemson.ts`, som också avgör öppnarens tredje bud efter en
  2NT-ÖPPNING — förr saknades Smolen-valet där helt). `strong2NTSystemsOn`
  (två händer) är borta: sekvensen går genom raderna tredje/svar3/fjärde.
  Adaptern `thirdAsSeen` ger tom regel när läsaren inte namnger budet (de
  tredje buden dispatchar på nivå/färg). **Fem systemfel som bygget avslöjade,
  alla lagade som regler (facit i `auction-decide.test.ts`):** (1) NMF-slam-
  grenen körde cue-ronden även för 11–12-handen (inbjudan) — cue-bud är gratis
  bara i utgångskrav → 13+; (2) 5m efter partnerns 4m var både utgång och
  "slaminbjudan" (2♣ med minorfit, försenat stöd) — partnern kan inte skilja
  dem → ingen inbjudan där; (3) 1♣–1♠–1NT–4♣ var både Gerber (§6.4) och familj
  A:s klöverinbjudan (§5.7 "4m") → Gerber vinner, ingen klöverinbjudan (fynd
  15 nedan); (4) läsaren kallade 4♣ Gerber även med satt trumf (1♣–2♣–2NT–4♣)
  → bara utan trumf; (5) Gerber-stoppet 4NT lästes av det gamla lagret som
  RKC (frö 20270139, facit skarp). **Tiger medvetet (det gamla lagret som
  förut):** ett naket 4NT utan bjuden fit efter reverse/hoppskift, 2♣ med
  öppnarens egen färg (etapp 1-fynd 7: kravvaktens naturliga rebud och manusets
  cue är samma bud) och 1NT-återbudet (fynd 6) — bok-mot-motor-fynd 14
  (`it.todo` i kön). **Auktionsdiffen** (kommandot i §3, baslinje `72eb60c` =
  `4a14bca`-koden): 3000 givar, ÄNDRAT BUD 1 = frö 20270930 (NMF med 3-stöd:
  kaptenen cue:ar 4♥ i stället för att placera 4♠ direkt — samma kontrakt,
  klass b: manuset byggde förr cue-ronden och KASTADE den när den inte nådde
  slam, ett kik), samma bud med annan källa 96 (manus → tabell:slam/svar3/
  tredje/fjärde). **Avvikelsedumpen** (kommandot i §3, fyra lägen, 14029
  auktioner): ÄNDRAT BUD 353 i 189 mönster, 0 olagliga; alla klass b — förr
  passades nyckelkortssvaret (2♣–3♦–4♦–4NT–5♦: pass → 6♦, frö 20270017,
  facit skarp), Gerber-svaret (1NT–4♣–4♠: pass → 6NT, frö 20270043), cue-
  buden fick kravvaktens 5♣ i stället för ett cue-svar (2♣–2♠–3♠–4♣: 5♣ → 4♠),
  Stayman efter 2♣–2♦–2NT fick gisslagrets 3NT (→ 3♥), Smolen efter 2NT
  passades. Mönstren i `revisor-output/avvik-monster.txt` (skapas av
  `node`-raden i sessionen; återskapas ur de två JSON-filerna). **Kikvaktens
  mätläge** (kommandot i §3): 2898 bud, 132 byter (4,6 %); `tabell:slam`
  2/0, `tabell:svar3` 5/0, `tabell:tredje` 16/0 — den skarpa kikvakten
  prövar varje tabellbud. **Sveparna** (kommandona i §3): betydelse ostört
  0/3/0 (registerhålet 'väljer utgång efter Smolen' lagat i `rules.ts`), kända
  39 bud i 2 mönster; förklaring 0 utan förklaring; regelsvep grönt;
  pliktsvep 0 auktionsfel. Hela sviten grön (`npm test`), `npx tsc` rent.
  **Revisorn** (kommandot i §3, 1000 givar, frö 20260721): rätt kontrakt
  20,3 % · snittförlust 268,75 (familj 4b: 20,4 % · 268,05) — marginellt sämre,
  och skillnaden är TVÅ givar i revisorns urval (auktionsdiff på fröna
  20260721–20261720, baslinje ur git stash: ÄNDRAT BUD 2): frö 20261109
  (1♣–1♠–1NT–4♣: manuset lät öppnaren acceptera en klöverinbjudan till 6♣,
  nu är 4♣ Gerber — systemriktig miss, fynd 15) och frö 20260963 (2NT–3♣–3♦–
  3♥ Smolen: öppnaren väljer nu 4♠ med 3-korts stöd i stället för
  gisslagrets 3NT). Båda klass b; ägaren dömer i grinden.
  **Bok-mot-motor-fynd (ägarbeslut):** (14) naket 4NT utan bjuden fit
  (1♦–1♠–2♥–4NT, 2♣–3♦–3♥–4NT, 1m–1M–1NT–4NT): vilken färg är trumf? —
  kaptenen bör sätta trumfen (eller inbjuda i den) före essfrågan; (15) §5.7
  säger "inbjudan 4m" efter 1NT-återbudet men §6.4 gör 4♣ till Gerber —
  klöverinbjudan finns inte; boken behöver välja. (16) 5m efter partnerns 4m:
  ingen inbjudningsväg finns i minorfit (4NT är essfrågan) — motorn driver
  33+ och placerar utgång annars.

- **2026-09-05 — Etapp 3 familj 4b KLAR: öppnarens tredje bud.** Raden
  *tredje* i `auction-decide.ts` (läget: vår sidas fyra kontraktsbud öppning–
  svar–återbud–svararens andra bud, motståndarna bara pass, ingen X, partnerns
  andra bud senast) → `openerThirdDecision` = manusets grenar i samma ordning:
  2/1 försenat stöd (`openerAfterDelayedMinorSupport`) · NMF (`openerAnswerNMF`)
  · fjärde färg (`openerAnswerFourthSuit`, bara bokens mönster: tre 1-lägesbud
  och fjärde färgen billigast på 2-läget) · 1NT-auktionens inbjudan
  (`openerThirdBidIn1NTAuction`) · semi-forcing 1NT (`openerThirdBidAfter
  SemiForcing1NT`) · egen höjning + 3M-inbjudan (`openerThirdBidAfterOwnRaise`)
  · inverterad broms (`openerThirdBidAfterInvertedBrake`) · reverse + preferens
  (`openerThirdBidAfterReverse`) · 2NT-checkback och 5-3-jakt. Partnerns andra
  bud läses med adaptern `secondAsSeen` (nakna auktionen; enda översättningen:
  'inbjudan (limithöjning)' → 'inbjudan' efter 1M–1NT–2M), mitt eget återbud
  med `rebidAsSeen`. Manuset (`auction.ts`) läser samma beslut och bygger bara
  fortsättningarna som behöver svararens hand (placeringen efter checkback,
  bromsens fjärde bud) eller båda händerna (försenat stöds slam, NMF-slam —
  familj 5). Skarpt adaptersvep i `auction-decide.test.ts`: 3000 botauktioner,
  bara DISPATCH-namnen jämförs (terminala 'till spel'/'utgång'-namn får skilja).
  Regelnamnssvepet före (sond, 3000 frön): svararens andra bud 816, 480 samma
  namn, 134 mönster, nästan alla terminala. **Läsaren rättad på tre ställen**
  (hål som svepet/dumpen visade): svararens egen färg på 2-läget efter 1M–1NT–2x
  (`responderNewSuitAfter1NT`) saknade regelnamn ('ny färg efter 1NT' — utan
  det passade öppnaren inte längre 1♥–1NT–2♣–2♦, frö 20272049); 3NT över
  2NT-Stayman/-transfer lästes som inbjudan (L + 1 = 3); försenat stöd lästes
  även för ett hopp till 4m (1♦–2♣–2NT–4♦ → öppnarens 3NT var OLAGLIGT →
  pass), nu bara 3m. Avvikelsedumpen fick det fjärde läget *svar2* (§3);
  baslinjen togs om med den nya proben på `45fa322`-koden.
  **Auktionsdiffen** (baslinje `45fa322`): 3000 givar, ÄNDRAT BUD 0, samma bud
  med annan källa 154 (manus → tabell:tredje, plus passen efter svararens
  andra bud som nu ligger i manuset). **Avvikelsedumpen** (14029 auktioner,
  fyra lägen): ÄNDRAT BUD 99 i 67 mönster, 0 olagliga; alla klass (b) —
  samma kunskapsfunktioner som manuset: öppnaren dömer nu inbjudningar
  (accepterar/avböjer: 1♠–1NT–2♠–3♠ → 4♠ med 15+ bergenpoäng, 1NT–2♦–2♥–2NT →
  3♥ preferens med minimum + fit) i stället för pass utan regel eller
  gisslagrets 3NT; svarar på checkback (1♣–1♠–2NT–3♣ → 3♥ med fyra hjärter),
  5-3-jakt (3NT utan 3-stöd), NMF; driver efter bromsen (1♦–2♦–2♠–3♦ → 5♦
  med 15+ och 3NT otäckt, B13); 2/1-försenat stöd → 3NT-förslag (frö 20270063:
  förr kravvaktens 4♣); reverse + preferens → 5♣ med 18+ (frö 20270156). I
  svar2-läget (1351 auktioner) tog tabellen öppnarens tredje bud i 85; resten
  är människans utgångsbud (öppnaren passar utan regel), kravvakten,
  gisslagret och RKC-detektorn — familj 5-läget. **Kikvaktens mätläge**: 2898
  bud, 134 byter (4,6 %, från 4,9 %); `tabell:tredje` 14/0. **Sveparna**
  identiska (betydelse ostört 0/3/0, kända 39 bud i 2 mönster; förklaring 0
  utan förklaring; regelsvep grönt). Frekvensbilden: manus 7354 bud,
  `tabell:tredje` 154. Hela sviten grön (`npm test`), `npx tsc` rent.
  **Bok-mot-motor-fynd (ägarbeslut vid familjen):** (11) svararens NYA färg på
  3-läget efter 1M–1NT–2x (t.ex. 1♠–1NT–2♠–3♥) — standard: inbjudan med 6+
  kort; motorn saknar regeln (läsaren namnger inte budet, kravvakten svarar
  "krav – rebjuder egen färg"); (12) svararens hopp till 4m efter 1m–2m'–2NT
  (1♦–2♣–2NT–4♦) saknar regel (kravvakten 5♦); (13) fjärde färg i 2/1-form
  (1♠–2♣–2♦–2♥): läsaren läser fjärde färg men svarsfunktionen är byggd för
  1-lägesmönstret — gamla lagret. **Känt hål till familj 5:** en BOT i
  svararstolen som bjudit checkback/NMF/fjärde färg ur tabellen (partnern
  människa) placerar inte efteråt — placeringarna bor i manuset och
  `nmfPlacementToAnswer`/`placeGameAfterFourthSuit`; kortfärgssvaren på
  splinter-reläet läses som cue-bud av slamzonen (familj 5:s läsare).
  **Revisorn** (kommandot i §3, 1000 givar, frö 20260721): rätt kontrakt 20,4 % · snittförlust 268,05 — identiskt med familj 4a (bot mot bot ändras inget; fel-färg-bet 117).
- **2026-09-05 — Etapp 3 familj 4a KLAR: svararens andra bud.** Raden *svar2*
  i `auction-decide.ts` (läget: vår sidas tre kontraktsbud öppning–mitt svar–
  partnerns återbud, motståndarna bara pass, ingen X) → `responderSecondDecision`
  = manusets grenar i samma ordning (systems on efter 2♣–2♦–2NT · 2♣-positivt
  · hopp i egen minor · hopphöjning · reverse/hoppskift · Jacoby/inverterad fit
  · splinter-relä → Exclusion · MSS · 1NT-återbudet → Gerber/familj A · sedan
  `responderSecondBid`), där VARJE slamgren ger kaptenens första steg ur egen
  hand + partnerns visade minimum: `slamCaptainFirstStep` (cue/4NT/inbjudan —
  `slamInvestigation` BÖRJAR nu med det steget, en port), `exclusionFirstStep`,
  `mssFirstStep`, `gerberRebidFirstStep`, `systemsOnFirstStep`. Beslutet bär en
  PLAN (`SecondPlan`) som manuset använder för att bygga resten av sekvensen
  med båda händerna tills familj 5. Adaptern `rebidAsSeen` läser öppnarens
  återbud ur den nakna auktionen och översätter läsarens namn till motorns
  kontextberoende (1-lägessvar / semi-forcing 1NT / 2♣); skarpt adaptersvep i
  `auction-decide.test.ts` (3000 botauktioner, tillåtna skillnader: 'oklart',
  'accepterar slaminbjudan'). Läsaren rättad på fem ställen: 2♣–2NT–3NT lästes
  som stöd (= 'rebid: 3NT (GF)'), hopphöjningen hette som hoppet i egen färg
  (= 'hopphöjning (inbjudan)'), 1M–1NT–2x/1m–1NT–3NT/splinter-signoff saknade
  regelnamn ('rebid: ny färg', 'rebid: 3NT', 'rebid: signoff'). Regelnamnssvepet
  före: öppnarens återbud 1133 bud, 845 samma namn, 61 mönster; svararens
  andra bud 816/482/135 (mest terminala 'till spel'-namn — 4b:s adapter).
  **Auktionsdiffen** (baslinje `b56a72f`): 3000 givar, ÄNDRAT BUD 7, samma bud
  med annan källa 1030 — alla klass (b): (i) öppnarens "oklart"-1NT (1m–1M–1NT)
  läses nu som 12–14 och §5.2-porten gäller: frö 20270949 → 5♥ slaminbjudan
  (20 hp + 6-korts ♥ mot 12–14) i stället för NMF; (ii) hp-räkningen i porten
  (nedan) tar bort fyra stödpoängsdrivna slambud över riktiga 1NT-återbud:
  frö 20271982/20272664 4NT → 3NT, frö 20272165/20272533 5♠ → NMF; (iii)
  öppnaren höjde svararens 2/1-högfärg under utgång → 4♥: frö 20270347 (förr
  3NT trots hjärterfit), 20270752 (förr 4♠). Före hp-fixen gav "oklart"-
  läsningen även frö 20272091 → 4NT med 12 hp 6-5 renons och frö 20272122 →
  5♠ slaminbjudan med 10 hp 6-5 som öppnaren accepterade till 6♠ (samma port
  som redan var live för vanliga 1NT-återbud). Porten
  räknade kaptenen med stödpoäng, men §5.2 säger hp mot det visade intervallet
  och det befintliga facitet frö 20261317 (2026-08-07, "ärligt mot visade
  intervall = 4♥") föll: **lagad som kunskapsmodulbugg** (`hpOnly` i
  `SlamContext`, facit frö 20272122 skarp i kön, budsystem §9). Efter fixen:
  20270949 → 5♥ slaminbjudan (20 hp mot 12–14), 20272091/20272122 → som förut.
  Dessutom lades fallet "öppnaren höjde min 2/1-högfärg under utgång → 4M"
  (felrapport #27, förr detektorn `answerTwoOverOneRaise`) in i beslutet;
  höjd lågfärg går som förut i `responderRebidIn2over1Auction`.
  **Avvikelsedumpen** (12678 auktioner): ÄNDRAT BUD 2127, nästan alla i svararens
  andra bud, 4 senare (fjärde färg får nu regel → placeringen 3NT), 0
  olagliga; typiskt: Ogust-signoff i stället för gissad 4M, 3NT till spel
  efter transfer i stället för 4M, Stayman efter 2♣–2♦–2NT i stället för 3NT,
  Drury-pass på öppnarens signoff, RKC/6NT efter 2♣-fit i stället för
  kravvaktens 5m/pass. **Kikvaktens mätläge**: 2898 bud, 141 byter (4,9 %, från
  7,2 %); `tabell:svar2` 100/0. Konsistenstest: `slamInvestigation[0]` ==
  `slamCaptainFirstStep` (400 slumpade lägen). **Sveparna** identiska (ostört
  0/3/0, kända 39 bud i 2 mönster; förklaring 0/0; regelsvep grönt). Hela sviten
  grön (`npm test`), `npx tsc` rent. **Revisorn** (kommandot i §3, 1000 givar,
  frö 20260721): rätt kontrakt 20,4 % · snittförlust 268,05 (baslinjen 20,3 %
  · 268,55 — inte sämre; fel-färg-bet 118 → 117).
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
