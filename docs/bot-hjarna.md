# Bot-hjärnan — expertspel via ärlig inferens (FAS 11+)

> **Vision (ägaren 2026-07-01):** bottarna ska *läsa bordet* som en expert —
> räkna de 40 HP:na, dra bort det som visats i budgivningen och det som redan
> fallit, och lista ut *var resten sitter*. Det är **enkeldummy-inferens**
> (single-dummy): resonera om de tre dolda händerna utifrån budgivning + spelade
> kort + markeringar.
>
> **Bakgrund:** dagens bottar (`play-bot.ts`) spelar rena nybörjar-tumregler och
> tar därför t.ex. 10 stick där 13 var kalla — de cashar inte sina vinnare och
> "kryper under i onödan". FAS 11 (signaler) löser INTE det; det kräver bättre
> stickföring + inferens. Denna fil är kartan för det arbetet.

## Järnprincip: ingen tjuvkik
Vår DDS i `dds.ts` är **dubbeldummy — den ser alla fyra händerna**. Kopplas den
rakt in i botten spelar den perfekt genom att *titta på spelarens kort* → den
fuskar (vet alltid var damen sitter). Det är fel för en läro-app.

Därför byter DDS roll: den ska resonera över **troliga** kort, inte de riktiga.
Guldstandarden är **Monte Carlo**: dela ut många slumpade givar som stämmer med
allt vi *ärligt* vet → kör DDS på var och en → spela kortet som vinner oftast.
Så spelar starka bottar i världen (GIB m.fl.).

## Trappan (byggs i ordning, test-låst — FACIT FÖRE FIX)

### Steg 1 — Ärlig stickföring (stoppa blödningen)
Räknande tumregler *utan* tjuvkik, i `play-bot.ts`:
- **Cash:a säkra vinnare** när man är inne: ett kort är en *säker vinnare* om
  ingen högre kort i färgen är ospelat (räknas ärligt: högre rankar i färgen
  minus spelade minus egna = 0 kvar). Botten leder då sin vinnare i stället för
  ett lågt spotkort ur längsta färgen.
- **Kryp aldrig under** med kortet som just nu är högst kvar i en färg.
- **Gräns (Steg 1a):** cash-out gäller sang + trumffärgens vinnare. Sidofärgs­-
  vinnare i trumfkontrakt (kan ruffas) skärps i Steg 1b/Steg 2 via känd renons
  (motståndare som redan visat sig sakna färgen).
- Äkta *utspel* (trick 1, motspelaren) rörs inte — det är utspelsdoktrin (§8.3).

### Steg 2 — Hand-modellen (ryggraden = din vision)
En **inferensmotor** som för varje dold hand håller ett *spann*:
- **HP min/max** (de 40 HP:na, ärlig liggare).
- **Färglängder** (min/max per färg).
- **Kända renonser** (någon följer inte färg = renons — starkaste inferensen).
- **Utpekade kort** (specifika honnörer som budgivningen låser).

Seedas från **auktionen** — vi har redan budmotorn som vet exakt vad varje
plats *visat och förnekat* (13–15 hp, 4 spader, förnekad högfärg …). Skärps
varje gång ett kort faller och varje gång en markering läses. Substrat under
allt: **korträkning per färg, HP-räkning, fördelningsräkning, budinferens,
restricted choice** (Bayes på touchérande honnörer).

### Steg 3 — Monte-Carlo-DDS + signalavkodning
- **Monte Carlo:** sampla N givar som stämmer med hand-modellen → DDS var och en
  → rösta fram kortet som vinner oftast. Här används DDS *ärligt*. Nod-/tids­-
  budget i webbläsaren (samma sorts gräns som DDS-facit) styr N.
- **Signalavkodning (FAS 11 punkt 50):** motspelaren *läser* partnerns
  markering (attityd/räkning/färgpekning) → matar in i hand-modellen.

### FAS 11 (felsökningsplanens punkt 47–51) — vävs in
- 47 Utspel (topp av sekvens, 3:e/5:e), 48 UDCA, 49 Lavinthal: sändarna finns i
  `signals.ts` → facit-granskas mot §8. 50 Signalavkodning = Steg 3-input.
  51 DDS-gränsfall = känd gräns, bekräftas bara.

## Vad mer som bor i hjärnan (framtida moduler)
**Räknesubstrat (ryggrad):** korträkning, HP-liggare, fördelning, budinferens,
restricted choice. **Spelförarplan:** planera före kort 1 (räkna vinnare/
förlorare), färgbehandling (finess vs. fällning, säkerhetsspel), trumfhantering,
hålla upp/klippa förbindelse, ingångar. **Motspel:** utspel styrt av auktionen,
räkna spelförarens hand, täcka honnör med honnör (bara när det befordrar), räkna
motspelets stick. 

**Beslutat MED i scopet (ägaren 2026-07-01):**
- **"Varför?"-knapp** — botten förklarar sitt kortval i klartext (parallell till
  budförklaringslagret). Bygger på att hjärnan redan resonerar → in efter Steg 2–3.
- **Avancerad teknik** — slutkast/inkast (endplay/throw-in) + squeeze i
  spelförarplanen. Monte-Carlo-DDS fångar redan en del automatiskt.

**Beslutat SENARE (ägaren 2026-07-01):**
- **Svårighetsnivåer** — samma hjärna med rattar (nybörjar-tumregler → expert
  inferens+Monte Carlo). Byggs in när kärnan står.

## Arbetsregler (som resten av felsökningsplanen)
- FACIT FÖRE FIX (testrad: giv → rätt kort) + hela `npm test` efter varje fix.
- Ingen tjuvkik: botten får bara använda ärligt känd information.
