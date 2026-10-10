# 👀 Bevaka i spel — rader som väntar på en vakt

> **Regel (ägarbeslut 2026-10-06, översynen):** en rad får bara stå här om den har
> (1) ett frö eller en giv och (2) namnet på testfilen den ska landa i. Raden
> stryks när vakten (facit-test eller sond) finns. "Säg till om det känns fel"-
> rader skrivs inte längre — gränser och doktrin står i `docs/budsystem.md` och
> `docs/bot-hjarna.md`, kända hål utan giv i `docs/senare.md` ("Ur
> bevaka-översynen"). Regeln i `docs/arbetsrutiner.md`.
>
> **Översynen 2026-10-06:** 48 avsnitt → 36 strukna (lagade och facit-vaktade,
> eller historik — fyra "kvar, ej byggt"-rader hade redan gröna facit sedan
> motorbytets slutförande), sju hål flyttade till `docs/senare.md`,
> kontrollbudsloggen till `docs/historik.md`. Bakgrund: 0 av 99 felrapporter
> säger "igen" (mätt 2026-10-06: `gh issue list --repo PGreen90/Learn-Bridge
> --label felrapport --state all --limit 200 --json body`) — hålen sitter i
> obevakade principer, inte i rapporterna.

## Väntar på vakt (nyast först)

### Fynd D — byt färg när spelföraren visat längd i utspelsfärgen (frö 20260907, ägarbeslut 2026-10-06)
- **Regeln (ägarens ord):** den som vinner första sticket i partnerns utspelsfärg
  fortsätter INTE färgen när spelföraren visat stopp och längd i den via
  budgivningen och partnerns utspelskort är en hög hacka utan positivt sak. "ALLA
  skall ta hänsyn till budgivningen" — försvaret letar efter motståndarnas svaghet.
- **Given:** Öst 1♥, Syd X sedan 2NT (stopp + 20–21). Väst ♥9 (singel), Öst ♥A,
  sedan ♥6 in i Syds ♥KQT43 = −1 (DD 8 → 9). Rätt: ♠K sedan ♠Q (Syd duckar
  första gången, esset faller andra), Västs ♠JT9xx fria, ♣K är ingången.
  Hp räknade med kod: N 3 · E 14 · S 19 · W 4.
- **Vakt:** `src/lib/engine/play-bot-byt-farg.test.ts` (`it.todo`: beteende +
  DD-lås). Byggs i speldiagnosens nästa runda (NÄST 2) med DD-mätning per
  alternativ (S6-metoden). Repro: `DUMP_SPEL=20260907 npx vitest run
  src/lib/engine/speldump.probe.test.ts`.

### Tredje hand i sang: ♠8 under partnerns ♠7 fast ♠A fanns (felrapport #96, stick 11)
- **Läget:** 2NT av Väst, bricka 11 (giv Syd, ingen i zon). Nord ♠A98 kvar, Syd
  leder ♠7, Väst ♠6 — Nord la ♠8, träkarlen (Öst, ♠Q32, spelar EFTER Nord) vann
  på ♠Q. ♠A och sedan ♠9 (Syd ♠KJ över Östs ♠32) ger NS alla tre sista sticken;
  ♠8 kostade ett stick. Händerna i issue #96.
- **Vakt:** `src/lib/engine/play-bot-third-hand.test.ts` ("Felrapport #96, stick
  11", `it.todo`: beteende + DD-lås). Hör till T-serien (tredje hand högt: väg
  träkarlen som ligger EFTER mig) — parallellt ägarsteg, `docs/speldiagnos.md`.

> **När läser Claude den här filen?** När en felrapport eller ett fältfynd ska få
> en rad (kräver frö/giv + måltestfil), och när en regel landar (stryk raden).
> "Något känns fel i spel" går via /felrapporter, inte via den här listan.
