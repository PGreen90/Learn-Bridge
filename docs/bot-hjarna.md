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

## Status (2026-07-02): HELA EPOSET KLART & live (testsvit 727)
Trappan (Steg 1–3) + hela FAS 11-svansen är byggd:
- **Signalavkodning (pt 50, `signal-decode.ts`):** motspelaren läser botens
  öppningsutspel (§8.3) → skärper hand-modellen (längd ≥4 + touchérande honnör när
  entydig). Hand-modellen fick per-färg-HP-spann (`suitHcp`) som samplaren håller.
  Bara bottars utspel avkodas (ingen tjuvkik på människan).
- **"Varför?"-knapp:** `botCardReasoned`/`botCardSmartReasoned` (`play-bot.ts`) ger
  klartextsmotivering per drag; `Play.tsx` visar "Öst spelade 3♣. Varför?".
- **Tänj MC-fönstret + webworker:** MC körs i `mc-worker.ts` av huvudtråden (ingen
  frys), adaptiv `mcBudget`, fönstret 7 → 8 kort. Uppmätt: 7 kort ~2 s, 8 kort ~3,7 s.
- **pt 47–49 (`signals.ts`):** facit-granskad mot §8, luckor låsta.

Se `docs/status.md` för detaljer.

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
- **"Varför?"-knapp** — ✅ byggd (se status ovan).
- **Avancerad teknik** — slutkast/inkast (endplay/throw-in) + squeeze i
  spelförarplanen. **= NUVARANDE NU (ägarval 2026-07-02), trappa nedan.**

## Avancerad teknik — trappan (NU sedan 2026-07-02)
> **Nyckelinsikt:** Monte-Carlo-DDS:en hittar redan slutkast & skvis *automatiskt*
> i slutspelsfönstret (≤8 kort) — DDS:en ser tekniken i varje sampel, och
> röstningen gynnar linjer som fungerar i ALLA lägen (ett slutkast är 100 %,
> masken 50 %). **Luckan är förberedelsen vid 9–13 kort:** där spelar tumregler
> som kan sabotera positionen INNAN fönstret öppnas — kasta hotkort i förtid,
> casha i blockerande ordning, missa att rätta stickräkningen. Trappan:
- **Steg A ✅ KLAR (2026-07-02) — Facit-lås på exekveringen (FACIT FÖRE FIX):**
  `play-bot-technique.test.ts`, tre DDS-verifierade givar där MC når facit och
  tumregeln tappar stick (alla robusta över seedar 1–10, seedad mulberry32):
  - **A0 korsruff m. lönnkast** (6-korts, ♠-trumf): facit 6 av 6 — Nord sakar
    ♥8 på ♦E, ♥7 ruffas hos Nord, klöver hos Syd, ♦D ruffas över täckande K.
    MC 6, tumregel 5 (cashar rakt, tappar hjärtern).
  - **A1 slutkast/inkast** (6-korts, ♠-trumf): facit 5 — Öst har VISAT
    ruterrenons (sakade på ett tidigare ruterstick) → hand-modellen tvingar
    ♦K/kn till Väst i varje sampel (äkta inferens!). Rakt spel 4 (♦D alltid
    bakom garderad K, ingen Nord-ingång); 5 bara via strip & ♥7-exit — Väst
    inkastad: ruter in i gaffeln, ruff-och-släng, eller Nord ruffar över.
    MC 5, tumregel 4.
  - **A2 enkel skvis** (4-korts, NT): facit 4 — Väst vaktar båda hoten (♠K4+♥K4
    mot ♠E5+♥E5), ♦E skviskortet. Nyckeln är Nords avkast: MC räknar ärligt
    (en osedd spader kvar men två hjärter → behåll ♠E5) och tar 4; tumregeln
    kastar "lägst", river sitt eget hot → 3.
  - **Lärdomar:** (1) testhjälparen `fabricate` måste låta SYD leda första
    fyllnadssticket — annars läser signalavkodningen (pt 50) ett fabricerat
    "öppningsutspel" från dold plats och förgiftar samplingen → tyst
    tumregel-fallback. (2) MC-DDS kan INTE värdera informations-/garantivinster
    som skiljer per-sampel-optimala linjer (per-sampel spelar DDS alltid
    "rätt" mask) — diskriminering kräver att tekniklinjen är bättre ÄVEN
    dubbeldummy per sampel (A1 löser det via Östs visade renons).
- **Steg B ✅ KLAR (2026-07-02) — Bevara positionen (9–13 kort, spelförarsidan):**
  - **B0 facit-giv** (`play-bot-technique.test.ts`): 9-korts NT-skvis där Nords
    FÖRSTA sakning sker vid 9 kort = utanför MC-fönstret. DDS-låst: facit 6;
    sakas hotkortet ♠5 faller facit till 5 — och det var precis vad gamla
    "kasta lägst"-tumregeln gjorde. Design-lärdomar (fyra oracle-iterationer!):
    ge inte spelföraren fria topstick som når taket ändå (då är hoten aldrig
    lastbärande), täck motspelarens inkast-reserv (Östs ♥6 punkterar Västs
    ♥4-utspel som plan B) och kapa dummy-hackornas längdstick (Östs ♦kn10xx).
  - **B1 kast-vakt** (`guardedDiscard`, `play-bot.ts`): när SPELFÖRARSIDAN sakar
    väljs inte längre blint lägsta kortet. Ärlig räkning (egen sida + spelat):
    ett kort är *lastbärande* om osedda högre kort ≤ egna sidans högre kort
    (våra toppar drar ut dem). Saka: (1) icke-lastbärande, lägst först;
    (2) annars djupast överskott (flest egna högre kort över sig), lägst vid
    lika. Bara spelförarsidan (motspelarnas sakningar orörda — deras inferens
    är ett senare arbete). Sidoeffekt: gamla 6-korts-referensen i
    `play-bot-smart.test.ts` lyftes 2→3 av vakten ensam (uppdaterad + låst).
  - **B2 cash-ordning (blockera inte)** = EJ byggd — byggs bara om en facit-giv
    visar behovet (ingen har gjort det än).
- **Steg C (om B inte räcker) — Rätta räkningen:** ducka ett stick medvetet när
  stickräkningen behöver rättas för en skvis (svårast; byggs bara om facit-givar
  visar behovet).

**Beslutat SENARE (ägaren 2026-07-01):**
- **Svårighetsnivåer** — samma hjärna med rattar (nybörjar-tumregler → expert
  inferens+Monte Carlo). Byggs in när kärnan står.

## Arbetsregler (som resten av felsökningsplanen)
- FACIT FÖRE FIX (testrad: giv → rätt kort) + hela `npm test` efter varje fix.
- Ingen tjuvkik: botten får bara använda ärligt känd information.
