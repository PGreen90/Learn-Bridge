# 👀 Bevaka i spel — aktiva noteringar

> **Vad detta är:** varje gång vi bygger något nytt i budgivningen skrivs en rad
> här om vad ägaren ska hålla ögonen på vid bordet. Listan är **nyast först**.
> CLAUDE.md visar bara de tre senaste — hela listan bor här (flyttat 2026-07-25
> för att hålla projektkartan kort).
>
> **När läser Claude den här filen?** När ägaren säger att något känns fel i
> spel, när en felrapport kommer in, och när en ny fix ska läggas till listan.
> Punkter som stått länge utan klagomål kan strykas — de har passerat provet.

## Spelkvalitet (2026-07-30) — försvaret spelar tredje hand högt (#34)
- **Bottarna lägger nu en HONNÖR tredje hand i sang (NYAST).** Ledde din partner
  och en motståndare vann just nu (t.ex. träkarlen slog partnerns låga utspel),
  och bara den dolda spelföraren står bakom boten, lägger den sin **lägsta
  honnör** för att tvinga fram spelförarens – i stället för det gamla billiga
  spotkortet som spelföraren gick över gratis. **Bevaka:** (a) lägger boten en
  honnör där ett lågt kort hade varit bättre – t.ex. med en gaffel den borde ha
  behållit hel? (Regeln väljer *lägsta* honnören just för att spara esset över
  spelförarens kung, men säg till om den känns fel.) (b) Gäller **bara sang** –
  i trumfkontrakt lägger boten lågt som förr (tredje-hand-högt hjälpte inte där,
  det satte försvararen på lead in i ruffhanden). Känns det rätt att den bara gör
  detta i sang?

## Spelkvalitet (2026-07-29) — spelföraren etablerar lång färg (#32)
- **Bottarna etablerar nu lång färg i SANG (NYAST).** Är boten spelförare i sang
  och sitter med en lång färg som behöver en spärr utknackad (t.ex. ♦KQJT9 mot
  motståndarnas ♦A) knäcker den spärren FÖRST, medan sidoessen håller, i stället
  för att casha topparna. **Bevaka:** (a) ger boten ibland ifrån sig ledningen i
  fel läge – attackerar den långfärgen när den i stället borde casha hem
  kontraktet direkt? (b) känns det rätt att den bara gör detta i sang (i
  trumfkontrakt ruffar den fram färgen som förr)? Gäller bara spelföraren; #34
  (försvarets tredje-hand-högt) är ännu inte byggt.

## Etapp 7 (2026-07-28) — missad lillslam
- **Öppnarens suutrebid graderas nu efter styrka (hål 1, NYAST).** Har du öppnat
  med en 6-korts färg och partnern svarat på 1-läget rebjuder du inte längre
  billigast med allt: **16+ startpoäng hoppar** (1♥–1♠–3♥), och **19+ i högfärg
  sätter utgången** (4♥). En minor stannar på 3-läget även med 19+. Måttet är
  startpoäng, inte råa hp — en 15:a med `AQT983` hoppar. **Bevaka:** (a) hamnar
  ni för högt när hoppet bygger på LÄNGDpoäng och partnern har en bottenhand?
  (b) 4♥-hoppet med 19+ ger upp slamutredningen — missas slam där i stället?
  (c) känns 3♣/3♦-hoppet passat för ofta av partnern (det är en inbjudan, inte
  krav)?

## Felrapporter #40/#41/#42 (2026-07-28, kväll)
- **17+ säljer aldrig given över deras 1-lägesöppning (#40, NYAST).** Ryms en
  17+-hand inte i något fönster — för stark för det kapade inklivet (tak 16),
  fel form för upplysnings-X:et, och utan egen 5+ färg — dubblar den ändå.
  Typfallet är en hand vars enda långfärg är öppnarens egen. **Bevaka:** (a)
  dubblar bottarna nu på händer där pass kändes bättre — särskilt med LÄNGD i
  deras färg (X:et är ju upplysning, inte straff)? (b) tvingas partnern svara
  på luft och åka på straff?
  **KÄNT HÅL I ROND 2 (kontrollmätning M19, frö 20260952):** den starka
  dubblaren kan **sälja given i nästa rond**. `1♦–X–P–3♣–P–P–P`: Väst dubblar
  med 19 hp, Öst hoppar 3♣, och Väst **passar** — ÖV kunde ta 7NT.
  `ownStrongDoubleRebid` kräver en egen 5+ **objuden** färg för det starka
  återbudet, och en jämn 19-poängare har ingen → ingen väg vidare alls.
  Principen "17+ säljer aldrig given" gäller alltså bara rond 1 i dag. Är detta
  kandidat till ett eget jobb står det i `docs/senare.md`.
- **Sangsystemet gäller även off-book (#41).** Bjuder du 1NT/2NT själv i
  budlådan svarar partnern nu med Stayman/transfer/Texas/Minor Suit Stayman och
  öppnaren ger sitt vanliga återbud. **Bevaka:** (a) läser motorn ditt bud som
  du menade det — 2♠ över 1NT är alltid Minor Suit Stayman, aldrig naturligt?
  (b) stör motståndarna lämnar sangsystemet över till §7.8; känns det bytet
  rätt? Rör INTE botgivarna (bottarna bjuder alltid on-book) — bara dina egna.
- **Kvantitativ höjning av partnerns naturliga 3NT (#42).** Har partnern öppnat
  på 1-läget i en färg och placerat kontraktet i 3NT höjer kaptenen till 6NT med
  **21+ hp**. **Bevaka:** (a) hamnar ni i 6NT som går bet — 21 mot visade 12 är
  golvet, inte ett säkert bud? (b) regeln är smal (tyst motstånd, ingen renons)
  — missas slam i lägen som känns identiska? M19 visar att den nästan aldrig
  träffar i botgivar, så det är dina egna givar som ger svaret.

## Etapp 6 (2026-07-27/28) — billig offring
- **Hål 4: försvaret väcker över deras höjda spärr (2026-07-28, NYAST).**
  Efter deras öppning + spärrhöjning (`2♠–P–3♠` / `1♣–P–3♣`) tiger bottarna
  inte längre: direkt över höjningen gäller spärrfönstren (X 14+, färg 13–16,
  17+ dubblar alltid, 3NT till spel först från 19), i balansering lånas en
  kung på X (11+) och färg (10+) med offshape-X ok, 3NT från 16. Tvingade
  svar på 3-läget+ väljer honnörsstarkare färg på lika längd. **Bevaka:**
  (a) tvingas partnern svara på 4-läget på luft och åker på dubbel straff —
  känns X-golven för lätta? Ett genomgånget exempel (2026-07-28, hittat när
  deploygrinden felsöktes) talar snarare FÖR golven: frö 1781, Öst balanserar
  X på 14 hp över deras `1♣–P–3♣` och Väst svarar `3♦` på 10 hp med
  `♦AQ62` — 24 hp tillsammans på 3-läget, alltså sunt. Formen att leta efter
  är alltså inte tvångssvaret i sig utan svar där advancern har **under ~8 hp**
  och ingen färg att gå till. Dumpa vilken giv som helst med
  `$env:DUMP='1781'; npx vitest run src/lib/engine/auktionsdump.probe.test.ts`
  (auktionen med förklaring per bud hamnar i `revisor-output/auktionsdump.txt`). (b) höjningar förbi 3-läget lämnas medvetet
  tysta — säljs för många 4♠-höjningar? (c) 19-golvet för direkta 3NT — står
  ni kvar i X-svar när 3NT var enda utgången?
- **Hål 3: taket mot svaga tvåor (2026-07-27).** Starka händer passar
  inte längre ut deras svaga tvåor: 3NT till spel bjuds med balanserade 19+
  (16+ i balansering) eller stark 6+ minor med stopp, och 17+ utan fönster
  dubblar hellre än säljer. **Bevaka:** (a) hamnar ni i 3NT på tunna håll
  (Kxx räknas som stopp)? (b) känns 16+-golvet i balansering för lätt —
  straffas 3NT när skörden inte fanns?
- **Hål 2: advancern talar när de bjuder över partnerns X (2026-07-27).**
  Höjer motståndarna över botens upplysningsdubbling — (1♣)–X–(2♣) — tiger
  advancern inte längre: 12+ bjuder 3NT/cue, 9–11 hoppar, 6–8 bjuder billigast,
  extrem form (6+ färg/5-5) bjuder oavsett poäng, och deras XX flys ALLTID.
  Dubblaren höjer svaret skalat (hopp accepteras med 15+, fritt svar kräver 19+
  för utgång). **Bevaka:** (a) väcker advancern för lätt — kliver boten in på
  form och åker på straff? (b) känns dubblarens utgångströsklar rätt, eller
  missas utgångar när dubblaren har en bra 17–18? (c) cue-svaret visar
  högfärgen före 3NT — hamnar ni i 4-3-utgångar där sang var rätt?
- **Hål 1: stöddubblingen besvaras nu (2026-07-27).** Dubblar partnern
  (boten) som öppnare efter ditt 1♥/1♠-svar och deras inkliv, svarar boten som
  svarare nu ALLTID: 13+ sätter utgången (4M med femkortsfärg / 3NT med stopp /
  4M på 4-3), 10–12 inbjuder (3M, egen 6+ färg, invithöjning, 2NT), minimum
  bjuder billigast — och pass är numera ett MEDVETET straffpass (trumfstack,
  max 12 hp). **Bevaka:** (a) hamnar ni för högt när svararen väljer 4M på
  4-3-fiten? (b) känns straffpasset lagom vanligt — straffar boten när den
  borde bjuda, eller tvärtom? (c) öppnaren accepterar inbjudan med 15+ —
  står ni fel när öppnaren är en bra 14?

## Känd skuld — verktyg som boken lovar men bordet inte kan
- **Lebensohl är INTE inkopplad (upptäckt vid genomgången 2026-07-25).**
  `lebensohl.ts` är byggd och enhetstestad, men ingen produktionsfil importerar
  den: i ett svep där motorn bjöd 3 000 givar föll 0 Lebensohl-bud. **Bevaka:**
  säger du 2NT efter partnerns upplysningsdubbling av en svag tvåa förstår
  partnern det INTE som Lebensohl-relä. §7.5 i boken är märkt tills vidare;
  inkopplingen ligger som eget jobb. Kopplingsvakten i `src/docs-vakt.test.ts`
  ser till att ingen annan modul tappar kontakten på samma tysta sätt.

## Etapp 4 (2026-07-24 → 2026-07-25) — slam efter 2♣, reverse och hoppskift
- **Familj C: reverse/hoppskift-fortsättningen (2026-07-25, NYAST).**
  (a) Efter botens hoppskift (t.ex. 1♠–1NT–3♥) sätter svararen nu UTGÅNGEN:
  4♥ med fyrkortsfit i hoppfärgen, 4M-lyft av preferensen med utgångsvärden,
  5m när sanghåll saknas — **bevaka:** hamnar ni i tunna utgångar när boten
  hoppskiftat på lätta 16? (b) Reverserar/hoppskiftar boten och du har fit
  kan den nu driva RKC mot visade 16/19 — **bevaka:** bjuds tunna slammar
  för ofta (två DD-bet per 1000 givar är medvetet ärligt), och känns
  4m-slaminbjudan efter reverse begriplig?
- **Familj B: slam efter stark 2♣ (2026-07-24).** Svarar du positivt på botens
  2♣ (eller boten på din) och en trumf hittas, kör kaptenen nu RKC mot visade 22
  (driv 33+, inbjudan 5M/stödhöjning 31–32). **Bevaka:** (a) bjuds slam för OFTA
  på 2♣-givar (tunna 33-ihop kan åka på en mask — medvetet ärligt)? (b) känns
  5M-inbjudan begriplig vid bordet? (c) spelstick-2♣:or (färre hp, lång färg) —
  hamnar de för högt när svararen räknar med 22? (d) utan fit: RKC bara med egen
  solid 6+ färg och 6NT bara efter botens 3NT-återbud — saknar du en sangslam?

## Etapp 5 (2026-07-24) — missad utgång
- (a) Har du 4 kort i den färg boten visade i sin ANDRA rond (1♣–1♥–1♠) höjer
  boten nu graderat — 2♠ svagt, 3♠ inbjudan, 4♠ med utgångsvärden — **bevaka:**
  hamnar ni för högt någon gång (posten "för högt" växte två givar i mätningen)?
  (b) Inbjuder du efter ditt 1NT-svar (1♠–1NT–2♠–2NT) svarar boten nu alltid:
  3♠ med minimum, 4♠ med utgångsvärden — sang spelas aldrig när boten lovat sex
  kort — **bevaka:** känns 3♠-rättelsen rätt, eller saknar du 2NT som slutkontrakt?
  (c) 1NT-boten accepterar nu din 2NT-inbjudan med en **"bra 15"** (tät A-K-D-klump
  eller femkortsfärg) — **bevaka:** hamnar ni i tunna 3NT för ofta? Platt 15 med
  bara damer/knektar passar fortfarande.

## Etapp 3 (2026-07-21 → 2026-07-22) — fel färg-spåret
- **Fix 6:** fyra nya domslutsvakter i konkurrens: (a) har din partner just passat
  höjer boten dig bara TÄVLANDE (billigast) — **bevaka:** missas utgångar när
  partnern smygpassat med bra hand? (b) bot-öppnaren tävlar inte över deras utgång
  efter din pass — **bevaka:** borde den offrat någon gång? (c) cue-höjer boten din
  öppning och du återgår billigast stannar den nu med limit-värden (under 13 sp) —
  **bevaka:** står ni för lågt när du var maximal? (d) ditt utgångsbud dras aldrig
  längre till en "tvingad" färg av öppnaren.
- **Fix 5:** (a) fjärde hand **balanserar nu över deras svaga tvåor** — inkliv på
  8–9 hp, X med tre hackor i deras färg och 2NT på 12–15 kan dyka upp i
  utpassningsläget — **bevaka:** väcker boten givar för lätt där pass var bäst? Och
  höjer din partner ditt balansinkliv för snålt (rabatten −3 + tak på 3-läget är
  medveten)? (b) efter din **negativa dubbling** passar boten inte längre öppnarens
  tvingade färgsvar med 9–12 hp: den prefererar öppningsfärgen (ev. med hopp),
  rebjuder egen färg eller bjuder 2NT — och öppnaren FÅR passa det (X + färg = ej
  krav) — **bevaka:** står vi för lågt när dubblaren faktiskt var stark, eller drivs
  delkontrakt en nivå för högt?
- **Fix 4:** (a) svarar din partner på en stark tvåfärgs-cue över deras svaga tvåa
  väljs nu färgen som kan bjudas billigast vid lika längd — **bevaka:** känns
  preferensen rätt? (b) öppnaren bjuder inte längre 2NT på minimum efter din
  negativa dubbling — du får en billig färg i stället — **bevaka:** saknar du sangen
  någon gång med 13–14 hp? Och höjningar av det tvingade svaret på dubbelton görs
  bara med utgångsvärden — **bevaka:** står vi för lågt någon gång? (c) med 11–14 hp
  utan fit mot partnerns svaga tvåa passar boten nu (krav på 3-läget = 15+) —
  **bevaka:** missas utgångar du hade bjudit?
- **Fix 2+3:** (a) efter en stark 2♣-auktion `2♣–2♦–3♣/3♦` visar svararen nu sin
  billigaste 4-korts högfärg under 3NT — **bevaka:** hittar paret 4-4-fiten lagom
  ofta, och hamnar sangen nu på ÖPPNARENS (starka) hand? (b) svararen höjer inte
  längre öppnarens tvingade färg-ombud på dubbelton när hen har en egen visad
  6-korts färg. (c) När din partner cue-höjer din minoröppning i konkurrens svarar
  öppnaren nu **3NT med jämn hand + stopp i deras färg** — **bevaka:** står 3NT
  lagom ofta, eller bjuds det på för tunna stopp (Kx räknas)?
- **Fix 1 "5♣-ryckaren":** boten läser inte längre partnerns Stayman/överföring som
  en äkta färg, och rör ALDRIG partnerns obestridda utgångsbud off-book (förr kunde
  1NT–2♣–2♦–3NT ryckas till 5♣ → bet). **Bevaka:** (a) står partnerns 3NT/4M/5m nu
  alltid kvar som det ska? (b) passar boten någon gång FÖR snällt i ett läge där den
  borde tävlat vidare (vakten gäller bara när motståndarna INTE bjudit över)?

## Slam — grundprincipen (2026-07-07, styr ALLA slam-vägar)
- **ÄRLIGA SLAMPORTAR:** all slamutredning beslutar på egen hand + partnerns VISADE
  intervall. **Bevaka:** (a) **missar** boten slammar du tycker den borde bjudit?
  (Medvetet: hellre systemriktig miss än kik.) (b) **Inbjudningarna** (5M/4m/
  kvantitativ 4NT): accepterar partnern lagom ofta? (Accept = över blott minimum.)
  (c) **Partner-rättelsen** (kaptenen stannar 5-trumf, partnern lyfter till 6 med
  det höga antalet) — ser den rätt ut vid bordet? (d) Utan kontrollkoll kan en slam
  någon gång åka på två snabba ess — ägarens medvetna val, men säg till om det
  svider för ofta. (e) Motorn cue-bjuder inte längre själv (§6.2 gäller manuella
  cue). (f) Storslam kräver visshet → 7-läget är ovanligt (~1/4300 giv).
- **Slam-vägarna i spel (var täcks slam i dag?):** Jacoby 2NT, inverterad minor,
  öppnarens hopphöjning (`1x–1M–3M`), hopp-återbud i minor (`1m–1M–3m`),
  1NT-återbudet (`1m–1M–1NT`), MSS, Gerber över 1NT/2NT, Exclusion efter splinter,
  **stark 2♣** (etapp 4 familj B) och **reverse/hoppskift** (familj C) — alla via
  kaptensregeln. TÄCKS ÄNNU INTE: advancer-slam efter upplysningsdubbling.
- **#33 Advancern hoppar inte förbi utgång** efter upplysningsdubbling — säg till om
  den borde utforskat slam i stället för att nöja sig med utgång.

## Äldre noteringar (har stått ett tag utan klagomål)
- **#32 6-5-öppning:** högfärgen 12–15, lågfärgen 16+ — bevaka öppningsvalet och att
  6-5:an visas begripligt i rond 2 (reverse in i högfärgen).
- **2♣ dör inte i delkontrakt + systems-on efter `2♣–2♦–2NT`** — bevaka fit-sökningen.
- **#31 Inget svagt hoppskift:** svag 6-korts hf svarar 1♥/1♠ — säg till om en
  spärrig hand borde fått hoppa.
- **#30 Stark jämn 19+ öppnar 2NT** (kvalitet, startpoäng ≥20) + sang-visning efter
  minorhöjning i konkurrens (3NT-accept från 8 hp) — bevaka golven.
- **Flerronds-konkurrens A+B+C (§5.9/§7.1):** tävlar/återöppnar i rond 2+; C-golvet
  ~8 stödpoäng; trap-pass kan konverteras till straff — bevaka alla tre.
- **"Låna en kung" i balansering (§7.1):** inkliv från 5 hp, X från 9, 1NT 11–14 —
  säg till om boten väcker givar för lätt.
- **Öppnarens rond-2 i konkurrens efter ny färg/1NT (§5.8):** cue = 15+, 18+ =
  utgång; cue väljs medvetet före straffdubbling.
- **Störda krav = RONDKRAV (§5.5):** fria bud/reverse i konkurrens tvingar ett svar
  men aldrig utgång i onödan — bevaka båda hållen.
- **#26/#27 Utgångskrav passas aldrig off-book** (cue-höjning + höjd 2/1).
- **5♣/5♦-utgång nåbar efter inverterad minor** (svag sidofärg-regeln) — bevaka
  5m-mot-3NT-valet åt båda hållen.
- **#24/#25 Motspelarens kast-vakt** (sakar inte bort garderande honnör) +
  1NT-återbudets nya förklaringstext.
- **#23 Takeout-X:** 17+ enfärgshand X→färg billigast med flerronds-fortsättning;
  ⚠️ konservativ game-dom efter stödhöjning (18+/21+-golv); tvåfärgs-X 4-4 (10+) —
  se budsystem.md §7.3.
- **Inklämt konkurrensläge:** öppnarens X = game try (ej straff), 18+ = 4M.
- **DONT mot deras 1NT** (golv 8 hp direkt / 6 balansering).
- **Försvar mot svaga tvåor/spärrar** (takeout-X 12–13 hp; mot spärr 14 — stramare).
- **Svar när de stör VÅR öppning:** X/XX från 8 hp mot DONT; XX 10+ efter deras
  takeout-X — bevaka golven.
- **Straffdubbla flykten efter vår XX** — varje flyktbud dubblas; säg till om det
  känns för aggressivt.
- **Straffdubbling mot ägaren:** bottarna kan straffdubbla ÄGAREN vid offringar på
  3-läget+ (poängsystemet).
- **Essfrågor utan formell trumf / toppsekvenser andra hand / 4M-pass efter
  transfer-3NT** (felrapport #10–#13).
- **Michaels & essfrågor i fria auktioner; motspelarna sparar torra ess**
  (felrapport #6/#7/#9).
- **Balansering mot ägaren:** bottarna balanserar även MOT ägaren (symmetriskt —
  korrekt bridge, men säg till om det känns fel; felrapport #5).
- **Öst över spärrhöjning** (1♣–2♥–X–3♥ → konkurrera 3♠ eller passa?): boten passar
  — ägarbeslut om det känns fel (felrapport #1–4).
