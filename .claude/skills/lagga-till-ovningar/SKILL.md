---
name: lagga-till-ovningar
description: Så lägger man till budövningar i rebidz — JSON-formatet i src/data/exercises, registret EXERCISES_BY_THEME, handnotationen ("S:AK974 H:K83 …"), auction-stegen och lägena (scope). Använd när en ny övning, ny temafil eller ett nytt tema ska skapas eller ändras.
---

# Lägga till övningar

Flyttad hit från `CLAUDE.md` 2026-07-28 (den laddades varje session men behövs
bara när övningar faktiskt byggs). Reglerna är oförändrade.

- JSON i `src/data/exercises/<tema>.json`; ny temafil måste importeras och läggas
  till i registret `EXERCISES_BY_THEME` (`src/lib/bidding.ts`).
- Hand som text: `"S:AK974 H:K83 D:Q6 C:J52"` (tian = `T`, tom färg = `-`, parsas av
  `parseHand`).
- En övning = `auction`: lista med steg — manus-bud `{ "bid": "1H" }` eller ditt
  beslut `{ "decision": { "options": [...], "answer": "1S", "explanation": "..." } }`.
  Vem som bjuder räknas ut från `dealer` + medurs N→E→S→W.
- Bud skrivs `"1C"/"1D"/"1H"/"1S"/"1NT"` samt `"P"`, `"X"`, `"XX"`.
- Lägen (scope): `opening`, `opening-response`, `full-auction` — sätts i
  `src/data/themes.json`.

Kör `npm test` efteråt: övningsdatan är test-täckt, så trasig JSON eller ett tema
som saknas i registret ger rött test (och därmed stoppat Vercel-bygge).
