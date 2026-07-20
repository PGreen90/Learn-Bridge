# Systemrevisorn — mätverktyget för "hur nära perfekt är budgivningen?"

> **Status: FÖRBEREDD 2026-07-20, byggs i etapp 2 av spåret "budgivningen mot
> perfekt"** (se projektkartan i `CLAUDE.md`). Detta dokument är byggplanen så
> att nästa session kan börja koda direkt. Adresserar E3 (+ del av F2) i
> `docs/budsystem-revision.md`.

## Vad den ska svara på
1. **En siffra:** i hur stor andel av slumpade givar landar motorn i ett
   "rätt" slutkontrakt (mätt i poäng mot facit-optimum)?
2. **En topplista:** vilka MISSTYPER kostar mest poäng (missad utgång, för
   högt, fel färg, missad slam, såld giv i konkurrens ...)? Topplistan styr
   sedan prioriteringen av etapp 4.
3. **Omkörbarhet:** samma mätning ska kunna köras om efter varje förbättring
   så siffran kan följas över tid (det som saknades efter engångsproberna på
   40 000/60 000 givar — E3: "ingen kvarvarande probe-rigg i repot").

## Pipeline per giv (allt återanvänds, inget nytt motorarbete)
1. `dealRandom()` (`deal.ts`) — slumpa given (spara seed/handsträngar för repro).
2. **Bjud alla fyra händerna med motorn:** loopa `decideCall(deal, history, seat)`
   (`auction-live.ts`) från given tills `auctionComplete(history)`. OBS: alla
   fyra sätena är bottar här — det är MOTORNS auktion vi mäter, inklusive
   konkurrensen (§7-lagret kliver in själv via linjen/live-kedjan).
3. `contractFromCalls(history)` (`auction-contract.ts`) — slutkontraktet.
4. **DD-facit** (`dds.ts`):
   - stick i det NÅDDA kontraktet: `tryDoubleDummyDeclarerTricks` (budgeterad!)
   - optimum: `doubleDummyTricks(deal, strain, leader)` för de 5 strains ×
     relevanta spelförare → bästa görbara kontrakt/poäng per sida (förenklad
     par-beräkning; offringar/X-par kan v2:as).
5. **Poängsätt** båda med `scoring.ts` (zoner ur given) → poängtapp =
   |optimum − uppnått| för den sida som ägde given.
6. **Kategorisera** missen (regelbaserat på nivå/strain/sida): missad utgång /
   missad slam / för högt / fel strain / såld giv (motståndarna fick spela
   för billigt) / straff-miss.

## Körform (viktigt — deploygrinden!)
- **Får INTE ligga i `npm test`:** Vercel-grinden kör hela sviten vid varje
  push; en 1 000+-givars DD-körning skulle spränga bygget. Lägg riggen som en
  **miljövariabel-gated vitest-fil** (t.ex. `revisor.probe.test.ts` med
  `it.skipIf(!process.env.REVISOR)`) eller kör den direkt med
  `REVISOR=1 npx vitest run src/lib/engine/revisor.probe.test.ts`.
- **DD-budget:** använd `tryDoubleDummyDeclarerTricks(…, maxNodes)` och räkna
  bort för tunga givar (rapportera hur många som hoppades över) — mönstret
  från R3-fyndet (79/80 helgivs-lösningar sprängde 2M-nodbudgeten gäller FRÅN
  UTSPELET; rena 13-korts DD-lösningar från start är billigare, proberna på
  40–60k givar bevisar att det går).
- **Utdata:** sammanfattning i konsolen (missprocent + topplista) + en
  JSON-fil i en gitignorad katalog med exempelgivar per kategori (seed +
  parseHand-strängar + auktionen) så en miss kan bli facit-test på minuter.

## Acceptanskriterier för etapp 2
1. `REVISOR=1`-körning på 1 000 givar går igenom utan hängning (budget-skip
   räknas och redovisas).
2. Rapporten visar: totalt antal givar, andel "rätt kontrakt" (poängtapp 0),
   genomsnittligt poängtapp, topplista per misstyp med antal + exempel.
3. Dokumenterad körinstruktion här i filen + rad i §9-ändringsloggen.
4. En första riktig mätning körd och resultatet klistrat in i detta dokument
   som "Mätning #1 (baslinje)" — det är baslinjen alla framtida etapper mäts mot.

## Kända fällor (tänk på från start)
- **Ärliga missar är medvetna:** kaptensregeln missar slammar med vilje
  (hellre miss än kik). Revisorn ska RÄKNA dem men kategorin "missad slam"
  måste läsas med det ögat — jämför med slamfrekvensen (lillslam ~1/120).
- **DD ser alla kort:** tunna kontrakt som "går" på DD är inte alltid rätt
  bud. Titta på MÖNSTER (många givar), inte enskilda misstag.
- **Utpassade givar:** alla fyra passar ibland — det är ett giltigt resultat
  (jämför mot om någon sida hade ett görbart kontrakt = "såld öppning").
- **X/XX i poängen:** `contractFromCalls` bär dubblingar; scoring.ts hanterar
  dem — glöm inte att offringar MED X kan vara optimala (v1 får förenkla,
  men flagga kategorin).
