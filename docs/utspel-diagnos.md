# Utspel — komplett diagnos + byggordning

> **Status:** diagnos (2026-08-04, ägarbeslut "gör en full diagnos av utspelet
> innan vi bygger vidare"). Ingen kod ändrad utöver den punktvisa ess-fixen
> 2026-08-04 (se `docs/budsystem.md §8.3/§9`). Det här dokumentet kartlägger HELA
> utspelslagret, mäter det mot standarddoktrin och lägger en **beslutad,
> prioriterad byggordning** (hål A–G). Betas av en sak i taget — CLAUDE.md 🔵 NU
> pekar hit när utspelsspåret återupptas.

## 1. Hur ett utspelskort faktiskt väljs (anropskedjan)

I appen spelar boten via `botCardSmartReasoned(state, seat, calls)`
(`src/pages/play/usePlayTable.ts`). Den funktionen får **budgivningen** (`calls`)
och kör bot-hjärnan (Monte-Carlo-DDS) på en hand-modell som seedats ur auktionen.

**Men på utspelet (trick 1) kopplas allt detta bort.** I `play-bot.ts`
(`botCardSmartReasoned`):

```
const openingLead = state.completedTricks.length === 0 && state.currentTrick.length === 0
if (openingLead || cardsLeft > maxCards) return botCardReasoned(state, seat)
```

`botCardReasoned(state, seat)` tar **inte** emot `calls`. Kärnslutsatsen:

> **Utspelet ignorerar budgivningen helt.** Boten leder samma kort oavsett vad
> som bjudits — den vet inte partnerns bjudna färg, motståndarnas bjudna färger,
> om någon visat en kort färg, eller om utgången är tunn (aggressivt utspel) eller
> stark (passivt). Den ser bara sin egen hand och tar "längsta färgen".

Det är alltså inte ett fel i EN regel — hela regeluppsättningen för utspel är
rudimentär OCH budblind.

## 2. Reglerna som finns idag (trick 1)

Kärnan är `openingLeadChoice` → `leadFromSuit` (`signals.ts`), i tur och ordning:

| # | Regel | Var | Vad den gör | Bedömning |
|---|-------|-----|-------------|-----------|
| 1 | Underled aldrig ess mot färgkontrakt | `openingLeadChoice` (play-bot.ts) | Längsta färg utan ess-underspel; annars cashar esset | ✅ korrekt, men **bara trick 1** |
| 2 | Honnörssekvens | `honorLead` (signals.ts) | Topp av *strikt sammanhängande* sekvens J+: AK→A, KQ→K, QJ→Q, JT→J | ⚠️ saknar inre/brutna sekvenser |
| 3 | Spotkort 3:e/5:e | `spotLead` (signals.ts) | Jämn längd → 3:e bästa; udda → lägsta; dubbelton → högsta | ✅ ok som spotdoktrin |
| 4 | Avblockning | `unblockLead` (play-bot.ts) | Bara spelförarsidan: led lågt in i synlig singel-honnör hos medspelaren | ✅ korrekt (felrapport #17) |

Färgvalet är annars alltid **"längsta färgen"** (`longestSuit`) — ingen hänsyn
till styrka, sekvens i en kortare färg (utom ess-vakten), eller budgivning.

## 3. Var utspel också väljs (mitt i given)

Samma primitiver återanvänds när boten kommer in senare (`botCardReasoned`,
grenen "på lead, mitt i given"):

- **"Jag är inne och spelar ut ur min längsta färg"** → `openingLead(legal)`.
  **Kan fortfarande underleda ett ess mot slam** — ess-fixen 2026-08-04 täckte
  bara trick 1. (Hål F.)
- **Fortsätter partnerns utspelsfärg** → `leadFromSuit(attack)`. Underspel där är
  oftast rätt (man returnerar partnerns färg), låg prioritet.

## 4. Hålen mot standarddoktrin — rangordnade efter kostnad

**A. Budgivningen ignoreras (störst).** Ingen "led partnerns bjudna färg", ingen
"undvik motståndarnas bjudna färg", ingen "led trumf när auktionen ber om det",
ingen aggressiv/passiv kalibrering efter hur stark deras utgång/slam lät. Detta är
den enskilt största bristen och grundorsaken till att utspelet känns opålitligt.

**B. Inga brutna/inre sekvenser.** Från **KJT9** leder boten *tian* (3:e bästa) —
standard är knekten (topp av inre sekvens). Samma klass: KQ10 (led 10 mot NT),
QJ9, KJ10, AQJ (mot NT). `honorLead` kräver strikt sammanhängande topp från J+.

**C. Ingen trumf-utspelsregel.** Passivt trumfutspel (vanligt mot slam och för att
klippa spelförarens ruffar) finns inte alls.

**D. Ingen kort-färg/singel-för-ruff-logik.** Att leda en singel mot ett
färgkontrakt för en ruff är en klassisk plan — boten söker den aldrig.

**E. Sang behandlas som färgkontrakt i färgvalet.** Mot NT ska man leda "längsta
OCH starkaste", ofta 4:e bästa, gärna partnerns bjudna färg. Boten tar bara
"längsta" och skiljer inte NT-färgvalet från färgkontraktets.

**F. Mitt-i-given-utspelet kan fortfarande underleda ess** (residual av
2026-08-04-fixen — bara trick 1 hanterat).

**G. Underleda KUNG mot slam** är inte hanterat (mer diskutabelt; lägst
prioritet).

## 5. Beslutad byggordning (en sak i taget, facit före fix)

Ordningen är vald efter **kostnad/risk-kvot**: störst nytta med lägst
regressionsrisk först, och grundstenar före sådant som bygger på dem. Varje steg
är sin egen 🔵 NU med eget facit-test och (där relevant) en netto-mätning.

1. **Hål B — inre/brutna sekvenser — KLART 2026-08-04.** `honorLead` (`signals.ts`)
   känner nu igen inre sekvens (Kkn10→kn, K109→10, D109→10, Akn10→kn, ADkn→D).
   Facit `signals.test.ts`. Detalj: `budsystem.md §8.3/§9`.
2. **Hål F — mitt-i-given ess-underspelet — KLART 2026-08-04.** Kortvalet bröts ut
   till `chooseLeadCard` (`play-bot.ts`) som nu även mitt-i-given-utspelet använder;
   ess-regeln gäller överallt, inte bara trick 1. Facit `play-bot.test.ts`.
3. **Hål E — skilj NT-utspel från färgutspel** (medel). Mot NT: längsta OCH
   starkaste färgen, 4:e bästa som spotdoktrin. Fortfarande budblint, men rätt
   *inom* handen. Förbereder steg 4.
4. **Hål A — koppla in budgivningen (störst).** Ge utspelet `calls` (ändra
   trick-1-grenen så den skickar auktionen vidare) och bygg en riktig
   prioritetsordning: partnerns bjudna färg → sekvenslead → undvik motståndarnas
   färg → passivt/aggressivt efter kontraktsstyrka. Störst jobb, störst effekt;
   görs sist av de stora eftersom steg 1–3 lägger grunden.
5. **Hål C + D — trumf-/singelutspel** (kräver A:s budkontext för att vara
   meningsfulla). Passivt trumfutspel mot slam; singel-för-ruff mot färgkontrakt.
6. **Hål G — underleda kung mot slam** (litet, diskutabelt, sist). Utvärdera om
   det ens ska byggas; kan hamna i ⚪ SENARE.

### Arbetsregler för spåret
- **Facit-testet skrivs FÖRE fixen** (`play-bot.test.ts` / `signals.test.ts`).
- **Varje regeländring skrivs in i `docs/budsystem.md §8.3`** (produktyta) + §9.
- **Netto-mätning** där en fix kan flytta spelutfall: `play-quality.probe` /
  `play-establish.probe` (gatade, seedade) — samma arbetssätt som spelmotor-fixarna
  (`docs/bot-hjarna.md`, minnet [[spelstyrka-probe-workflow]]).
- Utspelets budkontext (steg 4) är den enda foundation-ändringen — den presenteras
  med exempelgivar för ägaren INNAN den byggs (minnet [[hold-foundation-changes-under-autonomy]]).
