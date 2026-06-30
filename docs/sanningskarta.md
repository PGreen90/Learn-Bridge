# Sanningskarta — systemboken mot koden (FAS 0)

> **Vad det här är.** Resultatet av FAS 0 i `BUDSYSTEM – PRIORITERAD
> FELSÖKNINGS.txt`: en genomgång av varje moment i systemboken (`budsystem.md`)
> mot den **faktiska koden** i `src/lib/engine/`. Inte mot statusdokumenten –
> mot källfilerna, rad för rad. Det här är kartan som styr resten av planen.
>
> **Status-märkning:**
> - **KODAT** – finns i koden och är inkopplat där det ska användas.
> - **DELVIS** – finns men med en avgränsning, förenkling eller lucka.
> - **EJ KODAT** – saknas helt (medvetet uppskjutet *eller* en verklig lucka).
>
> **Viktig extra dimension – "inkopplad?":** en motorfunktion kan vara *skriven
> och testad* utan att någonsin nås i en riktig budgivning. Det gäller särskilt
> försvarsbuden (§7). Kolumnen **Inkopplad** säger om momentet faktiskt körs när
> appen bygger en auktion (`buildAuction`) eller budlådan budar (`decideCall`).
>
> Genomgången gjord 2026-06-30.

---

## I. Kapitel för kapitel

### §1 Översikt
Ren systembeskrivning (2/1 GF, 5-korts hf, 1NT 15–17, svaga tvåor, stark 2♣).
Inget att koda – grunden återspeglas i `openings.ts`. **KODAT.**

### §2 Markeringsstandard (betydelse · kravnivå · konvention + alert ●)
| Moment | Status | Var i koden | Anmärkning |
|---|---|---|---|
| Alert-markör på konstgjorda bud | KODAT | `alerts.ts` | Sätts på budets **regelnamn** (`rule`) via en prefixlista. |
| Betydelse (förklaring) | KODAT | varje motorfils `explanation` | Fri text per bud. |
| **Kravnivå som maskinläsbart fält** | **EJ KODAT** | — | Kravnivån (Avslut/Krav/GF/…) finns bara som **prosa** i förklaringstexten, inte som ett strukturerat fält. Motorn "vet" alltså inte att t.ex. 2/1 är GF – den står bara i texten. **→ matar FAS 1 (regel-ID/kravstatus) och FAS 12 (UI).** |

> **Arkitekturnot (FAS 1, punkt 1).** Budval, förklaring och alert ligger i
> **olika** filer: logiken i `responses*.ts`/`rebids.ts`, alerten i `alerts.ts`,
> kravnivån som text. Samma regel styrs alltså inte av samma objekt. Detta är
> själva målet för FAS 1 punkt 1 – bekräftat.

### §3 Öppningsbud
| Moment | Status | Var i koden | Anmärkning |
|---|---|---|---|
| 1♣/1♦/1♥/1♠, 1NT, 2♣, svaga 2♦/2♥/2♠, 2NT, 3-spärr, 3NT, 4-spärr | KODAT | `openings.ts` `classifyOpening` | Alla rader täckta. |
| Minor-regeln (3-3→1♣, 4-4/5-5→1♦, annars längst) | KODAT | `openings.ts` `openMinor` | Korrekt. |
| Öppningströskel | KODAT (avsiktlig avvikelse) | `openings.ts` + `evaluation.ts` | Färgöppning på **TP (startpoäng) ≥ 12**, inte rå hp. Dokumenterat i `handvardering.md`. NT-stegen + 2♣ är hp-definierade. |
| 4♣/4♦ spärröppning | DELVIS | `openings.ts` | Bjuds bara med **8+ korts** färg (7-korts → 3-läget). Rimligt men värt att veta. |

### §4.1 Svar på 1♥/1♠
| Moment | Status | Var i koden | Anmärkning |
|---|---|---|---|
| Höjningar (Bergen 3♣/3♦/3 i hf, enkel höjning, 3-korts limit via 1NT) | KODAT | `responses.ts` `respondToMajor` | |
| Jacoby 2NT | KODAT | `responses.ts` + `rebids.ts` `openerRebidAfterJacoby2NT` | |
| Tvetydig splinter + relä | KODAT | `responses.ts` + `rebids.ts` `openerRebidAfterSplinter` | |
| Svagt hoppskift (endast 1♥–2♠) | KODAT | `responses.ts` | |
| Semi-forcing 1NT + öppnarens återbud + svararens andra bud | KODAT | `rebids.ts` `…SemiForcing1NT`, `responder-rebids.ts` `…SemiForcing1NT` | §5.1 |
| Bergen game try (1♥–2♥→2NT) | KODAT | `rebids.ts` `openerRebidAfterSimpleRaise` | |
| 3NT-svaret (13–15 bal, exakt 2 i hf) | KODAT | `responses.ts` | |
| **Jordan 2NT** (limithöjning efter motst. upplysningsdubbling) | **EJ KODAT** | — | Systemboken nämner den uttryckligen som planerad ("efter upplysningsdubbling: Jordan 2NT"). **→ exakt FAS 2 punkt 6.** |

### §4.2 Svar på 1♣/1♦
| Moment | Status | Var i koden | Anmärkning |
|---|---|---|---|
| 4-korts hf upp, 1NT 6–10, svagt hoppskift, 2NT 11–12, 3NT 13–15 | KODAT | `responses.ts` `respondToMinor` | |
| Inverterade minorhöjningar (1m–2m stark / 1m–3m svag) | KODAT | `responses.ts` + `rebids.ts` `openerRebidAfterInvertedMinor` | |
| "Gap-handen" 7–9 med stöd → 1NT | KODAT | `responses.ts` | |

### §4.3 Svar på 1NT (15–17)
| Moment | Status | Var i koden | Anmärkning |
|---|---|---|---|
| Stayman + öppnarens svar | KODAT | `responses-nt.ts`, `rebids.ts` `openerRebidAfter1NTResponse` | |
| Jacoby-transfer (+superaccept) + fortsättning | KODAT | `responses-nt.ts`, `responder-rebids.ts` | |
| Smolen | KODAT | `responder-rebids.ts` `responderRebidIn1NTAuction` | |
| Texas | KODAT | `responses-nt.ts`, `rebids.ts` | |
| Minor Suit Stayman – **svararens första bud + öppnarens svar** | KODAT | `responses-nt.ts`, `rebids.ts` | |
| Minor Suit Stayman – **svararens andra bud (placering)** | EJ KODAT | — | `responderRebidIn1NTAuction` returnerar `null` här (default). Tas senare. |
| Direkt 3♣/3♦/3♥/3♠ (naturlig 6-färg slamförsök) | EJ KODAT (medvetet) | — | Överlappar transfers/MSS; utelämnat tills hålfinnaren visar behov. |
| 4NT kvantitativ | KODAT | `responses-nt.ts` | |
| Gerber-slam över 1NT | KODAT | `nt-slam.ts` `gerberInvestigation` (inkopplad i `buildAuction`) | |
| Garbage/svag Stayman | EJ KODAT (beslut uppskjutet) | — | Systemboken: "beslut tas senare". |

### §4.4 Svar på 2♣ (stark)
| Moment | Status | Var i koden | Anmärkning |
|---|---|---|---|
| 2♦ väntebud, positiva svar, öppnarens 2NT/3NT/krav-färg, andra negativa | KODAT | `responses-2c.ts` | |
| NT-konventioner efter öppnarens **2NT (22–24)** | EJ KODAT | — | Överlappar §4.3; auktionen markeras öppen där. Tas senare. |

### §4.5 Svar på svaga tvåor (2♦/2♥/2♠)
| Moment | Status | Var i koden | Anmärkning |
|---|---|---|---|
| Spärrhöjning, ny färg krav, 2NT Ogust + öppnarens stegsvar, svararens placering | KODAT | `responses-weak2.ts` | |
| Minorfärgens placering efter Ogust | DELVIS | `responses-weak2.ts` `responderPlaceAfterOgust` | Förenklad (utgång på 5-läget svårplacerad), flaggad `uncertain`. |

### §4.6 Svar på spärröppningar (3-/4-läget)
| Moment | Status | Var i koden | Anmärkning |
|---|---|---|---|
| Pass, höjning till utgång, ny färg krav, 3NT, öppnarens återbud | KODAT | `responses-preempt.ts` | |
| 4NT (1430 RKC) / cue mot slam efter spärr | DELVIS | — | Hör till §6; ej inkopplat här. På 4-läget passar/avslutar svararen alltid. |

### §5 Återbud (öppnarens andra bud)
| Moment | Status | Var i koden | Anmärkning |
|---|---|---|---|
| §5.1 efter semi-forcing 1NT | KODAT | `rebids.ts` `openerRebidAfterSemiForcing1NT` | |
| §5.2 efter 1-läges färgsvar (stöd, ny färg, NT-stege, reverse, hoppskift) | KODAT | `rebids.ts` `openerRebidAfter1LevelResponse` | |
| §5.3 i 2/1 GF (naturligt, fast arrival) | KODAT | `rebids.ts` `openerRebidAfter2over1` | |
| **Öppnarens splinter** (1♣–1♥–3♠/4♦) | EJ KODAT | — | Systemboken §5.2 nämner att öppnaren "kan även splintra"; ingen gren för det i `openerRebidAfter1LevelResponse`. Liten lucka. |

### §6 Konventioner (slam m.m.)
| Moment | Status | Var i koden | Inkopplad? |
|---|---|---|---|
| §6.1 1430 RKC + trumfdam-fråga | KODAT | `slam.ts` `respondToRKC`/`respondToQueenAsk` | Ja – `slam-auction.ts` efter Jacoby 2NT-fit / inverterad minor-fit i slamzon. |
| §6.2 Cue-bid | KODAT | `slam.ts` `cheapestCueBid` | Ja – cue-rond före RKC i `slam-auction.ts`. |
| §6.3 Sjöbergs 5NT | KODAT | `slam.ts` `respondToKingAsk` | Ja – i storslamszon i `slam-auction.ts`. |
| §6.4 Gerber | KODAT | `slam.ts` `respondToGerber(+KingAsk)` | Ja – över **1NT** (`nt-slam.ts`). Över 2NT: **kvantitativ tills vidare** (DELVIS). |
| §6.5 Exclusion Blackwood | KODAT | `slam.ts` `respondToExclusion` | Ja – efter splinter-relä (`slam-auction.ts`). DELVIS: renons som **rankar över trumf** hanteras ej. |
| §6.6 Fjärde färg krav | KODAT | `responder-rebids.ts` `fourthSuit` | Ja. Beslut: **GF**. |
| §6.7 Drury (tvåvägs) | KODAT | `responses-drury.ts` | Ja – passad-hand-gren i `buildAuction`. |

> **KÄND GRÄNS (jaga ej, arbetsregel C).** Slam-quirken: ~0,25 % av slamlinjerna
> (Jacoby 2NT → cue → 1430 RKC) lägger två bud i rad på samma plats → ingen
> laglig medurs-auktion; budlådan stänger dem lagligt på sista budet.

### §7 Försvarsbud — **stort fynd: kodat men till stor del INTE inkopplat**
Alla §7-konventioner finns som rena, testade motorfunktioner. Men budgivningen
modellerar konkurrens **bara i ett enda läge**: efter vår egen **1-läges
färgöppning** kliver LHO in (`overcall`), och svararen reagerar **en rond**
(`competitiveResponderAction`, inlinead i `auction.ts`). Allt annat i §7 nås
aldrig i en levande auktion.

| Moment | Status (kod) | Var i koden | Inkopplad i auktion? |
|---|---|---|---|
| §7.1 Enkelt inkliv / 1NT-inkliv / hoppinkliv | KODAT | `overcalls.ts` `overcall` | **Ja** (LHO över vår 1-färgsöppning). |
| §7.1 Advancer (svar på inkliv: höjning, cue, ny färg, NT) | KODAT | `overcalls.ts` `advanceOvercall` | **Nej** – aldrig anropad i `buildAuction`/`decideCall`. |
| §7.1 Advancers **fit-jump** | EJ KODAT | — | Står i systembokstabellen, saknas i `advanceOvercall`. |
| §7.2 Michaels + ovanlig 2NT | KODAT | `overcalls.ts` | **Ja** som LHO-inkliv (advancer ej). |
| §7.3 Upplysningsdubbling | KODAT | `overcalls.ts` | **Ja** (kan returneras som inkliv). |
| §7.3 Negativ dubbling | KODAT (dubblerad!) | `doubles.ts` `negativeDouble` **och** inline i `auction.ts` | **Ja**, men via `auction.ts`-versionen – `doubles.ts`-versionen är oanvänd. Dubblerad logik → FAS 1. |
| §7.3 Responsiv dubbling | KODAT | `doubles.ts` `responsiveDouble` | **Nej.** |
| §7.3 Stöddubbling (exakt 3) | KODAT | `doubles.ts` `supportDouble` | **Nej.** |
| §7.3 Advancers svar på upplysningsdubbling | KODAT | `doubles.ts` `answerTakeoutDouble` | **Ja** – men bara i budlådan (`decideCall`-fallback), ej i `buildAuction`. |
| §7.4 Lebensohl | KODAT | `lebensohl.ts` | **Nej.** |
| §7.5 DONT mot 1NT | KODAT | `dont.ts` | **Nej** (ingen auktion modellerar oss som inkliv över *deras* 1NT). |
| §7.6 Mathe / svaga / Multi / spärr-försvar | KODAT | `defense-conventional.ts` | **Nej.** |

> **Sammanfattning §7:** ~10 av 13 försvarsmoment är *skrivna och testade* men
> **når aldrig en levande budgivning**. Konkurrens modelleras dessutom bara
> efter en 1-läges färgöppning och bara **en rond** (ingen advancer, ingen
> öppnar-fortsättning i konkurrens, ingen konkurrens efter 1NT/2♣/2NT/svaga/
> spärr). **Detta är FAS 0:s viktigaste fynd och matar hela FAS 2 + FAS 10.**

### §8 Markeringar & utspel
| Moment | Status | Var i koden | Inkopplad? |
|---|---|---|---|
| §8.1 UDCA omvänd attityd + räkning | KODAT | `signals.ts` `attitudeCard`/`countCard` | Encoders; botten väljer kort. |
| §8.2 Lavinthal-sak | KODAT | `signals.ts` `lavinthalDiscard` | Encoder. |
| §8.3 Honnörsutspel (topp av sekvens) + spotutspel 3:e/5:e | KODAT | `signals.ts` `leadFromSuit` | **Ja** – inkopplat i bottens utspel (`play-bot.ts`). |
| **Läsa motpartens signaler** (full motspelsstrategi) | EJ KODAT (medvetet) | — | Hör ihop med DDS; tas separat. |
| §8.4 Smith Echo / Rusinow | EJ KODAT (medvetet) | — | Vi spelar dem **inte** (Rusinow ev. framtida). |

---

## II. Alla "tas senare" / avgränsningar (där luckorna gömmer sig)

**A. Riktiga luckor (saknas, kan behöva byggas):**
1. **Jordan 2NT** efter motst. upplysningsdubbling (§4.1). → FAS 2 p.6.
2. **§7 ej inkopplat**: advancer, responsiv/stöddubbling, Lebensohl, DONT,
   Mathe/Multi/spärr-försvar – kodade men nås ej i auktion. → FAS 2 + FAS 10.
3. **Konkurrens bara en rond** efter 1-läges färgöppning; ingen efter
   1NT/2♣/2NT/svaga/spärr; ingen öppnar-/advancer-fortsättning. → FAS 2.
4. **Kravstatus är inte ett fält** – bara prosa. → FAS 1 p.1+4.
5. **Dubblerad negativ-dubbling-logik** (auction.ts vs doubles.ts). → FAS 1 p.1.
6. **Öppnarens splinter** i §5.2 saknas.
7. **Advancers fit-jump** (§7.1) saknas.

**B. Medvetet uppskjutna beslut (inte buggar):**
- Garbage/svag Stayman (§4.3) – beslut ej taget.
- Minor Suit Stayman-fortsättning (svararens placering, §4.3).
- NT-konventioner efter 2♣–2NT (22–24).
- Off-book Syd (du bjuder utanför systemlinjen) – ägarens beslut. → FAS 2 p.10b.
- Fjärde färg = GF (alternativet "krav 1 rond" kan ändras).

**C. Medvetna förenklingar (flaggade i koden):**
- Minorplacering efter Ogust (§4.5) – `uncertain`.
- 4-läges-spärr: alltid pass (slam via 4NT ej inkopplad, §4.6).
- Gerber över 2NT: kvantitativ tills vidare (§6.4).
- Exclusion när renons rankar över trumf: ej hanterad (§6.5).

**D. Kända gränser (arbetsregel C – bekräfta, jaga inte):**
- Slam-quirk (Jacoby 2NT → cue → RKC) – stängs lagligt på sista budet.
- DDS-facit har nodbudget – tillförlitligt en bit in i given.

---

## III. Vad kartan säger inför FAS 1→
Budmotorns **kärna** (öppning → svar → återbud → svararens andra bud, för alla
sju öppningstyper, plus slamverktygen) är **genomgående KODAT och inkopplad** i
ostörda auktioner. De stora svagheterna ligger i två högar, båda högt prioriterade
i planen:

1. **Arkitektur (FAS 1):** kravstatus är inte maskinläsbar och budval/förklaring/
   alert/kravstatus styrs inte av samma objekt. Negativ dubbling finns i två
   versioner.
2. **Konkurrens (FAS 2):** merparten av §7 är skriven och testad men aldrig
   inkopplad i en levande budgivning, och konkurrens modelleras bara en rond.

Inga nya funktioner förrän FAS 1–6 är verifierade (planens regel). Nästa steg
enligt planen: **FAS 1 punkt 1** – samla regel-ID/budval/förklaring/kravstatus/
alert till *samma* objekt.

---

## IV. Uppdatering efter FAS 1 (2026-06-30)

Följande fynd ur kartan är nu åtgärdade i FAS 1:

- **Kravstatus är inte ett fält** (§2) → **löst.** `Forcing`-typ + `forcing`-fält
  på buden, härlett ur regelregistret `src/lib/engine/rules.ts` (kravnivå för
  alla ~150 regler). Punkt 1 + 4.
- **Budval/förklaring/alert utspritt** → **löst.** Alert single-sourcad i
  `rules.ts`; `alerts.ts` är ett tunt gränssnitt. `ruleInfo()` ger den valda
  regelns {kravnivå, alert} i ett objekt (spårningsgrund, punkt 2 lättversion).
- **Dubblerad negativ dubbling** (auction.ts vs doubles.ts) → **löst.** En källa
  (`doubles.ts`), nu generaliserad till inkliv på valfri nivå.
- **Olagliga bud (punkt 3, laglighet)** → **två buggar hittade & fixade:**
  (1) Ogust på 2♦: svararens placering kunde bjuda 3♦/3NT som öppnaren redan
  bjudit (olagligt) → passar nu rätt; (2) NT mot **hoppinkliv** på 3-läget gav
  olagligt 2NT → passar nu. Bevisat med deterministiskt `legality.test.ts`
  (4000 givar) + 60 000-givars sweep.

Kvar (ej i FAS 1): full regelspårning med matchande/avvisade regler (punkt 2
tung del), samt allt under **§7-konkurrens** (inkopplingen) som hör till **FAS 2**.
