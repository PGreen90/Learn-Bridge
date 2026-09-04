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
- **Kikvakten** (*src/lib/engine/kikvakt.test.ts* (planerad fil), byggs i etapp 1): ett
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

- **Auktionsdiffen (byggs i etapp 0).** `auktionsdump.probe.test.ts` får ett
  intervall-läge som bjuder tusentals frön och skriver JSON. Ett diff-skript
  jämför två körningar och listar varje giv där auktionen ändrats, med
  regelnamn per bud. Baslinjen tas från mergepunkten före bytet (aldrig
  commitad, återskapas ur git):
  `$env:DUMP_RANGE='20270001-20273000'; npx vitest run src/lib/engine/auktionsdump.probe.test.ts`
  → `revisor-output/auktionsdump.json`. Varje ändrad giv klassas:
  **(a)** samma bud (borde vara majoriteten), **(b)** bättre enligt bokens
  paragraf (skrivs in i ändringsloggen med frö), **(c)** sämre = fel som lagas
  före merge. Inget mergas med en oklassad ändring.
- **Revisorn** (bud mot par): `$env:REVISOR='1'; npx vitest run
  src/lib/engine/revisor.probe.test.ts` (standard 1000 givar, frö 20260721).
  Får inte försämras mellan etapper. Baslinjen mäts i etapp 0 och skrivs i
  ändringsloggen med datum.
- **Riggarna** `pliktsvep.probe`, `forklaringssvep.probe`, `regelsvep.probe`
  körs efter varje familj (kommandon i respektive fil).
- **Betydelsesvepet (byggs i etapp 1):** för varje botbud ska den härledda
  betydelsen stämma med regeln motorn satte. Avvikelse = betydelselagret har
  ett hål, lagas innan familjen som behöver det byggs.
- **Kikvakten** från etapp 1 och framåt.
- **Facit-testerna** behålls allihop. De filer som anropar `buildAuction`
  direkt (`grep -l "buildAuction(" src/lib/engine/*.test.ts`) fortsätter
  fungera via hjälparen; de som testar manusets INTERNA form
  (`turns`/`role`) skrivs om till budföljder när deras familj flyttar.
- **Rollback per familj:** varje familj mergas med egen `--no-ff`-mergepunkt.

## 4. Etapperna

Varje etapp är testdriven som alltid (facit före fix). Ordningen är vald så att
motorn är körbar och deploybar efter VARJE familj — aldrig ett halvbyggt läge
som måste bli klart innan appen fungerar.

### Etapp 0 — baslinje och rigg (ingen motorändring)
- Auktionsdumpens intervall-läge + JSON-utdata + diff-skriptet
  (`scripts/auktionsdiff.mjs`: två JSON-filer in, ändrade givar ut med regel
  per bud).
- Baslinjer mätta och noterade i ändringsloggen: auktionsdump (frön enligt
  kommandot ovan) och revisorn.
- Pliktsvepets två rester (frö 20262632 · motståndarnas fortsättning efter
  våra höjningar, `docs/bevaka.md`) skrivs in som facit-fall i etapp 4:s
  familjer i stället för att lagas i det gamla lagret.
- **Klart när:** diff-skriptet visar noll skillnad mellan två körningar av
  samma kod, och baslinjerna står i loggen.

### Etapp 1 — betydelselagret (*src/lib/engine/auction-meaning.ts* (planerad fil))
- `meaningOf(history, index)` ger varje bud sin systembetydelse ur auktionen
  ensam. Startpunkt: `interpretCall`:s säkra gren + regelregistret i `rules.ts`
  (`forcingOf`, `isAlertRule`, `ruleInfo`). Bär budet en regel från motorn
  används den; saknas regel (människans bud) härleds betydelsen. Målet är att
  den härledda betydelsen alltid stämmer med regeln, så regeln blir en cache.
- `interpretCall` blir en tunn läsare av `meaningOf` (förklaringstexterna
  behålls oförändrade — förklaringssvepet vaktar).
- Betydelsesvepet (*auction-meaning.probe.test.ts* (planerad fil)) byggs och körs till noll
  avvikelser på botbud i ostörda auktioner. Störda auktioner får sitt svep i
  etapp 4.
- Kikvakten byggs (trivial för `interpretCall`, skarp för `decideCall` från
  etapp 3).
- **Klart när:** betydelsesvepet grönt på ostörda auktioner, auktionsdiffen
  noll (inget bud har ändrats — bara förklaringsvägen).

### Etapp 2 — faktalagret (*src/lib/engine/auction-facts.ts* (planerad fil))
- `auctionFacts(history, seat)` räknar auktionsläget ur betydelserna (listan i
  §2). Ersätter de spridda hjälparna i `auction-live.ts` (`auctionForce`,
  `competitionForce`, `agreedTrump`, `partnerLastSuit`, `opponentsHaveBid`,
  `openingBid`, `freeBidContext`, `strongDoubleContext` m.fl.) — en i taget,
  med auktionsdiffen noll efter varje byte.
- Detektorerna FÅR fakta i sin `DetectorCtx` och slutar re-skanna `history`.
  Inget bud ändras i etapp 2 — det är en ren flytt av var sanningen räknas.
- **Klart när:** auktionsdiffen noll, ingen detektor läser `history` direkt
  för det som fakta täcker.

### Etapp 3 — den ostörda linjen utan manus (familj för familj)
Detta är den stora etappen. Beslutstabellen (*src/lib/engine/auction-decide.ts* (planerad fil))
byggs upp familj för familj, och manusets motsvarande gren i `auction.ts`
rivs när familjen landat. Efter varje familj går alla auktioner genom
`decideCall` från första budet, med manuset kvar bara för de familjer som
inte flyttat än.

1. **Öppningen** — `classifyOpening` per stol med position 1–4 och zon
   (nästan färdig: manuset gör redan detta per stol).
2. **Svaret** — `respondToMajor`/`respondToMinor`/`respondTo1NT`/`respondTo2C`/
   svaga tvåor/spärrar/2NT/Drury, valt ur fakta (öppningsbud, passad hand).
3. **Öppnarens återbud** — `openerSecondBid` och syskonen i `rebids.ts`.
   Här byggs adaptern som ger dem svararens bud + regel ur betydelselagret i
   stället för det interna `ResponseResult`.
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
landat. Ordning efter hur ofta läget uppstår i auktionsdumpen (mäts i etapp 0):

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

- **2026-09-04** — planen skriven efter ägarens genomgång ("total genomgång,
  lös detta permanent"). Grind 0 tagen: motorbytet är NU, pliktsvepet pausat.
  Baslinjer mäts i etapp 0 (ännu inte körda).
