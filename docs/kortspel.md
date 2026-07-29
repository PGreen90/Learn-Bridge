# Kortspel — spela ut korten mot bottar (arbetslista punkt 29)

> Spec + byggplan för spelläget: efter att ett kontrakt är satt spelas de 13
> sticken ut. Ägaren (Syd) spelar mot tre bottar. "Avslut + motspel" = ägaren
> kan vara både spelförare och motspelare. Status längst ned.

> ⚠️ **NUTIDSNOT (2026-07-04): denna fil beskriver den FÖRSTA byggomgången.**
> Spelläget har vuxit långt förbi det som står under "Status"/"Återstår"/
> "Avgränsningar" nedan. Det som här står som "ännu inte" ÄR numera byggt & live:
> kontraktet härleds ur en **riktig auktion** (`auction-contract.ts`, inte
> heuristiska `pickContract`/`dealForPlay`), bottarna spelar med **bot-hjärna
> (Monte-Carlo-DDS + signalavkodning)** i stället för bara tumregler,
> **DDS-facit** och **markeringar/utspel** är inkopplade. **För nuläget, läs
> `docs/status.md` (spel-avsnitten) och `docs/bot-hjarna.md`** — behandla
> avsnitten nedan som historik över hur spelläget först byggdes.

## Mål
- Ett **spelläge** där man klickar fram korten stick för stick mot datorn.
- Ägaren sitter alltid **Syd**. Är kontraktet N/S spelar ägaren ut det (och
  styr träkarlen Nord) = **avslut**. Är det Ö/V försvarar ägaren = **motspel**.
- **Inte** dubbeldummy-optimalt ännu — bottarna spelar på **tumregler**. Den
  exakta facit-funktionen (DDS, punkt 28) kopplas in senare för att betygsätta.

## Centrala begrepp / regler
- **Kontrakt:** spelförare (Seat) + färg/sang (Strain) + nivå (1–7).
- **Trumf:** kontraktets färg (eller ingen i sang).
- **Utspel:** spelförarens vänstra motståndare (LHO) spelar ut.
- **Träkarl:** spelförarens partner. Korten läggs öppet **efter utspelet**.
- **Följa färg:** man måste lägga i utspelsfärgen om man kan; annars valfritt
  (trumfa eller saka).
- **Sticket vinns av:** högsta trumfen i sticket, annars högsta kortet i den
  utspelade färgen. Vinnaren spelar ut till nästa stick.
- **Resultat:** spelförarsidans antal stick mot kontraktets krav (6 + nivå).

## Arkitektur (rena moduler + UI)
1. **`src/lib/engine/play.ts`** — ren spelmotor (ingen UI, ingen slump):
   - Typer: `Strain`, `Contract`, `PlayedCard`, `Trick`, `PlayState`.
   - `startPlay(deal, contract)` → initialt läge (rätt utspelare, träkarl).
   - `legalCards(state, seat)` → följa-färg-regeln.
   - `playCard(state, card)` → nytt läge; avgör stickvinnare vid 4:e kortet,
     räknar stick, sätter nästa utspelare.
   - `isComplete`, resultat-hjälpare (stick till spelförarsidan, satt/bet).
2. **`src/lib/engine/play-bot.ts`** — bott-tumregler:
   - `botCard(state, seat)` → ett lagligt kort: vinn billigt om möjligt, annars
     lägg lågt / saka från kortaste sidofärg. Som utspelare: enkelt utspelsval.
3. **`pickContract(deal)`** (enkel heuristik): välj spelförarsida (mest hp) och
   strain (8+ högfärgsfit → annars sang → annars minor), nivå efter poäng.
   Ersätts/kompletteras av riktig auktion + DDS-poängsättning senare.
4. **UI** — "Spela ut korten" (knapp/läge i `Spela.tsx` eller egen sida):
   bordsvy, klicka kort, bottar spelar automatiskt (liten fördröjning), stick i
   mitten, löpande stickräkning, kontraktsbanner, satt/bet-summering, "Ny giv".

## Byggordning (test-driven, varje steg en avstämning)
- **A. Spelmotorn** (`play.ts`) + tester: följa färg, trumf vinner, sang-vinst,
  13 stick spelas klart, stickräkning, resultat mot kontrakt.
- **B. Bottar** (`play-bot.ts`) + tester: alltid lagligt kort; en hel
  bot-mot-bot-utspelning ger 13 giltiga stick.
- **C. Kontraktval** (`pickContract`) + tester.
- **D. UI** spelläge; verifieras i webbläsaren.

## Avgränsningar (denna omgång)
- Ingen budgivning → spel-koppling ännu (kontraktet väljs heuristiskt).
- Ingen DDS-facit/poängsättning (punkt 28, separat).
- Bottar spelar tumregler, inte optimalt.
- Inga markeringar/signaler (punkt 30, §8) ännu.

## Vägval (beslutade)
- Ägaren spelar alltid **Syd** → **både avslut och motspel** beroende på kontrakt.
- Idag byggs **steg A + B** (motor + bottar); UI tas i nästa omgång.

## Status (första byggomgången — se NUTIDSNOT överst för nuläget)
- ✅ Plan godkänd + vägval beslutade.
- ✅ **Steg A – spelmotorn** (`play.ts`): `startPlay`, `legalCards` (följa färg),
  `playCard` (stickvinnare m. trumf, stickräkning), `currentWinner`, `isComplete`,
  `contractResult`. Ren, immutabel, kastar vid olagligt kort.
- ✅ **Steg B – bottar** (`play-bot.ts`): `botCard` tumregler (utspel lågt från
  längsta färg; vinn billigt; annars lågt). 10 tester gröna, inkl. en hel
  bot-mot-bot-utspelning (13 giltiga stick i både trumf och sang).
- ✅ **Steg C – kontraktval** (`play-contract.ts`, `pickContract`): starkaste
  sidan, 8+ högfärgsfit annars sang, nivå efter samlad styrka. 7 tester.
- ✅ **Steg D – UI** (`src/pages/Play.tsx`, flik **Spela kort** = `#/spela-kort`):
  bordsvy, klickbara lagliga kort, bottar spelar automatiskt, stick i mitten med
  vinnarmarkering, löpande stickräkning, satt/bet-resultat, "Ny giv". Verifierad
  i webbläsaren (utspel, följa färg, ruff, stickräkning – inga konsolfel).

## Återstår (från första omgången — NUMERA MEST KLART, se NUTIDSNOT)
> Historisk lista. Merparten är byggd sedan dess (`status.md`/`bot-hjarna.md`):
- ~~Bot-tumreglerna är basala~~ → bot-hjärna (Monte-Carlo-DDS) byggd & live.
- Minorkontrakt via heuristik: ersatt av kontrakt ur riktig auktion.
- ~~DDS-facit/poängsättning + markeringar/utspel~~ → inkopplade.
- ~~Koppla spelläget till en riktig auktion~~ → gjort (`auction-contract.ts`).

## Tempo, animationer och ljud ("känsla i kortspelet", 2026-07-28 — AKTUELLT)

Spåret som gav kortspelet liv, byggt i fem etapper helt i UI-lagret (spelmotorn
`play.ts`/`claim.ts` orörd, inga nya beroenden). Full etapplogg:
`docs/historik.md`; nuläget per funktion: `docs/status.md`.

- **En sanning om tiderna:** alla spelfasens tider bor i `src/pages/play/tempo.ts`
  (`BASE` + `ms(key, speed)`). Temporaden Lugn/Normal/Snabb i ⋮-menyn skalar
  både JS-pauser och CSS-animationer (`--motion-scale` på bordets Felt).
- **Sticksvepet:** färdigt stick ligger kvar med vinnarglow, sveps sedan mot
  vinnarens sida; botarna väntar, klick hoppar över.
- **Kortflygningen:** spelade kort flyger som WAAPI-klon från handen (eller dold
  hands bordskant) till stickplatsen (`useCardFlight.ts` + `FlightLayer.tsx`).
- **Ljuden:** tre diskreta Web Audio-syntetiserade ljud i `src/lib/sound.ts` —
  kortknäpp, sticksvisch, giv-klar-tick. På/Av i ⋮-menyn (`learnbridge:sound`).
- **Claim-reveal:** godkänd claim (manuell/auto) lägger upp ALLA händer och vyn
  ligger kvar utan timer tills spelaren trycker "Visa resultatet" (ägarbeslut —
  som vid ett riktigt bord). Sedan tonar bordet ut och resultatdialogen får
  guldglow vid hemgång (sobert vid bet).
- **Tillgänglighet:** allt visuellt respekterar `prefers-reduced-motion`
  (reduced-motion-listan i `src/index.css`); JS-pacingen körs alltid så spelet
  förblir spelbart.
- **Facit-tester:** `tempo.test.tsx`, `sticksvep.test.tsx`,
  `kortflygning.test.tsx`, `ljud.test.tsx`, `claimreveal.test.tsx` (alla under
  `src/pages/play/`, seedade givar, tider från `tempo.ts`).

## Rondgenomgången (after action report, 2026-07-29 — AKTUELLT)

Efter en färdigspelad giv kan spelaren öppna en **rondgenomgång**: hela given
förklarad i tre hopfällbara kapitel (inga textväggar — ägarkrav). Nås via
"Rondgenomgång"-knappen i resultatdialogen och i raden under omspelningen.

- **Budgivningen:** varje bud på en egen rad — sits, chip och förklaring.
  Motorns egen regelförklaring när den finns (säker); annars tolkningslagret
  `interpretCall` (`auction-interpret.ts`), som alltid ger text även för nakna
  pass, med ärlig osäkerhetsmarkering ("trolig/gissning tolkning"). ALERT
  visas som i auktionsvyn. Syds rader markeras "(du)".
- **Spelföringen:** varje stick är en egen nästlad dropdown med enradsrubrik
  ("Stick 4 — Öst stal med 3♠"); öppnad visar den korten lagda **i väder-
  strecken som vid bordet** (N överst, S nederst, V/Ö på sidorna, vinnaren
  ringad; ägarönskemål 2026-07-29) och max 4 punkter: utspel, trumfningar/
  sakningar, löpande ställning. **Utspelsregeln (§8.3) skrivs ut i utspels-
  raden** när mönstret stämmer med utspelarens faktiska kort: topp av
  honnörssekvens, singelutspel, och för motspelets öppningsutspel även
  längdmarkeringarna (3:e bästa från jämn längd / lägsta från udda / topp av
  dubbelton — "visar längden för partnern"). Spelförarsidans utspel får ALDRIG
  längdbudskapet (markeringen är försvarets), och passar inget mönster påstås
  ingenting. **Attityd-/räkningsmarkeringar (UDCA) och Lavinthal (2026-07-29,
  §8.5):** botarna lägger dem nu i spelet, och rapporten förklarar allas
  markeringar på en egen ✦-rad per stick (`signalRegel`, re-deriverat ur korten —
  gäller även Syds egna kort). Tryck på ett botkort visar botens motivering (samma
  `botReasons` som på bordet). DD-flaggans ⚠ är röd (`text-danger`) i både rubrik
  och rad.
- **Resultatet (öppet som default — domen först):** kontrakt/utfall/poäng med
  ton (beröm vid egen hemgång och lyckat motspel, läxa vid egen bet, neutralt
  när motståndarna går hem) + claim-notis + **DD-domen**.
- **DD-domen (etapp 3):** `src/lib/engine/rond-dd.ts` (`analyzeDd`) spelar upp
  sticken till varje stickgräns och frågar vår egen facitlösare
  (`doubleDummyDeclarerRemaining`, samma som Facit-knappen) hur många stick
  spelföraren totalt når därifrån. Sjunker facit över ett stick tappade
  spelförarsidan något (⚠-rad i sticket); stiger det släppte motspelet något.
  Resultatkapitlet får domen ("med perfekt spel fanns N stick — ett tappades",
  "ni tog ett stick mer än facit — bra jobbat") + upplysning om en manuell
  claim tog färre stick än facit säkrar. **Ärlig kostnadsgräns:** gränserna
  räknas bakifrån (billigast först); första ställning som spränger nodbudgeten
  (1,5M noder/lösning) avbryter — vyn säger "analysen når från stick X" i
  stället för att frysa. Räknas i webworkern `rapport-worker.ts` (samma mönster
  som MC-workern) via hooken `src/pages/play/useDdAnalys.ts`, med
  inline-reserv; startar först när rapporten öppnas.
- **Arkitektur:** all text byggs av den rena motormodulen
  `src/lib/engine/rond-rapport.ts` (`buildRondRapport`: giv + auktion + stick +
  resultat → rapportdata); vyn `src/pages/play/RondRapport.tsx` renderar bara.
  Perspektivet följer `controls()`: Syd är alltid "du", Nord är "Nord (dina
  kort)" när NS spelför och "Nord (din partner)" i försvar. Spelmotorn orörd,
  inga nya beroenden.
- **Facit-tester:** `src/lib/engine/rond-rapport.test.ts` (textmotorn),
  `src/lib/engine/rond-dd.test.ts` (DD-domen: bokföring, budgetdegradering,
  claim, textrader), `src/pages/play/rondrapport.test.tsx` (vyn +
  reviewing-flödet) och `src/pages/play/useDdAnalys.test.tsx` (inline-reserven).
