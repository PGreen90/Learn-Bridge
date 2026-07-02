---
description: Läs felrapporter (GitHub-issues) från Spela kort, återskapa given som test (FACIT FÖRE FIX), laga felet och stäng issuen.
---

# /felrapporter — laga inrapporterade fel från Spela kort

Ägaren rapporterar fel direkt i appen (Spela kort → "Kändes något fel?
Rapportera given"). Rapporten blir en GitHub-issue med etiketten `felrapport`
som innehåller HELA given maskinläsbart. Din uppgift: läs rapporterna,
återskapa varje giv som test, laga felet, stäng issuen.

## Arbetsgång

1. **Lista öppna rapporter:**
   `gh issue list --repo PGreen90/Learn-Bridge --label felrapport --state open`
   Inga öppna? Säg det till ägaren och stanna.

2. **Läs en rapport i taget** (äldst först):
   `gh issue view <nummer> --repo PGreen90/Learn-Bridge`
   Kategorin + ägarens fritext säger vad som kändes fel; det maskinläsbara
   blocket (se format nedan) innehåller hela given.

3. **FACIT FÖRE FIX — alltid.** Återskapa given som ett test INNAN du rör
   någon kod:
   - Händerna parsas med `parseHand` (`src/lib/bidding.ts`) — formatet i
     `hand`-raderna är exakt det `parseHand` läser.
   - **Felaktig budgivning / fel budförklaring:** bygg auktionen med
     `decideCall` (`src/lib/engine/auction-live.ts`) från givens dealer och
     verifiera att motorn bjuder som i rapportens `budgivning:`-rad. Lås det
     RÄTTA budet som facit — fråga ägaren om rätt bud är oklart
     (ägarbeslut går före gissning, se CLAUDE.md).
   - **Datorn spelade korten fel:** återskapa ställningen med `startPlay` +
     `playCard` (`src/lib/engine/play.ts`) fram till det ifrågasatta sticket
     och lås rätt kort/sticksumma som facit (DDS/Monte-Carlo-verktygen finns
     i `src/lib/engine/`).
   - **Fel i resultat/poäng:** lås rätt resultat mot `contractResult`.
   - Lägg testet i den testfil som äger den berörda regeln (samma mönster
     som övriga facit-lås). Se testet FALLA först.

4. **Laga felet** tills facit-testet (och hela `npm test`) är grönt.
   Ändra aldrig on-book-beteende utan att befintliga facit-lås skyddar det.

   **Förklara alltid ORSAKEN till felet för ägaren** (ägarbeslut 2026-07-02),
   på enkel svenska, i sammanfattningen efter fixen: inte bara VAD som var fel
   i given, utan VARFÖR koden gjorde fel (vilken regel/tumregel som brast och
   varför den resonerade som den gjorde) och hur fixen ändrar resonemanget.

5. **Stäng issuen med förklaring på enkel svenska:**
   `gh issue close <nummer> --repo PGreen90/Learn-Bridge --comment "..."`
   — vad som var fel, vad som ändrades, vilket test som låser det.
   OBS: stäng först när fixen är pushad (fråga ägaren före push, som alltid).

6. **Flera rapporter?** Ta nästa. Sammanfatta till ägaren när alla är klara.

## Det maskinläsbara formatet (block märkt ```felrapport i issue-texten)

```
version: 1
bricka: 5                     ← bricknummer
giv: N                        ← dealer (N/E/S/W)
zon: ns                       ← none/ns/ew/all
hand N: S:AKQ4 H:32 D:QJ2 C:T987   ← parseHand-format, T = tia, - = renons
hand E: …                     ← alla fyra händer (N, E, S, W)
hand S: …
hand W: …
budgivning: 1NT P 3NT P P P   ← alla bud i ordning från dealern
kontrakt: 3NT N               ← nivå+färgkod(C/D/H/S/NT) + spelförare,
                                eller "utpassad"
stick 1: E HQ HK H6 H2 (S)    ← utspelare, korten i spelad ordning
                                (färgbokstav+valör), vinnaren i parentes;
                                en rad per spelat stick
```

Formatet är test-låst i `src/lib/felrapport.test.ts` — ändras rapporten i
appen måste det testet och den här filen uppdateras ihop.
