# Budsystem-revision — övergripande hälsobild

> **Vad detta är.** Resultatet av en komplett djupdykning i budmotorn (2026-07-07):
> grunder, konventioner, försvar, fördelning, styrkor/svagheter — färgkodat med
> åtgärdsförslag. **2026-07-20: detta är arbetsunderlaget för 🔵 NU-spåret
> "BUDGIVNINGEN MOT PERFEKT"** (etapp 1 felrapporter #35/#37/#38/#39 → etapp 2
> systemrevisorn → etapp 3 F1-resten → etapp 4 topplistan → etapp 5 F2; hela
> planen i `CLAUDE.md`). Uppdatera statusarna här när punkter byggs.
> Projektkartan i `CLAUDE.md` styr ordningen; detta är detaljen.

**Färgkoder:** 🟢 byggt/testat/live · 🟡 fungerar men känd gräns/bevakning · 🔴 lucka/uppskjutet.

**Hälsobild:** systemet är komplett och vältestat (grön svit i deploygrinden —
enda sanningen om testläget: kör `npm test`; facit-först, boken = enda
sanningskälla). Grunder och konventioner solida. **2026-07-07 kväll: ÄRLIGA
SLAMPORTAR byggda** (ägarbeslut: inga budbeslut på partnerns faktiska kort
— egen hand + visade intervall; inbjudningar i kanske-zonen; fel tillåtna).
Kvarvarande svaghet: att försvarslagret (§7) inte räknar fördelning (TP) —
F4 i körordningen. *(F2/E1, detektorkedjans underhållbarhet, LAGAD 2026-08-07:
kedjan är datadriven med kedjevakt. B13, grova återbud efter inverterad minor,
LAGAD 2026-08-07. F1:s fyra slamfamiljer är byggda sedan etapp 4 — se nedan.)*

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
| B8 | Cue-bid, Sjöberg 5NT, Gerber, Exclusion | 🟢 | Motorns auto-cue-rond borttagen (ärliga portar); §6.2 kvar för manuella cue |
| B9 | Slam efter hopp-återbud i minor (#29) | 🟡 | **Ärliga portar 2026-07-07:** driv 17+/inbjudan 15–16 mot visade 16–18; #29-originalgiven = medveten ärlig miss (3NT) |
| B10 | **Slam-utforskning i övrigt** | 🟡 | **F1 pausad → NÄST** tills ärliga portar bekräftade i spel; familj B (2♣) + C (reverse/hoppskift) byggs sedan ÄRLIGT |
| B11 | ~~Slam-quirken (hängande cue)~~ | 🟢 | LÖST; cue-ronden numera helt borttagen ur motorn (ärliga portar) |
| B12 | **Ärliga slamportar** (egen hand + visat intervall; inbjudningar; härledning + rättelse) | 🟢 | **BYGGT 2026-07-07 kväll** — bevaka i spel: missar/inbjudningsfrekvens |
| B13 | Inverterad minor-återbuden | 🟢 | **BYGGD 2026-08-07:** äkta honnörsstopp (inte 4+ längd), 3m strikt 12–14, 15+ bjuder alltid krav, svararens broms 10–12 + öppnarens driv, cue-ronden i minorfit (över 3NT) + 2♣-grenen. Facit `auction-inverterad-rebud.test.ts`, boken §4.2/§6.2/§9, mätning M27 |

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
| C12 | **Advancer-rabatt efter balansering** | 🟢 | **BYGGD 2026-08-07 (F3):** rabatten −3 generell över alla balanserade öppningar (höjningar via `partnerBalanced`/`raiseWithFit` + X-svar via `answerTakeoutDouble`); facit `auction-advancer-rabatt.test.ts`, boken §7.1/§9, mätning M28. Kvar (bevaka): NT-svar/nya färger utan rabatt |
| C13 | Mathe mot stark 1♣ | 🟡 | PARKERAT (irrelevant i 2/1) |
| C14 | Kanoniska linjen passar ut ostörda tvåfärgsinkliv (Budvisningen) | 🔴 | Trä in `advanceTwoSuiter` i linjens konkurrensrond |

## D. FÖRDELNING & HANDVÄRDERING (TP)

| # | Område | Status | Åtgärd |
|---|--------|:---:|--------|
| D1–D6 | TP genom öppning/svar/accepter/nudge/reverse/3:e-4:e hand | 🟢 | — |
| D7 | `wastedHonorsOppositeShortness` i slam | 🟢 | — |
| D8 | LTC (förlorarräkning) | 🟢 | Medvetet ej infört |
| D9 | ~~§7-inkliven räknar rå HP, inte TP~~ | 🟢 | **F4 KLAR 2026-08-07:** golven läser TP med kvalitets-/spärrvakt |

## E. ARKITEKTUR & SYSTEMHÄLSA

**Styrkor 🟢:** facit-först-disciplin (varje fix låst av ett facit-test); boken = enda sanningskälla (sidan
renderar live); tre-lagers-arkitektur dokumenterad (`auction.ts`/`auction-live.ts`/
`auction-interpret.ts` med `open`-handoff); kontraktshärledning single-sourced;
kravminnet löst.

| # | Svaghet | Status | Åtgärd |
|---|---------|:---:|--------|
| E1 | Detektorkedjan i `decideCall` — tung att underhålla, ordningskänslig | 🟢 | **BYGGD 2026-08-07 (F2):** kedjan är data (`FORCED_DETECTORS`/`CONTESTED_DETECTORS`, varje detektor `{ id, before?, run }`); före-kraven vaktas av `detector-chain.test.ts` i deploygrinden. `auctionFacts`-lagret (R2 steg 2) medvetet ej byggt — vid behov |
| E2 | Forcerad minimi-stege i 2♣ väljer inte alltid finaste färg (5♣ där 4♠ bättre) | 🟡 | Förbättra strain-val i `honorForce` |
| E3 | Ingen kvarvarande probe-rigg i repot | 🟢 | Systemrevisorn BYGGD (etapp 2, `docs/systemrevisorn.md`, mätserien M1→M27); denna rad var stale tills 2026-08-07-svepet |

---

## Åtgärdsförslag — körordning (F1–F6)

| Ordn. | Åtgärd | Adresserar | Status |
|:---:|--------|-----------|:---:|
| **F1** | Bredda slam-utforskningen (facit-först, en familj i taget) | B10, B9, A13, E2 | 🟢 **KLAR** (alla fyra familjer, etapp 4 2026-07-24→25) |
| **F2** | Datadriven detektorkedja + återanvändbar systemrevisor | E1, E3 | 🟢 **KLAR** (revisorn etapp 2; kedjan 2026-08-07) |
| **F3** | Advancer-rabatt efter balansering | C12 | 🟢 **KLAR** (2026-08-07) |
| **F4** | TP till §7-inkliven | D9 | 🟢 **KLAR** (2026-08-07) |
| **F5** | Verifiera 6-5-återbudet + 2♣-strain-valet i spel | A3, E2 | 🔴 kvar |
| **F6** | Stark 17+ enfärg efter två bjudna färger + tvåfärgsinkliv i prebuilt-linjer | C5, C14 | 🔴 kvar |

### F1 — slam-utforskningens delfamiljer (fyra, ur probe 40 000 givar DD-lösta)
| Familj | Läge | Status |
|--------|------|:---:|
| **A** | efter 1NT-återbud (`1m–1M–1NT`) | 🟢 **KLAR & LIVE** — jämn → 6NT (Gerber); obal. m. fit → 6 i färg (RKC) |
| **D** | Jacoby 2NT-läcka (hängande cue = slam-quirken) | 🟢 **KLAR & LIVE** — → 7♥; quirk stängd i alla vägar |
| **B** | efter stark 2♣ (positiva svar / 2NT-rebud) | 🟢 **KLAR & LIVE** (etapp 4 fix 1+2, mätning #12–#13 i `docs/systemrevisorn.md`) |
| **C** | efter öppnaren visat extra (hoppskift/hopphöjning/reverse) — **störst** | 🟢 **KLAR & LIVE** (hopphöjning `auction-slam-jumpraise.test.ts`; reverse + hoppskift etapp 4-resten, mätning #14) |

**Status 2026-08-07 (svepet):** F1 är KLAR — alla fyra familjerna byggdes i
etapp 4 (2026-07-24→25, mätning #12–#14 i `docs/systemrevisorn.md`) med de
ärliga portarnas mönster (kaptensregeln mot visade intervall — aldrig partnerns
kort). Den gamla "PAUSAD"-texten här var stale (dokumentet uppdaterades inte
när etapp 4 landade).

**Medvetet PARKERAT (väg inte in):** Mathe (C13), LTC (D8).
**Utanför denna revision (eget spelmotor-spår):** kortspels-kvalitet #32/#34 i `play-bot.ts`.
