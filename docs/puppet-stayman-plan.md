# Puppet Stayman över 2NT — plan (2026-09-15) — BYGGD, väntar ägarens PCD

> **Ägardirektiv 2026-09-15:** "2NT-svaren skall bli Puppet Stayman. Lär dig om
> denna, förbered bytet." Planen skrevs på förmiddagen; ägaren tog grindbesluten
> samma dag och bygget gjordes direkt (facit före fix: `puppet-stayman.test.ts`).
> Systemboken §4.3b är den levande beskrivningen — det här dokumentet är
> bakgrunden och besluten.
>
> **Ägarens grindbeslut 2026-09-15** (avvikelser från rekommendationen i fetstil):
> 1) 3♣ kräver **bara en 3-korts högfärg** (ingen 4333-regel — alt B) ·
> 2) hybriden (Smolen över 2NT bort; ägarfråga "funkar inte Smolen?" besvarad:
> samma bud, olika betydelse efter 3♣–3♦ — och Puppets 3♦ lovar en 4-korts, så
> 4♦ gör Smolens jobb) · 3) ja · 4) ja · 5) ja, bättre 4-korts högfärgen (flest
> hp, lika → 4♥) · 6) **4♣ byggd nu** (4M → 4NT vid 33+, 5M-inbjudan 31–32) ·
> 7) **Puppet även över 2NT-inklivet**, trösklar mot 15–18 (utgång från 9) ·
> 8) ingen Muppet.
>
> **Medvetet kvar (SENARE):** 4♣-slamvägen efter 2♣–2♦–2NT (där går båda-
> högfärgerna alltid 4♦ och slamletningen efter öppnarens 4M saknar rad) ·
> slamport över 2NT-inklivet · Muppet.

## 1. Varför bytet är motiverat i rebidz

- **2NT-öppningen får ha en 5-korts högfärg.** Balanserad = 4-3-3-3, 4-4-3-2
  eller **5-3-3-2** (`src/lib/engine/hand.ts`, `isBalanced`), och 2NT öppnas
  på 20–21 balanserad utan undantag för 5-korts högfärg (`openings.ts`).
  Samma sak gäller 2♣–2♦–**2NT (22–24)** (`responses-2c.ts`).
- **Dagens Stayman (3♣) hittar bara 4-4.** Öppnaren svarar "4+ ♥ → 3♥", så en
  5-korts högfärg visas som om den vore fyra, och en **5-3-fit hittas bara när
  svararen har femkortsfärgen** (transfer). Har öppnaren ♥AQJ43 och svararen
  ♥K72 spelas 3NT.
- **Sond mot dagens motor (2026-09-15, `decideFromTable` ur EN hand):**

  | Läge | Svararen | Dagens bud | Kommentar |
  |---|---|---|---|
  | 2NT–3♣–3♠–? | ♠AQ43 ♥K43 ♦K43 ♣K32 (14 hp) | **4♠, stopp** | 14 + 20 = 34: slamzon, men ingen port finns efter en Stayman-fit över 2NT |
  | 2NT–3♣–3♦–? | ♠AQ43 ♥KJ43 ♦K43 ♣32 (13 hp) | 3NT | rätt i dag (3♦ = ingen 4-korts) |
  | 2NT–3♣–? (öppnaren) | ♠AK ♥AQJ43 ♦KQ4 ♣K32 (21) | 3♥ "4+ ♥" | femkortsfärgen syns inte |
  | 2NT–? | ♠K43 ♥Q42 ♦K543 ♣432 (8 hp) | 3NT direkt | 5-3 i en högfärg letas aldrig |
  | 2NT–3♣–3♦–? | ♠KJ432 ♥Q543 ♦K4 ♣43 | 3♥ Smolen | fungerar; ersätts av Puppet-strukturen |
  | 2NT–3♥–3♠–? | ♠KJ432 ♥QJ543 ♦K4 ♣4 (5-5) | **3NT** | hjärtern visas aldrig — 8-kortsfit garanterad men missad |

  Slamluckan (rad 1) och 5-5-luckan (rad 6) är **fel i dag**, oberoende av
  Puppet, och stängs i samma bygge.

## 2. Konventionen (källor)

Primär källa **bridgebum.com/puppet_stayman.php** (ägarens föredragna källa),
kompletterad med Wikipedia (Stayman convention), Larry Cohens artikel (som
**varnar för 5-4-hålet** över 2NT, se §4) och Porthcawl-klubbens "Five-card
Puppet Stayman". Alla fyra beskriver samma kärna:

**Svararens 3♣** frågar: *"har du en 5-korts högfärg? annars en 4-korts?"*
Konstgjort, alert, krav.

| Öppnarens svar | Betydelse |
|---|---|
| **3♦** | ingen 5-korts högfärg, men **minst en 4-korts** |
| **3♥** | **5 hjärter** |
| **3♠** | **5 spader** |
| **3NT** | ingen 4- eller 5-korts högfärg |

**Svararens fortsättning efter 3♦** — Puppet-tricket: svararen bjuder den
högfärg hen **inte** har, så att öppnaren (den starka handen) blir spelförare
i en eventuell 4-4-fit:

| Svararens bud | Betydelse | Öppnaren |
|---|---|---|
| **3♥** | 4 **spader** (förnekar 4 hjärter) | 4♠ med 4 spader, annars 3NT |
| **3♠** | 4 **hjärter** (förnekar 4 spader) | 4♥ med 4 hjärter, annars 3NT |
| **3NT** | ingen 4-korts högfärg (letade 5-3) | till spel |
| **4♦** | **båda** högfärgerna | bjuder sin 4-korts högfärg; fit garanterad (3♦ lovade en) |
| 4♣ | båda högfärgerna + slamintresse | *(variant — se §5, utanför v1)* |

**Efter 3♥/3♠** (öppnarens femkortsfärg): 3+ stöd → utgång i färgen, annars
3NT. Slamintresse: bridgebum föreslår "den andra högfärgen" som trumfsättning,
rebidz använder sitt eget cue-maskineri (§6 i systemboken) — se beslut 4.

**Efter 3NT**: pass, eller den vanliga sangtrappan (4NT kvantitativ / 6NT).

**Muppet Stayman** (variant): byter 3♥ och 3NT (3NT = 5 hjärter, 3♥ = ingen
femkorts) så att svararen med 4 spader kan visa dem under 3NT. Mer träffsäker
vid 5-4 hos öppnaren men **öppnaren är alltid balanserad i rebidz** (5-4 finns
inte) → vinsten är liten, priset är en till konstlad nivå. **Rekommendation:
nej** (SENARE, låg prio).

**Puppet över 1NT** (2♣ frågar efter 5-korts): berörs inte — 1NT-systemet
(Stayman/Smolen/transfers) är orört.

## 3. Vem bjuder 3♣? (beslut 1)

Puppet är värdefullt just för att svararen **utan** 4-korts högfärg kan leta
öppnarens 5-3-fit. Tre alternativ:

| Alt | 3♣ bjuds med | + | − |
|---|---|---|---|
| **A (rek.)** | 4-korts högfärg, ELLER 3-korts högfärg i en hand som **inte** är 4-3-3-3 | hittar 5-3 där den spelar bättre än 3NT | 4-3-3-3-handen spelar 3NT även mittemot 5-3 (rätt MP-omdöme: platt hand, sang ger ofta samma stick + 10 poäng mer) |
| B | alltid när någon högfärg har 3+ kort | maximalt antal fits | fler 3♣-sekvenser som "läcker" att öppnaren har en 4-korts högfärg (3♦) när svararen ändå slutar i 3NT |
| C | bara 4-korts högfärg | minsta ändring | tappar konventionens huvudpoäng (5-3 hittas bara när svararen har 4-korts) |

Gemensamt för alla: utgångsvärden (**5+ hp mot 20–21, 3+ mot 22–24**), ingen
egen 5-korts högfärg (→ transfer), inte Gerber-handen (13+ balanserad utan
4-korts högfärg går fortfarande 4♣ direkt, `nt-slam.ts`) och inte
minorfrågehanden (5-4 i lågfärgerna med slamvärden → 3♠).

**Rekommendation A.** Tävlingen räknar MP (låst), och "platt hand → sang" är
standardomdömet vid MP.

## 4. 5-4 i högfärgerna — Cohens hål (beslut 2)

Larry Cohen: *"Puppet efter 2NT fungerar dåligt när svararen är 5-4 i
högfärgerna"* — Smolen (bjud 4-korts, visa 5 i den andra efter 3♣–3♦) krockar
med Puppet-svaren, där 3♥/3♠ efter 3♦ betyder något annat. Tre lösningar:

| Alt | 5♥ + 4♠ | 5♠ + 4♥ | Hål |
|---|---|---|---|
| **H (rek., hybrid)** | transfer 3♦ → 3♥, sedan **3♠** = 4 spader, utgångskrav (under 3NT!). Öppnaren: 4♠ med 4 spader · 4♥ med 3 hjärter · annars 3NT | **3♣ Puppet**: 3♠ → 4♠ · 3♥ → 4♥ · 3♦ → **4♦** (båda) → öppnaren väljer, fit garanterad · 3NT → pass | 5♠4♥ mot öppnarens exakt 3 spader utan 4-korts: 5-3-spaderfiten går förlorad, 3NT står (samma pris som all 5-3-jakt i sang) |
| T | transfer, sedan andra högfärgen | transfer 3♥ → 3♠, sedan **4♥** | 5♠4♥ passerar 3NT; öppnaren med ♠xx ♥xxx tvingas välja 4-3-fit på 4-läget |
| P | 3♣, sedan 4♦ över 3♦ | samma | 5♥4♠ mot öppnarens 3 hjärter: 5-3 förlorad åt båda hållen |

**Rekommendation H:** den enda som aldrig hamnar i en 4-3-fit på 4-läget och
som behåller 3NT som utväg. **Smolen över 2NT försvinner** (Smolen över 1NT är
orörd).

**5-5 i högfärgerna** (i dag en lucka, sond rad 6): transfer 3♥ → 3♠, sedan
**4♥** = 5+ hjärter också, utgångskrav — öppnaren väljer 4♥/4♠. Öppnaren kan
aldrig ha dubbelton i båda högfärgerna (balanserad), så en 8-kortsfit finns
alltid. Med 6-5: transfer till 6-färgen, samma fortsättning.

## 5. Övriga grindbeslut (med rekommendation)

3. **Systems on efter 2♣–2♦–2NT (22–24):** samma Puppet-struktur, trösklarna
   två steg lägre (som i dag för Stayman). **Rek: ja** — det är samma kodväg
   (`strong-2nt-systemson.ts` anropar `respondTo2NT` med 22 som minimum), och
   22–24-handen får lika gärna ha 5-3-3-2.
4. **Slamporten efter Puppet-fit i v1:** i dag saknas den (sond rad 1).
   Förslag: när trumfen är känd (öppnarens 3♥/3♠ med 3+ stöd, eller
   öppnarens 4M efter 3♦–3♥/3♠/4♦) räknar kaptenen (svararen) mot visade 20
   (22): **≥ 33 → driv**, cue-runda över 3M via befintligt maskineri
   (`slamContextFor` + `slamCaptainFirstStep`, partnerMin 20, gameForcing) —
   "kontrollbud ska ALLTID finnas" (ägarbeslut 2026-08-03); över en 4M-fit
   (inget utrymme under utgång) 4NT RKC direkt. 31–32 → v1 nöjer sig med
   utgång (hellre systemriktig miss). **Rek: ja i v1** — luckan finns redan och
   maskineriet finns.
5. **4♦ (båda högfärgerna) — öppnaren med 4-4:** bjuder **4♥** (billigast;
   svararen har båda, valet spelar ingen roll för fiten). Rek: 4♥.
6. **4♣ = båda högfärgerna + slamintresse** (bridgebums variant): **SENARE.**
   v1 går 4♦ → öppnarens 4M → kaptenen 4NT RKC med 33+.
7. **2NT-inklivet (15–18 efter deras svaga tvåa/spärr):** har egen struktur
   utan 3♣ alls (ägarspec 2026-09-11, `preempt-defense-continuations.ts`).
   **Rek: orört i v1**, kandidat i SENARE ("3♣ Puppet även över 2NT-inklivet").
8. **Muppet:** nej (§2). SENARE, låg prio.

## 6. Exempelhänder (ägaren synar FÖRE bygget)

Öppnaren = Nord, 2NT (20–21). Svararen = Syd. "I dag" = dagens motor,
"Puppet" = planen med rekommendationerna A + H.

| # | Syd | I dag | Puppet | Poäng |
|---|---|---|---|---|
| 1 | ♠K72 ♥K843 ♦Q65 ♣J43 (9) | 3♣ (Stayman) → 3♦/3♥/3♠ som i dag | **3♣**; Nord 3♠ (5 sp) → **4♠** (5-3) · Nord 3♦ → **3♠** (visar 4 hj) → Nord 4♥/3NT · Nord 3NT → pass | 5-3-fiten hittas; 4-4-fiten spelas av Nord |
| 2 | ♠Q73 ♥J72 ♦K654 ♣Q83 (8, 3-3-4-3) | 3NT | **3NT direkt** (alt A: platt hand) — med alt B: 3♣ | MP-omdömet |
| 3 | ♠Q73 ♥J7 ♦K6542 ♣Q83 (8, 3-2-5-3) | 3NT | **3♣**; Nord 3♠ → 4♠ · annars 3NT (efter 3♦: **3NT**, ingen 4-korts) | 5-3 i spader hittas |
| 4 | ♠KJ43 ♥Q543 ♦K4 ♣432 (9, 4-4) | 3♣; efter 3♦ → 3NT | 3♣; efter 3♦ → **4♦** → Nord bjuder sin högfärg | fit garanterad |
| 5 | ♠KJ432 ♥Q543 ♦K4 ♣43 (5♠4♥, 9) | 3♣ → 3♦ → 3♥ Smolen | **3♣**; 3♠ → 4♠ · 3♥ → 4♥ · 3♦ → **4♦** · 3NT → pass | Smolen bort |
| 6 | ♠Q543 ♥KJ432 ♦K4 ♣43 (5♥4♠, 9) | 3♣ → 3♦ → 3♠ Smolen | **3♦** (transfer) → 3♥ → **3♠** (4 sp, krav) → Nord 4♠/4♥/3NT | under 3NT |
| 7 | ♠KJ432 ♥QJ543 ♦K4 ♣4 (5-5, 10) | 3♥ → 3♠ → 3NT (hjärtern tappas) | 3♥ → 3♠ → **4♥** → Nord 4♥/4♠ | luckan stängd |
| 8 | ♠AQ43 ♥K43 ♦K43 ♣K32 (14) | 3♣ → 3♠ → 4♠, stopp | 3♣ → 3♠ (5 sp) → **cue/RKC** mot 6♠ (14 + 20 ≥ 33) · 3♦ → 3♥ → 4♠ → **4NT RKC** | slamporten |
| 9 | ♠K3 ♥KJ432 ♦Q43 ♣432 (9, 5 hj) | 3♦ → 3♥ → 3NT → Nord väljer | oförändrat | transfers orörda |
| 10 | ♠KQ4 ♥KQ4 ♦K543 ♣Q32 (15) | 4♣ Gerber | oförändrat (Gerber-handen går före Puppet) | |

Öppnarens svar på 3♣, fyra Nord-händer (alla 20–21):
♠AK ♥AQJ43 ♦KQ4 ♣K32 → **3♥** (5 hj) · ♠AQ43 ♥AK4 ♦KQ4 ♣K32 → **3♦** (4-korts
finns) · ♠AKQ ♥AQ4 ♦KQ43 ♣K32 → **3NT** (ingen) · ♠AQ43 ♥AK43 ♦KQ ♣K32 → **3♦**
(4-4 → efter 4♦ bjuder hen 4♥).

## 7. Kodkarta — vad rörs

Allt byggs **test-drivet** (facit före fix) och som **tabellrader/
kunskapsfunktioner ur EN hand** (motorbytets kontrakt i `docs/status.md`).

| Del | Fil | Ändring |
|---|---|---|
| Svararens första bud | `src/lib/engine/responses-2nt.ts` `respondTo2NT` | 3♣-villkoren (beslut 1), regel-id **'Puppet Stayman'**; 5♥4♠ → transfer (H), 5♠4♥ → 3♣; 5-5 → transfer |
| Öppnarens svar på 3♣ | samma fil, `openerRebidAfter2NTResponse` | 5-korts först (3♥/3♠), 3♦ = 4-korts finns, 3NT = ingen; regel-id 'Puppet-svar' |
| Svararens andra bud | `src/lib/engine/responder-rebids.ts` `responderRebidIn2NTAuction` | efter 3♦: bjud den du inte har / 4♦ / 3NT; efter 3♥/3♠: 4M / 3NT / slam; efter 3NT: pass/4NT/6NT; efter transfer: 3♠ (5♥4♠) och 4♥ (5-5); **Smolen (2NT) bort** |
| Öppnarens tredje bud | `src/lib/engine/strong-2nt-systemson.ts` `openerChoosesAfterSystemsOn` (delas av 2NT-öppningen och 2♣–2♦–2NT) | efter 3♦–3♥/3♠: 4M med fyrkortsfärgen, annars 3NT; efter 4♦: 4M; efter transfer–3♠/4♥: väljer |
| Slamporten | `src/lib/engine/auction-decide.ts` (`slamContextFor` + svar3-raden) | ny rad: Puppet-fit → kaptenen räknar mot 20/22 (beslut 4) |
| Betydelselagret | `src/lib/engine/auction-meaning.ts` `overNaturalNT` (L === 2-grenarna) | nya betydelser + budförklaringar för alla nya bud; Smolen-raden för L === 2 bort. Texterna följer klarspråksreglerna (budet LOVAR, inga interna namn) |
| Regelregistret | `src/lib/engine/rules.ts` | 'Puppet' i alertlistan; kravnivåer: 3♣ krav-1-rond · 3♦/3♥/3♠-svaren krav-1-rond (svararen måste bjuda) · 3NT-svaret ej-krav · 3♥/3♠/4♦ efter 3♦ krav-1-rond |
| Inklivets namnkarta | `src/lib/engine/overcall-continuations.ts` `ntResponseRule` | 'Stayman (2NT)' → nya id:t (används av 1NT-inklivets systems on bara på nivå 1, men kartan ska stämma) |
| Gerber-porten | `src/lib/engine/nt-slam.ts` | oförändrad; kommentaren nämner Puppet |

**Befintliga tester som ändrar facit** (kända i förväg):
`responses-2nt.test.ts` (skrivs om helt), `responder-rebids.test.ts`
(2NT-delen), `responses-2c.test.ts` (2♣–2♦–2NT–3♣–3♠–4♠: Nord har 4 spader,
inte 5 → Puppet svarar 3♦, Syd 3♥, Nord 4♠), `auction-stayman-not-natural.test.ts`
(frö 20260965: Öst ♠AKT ♥A94 har ingen 4-korts → svaret blir **3NT** i stället
för 3♦; poängen — öppnaren rycker inte 5♣ — kvarstår), `auction-interpret.test.ts`
(Stayman-texterna över 2NT), `rules.test.ts` (nya id:n), samt kikvakten och
auktionsdiffen (`avvikelsedump.probe.test.ts`) som körs som skyddsnät —
varje avvikelse ska vara en förväntad Puppet-ändring.

**Dokument:** `docs/budsystem.md` får en **ny paragraf "4.3b Svar på 2NT
(20–21)"** — i dag finns 2NT-svaren bara i §9-loggen, inte som paragraf; §4.4
(systems on-raden) + §9-loggen; `docs/oversikt.md` (raden "Svar på 2NT");
`docs/budforklaring-katalog.md` (nya texter till ägarens granskning).

## 8. Körordning (när grindbesluten är tagna)

1. **Facit-test FÖRE fix:** ny testfil för Puppet (svararens 3♣-villkor ×
   alt A · öppnarens fyra svar · fortsättningen efter 3♦/3♥/3♠/3NT · 5-4 H ·
   5-5 · systems on 22–24 · slamporten rad 8 · betydelsetexter) — alla röda.
2. `respondTo2NT` + `openerRebidAfter2NTResponse` → första gruppen grön.
3. `responderRebidIn2NTAuction` + `openerChoosesAfterSystemsOn` → andra gruppen.
4. Betydelselagret + regelregistret + rättade gamla tester.
5. Slamporten (beslut 4).
6. Systemboken 4.3b + översikt + katalog; `npx tsc && npm test`; auktionsdiffen
   mot baslinjen; sedan **ägaren säger PCD**.

Uppskattning: en session för 1–4, en halv för 5–6.

## 9. Medvetet utanför v1 (kandidater till SENARE)
- 4♣ = båda högfärgerna + slamintresse (beslut 6).
- Muppet-varianten (beslut 8).
- Puppet över 2NT-inklivet (beslut 7).
- Slaminbjudan (31–32) efter Puppet-fit — v1 driver bara vid 33+.
