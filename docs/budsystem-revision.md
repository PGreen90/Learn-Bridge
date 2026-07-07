# Budsystem-revision — övergripande hälsobild

> **Vad detta är.** Resultatet av en komplett djupdykning i budmotorn (2026-07-07):
> grunder, konventioner, försvar, fördelning, styrkor/svagheter — färgkodat med
> åtgärdsförslag. **Detta är arbetsunderlaget för det pågående 🔵 NU "F1 — bredda
> slam-utforskningen"** och för framtida budförbättringar. Uppdatera statusarna här
> när punkter byggs. Projektkartan i `CLAUDE.md` styr ordningen; detta är detaljen.

**Färgkoder:** 🟢 byggt/testat/live · 🟡 fungerar men känd gräns/bevakning · 🔴 lucka/uppskjutet.

**Hälsobild:** systemet är komplett och vältestat (1087 gröna test, facit-först,
boken = enda sanningskälla). Grunder och konventioner solida. Svagheterna är
koncentrerade till: (1) slam-utforskning utanför byggda vägar (**åtgärdas av F1 —
pågår**), (2) underhållbarheten i off-book-detektorkedjan, (3) att försvarslagret
(§7) inte räknar fördelning (TP).

---

## A. GRUNDER (öppning, svar, återbud, kravminne)

| # | Område | Status | Åtgärd |
|---|--------|:---:|--------|
| A1 | Öppningsbud 1-läget + minor-regeln | 🟢 | — |
| A2 | Sangöppningar 1NT/2NT/3NT + TP-nudge | 🟢 | Bevaka platta 19:or → 2NT (#30) |
| A3 | 6-5-öppning (#32) | 🟡 | Verifiera *återbudet* efter 16+ 1♦-öppning |
| A4 | Svar 1♥/1♠ (Bergen, splinter, Jacoby 2NT) | 🟢 | — |
| A5 | Svagt hoppskift avskaffat (#31) | 🟢 | — |
| A6 | Svar 1♣/1♦ (inverterade minorer, 2/1) | 🟢 | — |
| A7 | Lågfärgsutgång 5♣/5♦ nåbar | 🟡 | Bevaka: drar den till 5m när 3NT var säkert? |
| A8 | Svar 1NT (Stayman/Smolen/Jacoby/Texas/MSS) | 🟢 | — |
| A9 | Öppnarens återbud (reverse, hoppskift, NT-stege, TP-steg E) | 🟢 | — |
| A10 | Kravminne ostört (2/1, ny färg, reverse passas aldrig) | 🟢 | — |
| A11 | Kravminne i konkurrens (fria bud = rondkrav) | 🟢 | — |
| A12 | 2♣ håller sitt utgångskrav (var 64% delkontrakt → 1,7%) | 🟢 | — |
| A13 | Systems-on över 2♣–2♦–2NT | 🟡 | Slam efter 2♣ tunn → **F1 familj B** |

## B. KONVENTIONER

| # | Konvention | Status | Åtgärd |
|---|-----------|:---:|--------|
| B1 | Stayman/Smolen/Jacoby/Texas/MSS | 🟢 | — |
| B2 | Bergen + tvetydig splinter + Bergen game try | 🟢 | — |
| B3 | Inverterade minorhöjningar | 🟢 | — |
| B4 | New Minor Forcing | 🟢 | — |
| B5 | Fjärde färg krav | 🟢 | — |
| B6 | Drury | 🟢 | — |
| B7 | 1430 RKC + trumfdam/kungfråga | 🟢 | — |
| B8 | Cue-bid, Sjöberg 5NT, Gerber, Exclusion | 🟢 | — |
| B9 | Slam efter hopp-återbud i minor (#29) | 🟡 | Bevaka make-rate |
| B10 | **Slam-utforskning i övrigt** | 🟡 | **F1 pågår:** familj A+D KLARA; B (2♣) + C (extra/hoppskift) kvar |
| B11 | ~~Slam-quirken (hängande cue)~~ | 🟢 | **LÖST 2026-07-07 (F1 D)** — 0/200 000 i probe |

## C. FÖRSVAR & KONKURRENS (§7)

| # | Område | Status | Åtgärd |
|---|--------|:---:|--------|
| C1 | Inkliv + advancer | 🟢 | — |
| C2 | Michaels + ovanlig 2NT | 🟢 | — |
| C3 | Takeout double (grund + stark 17+ + tvåfärgs-X) | 🟢 | — |
| C4 | Stark 17+ enfärg dom efter stödhöjning | 🟡 | Finjustera trösklar vid behov |
| C5 | Stark 17+ enfärg **efter två bjudna färger** | 🔴 | Kräver buildAuction-ändring |
| C6 | Negativ/responsiv/stöddubbling | 🟢 | — |
| C7 | Lebensohl | 🟢 | — |
| C8 | DONT mot deras 1NT | 🟢 | — |
| C9 | Försvar mot svaga tvåor/spärrar | 🟢 | — |
| C10 | Balansering "låna en kung" | 🟢 | — |
| C11 | Flerronds-konkurrens A+B+C | 🟢 | — |
| C12 | **Advancer-rabatt efter balansering** | 🔴 | **F3** i körordningen |
| C13 | Mathe mot stark 1♣ | 🟡 | PARKERAT (irrelevant i 2/1) |
| C14 | Kanoniska linjen passar ut ostörda tvåfärgsinkliv (Budvisningen) | 🔴 | Trä in `advanceTwoSuiter` i linjens konkurrensrond |

## D. FÖRDELNING & HANDVÄRDERING (TP)

| # | Område | Status | Åtgärd |
|---|--------|:---:|--------|
| D1–D6 | TP genom öppning/svar/accepter/nudge/reverse/3:e-4:e hand | 🟢 | — |
| D7 | `wastedHonorsOppositeShortness` i slam | 🟢 | — |
| D8 | LTC (förlorarräkning) | 🟢 | Medvetet ej infört |
| D9 | **§7-inkliven räknar rå HP, inte TP** | 🟡 | **F4** i körordningen |

## E. ARKITEKTUR & SYSTEMHÄLSA

**Styrkor 🟢:** facit-först-disciplin (1087 test); boken = enda sanningskälla (sidan
renderar live); tre-lagers-arkitektur dokumenterad (`auction.ts`/`auction-live.ts`/
`auction-interpret.ts` med `open`-handoff); kontraktshärledning single-sourced;
kravminnet löst.

| # | Svaghet | Status | Åtgärd |
|---|---------|:---:|--------|
| E1 | Detektorkedjan i `decideCall` (~28 steg) — tung att underhålla, ordningskänslig | 🔴 | R2: gör kedjan **datadriven** innan fler konkurrenskonventioner (**F2**) |
| E2 | Forcerad minimi-stege i 2♣ väljer inte alltid finaste färg (5♣ där 4♠ bättre) | 🟡 | Förbättra strain-val i `honorForce` |
| E3 | Ingen kvarvarande probe-rigg i repot | 🟡 | Bygg återanvändbar systemrevisor (knyter an till **F2**) |

---

## Åtgärdsförslag — körordning (F1–F6)

| Ordn. | Åtgärd | Adresserar | Status |
|:---:|--------|-----------|:---:|
| **F1** | Bredda slam-utforskningen (facit-först, en familj i taget) | B10, B9, A13, E2 | 🟡 **PÅGÅR** |
| **F2** | Datadriven detektorkedja + återanvändbar systemrevisor | E1, E3 | 🔴 kvar |
| **F3** | Advancer-rabatt efter balansering | C12 | 🔴 kvar |
| **F4** | TP till §7-inkliven | D9 | 🔴 kvar |
| **F5** | Verifiera 6-5-återbudet + 2♣-strain-valet i spel | A3, E2 | 🔴 kvar |
| **F6** | Stark 17+ enfärg efter två bjudna färger + tvåfärgsinkliv i prebuilt-linjer | C5, C14 | 🔴 kvar |

### F1 — slam-utforskningens delfamiljer (fyra, ur probe 40 000 givar DD-lösta)
| Familj | Läge | Status |
|--------|------|:---:|
| **A** | efter 1NT-återbud (`1m–1M–1NT`) | 🟢 **KLAR & LIVE** — jämn → 6NT (Gerber); obal. m. fit → 6 i färg (RKC) |
| **D** | Jacoby 2NT-läcka (hängande cue = slam-quirken) | 🟢 **KLAR & LIVE** — → 7♥; quirk stängd i alla vägar |
| **B** | efter stark 2♣ (positiva svar / 2NT-rebud) | 🔴 **kvar** |
| **C** | efter öppnaren visat extra (hoppskift/hopphöjning/reverse) — **störst** | 🟡 **hopphöjning KLAR** (1x–1M–3M → 6M via RKC, `auction-slam-jumpraise.test.ts`); **reverse + hoppskift kvar** |

**Nästa gång:** ta F1 familj **C** (störst bucket, mest värde) eller **B** (2♣, knyter
an till 2♣-arbetet). Bygg facit-först: probe → röd giv → fix → grön → DD-verifiera →
full svit → PCD (fråga ägaren).

**Medvetet PARKERAT (väg inte in):** Mathe (C13), LTC (D8).
**Utanför denna revision (eget spelmotor-spår):** kortspels-kvalitet #32/#34 i `play-bot.ts`.
