# Arbetslista — fullända budmotorn

> 🔺 **NÄSTA SESSIONS PRIO:** systematisk felsökning enligt
> `BUDSYSTEM – PRIORITERAD FELSÖKNINGS.txt` (repo-roten).
> - ✅ **FAS 0 klar (2026-06-30):** inventeringen ligger i `docs/sanningskarta.md`
>   (systembok mot faktisk kod).
> - ✅ **FAS 1 klar (2026-06-30):** regelregister `src/lib/engine/rules.ts` –
>   kravnivå (`forcing`, §2) + alert härleds nu ur SAMMA regel (punkt 1), läggs
>   på varje bud (`forcing`/`alert` på AuctionTurn), alert single-sourced (punkt
>   1), `ruleInfo()` som spårningsgrund (punkt 2). Punkt 3 (laglighet): hittade +
>   fixade två olagliga-bud-buggar (Ogust 2♦-placering; NT mot hoppinkliv) +
>   deterministiskt laglighetstest (`legality.test.ts`, 4000 givar, verifierat
>   mot 60 000). Punkt 4 (kravstatus) = `forcing`-fältet. Testsvit 434 grön.
> - 🔶 **FAS 2 (konkurrens) pågår.** ✅ **Punkt 5+6 klara (2026-06-30):**
>   svararens höjningar efter inkliv facit-granskade (`auction-competitive-raises.test.ts`)
>   – **cue i deras färg = limithöjning+** (3+ stöd, 10+ hp, krav) i stället för
>   underbjuden enkel höjning, och **Jordan 2NT** (limithöjning med 4 trumf efter
>   upplysningsdubbling, systembok rad 193) som tidigare saknades helt. 2NT efter X
>   tolkas nu uttryckligen som Jordan, aldrig Jacoby. "Jordan 2NT" tillagd i
>   regelregistret. Testsvit 440 grön. Avgränsning: öppnarens *fortsättning* i
>   konkurrens (acceptera/avböja inbjudan) är fortsatt en rond – hör till resten av FAS 2.
>   ✅ **Punkt 7 klar (2026-06-30):** negativa dubblingar verifierade över hela den
>   vanliga sekvensmatrisen (`negative-doubles.test.ts`). Alla objuden-högfärgs-lägen
>   var redan rätt; **lucka lagad** – när motståndaren klivit in i den andra
>   högfärgen (båda objudna färgerna minorer, t.ex. 1♥–(1♠)/1♠–(2♥)) ger svararen
>   nu **negativ X på 4-4 minorer utan fit** (förut pass). Testsvit 452 grön
>   (legality-svepet fick uttryckligt 30 s-tidsspann).
>   ✅ **Punkt 8 klar (2026-07-01):** stöddubbling inkopplad i `buildAuction`
>   (gren 1 färg–(P)–1M–(RHO-inkliv)→X). `supportDouble` gjord positions-/
>   nivåmedveten (t.o.m. 2M, standard). Facit: `doubles.test.ts` +
>   `auction-support-double.test.ts`. Testsvit 499 grön.
>   ✅ **Punkt 9 klar (2026-07-01):** responsiv dubbling inkopplad i `buildAuction`
>   – (1M)–X(LHO)–2M(svararen höjer)–X(advancern). Facit:
>   `auction-responsive-double.test.ts`. Testsvit 500 grön.
>   ⬜ **Näst på tur: punkt 10 + 10b** (advancer-logik + off-book Syd) – kodat men
>   ej inkopplat i levande auktion. Arbetsregel A (facit före fix) + B (`npm test`).
>   FAS 1 punkt 2 tung del (matchande/avvisade regler) uppskjuten.

> Vad som behöver på plats för att göra budmotorn (och till sist kortspelet)
> komplett. Numrerad byggordning. Punkterna **1–9** stänger **M3** (öppnarens
> återbud så att en auktion aldrig stannar redan vid öppnarens andra bud för de
> fem öppningarna 1♣/1♦/1♥/1♠/1NT).

## M3 — färdigställ öppnarens återbud (de fem öppningar vi svarar på)
1. Återbud efter **semi-forcing 1NT** (1♥/1♠–1NT) — §5.1
2. Återbud efter **enkel höjning** = Bergen game try (1♥–2♥ → 2NT) — §4.1
3. Återbud efter **2-över-1 GF** (fast arrival, naturligt) — §5.3
4. Återbud efter **Bergen-höjningar** (3♣/3♦/3 i hf) — §4.1
5. Återbud efter **tvetydig splinter** (relä → kort färg / signoff) — §4.1
6. Återbud efter **Jacoby 2NT** (kortfärg/3NT/4 i trumf) — §4.1
7. Återbud efter **inverterade minorhöjningar** (stark/svag) — §4.2
8. Återbud efter **avslutande svar** (svagt hoppskift, spärrhöjningar, 3NT) — pass/avslut
9. **1NT-grenens fullföljanden**: svar på Stayman, fullfölj Jacoby (+superaccept),
   fullfölj Texas, svar på Minor Suit Stayman — §4.3

## Svararens andra bud (så auktionerna blir hela)
10. Preferens/fortsättning efter semi-forcing 1NT — §5.1
11. Smolen + svararens rebud efter fullföljd transfer/Stayman — §4.3
12. Fjärde färg krav — §6.6

## Saknade svarsmotorer (övriga öppningar + passad hand)
13. Svar på stark 2♣ (2♦ väntebud, andra negativa) — §4.4
14. Svar på svaga tvåöppningar 2♦/2♥/2♠ + Ogust — §4.5
15. Svar på spärröppningar (3-/4-läget) — §4.6
16. Svar på 2NT-öppning (Stayman/transfers, 20–21) + hantera 3NT-öppning
17. Drury — svar på 1♥/1♠ **endast som passad hand** (2♣ = limithöjning) — §6.7

## Slamverktyg (§6)
18. 1430 RKC Blackwood + trumfdam-/kungfråga — §6.1
19. Cue-bid / kontrollbud — §6.2
20. Sjöbergs 5NT, Gerber, Exclusion Blackwood — §6.3–6.5

## Konkurrens / försvarsbud (§7)
21. Inkliv + svar — §7.1
22. Tvåfärgsinkliv: Michaels + ovanlig 2NT — §7.2
23. Dubblingar: upplysning / negativ / responsiv / stöd — §7.3
24. Lebensohl — §7.4
25. DONT mot 1NT — §7.5
26. Mot stark 1♣ / Multi / svaga / spärrar — §7.6
27. Störd budgivning i auktionsmotorn (bottarna budar/dubblar/passar på riktigt)

## Kortspelet
28. Double-dummy solver (Bo Haglunds DDS i WebAssembly) — facit för stick
29. Kortspels-läge: spela ut korten mot bottar (avslut + motspel)
30. Markeringar & utspel (UDCA, Lavinthal, 3:e/5:e, honnörsutspel) — §8

## Visuellt / UI
- ✅ **Auktionen på "Spela kort"-fliken** – budgivningsrutnätet (`AuctionView`)
  visas i en hopfällbar panel så man ser HUR kontraktet bjöds fram. Kortspelet
  härleder nu kontraktet ur en FÄRDIG (ostörd) auktion via `dealForPlay` /
  `finalContract` (`auction-contract.ts`) i stället för den fristående
  `pickContract`-heuristiken, så budföljden matchar kontraktet man spelar.
  Delad `turnsToCalls` (flyttad till `auction-contract.ts`, används av både
  Spela- och Spela kort-fliken).
- ⬜ **Framkalla olika slutbud (idé från ägaren 2026-06-29)** – en knapp/väljare
  som letar fram en giv vars auktion slutar i ett *valt* slutkontrakt (t.ex.
  "visa en slam", "visa 3NT", "visa 4♥"), inte bara slumpmässiga givar. Bra både
  för att verifiera nya budvägar (t.ex. slamverktygen) och för riktad träning.
  Generalisering av den tänkta "Slamexempel →"-knappen.
- 🔶 **Budlådans budknappar** – låt ägaren klicka egna bud i en riktig budlåda.
  - ✅ **Steg 1 – logiklagret** (`auction-live.ts`, testat): `legalCalls`,
    `auctionComplete`, `contractFromCalls`, `decideCall` (bot-hjärnan som spelar
    upp parets systemlinje bud för bud; datorn budar V/N/Ö, Syd själv).
  - ✅ **Steg 2 – UI** (`BiddingBox.tsx` + budfas i `Play.tsx`): klickbar budlåda
    för Syd (35 bud + Pass/X/XX, otillåtna gråas ut via `legalCalls`), datorn
    budar V/N/Ö ett i taget runt bordet (`decideCall`, 700 ms fördröjning), och
    kortspelet startar ur de **verkliga** buden (`contractFromCalls`) i stället
    för `dealForPlay`. Budfasen visar din hand öppen + de andra som baksidor och
    budgivningsrutnätet som växer fram. Passas given ut visas det och man tar en
    ny giv. `Play.tsx` är delad i en fas-styrning + fristående `PlayTable`.
    Verifierad i webbläsaren (budlåda → levande auktion → 3NT → spel).
  - ⬜ **Slam-quirk**: slamlinjer (Jacoby 2NT → cue → RKC) kan generera två bud
    i rad på samma plats (öppnarens cue hoppas över) → ej laglig medurs-auktion,
    så budlådan stannar under slam där. Fixa i slammotorns cue-rond
    (`slam-auction.ts`) så öppnaren alltid fyller luckan lagligt utan att
    fabricera ett falskt kontroll-cue (mis-lär ägaren). Ovanligt (~0,25 %).
  - ✅ **Off-book Syd**: datorpartnern hänger med och svarar på Syds egna bud
    (stöd m. fit graderat efter styrka, annars egen färg/sang). Se "Tolkande
    budmotor steg 3" i `docs/status.md`.
  - ✅ **§7-inkliv off-book** (`maybeOvercall` i `auction-live.ts`): när auktionen
    gått off-book kliver motståndarna in på riktigt (direkt sits, motståndaren
    öppnade nyss 1 i färg) via §7-motorn `overcall` – inkliv/X/Michaels/ovanlig
    2NT, i stället för att tystna. Facit i `auction-live.test.ts`.
  - ⬜ **Off-book §7 vidare**: balansering (inkliv efter en passrunda) och inkliv
    över andra öppningar (1NT, svaga tvåor, hoppöppningar). Sedan slam-quirken.

## Stöd som följer med (löpande)
31. Hålfinnare utökas för varje nytt återbud/svar
32. Övningar i JSON som tränar de nya bitarna i budträningen

## Status
- ✅ M1 öppningar, M2 svar på 1♥/1♠, M3 svar på 1♣/1♦ + 1NT + §5.2
- ✅ Punkt **1–9** (öppnarens återbud efter alla svar)
- ✅ Punkt **10–12** (svararens andra bud: semi-forcing 1NT, Smolen/transfer-
  fortsättning, fjärde färg krav) – `responder-rebids.ts`
- ✅ Punkt **13** (svar på stark 2♣: 2♦ väntebud, positiva svar, öppnarens
  2NT/3NT/krav-färg och svararens **andra negativa**) – `responses-2c.ts`.
  Avgränsning: NT-grenen över 2NT (22–24) tas senare (överlappar §4.3).
- ✅ Punkt **14** (svar på svaga tvåor 2♦/2♥/2♠: spärrhöjning, ny färg krav,
  **2NT Ogust** + öppnarens stegsvar, svararens placering) – `responses-weak2.ts`.
  Avgränsning: minorfärgens placering efter Ogust (utgång på 5-läget) är
  förenklad och flaggad.
- ✅ Punkt **15** (svar på spärröppningar 3-/4-läget: pass, höjning till utgång,
  ny färg krav, 3NT, samt öppnarens återbud) – `responses-preempt.ts`.
  Avgränsning: 4NT (1430 RKC) och cue mot slam hör till §6 (punkt 18–19).
- ✅ Punkt **16** (svar på 2NT-öppning + hantera 3NT-öppning) – `responses-2nt.ts`.
  2NT är **utgångskrav-schema** (inga inbjudningsbud, till skillnad från 1NT):
  3♣ Stayman, 3♦/3♥ transfer (svag=signoff, 11+=slam), 4♦/4♥ Texas (6-färg, ren
  utgång), 3♠ minorfråga, 3NT, 4NT kvantitativ, 6NT. 3NT-öppningen (25–27): svararen
  placerar kontraktet (pass / 4NT kvantitativ / 6NT). Öppnaren fullföljer Stayman/
  transfer/Texas/minorfråga och tar ställning till kvantitativ 4NT.
  Avgränsning: exakta slamverktyg (RKC/Gerber/storslam) hör till §6 (punkt 18–20).
- ✅ Punkt **17** (Drury, §6.7) – `responses-drury.ts`. Passad hand över 1♥/1♠:
  2♣ = limithöjning 3 trumf, 2♦ = limithöjning 4+ trumf; öppnaren rebjuder
  högfärgen = lätt öppning (signoff), 3-läget = utgångsförsök, 4-läget = utgång.
  Inkopplat i `buildAuction` (passad-hand-detektering: svararens plats kom före
  öppnarens i varvet).
- ✅ Punkt **18–20** (slamverktyg, §6.1–6.5) – `slam.ts`. **1430 RKC** (`respondToRKC`),
  **trumfdam-fråga** (`respondToQueenAsk`), **cue-bid** (`cheapestCueBid`),
  **Sjöbergs 5NT** kungfråga (`respondToKingAsk`), **Gerber** ess-/kungfråga
  (`respondToGerber`/`respondToGerberKingAsk`) och **Exclusion** (`respondToExclusion`).
  **Inkopplade i en växande auktion:** `slam-auction.ts` (`slamInvestigation`)
  hakar in **1430 RKC** efter en högfärgsfit via **Jacoby 2NT** när parets
  samlade poäng (Bergenpoäng + stödpoäng) når **slamzon ≥ 33** (storslam ≥ 37).
  Auktionen växer då vidare 4NT → RKC-svar → slamavslut (5/6/7 i trumf).
  **Alla slamvägar nu inkopplade i växande auktioner** (Steg 1–5, 2026-06-29):
  cue-rond + Sjöbergs 5NT i RKC-grenen (`slam-auction.ts`), **minorfit** via
  inverterad minor (`auction.ts`), **Gerber 4♣** över 1NT (`nt-slam.ts`) och
  **Exclusion** efter splinter-relä (`slam-auction.ts`). Avgränsningar: Gerber
  över 2NT (kvantitativ tills vidare) och Exclusion när renons rankar över trumf
  hanteras ej – då fortsätter den vanliga auktionen.
- ✅ Punkt **21–22** (inkliv + tvåfärgsinkliv, §7.1–7.2) – `overcalls.ts`.
  Enkelt inkliv, 1NT-inkliv (15–18), Michaels, ovanlig 2NT, upplysningsdubbling,
  hoppinkliv, samt advancers svar (cue=limit+, höjning, ny färg, NT).
- ✅ Punkt **23** (dubblingar, §7.3) – `doubles.ts`. Negativ, responsiv,
  stöddubbling (exakt 3) och advancers svar på upplysningsdubbling.
- ✅ Punkt **24** (Lebensohl, §7.4) – `lebensohl.ts`. 2NT-relä (svag) vs direkt
  3-läge (krav), cue=Stayman, "slow shows stopp" för 3NT.
- ✅ Punkt **25** (DONT mot 1NT, §7.5) – `dont.ts`. X enfärg, 2♣/2♦/2♥ tvåfärg,
  2♠ spader + advancer.
- ✅ Punkt **26** (mot konventionella/svaga, §7.6) – `defense-conventional.ts`.
  Mathe mot stark 1♣, försvar mot svaga tvåor, Multi 2♦ och spärrar.
- ✅ Punkt **27** (störd budgivning i auktionsmotorn) – `auction.ts`. LHO kliver
  in på riktigt (via `overcall`) och svararen reagerar (negativ dubbling,
  konkurrenshöjning, NT med stopp, redubbling). Störda givar förgrenar av från
  det ostörda flödet; en konkurrensrond modelleras, sedan markeras auktionen öppen.
  Avgränsning: vidare konkurrens (öppnarens/advancers fortsättning) tas senare.
- ✅ **Handvärdering driver öppningen** – `openings.ts` använder nu **TP
  (startpoäng) ≥ 12** som öppningströskel för färgöppning (Bergens grundregel),
  i stället för rå hp. NT-stegen + starka 2♣ är fortsatt hp-definierade. Bra
  11-hp-händer öppnar, platta D/kn-tunga 12-hp-händer avstår. Se `docs/handvardering.md`.
- ✅ Punkt **29** (kortspels-läge) – `play.ts` (spelmotor: följa färg, trumf,
  stickvinnare, räkning), `play-bot.ts` (bott-tumregler), `play-contract.ts`
  (heuristiskt kontrakt) och fliken **Spela kort** (`src/pages/Play.tsx`): klicka
  ut korten mot bottar, avslut + motspel, stickräkning, satt/bet. Se `docs/kortspel.md`.
- ✅ **Bot-tumreglerna förfinade** (`play-bot.ts`): **andra hand lågt** (spar
  honnörer i stället för att vinna i onödan), **ruffar aldrig partnerns vinnande
  stick** (kastar lågt sidokort via `lowAvoidRuff`), och **utspel = topp av en
  honnörssekvens** (KQJ→K, QJ10→Q), annars lågt. Tester i `play-bot.test.ts`.
- ✅ **Spelläget kopplat till en riktig auktion** – se Visuellt/UI ovan
  (`auction-contract.ts`).
- ✅ Punkt **30** (markeringar & utspel, §8) – `signals.ts` som rena, testade
  encoders: **honnörsutspel** (topp av sekvens, §8.3), **spotutspel 3:e/5:e bästa**
  (§8.3), **UDCA omvänd attityd + räkning** (§8.1) och **Lavinthal-sak** (§8.2).
  Utspelet (`leadFromSuit`) är **inkopplat i botten** (`play-bot.ts` använder det i
  stället för egen sekvenslogik). Att LÄSA motpartens signaler (full försvars-
  strategi) hör ihop med DDS (punkt 28) och tas separat. Tester i `signals.test.ts`.
- ✅ Punkt **28** (DDS double-dummy-solver) – **egen lösare i ren TypeScript**
  (`src/lib/engine/dds.ts`), inga beroenden, ingen WebAssembly → funkar garanterat
  på GitHub Pages. (De två utvärderade npm-paketen var trasiga: `bridge-dds@1.4.0`
  kraschar i `CalcDDtablePBN` med `RuntimeError: null function`; `@bridge-tools/dd`
  har fel wasm-sökväg och oklart resultat. Verifierat i webbläsaren.) Lösaren:
  alfa-beta med nollfönster-binärsök, transpositionstabell och likvärdiga-kort-
  reduktion. **Bevisat korrekt:** `dds.test.ts` jämför mot ett oberoende orakel
  (ren minimax byggd på `play.ts`) på ~2000 små givar + kända fulla givar + mitt-
  i-spelet-ställningar (totalt 379 tester gröna). **Inkopplat:** knappen
  **"Visa facit"** på Spela kort (`tryDoubleDummyDeclarerTricks` /
  `doubleDummyDeclarerRemaining`) visar spelförarens stick med perfekt spel från
  NUVARANDE ställning. **Prestanda-avgränsning:** fulla 13-kortsgivar (särskilt
  sang) är för tunga för en ren JS-lösare på rimlig tid, så facit har en
  **nodbudget** (fryser aldrig gränssnittet) och visas tillförlitligt först en bit
  in i given (få kort kvar = snabbt); tidigt visas "för tung – prova längre in".
  **Möjlig framtida förbättring:** webworker + starkare beskärning (quick tricks)
  för facit redan på utspelet, eller en fungerande WASM-DDS om sådan dyker upp.
