---
description: Kör speldiagnosen (bottarna spelar givar, DD-facit larmar), klassa larmen systemfel/ärlig miss, skriv rapport till ägaren. Ingen reparation utan ägarens ja.
---

# /speldiagnos — spela, felsöka, diagnostisera, rapportera

Speldiagnosens agent-steg (riggen: `docs/speldiagnos.md` — LÄS DEN FÖRST).
Bottarna har spelat givar och DD-facit har larmat; din uppgift är att GRANSKA
larmen, klassa dem och skriva en rapport ägaren kan besluta på.

> **Bärande princip (ägaren 2026-08-12): RÄTT, inte max antal stick.** Ett
> DD-larm är en kandidat, inte ett fel. DD ser alla 52 korten — boten får bara
> sin ärliga information (budgivningen, synliga kort, markeringar). Döm beslutet
> på DEN informationen.

## Arbetsgång

1. **Skaffa färsk data.** Finns `revisor-output/speldiagnos-latest.json` från i
   dag/i går? Använd den. Annars kör (20–40 min i en process; fyra parallella
   skivor går snabbare — se `docs/speldiagnos.md`):
   `SPELDIAG=1 npx vitest run src/lib/engine/speldiagnos.probe.test.ts`
   För tävlingsförscreening i stället:
   `TAVLING_DIAG=<YYYY-MM-DD> npx vitest run src/lib/engine/tavlingsdiagnos.probe.test.ts`
   (kräver `DAILY_SEED_SECRET` i `.env.local`; datumet räknar du ut själv —
   morgondagens tävlingsdag i Europe/Stockholm.)

2. **Gruppera larmen.** Budsidan: kategorier per `MissCategory`, korsläs mot
   M-seriens baslinje i `docs/systemrevisorn.md` (är kategorin känd/bevakad
   redan?). Spelsidan: tapp per roll (utspel/spelförare/försvar), värsta givar
   först.

3. **Granska topp-fröna.** För varje larm värt att utreda:
   `DUMP_SPEL=<frö> npx vitest run src/lib/engine/speldump.probe.test.ts`
   Dumpen visar varje kort med botens EGET skäl och ⚠ där DD rörde sig.
   För budlarm: `DUMP=<frö> npx vitest run src/lib/engine/auktionsdump.probe.test.ts`.

4. **Systemriktighetsdomen — kärnan.** Klassa varje granskat larm:
   - **systemfel** — boten bröt mot systemet (`docs/budsystem.md`) eller sund
     spelteknik PÅ DEN INFORMATION DEN HADE (t.ex. cashar inte en etablerad
     färg, ruffar partnerns stick, bryter mot markeringsreglerna §8) →
     fixkandidat.
   - **ärlig miss** — beslutet var rätt på tillgänglig information; facit
     råkade ligga fel (masken satt fel, dold fördelning, tvåvägs-gissning) →
     INGEN åtgärd. Det är så bridge ska spelas.
   - **oklart** — behöver ägarens bridgeomdöme eller djupare analys.
   Endast systemfel föreslås för reparation. Var kalibrerad: en tveksam
   klassning är "oklart", inte "systemfel".

5. **Skriv rapporten** till `revisor-output/speldiagnos-rapport-<datum>.md`
   på enkel svenska (ägaren är nybörjare — inga tekniska termer utan
   förklaring). Per fynd: en mening om vad som hände, klassningen, kostnaden
   (stick/poäng), exempelfrö + repro-kommando, och förslaget
   **laga / bevaka / lämna**. Avsluta med en beslutslista ägaren kan svara på.
   **INGEN reparation i det här steget** — presentera rapporten och stanna.

6. **När ägaren valt:** varje fix är en egen runda enligt husreglerna —
   facit-test FÖRE fix (fröet → test), fixen, `docs/budsystem.md`-paragraf om
   en budregel ändras, omkörning av proben = ny mätpunkt **S<N>** i
   `docs/speldiagnos.md` (sifferregeln: kommandot bredvid siffran), och en
   rad i `docs/bevaka.md`. Fråga ägaren före push, som alltid.
