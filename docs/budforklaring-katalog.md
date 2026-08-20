# Budförklarings-katalogen (FAS 2)

Granskningsytan för budförklarings-revisionen. Varje rad = en situation där en
förklaringstext visas när man trycker på budet. **Nuvarande** = texten som
renderas idag (exempelvärden ifyllda). **Din formulering** = din omskrivning
(lämna tom = behåll). När du fyllt i det du vill ändra applicerar Claude det i
motorn, testvaktat.

Källa per batch anges. Texterna är dynamiska mallar — siffror/färger byts mot
handens verkliga värden; här visas ett typiskt utfall.

---

## Batch 1 — Öppningarna  ·  källa: `src/lib/engine/openings.ts`  ·  ✅ APPLICERAD 2026-08-19

Klarspråkad enligt "så tydligt som möjligt". **Före → Efter.** Säg till om du vill
tweaka någon rad.

| # | Situation | Före | Efter (live) |
|---|---|---|---|
| 1 | 1NT 15–17 | Balanserad 16 hp (15–17) → 1NT. | *(oförändrad)* |
| 2 | 2NT 20–21 | Balanserad 20 hp (20–21) → 2NT. | *(oförändrad)* |
| 3 | 2NT "bra 19" | Balanserad bra 19 (19 hp / 20 startp.) → 2NT (uppvärderad…) | Balanserad 19 hp med extra kvalitet (ess och starka färger) → 2NT — för bra för att riskera pass, spelar som 20–21. |
| 4 | 3NT 25–27 | Balanserad 26 hp (25–27) → 3NT. | *(oförändrad)* |
| 5 | 2♣ bal 22+ | …→ 2♣ (konstgjord, krav). | Balanserad 23 hp (22+) → 2♣ — konstgjort kravbud (säger inget om klöver). |
| 6 | 1NT "bra 14" | Balanserad bra 14 (14 hp / 15 startp., ej sårbar ≥15) → 1NT (uppvärderad). | Balanserad 14 hp med extra kvalitet (bra ess och tior) → 1NT — uppvärderad till 15–17-zonen. |
| 7 | 2♣ stark 22+ | 23 hp (stark) → 2♣ (konstgjord, krav). | 23 hp, för stark för en 1-öppning → 2♣ (konstgjort kravbud). |
| 8 | 2♣ spelstick | …(nära utgång på egen hand) → 2♣ (stark, krav). | 19 hp men ~9 spelstick — nära utgång på egen hand → 2♣ (starkt kravbud). |
| 9 | 6-5, 16+ | …→ **1C** (öppnar lågfärgen; …via reverse). | 16 hp (…) med 6-5 (6 klöver + 5 spader) → **1♣** — öppnar den långa lågfärgen först och visar 5-korts spader nästa varv. |
| 10 | 5-korts högfärg | 14 hp med 5-korts hjärter → **1H**. | 14 hp med 5-korts hjärter → **1♥**. |
| 11 | minor-regeln | 13 hp, ingen 5-korts högfärg → **1D** (minor-regeln). | 13 hp utan 5-korts högfärg → **1♦** (öppnar bästa lågfärg). |
| 12 | lättöppn. 3:e | …i 3:e hand → **1S** (lättöppning, partnern har passat). | 10 hp men stark 5-korts spader (2 topphonnörer) i tredje hand → **1♠** — lätt öppning sedan partnern passat. |
| 13 | regeln om 15 (hf) | 11 hp + 4 spader = 15 (≥15, regeln om 15…) → **1S**. | 11 hp + 4 spader = 15 → **1♠** — i fjärde hand öppnar man med minst 15 (poäng + spader) så given inte passas ut. |
| 14 | regeln om 15 (lf) | …→ **1C** (minor-regeln). | 12 hp + 3 spader = 15 → **1♣** — öppnar i fjärde hand (poäng + spader ≥ 15), bästa lågfärg. |
| 15 | pass 4:e hand | …(<15, regeln om 15…) → pass (given passas ut). | 10 hp + 3 spader = 13 — under 15 i fjärde hand → pass, given läggs åt sidan. |
| 16 | spärröppning | …(2 topphonnör, ej sårbar) → **3S** (spärröppning). | 10 hp med 7-korts spader (2 topphonnörer) → **3♠** (spärröppning). |
| 17 | svag tvåa | 8 hp med 6-korts hjärter → **2H** (svag tvåöppning). | 8 hp med 6-korts hjärter → **2♥** (svag tvåöppning). |
| 18 | pass | 9 hp, ingen öppning → pass. | *(oförändrad)* |

Dessutom: bokstavskod-siffran `TP` bort ur 1-lägestexterna — "18 hp / 21 TP" → "18 hp (21 med fördelning)".

---

## Batch 2 — Svaren på 1-i-färg  ·  källa: `responses.ts` (+ delad `evaluation.ts`)  ·  ✅ APPLICERAD 2026-08-19

| Ändring | Före | Efter (live) |
|---|---|---|
| "GF" → "utgångskrav" | 12 hp med 6-korts ruter → 2D (2-över-1, **GF**). | 12 hp med 6-korts ruter → 2♦ (2-över-1, **utgångskrav**). |
| "GF" (Jacoby/splinter) | …→ 2NT (Jacoby, **GF**). | …→ 2NT (Jacoby, **utgångskrav**). |
| Bokstavskod → symbol | …→ **2D**/**2H** (2-över-1…) | …→ **2♦**/**2♥** … |
| "TP" → "med fördelning" | …(10 hp / 14 **TP**). | …(10 hp, 14 **med fördelning**). |
| **Delad:** "stödp./Bergenp./startp." → "med fördelning" | 8 hp **/ 9 stödp.**, 3 stöd → 2♠ | 8 hp **(9 med fördelning)**, 3 stöd → 2♠ |

Sista raden ändrade den GEMENSAMMA poängtexten (`pointsWithFloor`), så den rensar
även återbuden (batch 3) och fler lager på en gång. Rule-namn oförändrade.

**Kvar till nästa batchar:** Jacoby-transfersvaren visar fortfarande `2D`/`2H`
(källa `responses-nt.ts` — svar på 1NT). Rule-lösa texter som "Stöd för partnerns
ruter …" kommer ur konkurrenslagret (`auction-live.ts`).

---

## Batch 3 — Öppnarens återbud  ·  källa: `rebids.ts`  ·  ✅ APPLICERAD 2026-08-19

Filen var redan nästan helt ren (använder symboler + `pretty()` överallt, och
batch 2:s delade `pointsWithFloor`-fix städade dess Bergen-/stödtexter). Kvar fanns
bara två egna förkortningar:

| Ändring | Före | Efter (live) |
|---|---|---|
| "startp." → "med fördelning" | …→ 3NT (14 hp / 16 **startp.**). | …→ 3NT (14 hp, 16 **med fördelning**). |
| "sangp." → "räknat som N i sang" | …→ 3NT (15 hp / 16 **sangp.**). | …→ 3NT (15 hp, **räknat som 16 i sang**). |

**Nästa batchar (känd kvarvarande jargong):**
- Batch 4 — Svararens återbud (`responder-rebids.ts`): "GF" i text, `stödp.`, "fast arrival".
- Batch 5 — Svar på 1NT (`responses-nt.ts`): transfers visar `2D`/`2H` (bokstavskod), "GF" i text.
- Senare — konkurrens (`auction-live.ts`), inkliv/dubblingar (`overcalls.ts`, `doubles.ts`), slam, Lebensohl, försvar.

---

## Batch 4 — Svararens återbud  ·  källa: `responder-rebids.ts`  ·  ✅ APPLICERAD 2026-08-19

| Ändring | Före | Efter (live) |
|---|---|---|
| "GF" → "utgångskrav" (×9) | …→ 3♥ (preferens, **GF**). / (Smolen, **GF**) / (höjning, **GF**) … | …(preferens, **utgångskrav**) / (Smolen, **utgångskrav**) … |
| "fast arrival, minimum-GF" | 4♥ (**fast arrival, minimum-GF**). | 4♥ (**minimum — direkt till utgången**). |
| "upp-the-line" | …kortfärgen **upp-the-line**, GF/slamintresse. | …kortfärgen **billigast först**, utgångskrav med slamintresse. |
| "stödp." | **8 stödp.**, platt maximum → 4♥ | **platt maximum (8 stödpoäng)** → 4♥ |

## Batch 5 — Svar på 1NT  ·  källa: `responses-nt.ts`  ·  ✅ APPLICERAD 2026-08-19

| Ändring | Före | Efter (live) |
|---|---|---|
| Bokstavskod → symbol + tydligare | 8 hp med 5-korts hjärter → **2D** (Jacoby-transfer). | 8 hp med 5-korts hjärter → **2♦** (**transfer till hjärter**). |
| Texas bokstavskod | …6-korts spader → **4H** (Texas, utgång). | …6-korts spader → **4♥** (Texas — **transfer till spader**, utgång). |
| "GF" → "utgångskrav" | …(Minor Suit Stayman, **GF**/slam). / 5-5…**GF** → 2♥ | …(Minor Suit Stayman, **utgångskrav**/slam). |

---

## Status efter batch 5 (2026-08-19)

Hela den **ostörda on-book-ryggraden** är klarspråkad: öppning → svar → återbud →
svararens återbud → svar på 1NT. Mätt i svepet: `stödp./startp./sangp./TP/Bergenp.`
= **0** kvar överallt (delade fixen).

**Kvar (kommande batchar, ~18 träffar i 6 filer, mest mekaniskt GF/bokstavskod):**
`responses-2c.ts` (svar på stark 2♣, 10) · `overcalls.ts` (inkliv, 3) ·
`responses-2nt.ts` (svar på 2NT, 2) · `strong-2nt-systemson.ts` (2) · `slam.ts` (1) ·
samt ännu ogenomsökta: `doubles.ts`, `auction-live.ts` (konkurrens), `lebensohl.ts`,
`defense-conventional.ts`, `responses-weak2/preempt.ts`, `dont.ts`, `contested-openings.ts`.

---

## Batch 6 — Svar på stark 2♣ + svar på 2NT  ·  ✅ APPLICERAD 2026-08-19
Filer: `responses-2c.ts` (10× "GF" → "utgångskrav"), `responses-2nt.ts` (transfers
`4D/3D` → `4♦/3♦`, tydligare "transfer till hjärter"), `strong-2nt-systemson.ts`
(`4S/4H` → `4♠/4♥`).

## Batch 7 — Konkurrens, inkliv & slam  ·  ✅ APPLICERAD 2026-08-19
Filer: `dont.ts` (relä-bud → symbol), `overcalls.ts` (advance-preferens → symbol),
`auction-live.ts` (off-book-lagret: ~25 bokstavskoder → symbol via ny `prettyBid()`,
"TP" → "med fördelning", Lebensohl-utgång → symbol), `slam.ts` (Exclusion-steg → symbol).

## FAS 2 SVEPET KLART (2026-08-19)

Mätt över 10 000 budade givar: **0** bokstavskoder (t.ex. "2D", "3H"), **0** "GF",
**0** "TP/stödp./startp./sangp./Bergenp." i någon budförklaringstext. Källkoll:
`explanation`-strängar utan "GF" i hela `src/lib/engine`. Kvarvarande `${call}` i
texten (overcalls.ts:344, rebids.ts:756) är SANG-bud (2NT/3NT) som renderas rätt.

Rule-namn (t.ex. "2-över-1 GF", "rebid: stöd (GF)") står medvetet KVAR oförändrade
— de vaktas av alerts/regelsvep och visas bara som chip, inte i förklaringstexten.
