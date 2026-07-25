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

## Regelsvepet — vilka regler använder motorn FAKTISKT? (2026-07-25)
Revisorn mäter *resultatet* (poängtapp). Svepet mäter *repertoaren*: det låter
motorn bjuda tusentals givar och räknar vilka regelnamn som faller ut.

```
$env:SVEP='1'; npx vitest run src/lib/engine/regelsvep.probe.test.ts
```

Resultatet hamnar i `revisor-output/regelsvep.txt`. **Varför det finns:**
`lebensohl.ts` var byggd, enhetstestad och beskriven i systemboken — men ingen
produktionsfil importerade den, så bordet spelade den aldrig. Enhetstester kan
inte upptäcka sådant (de anropar modulen direkt); svepet kan. Första körningen
(3 000 givar, frö 20260721): 209 olika regler användes, Lebensohl **0** gånger,
medan t.ex. Ogust 29, Drury 12, Bergen 10, Smolen 5 och Gerber 2 föll ut normalt.
Kör svepet när en ny konvention kopplas in — syns den inte i listan är den inte
inkopplad, hur gröna enhetstesterna än är.

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

## Mätning #2 — 2026-07-21, efter fel färg-fix 1 ("5♣-ryckaren")
Samma frö 20260721, 1 000 givar, efter vakterna i `auction-live.ts`
(`isArtificialNTResponse` + `partnerGameBidStandsUnopposed`, budsystem.md
§5.6/§9):

```
Rätt kontrakt (exakt par): 16,7 %   (baslinje 15,9 %)
Genomsnittligt poängtapp: 294 p/giv (baslinje 300)
Fel färg (bet): 141 givar, 60 380 p (baslinje 148 givar, 65 110 p)
Övriga poster: ±1–3 givar (brusnivå — ingen post växte nämnvärt)
```

## Mätning #3 — 2026-07-21, efter fel färg-fix 2 (2♣-kravets finaste färg)
Samma frö 20260721, 1 000 givar, efter `responderSecondBidAfter2C`-högfärgs-
visningen (`responses-2c.ts`) + dubbelton-vakten i `raiseWithFit`
(`auction-live.ts`), budsystem.md §4.4/§9:

```
Rätt kontrakt (exakt par): 16,8 %   (M2: 16,7 % · baslinje 15,9 %)
Genomsnittligt poängtapp: 293 p/giv (M2: 294 · baslinje 300)
Fel färg (bet): 138 givar, 58 530 p (M2: 141/60 380 · baslinje 148/65 110)
Övriga poster: ±1–3 givar mot M2 (brusnivå — ingen post växte nämnvärt;
frö 20260958 flyttade medvetet till "för högt": 4♥−100 är bästa möjliga
inom 2♣-utgångskravet, tapp 200 i st.f. 500)
```

## Mätning #4 — 2026-07-21, efter fel färg-fix 3 (cue-höjning → 3NT före 5m)
Samma frö 20260721, 1 000 givar, efter 3NT-grenen i `answerCueRaise`
(`auction-live.ts`), budsystem.md §5.11/§9:

```
Rätt kontrakt (exakt par): 17,0 %   (M3: 16,8 % · baslinje 15,9 %)
Genomsnittligt poängtapp: 291 p/giv (M3: 293 · baslinje 300)
Fel färg (bet): 136 givar, 57 020 p (M3: 138/58 530 · baslinje 148/65 110)
Övriga poster: ±1 giv mot M3 (frö 20260769 → exakt par; 20260805 → "över
par" 600 — par 500 kräver att Ö/V offrar 4♠X, bästa möjliga för vår sida)
```

## Mätning #5 — 2026-07-21, efter fel färg-fix 4 (konkurrens-fortsättningar)
Samma frö 20260721, 1 000 givar, efter fix 4-paketet (§4.5/§7.4/§7.7; tre
buggar + höjningsvakter, se buggfamilj 4 nedan):

```
Rätt kontrakt (exakt par): 17,2 %   (M4: 17,0 % · baslinje 15,9 %)
Genomsnittligt poängtapp: 291 p/giv (M4: 291 · baslinje 300)
Fel färg (bet): 130 givar, 54 880 p (M4: 136/57 020 · baslinje 148/65 110)
Övriga poster: missad utgång +2, såld giv +3, lillslam +1 040 p (samma antal)
— hela ökningen sitter i de två EXPONERADE luckorna (balansering över svaga
tvåor + negativ-dubblarens invit-fortsättning, se buggfamilj 4): förr nådde
de givarna rätt slutkontrakt via FELBETEENDEN som råkade trilla rätt (2NT
utan värden som partnern lyfte till utgång, 13 hp-krav som pressade fram
spel). Snitt-tappet är därför oförändrat medan exakt par steg — de riktiga
felen är lagade och test-låsta, luckorna är namngivna för fix 5.
```

## Mätning #6 — 2026-07-22, efter fel färg-fix 5a (balansering över svaga tvåor)
Samma frö 20260721, 1 000 givar, efter balanserings-utbyggnaden i
`defendWeakTwo` + advancer-rabatten i `raiseWithFit` (budsystem.md
§7.3/§7.7/§9):

```
Rätt kontrakt (exakt par): 17,1 %   (M5: 17,2 % · baslinje 15,9 %)
Genomsnittligt poängtapp: 291,0 p/giv (M5: 291,3 · baslinje 300)
Såld giv: 54 givar, 19 840 p (M5: 56/20 320)
Fel färg (bet): 131 givar, 55 050 p (M5: 130/54 880)
Övriga poster: missad utgång +2 (givar som nu balanseras men stannar under
utgång — bättre än att säljas, men inte hela vägen), billig offring −650 p,
lillslam −70 p. Nettot −0,3 p/giv: liten men äkta vinst, inga regressioner.
```

## Mätning #7 — 2026-07-22, efter fel färg-fix 5b (negativ-dubblarens invit)
Samma frö 20260721, 1 000 givar, efter `negativeDoublerContinues` +
kravsemantiken "X + egen färg är ej krav" (budsystem.md §7.4/§9):

```
Rätt kontrakt (exakt par): 16,9 %   (M6: 17,1 % · M5: 17,2 % · baslinje 15,9 %)
Genomsnittligt poängtapp: 290,8 p/giv (M6: 291,0 · M5: 291,3 · baslinje 300)
Fel färg (bet): 130 givar, 53 450 p (M6: 131/55 050 · baslinje 148/65 110)
Missad utgång: 149 givar, 49 590 p (M6: 145/48 190)
Övriga poster: ±0–1 giv (lillslam −140 p, billig offring −110, över par −100).
```

**Läsning:** snitt-tappet (huvudmåttet) fortsätter nedåt — fix 5 gav totalt
−0,5 p/giv mot M5. "Exakt par" sjönk 0,3 pe: flytten går från **bet i fel
färg/såld giv** till **hemspelat men under utgång** (missad utgång +4 givar,
+1 400 p) — givar där dubblarens invit nu köper ett hemspelat delkontrakt i
rätt strain men paret stannar under den DD-utgång som par kräver. Det är
mindre tapp per giv (därav bättre snitt) men inte exakt par. Missad utgång är
redan nästa post på topplistan (etapp 5-kandidat).

## Mätning #8 — 2026-07-22, efter fel färg-fix 6 (fyra mönster ur mönsterjakt #2)
Samma frö 20260721, 1 000 givar, efter fix 6-vakterna (§5.5/§5.9/§5.11/§7.1):

```
Rätt kontrakt (exakt par): 16,8 %   (M7: 16,9 % · baslinje 15,9 %)
Genomsnittligt poängtapp: 289,5 p/giv (M7: 290,8 · baslinje 300)
Fel färg (bet): 121 givar, 47 590 p (M7: 130/53 450 · baslinje 148/65 110)
Missad utgång: 158 givar, 53 050 p (M7: 149/49 590)
Missad lillslam: 87 givar, 59 000 p (M7: 85/57 230)
Billig offring: 125 givar, 34 300 p (M7: 118/33 070)
Övriga poster: ±1–3 givar (för högt −3, över par −5).
```

**Läsning:** största enskilda fix-klivet sedan fix 1 (−1,3 p/giv). Fel färg-
posten har fallit −27 % sedan baslinjen (148→121 givar, 65 110→47 590 p) och
är nu **tredje** posten — topplistan toppas av **missad lillslam (59 000)**
och **missad utgång (53 050)**. Flytten är förväntad: givar som förr blev bet
i fel strain spelas nu hem för lågt (missad utgång +9) eller låter
motståndarna spela (billig offring +7) — mindre tapp per giv, men inte par.
Fel färg-spårets mönsterjakt har nått gränsen där resten mest är DD-brus +
etapp 4/5-material (se Mönsterjakt #2). **Nästa attack enligt topplistan:
missad utgång** (äkta förbättringsmål; slam-posterna är delvis medvetna via
kaptensregeln).

## Mätning #9–#11 — 2026-07-24, etapp 5 fix 1 + fix 2 + fix 3
Samma frö 20260721, 1 000 givar.

```
                        M8 (före)   M9 (fix 1)   M10 (+fix 2)   M11 (+fix 3)
Rätt kontrakt (exakt par)  16,8 %      16,9 %        17,0 %         17,1 %
Genomsnittligt poängtapp   289,5       288,6         288,1          288,0
Missad utgång          158/53 050   156/52 140    153/51 040     151/50 640
För högt                31/6 460     31/6 460      33/7 040       33/7 040
Övriga poster: oförändrade (fel färg 121/47 600, lillslam 87/59 000,
billig offring 125/34 300, såld giv 54/20 550).
```

**Läsning:** båda fixarna gav rena vinster utan sidoeffekter — den enda post
som växte är **för högt** (+2 givar/580 p), vilket är det väntade priset för
att inbjudningarna nu faktiskt besvaras. Missad utgång är fortfarande andra
posten (51 040 p) men de MEKANISKA luckorna i förskanningen är nu betade;
resten av posten sitter i **värderings-golven** (se ägarfrågorna nedan) och i
DD-smickrade tunna utgångar som medvetet inte jagas.

**Fix 1 (§6.6):** svararens höjning av öppnarens andra färg graderas efter
stödpoäng (frön 20260748/20261646 → 4♠ i stället för 2♠).
**Fix 2 (§5.1):** öppnarens tredje bud efter semi-forcing 1NT besvarar
svararens inbjudan (frö 20260843 → 4♠ i stället för pass på 2NT).
**Fix 3 (§4.3, ägarbeslut):** 1NT-öppnarens accept av en 2NT-inbjudan räknar
`notrumpPoints` — "bra 15" (tät A-K-D-klump, femkortsfärg, ess/tior; inget
flathets-avdrag i sang) accepterar, platt quack-15 avböjer (frö 20260744 →
3NT). 3M-invitens golv på platt 12 hp BEHÖLLS (ägarbeslut, ingen kodändring).
Facit-test för alla tre: `auction-missad-utgang.test.ts` (22 fall).

## Etapp 5 FÖRSKANNAD (2026-07-22): missad utgång — familjer + ägarfrågor
M8:s alla 158 "missad utgång"-givar grupperade efter var auktionen stannade
(`REVISOR_EXAMPLES=500`, frön i `revisor-output/`):

| Familj | Givar | Poäng |
|---|---|---|
| Ostört: lågt färgstopp (1–2 i färg) | 51 | 17 450 |
| Konkurrens: lågt färgstopp | 21 | 7 190 |
| Ostört: stannade på 3M (invit-kedja) | 20 | 6 710 |
| Ostört: 1NT-stopp | 18 | 5 730 |
| Ostört: stannade på 2NT | 16 | 5 690 |
| Konkurrens: 3M/2NT/3m-stopp | 22 | 7 530 |
| Övrigt (3m/4m-stopp m.m.) | 10 | 2 750 |

**Två MEKANISKA fix-kandidater (först i tur, inget ägarbeslut krävs):**
1. **Svararens höjning av öppnarens ANDRA färg graderas inte** (frö
   20260748: `1♣–1♥–1♠–2♠` på **13 hp + 4 stöd** — enkel höjning oavsett
   styrka; borde vara invit-hopp/utgång enligt samma stege som andra
   höjningar). Största familjen (ostört lågt färgstopp) har flera sådana.
2. **Öppnaren passar 2NT-inviten med 6-korts högfärg** (frö 20260843:
   `1♠–1NT–2♠–2NT–P` med 14 hp och AQT863 — konvertering till 3♠/accept 4♠
   saknas; 4♠ = 620 fanns).

**Värderings-golv som kräver ÄGARENS input (fråga, gissa inte):**
- Öppnarens accept av 3M-invit på 12 hp minimum (frö 20260942: 3♥–P med
  10 stick på DD — ärligt avböjt idag; flyttas golvet ned bjuds fler
  utgångar OCH fler bet).
- 1NT-öppnarens accept av 2NT-invit på 15 hp (frö 20260744 — ärligt
  minimum-pass idag).
- Generellt: stora delar av 1NT-/2NT-stopp-familjerna är DD-smickrade tunna
  utgångar (20–23 hp där maskarna sitter rätt) — jaga INTE dem blint.

**Nästa steg (i ordning):** ~~facit-test + fix för kandidat 1 → mät (M9) →
kandidat 2 → mät~~ **KLART 2026-07-24** (se Mätning #9+#10 ovan) → **kvar:
presentera golvfrågorna för ägaren med exempelhänderna nedan.**

**ÄGARENS SVAR 2026-07-24 (golvfrågorna avgjorda):**
- **3M-inviten på platt 12 hp: golvet BEHÅLLS** ("Nej — behåll golvet"). Ingen
  kodändring; givarna i den familjen räknas som DD-brus.
- **1NT-öppnarens 2NT-accept på 15: "bara som kvalitets-15"** → `notrumpPoints`
  byggd (fix 3, se Mätning #11 ovan). Golvet 16 står kvar — det är värderingen
  som blev ärligare.

**Golvfrågornas exempelhänder (regenererade 2026-07-24 med `dealFromSeed`):**
- **Frö 20260942** (`1♦–1♥–2♥–3♥–P`): öppnaren S har ♠86 ♥AQ75 ♦AQ72 ♣875 =
  12 hp, helt platt (4-4-3-2, inga extravärden). Svararen N inbjuder med 12 hp
  (♠AJT ♥KT864 ♦T43 ♣A6). DD ger tio stick i hjärter (maskarna sitter rätt) →
  4♥ = 620 fanns. **Frågan: ska en platt 12-hand acceptera inbjudan?**
  *Claudes rekommendation: NEJ — 12+12 platt är under utgångszonen; att sänka
  golvet köper några utgångar och betalar med fler bet ("för högt" växer).*
- **Frö 20260744** (`1NT–2NT–P`): 1NT-öppnaren N har ♠T72 ♥A83 ♦QT97 ♣AKQ =
  15 hp (minimum av 15–17). Svararen S inbjuder med 8 hp. **Frågan: ska 15 hp
  med en tät honnörsklump (AKQ) accepteras som "bra 15"?**
  *Claudes rekommendation: bara som kvalitetsuppgradering (täta honnörer/
  femkortsfärg), inte som ett generellt sänkt golv.*

## Etapp 4 FÖRSKANNAD (2026-07-24): F1-resten — familj B (2♣) + C (reverse/hoppskift)
Ny körning samma frö 20260721 (`REVISOR_EXAMPLES=500`, siffrorna = M11-läget).
Slamposternas alla exempel (missad lillslam 87/59 000 + missad storslam
32/37 720) grupperade efter auktionsfamilj (handgranskade — auto-grupperingen
räknade först höjningar som `1♣–1♠–2♠` som reverse):

| Familj | Lillslam | Storslam | Poäng ca |
|---|---|---|---|
| **B: stark 2♣-öppning** | 8 givar | 1 giv | ~5 900 |
| **C-rest: reverse** | 3 givar | 2 givar | ~4 000 |
| **C-rest: hoppskift** | 1 giv | 2 giv | ~3 500 |
| Övrigt (ärliga kaptensmissar + DD-smickrat) | ~75 | ~27 | ~83 000 |

**Övrigt-klumpen bekräftar förväntan:** slamposterna är till största delen
medvetna (kaptensregeln: hellre ärlig miss än kik) eller DD-smickrade (6NT
på 28 hp där maskarna sitter). De jagas INTE. Etapp 4-materialet är de
~17 givar (~13 000 p) där slammen var bjudbar MOT VISADE INTERVALL men
auktionsvägen saknas.

**Familj B-mönstren (stark 2♣ — slamutredning saknas helt):**
1. **Kaptensmatte ignoreras efter positivt svar** (frö 20261101:
   `2♣–2♥–3♥–4♥–P` med 24 hp mot positivt svar 8+ och hjärterfit — visat
   32+ men ingen RKC; 6NT/6♥ fanns). Samma frö 20261050 (`…4♣–5♣`, 21 hp
   mot 3♣-positivt med klöverfit).
2. **Blast till 5m i stället för utredning** (frö 20261469: `2♣–2♠–3♦–5♦`
   — svararen med positivt svar hoppar förbi både cue och RKC; frö 20260830
   storslam: `2♣–2♥–3♦–5♦`, 6♦/7♦ fanns).
3. **Spelstick-2♣:ans visade bild** (frö 20261372: 2♣ på 15 hp/8½ spelstick
   → svararen med 14 hp läser "22+" — kaptensmatten mot spelstick-öppningar
   behöver en ärlig definition innan den får driva slam).

**Familj C-mönstren (öppnaren visade extra — fortsättningen dör):**
4. **Efter reverse (17+) blastas eller stannas det** (frö 20260941:
   `1♣–1♥–2♦–2♠–3♣–5♣` med 17+14 — ingen RKC, 6NT fanns; frö 20260937
   storslam: `1♣–1♠–2♥–3♦–4♣–5♣`, 6/7 fanns; frö 20261111: reverse följt av
   preferens 3♣ passas med 18 hp mot 10).
5. **Efter hoppskift (19+) tas ingen ny sats** (frö 20260799:
   `1♠–1NT–3♥–3♠–P` — öppnaren 17–19 med 5-4, preferensen passas, 6♥ fanns
   med 1200 i tapp; frö 20260765: `1♠–1NT–3♥–3NT–P`, 7♥ på DD).

**Fix-plan (facit-först, en familj i taget, kaptensregeln mot visade
intervall):** B först (störst + helt otäckt: koppla slamzon ≥33/inbjudan
31–32 + RKC in i 2♣-fortsättningarna i `responses-2c.ts`-flödet), sedan
C-resten (öppnarens reverse/hoppskift = visade 17+/19+ → svararen blir
kapten med samma matte). Mät om (M12) efter varje familj med samma frö.

## Mätning #12 — 2026-07-24, etapp 4 familj B fix 1
Samma frö 20260721, 1 000 givar. Fix: kaptensmatte + RKC efter positivt svar
på stark 2♣ (`auction-2c-slam.test.ts`, budsystem.md §4.4/§9).

```
                        M11 (före)   M12 (fix B1)
Rätt kontrakt (exakt par)  17,1 %       17,1 %
Genomsnittligt poängtapp   288,0        287,9
Missad lillslam         87/59 000     83/56 400
Missad storslam         32/37 720     32/36 970
Fel färg (bet)         121/47 600    123/50 280
För högt                33/7 040      34/7 560
Övriga poster: oförändrade (missad utgång 151/50 640, billig offring
125/34 300, såld giv 54/20 550).
```

**Läsning:** slamvägen efter 2♣ finns nu — fyra av familj B-givarna bjuder
slam (frö 20261469 = exakt par 6♦; 20260830 6♦ i st.f. 5♦). **Känd ärlig
kostnad:** två 33-poängsslammar (frön 20261101, 20261050) går en DD-bet i
färgen — facit stod bara i SANG från den starka handen — och flyttar från
"missad lillslam" till "fel färg-bet" (+2 680 p). Det är ärligt bjudna
slammar (kaptensmatte utan kik); strain-valet 6NT-från-starka-handen är en
möjlig senare finslipning, inte ett fel. Nettot −0,1 p/giv. Kvar i familj B:
NT-lägena utan trumf (frö 20261372: positivt svar utan fit → 4♥ för lågt).
(Frö 20261573 omprövat: 23+7 hp = 30 ihop → ÄRLIG miss under zonen, jagas ej.)

## Mätning #13 — 2026-07-24, etapp 4 familj B fix 2
Samma frö 20260721, 1 000 givar. Fix: slamzon utan trumf efter positivt svar
(RKC i egen självbärande färg; 6NT direkt BARA efter 3NT-återbud).

```
                        M12 (före)   M13 (fix B2)
Rätt kontrakt (exakt par)  17,1 %       17,1 %
Genomsnittligt poängtapp   287,9        287,4
Missad lillslam         83/56 400     82/55 860
Fel färg (bet)         123/50 280    123/50 280
Fel strain              89/2 120      90/2 190
Övriga poster: oförändrade.
```

**Läsning:** frö 20261372 spelar nu 6♣ (tapp 70 i st.f. 540). **Viktig lärdom
under bygget:** första utkastet bjöd 6NT direkt även efter öppnarens
FÄRG-återbud — en DD-skanning av ALLA 2♣-slamauktioner i mätfröna (snabb:
`botAuction` på 1 000 frön + DD bara på slammen) fångade frö 20261107 där
"visade 22" var en spelstick-hand med 13 hp och 6NT gick FYRA bet. Regeln
stramades åt (6NT kräver 3NT-återbudets visade balans; färg-återbud utan
fit → naturligt vidare) med fröet som facit-vakt. **Etapp 4 hittills (M11→
M13): snitt-tapp 288,0 → 287,4, missad lillslam 87→82 givar (59 000→55 860),
storslam −750 p; ärlig kostnad fel färg +2 680** (två 33-poängsslammar som
DD-straffar i färgen, facit enbart i sang). Slamvägar efter 2♣ som återstår:
inga kända mekaniska — resten av familj B-posten är ärliga missar under
zonen. **Nästa: familj C-resten (reverse/hoppskift).**

## Mätning #14 — 2026-07-25, etapp 4 familj C-resten (ETAPP 4 KLAR)
Samma frö 20260721, 1 000 givar. Fix: hoppskift-fortsättningen efter
semi-forcing 1NT (utgångsplacering, fit i hoppskiftets färg) + ny slamport
efter 1-lägessvarens reverse (visade 16) och hoppskift (visade 19).

```
                        M13 (före)   M14 (familj C)
Rätt kontrakt (exakt par)  17,1 %       17,1 %
Genomsnittligt poängtapp   287,4        287,2
Missad utgång          151/50 640    149/50 140
Missad lillslam         82/55 860     82/55 410
Missad storslam         32/36 970     32/36 470
Fel färg (bet)         123/50 280    124/51 040
För högt                34/7 560      35/8 060
Övriga poster: oförändrade.
```

**Läsning:** hoppskift-fröna nås nu rätt (20260799: 4♥ i st.f. 3♠-pass,
tapp 1200→750; 20260765: 4♥ i st.f. 3NT; 20261334: ruterfiten sätts), och
reverse-porten hittade en slam förskanningen missbedömt (frö 20260937:
`1♣–1♠–2♥` → 6♣ med TRETTON stick, förr 5♣). Ärlig kostnad: två tunna
33-visade slammar går exakt en DD-bet (frön 20261238, 20261451 — fel färg
+760, för högt +500). DD-skanning av ALLA 18 slamkontrakt i mätfröna:
10 står, 6 går en bet (tunna men ärligt bjudna), 2 är familj B:s kända
frisits-fall. **ETAPP 4 DÄRMED KLAR: snitt-tapp 288,0 → 287,2 (M11→M14),
missad lillslam 87→82 givar (59 000→55 410), missad utgång 151→149,
storslam −1 250 p.** Facit-låst i `auction-2c-slam.test.ts` (18) +
`auction-hoppskift-slam.test.ts` (10).

## Fel färg-spåret: mönsteranalys av topposten (2026-07-21, etapp 3 NU)
Alla 148 "fel färg med bet"-givar hämtade (`REVISOR_EXAMPLES=500`) och
grovgrupperade efter nådd strain-klass → facit-klass (poäng = totalt tapp):

| Mönster | Givar | Poäng |
|---|---|---|
| Lågfärg spelas, sang var facit | 25 | 15 540 |
| Sang spelas, högfärgsfit var facit | 37 | 13 010 |
| Lågfärg spelas, högfärg var facit | 26 | 10 920 |
| Högfärg spelas, sang var facit | 20 | 9 520 |
| Sang spelas, lågfärg var facit | 18 | 6 560 |
| Fel högfärg av två | 12 | 5 230 |
| Övrigt (fel minor av två, högfärg→lågfärg) | 10 | 4 330 |

**Identifierade buggfamiljer (djupdykning i exempelgivarna):**
1. **✅ FIX 1 KLAR 2026-07-21 — "5♣-ryckaren" (ren bugg, ostört):** öppnaren
   DROG partnerns 3NT-avslut till 5♣ efter Stayman (frön 20260752, 20260896,
   20260965). Rot: när linjen lämnades öppen läste live-lagrets
   `partnerLastSuit` partnerns ARTIFICIELLA Stayman-2♣/3♣ som en naturlig
   klöverfärg → `raiseWithFit` "minorfit + utgångsvärden" → 3NT redan bjudet
   → 5♣. Lagat med två vakter i `auction-live.ts` (`isArtificialNTResponse`,
   `partnerGameBidStandsUnopposed`); facit-test FÖRE fix i
   `auction-stayman-not-natural.test.ts`. Effekt: Mätning #2 ovan.
   (Svararhoppet 1♣–1♠–1NT–5♣, frö 20260878, är familj 3-släkting — kvar.)
2. **✅ FIX 2 KLAR 2026-07-21 — 2♣-kravets minimi-steg väljer finaste färgen:**
   (a) svararen bjöd blint 3NT utan att visa 4-korts högfärg (frö 20260958:
   3NT −400 från fel hand, fast 4♥ bara går en bet — DD visade f.ö. att INGEN
   utgång går där; 4♥ −100 är bästa möjliga inom 2♣-utgångskravet) →
   `responderSecondBidAfter2C` visar nu billigaste 4-korts högfärg under 3NT;
   (b) svararen höjde öppnarens TVINGADE klöver-ombud på dubbelton i stället
   för att rebjuda egen 6-korts spader (frö 20260737: 5♣ bet fast 4♠+1 = par
   650, nu exakt par) → dubbelton-vakt i `raiseWithFit`. Facit-test FÖRE fix:
   `auction-2c-finest-suit.test.ts`. Effekt: Mätning #3 ovan.
3. **✅ FIX 3 KLAR 2026-07-21 — cue-höjning i minor → 3NT före 5m (§5.11):**
   öppnaren återgick alltid billigast i färgen på minimum och cue-bjudaren
   utan eget stopp blåste 5m — fast stoppet (♣K2/♦KT) satt hos ÖPPNAREN och
   3NT var hemma (600). Nu bjuder `answerCueRaise` 3NT med jämn hand + stopp
   i deras färg (bara minorfit; gäller även maximum). Frö 20260769 → exakt
   par; 20260805 → 600 ("över par" — par 500 kräver att Ö/V offrar, bästa
   möjliga för vår sida). Facit-test FÖRE fix: `auction-cueraise-3nt.test.ts`.
   Effekt: Mätning #4 nedan. OBS: inverterad minor-delen av mönstret (ostört)
   är B13-släktingen — kvar i topplistan (etapp 5).
4. **✅ FIX 4 KLAR 2026-07-21 — tre konkurrens-fortsättningar (§4.5/§7.4/§7.7):**
   (a) advancerns svar på tvåfärgs-cue över deras svaga tvåa valde längsta
   sidofärg med klöver som lika-vinnare → 4♣ på tre hackor fast 3♥ fanns en
   nivå lägre (frö 20260733: 4♣ tre bet, 5♥ hemma) → lika längd avgörs nu av
   billigaste nivån (`answerWeakTwoCue`) → exakt par. (b) öppnaren svarade
   negativ dubbling med sang på minimum (frö 20260763: 11 hp → 2NT två bet)
   → sang på 2-läget+ kräver ~15+; utan nivåhöjning föredras i ordning: annan
   objuden 4+ färg (4-4-fiten, frö 20261351) → eget 5-korts återbud → sang
   (`openerAnswerNegativeDouble`). 2♦ en bet är praktiskt optimum (par 1♠
   onåbart efter 2♣-inklivet; resttapp 130). (c) ny färg som krav på 3-LÄGET
   kräver nu ~15+ mot partnerns svaga tvåa; 11–14 utan fit och utan billig
   färg passar (`respondToWeakTwo`; frö 20260774: förr tvingat 3♥ bet — nu
   pass, Ö/V balanserar till 4♠ två bet = exakt par). **Höjningsvakterna
   (kalibrerade i tre mät-iterationer med frö-diff):** ett TVINGAT ombud
   (svar på egen X) som var billigt och inte är en 1M-öppnad färg lovar bara
   5 → ingen dubbelton-fit (`fitLengthNeeded`); gick ombudet UPP en nivå
   (= 6+) eller lovade öppningen 1♥/1♠ redan 5+ räknas dubbelton som fit —
   men höjs då bara med UTGÅNGSVÄRDEN (13+ sp, `raiseWithFit`): enkla/
   inbjudande dubbelton-höjningar av ett tvingat minimum pressade bara upp
   partnern en nivå (frön 20260847/20261251). Facit + regressionsvakter
   (15 fall, skrivna FÖRE fix): `auction-konkurrens-fortsattning.test.ts`.
   Effekt: Mätning #5 nedan. **Exponerade kända luckor** (förr maskerade av
   fel som råkade trilla rätt): N/S **balanserar inte över deras svaga tvåor**
   (2♥–P–P–P säljs: frön 20260770/20261248/20261342) och **negativ-dubblaren
   saknar invit-fortsättning** över öppnarens färgsvar (10–12-handen passar:
   frön 20261354/20261139/20261179) — kandidater för fix 5.
5. **✅ FIX 5 KLAR 2026-07-22 — de två exponerade luckorna (§7.3/§7.4/§7.7):**
   **(5a)** balansering över svaga tvåor byggd ("låna en kung" fullt ut:
   naturligt 2-läge från 7 hp, offshape-X ≤3 kort i deras färg, 2NT 12–15) +
   **advancer-rabatt** −3 med 3-lägestak mot balansinkliv (frön 20260770 →
   3♠ = par 140, 20261342 → spaderkontrakt i st.f. såld; 20261248 medvetet
   orörd — DD-smickrad utgång, golv 10 står). Facit-test:
   `auction-balansering-svag2.test.ts`. **(5b)** `negativeDoublerContinues`:
   invit-preferens/egen färg/2NT i 9–12-zonen över öppnarens tvingade svar
   (frön 20261354 → 5♦ = par 600, 20261139 → hjärterfiten, 20261179 → 2♥ i
   st.f. 2♦ bet); X + egen färg = EJ krav (`competitionForce`). Facit-test:
   `auction-negx-invit.test.ts`. Effekt: Mätning #6 + #7 ovan.
6. **Ofrånkomligt DD-brus:** normala sangauktioner (1NT–2NT–3NT, 1NT–3NT) där
   DD råkar göra en 4-3-högfärgsdelkontrakt (frön 20260801, 20261062) — par
   är hårt; dessa jagas INTE.

## Mönsterjakt #2 (2026-07-22, i M7:s 130 kvarvarande fel färg-givar)
Alla 130 exempel hämtade (`REVISOR_EXAMPLES=500`), grovgrupperade
(nådd strain-klass → facit-klass):

| Mönster | Givar | Poäng |
|---|---|---|
| Sang spelas, högfärg var facit | 34 | 10 830 |
| Lågfärg spelas, sang var facit | 15 | 9 500 |
| Lågfärg spelas, högfärg var facit | 24 | 9 310 |
| Högfärg spelas, sang var facit | 18 | 7 410 |
| Sang spelas, lågfärg var facit | 18 | 6 740 |
| Fel högfärg av två | 10 | 4 470 |
| Högfärg spelas, lågfärg var facit | 7 | 2 910 |
| Fel minor av två | 4 | 2 280 |

**✅ FIX 6 KLAR 2026-07-22 — fyra rotorsaker ur djupdykningen (§5.5/§5.9/
§5.11/§7.1 + §9):** (1) 5♣-utgångsblåsen mot passad partner (frön 20261090/
20261409/20261459 → tävlande höjning billigast); (2) svararens höjning av
öppnarens färg lästes som "ny färg = rondkrav" → öppnaren drog partnerns 4♥
till 5♦ (frö 20261112 → 4♥ står = par 620); (3) öppnaren tävlade 5♥ över
deras 4♠ efter partnerns pass (frö 20261375 → pass); (4) cue-höjaren blåste
5♦ på limit-värden mot minimum-återgång (frö 20260906 → pass på 3♦).
Facit-test FÖRE fix: `auction-felfarg-fix6.test.ts`. Effekt: Mätning #8.

**Kvar i de 130 (bedömt, per grupp):** toppgruppen "sang → högfärg" är till
stor del DD-brus (tunna 5-3/4-3-partials som DD spelar hem) + äkta luckor i
högfärgsvisning efter sang-sekvenser; "lågfärg → sang"-resten är
2♣-släktingar (frön 20261040/20261247/20261414 = etapp 4-mat) och
B13-släktingar (minor-återbud, etapp 5). Nästa stora poster på topplistan är
dock **missad utgång** (49 590 p) och slam-familjerna — mönsterjakten har
nått gränsen där fel färg-resten mest är brus + etapp 4/5-material.
