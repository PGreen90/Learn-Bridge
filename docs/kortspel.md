# Kortspel — spela ut korten mot bottar (arbetslista punkt 29)

> Spec + byggplan för spelläget: efter att ett kontrakt är satt spelas de 13
> sticken ut. Ägaren (Syd) spelar mot tre bottar. "Avslut + motspel" = ägaren
> kan vara både spelförare och motspelare. Status längst ned.

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

## Status
- ✅ Plan godkänd + vägval beslutade.
- ✅ **Steg A – spelmotorn** (`play.ts`): `startPlay`, `legalCards` (följa färg),
  `playCard` (stickvinnare m. trumf, stickräkning), `currentWinner`, `isComplete`,
  `contractResult`. Ren, immutabel, kastar vid olagligt kort.
- ✅ **Steg B – bottar** (`play-bot.ts`): `botCard` tumregler (utspel lågt från
  längsta färg; vinn billigt; annars lågt). 10 tester gröna, inkl. en hel
  bot-mot-bot-utspelning (13 giltiga stick i både trumf och sang).
- ☐ **Steg C – kontraktval** (`pickContract`).
- ☐ **Steg D – UI** spelläge (klicka korten, bordsvy, stickräkning, resultat).
