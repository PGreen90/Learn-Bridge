# Systemrevisorn — mätverktyget för "hur nära perfekt är budgivningen?"

> **Status: BYGGD 2026-07-21 (etapp 2 klar).** Riggen finns i
> `src/lib/engine/revisor.ts` (logik) + `revisor-dds.ts` (DD-orakel) +
> `revisor.probe.test.ts` (den gatade körningen); enhetstester i
> `revisor.test.ts` + `revisor-dds.test.ts` går i vanliga sviten. Baslinje-
> mätningen ("Mätning #1") ligger längst ned. Adresserar E3 (+ del av F2) i
> `docs/budsystem-revision.md`.

## Körinstruktion (så här körs en mätning om)
```
PowerShell:  $env:REVISOR='1'; npx vitest run src/lib/engine/revisor.probe.test.ts
Bash:        REVISOR=1 npx vitest run src/lib/engine/revisor.probe.test.ts
```
Valfria rattar: `REVISOR_DEALS` (antal givar, standard 1000) och `REVISOR_SEED`
(basfrö, standard 20260721 — **behåll det** så mätningar är jämförbara över
tid; samma frö = exakt samma givar). Rapporten skrivs till konsolen + JSON med
exempelgivar per kategori i `revisor-output/` (gitignorad). Ett exempels
`seed` + `dealFromSeed(seed)` (`revisor.ts`) återskapar given exakt → en miss
blir ett facit-test på minuter. 1 000 givar tar ~5 minuter.

## Viktig bygglärdom: DD-facit kräver den riktiga lösaren
Planens antagande att appens egen TS-lösare (`dds.ts`) skulle klara rena
13-korts helgivslösningar höll INTE: vid 2M-nodbudget sprängdes **samtliga**
provgivar (samma mönster som R3-fyndet), och en enda lösning tog ~3 s utan att
bli klar — × 11 lösningar × 1 000 givar = dygn. Lösning: npm-paketet
**`bridge-dds`** (Bo Haglunds riktiga C++-lösare kompilerad till WASM, rent
DEV-beroende — inget i den skeppade appen importerar det). `CalcDDTablePBN`
ger hela 20-tabellen (5 strains × 4 spelförare) på tiotals millisekunder, och
`DealerPar` ger på köpet **riktig par-poäng** (perfekt budgivning av alla
fyra, inkl. offringar och dubblingar) — bättre facit än planens förenklade
optimum. Adapterns konventioner (PBN-format, tabellindex, NS-orienterat
par-tecken) är låsta av `revisor-dds.test.ts`.

## Vad den ska svara på
1. **En siffra:** i hur stor andel av slumpade givar landar motorn i ett
   "rätt" slutkontrakt (mätt i poäng mot facit-optimum)?
2. **En topplista:** vilka MISSTYPER kostar mest poäng (missad utgång, för
   högt, fel färg, missad slam, såld giv i konkurrens ...)? Topplistan styr
   sedan prioriteringen av etapp 4.
3. **Omkörbarhet:** samma mätning ska kunna köras om efter varje förbättring
   så siffran kan följas över tid (det som saknades efter engångsproberna på
   40 000/60 000 givar — E3: "ingen kvarvarande probe-rigg i repot").

## Pipeline per giv (som byggd)
1. `dealFromSeed(baseSeed + i)` (`revisor.ts`) — deterministisk slump
   (mulberry32) så varje giv kan återskapas ur sitt frö.
2. **Bjud alla fyra händerna med motorn:** `botAuction` loopar
   `decideCall(deal, history, seat)` (`auction-live.ts`) tills
   `auctionComplete(history)`. OBS: alla fyra sätena är bottar — det är
   MOTORNS auktion vi mäter, inklusive konkurrensen (§7-lagret kliver in
   själv via linjen/live-kedjan). Skyddsgräns 60 bud (`skippedAuction`).
3. `contractFromCalls(history)` (`auction-contract.ts`) — slutkontraktet.
4. **DD-facit** (`revisor-dds.ts`, bridge-dds/WASM): `computeOracle` ger
   20-tabellen (stick per spelförare × strain) + riktig par-poäng
   (`DealerPar`, NS-orienterad).
5. **Poängsätt** det nådda kontraktet med `scoring.ts` (zoner ur given) →
   **poängtapp = |par − uppnått|** (X/XX i nådda kontraktet räknas med).
6. **Kategorisera** (regelbaserat i `judgeDeal`): vilken sida "äger" given =
   högst bästa görbara odubblade kontrakt ur tabellen; kategorierna nedan.

## Misstypskategorier
- `ratt` — poängtapp 0 (exakt par).
- `utpassad` — alla passade fast ett görbart kontrakt fanns.
- `missad-utgang` / `missad-lillslam` / `missad-storslam` — ägarsidan spelade
  hem men stannade under utgången/slammen som fanns.
- `for-hogt` — ägarsidan gick bet i rätt strain (för högt bjudet).
- `fel-farg-bet` — ägarsidan gick bet; facit fanns i en annan strain.
- `fel-strain` — hemspelat men poäng kvar (fel färg/nivå, t.ex. 420 i st.f. 430).
- `sald-giv` — motståndarsidan köpte och spelade hem.
- `billig-offring` — motståndarsidan gick bet men för billigt (straff saknades).
- `battre-an-facit` — ägarsidan fick MER än par → den ANDRA sidan felade
  (överbjöd till dyr offring, dubblade en hemgång, lät bli att offra). Riktiga
  motorfel de också — bara begångna av sidan utan given.

## Körform (viktigt — deploygrinden!)
- **Ligger INTE i `npm test`:** `revisor.probe.test.ts` har
  `it.skipIf(!process.env.REVISOR)` — i vanliga sviten (och Vercel-grinden)
  skippas den på millisekunder. Enhetstesterna (`revisor.test.ts` med fejkad
  DD-tabell + `revisor-dds.test.ts` med en trivial giv) körs alltid.
- **Utdata:** sammanfattning i konsolen (missprocent + topplista) + JSON i
  gitignorade `revisor-output/` (tidsstämplad fil + `latest.json`) med upp
  till 8 exempelgivar per kategori (seed + handsträngar + auktionen).

## Acceptanskriterier för etapp 2 — ALLA UPPFYLLDA 2026-07-21
1. ✅ 1 000-givarskörningen går igenom utan hängning (~5 min; olösbara/
   auktionsfel räknas och redovisas — i praktiken 0 med bridge-dds).
2. ✅ Rapporten visar totalt, andel "rätt kontrakt", genomsnittligt poängtapp,
   topplista per misstyp med antal + exempel.
3. ✅ Körinstruktion ovan + rad i §9-ändringsloggen.
4. ✅ Mätning #1 (baslinjen) körd — se nedan.

## Kända fällor (läs siffrorna med detta i bakhuvudet)
- **Ärliga missar är medvetna:** kaptensregeln missar slammar med vilje
  (hellre miss än kik). Revisorn RÄKNAR dem, men kategorin "missad slam"
  måste läsas med det ögat — jämför med slamfrekvensen (lillslam ~1/120).
- **DD ser alla kort:** tunna kontrakt som "går" på DD är inte alltid rätt
  bud (t.ex. 3NT på 21 hp som går på en lyckad mask). Titta på MÖNSTER
  (kategoriernas storlek över många givar), inte enskilda misstag.
- **Par är ett strängt facit:** riktig par-poäng skiljer även på övertrick
  (4♠=420 mot par 3NT+1=430 räknas som 10 i tapp, kategori `fel-strain`) och
  förutsätter perfekta offringar av båda sidor. "Andel exakt par" är därför
  ett HÅRT mått — följ helst genomsnittligt poängtapp + topplistan över tid.
- **Utpassade givar:** alla fyra passar ibland — giltigt resultat; kategorin
  `utpassad` slår bara till när någon sida hade ett görbart kontrakt.
- **X/XX i poängen:** `contractFromCalls` bär dubblingar och `scoring.ts`
  räknar dem — både i det nådda kontraktet och i par (DealerPar).

## Mätning #1 (BASLINJEN) — 2026-07-21, frö 20260721, 1 000 givar
> **Detta är baslinjen alla framtida förbättringar mäts mot.** Kör om med
> samma frö och jämför. Exempelgivar per kategori: `revisor-output/`
> (återskapas genom att köra om — samma frö ger samma givar).

```
Givar: 1000 (bedömda 1000, olösbara 0, auktionsfel 0)   ·   314 s
Rätt kontrakt (exakt par): 15,9 %
Genomsnittligt poängtapp: 300 poäng/giv

Topplista (mest tappade poäng först):
  Fel färg (bet, facit i annan strain):       148 givar   65 110 p  (snitt 440)
  Missad lillslam:                             85 givar   56 310 p  (snitt 662)
  Missad utgång:                              139 givar   45 930 p  (snitt 330)
  Missad storslam:                             32 givar   37 750 p  (snitt 1180)
  Otillräcklig straff (bet för billigt):      123 givar   34 880 p  (snitt 284)
  Över par (andra sidan överbjöd/dubblade):   141 givar   30 310 p  (snitt 215)
  Såld giv (motståndarna spelade hem):         50 givar   18 560 p  (snitt 371)
  För högt (bet i rätt strain):                33 givar    7 850 p  (snitt 238)
  Fel strain/nivå (hemspelat, poäng kvar):     87 givar    2 210 p  (snitt 25)
  Utpassad giv (görbart kontrakt fanns):        3 givar      810 p  (snitt 270)
```

**Läsning av baslinjen (med fällorna ovan i åtanke):**
- **Fel färg med bet (148 givar, största posten)** är den tydligaste äkta
  signalen: motorn väljer strain som inte bär, fast facit fanns i en annan.
- **Slamposterna (85+32 givar)** ska läsas mot kaptensregelns medvetna
  försiktighet OCH DD-fällan (DD-slam ≈ 8–10 % av givar är normalt; en
  människa bjuder inte alla). De är inte 0-mål — men målet är inte 100 %.
- **Missad utgång (139)** och **såld giv (50)** är rena förbättringsmål.
- **Otillräcklig straff (123)** + **över par (141)** är konkurrenslägen där
  par kräver perfekta straffdubblingar/offringar — hårdast att nå, men
  posterna visar var konkurrensmotorn lämnar poäng.
- **Fel strain/nivå med bara 25 p snitt** är mest övertricksbrus (420 mot 430).
- "Exakt par 15,9 %" är det HÅRDA måttet — följ hellre snitt-tappet (300)
  och topplistans rörelser över tid.
