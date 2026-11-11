---
name: lagga-till-traningstema
description: Så lägger man till eller ändrar ett tema i rebidz motordrivna budträning — temat är en budsituation (ett predikat över auktionen) i src/lib/engine/traning.ts, motorn delar givarna och motorns eget bud är facit. Använd när ett nytt träningstema ska skapas, ett tema ska snävas/breddas eller träningssidorna ska ändras.
---

# Lägga till ett träningstema (motordriven budträning)

Budträningen har INGA handskrivna övningar längre (de gamla JSON-filerna
pensionerades 2026-11-11). Ett tema är en **budsituation**; motorn delar
slumpgivar tills Syd hamnar i den, och facit är `decideCall` — motorns eget
bud med dess egen förklaring. Träningen kan därför aldrig lära ut något annat
än det bottarna spelar.

## Var saker bor
- **Temana + generatorn:** `src/lib/engine/traning.ts` (`TRANINGSTEMAN`,
  `lageIGiv`, `traningsgiv`).
- **Facit-testet:** `src/lib/engine/traning.test.ts` — kör varje tema: hittar
  givar inom budgeten, facit = motorns lagliga tabellbud, förklaring finns.
- **Sidorna:** `src/pages/Budtraning.tsx` (temalistan) och
  `src/pages/BudtraningTema.tsx` (ett pass, riktiga budlådan).
- **Formen per tema** (senaste 20 svaren): `loadTraningslogg` /
  `sparaTraningssvar` i `src/lib/backend/index.ts`.

## Tre sidofunktioner (samma fil)
- `fortsattGiv`: nästa beslut i samma giv ("Fortsätt budgivningen").
- `forstaMissen` / `missSomGiv` / `MISSTEMA`: "Träna dina missar" — första
  budet i en färdig tävlingsgiv där Syd avvek från motorn. Sparas i
  `DagensTavling.tsx` när given är klar (`loadTraningsmissar` /
  `saveTraningsmissar`); facit räknas om mot dagens motor vid uppspelning.

## Ett nytt tema
Lägg ett objekt i `TRANINGSTEMAN`:
- `id` (kebab-case, blir adressen `/budtraning/<id>` och lagringsnyckeln — byt
  aldrig ett id som användare redan har statistik på),
- `titel`, `beskrivning` (en rad), `intro` (2–4 meningar, klarspråk: vad budet
  LOVAR, inga interna regelnamn), `paragraf` (hänvisning till
  `docs/budsystem.md`, börjar med §),
- `passar(l)`: predikatet. `l.bud` = alla riktiga bud före Syds tur, `l.svar` =
  motorns bud, `l.hp`, `l.hand`, `l.sydHarBjudit`. Använd `platser(l, 'N', …)`
  för ostörda följder.
- `sent: true` bara om läget ligger sent i auktionen (slam) — annars slutar
  generatorn leta efter nio bud.

## Regler
- **Facit är alltid motorn.** Skriv aldrig in ett "rätt svar" för hand. Tycker
  du att motorn bjuder fel i ett tema är det en regeländring (tabellrad +
  `docs/budsystem.md`), inte en träningsändring.
- **Sålla bort ointressanta pass**, inte intressanta: `l.svar !== 'P' ||
  l.hp >= N` är mönstret. "Pass är rätt" ska finnas kvar som svar ibland.
- **Mät temat innan du är nöjd:** svarsfördelning och tid över ~200 givar (en
  tillfällig testfil som skriver till TEMP och tas bort efteråt). Ett tema där
  ett enda bud dominerar helt, eller som tar sekunder per giv, är för snävt.
- Intro-texten ska stämma med systemboken — ändras regeln där ändras texten här.
- Kör `npx vitest run src/lib/engine/traning.test.ts` och sedan `npm test`.
