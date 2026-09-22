# Ovanlig 2NT — fortsättningen (KLAR & LIVE 2026-09-22, mergepunkt 275d9fe)

> **BYGGD 2026-09-21** — ägarens besked: *"ta så mycket från Michaels som går att
> anpassa hit"* + fyra svar om lågfärgsfiten (inklivaren 16 / 17–19 / 20+ · cuen
> över 1♥/1♠ kräver 11+ · 3NT som Michaels · spärr 4m + direkt 5m som Michaels).
> Strukturen står i **systemboken §7.2**; koden i `unusual-2nt-continuations.ts`,
> facit i `unusual-2nt-continuations.test.ts`. Claudes egna anpassningar (ägaren
> kan ändra): svaren på lågfärgscuen (4♣ svag / 4♦ stark), 15+ för 5m mot svagt
> svar, fyrkorts stöd för direkt 5m över en högfärg. **Slam:** poängbekräftad 4NT på 4-läget, även i
> lågfärg (ägarbesked samma dag). **Svararen över deras 2NT** (frö 20296021, ♠AKQJ865 passade): självbärande högfärg + 12+ → 4M
> (ägarbeslut 09-22). **Ägarens oro 09-22:** motorn "reagerar svagt" — passar utan regel när ingen rad träffar; se sessionsrapporten.
> Resten av filen är förarbetet, kvar som bakgrund.

> **Läget före bygget:** förberett, INTE byggt. Ägaren skriver sin struktur i nästa session —
> **fråga om detaljerna, föreslå ingen egen färdig struktur** (ägardirektiv
> 2026-09-18). Förebilden är Michaels-fortsättningen som byggdes 2026-09-22
> (`michaels-continuations.ts`, systemboken §7.2) — samma hål finns här.

## Definitionen (klar, ägarbeslut 2026-09-22)
Michaels = ALLTID de två **högsta** objudna färgerna · ovanlig 2NT = de två
**lägsta**. Över 1♣ = ♦+♥ · över 1♦ = ♣+♥ · över 1♥/1♠ = ♣+♦. Golv 8 hp
(felrapport #76), taket öppet. Inklivsvillkoret bor i `overcalls.ts` (sök
"ovanlig 2NT").

## Vad motorn gör i dag (provat 2026-09-22, efter (1♥)–2NT–P)
| Läge | I dag | Anmärkning |
|---|---|---|
| Advancern, svag hand | lägsta preferens (3♣/3♦), regel `advance tvåfärg (preferens)` | rätt |
| Advancern, 10 hp … 17 hp | **samma lägsta preferens** | kan aldrig visa värden — samma hål som Michaels hade |
| Advancern med 3-3 i partnerns färger | den **högre** färgen (3♦) | bridgebum: den **billigare** (Michaels ändrades så 09-22) |
| Advancern med ♠KQJ9832 och 1-2 i lågfärgerna | 3♣ preferens | egen färg introduceras aldrig (Michaels-regeln: bara med ≤1 kort i BÅDA) |
| Inklivaren efter den tvingade preferensen | **pass utan regel**, även med 22 hp 5-5 | regeln saknas helt (Michaels: 14 / 15–17 / 18+) |
| Budförklaringen av 3♣ | "Ny färg klöver — naturligt, minst 4 kort" | fel: det är en tvingad preferens som kan vara 0 poäng |
| Budförklaringen av 2NT | "… Ej krav" | advancern får aldrig passa ostört → ska stå som krav |

Provkommandot (scratch, återskapas lätt): `decideCall` med historiken
`1H 2NT P` för advancern och `1H 2NT P 3C P` för inklivaren.

## Bridgebum (ägarens källa) — bridgebum.com/unusual_2nt.php
- **Preferens:** färgen med mest tolerans; lika längd → den **billigaste**. Ej krav.
- **Spärrhopp:** 4+ stöd och svag hand. Ej krav.
- **Cue i deras färg:** krav en rond — stöd i minst en färg + utgångs-/slamintresse.
  Inklivaren: **billigaste färgen med svag hand (~0–10)**, annat bud med ~10+.
- **Fjärde färgen:** naturlig, ej krav — 6+ kort, hygglig hand, inget stöd.
- **Inklivarens återbud:** höjningar naturliga och ej krav; övriga bud visar stark hand.
- Kontrollera själv mot sidan: läget över **svaga tvåor** (hos oss är 2NT över en
  svag tvåa NATURLIGT 15–18, redan byggt — `preempt-defense-continuations.ts`).

## Frågor att ställa ägaren (Michaels-svaren som referens, inte som förslag)
1. Inklivaren efter den tvingade preferensen: gränserna pass / inbjudan / utgång?
   (Lågfärg: inbjudan = 4m, utgång = 5m — eller 3NT? Michaels var 14 / 15–17 / 18+.)
2. Advancerns cue: krav (Michaels: 8+ hp och 3+ stöd)? Och över 1♥/1♠ är cuen
   3♥/3♠ — över preferensnivån 3♣/3♦; ryms den?
3. Advancerns 3NT: när? (Mot två lågfärger är 3NT ofta RÄTT utgång — viktigare
   här än vid Michaels.)
4. Spärrhopp (4m) och direkt utgång (5m): krav?
5. Egen sexkortsfärg: samma regel som Michaels (högst ett kort i BÅDA)?
6. Lika längd → den billigare färgen (som Michaels)?
7. Över 1♣/1♦ visar 2NT en HÖGFÄRG (hjärter) + en lågfärg — ska hjärterfiten
   behandlas som vid Michaels (inbjudan 3♥ / utgång 4♥)?
8. Slam = systems on (den vanliga konkurrens-slamraden) — gäller lågfärgsfit
   också? (Raden kräver i dag HÖGFÄRGSfit: `competitiveMajorFit`.)

## Var det byggs (kartan från Michaels-bygget)
- **Beslut:** ny modul i stil med `michaels-continuations.ts` (läget ur BUDEN,
  ostört = motståndarna tysta efter 2NT). Krokar i `auction-decide.ts`: raden
  *advance* (före `advanceTwoSuiter`), *inkliv2*, *advance2*.
- **Betydelse:** egen läsare i `auction-meaning.ts` bredvid
  `interpretMichaelsContinuation`, anropad först i `deriveMeaning`.
- **Regelregistret:** varje nytt regelnamn i `rules.ts` OCH i `ALL_ENGINE_RULES`
  i `rules.test.ts` (annars rött: "föräldralösa registerposter").
- **Äldre kod som rörs:** `advanceTwoSuiter` (`overcalls.ts`, lika längd →
  högre rankad), `twoSuiterContinues` + `ownTwoSuiterSeat`
  (`overcall-continuations.ts`, flykt/bjuder vidare i konkurrens — behåll).
- **Facit först**, i stil med `michaels-continuations.test.ts`.

## Lärdomar från Michaels-dagen (läs före bygget)
- **Rotmönstret:** reservlogiken `fit-raise.ts` ("höjning på visad längd") läser
  ett KONSTGJORT eller TVINGAT partnerbud som naturlig färg med värden och höjer
  till utgång vid 13+ stödpoäng. Tre live-fynd 09-20…22 hade den roten. Här ger
  den i stället **pass utan regel** — men samma lucka.
- **Prova HELA växlingen** när en slamväg kopplas in (fråga → svar → placering):
  två fel syntes först då (modulens egen "partnern har placerat → pass" svalde
  4NT; `agreedTrump` läste cue-bud i deras färg som överenskommen trumf — nu rättat
  i faktalagret: en färg motståndarna bjöd först är aldrig vår trumf).
- **Genomlys efter bygget:** buda några tusen givar och läs de auktioner där
  konventionen dyker upp. OBS: `buildAuction` cachar per giv-OBJEKT (WeakMap) —
  jämförelser "med/utan" kräver färska `dealFromSeed`-objekt.
- **Symboler i förklaringstexter:** `SWE_SYM` är nycklad på BOKSTAV —
  `SWE_SYM[letterOfSuit(suit)]`, aldrig `SWE_SYM[suit]` (gav "partnerns undefined").
- **Patch-skript:** skriv dem med Write-verktyget, inte bash-heredoc (citattecken
  och backslash går sönder); bevara radslut (repot har blandat CRLF/LF).
- **Dokumentvakten:** nya docs ska in i `docs/README.md`; kB-siffrorna för
  `budsystem.md`/`historik.md` måste följa med när filerna växer.
