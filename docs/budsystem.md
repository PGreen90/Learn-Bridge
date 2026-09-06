# Budsystem — 2 över 1 (2/1 GF)

> **Systembok och sanningskälla.** Allt innehåll i appen (Lär dig-texter och
> budträningens övningar) ska härledas härifrån. Ändra systemet här – inte
> direkt i övningarna.

## 1. Översikt
- **System:** Grundsystem 2 över 1 game force (2/1 GF)
- **Bas:** Naturlig budgivning med 5-korts hf, 1NT 15–17, svaga tvåöppningar
  (♦/♥/♠) och stark, konstgjord 2♣. Konventioner: Bergen-höjningar, inverterade
  minorhöjningar, Stayman/transfers, splinter och slamverktyg (se §4–§8).

## 2. Markeringsstandard
Varje bud i en svarssekvens märks med tre saker:
- **Betydelse** – vad budet lovar (fördelning + styrka)
- **Kravnivå** – en av: Avslut · Ej krav · Inbjudan · Krav (1 rond) · Utgångskrav · Slamintresse
- **Konvention** – konventionens namn, eller "naturligt"

Konventionsbud märks i appen med en alert-markör (●) som visar betydelsen –
som en alert vid bordet.

Förkortningar: **hp** = honnörspoäng · **GF** = utgångskrav (game force) ·
**hf** = högfärg (♥/♠) · **lf** = lågfärg (♣/♦).

## 3. Öppningsbud

| Bud | Min. längd | Styrka | Typ / kommentar |
|---|---|---|---|
| **1♣** | 3+ | 12+ hp | Naturlig (se minor-regeln) |
| **1♦** | 3+ | 12+ hp | Naturlig (se minor-regeln) |
| **1♥** | 5+ | 12+ hp | 5-korts hf |
| **1♠** | 5+ | 12+ hp | 5-korts hf |
| **1NT** | — | 15–17 hp | Balanserad. Konv: Stayman, Smolen, Jacoby, Minor Suit Stayman, Texas |
| **2♣** | — | 22+ hp | Stark, konventionell (krav) |
| **2♦ / 2♥ / 2♠** | 6 | 6–11 hp | Svaga tvåöppningar |
| **2NT** | — | 20–21 hp | Balanserad |
| **3♣ / 3♦ / 3♥ / 3♠** | 7+ | svag | Spärröppning |
| **3NT** | — | 25–27 hp | Stor balanserad |
| **4♣ / 4♦** | lång färg | spärr | Naturlig spärröppning |
| **4♥ / 4♠** | lång färg | spärr (~7+ spelstick) | Spärr till utgång |

**Kvalitetsuppgraderingar av sangöppningarna (TP).** En jämn hand som är
*bättre än poängen antyder* (många ess/kontroller, kvalitetsfärger, tior –
mätt som **startpoäng**) öppnas en nivå högre:
- **Bra 14 → 1NT** (startpoäng ≥15 ej sårbar / ≥16 sårbar, ingen 5-korts färg).
- **Bra 19 → 2NT** (ägarbeslut 2026-07-06, felrapport #30): en jämn 19-hand med
  **startpoäng ≥20** (t.ex. ♠AJ84 ♥AQJ9 ♦986 ♣AK – 3 ess + AK) spelar som 20–21
  och öppnar **2NT** i stället för 1 i färg (där den annars kan bli passad billigt).
  Kräver ingen 5-korts färg (då visas färgen hellre på 1-läget).

### Minor-regeln (1♣ vs 1♦, båda 3+)
| Fördelning i minorerna | Öppna |
|---|---|
| 3–3 | **1♣** |
| 4–4 | **1♦** |
| 5–5 | **1♦** (för att kunna bjuda klöver naturligt nästa vända) |
| Olika längd | Den **längsta** minorn |

### 6-5 (6-korts lågfärg + 5-korts högfärg) — ägarregel 2026-07-07, felrapport #32
Målet är att hinna visa **båda** färgerna utan att tvingas till en reverse man inte
har styrka för:
- **Minimum (12–15 hp): öppna HÖGfärgen** (den 5-korts). Med en minimihand går det
  inte att öppna lågfärgen och sedan reverse:a in högfärgen (reverse lovar extra).
- **16+ hp: öppna LÅGfärgen** (den 6-korts) och **reverse:a** in högfärgen sedan –
  då visas 6-5 med extra styrka.
- En riktigt stark 6-5 som klarar **2♣-substanskraven** (§4.4: 9/9½ spelstick +
  spelfasta stick) öppnar **2♣** (nära utgång på egen hand), oavsett ovanstående.
- **Återbudet verifierat (F5, 2026-08-08):** reversen kommer i alla tre
  svarsvägar — efter svararens 1-lägesfärg (2♥/2♠, fanns), efter 2/1 GF
  (högfärgen visas naturligt, fanns) och **efter 1NT-svaret** (byggdes i F5:
  förr rebjöds 3m och högfärgen gömdes — men 1NT förnekar bara 4-korts
  högfärg, så 5-3-fiten hittas just via reversen). Mönstret är sällsynt vid
  bordet — därför enhetsfacit i `auction-65-rebid.test.ts`, inte volymmätning.

### Lättöppningar i 3:e och 4:e hand (TP-steg F, ägarbeslut 2026-07-03)
När partnern redan passat är öppningskraven lägre (svaret är begränsat och
**Drury** §6.7 skyddar mot att paret hamnar för högt):
- **3:e hand:** öppna **1♥/1♠ lätt med 10–11 hp** (sårbar krävs 11) om
  högfärgen är **bra**: 5+ kort med **≥2 topphonnörer (A/K/Q)** – samma
  kvalitetsmått som Regel 2-3-4. Poängen är utspelsdirigering + störning.
  **Aldrig** lätt öppning i minor, **aldrig** lätt 1NT. Efter en lätt öppning
  signar öppnaren av (Drury-återbudet 2M = "lätt öppning").
- **4:e hand – regeln om 15 (Pearson):** med en marginalhand (9–11 hp):
  **hp + antal spader ≥ 15 → öppna**, annars **passa ut** given. Spadrarna
  avgör vem som vinner delkontraktskampen. Ingen spärr/svag tvåa i 4:e hand
  under öppningsgolvet – det finns ingen kvar att spärra mot.
Källa: bridgebum.com (Pearson points; third seat openings).

## 4. Svar & fortsättningar
### 4.1 Svar på 1♥ / 1♠
*(Ohöjd hand, ingen störning. Passad hand/Drury och konkurrens tas senare.)*

**Principer för höjningar (Bergen + splinter):**
- Med **exakt 4 trumf** och ingen kortfärg används **Bergen-höjningar** på
  3-läget (standard): **3♣** = 7–9 hp (konstruktiv), **3♦** = 10–12 hp
  (limit/inbjudan), **3 i hf** = 0–6 hp (spärr). Bygger på lagen om
  totala stick (9 trumfer → 3-läget).
- Med **3-korts** stöd: enkel höjning till 2-läget (6–9 hp). En **3-korts
  limithöjning** (10–12 hp) går via semi-forcing 1NT och sedan hopp till 3 i
  hf nästa vända (Bergen kräver exakt 4 trumf).
- **Jacoby 2NT** = balanserad GF-höjning, 4+ trumf, 13+ hp, ingen
  **splintervärdig** kortfärg. Hit hör även GF-händer vars enda korthet är en
  **singel A/K** (se splinterregeln nedan).
- **Balanserad inbjudan utan stöd** (≈11–12 hp, högst 3-korts trumf) går via
  semi-forcing 1NT och sedan 2NT nästa vända – direkt 2NT är Jacoby.
- **Splinter** (4+ stöd + kort färg, ~12+ hp, GF) visas med den **tvetydiga
  splintern**: det lediga 3-läges-budet (**3♠** över 1♥, **3♥** över 1♠).
  Visar singleton *eller* renons; öppnaren frågar med ett relä och svararen
  avslöjar den korta färgen (se nedan). Direkt hopp till 4♣/4♦ i ny färg
  används inte längre som splinter.
- **Splintra aldrig en singel A/K** (ägarregel 2026-08-06, källa bridgebum):
  splinterns budskap är "devalvera dina honnörer i min korta färg — räkna
  ruffvärden". Med en singel-A/K är det falskt: honnören drar ett stick, och
  partnerns värdering slår fel åt båda hållen. Sådana händer svarar **Jacoby
  2NT** i stället. En singel **dam** får splintras (drar sällan ett stick
  själv), och en **renons** splintras alltid.
- **Svagt hoppskift avskaffat** (ägarbeslut 2026-07-06, felrapport #31). När
  partnern har öppnat håller svararen **budgivningen låg**: en svag 6-korts
  spader över 1♥ svarar **1♠** (rondkrav), inte 2♠. Grundregeln – bjud den nya
  färgen billigast så partnern får utrymme att beskriva sin hand (ett hopp
  berövar t.ex. 1NT). Med en riktigt svag hand rebjuder svararen sedan sin
  färg billigt / passar.

#### Svar på 1♥
| Svar | Betydelse | Kravnivå | Konvention |
|---|---|---|---|
| 1♠ | 4+ ♠, 6+ hp | Krav (1 rond) | naturligt |
| 1NT | 6–11 hp, ingen 2/1 (inkl. 3-korts limithöjning) | Semi-krav | Semi-forcing 1NT ● |
| 2♣ / 2♦ | ny färg 4+ (oftast 5+), 12+ hp | Utgångskrav | 2-över-1 GF |
| 2♥ | 3 stöd, 6–9 hp | Ej krav | naturligt (enkel höjning) |
| 2NT | 4+ stöd, 13+ hp, balanserad (ingen kortfärg) | Utgångskrav, slamintresse | Jacoby 2NT ● |
| 3♣ | 4 trumf, 7–9 hp (konstruktiv) | Inbjudan | Bergen ● |
| 3♦ | 4 trumf, 10–12 hp (limit) | Inbjudan | Bergen ● |
| 3♥ | 4 trumf, 0–6 hp (spärr) | Avslut/spärr | Bergen-spärr ● |
| 3♠ | 4+ stöd, singel (ej A/K) el. renons (okänd färg), 12+ hp | Utgångskrav, slamintresse | Tvetydig splinter ● |
| 3NT | 13–15 hp, balanserad, exakt 2 ♥, ingen sidofärg | Avslut | naturligt (till spel) |
| 4♥ | 4+ stöd, max 10 hp – spärr till utgång | Avslut | naturligt |

#### Svar på 1♠
| Svar | Betydelse | Kravnivå | Konvention |
|---|---|---|---|
| 1NT | 6–11 hp, ingen 2/1 (inkl. 3-korts limithöjning) | Semi-krav | Semi-forcing 1NT ● |
| 2♣ / 2♦ / 2♥ | ny färg 4+ (oftast 5+), 12+ hp | Utgångskrav | 2-över-1 GF |
| 2♠ | 3 stöd, 6–9 hp | Ej krav | naturligt (enkel höjning) |
| 2NT | 4+ stöd, 13+ hp, balanserad | Utgångskrav, slamintresse | Jacoby 2NT ● |
| 3♣ | 4 trumf, 7–9 hp (konstruktiv) | Inbjudan | Bergen ● |
| 3♦ | 4 trumf, 10–12 hp (limit) | Inbjudan | Bergen ● |
| 3♥ | 4+ stöd, singel (ej A/K) el. renons (okänd färg), 12+ hp | Utgångskrav, slamintresse | Tvetydig splinter ● |
| 3♠ | 4 trumf, 0–6 hp (spärr) | Avslut/spärr | Bergen-spärr ● |
| 3NT | 13–15 hp, balanserad, exakt 2 ♠, ingen sidofärg | Avslut | naturligt (till spel) |
| 4♠ | 4+ stöd, max 10 hp – spärr till utgång | Avslut | naturligt |

**Fortsättning efter semi-forcing 1NT:** Öppnaren får passa med minimum
balanserat. Bjuder svararen därefter en ny färg lovar det 5+ kort och
**förnekar** stöd i öppnarens färg(er). Annars kan svararen visa preferens i
öppnarens färger.

#### Enkel höjning (1♥–2♥ / 1♠–2♠) — Bergen game try
Svararens enkla höjning visar 3 stöd, 6–9 hp. Vill öppnaren göra ett
**utgångsförsök** bjuder hon **2NT** (konstgjort, krav, ≈ 15–17 hp / 6 förlorare)
och ber svararen beskriva handen. Detta ersätter hjälpfärgs-försök efter den
enkla höjningen – det är svararen, inte öppnaren, som beskriver.

| Svararens svar | Betydelse |
|---|---|
| 3 i ny färg | singleton/renons i den färgen, minimum (6–7 hp) |
| 3 i trumf | jämn 4-3-3-3-typ, minimum (6–7 hp) |
| 3NT | jämn hand, maximum (8–9 hp) |
| 4 i trumf | maximum (8–9 hp), ojämn (kortfärg men utan plats att visa den) |

Öppnaren placerar sedan kontraktet: pass / 3 i trumf med minimum mittemot dålig
passning, annars utgång. Singleton/renons mittemot öppnarens svaga färg höjer
värdet; honnörer mittemot svararens kortfärg är slöseri.

#### Bergen — öppnarens fortsättning
- Efter **3♣** (7–10): minimum → 3 i hf (svararen passar). Med extra
  styrka game-try via ny färg på 3-läget; med tillräckligt → utgång direkt.
- Efter **3♦** (10–12): minimum kan stanna i 3 i hf; annars utgång.
  Slamintresse → cue-bid.
- Efter **spärrhöjningen** (3 i hf): pass med < ~18 hp, annars utgång.

#### Tvetydig splinter — relä och slamvärdering
Svararens splinter visar 4+ trumf, kort färg (singleton el. renons) och ~12+ hp
(GF). Öppnaren frågar efter den korta färgen med ett relä – eller hoppar direkt
till utgång i trumf om handen är olämplig för slam (signoff). Den korta färgen
är aldrig en singel A/K (splinterregeln ovan — de händerna svarar Jacoby 2NT),
så öppnarens nedvärdering nedan står på säker grund.

*Efter 1♥–3♠:* öppnaren bjuder **3NT (relä)**; svararen visar kort färg:

| Svar | Kort färg |
|---|---|
| 4♣ | kort ♣ |
| 4♦ | kort ♦ |
| 4♥ | kort ♠ |

*Efter 1♠–3♥:* öppnaren bjuder **3♠ (relä)**; svararen visar kort färg:

| Svar | Kort färg |
|---|---|
| 3NT | kort ♣ |
| 4♣ | kort ♦ |
| 4♥ | kort ♥ |

**Slamvärdering (nyckeln):** *nedvärdera honnörer mittemot den korta färgen.*
Kung eller dam mittemot singleton/renons är nästan värdelös ("slöseri"); ess och
hackor mittemot kort är guld. Är handen ren från slöseri och stark nog →
**cue-bid** kontroller uppåt (lägsta första-rondskontroll först) och därefter
**1430 RKC Blackwood**. Är handen full av honnörer mittemot korten → stanna i
utgång.

#### Jacoby 2NT — fortsättning
Svararens **2NT** = 4+ trumf, **13+ hp** (varav minst 11 hp i honnör), GF,
ingen kortfärg. Bra 3-korts stöd (2 av de tre topphonnörerna) godtas.

**Öppnarens återbud** (prioritet: 5-korts sidofärg → kortfärg → 3NT → 4 i
trumf → 3 i trumf):

*Efter 1♥ (♥ trumf):*
| Återbud | Betydelse |
|---|---|
| 3♣ / 3♦ / 3♠ | kort färg (singleton el. renons) i bjuden färg |
| 3♥ | 16+ hp, slamintresse, frågar svararen vidare |
| 3NT | 14–15 hp, balanserad |
| 4♣ / 4♦ | 5+ kort i färgen |
| 4♥ | minimum 12–14 hp, balanserad – signoff |

*Efter 1♠ (♠ trumf):*
| Återbud | Betydelse |
|---|---|
| 3♣ / 3♦ / 3♥ | kort färg (singleton el. renons) i bjuden färg |
| 3♠ | 16+ hp, slamintresse, frågar svararen vidare |
| 3NT | 14–15 hp, balanserad |
| 4♣ / 4♦ / 4♥ | 5+ kort i färgen |
| 4♠ | minimum 12–14 hp, balanserad – signoff |

- **Singleton vs renons:** kortfärgsbudet på 3-läget visar singleton *eller*
  renons. Renons visas genom att bjuda **4 i samma färg nästa vända**.
- **Sidofärgskvalitet:** minst en topphonnör (ess eller kung) i den 5-korts
  sidofärg som visas – annars visa hellre kortfärg.
- **Svararens fortsättning:** efter ett 3-läges-återbud visar en ny färg (ej
  trumf) **första-rondskontroll** (ess eller renons) – cue-bid uppåt mot slam.
- **Passad hand / konkurrens:** tas i senare avsnitt (passad hand: Drury;
  efter upplysningsdubbling: Jordan 2NT = limithöjning).

### 4.2 Svar på 1♣ / 1♦
*(Ohöjd hand, ingen störning. Passad hand och konkurrens tas senare.)*

Öppningen lovar 3+ kort (ibland "kort" via minor-regeln) och 12+ hp.

**Principer:**
- **Bjud längsta färgen först.** Med bara 4-korts färger (eller en 5-korts
  HÖGfärg) bjuds en 4-korts högfärg billigast på 1-läget (krav 1 rond) — "4-korts
  upp".
- **Över 1♦ med utgångskrav (12+): en 5-korts klöver går FÖRE en 4-korts högfärg.**
  12+ hp + 5-korts klöver + 4-korts högfärg → **2♣** (2-över-1 GF) som sätter game
  force direkt; högfärgen visas i nästa rond. Valet står mellan en 4-korts färg på
  1-läget och en 5-korts färg på 2-läget: **9–11 hp** väljer 1-läget (håll lågt),
  **12+ hp** väljer 5-kortsfärgen. Gäller **bara över 1♦** — över 1♣ visas den
  längre rutern billigt på 1-läget (1♦), så där bjuds högfärgen upp som vanligt.
  (Källa: standard 2/1, se §9-noten 2026-08-06.) **Högfärgen visas sedan i
  återbudet** (2026-08-07, §5.3): efter t.ex. 1♦–2♣–2♦ bjuder svararen sin
  4-korts högfärg naturligt under 3NT, så en 4-4-fit aldrig begravs i sang —
  men bara när högfärgen är auktionens *tredje* färg (är tre färger redan
  bjudna är budet fjärde färg, §6.6, med konventionell mening).
- **1NT** är naturlig och **inte** krav (6–10 hp), förnekar 4-korts hf.
- **Höjningar är inverterade:** 1m–2m = **stark** (10+ hp, krav, 4+ stöd, ingen
  4-korts hf); 1m–3m = **svag spärr** (0–6 hp, 5+ stöd). Den svaga handen
  spärrar direkt, den starka hålls låg för att få plats att utforska.
- Ny färg på 2-läget utan hopp = **2-över-1 GF**.
- **2-över-1 går före den inverterade höjningen** (ägarbeslut 2026-09-03,
  felrapport #58): med **12+ hp och 5+ kort i den andra lågfärgen** bjuds den
  färgen (2♣/2♦, utgångskrav) även med 4+ stöd — "att sätta game force är
  viktigare än att kommunicera träff i färg; har vi ett utgångskrav hinner vi
  visa färger senare". Stödet visas i nästa rond (§5.3). Den inverterade
  höjningen behåller 10–11-händerna och utgångshänder utan egen 5-kortsfärg.
- **Svagt hoppskift avskaffat** (ägarbeslut 2026-07-06, felrapport #31). En svag
  6-korts högfärg **hoppar inte** till 2♥/2♠ – när partnern har öppnat håller
  svararen budgivningen låg och bjuder högfärgen billigast på **1-läget** (1♥/1♠,
  rondkrav) så partnern får utrymme att beskriva sin hand (ett hopp berövar t.ex.
  1NT). Med en riktigt svag hand rebjuder svararen sedan sin färg billigt / passar.
  (Sedan tidigare fanns inget svagt hoppskift i den andra minorn heller – en svag
  6-korts klöver över 1♦ bjuder 1NT.)
- "Gap-handen" 7–9 hp med stöd men utan hf: bjud **1NT** (inverterad
  höjning kräver 10+).

#### Svar på 1♣
| Svar | Betydelse | Kravnivå | Konvention |
|---|---|---|---|
| 1♦ | 4+ ♦, 6+ hp | Krav (1 rond) | naturligt |
| 1♥ / 1♠ | 4+ färg, 6+ hp | Krav (1 rond) | naturligt (4-korts upp) |
| 1NT | 6–10 hp, balanserad, ingen 4-korts hf | Ej krav | naturligt |
| 2♣ | 4+ ♣, 10+ hp, ingen 4-korts hf (ej 12+ med 5+ ♦ → 2♦) | Krav (1 rond) | Inverterad minor ● |
| 2♦ | 4+ (oftast 5+) ♦, 12+ hp | Utgångskrav | 2-över-1 GF |
| 2NT | 11–12 hp, balanserad, stopp, ingen 4-korts hf | Inbjudan | naturligt |
| 3♣ | 5+ ♣, 0–6 hp | Avslut/spärr | Inverterad minor, svag ● |
| 3NT | 13–15 hp, balanserad | Avslut | naturligt (till spel) |

#### Svar på 1♦
| Svar | Betydelse | Kravnivå | Konvention |
|---|---|---|---|
| 1♥ / 1♠ | 4+ färg, 6+ hp | Krav (1 rond) | naturligt (4-korts upp) |
| 1NT | 6–10 hp, balanserad, ingen 4-korts hf | Ej krav | naturligt |
| 2♣ | 4+ (oftast 5+) ♣, 12+ hp — **går före 4-korts hf** | Utgångskrav | 2-över-1 GF |
| 2♦ | 4+ ♦, 10+ hp, ingen 4-korts hf (ej 12+ med 5+ ♣ → 2♣) | Krav (1 rond) | Inverterad minor ● |
| 2NT | 11–12 hp, balanserad, stopp, ingen 4-korts hf | Inbjudan | naturligt |
| 3♦ | 5+ ♦, 0–6 hp | Avslut/spärr | Inverterad minor, svag ● |
| 3NT | 13–15 hp, balanserad | Avslut | naturligt (till spel) |

#### Inverterade minorhöjningar — öppnarens fortsättning
Efter den **starka höjningen** (1m–2m, krav) söker paret oftast **3NT**.
Öppnaren beskriver (graderat, B13 2026-08-07):

| Återbud | Betydelse |
|---|---|
| ny färg | **äkta stopp** (A, Kx, Qxx, J10xx) i färgen, 12+, krav – letar 3NT |
| 2NT | balanserad 12–14 hp, ingen utgångsiver (ej krav) |
| 3 i lf | **minimum 12–14** utan stopp att visa (ej krav) |
| 3NT | balanserad 18–19 hp, till spel |

Tre preciseringar (B13):
- **"Stopp" är honnörsstopp**, aldrig bara längd — ♠9642 är inget spaderstopp.
  Billigaste stoppfärgen bjuds först (upp-the-line).
- **3 i lf är strikt 12–14.** En hand med **15+** bjuder ALLTID krav: finns
  inget äkta sidostopp bjuds bästa sidofärgen ändå ("fantomstoppen",
  standardpraxis — samma bud som stopp-visningen, partnern kan inte skilja dem
  åt; styrkan visas i stället i nästa bud, se bromsen nedan). Så kan en stark
  hand aldrig dö i 3m och utgångar på 25+ hp passas inte bort.
- **Svararens broms:** stopp-visningen lovar bara 12+. Med minimumhöjningen
  (10–12) svarar svararen **3m = "bara minimum"** (ej krav). Öppnaren passar
  med 12–14 (delkontraktet står) men **driver med 15+**: 3NT när egna handen
  täcker alla tre sidofärgerna, annars en andra stopp-visning under 3NT om en
  ryms, annars 5 i lf. Efter en andra stopp-visning bjuder svararen 3NT när
  resten är täckt, annars 5 i lf. Med 13+ bromsar svararen inte utan
  fortsätter mot utgång direkt (3NT när övriga sidofärger är täckta, annars
  5 i lf). Så visas styrkan ärligt i två steg — precis som riktiga par gör.

**Slamzonen (cue-ronden, §6.2):** med minorfiten satt och slamaritmetik
(kaptenens hand + öppnarens visade minimum ≥ 30) körs kontrollbuden — men
**först ÖVER 3NT**: under 3NT betyder nya färger stopp-letande, över 3NT
kontrollbud, så de två budspråken aldrig krockar. I **klar drivzon (33+)**
hoppas cue-ronden över i minortrumf och kaptenen frågar 4NT direkt —
lågfärgsutgången 5m ligger ÖVER 4NT, och cue-bud får inte äta upp
frågeutrymmet. Den **svaga höjningen** (1m–3m) är avslutande – öppnaren
passar utan extra styrka.

**3NT eller 5 i lf? (stopp-utbytet, ägarregel 2026-07-05).** Ett 2/1-par
föredrar 3NT (färre stick), men bara när paret tillsammans kan **hålla alla fyra
färger**. Räcker inte stoppen spelar paret **lågfärgsutgången 5♣/5♦** i stället
för att chansa en sang som faller på första utspel:
- **Svararens första val:** en balanserad utgångshand (13–15) med lågfärgsfit men
  en **riktigt svag färg** (t.ex. ♠xx eller ♥xxx utan honnör) bjuder **inte 3NT
  direkt** – den går den inverterade 2m-vägen och utforskar stoppen. Är alla
  färger hållna bjuds 3NT som förr.
- **Efter öppnarens minimum (3 i lf, ingen stopp):** med utgångsstyrka (13+) och
  en **osparrad högfärg** drar svararen till **5 i lf** (3NT är osäker); kan båda
  högfärgerna hållas bjuds 3NT. Med bara inbjudan (10–12) passas 3 i lf.
- **Efter öppnarens stopp-visning:** är de återstående sidofärgerna täckta → 3NT,
  annars **5 i lf**.

### 4.3 Svar på 1NT (15–17 hp, balanserad)
*(Ingen störning. Konkurrens tas senare.)*

> **Sangsystemet gäller alltid — även när 1NT bjudits för hand (felrapport #41).**
> Tar du sangöppningen själv i budlådan, i stället för det bud motorn hade valt,
> gäller ändå hela §4.3/§4.4: partnern svarar med Stayman/transfer/Texas/Minor
> Suit Stayman eller NT-stegen, och öppnaren ger sitt vanliga återbud. Betydelsen
> av svaret läses ur **budet**, aldrig ur partnerns kort. Stör motståndarna tar
> §7.8 över i stället. Tidigare dog en sådan auktion på fläcken: 1NT passades ut
> med 15 hp och 5-4 i minorerna mittemot.

#### Översikt
| Svar | Betydelse | Konvention |
|---|---|---|
| Pass | 0–7 hp, ingen utgångschans | naturligt |
| 2♣ | frågar efter 4-korts hf | Stayman ● |
| 2♦ | transfer till ♥ (5+ ♥) | Jacoby-transfer ● |
| 2♥ | transfer till ♠ (5+ ♠) | Jacoby-transfer ● |
| 2♠ | 5-4+ i minorerna, GF/slam, ingen 4-korts hf | Minor Suit Stayman ● |
| 2NT | 8–9 hp, balanserad, inbjudan, ingen 4-korts hf | naturligt |
| 3♣ / 3♦ | 6+ färg, GF med slamintresse | naturligt |
| 3♥ / 3♠ | 6+ färg, GF med slamintresse | naturligt |
| 3NT | ~10–15 hp, balanserad, till spel | naturligt |
| 4♦ / 4♥ | transfer till ♥ / ♠ (6+, utgång, ej slam) | Texas ● |
| 4NT | kvantitativ slaminbjudan (~16–17 hp) | naturligt |

#### Stayman (2♣)
2♣ frågar efter 4-korts hf och lovar minst inbjudningsstyrka (≈8+ hp) med minst
en 4-korts hf. Öppnaren svarar:

| Svar | Betydelse |
|---|---|
| 2♦ | ingen 4-korts hf |
| 2♥ | 4 ♥ (kan ha 4 ♠ också) |
| 2♠ | 4 ♠, förnekar 4 ♥ |

**Svararens fortsättning (exempel):**
- höjning av öppnarens hf: till 3 = inbjudan (4 stöd), till 4 = avslut.
- 2NT = inbjudan utan fit; 3NT = avslut, balanserad.
- efter 2♦ (ingen hf): 2♥/2♠ = 5-4 i hf, inbjudan; annars NT efter styrka.

**Garbage/svag Stayman (beslut 2026-07-01: JA).** En svag hand (0–7 hp) med
**exakt 4-4 i högfärgerna** och kort klöver (4-4-4-1 eller 4-4-5-0) bjuder 2♣ och
**passar** öppnarens svar (2♦/2♥/2♠) – varje svar landar i en 4-4-fit eller 4+
ruter, bättre än 1NT med klöversingel/renons. Ingen 5-korts högfärg (då transfer).

**5-4 i högfärgerna, inbjudan (8–9):** efter 2♣–2♦ (öppnaren förnekar hf) visar
svararen sin **5-korts** högfärg naturligt på 2-läget (2♥/2♠), inte 2NT.

#### Smolen (efter 1NT–2♣–2♦)
När öppnaren förnekat 4-korts hf (2♦) visar svararen 5-4 i hf med GF-styrka genom
att **hoppa till 3 i sin _kortare_ hf**:

| Svararens bud | Betydelse |
|---|---|
| 3♥ | 4 ♥ + 5 ♠, GF |
| 3♠ | 4 ♠ + 5 ♥, GF |

Öppnaren bjuder den 5-korts hf:en på utgångsläget med 3 stöd, annars 3NT (med
bara dubbel i den långa). Poängen är densamma som vid transfer: den **starka
handen blir spelförare**.

#### Jacoby-transfer (2♦ / 2♥)
2♦ = transfer till ♥ (5+ ♥), 2♥ = transfer till ♠ (5+ ♠). Öppnaren **fullföljer**
genom att bjuda hf:en (2♥ resp. 2♠) – så blir den starka 1NT-handen spelförare
och döljs för motståndarna.

- **Superaccept:** med 4 stöd och maximum (~17 hp) hoppar öppnaren i stället till
  3 i hf:en.

**Svararens fortsättning efter fullföljd transfer** (ex. 2♦–2♥):
| Svar | Betydelse |
|---|---|
| Pass | 0–7 hp, 5+ ♥, svag |
| 2♠ | 5 ♥ + 5 ♠, inbjudan (8–9) |
| 2NT | 5 ♥, balanserad, inbjudan (8–9) |
| 3♣ / 3♦ | 5+ ♥ + 4+ i färgen, GF |
| 3♥ | 6+ ♥, inbjudan |
| 3NT | 5 ♥, balanserad – öppnaren väljer 3NT eller 4♥ |
| 4♥ | 6+ ♥, avslut |
| 4NT | kvantitativ slaminbjudan |

Spader-transfern (2♥→♠) fungerar spegelvänt.

**5-5 i högfärgerna (beslut 2026-07-01): transferriktningen kodar styrkan.**
| Styrka | 1:a bud | 2:a bud |
|---|---|---|
| svag (0–7) | 2♣ (Stayman) | passa hf-svar; över 2♦ = 2 i bästa högfärg |
| inbjudan (8–9) | 2♦ (transfer ♥) | 2♠ (visar 5-5, inbjudan) |
| GF (10+) | 2♥ (transfer ♠) | 3♥ (visar 5-5, öppnaren väljer högfärg) |

#### Öppnarens svar på svararens inbjudan (efter Stayman/transfer)
Principen är samma som för alla inbjudningar (ärliga portar): **accept = över
blott minimum.** 1NT = 15–17 → **16–17 accepterar, 15 avböjer** — men en 15:a
med **femte trumf** i en hittad fit uppgraderar och accepterar (extra trumf +
stöldvärde). (Byggt via felrapport #37: öppnaren bjöd förr 3NT "utan stöd"
mitt i en Stayman-hittad hjärterfit.)

| Inbjudan | Minimum (15) | Maximum (16–17) |
|---|---|---|
| Stayman-fit: höjning till 3♥/3♠ | pass *(15 med 5-korts trumf → 4M)* | 4♥/4♠ |
| Stayman utan fit: 2NT | pass | 3NT |
| Transfer + 3♥/3♠ (6+ färg) | pass | 4♥/4♠ |
| Transfer + 2NT (5-korts hf, jämn) | pass; med 3-korts stöd → 3M (preferens, 5-3-fiten spelar bättre) | 4M med 3-korts stöd, annars 3NT |

**"Bra 15" i SANG** (ägarbeslut 2026-07-24): mot en **sanginbjudan** (2NT, med
eller utan Stayman/transfer före) räknar öppnaren **sangpoäng** i stället för rå
hp — en 15:a med kvalitet spelar som en 16:a och accepterar:
- **tät honnörsklump** (A-K-D i samma färg) = +1 — tre säkra stick är
  sticktillverkare även i en trekortsfärg,
- **femkortsfärg** (längdpoängen) och **ess/tior över damer/knektar** lyfter som
  förut,
- **flathets-avdraget räknas inte** i sang (det är till för färgkontrakt).

En **platt quack-15** (damer och knektar, ingen färg att sätta upp) avböjer
fortfarande. Golvet 16 är alltså oförändrat — det är *värderingen* av handen som
blev ärligare (frö 20260744: ♠T72 ♥A83 ♦QT97 ♣AKQ → 3NT, 600 fanns).

#### Texas-transfer (4♦ / 4♥)
För en lång hf med **utgångsstyrka men utan slamintresse**:

| Svar | Betydelse |
|---|---|
| 4♦ | transfer till ♥ (6+ ♥, utgång) |
| 4♥ | transfer till ♠ (6+ ♠, utgång) |

Öppnaren fullföljer (4♥ resp. 4♠). Skillnad mot Jacoby: **Texas** = direkt
utgång utan slamintresse; **Jacoby följt av ett nytt krav-bud** = mildare
slamintresse (ger öppnaren plats att visa en bra hand).

#### Minor Suit Stayman (2♠)
2♠ = 5-4+ i minorerna (4-4 endast med starka slamhänder), GF/slamintresse,
förnekar 4-korts hf. Frågar efter öppnarens 4-korts minor:

| Öppnarens återbud | Betydelse |
|---|---|
| 2NT | ingen 4-korts minor; båda hf stoppade |
| 3♣ | 4+ ♣ (bjuds med 4-4 i minorerna) |
| 3♦ | 4+ ♦, förnekar 4 ♣ |
| 3♥ / 3♠ | stopp i färgen (letar 3NT), krav |
| 3NT | ingen 4-korts minor, maximum, båda hf stoppade |
| 4♣ / 4♦ | 4+ i minorn, maximum |

Svararen passar med minimum, bjuder naturligt med mer, eller cue-bid mot slam.

### 4.4 Svar på 2♣ (stark, konstgjord)
2♣ lovar **stark balanserad** (22+ hp) eller **stark obalanserad** som klarar
substanskraven (2026-08-31): **minst 9 spelstick** om längsta färgen är en
högfärg, **9½ med lågfärg** (en stick från utgång; lågfärgshanden är längre
från sin utgång och söker hellre 3NT via 1-läget) — **och minst 3 spelfasta
stick** (EK=2, ED=1½, E=1, KD=1, Kx=½; försvarsstyrka, så en spärrhand aldrig
låtsas vara stark). En honnörstung hand med **8½ spelstick och 4+ spelfasta
stick** (t.ex. tre ess) öppnar också 2♣. Krav. Balanserade ranger: 22–24
(→ 2NT-rebud) och 28–30 (→ 3NT-rebud); 25–27 öppnar 3NT direkt (se §3).

**Svararens svar (2♦ väntebud):**
| Svar | Betydelse |
|---|---|
| 2♦ | 0–7 hp, konstgjort väntebud (vanligast) |
| 2♥ / 2♠ | 8+ hp, 5+ färg, positivt GF |
| 2NT | 8+ hp, balanserad, GF |
| 3♣ / 3♦ | 8+ hp, 5+ färg, positivt GF |

**Öppnarens återbud efter 2♦:**
| Återbud | Betydelse | Krav? |
|---|---|---|
| 2♥ / 2♠ | 5+ färg, naturlig | krav 1 rond |
| 2NT | 22–24 hp, balanserad | ej krav |
| 3♣ / 3♦ | 5+ färg, naturlig | krav 1 rond |
| 3NT | 28–30 hp, balanserad | ej krav |

- Efter **2NT (22–24)** använder svararen NT-konventionerna (Stayman, transfers
  m.m.) precis som över 1NT, fast med 22–24 hp mittemot.
- Efter en **naturlig färgrebud** är utgång påtvingad (utom andra negativa);
  svararen visar stöd, ny färg (5+) eller NT naturligt.
- **Finaste färgen före 3NT:** efter öppnarens **minor-rebud** (2♣–2♦–3♣/3♦)
  visar svararen utan stöd och utan egen 5-korts färg en **4-korts högfärg**
  under 3NT (billigast först: hjärter före spader). Så hittas en 4-4-högfärgsfit
  — och utan fit bjuder ÖPPNAREN sangen, så 3NT spelas från den starka handen i
  stället för från svararens tomma. Först utan 4-korts högfärg blir det 3NT.
  **F5-skärpning (2026-08-08):** regeln gäller även med egen 5-korts **minor**
  som skulle **spränga 3NT** (4♣/4♦) — högfärgen under 3NT går före (frö
  20261040: 3♥ hittar 4-4-hjärterfiten i stället för 4♣ → 5♣). En egen 5-korts
  högfärg, eller en minor som ryms under 3NT, visas naturligt som förr.
- **2♣ är ingen klöverfärg (F5, 2026-08-08):** det konstgjorda öppningsbudet
  räknas aldrig som en bjuden färg — varken när kravstegen letar en egen färg
  att rebjuda (förr "rebjöds" klövern på 4-läget medan en äkta, redan visad
  6-korts spader glömdes) eller när partnern räknar fit ("bjudit klöver två
  gånger" kräver två ÄKTA klöverbud — annars höjdes 4♣→5♣ på dubbelton). I
  kravstegen rebjuds dessutom **högfärger före minorer** (finaste färg). Facit
  med revisorsfrön: `auction-2c-strain.test.ts`.
- **Höj aldrig ombudet på dubbelton med egen visad 6-korts färg:** öppnarens
  andra bud i sin egen färg i kravet är ofta TVINGAT (lovar bara 5+). Svararen
  med bara två kort där och en egen redan visad 6-korts färg **rebjuder sin
  färg** i stället för att höja (2♣–2♦–3♣–3♠–4♣ → **4♠**, inte 5♣ på ♣85).

**Andra negativa:** efter öppnarens kravbud (färgrebud) visar svararens
**billigaste minor** 0–3 hp (riktig bottenhand). Alla andra bud bekräftar minst
lite på fötterna och håller utgångskravet.

#### Följdbud — vid träff och vid miss

**Vid träff** (positivt svar – styrka/fit hos svararen): paret är i GF.
- Hitta gemensam trumf och **värdera slam** med kaptensregeln: när trumf är
  funnen (öppnaren stödjer svararens färg, eller svararen har 3+ kort i
  öppnarens naturliga färgrebud) räknar **svararen (kaptenen)** sin egen hand
  mot 2♣-öppningens **visade minimum 22** (22+ hp balanserad eller ~9+
  spelstick ≈ samma spelvärde): **33+ → driv** med **1430 RKC Blackwood**
  (ess + trumfdam, detaljer i §6); **31–32 → slaminbjudan** (5M i högfärg
  när öppnaren stödde svararens färg, stödhöjningen i minor) som öppnaren
  accepterar med mer än blott minimum (dömt på egna Bergenpoäng); annars sätts
  utgången. Efter öppnarens **egen högfärg** (2♣–3♦–3M) finns ingen 5M-
  inbjudan — där visas slamintresset med kontrollbud i ny färg, och handen
  utan kontrollbud att visa bjuder 4M direkt (regeln nedan). Manuella
  **cue-bid** enligt §6.2 tolkas som vanligt.
- **Utan trumf** gäller samma kaptensmatte: med **33+** mot visade 22 frågar
  svararen RKC med sin egen redan visade färg som trumf om den är
  **självbärande** (6+ kort med minst två av A/K/Q — nyckelkortssvaret vaktar
  mot en spelstick-öppning utan essen). **6NT direkt** bjuds bara när
  öppnarens återbud var **3NT** (styrkan visad balanserad = riktiga hp);
  efter ett **färg-återbud** utan fit kan "22:an" vara en spelstick-hand vars
  längd inte ger sangstick utan fit → auktionen fortsätter naturligt. I
  31–32 utan trumf står den vanliga utgångsauktionen (ingen kvantitativ
  inbjudan där ännu).
- **Så läser ÖPPNAREN kaptenens bud efter sitt färg-återbud** (2♣–positivt–
  3y, 2026-09-05; stödreglerna 2026-09-06 = motorbytets §5b beslut 7,
  `docs/motorbyte-plan.md`): **4NT är essfrågan i y** — den senast bjudna
  färgen (öppnaren kan inte se om svararen har 3+ stöd eller frågar för en egen
  självbärande färg; det tvetydiga fallet är bok-mot-motor-fynd 14). Ett
  **kontrollbud i en NY färg på 4-läget** (över 3NT, under utgången i y —
  aldrig svararens egen färg) **sätter öppnarens högfärg som trumf** och visar
  3+ stöd med slamintresse: 4♣ över 3♥/3♠, 4♥ över 3♠ (den balanserade
  2NT-svararen cue:ar redan på 3-läget: 2♣–2NT–3♥–3♠). Ny färg på 3-läget
  efter ett färgpositivt (2♣–3♦–3♥–3♠) är naturlig, inte kontrollbud. **3+ stöd
  utan kontrollbud att visa → 4M direkt** (fast arrival, ingen slamambition —
  samma logik som efter reverse, §6.6); med 33+ mot visade 22 frågar kaptenen
  4NT direkt. Svararens rebud i sin **egen** färg (2♣–3♦–3♥–4♦ **och**
  2♣–3♦–3♠–4♦ — samma bud, samma betydelse) är **naturlig**: 6+ kort, eller 5
  i en obalanserad hand (singel/renons någonstans, eller bra färg med två av
  A/K/Q i annat än 5-3-3-2); den förnekar 3-korts stöd och utgångskravet står.
  Utan stöd och utan rebud: ny färg under 3NT (5+, eller 4-korts högfärg —
  finaste färgen före sangen), annars **3NT** direkt (5-3-3-2 bjuder sang även
  med bra färg). Öppnaren **rättar 3NT till 4M med 6+** i sin högfärg, annars
  står 3NT.
- Svararens **enkla stödhöjning** under 3NT efter sitt positiva svar
  (2♣–2♥–2♠–3♠) = slamintresse; **höjning direkt till utgång** = minimum utan
  slamintresse (på 4-läget visas slamintresset med kontrollbudet i ny färg,
  regeln ovan).
- Balanserat: efter 2NT-rebud (22–24) sätter svararen nivån med NT-stegen
  (Stayman/transfers, eller kvantitativt mot 6NT med ~10+ hp).
- *Exempel:* 2♣ – 2♥ (5+ ♥, 8+) – 3♥ (stöd, slamintresse) – cue-bids – 1430 RKC
  – 6♥.

**Vid miss** (negativt 2♦, ev. andra negativa): öppnaren har jättehanden men
nästan inget mittemot.
- Efter 2♦ rebjuder öppnaren: **2NT (22–24)** – svararen passar med 0–2 hp,
  annars systembud (Stayman/transfer); **färgrebud (krav 1 rond)** – svararen
  letar utgång.
- Med en riktig bottenhand visar svararen **andra negativa** (billigaste minor,
  0–3 hp). Då vet öppnaren att det är tomt mittemot och kan:
  - **rebjuda egen färg lågt** = ej krav, svararen får passa (delkontrakt när
    utgång är hopplös),
  - **bjuda utgång** ändå (t.ex. en solid lång färg som räcker ensam),
  - **3NT** = balanserad jätte, till spel.
- *Exempel:* 2♣ – 2♦ (0–7) – 2♠ (krav) – 3♣ (andra negativa, 0–3) – 3♠ (ej krav,
  svararen kan passa).

### 4.5 Svar på svaga tvåöppningar (2♦ / 2♥ / 2♠)
Öppningen visar 6-korts färg och 6–11 hp (svag). Svar:

| Svar | Betydelse | Konvention |
|---|---|---|
| Pass | ingen utgångschans — **även 11–14 utan fit** som saknar billig egen färg | naturligt |
| höjning (t.ex. 2♥–3♥) | spärrhöjning, höjer trycket (ej inbjudan) | naturligt |
| ny färg | naturlig, 5+ färg, krav 1 rond — **på 2-läget från 11 hp, på 3-läget krävs ~15+** | naturligt |
| 2NT | konstgjord fråga om styrka + färgkvalitet | Ogust ● |
| 3NT / 4-läget | till spel | naturligt |

**Ogust (2NT-svaret):** öppnaren svarar i steg:

| Öppnarens svar | Styrka | Färgkvalitet |
|---|---|---|
| 3♣ | minimum (6–8 hp) | dålig (1 topphonnör) |
| 3♦ | minimum (6–8 hp) | bra (2 topphonnörer) |
| 3♥ | maximum (9–11 hp) | dålig (1 topphonnör) |
| 3♠ | maximum (9–11 hp) | bra (2 topphonnörer) |
| 3NT | maximum (9–11 hp) | utmärkt (alla 3 topphonnörer) |

Minnesregel: *"Minors are Minimum, 1-2-1-2-3"* (♣/♦ = minimum; antalet
topphonnörer följer 1-2-1-2-3). Topphonnörer = ess/kung/dam i trumffärgen.
Svararen placerar sedan kontraktet utifrån min/max och färgkvalitet.

**Ny färg som krav:** efter t.ex. 2♥–2♠ (krav) visar öppnaren stöd, rebjuder sin
färg (minimum) eller visar en sidofärg. **Nivågräns (fel färg-spåret fix 4):**
kravet tvingar öppnarens svaga hand (6–11 hp) att bjuda vidare — en ny färg som
måste bjudas på **3-läget** (t.ex. 2♥–3♣) kräver därför en riktigt bra hand
(~15+). Med 11–14 utan fit och utan billig egen färg **passar** svararen i
stället — partnerns spärr står bäst själv. *(Konkurrens och passad hand tas
senare.)*

### 4.6 Svar på spärröppningar (3-/4-läget)
Spärren förnekar 12+ hp och tar bort budutrymme – **svararen är kapten** och
beslutar oftast direkt. Öppningarna står i §3 (3-läget: 7+ färg, svag; 4-läget:
lång färg, spärr).

| Svar | Betydelse |
|---|---|
| Pass | vanligast – ingen utgång |
| höjning (t.ex. 3♥–4♥) | spärr/avslut, höjer trycket (tvetydig för motståndarna) |
| ny färg | naturlig, 5+ färg, **krav 1 rond** |
| 3NT | till spel (stopp i sidofärger, räknar med 9 stick) |
| 4NT | ess-fråga (1430 RKC) med stor fit-hand |

**Öppnarens återbud efter ny färg (krav):** rebjuda egen färg = minimum/dålig;
höja svararens färg = stöd; visa en sidohonnör ("feature") = maximum.

**4-läges-spärrar (4♥/4♠):** lite plats kvar – svararen passar, eller bjuder slam
via 4NT (1430 RKC). En ny färg = kontroll/cue mot slam.

**Regel om 2-3-4 (för öppnaren):** våga gå bet upp till **2** stick i farozon,
**3** i lika zon, **4** i gynnsam zon (dubblat, vägt mot motståndarnas utgång).
Styr hur högt man vågar spärra.

## 5. Återbud (öppnarens andra bud)
Öppnarens andra bud **beskriver handen** – styrka och form – så att svararen kan
placera kontraktet. Tre styrkenivåer styr valet:

| Nivå | hp | Typiskt återbud |
|---|---|---|
| Minimum | 12–15 | enklast möjliga: rebjuda färg, billig ny färg, 1NT |
| Medium | 16–18 | hoppåterbud, styrkevisning (inbjudan) |
| Maximum | 19+ | hoppskift (krav), stark NT, utgångskrav |

**Principer:**
- **Reverse** = att rebjuda en *högre* ny färg på 2-läget än sin första (t.ex.
  1♦–1♠–2♥). Lovar **extra** (~16+ hp) och längre första färg. Krav 1 rond.
- **Hoppskift i ny färg** (t.ex. 1♦–1♠–3♣) = 19+ hp, utgångskrav.
- **TP-steg E (ägarbeslut 2026-07-03):** styrkenivåerna för reverse/hoppskift
  räknas i **max(hp, startpoäng)** – form (längd + kvalitetsfärger) får LYFTA
  in i reverse- (≥16) och hoppskiftszonen (≥19), aldrig sänka under hp. En
  6-4:a med 15 hp och två kvalitetsfärger reverserar; en platt hand följer hp.
  Svararen får **aldrig passa** ett hoppskift: hon placerar kontraktet
  (4M med 3-korts stöd / 3NT med stopp i fjärde färgen / 5m med fit).
  Källa: bridgebum.com ("16+ points", inte strikt HCP).
- **Slamport efter reverse/hoppskift (etapp 4, familj C):** svararen
  (kaptenen) räknar sin hand mot det **visade minimumet** (reverse 16,
  hoppskift 19) när en trumf är säkrad på egen kunskap — 4+ egna kort i
  öppnarens andra färg, eller 3+ i öppnarens första (som lovar 5+ vid
  reverse och högfärgsöppning; 4+ krävs mot hoppskiftets minoröppning):
  **33+ → driv** (4NT RKC), **31–32 → slaminbjudan** (öppnaren accepterar
  med mer än blott minimum, dömt på egna Bergenpoäng), annars vanliga
  utgångsflödet. **Undantag (ägarbeslut 2026-09-05, §6.6):** efter en reverse
  i **högfärg** med 4+ stöd frågas inte 4NT direkt — svararen höjer först
  (billigt = stark, hopp = svag, fast arrival) och cue-ronden öppnas av
  öppnaren; essfrågan kommer efter kontrollbuden.
- **1x–1y–2NT** = 18–19 hp balanserad (för stark för 1NT-öppning).
- I en **2/1 GF-budgivning** är paret redan bundet till utgång – öppnaren bjuder
  då naturligt och i lugn takt (visar form först, sparar styrkebeskedet).

### 5.1 Efter semi-forcing 1NT (1♥–1NT / 1♠–1NT)
Eftersom 1NT är *semi*-forcing får öppnaren **passa** med minimum balanserad hand
utan bra återbud. Annars beskriver hon hand och styrka:

*Efter 1♥–1NT:*
| Återbud | Betydelse |
|---|---|
| Pass | minimum balanserad, inget bättre återbud |
| 2♣ / 2♦ | naturlig ny färg, 3+ (2♣ ibland bara 2–3 vid 4-5-2-2) |
| 2♥ | 6+ ♥, minimum (12–15 hp) |
| 2♠ | reverse: 16+ hp, 5-4 i hf (5 ♥, 4 ♠) |
| 2NT | 18–19 hp, balanserad, inbjuder 3NT |
| 3♣ / 3♦ | hoppskift, 16+ hp, 5-4+, krav |
| 3♥ | 6+ ♥, 16–18 hp, inbjudan |
| 4♥ | 6+ ♥, ~19+ hp, till spel |

**Svararens svar på hoppskiftet (etapp 4, familj C):** svararen PLACERAR —
fit i **hoppskiftets färg** går före preferensen: med 4+ stöd och ~8+
stödpoäng sätts utgången i fiten (4♥ efter 1♠–1NT–3♥; efter ett minorhopp
3NT bara med håll i de objudna färgerna, annars 5m). En 3-korts preferens
till öppnarens högfärg med utgångsvärden lyfts till **4M** — aldrig ett
3M-stopp under kravet. Svaga händer (under ~8 stödpoäng) prefererar
billigast som förut.

*Efter 1♠–1NT:*
| Återbud | Betydelse |
|---|---|
| Pass | minimum balanserad, inget bättre återbud |
| 2♣ / 2♦ | naturlig ny färg, 3+ |
| 2♥ | naturlig, 4+ ♥, 12–15 hp (5-4 i färgerna, ej reverse) |
| 2♠ | 6+ ♠, minimum (12–15 hp) |
| 2NT | 18–19 hp, balanserad, inbjuder 3NT |
| 3♣ / 3♦ | hoppskift, 16+ hp, krav |
| 3♠ | 6+ ♠, 16–18 hp, inbjudan |
| 4♠ | 6+ ♠, ~19+ hp, till spel |

**Svararens andra bud:** preferens till öppnarens färg (svag), pass på en
naturlig minorrebid med stöd, eller höjning/NT som visar 11–12 (inbjudan). En
ny färg av svararen efter 1NT lovar 5+ kort och förnekar stöd (se §4.1-noten).

**Svararens egen färg på 2-läget** (t.ex. 1♠–1NT–2♣–**2♦**/**2♥**; felrapport
#59): naturligt, **5+ kort (oftast 6)**, svag hand utan stöd — **till spel**,
öppnaren passar (hon har redan visat minimum med sitt återbud). Med **6+ kort**
går den egna färgen före en 2-korts preferens (6-1 spelar bättre än 5-2); med
bara 5 kort prefereras först. Budet ryms bara mellan öppnarens återbud och
hennes högfärg (efter 1♥–1NT–2♦ finns inget sådant 2-läge).

**Öppnarens TREDJE bud — inbjudan ska alltid besvaras** (etapp 5, 2026-07-24):
en inbjudan från svararen får aldrig lämnas obesvarad. Öppnaren dömer på
**Bergenpoäng** (form räknas, aldrig under hp) mot det svararen visat (10–12):

| Svararens inbjudan | Öppnarens svar |
|---|---|
| 3♥/3♠ (limithöjning, 3-korts stöd) | 15+ Bergenp. → **4M** · annars pass |
| 2NT efter vårt **2M-återbud** (6+ kort) | 15+ Bergenp. → **4M** · annars **3M** — sang spelas aldrig när vi lovat sex kort |
| 2NT efter en **ny färg** (5-4-handen) | 14+ hp → **3NT** · annars pass |

Att 2NT-inbjudan *alltid* rättas till högfärgen med ett 6-korts återbud är
poängen: 1NT-svararen kan ha bara två kort i färgen, men 6-2 spelar bättre än
sang på en hand utan sidostyrka.

### 5.2 Efter ett 1-läges färgsvar (1x–1y)
Svararen har visat 4+ kort och 6+ hp (krav 1 rond). Öppnaren letar främst
**hf-fit** och beskriver sin styrka. Meny:

**Stöd i svararens färg (4 kort):**
| Återbud | Betydelse |
|---|---|
| höjning (1♣–1♥–2♥) | 4 stöd, minimum 12–15 |
| hopphöjning (1♣–1♥–3♥) | 4 stöd, 16–18, inbjudan |
| höjning till utgång (1♣–1♥–4♥) | 4 stöd, ~19+, ojämn/distributionell |

**Öppnarens tredje bud när svararen inviterar (1m–1M–2M–3M, systemfel #3
delfix 4b, 2026-08-07):** öppnaren svarar **alltid** på inviten — **14+
stödpoäng** räknat mot den kända fiten accepterar (**4M**), annars pass.
*Bakgrund frö 20260982: öppnaren passade 3♥-inviten med 15 hp + 4 trumf +
singel spader (≈18 stödpoäng) — 26 hp på 9-korts fit stannade i 3♥.*

**Egen eller ny färg (ingen 4-korts hf-fit):**
| Återbud | Betydelse |
|---|---|
| ny färg "billigt" (1♣–1♦–1♥, 1♣–1♥–1♠) | 4+ ny färg (4-korts upp), 12+, krav 1 rond |
| ny lägre färg på 2-läget (1♥–1♠–2♣/2♦) | naturlig 4+ (2♣ ibland 3), 12+, ej krav |
| rebjuda egen färg (1♥–1♠–2♥) | 6+ kort, minimum 12–15 |
| hopp i egen färg (1♥–1♠–3♥) | 6+ kort, **16+** startpoäng, inbjudan |
| hopp till utgång i egen HÖGfärg (1♥–1♠–4♥) | 6+ kort, **19+** startpoäng |

**Stegen väger STARTPOÄNG, inte råa hp (etapp 7 hål 1, 2026-07-28).** Samma mått
som reversen och hoppskiftet i samma återbudsläge — en 6-korts färg ger
längdpoäng, så en 15-poängare med `AQT983` är i praktiken en 18:a och ska hoppa.
`pointsWithFloor` golvar vid hp, så den låsta regeln gäller: **TP får bara
uppgradera, aldrig nedgradera** — en platt 15:a rebjuder fortfarande 2 i färgen.
En **minor** stannar på 3-läget även med 19+ (5m är för högt att blåsa på en
hand partnern ännu inte hört om); bara högfärgen sätts i utgång.

*Bakgrund: förr var hoppfönstret `16–18` och räknade rå hp, så en 19+-hand föll
**igenom taket** ned i minimibudet. Frö 20261020: en hand med 20 hp / 23 TP
rebjöd `2♣` beskrivet som "minimum 12–15", och svararen passade — helt korrekt
mot vad budet sa. Fyra sådana givar i mätfröna; alla nådde bara delkontrakt när
utgång eller slam fanns.*

**Balanserade händer (NT-stegen):**
| Återbud | Betydelse |
|---|---|
| 1NT (1♣–1♥–1NT) | 12–14, balanserad (15–17 hade öppnat 1NT) |
| 2NT (hopp, 1♣–1♥–2NT) | 18–19, balanserad |

**Svararens systems on efter 2NT-återbudet (checkback, 2026-08-18).** Öppnarens
2NT (18–19 bal) *nekar* både 4-stöd i svararens färg (hade hen höjt) och en
billigt visbar 4-korts högfärg (hade hen 4 spader efter svararens 1♥ hade hen
bjudit **1♠**). Två högfärgsfitar kan ändå ligga dolda; svararen letar dem i
stället för att gissa blint 3NT:
- **Direkt 3♥/3♠** (svararen rebjuder sin **egen 5-korts** högfärg) = söker
  öppnarens dolda **3-stöd** (5-3). Öppnaren höjer till **4M** med 3-stöd, annars
  **3NT**.
- **3♣ = checkback** efter ett **1♠-svar** med **4 hjärter** (⇒ 5+ spader, annars
  hade svararen bjudit 1♥ upp). 3♣ frågar efter öppnarens **dolda 4-korts
  hjärter** (den enda högfärg hen inte kunde visa billigt — 2♥ vore reverse)
  eller **3-stöd i spadern**. Öppnaren svarar: **3♥** med 4 hjärter (4-4),
  annars **3♠** med 3-korts spaderstöd (5-3), annars **3NT**. Svararen placerar
  utgången i fiten (4♥/4♠) eller passar 3NT.
- **3NT** annars (ingen högfärg att jaga).

Svararen lovar 5+ i sin färg genom hela grenen, så en **4-3-fit spelas aldrig**
(ägarbeslut 2026-08-18: undvik 4-3). Öppnaren är redan begränsad till 18–19 och
svararen har lovat utgångsvärden genom att svara → auktionen driver alltid till
utgång.

**Extra styrka / krav:**
| Återbud | Betydelse |
|---|---|
| reverse (1♣–1♥–2♦) | 16+ hp, längre första färg, krav 1 rond |
| hoppskift ny färg (1♦–1♥–3♣) | 19+ hp, utgångskrav |

**Efter reversen, när svararen PREFERERAR tillbaka (1♣–1♥–2♦–3♣, systemfel #3
delfix 4c, 2026-08-07):** reversen är rondkrav men inte utgångskrav, så
**17-minimum får passa preferensen**. Med **18+** driver öppnaren till utgång:
**3NT** med håll i den objudna färgen *och* minst dubbelton i partnerns färg,
annars **utgång i den prefererade fiten** (5m/4M). *Bakgrund frö 20261111:
öppnaren passade 3♣ med 18 hp (♠K72 ♥6 ♦AKQ4 ♣AQ973) — 28 hp ihop dog i 3♣.
Singel hjärter → inget NT → 5♣.*

Öppnaren kan även **splintra** (hopp i ny färg, t.ex. 1♣–1♥–3♠/4♦) för att visa
4 stöd + kortfärg + extra styrka, på samma sätt som svararen gör i §4.1.

**Slam efter öppnarens hopphöjning (F1 familj C — ärliga portar).** Öppnaren
hopphöjde din högfärg (**1x–1M–3M**, visar **16–18** med 4-korts stöd) → trumfen
är redan bestämd. Du (kaptenen) räknar **din egen hand mot det visade
minimumet 16** — aldrig partnerns faktiska kort:
- **17+ stödpoäng** (17+16 ≥ 33) → **driv**: fråga nyckelkort (**1430 RKC**) och
  placera **6 i högfärgen** (7 bara med *visshet*: entydigt alla fem nyckelkort +
  trumfdam + storslamszon även mot minimum).
- **15–16 stödpoäng** (slam bara om partnern har extra) → **inbjudan 5M**:
  öppnaren accepterar 6M med mer än blott minimum (17–18), passar annars.
- Under det → vanlig väg (acceptera 4M med utgångsvärden, annars pass).
Visar nyckelkortssvaret att **två nyckelkort saknas** stannar kaptenen i **5M**.
Svarets inbyggda tvetydighet (0 eller 3 / 1 eller 4) löses med egen hand; går det
inte antas det höga mot en visad 15+-hand (en stark hand är i praktiken aldrig
nyckelkortslös), annars det låga — då **rättar partnern med det höga antalet
själv upp till 6** (klassisk mekanik: "med 3, bjud vidare över stoppbudet").

### 5.3 I en 2/1 GF-budgivning
Efter ett **2/1-svar** (t.ex. 1♥–2♣) är utgång redan säkrad. Då gäller:
- **Bjud naturligt och lugnt** – öppnaren behöver inte hoppa för att visa styrka.
- **"Fast arrival":** snabb väg till utgång (direkt 4 i färgen) visar **minimum**;
  att ta omvägar visar **extra / slamintresse**.
- **Ny färg** = naturlig form, krav (hela budgivningen är ju redan krav).
- **2NT** = balanserad utan extra form (~12–15) — **krav**, partnern får aldrig
  passa det (felrapport #58); **rebjuden egen färg** = 6+;
  **stöd i svararens färg** = fit.
- **Hopp / splinter** = kortfärg och slamintresse.
- **Svararens försenade stöd i öppnarens lågfärg (ägarbeslut 2026-09-03,
  felrapport #58):** efter 1m–2m′–2NT sätter svararen trumf med **3m** bara med
  **slamintresse** (stödpoäng + öppnarens visade 12 når kanske-zonen 31+,
  slamporten §6); annars är 3NT den naturliga utgången även med fit. Öppnaren
  svarar **3NT** som sangförslag när alla sidofärger är täckta (kaptenen får
  passa), annars **4m** (kravet står). Sedan cue-ronden över 3NT / 1430 RKC
  som efter inverterad höjning (§6.2). Exempel: ♠AKJ ♥— ♦AJ84 ♣AT8753 mot
  1♦: 2♣–(2NT)–3♦–(4♦)–4NT–(5♠)–6♦.
- **Svararens återbud med egen 4-korts högfärg (2026-08-07):** visas naturligt
  under 3NT när den är auktionens **tredje** färg (öppnaren rebjöd egen färg
  eller stödde svararens) — infriar 2/1-regelns löfte om att högfärgen kommer i
  återbudet (§4.2). Prioritet: **försenat stöd i öppnarens högfärg först**
  (känd 5-3-fit slår hypotetisk 4-4, ägarbeslut 2026-08-07), högfärgen före
  3NT. Är tre färger redan bjudna är högfärgsbudet i stället fjärde färg (§6.6).

### 5.4 Öppnarens återbud i konkurrens (efter partnerns enkla höjning)
Öppnar du **1♥/1♠**, en motståndare kliver in, partnern höjer till **2M** och den
andra motståndaren klämmer in ett bud (t.ex. **1♥–(1♠)–2♥–(2♠)** eller
**1♠–(2♥)–2♠–(3♥)**). Nu måste öppnaren välja – passa inte blint:

| Öppnarens bud | Betydelse |
|---|---|
| Pass | dött minimum – försvara deras kontrakt |
| **3M** | minimum men **6:e trumfen** (9+ trumf ihop) → konkurrera på lagen om totala stick (ej krav) |
| **X** | **maximal dubbling = game try** (~15–17 totalpoäng, utgångsintresse) |
| **4M** | utgång (18+ totalpoäng) |

**Varför X = game try och inte straff här?** Motståndarnas inklämda bud tar bort
utrymmet för cue-budet (den vanliga game try-vägen). I *just det läget* betyder
öppnarens X därför **game try**, inte straff – straffdubblingen ges medvetet upp.
Partnern (som höjde) dömer: **4M** med ett **maximum** av höjningen (8+ stödpoäng),
annars tillbaka till **3M** (avböjer). Golven speglar den ostörda accepten (§5.2):
15+ = game try, 18+ = utgång.

### 5.5 Krav får aldrig passas — även när du bjuder en egen väg
Ett **krav** betyder att partnern lovat bjuda igen: du får inte passa. Motorn
hedrar detta i sin planerade linje, men tidigare kunde den tappa kravet när *du*
bjöd en annan hand än den räknat med ("off-book"). Nu läser motorn kravet direkt
ur de **faktiskt spelade buden** i ostörda auktioner och tvingar fram ett
naturligt minimibud i stället för att passa:

| Krav | Exempel | Vem får inte passa |
|---|---|---|
| **2/1 = utgångskrav** | 1♠–2♦ … 2♠ | båda – tills utgång är nådd |
| **Ny färg = rondkrav** | 1♦–1♠ | öppnaren måste rebjuda |
| **Reverse = rondkrav** | 1♣–1♥–2♦ | svararen måste svara |

Minimibudet väljs naturligt: rebjud en egen 5+ färg → stöd partnern (3+ kort) →
ny färg → billigaste sang.

**I konkurrens (motståndarna har klivit in) gäller krav också — men mildare.**
Ett inkliv "lånar" utrymme, så ett fritt 2-över-1 lovar värden **utan att lova
utgång**. Därför är alla krav i störd budgivning **rondkrav** (partnern får inte
passa, men budgivningen får stanna *under* utgång), aldrig utgångskrav:

| Krav i konkurrens | Exempel | Vem får inte passa |
|---|---|---|
| **Fritt bud (ny färg)** | 1♦–(1♠)–2♣ | öppnaren måste rebjuda |
| **Fritt bud på 1-läget** | 1♣–(1♦)–1♠ | öppnaren måste rebjuda |
| **Reverse** | 1♣–1♥–(1♠)–2♦ | svararen måste svara |

Ett fritt bud = en **ny egen färg** som du fritt väljer att bjuda över inklivet
(du kunde ha passat). Det lovar riktiga värden och är rondkrav. Undantag som
*inte* är detta krav: ett **hopp** (kan vara svagt/spärrartat), ett **cue i deras
färg** (= stödhöjning, sköts separat), en **passad hand** (redan begränsad),
**X + egen färg** (dubblarens ombud = invit, ej krav — fel färg-spåret fix 5b),
en färg **öppnaren själv redan bjudit** (= höjning, ingen ny färg — fix 6) och
ett bud på **utgångsnivå** (utgången är målet, inget rondkrav hänger kvar —
fix 6: förr "tvingades" öppnaren dra partnerns 4♥ till 5♦ bet).

### 5.6 Rätt nivå med fit — minorutgång blåses ut vid utgångsvärden
Har du **fit i partnerns lågfärg** och **utgångsvärden** (13+ stödpoäng) ska ni nå
utgång, inte stanna på ett inbjudande hopp. Balanserad hand → **3NT**; annars
**5 i lågfärgen**. (En bara *inbjudande* fit, 11–12 stödpoäng, höjer fortfarande
lugnt till 3-läget – den blåses aldrig till utgång.)

Två självklarheter som motorn nu också följer (fel färg-spåret fix 1,
2026-07-21 — "5♣-ryckaren"): **konstgjorda bud är ingen färg att stödja**
(partnerns Stayman-2♣/3♣ eller överföring direkt över egen sidas sang lovar
inte färgen, §4.3), och **partnerns färdiga utgångsbud respekteras** — står
partnerns 3NT/4♥/4♠/5-minor obestritt hittar boten inte på en "höjning" till
en annan strain (förr kunde 1NT–2♣–2♦–3NT ryckas till 5♣ på en 4-korts
klöver → bet i stället för hemspelad utgång).

### 5.7 New Minor Forcing (NMF)
När du svarat en **högfärg på 1-läget** och öppnaren rebjuder **1NT** (12–14 bal)
kan hens hand dölja **3 kort i din högfärg** (en 5-3-fit) eller en egen 4-korts
högfärg. NMF hittar den: du bjuder den **oanvända lågfärgen** (2♣/2♦) som ett
**konstgjort, tvingande** frågebud — det säger inget om lågfärgen, bara *"beskriv
din hand"*.

| Auktion | NMF-budet |
|---|---|
| 1♣–1♥–1NT | **2♦** |
| 1♦–1♥–1NT | **2♣** |
| 1♥–1♠–1NT | **2♣ / 2♦** (bjud den starkare = antyder stopp) |

**Krav:** 5-korts högfärg + inbjudande eller mer (**11+ hp**; 13+ = utgångskrav).
NMF får också användas av handen med **5+ kort i öppnarens lågfärg och
slamvärden (19+ hp)** — den höjer lågfärgen i nästa rond (se "Färgvisning med
slamvärden" nedan; ägarbeslut 2026-09-05, §9). Ostört läge; störs 1NT-rebudet
gäller andra verktyg. Priset: du ger upp det naturliga svaga 2-budet i
NMF-lågfärgen. NMF gäller **även när öppnarens 1NT
var reservfallet** ("oklart", §5.2 steg 7) — det är fortfarande ett 1NT-återbud
och svararen behandlar det likadant (systemfel #2, 2026-08-07; förr föll de
auktionerna ur systemet och kravet kunde passas, frö 20261317).

**Öppnarens svar** (prioritetsordning):
1. **4-korts andra högfärg** → bjud den (jagar 4-4).
2. **3-korts stöd** i din högfärg → `2M` (minimum) / hopp `3M` (maximum).
3. **Stopp i den objudna färgen** → `2NT` (min) / `3NT` (max).
4. **4 kort i NMF-lågfärgen** → höj den (`3m`).
5. Inget av ovan → **rebjud egen färg** (nödutväg – NMF är krav, pass förbjudet).

**Din placering:** har öppnaren visat **stöd** → `4M` med utgångsvärden (eller mot
öppnarens maximum), annars pass i delkontrakt. Visade öppnaren **sang/ingen fit**
→ `3NT` med utgångsvärden, annars pass — men med **6+ kort i din högfärg** →
`4M` (öppnarens sang lovar 2+ kort, så fiten är säker på egen hand). Kort sagt:
13+ når alltid utgång; 11–12 når utgång bara när öppnaren visat maximum.

**Färgvisning med slamvärden (19+ hp; ägarbeslut 2026-09-05).** Visade öppnaren
inget stöd rebjuder du **`3M` = 6+ kort, slamintresse, utgångskrav** — öppnaren
sätter trumfen med `4M` (sangen lovade 2+ kort), och du frågar **`4NT` (1430 RKC)**
med 33+ räknat mot visade 12, inbjuder `5M` med 31–32. Med **5+ kort i öppnarens
lågfärg** höjer du i stället: **`3m` = 5+ stöd, slamintresse, utgångskrav** —
öppnaren föreslår `3NT` med håll i alla sidofärger, annars `4m` (trumfen
bekräftad), och cue-ronden (§6.2) förs över 3NT/4m: 33+ → 4NT, 31–32 →
billigaste kontrollbud (eller `4m` över 3NT som inbjudan). Under 19 hp gäller
placeringen ovan — slam med känd färg går aldrig via 4♣/4NT direkt över sangen.

**Slam efter 1NT-återbudet (ärliga portar; ägarbeslut 2026-09-05).** Öppnarens
1NT-återbud visar **12–14**. Du (kaptenen) räknar **din egen hand i hp mot det
visade intervallet** — aldrig partnerns faktiska kort, och kortfärger lyfter
inte värderingen (partnern har bara sagt "sang"). Fyra vägar, i den ordningen:
1. **Färg att visa** — 6+ egen högfärg (5-korts högfärg går NMF som alltid)
   eller 5+ kort i öppnarens lågfärg → **New Minor Forcing** och sedan
   färgvisningen ovan (`3M` / `3m`); slammen frågas med **4NT RKC i den satta
   trumfen**. Slam med känd färg går **aldrig** via 4♣/4NT direkt över sangen.
2. **Jämn hand utan färg att visa, sikte på sang, 21+ hp** (kan räkna 33 mot
   partnerns minimum 12) → **Gerber 4♣** (§6.4: 4♣ är Gerber även över ett
   NT-*återbud*) — mot ett så snävt intervall är essen det verkliga okända,
   styrkan räknar du själv: placerar **6NT** (stannar i 4NT om två ess saknas;
   7NT bara med alla ess + storslamszon mot minimum).
3. **Jämn hand på gränsen, 19–20 hp** (slam bara om öppnaren har max) →
   **kvantitativ 4NT**: öppnaren bjuder 6NT med 13–14, passar med 12. **4NT
   direkt över sang-återbudet är alltid kvantitativt** (som i standard-2/1).
4. Ingen slamambition → **3NT** (eller NMF-vägen till utgång).
Direkta inbjudningar `5M` / `4♦` / `4♣` över sangen finns inte: 4♣ är Gerber
(§6.4) och 5M/4♦ ersattes av NMF-vägen (2026-09-05; förr fanns "Gerber med
placering i egen färg" och inbjudan 5M/4♦ — bok-mot-motor-fynd 6 och 15).
En gömd 4-4-fit går inte att *veta* utan att kika → den jagas inte här.
Bottarna följer samma regler som en människa: de kan **missa** en slam som råkar
sitta (t.ex. med bara 4-korts stöd i öppnarens minor) — det är systemriktigt.

### 5.8 Öppnarens rond-2 i konkurrens efter partnerns nya färg / 1NT
Systerfallet till §5.4 (som gällde partnerns *höjning*). Du öppnar **1 i färg**, en
motståndare kliver in, partnern svarar med en **fri ny färg** eller **1NT** (inte en
höjning), och motståndarna **konkurrerar över svaret** (t.ex. **1♣–(1♦)–1♥–(2♦)**,
**1♥–(1♠)–2♣–(2♠)** eller **1♣–(1♦)–1NT–(2♦)**). Nu är rondkravet tekniskt av –
motståndarna har "lånat" utrymmet – så du får själv välja. Passa inte bort en stark
hand:

| Öppnarens bud | Betydelse |
|---|---|
| **4M** | 18+ totalpoäng **med högfärgsfit** → utgång |
| **3NT** | 18+, jämn hand med **stopp i deras färg** |
| **cue i deras färg** | 15+ utan klar naturlig utgång → **extra / (utgångs)krav** – hjälp mig välja rätt utgång |
| **inbjudande hopphöjning** (t.ex. 3♥) | 15–17 **med högfärgsfit** → naturlig inbjudan |
| **3M / bjud om egen färg** | minimum men **egen 6+ färg** → tävla (lagen om totala stick) |
| **enkel höjning** | minimum **med fit** → tävla |
| Pass | minimum utan lång färg eller fit → sälj inte, men höj inte heller |

**Står partnerns fria högfärgsbud kvar (de passar) — felrapport #55:** budet
lovar **5+** (den negativa dubblingen tar 4-kortsfallet), så öppnaren höjer på
**3-korts stöd** med samma skala som §5.2: **12–15 enkel höjning, 16–18
hopphöjning (inbjudan), 19+ utgång.** Svararen räknar sedan **Bergenpoäng**
mot den kända fiten (längden i egen trumf räknas): **14+ → utgång, 12–13 →
inbjudan 3M** (öppnaren antar med 14+ stödpoäng), annars pass. *Giv 2:
1♦–(1♥)–1♠–P–2♠–P–4♠ med ♠KQ87432 mittemot ♠AJ9 — 11 stick; förr 2♣ med 6.*
Samma 3-korts-regel gäller i tabellen ovan när de konkurrerar över det fria
högfärgsbudet.

**Står partnerns fria LÅGFÄRGSBUD på 2-läget kvar (pliktsvepet K5,
2026-09-02):** budet lovar 5+ och 10+ hp, så öppnaren höjer på 3-korts stöd —
**12–13 → 3m** (enkel höjning, partnern går vidare med extra), **14+ → 3NT med
stopp i deras färg**, annars **4m** (hopphöjning = inbjudan till 5m). Förr
blåste öppnaren minorutgång direkt: *1♥–(1♠)–2♣–P–**5♣** på ♠63 ♥KQJ96 ♦A7
♣JT98 — utan spaderstopp och långt från elva stick; 3♣ är rätt.*

**Trösklarna speglar delbit 6 / §5.4:** ~15 = visa extra, 18 = driv utgång, en egen
6:e färg tävlar på minimum. **Cue-budet i motståndarnas färg** är verktyget för att
visa extra utan ett klart naturligt bud (t.ex. 17 hp med en lång färg men utan stopp
i deras färg → cue och fråga efter stopp för 3NT). Styrkan mäts som **stödpoäng när
det finns en fit** (form lyfter), annars ren hp – så en lång svag färg aldrig blåser
upp handen till ett falskt utgångskrav.

### 5.9 Öppnarens återöppning när partnern PASSADE inklivet
Systerfallet till §5.8: här sa partnern **inget** (passade inklivet), så öppnaren
riskerar att **sälja given** i rond 2. Två lägen, beroende på vad RHO gjorde:

**A) RHO konkurrerade** (t.ex. **1♣–(1♠)–P–(2♠)**). Partnern passade, men motståndarna
budade vidare. Öppnaren säljer inte en bra hand:

| Öppnarens bud | Betydelse |
|---|---|
| **bjud om egen färg** (t.ex. 3♣) | **egen 6+ färg** → tävla (lagen om totala stick) |
| **X (återöppning)** | 15+ hp och **kort (≤2) i deras färg** → takeout, välj färg partner |
| Pass | minimum utan lång färg / utan kort i deras färg — **och ALLTID när deras senaste bud är utgång** (fel färg-spåret fix 6: lagen gäller delkontraktsnivåer; 5♥ på 6-korts färg över deras 4♠ mittemot en passad partner är en gåva) |

**B) RHO passade också** – inklivet är passat runt till öppnaren i **utpassningssitsen**
(t.ex. **1♠–(2♥)–P–P**). Partnern gör ofta en **trap pass** (hen sitter med inkliparens
färg bakom sig och väntar på att du ska återöppna). Gäller **även 1-läges inkliv**
(t.ex. **1♣–(1♠)–P–P**, lagat via felrapport #38 – förr såldes de). Öppnaren
återöppnar villigt:

| Öppnarens bud | Betydelse |
|---|---|
| **X (återöppning)** | **kort (singel/renons) i deras färg** → takeout; partnern kan **konvertera till straff** genom att passa |
| **bjud om egen färg** (t.ex. 2♠) | **egen 6+ färg** → tävla, sälj inte med en 6-korts färg |
| **X (återöppning)** | 15+ hp (extra) även utan kort i deras färg |
| Pass | jämn minimum, längd i deras färg, ingen 6-korts färg → sälj (partnern hade en chans) |

**Balanseringsfilosofi:** i utpassningssitsen är partnern **markerad med värden**
(annars hade motståndarna budat vidare), så en återöppning på **kort i deras färg** är
billig – och en trap pass hos partnern (längd + honnörer i deras färg) blir en **straff**
när hen konverterar din takeout-dubbling.

### 5.10 Öppnarens sang-återbud när vår MINOR höjts i konkurrens
Du öppnar **1♣/1♦**, en motståndare kliver in med en färg, och partnern **höjer din
minor** (t.ex. **1♦–(1♠)–2♦**). Med en **stark, sangduglig hand** (jämn eller egen 6+
minor) och **stopp i motståndarens färg** visar du styrkan i sang i stället för ett
tyst färgbud som säljs billigt (annars nådde en 19-hand bara 2 i en färg):

| Öppnarens bud | Betydelse |
|---|---|
| **3NT** | 20+ hp, stopp i deras färg → utgång (spela) |
| **2NT** | 18–19 hp, stopp i deras färg → **inbjudan** |
| (annat) | under 18 → som förr (tävla / pass) |

Efter **2NT-inbjudan** dömer **höjaren**: med ett **maximum av höjningen (8+ hp)**
höjer hon till **3NT**, annars **pass** (stannar i 2NT). En jämn 19-hand med extra
kvalitet (startpoäng ≥20) uppgraderade oftast redan sin **öppning** till 2NT (§3), så
den här grenen fångar 18–19 utan den kvaliteten samt starka fördelningshänder.

### 5.11 Öppnarens svar på partnerns CUE-höjning — 3NT före 5m
Du öppnar 1 i färg, en motståndare kliver in, och partnern **cue-bjuder deras
färg** (= limithöjning eller bättre av din färg, krav). Öppnarens svar:

| Öppnarens bud | Betydelse |
|---|---|
| **3NT** | **jämn hand + stopp i deras färg** (minorfit) → rätt utgång är 9 stick, inte 11 |
| utgång i vår färg (4M/5m) | maximum (15+) utan sang-alternativet |
| billigaste återbud i vår färg | minimum, **ojämn hand eller inget stopp** |

- **Poängen (fel färg-spåret fix 3):** med **minorfit** är 3NT den naturliga
  utgången. Förr återgick öppnaren ALLTID billigast på minimum, och cue-bjudaren
  utan eget stopp satte 5m — fast stoppet satt hos öppnaren (t.ex. ♣K2 bakom
  inklivaren) och 3NT var hemma. Nu bjuder öppnaren 3NT direkt med jämn hand +
  stopp, oavsett min/max (cuet driver ändå till utgång — det här väljer den
  BÄTTRE utgången).
- Minimiåtergången betyder därmed ärligt **"ojämn hand eller inget stopp"** —
  cue-bjudarens fortsättning (3NT med eget stopp, annars 5m) blir ett informerat
  val i stället för en chansning.
- **Högfärgsfit rörs inte:** där är 4M rätt utgång som förr.
- **Cue-bjudarens fortsättning på limit-värden (fel färg-spåret fix 6):** cuet
  lovar "limithöjning ELLER BÄTTRE". Återgår öppnaren **billigast** (minimum)
  och cue-bjudaren bara har **limit (under 13 stödpoäng)** stannar budgivningen
  där — kravet var en rond, inte utgång (förr blåstes 5m bet på 11 hp mot
  minimum). Med äkta utgångsvärden (13+) drivs till utgång som förr.

## 6. Konventioner
*(Ett eget avsnitt per konvention, tillagda en i taget.)*
Planerade enligt systemkortet: Stayman, Smolen, Jacoby-transfer, Minor Suit
Stayman, Texas, Splinter, fjärde färg krav, upplysningsdubbling, Michaels,
Drury, Jacoby 2NT, 1430 RKC Blackwood, Sjöbergs 5NT, Gerber.

Antagna: **Bergen-höjningar** (standard), **tvetydig splinter** och **Bergen
game try** (§4.1), **inverterade minorhöjningar** (§4.2), samt **Stayman**, **Jacoby-transfer**,
**Smolen**, **Texas** och **Minor Suit Stayman** (§4.3), **stark 2♣ med
2♦ väntebud** (§4.4), **Ogust** på svaga tvåor (§4.5), samt **1430 RKC
Blackwood**, **cue-bid**, **Sjöbergs 5NT**, **Gerber**, **Exclusion Blackwood**, **fjärde färg krav** och **Drury**
(tvåvägs Reverse) (§6), samt försvar/konkurrens (§7): **DONT** mot 1NT,
**Takeout Double**, **negativa/responsiva/stöddubblingar**, **Lebensohl**,
**Michaels + ovanlig 2NT** och **Mathe** – beslutade 2026-06-26. Källor: bridgebum.com,
svenskbridge.se.

**Ärliga slamportar (grundprincip, ägarbeslut 2026-07-07).** All slamutredning
följer samma mänskliga regel — varje beslut fattas på **egen hand + vad partnern
VISAT via buden**, aldrig på partnerns faktiska kort:
- **Kaptensregeln:** egen hand + partnerns visade **minimum** ≥ 33 → **driv**
  (fråga nyckelkort/ess). 31–32 (slam bara om partnern har extra) → **inbjudan**
  (kvantitativ 4NT över sang; 5M/4m med trumf) — partnern accepterar med **mer än
  blott minimum**. Under det: nöj dig med utgång.
  *Exempel:* efter hopp-återbudet **1m–1M–3m** (visar 16–18, 6+ färg) driver
  svararen med 3+ stöd från **17** stödpoäng och bjuder in med 4m på **15–16**.
- **Härledning:** ess-/nyckelkortssvaren läses mot egen hand (5♣ = "1 eller 4":
  har jag redan 2 är det 1). Går tvetydigheten inte att lösa antas det **höga**
  mot en visad 15+-hand, annars det **låga** — och då **rättar partnern med det
  höga antalet själv upp till 6** över stoppbudet.
- **Storslam kräver visshet:** entydigt alla fem nyckelkort + trumfdam +
  storslamszon **även mot partnerns minimum**.
- **Konsekvens:** bottarna bjuder som människor — de kan missa en slam som råkar
  sitta, och någon enstaka gång bjuda en som betar. Det är systemriktigt.

### 6.1 1430 RKC Blackwood
Slamverktyg när en **trumf är överenskommen**. **4NT** frågar efter de fem
**nyckelkorten** = de 4 essen + **trumfkungen**.

**Svar (1430-varianten):**
| Svar | Nyckelkort |
|---|---|
| 5♣ | 1 eller 4 |
| 5♦ | 0 eller 3 |
| 5♥ | 2 (eller 5) **utan** trumfdam |
| 5♠ | 2 (eller 5) **med** trumfdam |

- **Trumfdam-fråga:** efter 5♣/5♦-svar frågar billigaste icke-trumf om trumfdam.
  Svar: återgå till trumf = **ingen** dam; annat färgbud = **dam + kung** i den
  färgen; 5NT = dam **utan** sidokungar.
- **5NT = kungfråga** (lovar alla 5 nyckelkort + trumfdam) – vi spelar
  **Sjöbergs 5NT**, se §6.3.
- **Stoppbudet 5-trumf efter ett tvetydigt svar** (5♣ = 1 eller 4, 5♦ = 0
  eller 3) betyder *"pass med det låga antalet, bjud vidare med det höga"*:
  den som svarade och sitter med **4 (resp. 3) nyckelkort lyfter själv till
  6-trumf**. Gäller lika i konkurrens (felrapport #60: 5♥ passades med fyra
  nyckelkort).
- Används efter t.ex. splinter, Jacoby 2NT, 2♣-träff eller cue-bid-sekvenser –
  när trumf är klar och man vet att inga två kontroller saknas.

### 6.2 Cue-bid (kontrollbud)
När **trumf är överenskommen i en kravbudgivning** är ett bud i ny färg inte
naturligt utan visar en **kontroll**:
- **Första-rondskontroll** (ess eller renons) visas först, **billigaste först**
  och uppåt.
- Nästa omgång kan visa **andra-rondskontroll** (kung eller singleton).
- Att hoppa över en färg förnekar kontroll där – så partnern ser var det läcker.

Cue-bids används för att leta slam **innan** 1430 RKC: när båda visat kontroller
i sidofärgerna och inget hål syns, frågar 4NT efter nyckelkorten.
*Exempel:* 1♠–2♣–2♠ (fit) –4♣ (cue ♣-kontroll) –4♦ (cue ♦) –4NT (1430 RKC).

*Motoranmärkning (2026-08-03, river 2026-07-07):* bottarna cue-bjuder nu igen i
sina egna slamutredningar när **utgång är etablerad (GF) och trumf är
överenskommen**. Principen: en cue under utgång är **gratis** — visar en hand en
kontroll och partnern har inget extra sjunker paret bara tillbaka till utgången.
Därför finns **ingen poänggräns för att cue:a**; omdömet ligger i stället på
beslutet att gå **förbi** utgången (4NT RKC / slam), som kräver både kontroller
(högst en sidofärg utan första-rondskontroll) och trickvärden. Cue-bud
**tillkommer bara** — saknar den drivande handen en gratis cue står de gamla
vägarna (driv 33+ / inbjudan 31–32) kvar oförändrade. Inkopplat:
**Jacoby 2NT**, **New Minor Forcing → öppnarens fördröjda högfärgsstöd**, och
sedan B13 (2026-08-07) även **inverterad minor** och **2♣-grenen efter
positivt svar + satt trumf** (alla äkta agreed trumf). Två minorregler skyddar
budspråken: (1) i minorfit cue:as **först ÖVER 3NT** — under 3NT betyder nya
färger stopp-letande (§4.2); (2) i **klar drivzon (33+)** hoppas cue-ronden
över i minortrumf och kaptenen frågar 4NT direkt, eftersom 5m ligger över 4NT
och cue-buden annars kan äta upp frågeutrymmet. Reverse/hoppskift väntar på
egen trumf-agreement-analys (där är trumfen inferrerad, inte bjuden — ett cue
skulle läsas naturligt). Bjuder **du** själv ett cue i standardordning
(billigaste först) följer boten med; en cue i annan ordning hamnar tills
vidare off-book.

### 6.3 Sjöbergs 5NT (kungfråga)
Efter 4NT RKC kan ess-frågaren bjuda **5NT** för att fråga efter kungar inför
storslam (lovar att inga nyckelkort saknas och att trumfdamen är under kontroll).
Till skillnad från standard visar svararen **vilken** kung – inte hur många:

| Svar | Betydelse |
|---|---|
| 6 i ny färg | kungen i den färgen (billigaste först) |
| 6 i trumf | ingen sidokung |
| 7 i trumf | två eller alla tre användbara kungar |

Poängen: att veta exakt vilken kung partnern har avgör om en sidofärg ger nog
med stick för storslam (t.ex. K-D mittemot ess).

### 6.4 Gerber (ess-fråga över NT)
**4♣** är Gerber – ess-fråga – men **endast som hopp direkt över en naturlig
NT-öppning eller NT-återbud** (1NT, 2NT). Används för balanserade slamhänder där
NT är "trumf" (mot ett färgkontrakt används i stället 1430 RKC). Över ett
1NT-*återbud* frågar bara den **jämna handen utan färg att visa** (§5.7): en
egen färg visas först via New Minor Forcing och slammen går via 4NT RKC i den
satta trumfen — Gerber frågar aldrig för en färg (ägarbeslut 2026-09-05).

**Ess-svar:**
| Svar | Ess |
|---|---|
| 4♦ | 0 eller 4 |
| 4♥ | 1 |
| 4♠ | 2 |
| 4NT | 3 |

**5♣ = kungfråga** (efter ess-svaret):
| Svar | Kungar |
|---|---|
| 5♦ | 0 eller 4 |
| 5♥ | 1 |
| 5♠ | 2 |
| 5NT | 3 |

**När 4♣ INTE är Gerber:** om budet inte är ett hopp, eller inte kommer direkt
över NT – då är 4♣ naturligt (klöver) eller cue-bid.

### 6.5 Exclusion Blackwood (5-läges-voidwood) — *avancerad/valfri*
När **trumf är överenskommen** i en slamriktad budgivning är ett **hopp till
5-läget i en sidofärg** Exclusion: "jag är **renons** i den här färgen – räkna
nyckelkort men **strunta i esset i renonsfärgen**".

**Svar (1430-steg, esset i renonsfärgen borträknat):**
| Steg | Nyckelkort |
|---|---|
| 1:a steget | 1 eller 4 |
| 2:a steget | 0 eller 3 |
| 3:e steget | 2 utan trumfdam |
| 4:e steget | 2 med trumfdam |

- **Trumfdam-fråga:** billigaste icke-trumf efter svaret (som i 1430 RKC, §6.1).
- **Avgränsning mot resten av systemet:** endast **hopp till 5-läget i sidofärg**
  är Exclusion. Tidiga splintrar (§4.1) och Jacoby-4-lägesbud (§4.1) lämnas
  orörda. Minnesregel: **splinter tidigt, Exclusion sent; cue-bid kryper,
  Exclusion hoppar.**

### 6.6 Fjärde färg krav (Fourth Suit Forcing)
När paret har bjudit **tre färger** är ett bud i den **fjärde färgen konstgjort
och krav** – inte naturligt. Det visar utgångsvärden och ber partnern beskriva
mer (oftast: har vi stopp för 3NT, eller en gömd fit?).

Vi spelar **fjärde färg = krav till utgång (GF)**. *(Alternativ: krav 1 rond med
inbjudningsstyrka 10+ – kan ändras senare.)*

*Exempel:* 1♦–1♠–2♣–2♥ (fjärde färg), 1♣–1♥–1♠–2♦ (fjärde färg).

**Partnerns svar (prioritet):**
1. visa 3-korts stöd för partnerns hf,
2. rebjuda en färg för extra längd (6-4 / 5-5),
3. bjuda NT med stopp i fjärde färgen,
4. (sällan) höja fjärde färgen med 4 kort.

**När fjärde färg INTE gäller:** passad hand, motståndarna stör, alla fyra färger
bjudna på 1-läget, öppnaren har reverserat, eller svararen redan gjort hoppskift
/ 2-över-1.

**Fit i öppnarens ANDRA färg = vanlig höjningsstege** (etapp 5, 2026-07-24).
Har svararen 4+ kort i den färg öppnaren visade i rond 2 (t.ex. 1♣–1♥–1♠) höjer
hon **efter stödpoäng**, precis som alla andra höjningar i systemet — förr blev
det alltid den billigaste höjningen, så en 13-hand sa samma 2♠ som en 6-hand och
utgången försvann:

| Stödpoäng | Höjning av öppnarens högfärg |
|---|---|
| under 10 | billigaste höjning (2♠) |
| 10–12 | hopphöjning = inbjudan (3♠) |
| 13+ | utgång (4♠) |

Två undantag: (a) efter en **reverse i högfärg** (1♦–1♠–2♥) går paret nästan
alltid till utgång, så höjningen delas i **fast arrival** (ägarbeslut
2026-09-05): **billig höjning (3♥) = stark** — 4+ stöd och egna öppningsvärden
(12+ stödpoäng), slamintresse, **utgångskrav**; öppnaren öppnar cue-ronden
(§6.2) med sitt billigaste kontrollbud under utgång, även i egen färg
(3♠/4♣/4♦), eller avslutar 4♥ utan kontroll; svararen cue:ar tillbaka, frågar
4NT med 33+ mot visade 16 (kontrollerna räknade) eller avslutar 4♥ — och över
öppnarens 4♥-avslut driver hon ändå 4NT med 33+, inbjuder 5♥ med 31–32.
**Hopp till utgång (4♥) = den svagare handen** med 4+ stöd, ingen slamambition.
Ingen delkontrakts-escape behövs. Reverse i lågfärg (1♣–1♥–2♦) höjs billigast
som förut (4♦ = slaminbjudan, §5). (b) en **minorhöjning** ligger redan på
3-läget och graderas inte uppåt (utgång i minor kräver elva stick — vägen går
via 3NT eller fjärde färg).

**Öppnarens 1NT-reservfall snävas in (2026-08-07, systemfel #2):** med
**singel/renons i svararens färg** och en egen **5-korts färg** rebjuder
öppnaren färgen (2 i färgen, minimum) i stället för en skev 1NT — 1NT med
singel i partnerns färg ljuger om formen. *Bakgrund frö 20260878: 1=4=3=5
efter 1♣–1♠ rebjöd 1NT; nu 2♣.*

**Svararens rebjudna EGEN färg graderas likadant (2026-08-07, systemfel #3
delfix 4a).** Med 6+ kort i egen färg och ingen fit i öppnarens färger:

| Styrka (hp) | Svararens andra bud |
|---|---|
| ≤ 10 | billigaste rebud (minimum, öppnaren får passa) |
| 11–12 | **hoppinvit** i färgen (t.ex. 1♦–1♥–1♠–3♥) |
| 13+ | **fjärde färg (GF)** — kravet placerar utgången |

Förr sa en 16-poängare samma billiga 2♥ som en 6-poängare, och öppnaren
passade helt korrekt mot vad budet sa. *Bakgrund frö 20261323: ♠73 ♥AKT743
♦KT7 ♣AQ (16 hp) rebjöd 2♥ efter 1♦–1♥–1♠ — 30 hp ihop dog i 2♥. Nu går
handen fjärde färg-vägen och paret når 3NT.*

### 6.7 Drury (tvåvägs Reverse)
Gäller när **svararen är passad hand** och partnern öppnar **1♥/1♠ i 3:e/4:e
hand** (där lätta öppningar är vanliga). Begränsar höjningen så man inte hamnar
för högt.

| Svar (passad hand) | Betydelse | Konvention |
|---|---|---|
| 2♣ | limithöjning (~10–12 hp), exakt **3** trumf | Drury (tvåvägs) ● |
| 2♦ | limithöjning (~10–12 hp), **4+** trumf | Drury (tvåvägs) ● |

**Öppnarens återbud:**
- **rebjuda högfärgen** (2♥/2♠) = lätt öppning, **signoff** (svararen passar).
- **allt annat** (ny färg, utgång) = riktig öppning, accepterar utgång / visar
  värden.

Eftersom svararen redan är passad är allt begränsat till utgång (ingen slam).

### 6.8 Kvantitativ höjning av partnerns naturliga 3NT
Placerar partnern kontraktet i ett **naturligt 3NT** i en vanlig färgauktion är
det inte automatiskt sista ordet. Kaptensregeln (§5.2, ärliga slamportar) gäller
även här: **egen hand + partnerns VISADE minimum ≥ 33 → driv.**

Har partnern **öppnat på 1-läget i en färg** är det visade minimet **12 hp** (den
låsta regeln: en 12-poängshand öppnar alltid). Tröskeln blir därmed:

| Egen hand | Aktion över partnerns 3NT |
|---|---|
| **21+ hp** | **6NT** — slamzonen (33) nås redan mot partnerns minimum |
| 20 eller mindre | pass — 3NT står (hellre systemriktig miss än gambling) |

Villkoren är medvetet smala: partnerns 3NT ska vara auktionens **senaste bud**,
motståndarna ska ha varit **tysta** (deras bud kan göra 3NT till ett tävlingsbud
i stället för en styrkevisning), och den egna handen får inte ha **renons** —
vild fördelning hör inte hemma i 6NT. Sangöppningar har sina egna portar
(kvantitativ 4NT och Gerber, §4.3/§6.4). **Ingen kontrollkoll** (ägarbeslut) och
**storslam kräver visshet** → taket är 6NT.

*Bakgrund (felrapport #42): auktionen 1♣–1♥–1♠–2♦–2♥–3♦–3NT passades ut med 21 hp
mittemot öppningshanden. Slamportarna satt bara i den kanoniska linjens namngivna
mönster (Jacoby 2NT, inverterad minor, 1NT-återbudet, MSS) — en vanlig färgauktion
som slutade i 3NT hade ingen port alls. Given gav 12 stick.*

### 6.9 Öppnarens slamtrevare efter svararens 3NT (systerfallet)
§6.8 gäller kaptenen som **hör** partnerns naturliga 3NT. Spegelbilden är öppnaren
som **själv** har extra: hen har invit-hoppat i sin minor och svararen har
accepterat utgången med 3NT.

Auktionen **1m–1X–3m(invit-hopp)–3NT**. Öppnarens hopp visade 16+ med 6+ i
minoren, och svararens 3NT accepterade utgången. Har öppnaren **genuint slamvärde
hen själv vet om — 19+ hp med den löpande 6-korts minoren, ingen renons** — gör
hen **en kvantitativ slamtrevare: 4NT**. Svararen lyfter till **6NT med ett
maximum** av sin acceptans (topp av intervallet, eller en fittande topphonnör K/A
i öppnarens minor), annars **passar** hen och 4NT står.

Smal med flit (ägarbeslut 2026-07-31, "bara äkta extra"): från öppnarens stol är
en 16–18-hand med löpande minor **oskiljbar** från en tunn 26-hp-slam som bara går
på double-dummy, så bara 19+ trevar — annars pass (hellre systemriktig miss än
blåsning). Ingen kontrollkoll (ägarbeslut) och storslam kräver visshet → taket är
6NT.

*Bakgrund (etapp 7 hål 2, "3NT-stoppen"): frö 20261020 ur mätningen — Nord
♠K ♥AK3 ♦AT5 ♣AQT843 (20 hp) öppnade 1♣, hoppade 3♣, och passade svararens 3NT
fast ♣K92 mittemot fick 6NT att ge 12 stick. Öppnaren saknade helt en väg vidare
(det nakna passet, Fynd 1).*

### 6.10 Slaminvit i konkurrens (kontroll-komplett 4NT)
Cue-maskineriet i §6.2 lever i den kanoniska linjen (Jacoby 2NT / NMF). Men en
fit kan också uppstå **genom konkurrens** — negativ/upplysningsdubbling +
höjning, fritt svar — och där fanns tidigare ingen slamväg alls: den starka
kaptenen passade naket i utgången.

I konkurrens gäller en extra försiktighetsprincip: **cue-bud läcker information
till motståndarna** (styr deras utspel och försvar). Därför cue:ar kaptenen inte
när hen inte behöver. Regeln (steg 1, "kontroll-komplett 4NT"):

Har kaptenen, efter att en **högfärgsfit etablerats i konkurrens**, allt detta —
- **äkta extra**: 17+ startpoäng, eller 16+ med **3 kontroller** (A=1 per ess,
  K räknas via A+K-summan ≥3),
- **förstarundskontroll (ess eller renons) i ALLA tre sidofärger** — hen behöver
  inte fråga efter kontroller, bara efter essen,
- och partnern har **visat extra genom ett hopp** (inte bara svarat på tvång) —

då frågar hen **direkt 4NT (RKC)** utan cue-rond. Placeringen efter svaret är
konservativ: **6M bara när essvaret är entydigt** och summan nyckelkort ≥4,
annars stopp i 5M. **Storslam bjuds aldrig** från konkurrensläget.

Händer med äkta extra men **ofullständiga** kontroller (de skulle behöva en
cue-rond för att hitta partnerns kontroll) täcks INTE av steg 1 — den
cue-frontenden är parkerad (ägarbeslut 2026-08-07, se ändringsloggen).

*Bakgrund (etapp 7 hål D): frö 20260877 ur mätningen — Syd ♠KJT ♥A73 ♦AK97 ♣A95
(19 bal) dubblade starkt över 1♥, partnern svarade FRITT 3♠, och Syd höjde till
4♠ och passade fast 6♠ stod. Kontroll i allt, 19 hp, partnern visade extra —
ändå fanns ingen väg att fråga.*

## 7. Försvarsbud
> Budgivning när motståndarna öppnat (inkliv, dubblingar) och i konkurrens efter
> vår egen öppning. Markeringar och utspel: §8.

### 7.1 Inkliv och svar
- **Enkelt inkliv** (1-/2-läget): bra **5+ färg**, ~8–16 hp. Färgkvalitet går
  före poäng.
- **Hoppinkliv** (t.ex. (1♦)–2♠): **svagt**, 6-korts färg, spärr (som en svag
  tvåa).
- **1NT-inkliv:** 15–18 hp, bra stopp i deras färg – **kör samma system som över
  en 1NT-öppning** (Stayman, transfers m.m., §4.3), fast med 15–18 hp.
- **Balansering (utpassningsläget, felrapport #5):** efter deras 1-lägesöppning
  och två pass får fjärde hand hela §7-arsenalen (inkliv/X/Michaels/ovanlig 2NT)
  – given passas inte ut med en klar aktion på handen.
- **"Låna en kung" i balansering (2026-07-05):** i utpassningsläget är partnern
  markerad med värden (motståndarna stannade lågt), så du får agera **~3 hp
  lättare** än i direkt sits. Golven sänks med en kung:

  | Aktion | Direkt sits | Balansering |
  |---|---|---|
  | Enkelt inkliv (5+ färg) | 8 hp | **5 hp** |
  | Upplysnings-X (kort i deras färg, stöd i övriga) | 12 (perfekt 4-korts form 10) | **9** (form **7**) |
  | 1NT-inkliv (jämn m. stopp) | 15–18 | **11–14** (klassisk återöppnings-1NT) |

- **Advancer-rabatten (F3, 2026-08-07):** den som SVARAR på partnerns
  balansering vet att kungen redan är lånad — annars värderas samma kung två
  gånger och delkontraktsvärden blåses till utgång. Därför gäller generellt,
  över ALLA balanserade öppningar (1-läget hit; svaga tvåor/spärrar sedan
  fix 5a, §7.7):
  - **Höjning av partnerns balansinkliv:** stödpoäng **−3**, och utan äkta
    utgångsvärden *efter* rabatten kapas höjningen vid **3-läget**. Exempel:
    1♥–P–P–1♠–P — 11 stödpoäng höjer 2♠ (inte invit-3♠), 14 bjuder invit-3♠
    (inte 4♠).
  - **Svar på partnerns balanserings-X:** trösklarna för hopp (9–11) och cue
    (12+) räknas på **hp −3**. Exempel: 1♥–P–P–X–P — 10 hp svarar billigast
    1♠ (inte hoppet 2♠), 13 hp hoppar 2♠ (inte cue).
  Direkt sits är orörd. Balanseraren själv driver vidare med äkta extra —
  rabatten flyttar bara VEM som bär styrkevisningen till den som faktiskt
  har den.
- **17+ säljer aldrig given (felrapport #40).** Ryms en 17+-hand inte i något
  fönster – för stark för det kapade inklivet (tak 16), fel form för
  upplysnings-X:et (kräver korthet i deras färg), och utan egen 5+ färg att visa
  – **dubblar den ändå** i stället för att passa. Utloppet är detsamma som
  §7.7-försvaret redan har mot svaga tvåor och spärrar. Typfallet: en 20-poängare
  vars enda långfärg är **öppnarens egen** (KQJ964 hjärter över deras 1♥) – förr
  passade den och 1♥ såldes på fläcken. X:et är upplysning: partnern måste svara,
  och den starka handen beskriver sig på nästa varv.

  Michaels / ovanlig 2NT (formbud, 5-5) och den starka 17+-X:en är oförändrade –
  de vilar på form/styrka, inte på det lånade kunga-utrymmet. Färgkvalitet och
  korthet i deras färg krävs fortfarande; kungen sänker bara HP-tröskeln ovanpå
  formkraven.
- **TP till inklivsgolven (F4, 2026-08-07):** golven för **enkelt inkliv** och
  **upplysnings-X** läser numera **totalpoäng** — `max(hp, startpoäng)`
  ("nedgradera aldrig", samma mått som resten av motorn) — så en formstark hand
  kliver in ett golv tidigare (t.ex. 7 hp med KQJ109-femma = 9 startpoäng →
  1♠ i direkt sits). **Additivt** ovanpå "låna en kung": TP är formspaken,
  kungen är sitsspaken — i balansering gäller alltså t.ex. golvet 5 läst i TP.
  Två vakter på lyftet:
  - **Kvalitetsvakten:** lyftet kräver en **kvalitetsfärg** (3+ av topp-5 i
    inklivsfärgen) — "färgkvalitet går före poäng". Två längdpoäng på
    skräpfärger (5-5 med QJ975) räcker inte; utan kvalitetsfärg gäller de råa
    HP-golven som förr.
  - **Spärrvakten:** spärrmaterial (6+ färg med rå 6–10 hp) lyfts inte — det
    ska förbli ett svagt hoppinkliv, inte förvandlas till ett "konstruktivt"
    inkliv.
  **Rå HP behålls** där form inte hör hemma: 1NT-fönstren (sangvärdering),
  inklivstaket 16 och hela 17+-styrningen (X först). Advancerns fit-trösklar
  (cue = limithöjning+ vid 11+, fit-jump vid 10+) läser **stödpoäng**
  `max(hp, stödpoäng)` — samma mått som de levande höjningarna redan använde.

**Svar på partnerns enkla inkliv:**
| Svar | Betydelse |
|---|---|
| höjning | stöd, konkurrens/spärr (inte inbjudan i sig) |
| **cue-bud i deras färg** | limithöjning eller bättre (bra stöd, krav) |
| ny färg | naturlig, konstruktiv, ej krav |
| 1NT / 2NT | naturlig, stopp i deras färg, lämplig styrka |
| fit-jump (hopp i ny färg) | bra stöd + egen sidofärg, inbjudande+ |

**Inklivarens andra färg = "välj" (felrapport #56).** Kliver partnern in och
bjuder sedan en **ny färg** (t.ex. 1♥–(1♠)–3♥–P–P–**4♦**) visar hen två färger
och ber advancern **välja** — det är inget styrkebud att passa på poäng.
Advancern ger **preferens till inklivsfärgen** när stödet är bättre där,
**oavsett poäng**: kostar preferensen ingen nivå (inklivsfärgen rankar över
den andra, 4♦ → **4♠**) räcker lika lång eller längre inklivsfärg; kostar den
en nivå (1♦-inkliv, sedan 2♠ → 3♦) krävs klar skillnad (2+ kort). Aldrig
förbi utgång. Bättre stöd i den andra färgen → pass/höjning som vanligt.
*Giv 6: Nord passade 4♦ med ♠K9873 ♦T86 — 4♠ var gratis.*

**Advancern tävlar upp till fiten (lagen om totala stick, 2026-07-05):** klev partnern
in på **2-läget** lovar det en bra **6+ färg**, så **3-korts stöd = 9-korts fit**. Hittar
motståndarna sedan sin egen fit (t.ex. **1♠–(2♥)–2♠**) ska advancern **inte sälja given**
utan tävla:

| Advancerns bud | Betydelse |
|---|---|
| **3 i partnerns färg** (t.ex. 3♥) | 3-korts stöd (9-korts fit) → tävla på lagen om totala stick (ej krav) |
| **utgång** (4M) | 3-korts stöd + genuina utgångsvärden (13+ stödpoäng) |
| Pass | för svag (< ~8 stödpoäng) – tävla inte på en bust; eller konkurrensen redan tryckt upp budet till 4-läget utan utgångsvärden |

Lagen: med **9 gemensamma trumf** är 3-läget säkert att tävla till (om det betas var
deras kontrakt oftast att gå hem). Ett **1-läges** inkliv (bara 5+ lovad) kräver
**4-korts** stöd för att tävla till 3-läget.

**3-korts stöd mot ett 1-lägesinkliv = 8 trumf → höj till 2-läget (pliktsvepet
K3, ägarbeslut 2026-09-02).** Inklivet lovar 5+, så tre kort är fit: advancern
**höjer enkelt från 6 hp** — även när motståndarna hunnit höja
(**1♥–(1♠)–2♥–2♠** med ♠A75 ♥AQT ♦9873 ♣983), och även när partnern sedan passat
(tävlande höjning). Aldrig hopp eller utgång på tre kort, och pressar de upp
billigaste höjningen till **3-läget** passar advancern (8 trumf tävlar inte
dit). Förr krävde motorn 4 kort och sålde given: 92 av 1539 störda auktioner i
svepet var passade höjningar på känd fit (`$env:PLIKT='1'; npx vitest run
src/lib/engine/pliktsvep.probe.test.ts`, före fixen).

**Inklivaren svarar cuet när motståndarna ligger tysta (pliktsvepet K1,
2026-09-02).** Advancerns cue är krav — passar inklivaren spelas cuet i
motståndarnas färg (så gick det förr: 1♦–(1♠)–P–(2♦\*)–P–**P**–P blev 2♦ av
advancern). Inklivaren värderar i totalpoäng (hp med längdpoäng):

| Inklivarens svar på cuet | Betydelse |
|---|---|
| **utgång i högfärgen** (4M) | extra: **14+** totalpoäng (14 + cuets 11 = utgång) |
| **3NT** | lågfärgsinkliv, 14+ **med stopp** i deras färg |
| **billigaste återgång** i egen färg (t.ex. 2♠) | minimum (under 14) — ej krav |

Cue-bjudaren går sedan vidare som efter en öppning: **ren limithöjning
(11–12) passar** återgången, **13+ stödpoäng driver utgång** (3NT med stopp i
deras färg, annars 4M/5m).

**Överklivaren säljer inte heller ut efter partnerns cue-höjning (felrapport #47):**
speglingen av regeln ovan. Cue-budade advancern deras färg (limithöjning eller
bättre i din färg) och konkurrerade motståndarna sedan vidare **innan** du hann
svara cuet — t.ex. **1♥–(1♠)–P–(2♥\*)–3♥** där 2♥\* är advancerns spaderhöjning — får
du **aldrig passa** och lämna given: cue-höjningen har redan lovat fiten.

| Överklivarens bud över deras konkurrens | Betydelse |
|---|---|
| **utgång** i din färg (t.ex. 4♠) | extra: **egen 6+ svit** eller **14+ hp** – sätt utgång i stället för att sälja |
| **billigaste egna färg** (t.ex. 3♠) | minimuminkliv – tävla upp till fiten (ej krav), aldrig sälj ut under den |
| Pass | bara om din färg redan pressats till 4-läget utan utgångsvärden |

**Höjning mot en partner som just PASSAT (fel färg-spåret fix 6):** har partnern
senast **passat** i en störd auktion har hen visat minimum utan utgångsintresse.
Alla höjningar av partnerns färg är då bara **tävlande** — billigaste nivån,
aldrig invit-hopp eller utgångsblås, och aldrig upp på utgångsnivå (förr blåste
en negativ-dubblare 5♣ på 13 stödpoäng fast öppnaren just passat — 2♣ tävlar
lagom och partnern får bjuda vidare med extra).

### 7.2 Tvåfärgsinkliv (Michaels + ovanlig 2NT)
Två sätt att visa **5-5** (eller bättre) direkt:
- **Michaels cue-bud** (cue av deras färg):
  - cue av deras **minor** (t.ex. (1♣)–2♣) = **båda högfärgerna**.
  - cue av deras **högfärg** (t.ex. (1♠)–2♠) = **andra högfärgen + en minor**.
- **Ovanlig 2NT** (hopp till 2NT) = de **två lägsta objudna färgerna**.

**Styrkezoner:** spela "två zoner" – antingen **svag** (spärr-aktig, ~6–11 hp)
eller **stark** (utgångsvilja), undvik mellanläget.

**Advancer (ägarbeslut 2026-07-01):** ger **preferens till den av partnerns visade
färger hon själv är längst i** (lika längd → högfärgen). I en **ostörd** budgivning
får hon **aldrig passa** – hon måste ta ut tvåfärgshanden. Är motståndarna inne
finns **spelrum för pass**, och partnern kan bjuda igen för att visa sin
**ospecificerade** färg (t.ex. Michaels över deras högfärg, där ena färgen är en
okänd minor – utan högfärgsfit bjuder advancern då ostört 3♣ pass-eller-rätta).

### 7.3 Takeout Double
Upplysningsdubbling (takeout) – vår viktigaste dubbling. Den ber partnern **bjuda
sin bästa objudna färg**; den är alltså en *upplysning*, inte ett straff. Kraven
ändras med hur många färger motståndarna redan har bjudit.

**Efter en bjuden färg (deras öppning, t.ex. (1♣)):**
- Kort i deras färg (**max 2**), **3+ kort i var och en av de tre objudna
  färgerna**, från **10 hp**.
- Har du en egen bra **5-korts färg** inkliver du hellre naturligt – då är det
  inget takeout-läge. Jämna händer utan korthet i deras färg dubblar aldrig.

**Den starka handen (17+ hp) – dubbla först, visa färgen sedan:**
- En hand med **17+ hp** är **för stark för ett enkelt inkliv**: partnern kan
  passa inklivet, och en kall utgång missas. Därför **dubblar** den först
  (upplysning, **oavsett fördelning**) och **bjuder sedan sin egen färg** på nästa
  varv. Själva ordningen – dubbla först och färga sedan – visar redan en **stark
  enfärgshand** som partnern inte får passa; man behöver **inget hopp** för att
  visa styrkan. *Ex:* (1♣)–X–(P)–1♥–(P)–**1♠**.

*Fortsättningen – vi tar det långsamt (partnerns svar var framtvingat, kan vara
0 hp):*
- **Partnern (advancern) måste svara** på den starka handens färg – ett tvunget
  bud som **lovar inga poäng**:
  - Med **3-korts stöd** i färgen: **enkel höjning** (0–3 hp) · **hopphöjning**
    (4–6 hp, inbjudan) · **utgång** (7–9 hp) · **cue i deras färg** (10+ hp,
    utgång + slamintresse).
  - **Utan stöd:** bjud om **egen färg** (5+ lång), annars **näst längsta objudna
    färg**.
- **Den starka handen dömer sedan** (efter ett svar utan stöd): med **5-korts
  färg**, eller 6+ men **under 22 totalpoäng (TP)**, bjuder den om färgen **lägst**
  (delkontrakt – aldrig utgång mot en tom partner). Med **6+ korts färg och 22+
  TP** **hoppar** den till **3-läget = utgångskrav**.
- **Partnern på 3-hoppet:** **utgång i färgen** med 1–2 korts stöd, annars **3NT**
  (nekar helt stöd).
- **Fri-bud-regeln:** ett *tvunget* bud lovar inget, men bjuder partnern **frivilligt
  igen** (nästa varv, eller trots att motståndarna stör) visar det **värden**.

**Efter två bjudna färger (öppning + svar, t.ex. (1♦)–(P)–(1♥)):**
- När motståndarna redan bjudit **två** färger lovar X **4-4 i de två objudna
  färgerna** (här ♠ + ♣), från **10 hp**. Partnern har bara två färger att välja
  mellan, så **exakt 4-4** krävs (en 5-korts objuden färg inkliver du hellre).
- **Den starka enfärgshanden dubblar även här (F6, 2026-08-08):** med **17+ hp
  och en egen 5+ objuden färg** är ett inkliv som kan passas ut för riskabelt –
  **dubbla först och visa färgen på nästa varv**, precis som över enbart
  öppningen. Fortsättningen är densamma som ovan (tvunget svar, det starka
  återbudet, stödstegen). *Ex:* (1♦)–(P)–(1♥)–**X**, sedan **2♠** över partnerns
  framtvingade 2♣.
- Advancern svarar **aldrig i en av deras bjudna färger**.

**Mot deras svaga tvåor och spärrar (samma verktyg, starkare krav):**
- Aktionen är farligare på högre nivå, så golvet är högre. **Mot en svag tvåa:**
  **12 hp** (ej sårbar) / **13 hp** (sårbar) direkt, **10 hp** i balansering.
  **Mot en spärr** på 3-läget eller högre: **14+ hp**. Formen är densamma – kort i
  deras färg, stöd i de objudna.
- **I balansering mot en svag tvåa (fel färg-spåret fix 5a)** får X:et dessutom
  vara *offshape* med **upp till 3 kort i deras färg** (i direkt sits max 2) –
  i utpassningsläget är ett X med tre hackor i deras färg standard. HP-golvet
  10 står kvar.

**Advancerns svar (partnern som blivit dubblad *till*):**
- Passar **aldrig** dubblingen. Bjuder sin **längsta objudna färg**, billigast; vid
  lika längd väljs högfärgen / den högre färgen.
- Med egen styrka **hoppar** hon i sin färg (inbjudande+) eller **cue-budar** deras
  färg (utgångskrav, frågar efter partnerns bästa färg).
- **Dubblarens svar på cuet (etapp 6, 2026-07-27):** cuet jagar i första hand
  högfärgsfiten — dubblaren visar sin **billigaste 4-korts högfärg först**
  (felrapport #11); utan 4-korts högfärg bjuds **3NT med stopp** i deras färg,
  annars längsta objudna färg billigast. Cuet får **aldrig** passas — inte ens
  när motståndarna straffdubblar det.
- **Cue-svarets färg lovar exakt FYRA (speldiagnosen S0, 2026-08-12):** färgen
  dubblaren visar som svar på cuet är ett *fyrkorts*-besked, och att den sedan
  **bjuds om** (t.ex. tvingad vidare av ett poänglöst mellansvar) gör den
  **inte** längre. Cue-advancern höjer den därför aldrig till utgång på
  dubbelton — en känd 4-2-"fit" är ingen fit (frö 20260772: 4♥ på A9 mot
  visade fyra gick sex bet när 3NT stod jämnt hem).
- **Cue-advancerns dom när dubblarens andra återbud är lågt (samma fix):**
  advancern har redan visat sina värden med cuet och får varken höja regellöst
  eller passa bort utgången. Med **3-korts stöd** sätts utgången i dubblarens
  färg; utan fit men med **12+ hp och stopp i deras färg(er)** bjuds **3NT**;
  först därefter får budgivningen dö i delkontraktet.

**När motståndarna bjuder ÖVER dubblingen (etapp 6 i mätspåret, 2026-07-27):**
Höjer öppnarens sida — (1♣)–X–(2♣) — är advancern inte längre *tvungen* att
svara, men upplysningen gäller: partnern har visat 10+ med form. Advancern
talar **fritt efter värden och form**:
- **12+:** **3NT** med stopp i deras färg(er), annars **cue** (utgångskrav).
- **9–11:** **hoppbud** i egen 5+ färg (inbjudan), annars **2NT** med stopp.
- **6–8:** **billigaste bud** i egen 5+ färg på 2-läget.
- **Extrem form** (6+ färg eller 5-5) får bjuda billigast **oavsett poäng** —
  partnern lovade ju stöd för de objudna färgerna.
- Efter deras **redubbling (XX)** gäller tvånget igen: advancern **flyr alltid**
  till sin bästa färg (att sitta kvar i deras redubblade kontrakt är aldrig
  planen).
**Dubblarens höjning av svaret** skalar efter vad svaret visade: partnerns
**hopp (9–11)** accepteras till högfärgsutgång med **15+ stödpoäng**; det **fria
icke-hoppet (~6–9)** höjs till utgång först med **19+** (högfärg) / 21+
(lågfärg) och får en **enkel höjning (inbjudan)** med 16–18; **flykten över XX
höjs aldrig** (den lovar inga poäng). Med 17+ hp gäller som förut den starka
dubblarens eget flöde (X + egen färg).

### 7.4 Övriga dubblingar (negativ, responsiv, stöd)
- **Negativ dubbling** (när *vi* öppnat och de klivit in): svararens dubbling =
  upplysning, visar typiskt de objudna färgerna (särskilt objudna högfärger),
  ~6+ hp. *Ex:* 1♦–(1♠)–X = 4+ ♥. **Exakt fyra, inte fem (felrapport #55):**
  kan den objudna högfärgen bjudas på **1-läget** visar X:et exakt 4 kort — med
  **5+ bjuder svararen färgen** (t.ex. 1♦–(1♥)–**1♠** = 5+ ♠, fritt bud och
  rondkrav, 6+ hp). Måste färgen upp på **2-läget** bjuds den med 5+ bara från
  **10 hp** (fritt 2-över-1, §5.5); svagare händer dubblar och visar färgen
  senare. 5-4 i **båda** högfärgerna mot ett 2-lägesinkliv dubblar fortfarande
  (X:et hittar 4-4-fiten). Klev de in i en **lågfärg** så att **båda**
  högfärgerna är objudna (t.ex. 1♣–(2♦)–X), visar X:et **båda** högfärgerna,
  minst 4-4 — förklaringen nämner då bägge (felrapport #45). Öppnaren svarar som
  på en upplysningsdubbling.
  **Öppnarens sang-svar (fel färg-spåret fix 4):** sang på **1-läget** (1NT) går
  bra på minimum med stopp, men på **2-läget+** kräver sangen **extra (~15+)** —
  en minimiöppnare visar hellre (utan nivåhöjning, i ordning) en **annan objuden
  4+ färg**, sedan sitt **5-korts återbud** (t.ex. 1♦–(2♣)–X–P–**2♦**), och tar
  sang-med-stopp först som sista utväg. **Höjningsregeln för dubblaren:** ett
  billigt tvingat ombud i en icke-1M-färg lovar bara 5 kort → ingen
  dubbelton-höjning alls; visade ombudet 6+ (fick gå upp en nivå) eller lovade
  1♥/1♠-öppningen redan 5+ får dubbelton höjas — men bara med
  **utgångsvärden** (13+ stödpoäng). En enkel/inbjudande höjning på dubbelton
  pressar bara upp partnerns minimum.
  **Dubblarens svaga preferens (pliktsvepet K2, 2026-09-02):** landar öppnarens
  tvingade svar i en färg dubblaren stöder **sämre än öppningsfärgen** ger
  dubblaren preferens även med bara **6–9 hp** — samma kriterier som advancerns
  preferens (§7.1): kostar den ingen nivå räcker lika lång eller längre
  öppningsfärg (minst 3 kort), kostar den en nivå krävs 2+ korts skillnad,
  aldrig förbi utgång. *1♦–(1♠)–X–P–2♣–P–**2♦** med ♦K752 ♣73 (förr pass).*
  **Dubblarens invit-fortsättning (fel färg-spåret fix 5b):** öppnarens svar är
  *tvingat* och kan vara ett nödrebud — men dubblaren i **invitzonen (~9–12 hp)**
  passar det inte längre. I ordning: **invit-preferens** med 3-korts stöd för
  partnerns *öppnade* färg (från 11 hp ett steg upp, t.ex. 3♥), **egen 5+ färg
  billigast** (en 6-korts räcker redan från 9 hp), eller **2NT** med jämn hand
  och stopp i deras färg. Har dubblaren i stället **fit för den svarade färgen**
  höjer hen som vanligt (höjningsreglerna ovan går före). **X + egen färg är
  EJ krav** (det är svagare än att bjuda färgen direkt) — öppnaren får passa
  på minimum och höjer/accepterar bara med extra. Under 9 hp: pass som förr;
  13+ bjuder krav-artat som förr.
- **Responsiv dubbling:** när de bjudit *och höjt* en färg (t.ex.
  (1♥)–X–(2♥)–X) = vår dubbling är upplysning, oftast de två objudna färgerna.
- **Stöddubbling:** efter 1m–(P)–1M–(inkliv) visar öppnarens **dubbling exakt
  3-korts stöd** i partnerns högfärg (direkt höjning = 4 stöd). Ger exakt
  längdinfo i konkurrens.
  **Svararens svar (etapp 6 i mätspåret, 2026-07-27):** dubblingen är en
  upplysning och får **aldrig passas bort** — pass är tillåtet bara som
  **medvetet straffpass** (högst 12 hp och straffdubblingskraven i deras färg:
  2+ säkra trumfstick). Annars bjuder svararen naturligt efter styrka:
  - **Utgångsvärden (13+, stödpoäng med 5+ trumf):** **4M** med femkorts
    högfärg (5-3-fiten är känd); **3NT** med stopp i deras färg och minst
    dubbelton i öppnarens färg; annars **4M på 4-3-fiten** (kort sidofärg ger
    stölder på den korta handen).
  - **Inbjudande (10–12):** **3M** med femkorts högfärg; egen **6+ sidofärg**
    billigast (naturligt); **invithöjning 3 i öppnarens färg** med stöd
    (4+ kort, eller 3 med honnör); **2NT** med stopp i deras färg.
  - **Minimum:** **2M** med femkorts högfärg, annars **billig preferens** till
    öppnarens färg, sista utväg 2M på 4-3-fiten.
  **Öppnarens fortsättning:** svararens 2-lägessvar och preferenser är minimum
  och får passas; **2NT/3M/invithöjning accepteras med 15+** (Bergenpoäng när
  fit finns — jämn hand med stopp väljer 3NT framför 5m). Svararens **nya färg
  är ett fritt bud i konkurrens = rondkrav** (§5.5) och passas aldrig: med
  3-korts stöd (färgen lovar 6+) höjs den — till utgång med 15+ — och utan stöd
  bjuds sang med stopp, egen 6+ färg eller preferens till svararens högfärg.
  Svararens **utgångsbud står alltid**.

### 7.5 Lebensohl efter vårt 1NT
När partnern öppnat 1NT (15–17) och **högerhand kliver in naturligt** på 2-läget
(t.ex. 2♠ = spader) skiljer svararen svaga tävlingshänder från utgångsvilliga med
**2NT-reläet**.

Motståndaren klivar in naturligt med en **stark enfärgshand** (6+ kort, 11–15 hp).
Svagare och tvåfärgade händer stör i stället med **DONT** (§7.6) — och samma
uppdelning gäller vårt eget försvar mot deras 1NT: en stark enfärgshand bjuds
naturligt, resten med DONT.

**Svararens svar:**
- **Pass** — svag hand utan egen färg: vi försvarar deras inkliv (lagligt, det är
  motpartens bud).
- **Naturligt 2-läge** (t.ex. 2♠ över deras 2♥) — svag hand med en högre högfärg
  som ryms på 2-läget; vi tävlar om delkontraktet.
- **2NT = relä** — svag hand vars färg kräver 3-läget. Reläet tvingar öppnaren att
  bjuda **3♣**; sedan **passar** vi (om färgen är klöver) eller **rättar** till vår
  färg på 3-läget, och öppnaren lägger upp. Så stannar vi lågt utan att lova värden.
- **Direkt bud på 3-läget** (utan att gå via 2NT) — **utgångskrav** med egen 5+ färg.
- **Direkt 3NT** — jämn utgångshand; öppnaren har 15–17 med stopp i deras färg.

**Öppnaren** bjuder tvunget **3♣** över reläet, och höjer partnerns direkta
3-lägeskrav till utgång (fyra i högfärgen med stöd, annars 3NT).

> Detta är **kärnan** (första steget). Finare behandlingar planeras och spelas
> ännu **inte**: upplysningsdubbling (takeout) i läget, "slow shows" för stopp i
> jämna händer, cue-bud som Stayman efter en fyrkorts högfärg, och Lebensohl mot
> *konstgjorda* inkliv (DONT/Landy). Räkna alltså bara med kärnan ovan vid bordet.

### 7.6 Mot motståndarnas 1NT — DONT
DONT (Disturb Opponents' NoTrump): visa alla en- och tvåfärgshänder på 2-läget
och kunna stanna lågt. **Undantag (§7.5):** en **stark enfärgshand** (6+ kort,
11–15 hp) klivar in **naturligt** i stället för via DONT-X. DONT hanterar alltså
tvåfärgshänder och svagare enfärgshänder; den starka enfärgshanden bjuder sin färg.

| Bud | Betydelse |
|---|---|
| X | enfärgshand (oftast 6+); relä till 2♣ |
| 2♣ | ♣ + en högre färg (5-4+) |
| 2♦ | ♦ + en högre färg (5-4+) |
| 2♥ | ♥ + ♠ (5-4+) |
| 2♠ | enbart ♠ (6+), svagare än X följt av 2♠ |

**Advancer:** efter X bjuds 2♣ som pass-eller-rätta; efter ett tvåfärgsbud passar
man med stöd, annars frågar/rättar nästa steg. Lätta, formstarka händer tillåtna
– ännu lättare i återbudsläge (balansering).

### 7.7 Mot konventionella och svaga öppningar
> **Takeout-dubblingen** mot deras svaga tvåor och spärrar beskrivs i sin helhet i
> §7.3 (Takeout Double) – här listas bara de övriga verktygen.
- **Mot stark 1♣ (Mathe):** X = **båda högfärgerna**, 1NT = **båda minorerna**,
  färgbud naturliga.
- **Mot svaga tvåor:** efter partnerns takeout svarar advancern nivåmedvetet
  (§7.3) — Lebensohl i det läget är en planerad förfining, ännu ej byggd; 2NT-inkliv
  = 15–18 balanserad med stopp; cue-bud = stark/Michaels-aktig (5-5 i två
  sidofärger, 15+, krav). **Advancerns svar på cuet (fel färg-spåret fix 4):**
  preferens till längsta sidofärgen, men **lika långa färger avgörs av
  billigaste nivån** — med 3-3 väljs färgen som kan bjudas en nivå lägre (t.ex.
  3♥ före 4♣ efter (2♦)–3♦), aldrig en onödig nivåhöjning på hackor.
- **Balansering mot svaga tvåor (fel färg-spåret fix 5a):** passas den svaga
  tvåan runt till utpassningsläget (t.ex. 2♥–P–P–?) gäller **"låna en kung"**
  (§7.1) även här — förr fanns bara takeout-X:et där och 2♥–P–P–P såldes:
  | Aktion | Direkt sits | Balansering |
  |---|---|---|
  | Naturligt inkliv (5+ färg) som ryms på **2-läget** | 10 hp | **7 hp** |
  | Naturligt inkliv som kräver **3-läget** | 10 hp | 10 hp |
  | Upplysnings-X | 12/13 hp, max 2 kort i deras färg | **10 hp, max 3 kort** (offshape ok) |
  | 2NT (jämn med stopp) | 15–18 | **12–15** |
  **Advancer-rabatten:** den som svarar på ett *balansinkliv* över deras svaga
  tvåa vet att kungen redan är lånad → höjningar räknar **stödpoäng −3** och
  kapas vid **3-läget** utan äkta utgångsvärden efter rabatten (annars värderas
  samma kung två gånger och 2♠-balanseringen blåses till 4♠ bet). *Sedan F3
  (2026-08-07) är rabatten GENERELL — den gäller alla balanserade öppningar,
  även 1-läget, och även svaret på partnerns balanserings-X. Hela regeln: §7.1.*
- **Taket — starka händer mot svaga tvåor (etapp 6 i mätspåret, 2026-07-27):**
  fönstren ovan hade inget utlopp uppåt — en balanserad 21-poängare *passade ut*
  2♦. Nu gäller: **3NT = till spel** med stopp i deras färg och antingen
  **balanserad över 2NT-fönstret** (19+ direkt / **16+ i balansering**, lånad
  kung) eller en **stark 6+ lågfärg** (minst två av E-K-D = spelkälla) från
  **15 hp**. Kan handen i stället dubbla (kort i deras färg) väljs **X:et före
  3NT** även med 19+ — dubblingen är flexiblare och den starka handen beskriver
  sig på nästa varv. Och en hand med **17+** som inte ryms i något fönster
  **säljer aldrig given**: den dubblar (upplysning) hellre än passar.
- **Mot Multi 2♦** (svag tvåa i okänd högfärg): 2NT = 15–18 balanserad; 2♥/2♠ =
  naturligt inkliv. (Takeout-dubblingen: §7.3.)
- **Mot spärrar (3-läget+):** 3NT = till spel (stopp + stick, balanserad 16+);
  färgbud naturliga (**13–16** — starkare händer dubblar först och visar färgen
  sedan); en hand med **17+** som inte ryms i något fönster **säljer aldrig
  given** — den dubblar (upplysning), precis som mot svaga tvåor.
  (Takeout-dubblingen, 14+: §7.3.)
- **Mot deras höjda spärr (etapp 6 hål 4, 2026-07-28):** spärrfönstren gäller
  även när motståndarna hunnit bjuda **öppning + spärrhöjning i samma färg till
  3-läget** — `2♠–P–3♠–?` eller `1♣–P–3♣–?`. Förr fanns här ingen väg in alls
  (en 21-poängare passade ut `2♦–P–3♦`); nu väcker försvaret både **direkt
  över höjningen** och **i balansering** när höjningen passas ut. Två saker
  skiljer mot en ren spärröppning:
  - **3NT till spel kräver mer** — de har visat öppning + fit, så golvet är
    **19 direkt / 16 i balansering** (samma som mot en svag tvåa). Under det
    är X:et bättre: 16 balanserad med Kx-håll dubblar i stället för att stå
    i ett tunt 3NT.
  - **Balanseringen lånar en kung på X och färg:** X från **11 hp** (max 3
    kort i deras färg, offshape ok), naturligt inkliv från **10**. Lånet
    gäller **bara 3-läget** — mot deras 4-lägesöppningar står de fulla golven
    kvar (en lånad kung på 4-läget köpte bara dyra uppoffringar).
  Tvingas partnern svara på dubblingen på **3-läget eller högre** väljs på lika
  färglängd den **honnörsstarkare** färgen (A832 före J982) — på 1–2-läget
  gäller som förr högfärg först. Höjningar *förbi* 3-läget (t.ex. `2♠–P–4♠`)
  lämnas medvetet tysta — att väcka på 4-läget lovar mer än fönstren har.

### 7.8 När motståndarna stör vår egen öppning
Konkurrensen går åt båda håll: bjuder *vi* konstgjort/spärrartat och en
motståndare stör, svarar partnern med ett riktigt beslut i stället för att passa.

**(a) De stör vårt 1NT med DONT** (deras X-relä eller ett 2-lägesbud):
- **X / XX = straff/värden** (8+ hp utan egen långfärg). Vi äger ofta handen mitt
  emot 15–17, så vi dubblar dem hellre än flyr. Deras X-relä bemöts med **XX**, ett
  färgbud med **X**.
- **Egen 5+ färg = naturligt "to play"** (konkurrerar). Ett 3-lägesbud kräver 6+ kort.
- Annars **pass**.
- **Öppnarens fortsättning efter partnerns värde-X (2NT-relä, felrapport #43).**
  Värde-X:et har en bred range (8+), så öppnaren kan inte blint bjuda utgång
  (15+8 = 23 räcker inte). Mot ett **DONT-tvåfärgsinkliv** (konstgjort, som de flyr
  ifrån) säljer öppnaren inte given med pass utan **beskriver**: en **5-korts färg**
  visas (naturligt), annars **2NT** (förnekar 5-kort). Svararen **placerar**:
  **pass med 8–10**, **3NT med 11+** (över en visad färg: höj med fit, annars 3NT/pass).
  Så når paret utgången när svararen låg i toppen av sitt X. Mot ett **naturligt**
  inkliv står i stället försvaret/passen kvar (felrapport #39: 2♥X är rätt straff,
  3NT går bet) – reläet firar bara mot DONT.

**(b) De stör vår svaga tvåa / spärr** (takeout-X eller ett inkliv):
- Deras **upplysningsdubbling → XX = värden/straffintresse** (10+ hp).
- Annars **fortsatt spärr**: höj vår färg ett steg med fit (svag tvåa kräver
  3-korts stöd, en spärr räcker med 2) – lagen om totala stick.
- Annars **pass**.

**(c) Straffdubbla deras flykt efter vår XX.** Öppnar vi 1NT, de stör med DONT och
partnern **redubblar** (XX = *vi äger handen*), så **straffdubblar** vår sida varje
flyktbud när de smiter undan till en färg – steg för steg, tills de får spela
dubblat. Gäller **bara** efter vårt 1NT + XX (där vi bevisligen äger handen), inte
efter våra svaga tvåor/spärrar.

**(e) De kliver in 1NT eller med ett tvåfärgsinkliv över vår 1♥/1♠ (pliktsvepet
K3, ägarbeslut 2026-09-02).** Förr hade svararen inget svar alls här och passade
med 4–5 trumf (`1♠–(2NT)–P` på ♠K9874 och 17 stödpoäng).

| Läge | Svararens bud | Betydelse |
|---|---|---|
| **1M–(1NT)** | **X** | **10+ hp** = straff — vi har balansen mot deras 15–18 |
| | **2M** | 3+ stöd, **6–9 hp** — konkurrenshöjning |
| | pass | annars |
| **1M–(2NT / Michaels-cue)** | **4M** | 4+ stöd och **10+ stödpoäng** — direkt utgång |
| | **3M** | 4+ stöd (9 trumf), svagare — **tävlande** höjning, inte spärr; eller 3-korts stöd med 10+ |
| | pass | annars |

Motståndarna har visat 5-5, så lagen om totala stick bär 3M med nio trumf
oavsett poäng. Bara efter en högfärgsöppning; efter 1♣/1♦ gäller de gamla
reglerna. "Unusual vs unusual" (cue i deras färger som limithöjning+) spelas
inte.

**(d) De dubblar vår 1♥/1♠-öppning — Jordan 2NT och fortsättningen.**
Efter **1M–(X)** är svararens **2NT Jordan/Truscott**: konstgjord
**limithöjning eller bättre** (10+, 4+ trumf) — hopphöjningen direkt till 3M
blir därmed ren spärr. Källa: bridgebum (jordan_2nt.php).

**Öppnaren passar aldrig Jordan** (den visar tvåsidig styrka och väntar på
besked). Fortsättningen (2026-08-07, "bara 3M/4M" — inget ny färg-utgångsförsök
i nuläget): öppnaren räknar **stödpoäng** mot den kända 9-korts fiten,

| Öppnarens återbud | Betydelse |
|---|---|
| 3M | minimum (≤14 stödpoäng) – avslut mot limitdelen |
| 4M | utgångsvärden (15+ stödpoäng) |

**Jordan-bjudaren efter öppnarens 3M-avslut:** med ren limithöjning (10–12)
**passar** hen; med **13+ stödpoäng** (utgångsstyrka — "eller bättre"-delen)
**höjer hen till 4M** — avslutet får aldrig dö med utgång på handen. Bjuder
advancern vidare över 2NT gäller det vanliga konkurrensomdömet i stället.

*Bakgrund (systemfel #4, frö 20260739): S öppnade 1♥ med ♠A73 ♥KQ542 ♦J72 ♣A7
(14 hp = 15 stödpoäng), W dubblade, N bjöd Jordan 2NT med 14 hp — och S passade.
2NT spelades med 9-korts hjärterfit och 28 hp ihop.*

## 8. Markeringar & utspel
> Försvarsspelets signaler. Vi spelar räkningstunga, lågtvetydiga metoder som
> passar 2/1:s precisionsfilosofi.

### 8.1 Signaler — omvänd markering (UDCA)
Vi spelar **omvänd markering** (upside-down) för **både attityd och räkning**,
de första ~2 sticken i en färg:

- **Attityd** (på utspelsfärg / partnerns färg): **lågt kort = uppmuntrar**
  (jag gillar färgen), **högt kort = avskräcker**. (Tvärtom mot "standard".)
- **Räkning:** **lågt-högt = jämnt** antal, **högt-lågt = udda**. (Omvänt.)

Efter att attityd/räkning är visad övergår korten till **färgpreferens**
(Lavinthal, §8.2).

### 8.2 Sak (avslag) — Lavinthal
När du inte kan följa färg och **sakar**, visar **första saket färgpreferens**
genom kortets storlek (i en färg du inte vill ha):
- **högt kort = jag vill ha den högre** av de övriga färgerna,
- **lågt kort = den lägre** färgen.

### 8.3 Utspel
**Spotkort (3:e/5:e bästa)** – mot både färg och NT:
- **3:e bästa** från en **jämn** längd (t.ex. 3:e kortet från 4-korts färg),
- **5:e bästa (lägsta)** från en **udda** längd (5-korts färg).

Det avslöjar längd/räkning direkt för partnern.

**Honnörsutspel (standard – högsta i sekvensen):**
| Innehav | Spela ut |
|---|---|
| A-K-x(+) | **A** |
| K-D-x(+) | **K** |
| D-kn-x(+) | **D** |
| kn-T-x(+) | **kn** |
| A-K (dubbelton) | **A**, sedan K |

**Inre/brutna sekvenser** (en hög honnör med ett glapp ner till en sammanhängande
löpa) – led toppen av den **inre** löpan, inte den höga honnören:
| Innehav | Spela ut |
|---|---|
| K-kn-T(-x) | **kn** |
| K-T-9(-x) | **T** |
| D-T-9(-x) | **T** |
| A-kn-T(-x) | **kn** (mot NT; mot färg leds esset – underled aldrig ess) |
| A-D-kn(-T) | **D** (mot NT; mot färg esset) |

- **Entydig topp:** esset leds från A-K (top of sequence), så **A = A-K** och
  **K = K-D** – ingen tvetydighet på toppen.
- Mot **NT** spelas samma honnörstoppar; man väljer oftast sin **längsta/bästa**
  färg och utspelet är 3:e/5:e som ovan.

> **Notis:** vi leder *top of sequence* – ess från A-K. Rusinow (näst högsta)
> finns kvar som möjlig framtida variant (se §8.4).

**Underled aldrig ett ess mot ett trumfkontrakt.** Mot färgkontrakt (extra dyrt
mot slam – spelförarens singel-kung blir gratis och esset dör oanvänt) väljer
botten på utspelet den **längsta färg som inte kräver ett ess-underspel** i
stället för att leda lågt under esset i sin längsta färg. Har varje färg ett
oskyddat ess **cashar** den esset i längsta färgen. Mot **NT** gäller klassisk
längsta-färg-doktrin oförändrat (ess-underspel/4:e bästa är då normalt). **Samma
ess-regel gäller även när boten kommer in mitt i given** och leder ur längsta
färgen (inte bara på själva utspelet).

**Mot NT väljs "längst OCH starkast".** Längden är primär (sang är ett lopp att
etablera en lång färg); vid lika längd väljs störst honnörsstyrka, och vid lika
styrka en **högfärg** (motståndarna stannar oftare för att kolla högfärgerna).

**Budgivningen styr utspelet.** När boten leder ut mot ett kontrakt som budats
(motspelaren, trick 1) väger den in auktionen — i prioritet:
1. **Partnerns bjudna färg** leds gärna ("kan vara fel men är sällan fel").
2. Mot **NT**: längsta/starkaste färgen som motståndarna **inte** bjudit.
3. Mot **trumfkontrakt** leds **passivt**: boten undviker att leda *bort från* en
   honnörsgaffel (tenass som K-kn-x-x-x, A-D-x-x-x) eller in i motståndarnas
   färger. Har den korta trumf och en **singel** leds singeln för en **ruff**;
   bjöd motståndarna 3+ färger (korsruff-läge) leds **trumf**; annars den säkraste
   objudna färgen. Trumfutspel: två/fyra små → lägsta, tre små → mitten.
   **Cue-bud räknas inte som bjudna färger** (2026-08-12): ett kontrollbud visar
   ess/renons, ingen längd — det hörs i budförklaringen och varken triggar
   korsruff-regeln eller "undvik deras färg".

Detta är den doktrin som ligger bakom att t.ex. ♠K-kn-8-4-3 leds passivt undan mot
4♥ (led inte bort från gaffeln) men attackeras som längsta färg mot 3NT. Full
källförankrad teori: `docs/utspel-teori.md`.

### 8.4 Vad vi (medvetet) inte spelar
- **Smith Echo** – nej; vi använder vanlig (omvänd) attityd på utspelsfärgen i
  sangförsvar.
- **Rusinow honnörsutspel** – inte ännu (se §8.3); möjlig framtida uppgradering.

### 8.5 Hur bottarna lägger markeringar (2026-07-29)
Bottarna (motspelarna) lägger nu §8-markeringarna i spelet, inte bara i teorin.
Reglerna för *vilket* kort de väljer:

- **Attityd** (jag följer partnerns färg utan att vinna): jag **uppmuntrar**
  (lägger lågt) om jag har **dam eller högre** i färgen **och/eller** – i ett
  trumfkontrakt – en **kort färg** (dubbel-/singelton att snart trumfa). Endera
  räcker. Annars **avskräcker** jag (lägger högt).
- **Räkning** (jag följer motståndarens färg utan att vinna): **jämnt** antal =
  lågt kort (lågt-högt), **udda** antal = högt kort (högt-lågt).
- **Lavinthal** (jag sakar första gången): honnörsvakten väljer en **säker** färg
  att saka ur, och kortets storlek pekar mot den färg jag vill att partnern
  spelar – **högt** = den högre av de andra färgerna, **lågt** = den lägre.

**Gardregeln (viktig, ägarbeslut):** en markering får aldrig vara en grov
blunder. Därför behåller boten sina **två högsta kort** i en färg (3+ kort) som
gardar och markerar bland resten – att markera med ett toppkort kan annars blotta
en stoppare eller ett längdstick. En markering läser bara den egna handen (aldrig
partnerns dolda kort), så den kan i sällsynta fall ändå kosta ett stick när
partnerns kort gör spotkortet värdefullt; det är ärlig bridge och vinner in sig
när partnern *läser* markeringen. I korta färger där varje kort behövs lägger
boten hellre lågt utan markering. Bottarna på **spelförarsidan** markerar aldrig
(markeringar är försvarets språk).

**Bottarna LÄSER också markeringar (Steg 5).** Bot-hjärnan (Monte-Carlo) tolkar
det entydiga, säkra fallet: en **avskräckande** attityd på partnerns färg (ett
högt spotkort) betyder att markeraren saknar dam+ i färgen, så samplaren slutar
lägga dam/kung där. Bara bottarnas markeringar avkodas (aldrig människans, vars
metod vi inte känner). Uppmuntran (tvetydig: dam+ *eller* kort färg) och räkning
(paritet) avkodas inte ännu. Uppmätt spelstyrka (bot-mot-bot, 20 seedade givar):
avkodningen sänkte spelförarens stick netto (bättre försvar), inom bruset –
`play-quality.probe.test.ts` (gatad).

### 8.6 Motspelsteknik — tredje hand högt (2026-07-30, felrapport #34)
Klassisk försvarsdoktrin: **är jag tredje hand** (min partner ledde sticket) och
en motståndare vinner just nu, spelar jag en **honnör** för att pressa fram
spelförarens – aldrig ett lågt spotkort. Det billiga kortet skänker bort sticket:
den **dolda spelföraren** bakom mig går över det lika billigt (i felrapporten satt
Nord med ♥KJ1065, partnern ledde ♥3, träkarlen la ♥4 – Nord la ♥5 och Öst vann på
♥9 där en honnör hade tvingat fram Östs ess).

Kortvalet: **den LÄGSTA honnören (10+)** bland mina vinnande kort. Det tvingar
fram spelförarens honnör men slösar aldrig en högre än nödvändigt:
- **Sammanhängande topp** (K-D-kn) → lägsta av sekvensen (**kn**), sparar K och D.
- **Gaffel/tenass** (A-D-10 över spelförarens kn/K) → den **lägsta honnören (10)**,
  så esset ligger kvar ÖVER hans kung. Att spela esset "tredje hand högt" krossar
  det på partnerns låga utspel och gör spelförarens kung/knekt goda (uppmätt −1
  stick, seed 20260732).
- **Ensam honnör** bland hackor (K bland smått) → den (**K**), tvingar esset.
- **Bara hackor** (ingen honnör att promovera) → tredje-hand-högt hoppas över, den
  gamla regeln (billigaste vinnaren) står kvar.

Regeln gäller **bara mot den dolda spelföraren**. Ligger den öppna **träkarlen**
bakom mig sköts kortvalet av den vanliga regeln (billigaste vinnaren som bordet
inte går över, §ovan) – och kan bordets ess ta allt jag har är honnören ändå död,
så då sparar jag den och lägger lågt. I trumfkontrakt hoppar regeln över om en
kvarvarande motståndare visat renons i färgen (han kan ruffa – ett bortkastat
toppkort i en ruff är ingen vinst). Facit: `play-bot-third-hand.test.ts`
(DDS-låst: tredje hand lågt släpper spelföraren ett extra stick).

## 9. Ändringslogg
- **2026-09-06 — 4♦ naturligt efter 2♣–3♦–3M; kontrollbud i ny färg sätter
  öppnarens högfärg (§4.4; motorbytet §5b beslut 7, `docs/motorbyte-plan.md`).**
  Ägarbeslut 2026-09-05 på bok-mot-motor-fynd 7: samma auktionsform hade två
  betydelser (4♦ = cue i 3♠-fallet, naturlig rebud via kravsteget i
  3♥-fallet). Nu: svararens rebud i egen färg är **alltid naturlig** (6+, eller
  5 i obalanserad hand / bra 5 i annat än 5-3-3-2; förnekar 3-stöd);
  **3+ stöd + slamintresse → kontrollbud i NY färg på 4-läget** (4♣ över
  3♥/3♠, 4♥ över 3♠) som sätter öppnarens högfärg — ny färg på 3-läget är
  naturlig; **3+ stöd utan kontrollbud att visa → 4M direkt** (fast arrival;
  5M-inbjudan finns inte i det läget); 33+ → 4NT direkt. Utan stöd och rebud:
  ny färg under 3NT, annars 3NT (öppnaren rättar till 4M med 6+ i högfärgen —
  ny regel i raden tredje). Kod: `slamContextFor`/`responderSecondDecision`/
  `openerThirdDecision` (`auction-decide.ts`), `SlamContext.noCueIn` +
  cue-golvet 3NT (`slam-auction.ts`), betydelselagret `impliedCueTrump` (egen
  visad färg aldrig cue; kontrollbudet sätter trumfen "på riktigt" så
  öppnarens cue i svararens färg läses som cue), registret (`rules.ts`:
  '2♣: rebud egen färg (GF)', 'rättelse till högfärg'). Facit: blocket
  "§5b beslut 7" i `motorbyte-facit.test.ts` (frön 20271084, 20271411,
  20271242).
- **2026-09-06 — Fast arrival efter reverse i högfärg (§6.6, §5; motorbytet
  §5b beslut 3, `docs/motorbyte-plan.md`).** Ägarbeslut 2026-09-05 på
  bok-mot-motor-fynd 2. Förr höjdes reversens högfärg billigast oavsett
  styrka ("ej krav" i motorn, "krav" i boken) och kaptenen frågade 4NT /
  inbjöd 5M direkt över reversen. Nu: **3M = stark** (4+ stöd, 12+
  stödpoäng, slamintresse, utgångskrav) — öppnaren öppnar cue-ronden med
  billigaste kontrollbud under utgång, även i egen färg, annars 4M; kaptenen
  cue:ar tillbaka / 4NT med 33+ och kontrollerna räknade / 4M, och över
  öppnarens 4M-avslut 4NT med 33+, 5M med 31–32. **4M = svag** (4+ stöd,
  ingen slamambition). Lågfärgsreverse oförändrad. Kod: `fourthSuit`
  (`responder-rebids.ts`, 3M/4M), `responderSecondDecision` (ingen slamport
  direkt över högfärgsreversen), `slamSituation` prefix 4 + `SlamSetup.
  partnerStarts` (öppnaren öppnar cue-ronden: `partnerFirstStep`, `slamTurn`,
  `cuePhaseTurn`), betydelselagret `reverseMajorRaise` (3M/4M-läsning,
  utgångskrav, kontrollbud i egen färg), registret i `rules.ts`. Facit:
  `motorbyte-facit.test.ts` "§5b beslut 3" (nio fall). Auktionsdiffen
  (`$env:DUMP_RANGE='20270001-20273000'; npx vitest run
  src/lib/engine/auktionsdump.probe.test.ts` + `node scripts/auktionsdiff.mjs`
  mot baslinjen på `b86d004`): 1 ändrad, klass b — frö 20272351 (fynd 14:s
  nakna 4NT efter reverse) går nu 3♥ → 3♠ → 4♣ → 4♦ → 4NT → 6♥, samma slam
  med trumfen satt. Avvikelsedumpen: 1 ändrad, klass b — frö 20270106
  (människans 1♠, botens 3♥ passades förr av öppnaren med 28 hp ihop; nu
  cue 3♠ → 4♥). Revisorn (`$env:REVISOR='1'; npx vitest run
  src/lib/engine/revisor.probe.test.ts`): rätt kontrakt 20,2 % ·
  snittförlust 268,83 — identiskt med beslut 1. Ägaren bekräftade
  **4+ stöd** 2026-09-06 (beslutstexten sa 3+; reversens färg är 4 kort).
- **2026-09-05 — Slam efter 1NT-återbudet: Gerber bara för den jämna handen
  utan färg, färgen går via NMF (§5.7, §6.4; motorbytet §5b beslut 1,
  `docs/motorbyte-plan.md`).** Ägarbeslut på bok-mot-motor-fynd 6 + 15. Förr
  frågade svararen med egen 6+ högfärg eller 5+ i öppnarens lågfärg **Gerber 4♣
  och placerade 6 i färgen**, och inbjöd 5M/4♦ direkt över sangen. Nu: **(1)**
  färg att visa → **New Minor Forcing** (får också bjudas med 5+ i öppnarens
  lågfärg + 19+ hp), och efter öppnarens svar utan stöd **3M = 6+, slamintresse,
  utgångskrav** (öppnaren 4M; kaptenen 4NT RKC med 33+, 5M med 31–32) eller
  **3m = 5+ stöd, slamintresse** (öppnaren 3NT-förslag / 4m; cue-ronden §6.2);
  **(2)** jämn hand utan färg, 21+ → Gerber 4♣ → 6NT; **(3)** 19–20 →
  kvantitativ 4NT; **(4)** annars 3NT. Dessutom: 6+ egen högfärg med
  utgångsvärden efter NMF utan stöd → **4M** (förr 3NT). Kod:
  `newMinorForcingBid` (lågfärgsvägen), `responderPlaceAfterNMF` (4M),
  `responderThirdDecision` (3M/3m), `openerFourthDecision` (4M / 3NT / 4m),
  `slamSituation` prefix 7, `gerberTurn` utan färgplacering (`familyAFitTrump`
  borttagen); betydelselagret läser 3M/3m/4M/3NT/4m och 5M över 1NT-återbudet
  som "till spel". Facit: `motorbyte-facit.test.ts` "§5b beslut 1" (frö
  20270949: 2♦ NMF → 3♥ → 4♥ → 5♥; frö 20261109: 2♦ → 2♥ → 3♣ → 4♣ → cue 4♥ →
  5♣). Auktionsdiffen (`$env:DUMP_RANGE='20270001-20273000'; npx vitest run
  src/lib/engine/auktionsdump.probe.test.ts` + `node scripts/auktionsdiff.mjs`
  mot baslinjen på `81ca5eb`): 4 ändrade bud, alla klass b (frö 20270949 NMF-
  vägen till samma 6♥; fröna 20272165, 20272519, 20272533: 6-korts högfärg →
  4♠ i stället för 3NT). Revisorn (`$env:REVISOR='1'; npx vitest run
  src/lib/engine/revisor.probe.test.ts`, 1000 givar, frö 20260721): rätt
  kontrakt 20,2 % · snittförlust 268,83 (förr 20,3 % · 268,55) — två givar:
  frö 20260897 (4♥ i stället för 3NT) och frö 20261109 (5♣ efter cue-ronden i
  stället för 3NT: 6♣ satt, men Nord har blott minimum och säger av —
  systemriktig miss). Känt hål kvar (SENARE): en människas direkta 4♦/5M över
  1NT-återbudet har ingen regel längre (boten passar); 5-korts högfärg + 21 utan
  fit efter NMF placerar 3NT (ingen sangslam-fråga i det läget).
- **2026-09-05 — Manuset för ostörda auktioner rivet (motorbytet etapp 3 familj 6,
  `docs/motorbyte-plan.md`).** Ingen regeländring i sig: varje bud vår sida
  lägger i en ostörd auktion tas nu ur beslutstabellen (egen hand + auktionen)
  även när motorn budar hela given själv — de sista tvåhandsförarna (Gerber
  över 1NT/2NT, slamsekvenserna) är borta. Två läsregler skrevs in på vägen
  (§4.4 "Så läser ÖPPNAREN kaptenens slambud"): efter 2♣–positivt–3y är
  **4NT essfrågan i y** och ett **kontrollbud i ny färg sätter y** — förr fick
  bara manuset (som såg båda händerna) den sekvensen rätt, med människan i
  någon av stolarna passades nyckelkortssvaret eller kravet improviserades.
  Kaptenen som frågat 4NT vet dessutom alltid själv vilken trumf hon menade och
  placerar därefter, även när trumfen inte syns i auktionen (reverse, §5.7).
  **En regeländring (§5.7):** efter 1m–1M–1NT frågar kaptenen med en egen
  självbärande färg ess med **Gerber 4♣** och placerar 6 i färgen; **4NT direkt
  över sang-återbudet är alltid kvantitativt** (den jämna 19–20-handen). Förr
  var samma 4NT både kvantitativ inbjudan och RKC — bara manuset, som såg båda
  händerna, kunde hålla isär dem (bok-mot-motor-fynd 6). Öppnaren dömer nu
  4NT på sin hand (6NT med 13–14, pass med 12) och svarar ess på 4♣.
- **2026-09-05 — Slamutredningen per stol (§5.7, §6.1–6.5; motorbytet etapp 3
  familj 5, `docs/motorbyte-plan.md`).** Varje tur i en slamsekvens (cue-ronden,
  4NT, nyckelkortssvaret, placeringen, 5NT, stoppbudet och rättelsen,
  inbjudan och partnerns dom, Gerber, Exclusion, MSS) tas nu ur EGEN hand +
  auktionen även vid bordet — förr fanns fortsättningarna bara i motorns manus,
  så med människan i kaptenstolen passades nyckelkortssvaret och Gerber-svaret
  bort. Fyra regler skärptes på vägen: (1) efter New Minor Forcing med visat
  3-korts stöd går bara **13+ (utgångskrav)** in i cue-ronden — 11–12 var en
  inbjudan och placerar som förut; (2) **5m efter partnerns 4m är utgången**,
  ingen slaminbjudan (partnern kan inte skilja dem; 4NT är essfrågan); (3)
  **4♣ över 1NT-återbudet är Gerber** (§6.4) — familj A:s klöverinbjudan i §5.7
  finns inte (4♦ finns kvar); (4) **4♣ är inte Gerber när en färg redan är
  trumf** (1♣–2♣–2NT–4♣ är en klöverhöjning). Dessutom: öppnarens val efter
  Smolen ligger nu i linjen även efter en 2NT-öppning (förr passades 3M).
- **2026-09-05 — Slam efter 1NT-återbudet, obalanserad del (§5.2/§5.7; motorbytet
  etapp 3 familj 4a).** Kaptenen med säker fit (6+ egen högfärg / 5+ i
  öppnarens minor) räknar nu **hp** mot visade 12–14, inte stödpoäng: ingen fit
  är bjuden, så kortfärger får inte lyfta värderingen (15 hp med 6-korts spader
  → New Minor Forcing som förut, inte slaminbjudan; 10 hp 6-5 → ingen 5♠).
  Porten slog förr bara till när återbudet var ett "riktigt" 1NT (12–14);
  reservfallet "oklart" dolde den. Facit: frö 20261317 (`auction-oklart-
  aterbud.test.ts`, 2026-08-07: "ärligt mot visade intervall = 4♥"), frö
  20272122 i `motorbyte-facit.test.ts`. Dessutom: efter 1M–2x(2/1) och
  öppnarens HÖJNING av svararens högfärg under utgång sätter svararen utgång
  4M (felrapport #27, nu i beslutstabellen).
- **2026-09-05 — Öppnarens återbud efter svararens nya färg över svag tvåa/
  spärr (§4.5/§4.6; motorbytet etapp 3 familj 3).** Svararens nya färg kan
  ligga högre än billigaste nivån (t.ex. 2♦–3♥, 3♣–4♦): öppnarens återbud
  ligger nu alltid ÖVER svaret (rebjuden färg billigast över; feature på
  svarets nivå), och höjningen med stöd + maximum går till **utgången, aldrig
  förbi** (2♠–3♥ med max → 4♥, inte 5♥; §4.5 "hopp" = hopp till utgång).
  Efter 2♣ med svar på 3NT eller högre passar öppnaren utan egen 5-färg
  (utgången är satt). Facit: `responses-weak2.test.ts`,
  `responses-preempt.test.ts`, `responses-2c.test.ts`, frö 20271048 i
  `motorbyte-facit.test.ts`.
- **2026-09-04 — Betydelselagret (motorbytet etapp 1, `docs/motorbyte-plan.md`).**
  Inga bud ändrade. Förklaringen av ett bud läses nu ur `auction-meaning.ts`,
  som kan hela den ostörda strukturen i §4–§6 ur auktionen ensam (samma
  funktion för bot och människa). Tre rättelser som syns för användaren:
  kravnivån för **superaccept** (§4.3) var 'ej krav' i registret men är
  'inbjudan'; öppnarens hopp **1x–1NT–3m** var märkt 'rebid: egen färg' (ej
  krav) men är 'hopp i egen färg (inbjudan)' (§5.2); svararens **3♥ efter
  1NT–2♥–2♠** (5-5, §4.3) var märkt 'utgång' men är utgångskrav. Åtta ställen
  där motorn och boken säger olika saker är listade i motorbytesplanens logg
  och avgörs av ägaren när familjen flyttar (etapp 3).
- **2026-09-04 — Felrapporterna #59 + #60 (§5.1, §6.1).** **(#59, bricka 6)**
  1♠–P–1NT–P–2♣–P–**P** med ♠A ♥QJ943 ♦KJT852 ♣T. Boken sa redan att en ny
  färg av svararen efter 1NT lovar 5+ kort och förnekar stöd, men regeln
  saknades i koden: svararen föll till "inget bättre → pass" och paret spelade
  2♣ på 4-1. 1NT var systemriktigt (9 hp räcker inte till 2-över-1); felet var
  passet. Ny regel `ny färg efter 1NT` (`responder-rebids.ts`): egen 5+ färg
  som ryms på 2-läget bjuds naturligt, svagt, till spel — 6+ kort före en
  2-korts preferens, 5 kort efter. Öppnaren passar
  (`openerThirdBidAfterSemiForcing1NT`, `rebids.ts`), och kravminnet
  (`auctionForce`, `auction-live.ts`) läser inte längre budet som rondkrav
  (förr "tvingades" öppnaren till 2♠ på 5-1). Tolkningslagret: öppnarens 2♣
  efter 1♠–1NT lästes som *Stayman* (partnerns 1NT var ett svar, inte en
  öppning) — nu "återbud i ny färg, 3+, ej krav"; svararens 2♦ förklaras som
  egen färg till spel. **(#60, bricka 9)** 1♥–(3♦)–4♦–P–4♥–P–4NT–P–5♣–P–5♥–
  P–**P** med ♠AK ♥AK876 ♦64 ♣A762 (fyra nyckelkort). Rättelsen över
  stoppbudet fanns bara i den kanoniska linjen (`slam-auction.ts`); i
  budlådan saknades den. Ny detektor `rkcSignoffCorrection`
  (`auction-live.ts`, regel `RKC: rättelse`): efter eget 5♣/5♦-svar och
  partnerns 5-trumf lyfter handen med det höga antalet (4 resp. 3) till
  6-trumf. Tolkningslagret läser nu hela essfrågesekvensen (stegsvaret,
  stoppbudet, rättelsen, frågarens lillslam) i stället för "naturlig
  klöver"/"utgångshöjning". Facit: `responder-rebids.test.ts` (#59 + hela
  bricka 6), `auction-live.test.ts` (#60 + 0/3-varianten),
  `auction-interpret.test.ts` (båda), `rules.test.ts`.
- **2026-09-03 — Felrapport #58: 2-över-1-kravet syntes inte (§4.2, §5.3).**
  Bricka 4: 1♦–P–2♣ (Syd, människan) –P– 2NT (Nord). Motorns egen linje hade
  valt inverterad 2♦ för Syds hand, så 2♣ avvek från linjen och Nords återbud
  byggdes av det generella off-book-svaret som ett SVARAR-bud ("2 sang –
  balanserad 11–12 hp, inget stöd", utan regel); tolkningslagret läste Syds
  2♣ som "ny färg, krav 1 rond" och Nords 2NT som "18–19, inbjuder utgång".
  Ägaren: "2 klöver är 2 över 1, dvs game forcing — buden framåt måste
  indikera det." Tre lagningar: **(a)** budlådan (`auction-live.ts`, ny
  detektor `openerRebidAfterPartnersTwoOverOne` före off-book-svaret) låter
  öppnaren göra sitt vanliga §5.3-återbud via `openerRebidAfter2over1` även
  när partnerns 2/1 avvek från linjen — 2NT = balanserad utan extra form
  (12–15), stöd = fit, ny färg = form — med regel och kravnivå; **(b)**
  tolkningslagret (`auction-interpret.ts`) känner igen ett äkta 2/1 (ostört,
  opassad svarare, ny lägre färg på 2-läget) och märker det och ALLA bud
  under utgång i den auktionen som **utgångskrav**; öppnarens 2NT efter 2/1
  förklaras som 12–15 i krav, inte 18–19 inbjudan; **(c)** regeltabellen
  (`rules.ts`) fick kravnivån för `rebid: 2NT (GF)`/`rebid: ny färg (GF)`.
  Dessutom: en felrapport som skickas mitt i budgivningen skriver nu
  "budgivning pågår" i stället för "given passades ut" (`felrapport.ts`).
  Facit: `auction-2over1-aterbud-offbook.test.ts`,
  `auction-interpret.test.ts` ("2-över-1 = utgångskrav"), `felrapport.test.ts`.
  **Ägarbeslut samma dag, ur samma giv:** "att sätta game force är viktigare
  än att kommunicera träff i färg." Med 12+ hp och 5+ i den andra lågfärgen
  går 2-över-1 nu FÖRE den inverterade höjningen (`responses.ts`,
  `respondToMinor`), och stödet visas i nästa rond: `2/1: försenat stöd` (3m
  med slamintresse, `responder-rebids.ts`) → öppnarens 3NT-förslag/4m
  (`openerAfterDelayedMinorSupport`, `rebids.ts`) → slamutredningen mot visade
  12 (`auction.ts`). Bricka 4 bjuds nu 1♦–2♣–2NT–3♦–4♦–4NT–5♠–6♦ (förr 2♦
  inverterad → 6♦ via den vägen; utan slamintresse 3NT). Boken §4.2, §5.3.
  Facit: `responses.test.ts` ("2-över-1 före inverterad") +
  `auction-2over1-aterbud-offbook.test.ts` (hela bricka 4).
- **2026-09-02 — Pliktsvepet K2 + K5 (§7.4, §5.8).** **K2:** negativ-dubblaren
  ger nu SVAG preferens (6–9 hp) till öppningsfärgen när partnerns tvingade
  svar landade i en färg med sämre stöd — advancer-preferensens kriterier
  (#56) återanvända i `negativeDoublerContinues` (`auction-live.ts`); svepet
  8 → 2 träffar (de två kvar: partnerns svarsfärg är minst lika lång).
  **K5:** `openerRaisesFreeBid` täcker nu fria lågfärgsbud på 2-läget (12–13
  → 3m, 14+ → 3NT med stopp / 4m) — förr blåste off-book-höjningen 5♣ på
  13 hp. Facit: `auction-negx-preferens.test.ts`, `auction-fritt-bud-minor.test.ts`.
- **2026-09-02 — Pliktsvepet K3: höjning på visad längd (§7.1, §7.8 e).**
  Svepet fann 92 av 1539 störda auktioner där en fit passades (kommandot i
  posten nedan). Tre hål: (a) advancern med 3-korts stöd för partnerns
  1-lägesinkliv — `fitLengthNeeded` krävde 4; nu `partnerSimpleOvercalled`
  → 3 kort = fit, enkel höjning från 6 hp, bara till 2-läget, aldrig hopp
  (`raiseWithFit`); balanseringstaket hindrade dessutom den enkla höjningen av
  ett 3-lägesinkliv (frö 20263212). (b) svararen över ett 1NT-inkliv: X =
  straff 10+, 2M med 3+ stöd 6–9. (c) svararen över ovanlig 2NT/Michaels:
  4+ stöd → 3M tävlande, 10+ stödpoäng → 4M; 3-korts + 10+ → 3M
  (`competitiveResponderAction` i `auction.ts` fick inklivets regelnamn).
  Ägarbeslut samma dag: 6 hp räcker för höjningen; 3M är tävlande, ej spärr.
  Efter fixen: 5 träffar kvar, alla balansinkliv där kungen redan är lånad.
  Facit: `auction-hojning-visad-langd.test.ts`.
- **2026-09-02 — Pliktsvepet K1: inklivaren svarar advancerns cue-höjning
  (§7.1).** Svepet `pliktsvep.probe.test.ts` (`$env:PLIKT='1'; npx vitest run
  src/lib/engine/pliktsvep.probe.test.ts`, 3000 givar från frö 20260721) fann
  12 av 1539 störda auktioner där inklivaren PASSADE partnerns cue när
  motståndarna låg tysta — cuet spelades i deras färg. Ny detektor
  `overcallerAnswersCueRaise` (`auction-live.ts`): 14+ totalpoäng → utgång
  (högfärg) / 3NT med stopp (lågfärg), annars billigaste återgång.
  `cueBidderRebidToAnswer` generaliserad så cue-bjudaren fullföljer även på
  inklivssidan (limit passar återgången, 13+ driver utgång). Facit:
  `auction-inklivaren-svarar-cue.test.ts`.
- **2026-09-02 — Felrapporterna #54–#57 (fyra fixar).** **(#55, §7.4/§5.5/§5.8)**
  den negativa dubblingen lovar exakt 4 i en högfärg som kan bjudas på
  1-läget; med 5+ bjuds färgen (`negativeDouble` i `doubles.ts` returnerar
  null, ny regel `fritt bud` i `competitiveResponderAction`, `auction.ts`;
  2-läget kräver 10 hp, 5-4 mot 2-lägesinkliv dubblar kvar). Fortsättningen:
  `openerRaisesFreeBid` (3-korts höjning, hp-skalan 12–15/16–18/19+),
  `responderAfterFreeBidRaise` (Bergen 14+/12–13), `openerAnswersFreeBidInvite`
  i `auction-live.ts`; §5.8-höjningen kräver 3 (inte 4) för ett fritt
  högfärgsbud; kravminnet läser inte längre öppnarens HÖJNING av svararens färg
  som reverse. **(#56, §7.1)** `advancerPrefersOvercallSuit`: preferens till
  inklivsfärgen när partnern visat två färger, oavsett poäng. **(#54, #57,
  tolkningslagret `auction-interpret.ts`)** öppningar på 2-/3-/4-läget förklaras
  som svag tvåa/spärr/stark 2♣ (inte "öppningshand"), och svaren på Stayman
  (2♦ = ingen 4-korts hf, 2♥/2♠) + fullföljd transfer/superaccept förklaras som
  konvention, inte färger. Facit: `auction-fritt-bud-svar.test.ts`,
  `auction-advancer-preferens.test.ts`, `doubles.test.ts` (#55),
  `auction-interpret.test.ts` (#54/#57).
- **2026-08-31 — 2♣-öppningens substanskrav (§4.4, ägarbeslut "Regel B").**
  Den distributionella 2♣:an (hp<22) öppnade förr på PLATT ≥8½ spelstick oavsett
  färg — den mest aggressiva högfärgssiffran applicerad även på lågfärg, vilket
  gav 2♣ på formstarka minimihänder (Grant Baze-fyndet: 11 hp 6-5 tvingades till
  utgångskrav) och på spärrhänder utan försvar (9 hp, 9-korts färg, 2 spelfasta
  stick). Nu (källor: K. Walker, bridgebum, Lawrence; mätning 20 000 givar i
  `tvaklover-oversyn.probe.test.ts`, frekvensen 1,6 % → 1,1 % ≈ verklighetens
  ~1 %): **9 spelstick (hög)/9½ (låg) OCH ≥3 spelfasta stick**, ELLER valven
  **≥8½ spelstick OCH ≥4 spelfasta stick** (räddar honnörs-/esstunga händer, t.ex.
  ägarens fixpunkt frö 20261050: 21 hp, tre ess). Ägarens andra fixpunkt frö
  20260220 (13 hp 6-5) öppnar nu 1♠. `quickTricks` ny i `evaluation.ts`; facit
  `openings-2c-substans.test.ts`; testfrö 20261372 (slamfacit) justerat ♦K↔♦A
  E/W så öppningshanden klarar de nya kraven (EW:s samlade kort oförändrade).
- **2026-08-18 — Checkback efter naturligt 2NT-återbud (systems on, §5.2).**
  Efter **1x–1y–2NT** (öppnaren 18–19 bal) bjöd svararen förr **blint 3NT**
  (`responderRebidColorAuction` case `'2NT (18–19)'` → `return 3NT`) och missade
  dolda högfärgsfitar. Ny behandling: **direkt 3♥/3♠** (egen 5-korts högfärg)
  söker öppnarens dolda 3-stöd (5-3, öppnaren höjer 4M annars 3NT); **3♣ =
  checkback** efter ett 1♠-svar med 4 hjärter frågar öppnarens dolda 4-korts
  hjärter (öppnaren kunde ej visa dem – 2♥ vore reverse) eller 3-stöd i spadern,
  och svararen placerar 4♥ (4-4) / 4♠ (5-3) / passar 3NT. **Scope-verifiering mot
  motorn:** efter ett 1♥-svar visar öppnaren en 4-korts spader billigt med 1♠, så
  2NT nekar båda högfärgerna → den dolda 4-4:an finns bara efter ett 1♠-svar (dold
  hjärter). Svararen lovar 5+ i sin färg hela vägen → ingen 4-3 (ägarbeslut
  2026-08-18: undvik 4-3). Tas on-book i `buildAuction` (behöver båda händerna;
  live-lagret replay:ar den stängda linjen precis som 1NT-auktionsblocken); nya
  `openerAnswer2NTCheckback` + `openerAnswer2NTMajorSeek` (`rebids.ts`) +
  `responderPlaceAfter2NTCheckback` (`responder-rebids.ts`). Facit FÖRE fix:
  `auction-2nt-checkback.test.ts` (svararens tre beslut, öppnarens svar, båda
  kanoniska linjerna når 4♥/4♥). Hela sviten grön.
- **2026-08-18 — Systems on över ett 1NT-INKLIV (§4.3/§7.1, uppföljning
  felrapport #53).** §7.1 lovade sedan tidigare att ett 1NT-inkliv "kör samma
  system som över en 1NT-öppning", men koden gjorde det bara över en 1NT-ÖPPNING:
  advancern passade och inklivaren fullföljde inte transfern/Stayman. Nu
  modellerar den kanoniska linjen (`auction.ts`, ny advancer-gren över
  `1NT-inkliv`) advancerns `respondTo1NT`-svar, och `auction-live.ts` fångar det
  off-book (budlådan): `advancerRespondsTo1NTOvercall` (advancern) +
  `overcallerAnswersAdvance` (inklivaren fullföljer via samma dispatch som över en
  öppning). Tolkningslagret (`auction-interpret.ts`) förklarar 2♣ = Stayman,
  2♦/2♥ = transfer, 2♠ = Minor Suit Stayman över partnerns natur-1NT. V1: den
  egna svarsronden är ostörd (RHO passade); vidare konkurrens över svaret är en
  känd förenkling. Facit: `auction-1nt-overcall-systemson.test.ts` +
  `auction-interpret.test.ts`.
- **2026-08-12 (speldiagnosen S3: cue-bud räknas inte som bjuden färg i
  utspelslogiken, §8.3)** – Trumfutspelsregeln ("motståndarna bjöd 3+ färger =
  korsruff-läge") triggade på frö 20260807 fast auktionen var en vanlig
  Jacoby-höjning: tredje "färgen" var kontrollbudet 4♥ (visar hjärteresset,
  ingen längd — och varje försvarare hör det i förklaringen).
  `analyzeAuctionForLead` (`play-bot.ts`) hoppar nu över bud vars regelnamn
  börjar på "cue" när partnerns/motståndarnas bjudna färger samlas — cue-färgen
  varken triggar korsruff-regeln eller undviks som "deras färg". Övriga
  konstgjorda bud (Stayman-klövern, transfers, Jacoby-kortfärg) räknas
  MEDVETET fortfarande (ofarligt för undvik-regeln; egen genomgång i
  `docs/senare.md` vid behov). Facit FÖRE fix: `play-bot.test.ts` ("fynd 6 –
  cue-bud räknas inte som bjuden färg"). Mätpunkt S3 i `docs/speldiagnos.md`.
- **2026-08-12 (felrapport #47)** – **Överklivaren säljer inte ut efter partnerns
  cue-höjning (kod §7.1).** Väst klev in 1♠ (♠AKQ8654), Öst cue-höjde 2♥ (spaderstöd),
  Syd konkurrerade 3♥ **innan** Väst hann svara cuet — och Väst **passade**, sålde
  given. `answerCueRaise`/`partnerCueRaiseToAnswer` täckte bara ÖPPNAREN i lugnt läge
  (bara pass efter cuet); det fanns ingen hanterare för **överklivaren** när
  motståndarna bjudit vidare → naket pass. Ny detektor `overcallerCompetesAfterCueRaise`
  (`auction-live.ts`): efter cue-höjning + konkurrens sätter överklivaren utgång med
  extra (egen 6+ svit eller 14+ hp), annars tävlar hon billigast i fiten — aldrig sälj
  ut under den (§7.1-tabellen "Överklivaren säljer inte heller ut …"). Facit FÖRE fix:
  `auction-live.test.ts` ("#47 – överklivaren tävlar efter cue-höjning + motståndarnas
  3♥", Väst → 4♠). Hela sviten grön (`npm test`), 0 regressioner.
- **2026-08-08 (F6: stark 17+ enfärg efter två bjudna färger + tvåfärgsinkliv i
  linjen, C5/C14)** – **Körordningens sista punkt.** **(C5)** Den starka
  enfärgshanden (17+ hp, egen 5+ objuden färg) upplysningsdubblar nu även när
  motståndarna bjudit TVÅ 1-lägesfärger (öppning + svar i ny färg, t.ex.
  1♦–P–1♥) och visar färgen på nästa varv (§7.3 "efter två bjudna färger").
  Hålet: den kanoniska linjen (`buildAuction`) modellerade aldrig ronden, så
  spelarens pass låg inbakat i linjen och live-detektorn (som bara gjorde 4-4)
  nåddes aldrig on-book. Handbedömningen delas nu av linjen och budlådan
  (`takeoutOfResponse` i `overcalls.ts`); fortsättningen (tvångssvar + starkt
  återbud) fanns redan och var tvåfärgsmedveten. 4-4-dubblingen förblir
  MEDVETET live-only (eget beslut, `docs/senare.md`). **(C14)** Verifierat att
  linjen aldrig passar ut ett ostört tvåfärgsinkliv — lagat i roten redan
  2026-07-04 (felrapport #14), revisionstabellens 🔴 var stale; nu låst med
  linjebyggstest. Facit `auction-stark-x-tva-farger.test.ts`, mätning M31
  (`docs/systemrevisorn.md`).
- **2026-08-08 (F5: 6-5-återbudet + 2♣-strain-valet verifierade, A3/E2)** –
  **Verifiering i spel med fyra fynd, alla lagade.** Probe över 4 000 seedade
  givar + kodspårning. **(A3)** 16+ 6-5-mönstret är sällsynt vid bordet (10
  händer/16 000, nästan alla öppnar 2♣ på spelstick); återbudsvägarna
  enhetslåsta — reversen efter 1-lägessvar och 2/1 fanns, men efter **1NT-
  svaret** gömdes högfärgen i 3m → ny reverse-gren i
  `openerRebidAfterLimitedResponse` (§3). **(E2)** 2♣-auktioner dog i 5♣/6♣
  trots 8+ högfärgsfit; tre rotorsaker: svararens egen minor sprängde 3NT
  förbi 4-korts högfärgen (`responderSecondBidAfter2C`, frö 20261040);
  kravstegen läste det konstgjorda 2♣ som bjuden klöver och valde billigast-
  först (`forcedMinimumBid`, frön 20262070/20261885 — nu högfärg före minor
  + 2♣ exkluderat); fit-räkningen räknade 2♣ som första klöverbudet så
  dubbelton höjde 4♣→5♣ (`fitLengthNeeded`, frö 20261885). §4.4. Facit
  `auction-65-rebid.test.ts` + `auction-2c-strain.test.ts`, mätning M30
  (`docs/systemrevisorn.md`).
- **2026-08-07 (F4: TP till §7-inkliven, D9)** – **Inklivsgolven läser
  totalpoäng.** §7-lagret räknade rå HP — form/fördelning nådde aldrig
  försvarsbesluten (D9 i revisionen). Nu läser golven för enkelt inkliv
  (8, bal. 5) och upplysnings-X (12/10, bal. 9/7) `max(hp, startpoäng)`, och
  advancerns fit-trösklar (cue 11+, fit-jump 10+) läser stödpoäng — additivt
  ovanpå "låna en kung" (TP = formspak, kungen = sitsspak). Två vakter:
  kvalitetsvakten (lyftet kräver 3+ av topp-5 i färgen — längdpoäng på
  skräpfärger räcker inte; frö 20261020) och spärrvakten (6+ färg med rå
  6–10 hp förblir hoppinkliv). Rå HP behålls i 1NT-fönstren, taket 16 och
  17+-styrningen. `overcalls.ts` (`overcall`/`advanceOvercall`), facit
  `overcall-tp.test.ts`, mätning M29 (`docs/systemrevisorn.md`). §7.1.
- **2026-08-07 (F3: advancer-rabatten generaliserad, C12)** – **Rabatt −3 för
  den som svarar på partnerns balansering — nu över ALLA öppningsnivåer (kod
  §7.1).** Fix 5a byggde rabatten enbart för svaga tvåor/spärrar; över deras
  1-lägesöppning värderade advancern fortfarande balanseringen som ett
  direktinkliv och räknade den lånade kungen en gång till. Två vägar lagade:
  **(1) höjningen av partnerns balansinkliv** (`partnerBalanced`/`raiseWithFit`,
  `auction-live.ts` — generaliserad från `partnerBalancedOverPreempt`, kravet
  "öppning på 2-läget+" borttaget): stödpoäng −3 + tak på 3-läget utan äkta
  utgångsvärden efter rabatten; **(2) svaret på partnerns balanserings-X**
  (`takeoutDoubleToAnswer` flaggar utpassningsmönstret, `answerTakeoutDouble`
  i `doubles.ts` graderar cue/hopp på hp −3). Direkt sits orörd
  (regressionsvakt i facitet). Ett gammalt facit uppdaterat i linje med nya
  systemet (frö 20261375: W:s 4♠-blås på 13 sp mot en 8 hp-balansering var
  själva felet — nu 2♠, given köps i 3♥). Facit FÖRE fix:
  `auction-advancer-rabatt.test.ts`. Hela sviten grön; mätning M28 i
  systemrevisorn.md.
- **2026-08-07 (B13: öppnarens återbud efter inverterad minorhöjning +
  cue-lägena)** – **Graderade återbud efter 1m–2m (kod §4.2).** Tre hål lagade:
  (1) "stopp" var 4+ korts LÄNGD utan honnörskrav (♠9642 visades som
  spaderstopp) — nu motorns äkta honnörsstopp, billigaste först; (2) en stark
  hand utan 4-korts sidofärg dog i "3m minimum, ej krav" (17 hp + 6m →
  utgångar på 27+ hp passades bort) — nu är 3m strikt 12–14 och 15+ bjuder
  ALLTID krav (utan äkta stopp: bästa sidofärgen som "fantomstopp", samma bud
  som stopp-visningen — styrkan visas i nästa bud); (3) svararen tvingades
  alltid till utgång efter en stopp-visning — nu bromsar 10–12 med 3m ("bara
  minimum"), öppnaren passar 12–14 och driver 15+ (3NT när egna handen täcker
  alla sidofärger, annars andra stoppen under 3NT, annars 5m). Dessutom
  **cue-ronden (§6.2) inkopplad i minorfiten och 2♣-grenen** (agreed trumf):
  i minortrumf cue:as först ÖVER 3NT (under = stopp-letande) och i klar
  drivzon (33+) frågas 4NT direkt (5m ligger över 4NT — cue-buden får inte äta
  frågeutrymmet; frö 20261469 visade tappet). Källa: bridgebum (inverted
  minors). Facit FÖRE fix: `auction-inverterad-rebud.test.ts`. Hela sviten
  grön; mätning M27 i systemrevisorn.md.
- **2026-08-07 (oklart-återbudet, systemfel #2: översyn + två fixar)** –
  Spanar-agentens fem frön KLASSADES före fix (ägarbeslut): 20261155 RÄTT
  (exakt par 3NT) · 20261492 RÄTT (systemriktigt pass, DD-smicker 4NT) ·
  20261228 medvetet-OK (1=4=5=3 kan inte visa hjärtern utan reverse-styrka —
  designen; par bara 3♥ EW). Två äkta fel lagade: **(1) 'oklart'-1NT:an
  routas nu som 1NT-återbud** i svararens dispatcher (kod §5.7) — förr nådde
  NMF-maskineriet aldrig dit, live-lagret improviserade och svararen PASSADE
  den framtvingade fortsättningen (frö 20261317: 8-korts hjärterfit begravd i
  3♣ med 27 hp — nu NMF → 4♥). **(2) Öppnaren rebjuder egen 5-korts färg i
  stället för en skev 1NT** när hen har singel/renons i svararens färg (kod
  §5.2 steg 6b; frö 20260878: 1=4=3=5 rebjöd 1NT med singel spader — nu 2♣).
  Facit FÖRE fix: `auction-oklart-aterbud.test.ts`. Hela sviten grön;
  mätning M26 i systemrevisorn.md.
- **2026-08-07 (2/1 GF: svararen visar högfärgen i återbudet, §9-löftet
  2026-08-06 infriat)** – **Egen 4-korts högfärg bjuds naturligt under 3NT i
  2/1-fortsättningen (kod §4.2/§5.3).** 2/1-regeln (5♣ före 4-korts högfärg
  över 1♦) höll tillbaka högfärgen — men `responderRebidIn2over1Auction`
  saknade grenen som visar den, så handen gick på 3NT/preferens och 4-4-fiten
  begravdes. Ny gren 3b: högfärgen visas när den är auktionens TREDJE färg;
  är tre färger bjudna är budet fjärde färg (§6.6) med konventionell mening
  och 3NT-med-håll gäller som förr (regressionen som lärde oss det: facit
  felrapport #4, 1♠–2♦–3♣ där 3♥ är fjärde färg). Prioritet (ägarbeslut
  2026-08-07): försenat stöd i öppnarens högfärg FÖRE egen högfärg (känd
  5-3-fit slår hypotetisk 4-4). Facit FÖRE fix:
  `auction-2over1-hogfargsaterbud.test.ts` (2♠/2♥ visas, prioritetsfallet,
  kanonisk giv når utgång). Hela sviten grön; mätning M25 i systemrevisorn.md.
- **2026-08-07 (starka återbud, systemfel #3: tre delfixar 4a/4b/4c)** –
  **Starka händer dör inte längre i delkontrakt i tre återbudslägen.**
  **(4a, kod §6.6)** Svararens 6-korts-rebud graderas: ≤10 billigast, 11–12
  hoppinvit, 13+ → fjärde färg (GF) så kravet placerar utgången (`fourthSuit`
  steg 2, `responder-rebids.ts`; frö 20261323: 16 hp + 6 hjärter rebjöd 2♥ →
  pass, 30 hp i 2♥ — nu 3NT). **(4b, kod §5.2)** Öppnarens tredje bud efter
  egen enkel höjning + svararens 3M-invit fanns inte (bara 1NT-auktionerna
  hade ett): ny `openerThirdBidAfterOwnRaise` (`rebids.ts`), 14+ stödpoäng
  accepterar (ägarbeslut 2026-08-07, aggressivare valet framför 15+; frö
  20260982: 15 hp + 4 trumf passade 3♥ — nu 4♥). **(4c, kod §5.2)** Öppnarens
  fortsättning efter egen reverse + partnerns preferens: ny
  `openerThirdBidAfterReverse` (`rebids.ts`), 17-minimum passar, 18+ driver
  (3NT med håll i objudna färgen + 2+ kort i partnerns färg, annars utgång i
  fiten; frö 20261111: 18 hp passade 3♣ — nu 5♣). Wiring i `auction.ts`
  (kanoniska linjens tredjebudsslot). Facit FÖRE fix:
  `auction-starka-aterbud.test.ts` (tre seedfall + tröskel-unitfall). Hela
  sviten grön; mätning M24 i systemrevisorn.md.
- **2026-08-07 (Jordan 2NT: öppnarens fortsättning, systemfel #4)** – **Öppnaren
  passar aldrig partnerns Jordan 2NT (kod §7.8d).** Spanar-agentens frö 20260739:
  `1♥–(X)–2NT[Jordan]` och öppnaren PASSADE med 14 hp (15 stödpoäng) och 9-korts
  fit — 28 hp ihop dog i 2NT. Jordan-igenkänningen fanns bara i tolkningslagret;
  ingen svarsregel. Nya `jordanToAnswer`/`jordanSignoffToAnswer`
  (`auction-live.ts`, forcedAnswers-kedjan, positionsexakt 1M→X→2NT) +
  `openerRebidAfterJordan2NT` (`rebids.ts`: ≤14 stödpoäng → 3M avslut, 15+ →
  4M; ägarbeslut 2026-08-07 "bara 3M/4M", stödpoängströskeln vald framför rå
  hp) + `jordanRaiseAfterSignoff` (`responder-rebids.ts`: Jordan-bjudaren höjer
  3M-avslutet till 4M med 13+, passar med ren limithöjning). Bjuder advancern
  över 2NT lämnas läget till konkurrensmaskineriet (Jordan är inbjudan, inte
  rondkrav i störd fortsättning). Källa: bridgebum jordan_2nt.php. Facit FÖRE
  fix: `auction-jordan-fortsattning.test.ts` (frö 20260739 → 4♥ + trösklarna).
  Hela sviten grön; mätning i systemrevisorn.md (M23).
- **2026-08-07 (splinterregeln: singel A/K är ingen splinterfärg, ägarregel +
  källor)** – **Svararen splintrar aldrig en singel A/K — handen svarar Jacoby
  2NT (kod §4.1).** Motivgiven 20260947 (ur hål D-facitstädningen): Väst ♠K
  ♥AJ942 ♦A653 ♣KQ6 (17 hp, 5-korts stöd) splintrade 3♠ på singel-KUNGEN.
  Splinterns budskap ("devalvera dina honnörer här, räkna ruffvärden") är
  falskt med en singel-A/K — honnören drar ett stick. Källor: bridgebum
  splinters.php ("avoid … if your singleton is a high honor", "a singleton
  king is an even worse holding than a singleton ace" → föredra Jacoby 2NT) +
  BBO-expertkonsensus. Singel-DAM får splintras (drar sällan ett stick själv;
  ägarbeslut 2026-08-07 efter källgenomgång), renons alltid. Ny
  `splinterShortSuits` (`responses.ts`) delas av splinterbeslutet OCH
  kortfärgsvisningen efter relät (`responder-rebids.ts`) så reveal aldrig
  pekar på en singel-K när en renons motiverade splintern. Fall-through:
  en 12-poängshand med blockerad splinter faller systemriktigt till Bergen
  limit (Jacoby är utgångskrav 13+). Facit FÖRE fix:
  `auction-splinter-block.test.ts` (unit + kanonisk giv: blockerad splinter →
  Jacoby → cue-rond → 6♠). Hela sviten grön; revisor-mätning frö 20260721 (se
  systemrevisorn.md).
- **2026-08-07 (etapp 7 hål D steg 1: slaminvit i konkurrens, ägarbeslut)** –
  **Kontroll-komplett 4NT i konkurrenslagret (kod §6.10).** Förskanningens mönster
  E (19 givar): fit funnen genom konkurrens, utgång nådd, sedan naket pass av den
  starka kaptenen. Nya `competitiveSlamTry` + `competitiveRKCPlace`
  (`auction-live.ts`): 17+ (eller 16+ med 3 kontroller) + högfärgsfit i konkurrens
  + förstarundskontroll i ALLA sidofärger + partnern har hoppat → 4NT (RKC); 6M
  bara vid entydigt svar, aldrig storslam. Ett tidigare v0-försök (poängtröskel
  utan kontrollkrav) blåste 8 utgångshänder till slam och revertades — poäng kan
  inte skilja kontroll-slam från utgångshand, därav den tighta grinden. Facit:
  `auction-slam-competition.test.ts` (frö 20260877 → 6♠). Facitstädning
  (ägarbeslut): 20260947 flyttad till splinterspåret (Jacoby-hand, motorn
  splintrade en singel-kung — lagas där), 20261274 struken (premiss stale efter
  2/1-regeln 2026-08-06), 20261272 parkerad med steg 2 (cue-frontend för
  kontroll-ofullständiga händer — kvarvarande ärlig kärna för liten för
  regressionsrisken, `docs/senare.md`). Revisor-mätning 2026-08-05 på exakt denna
  kod: noll regressioner (`$env:REVISOR='1'; npx vitest run
  src/lib/engine/revisor.probe.test.ts`, frö 20260721). Hela sviten grön.
- **2026-08-06 (fjärde färg: svararen placerar utgång, systemrevisorns fynd)** –
  **Svararen passar aldrig sin egen fjärde färg (krav) (kod §6.6).** Spanar-agenten
  hittade frö 20260743 (33 hp): svararen bjöd fjärde färg (2♦, utgångskrav) och
  PASSADE sedan öppnarens svar (2NT) → 33 hp dog i 2NT. `auctionForce` täcker
  medvetet inte fjärde färg, och det fanns ingen fortsättningsregel efter att fjärde
  färgen besvarats. Ny `placeGameAfterFourthSuit` (`auction-live.ts`): svararen
  placerar utgång — **3NT**, eller **4 i sin högfärg** om öppnaren höjde den. Grindad
  till MODESTA händer (<18 hp) — en stark hand (t.ex. felrapport #42:s 21 hp → 6NT)
  fortsätter slamvägen. Tänder på 7/1000 givar, alla → 3NT. Facit:
  `auction-fjarde-farg-fortsattning.test.ts`. Hela sviten grön, 0 regressioner.
- **2026-08-06 (2/1 före 4-korts högfärg över 1♦, ägarbeslut + källa)** – **Utgångs-
  kravshand med 5-korts klöver + 4-korts högfärg bjuder 2♣ före högfärgen (kod §4.2).**
  Grundpelaren i 2/1 = kortaste vägen till game force. Med 12+ och en 5-korts klöver
  bjuder svararen **2♣** (2-över-1 GF) i stället för 4-korts högfärgen på 1-läget.
  Valet 4-korts färg (1-läget) vs 5-korts färg (2-läget) avgörs av styrkan: 9–11 →
  1-läget, 12+ → 5-kortsfärgen. Källor: Couchman (2/1 – GF bjuder längsta först) +
  Porthcawl-tutorialen (uttrycklig 12+-tröskel). **Gäller bara över 1♦** (klövern
  måste till 2-läget); över 1♣ visas den längre rutern billigt på 1♦. Ny gren i
  `respondToMinor` (`responses.ts`, gated `opened==='diamonds'` + `maxMajor===4`).
  Motoranmärkning: den GAMLA texten "Bjud 4-korts hf först" var en förenkling som
  saknade längd/styrka-distinktionen — nu rättad. Facit FÖRE fix: `responses.test.ts`
  ("2/1 GF (2♣) före 4-korts spader"). Svararens ÅTERBUD efter 2♣ (visa högfärgen)
  tas separat. Hela sviten grön (utom pågående WIP-facit), 0 regressioner.
- **2026-08-05 (etablerad högfärgsfit → kontrollbud, ägarrapport)** – **4-läges
  sidobud läses som cue när trumf redan är bestämd (kod §6.2, bara förklaringstext).**
  I hål D-arbetet (giv 20261272) tolkade tolkningslagret ett mänskligt 4♣ som "stark
  höjning av partnerns **ruter**" (via cue-i-deras-färg-grenen) fast en 8-korts
  spaderfit redan fanns (min negativa dubbling visade båda högfärgerna, partnern
  valde 3♠). Med en **etablerad 8-korts högfärgsfit** är trumf bestämd, så ett nytt
  färgbud under utgång (4♣/4♦/4♥ när spader är trumf) är ett **kontrollbud** (cue) som
  visar första-rondskontroll + slamintresse — inte en färghöjning. Ny
  `establishedMajorFit` (`auction-interpret.ts`; högfärg båda bjudit naturligt ELLER
  vald efter egen negativ dubbling) → cue-gren före höjnings-/cue-i-deras-färg-grenarna.
  **Bara förklaringstexten** (tolkningslagret) — motorns budval oförändrat. Facit FÖRE
  fix: `auction-interpret.test.ts` ("etablerad högfärgsfit: 4-läges sidobud =
  kontrollbud"). Hela sviten grön, 0 regressioner.
- **2026-08-04 (utspel hål E + A + G + C + D)** – **Budstyrt utspel (kod §8.3).**
  Byggt mot `docs/utspel-teori.md`. **Hål E:** NT-färgvalet blev "längst OCH
  starkast" (`bestNtSuit`/`bestByLenStrengthMajor` i `play-bot.ts`) – längd primärt,
  vid lika styrka, vid lika högfärg. **Hål A:** utspelet var förr helt budblint
  (`botCardSmartReasoned` slängde `calls` på trick 1). Nu läser motspelarens utspel
  auktionen (`analyzeAuctionForLead` + `openingLeadWithAuction`): leder partnerns
  bjudna färg, undviker motståndarnas, och mot trumf **passivt**. **Hål G:** ess-
  regeln generaliserad till alla honnörsgafflar/tenasser (`unsafeToLead`) – boten
  leder inte bort från K-kn-x-x-x / A-D-x-x-x mot trumf (ägarens ursprungliga poäng).
  **Hål C:** trumfutspel (`trumpLeadCard`, 2/4→lägsta, 3→mitten) i korsruff-läge
  (3+ bjudna motståndarfärger) och som passiv utväg framför att bryta en tenass.
  **Hål D:** singel-för-ruff med korta trumf. Facit FÖRE fix: `play-bot.test.ts`
  ("utspel hål A+G – budgivningen styr", inkl. ägarens ♠KJ843 → ♦3 mot 4♥ men ♠3
  mot 3NT) + `signals.test.ts`. Budvägen gäller BARA `botCardSmart` (appens väg);
  `botCard`/`botCardReasoned` är budblinda som förr. Hela sviten grön (`npm test`),
  0 regressioner. Rekommenderad uppföljning: netto-A/B (`PLAYQ`-proben, git-stash)
  för aggregerad stickeffekt.
- **2026-08-04 (utspel hål B + F)** – **Inre sekvenser + ess-regeln överallt (kod
  §8.3).** Byggt mot den källförankrade teorin (`docs/utspel-teori.md`). **Hål B:**
  `honorLead` (`signals.ts`) kände förr bara igen topp-sekvenser (touch från högsta
  kortet) → K-kn-T-x föll till lågt spotkort. Nu känns även **inre/brutna sekvenser**
  igen: en hög honnör (kn+) med ett glapp ner till en sammanhängande löpa (≥2 kort,
  topp 10+) → led toppen av den inre löpan (Kkn10→kn, K109→10, D109→10, Akn10→kn,
  ADkn10→D, ADkn→D). **Hål F:** ess-regeln (underled aldrig ett ess mot trumf) gällde
  bara trick 1; kortvalet bröts ut till en gemensam `chooseLeadCard` som nu även
  mitt-i-given-utspelet ("jag är inne och leder ur längsta färgen") använder. Död
  `openingLead`-funktion borttagen. Facit FÖRE fix: `signals.test.ts` (inre sekvenser
  + negativa fall) och `play-bot.test.ts` (hål F mitt-i-given + NT-vakt). Hela sviten
  grön (`npm test`), 0 regressioner. Nästa: hål E (skilj NT-färgval) → hål A+G
  (budgivningen + tenass-undvikande).
- **2026-08-04 (utspelsbugg)** – **Underled aldrig ett ess på utspelet mot ett
  trumfkontrakt (kod §8.3, ägarrapport).** Boten valde utspel via ren
  längsta-färg-doktrin: ♣AQJxx (5-korts) föll till spotkortsutspel (5:e bästa) och
  ledde LÅGT under esset — förödande mot slam (spelförarens singel-kung blir gratis,
  esset dör oanvänt). Ny `openingLeadChoice` (`play-bot.ts`): mot färgkontrakt väljs
  den **längsta färg som inte kräver ett ess-underspel** (så en ♠KQJ2-sekvens vinner
  över att underleda ♣AQJxx); har varje färg ett oskyddat ess **cashas** esset i
  längsta färgen. **NT oförändrat** (klassisk längsta-färg-doktrin, ess-underspel OK).
  Facit FÖRE fix: `play-bot.test.ts` ("utspel mot trumfkontrakt – underled aldrig ett
  ess", 3 fall inkl. NT-vakten). Hela sviten grön (0 regressioner).
- **2026-08-04 (felrapport #43)** – **Öppnarens 2NT-relä efter partnerns värde-X
  över stört 1NT (kod §7.8 a, ägarbeslut).** Motorn saknade all logik för öppnarens
  fortsättning efter partnerns straff/värde-X → off-book-reservbud (bar pass) →
  missad utgång fast paret hade 28 hp. Ny logik (`answerNTValueDoubleOpener` +
  `answerNTValueDoubleDoubler`, `auction-live.ts`): mot ett **DONT**-inkliv beskriver
  öppnaren (5-korts färg, annars 2NT som förnekar 5-kort) och svararen placerar
  (pass 8–10 / 3NT 11+). **Enbart mot DONT** – mot ett naturligt inkliv står försvaret
  kvar (felrapport #39-facit skyddat, egen diskriminator-test). Facit:
  `auction-1nt-value-double.test.ts`.
- **2026-08-04 (felrapport #45)** – **Negativ dubbling som visar BÅDA högfärgerna
  (kod §7.4, bara förklaringstext).** När motståndaren klev in i en lågfärg så att
  båda högfärgerna är objudna (1♣–(2♦)–X) och svararen har 4+ i båda, fastnade
  förklaringen på den första högfärgen ("4+ hjärter") fast handen visade båda.
  `negativeDouble` (`doubles.ts`) nämner nu **båda** högfärgerna (minst 4-4) i det
  läget. **Budet (X) oförändrat — bara texten** rättad. Facit: `doubles.test.ts`.
- **2026-08-03 (cue-bud återinförda, river 2026-07-07)** – **Kontrollbud i motorns
  slamutredning (kod §6.2, ägarbeslut).** 2026-07-07-beslutet att ta bort cue-ronden
  ("ingen kontrollkoll — lita på poängen") revs: cue-bud är expertspelets främsta
  slamverktyg och ren poängräkning missar kontrollberoende slam. Nya principen —
  när **utgång är etablerad (GF) + trumf agreed** cue:ar motorn fritt under utgång
  (en cue är gratis där), och flyttar poängomdömet till beslutet att gå **förbi**
  utgången (`cueSlamAuction` i `slam-auction.ts`, gated på `SlamContext.gameForcing`).
  Ärligt: varje hand cue:ar sina EGNA kontroller (billigaste första-rondskontroll
  uppåt, hoppa över = förneka) och läser partnerns visade. Stoppregel: högst en
  sidofärg utan första-rondskontroll + floor ≥ 31 → 4NT RKC (befintlig svans);
  annars avslut i utgång. Cue-bud **tillkommer bara** — saknas en gratis cue står de
  gamla portarna (driv 33+ / inbjudan 31–32) kvar. Inkopplat: **Jacoby 2NT** (on-book)
  + **New Minor Forcing → öppnarens fördröjda högfärgsstöd** (hål C, on-book, når 6♥
  på frö 20260932: `1♣–1♥–1NT–2♦–3♥–3♠–4♦–4NT–5♣–6♥`). Reverse/hoppskift/2♣ HÅLLS
  (inferrerad, ej agreed trumf → cue skulle läsas naturligt). En bugg fångad av
  facit-testerna: `cheapestFreeCue` re-cue:ade redan visad färg (6♣ blev 5♣) — fixad.
  Facit FÖRE fix: `auction-slam-cue.test.ts` + uppdaterat Jacoby-fall i
  `slam-auction.test.ts`. Mätning (`REVISOR=1 npx vitest run
  src/lib/engine/revisor.probe.test.ts`, frö 20260721, 1000 givar): par-avvikelse
  **270,74 → 270,69**, rätt kontrakt 18,8 % oförändrat, missad lillslam 81 → 80,
  **"för högt" oförändrat (37) — inga blåsta slammar**. Litet men rent netto; det
  mesta av posten ligger i ännu ej wire:ade lägen. Hela sviten grön.
- **2026-07-31 (etapp 7 hål 2)** – **Öppnarens slamtrevare efter svararens 3NT
  (kod, §6.9, mätspåret, ägarbeslut).** Systerfallet till felrapport #42, från den
  sida som SJÄLV har extra: efter `1m–1X–3m(invit-hopp)–3NT` saknade öppnaren en
  väg vidare och föll till det nakna passet (Fynd 1) — lillslammen försvann fast
  öppnaren hade en stark hand med löpande minor. Nu gör öppnaren med **19+ hp** en
  kvantitativ slamtrevare **4NT** (`openerTriesSlamAfter3NT`), och svararen lyfter
  till 6NT med ett maximum / fittande topphonnör i minoren, annars pass
  (`answerOpenerSlamTry`). Smal med flit (ägarbeslut 2026-07-31, "bara äkta extra"):
  en 16–18-hand går från öppnarens stol inte att skilja från en tunn 26-hp-slam
  som bara går på DD, så bara 19+ trevar. Ingen kontrollkoll, taket är 6NT.
  Förskanningen: posten "landade i 3NT" är 24 givar / 15 610 p men heterogen över
  ~5 familjer och mest DD-smicker — bara den 19+-delen är ärligt bjudbar. Mätning
  #21 (frö 20260721): par-avvikelse **271,24 → 270,74**, rätt kontrakt
  **18,7 → 18,8 %**, missad lillslam 82 → 81, **alla andra poster oförändrade, noll
  regressioner** (1 giv, frö 20261020, → exakt par 6NT). Facit-test FÖRE fix:
  `auction-3nt-stopp.test.ts` (huvudfall + tröskeln 19, svararens minimum-avböjande,
  renonsvakten). Hela sviten grön.
- **2026-07-30** – **LEBENSOHL EFTER VÅRT 1NT inkopplad (§7.5, Lager 1).** Den
  gamla skulden ("byggd men ej inkopplad", 0 träffar i svepet) är stängd: modulen
  `lebensohl.ts` skrevs om för det klassiska efter-1NT-läget och kopplades in i
  den levande budgivningen. **Steg noll:** motståndaren klivar nu in **naturligt**
  över 1NT med en stark enfärgshand (6+, 11–15) — annars DONT som förr (§7.6).
  Symmetriskt, så vårt eget DONT-försvar mot deras 1NT fick samma uppdelning
  (ägarbeslut 2026-07-30). Svararen spelar Lebensohl-kärnan (pass / naturligt
  2-läge / 2NT-relä / direkt 3-lägeskrav / direkt 3NT) och öppnaren fullföljer
  reläet med tvunget 3♣. Facit: `lebensohl.test.ts` + `auction-lebensohl-1nt.test.ts`;
  regelsvepet (frö 20260721) gick från 0 → 18 naturliga inkliv + hela
  Lebensohl-konversationen, DONT-posterna växte inte. Takeout-dubbling, slow-shows,
  cue-Stayman och Lebensohl mot konstgjorda inkliv är planerade nästa lager.
- **2026-07-30** – **Försvaret spelar TREDJE HAND HÖGT (§8.6, felrapport #34).**
  Tredje/fjärde-hand-grenen i `play-bot.ts` la förr billigaste vinnaren även när
  den DOLDA spelföraren spelade efter försvararen (Nord ♥5 → Öst tog billigt på
  ♥9). Ny gren (`thirdHandHonor`): är jag försvarare, partnern ledde och bara
  spelföraren (ej den öppna träkarlen) står bakom mig lägger jag min LÄGSTA honnör
  (10+) – snålar med sekvensen och behåller en gaffel över spelföraren (att spela
  esset "högt" krossar det på partnerns låga utspel). Saknar jag honnör står gamla
  regeln kvar. Guardat mot ruff i trumf (visad renons hos kvarvarande motståndare).
  Facit FÖRE fix: `play-bot-third-hand.test.ts` (DDS-låst klassisk finess: tredje
  hand lågt släpper spelföraren +1 stick + själva felrapportens giv). Netto
  (`play-establish.probe`, ESTABLISH=1, 40 seedade givar, frö 20260729):
  spelförarstick 374 → 374 (oförändrat, ingen giv bytte utfall), noll
  regressioner i hela sviten – mönstret är sällsynt i slumpgivar, men den
  rapporterade given är DDS-bevisat lagad. Detalj: `docs/bot-hjarna.md`.
- **2026-07-29 (Steg 5)** – **Bottarna LÄSER markeringar (§8.5).** `signal-decode.ts`
  fick `applySignalReads`: en avskräckande attityd på partnerns färg (högt
  spotkort 8/9/10, bot-motspelare som inte vann) sätter ett HP-tak (`suitHcpCeil`,
  ny i `hand-model.ts`) → samplaren undviker dam+ där. Inkopplat i
  `botCardSmartReasoned` (`opts.decodeSignals`, default på). Bara bottars
  markeringar (aldrig Syd). A/B-mätning (`play-quality.probe.test.ts`, gatad, 20
  seedade givar): netto −1 spelförarstick (bättre försvar), inom bruset –
  ägarbeslut att behålla på. Facit: `signal-decode.test.ts`.
- **2026-07-29** – **Bottarna LÄGGER markeringar i motspelet (§8.5, ny).**
  Encoders i `signals.ts` (UDCA attityd/räkning, Lavinthal) kopplades in i
  `play-bot.ts` via `defensiveSignalCard` (spare-/gardberäkning) + resolvern
  `defensiveFollowSignal`/`defenderFirstDiscardSignal`. Attityd på partnerns färg
  (uppmuntra: dam+ och/eller kort färg), räkning på motståndarens, Lavinthal på
  första saket. Gardregeln behåller de två högsta korten i 3+-färger. Uppmätt
  encode-kostnad (rena tumregler, 239 seedade givar): ~1190 markeringar,
  netto +10 stick åt spelföraren (~0,04/giv), värst +4 på en giv, inga grova
  blundrar – vaktat av `play-bot-signals-neutral.test.ts`. Facit:
  `signals-defense.test.ts` + `play-bot-signals.test.ts`. Att bottarna även
  **läser** markeringar (och att rondgenomgången förklarar dem) byggs separat.
- **2026-07-28 (kväll, etapp 7 hål 1)** – **Öppnarens suutrebid sa "minimum"
  med extra styrka (kod, §5.2, mätspåret).** Förskanningen av "missad lillslam"
  hittade två fel i SAMMA regel (`openerRebidAfter1LevelResponse` steg 5,
  rebids.ts): (a) **taket saknades** — fönstret var `p >= 16 && p <= 18`, så en
  19+-hand föll IGENOM det ned i minimibudet (frö 20261020: 20 hp / 23 TP
  rebjöd "2♣ minimum 12–15" och svararen passade korrekt med 10 hp; 6NT fanns),
  medan syskonfunktionen `openerRebidAfterSemiForcing1NT` haft 19+-rungen hela
  tiden; (b) **steget räknade rå hp** medan grannreglerna i samma funktion
  (reversen steg 3, hoppskiftet steg 4b) väger med `pointsWithFloor(...,
  'starting')` — en 15 hp-hand med 18–19 TP kallade sig därför minimum (frön
  20261279, 20261661, 20261136). Nu väger stegen startpoäng (golvade vid hp, så
  TP bara uppgraderar) och 19+ i HÖGfärg sätter utgången; en minor stannar på
  3-läget. Mätning #20 (samma frö): par-avvikelse **276,49 → 271,38**, rätt
  kontrakt **18,2 → 18,7 %**, missad lillslam −3 140, missad utgång −1 390,
  fel färg −600, netto **−5 110 p**. 11 givar flyttade, **alla till det bättre,
  noll regressioner** — fem blev exakt par. Facit-test FÖRE fix:
  `auction-lillslam-aterbudsstyrka.test.ts` (inkl. gränsvakter för äkta minimum
  och för att TP aldrig nedgraderar). Hela sviten grön.
- **2026-07-28 (kväll)** – **Kvantitativ höjning av partnerns naturliga 3NT
  (kod, §6.8, felrapport #42, ägarbeslut).** Auktionen
  `1♣–1♥–1♠–2♦–2♥–3♦–3NT` passades ut med **21 hp** mittemot öppningshanden
  (bricka 7; given gav 12 stick). Roten: slamportarna var inkopplade bara i den
  kanoniska linjens NAMNGIVNA mönster (Jacoby 2NT, inverterad minor,
  1NT-återbudet, MSS) — placerade partnern kontraktet i ett naturligt 3NT i en
  vanlig färgauktion fanns ingen kvantitativ höjning alls, så kaptenen passade.
  Nu gäller systemets egen kaptensregel även där: egen hand + partnerns visade
  minimum ≥ 33 → driv. Partnern har öppnat på 1-läget i en färg → visat minimum
  12 → tröskeln **21 hp → 6NT**; 20 eller mindre passar. Smal med flit: 3NT ska
  vara senaste budet, motståndarna tysta, ingen renons på egen hand.
  Sangöppningar behåller sina egna portar. Ingen kontrollkoll och storslam
  kräver visshet → taket är 6NT. Facit-test FÖRE fix:
  `auction-3nt-slamhojning.test.ts` (inkl. gränsvakterna 20 hp, ej-öppnande
  partner och renonshanden). Hela sviten grön.
- **2026-07-28 (kväll)** – **Sangsystemet gäller även off-book (kod, §4.3,
  felrapport #41).** Ägaren bjöd 1NT själv i budlådan och auktionen dog på
  fläcken (`1NT–P–P–P`) trots att partnern satt med 15 hp och 5-4 i minorerna
  (bricka 11). Roten: `respondTo1NT`/`respondTo2NT` och öppnarens återbud var
  BARA inkopplade i den kanoniska linjen — off-book gick svaret till det
  generella `offBookResponse`, som kräver att partnern visat en **färg**, och en
  sangöppning visar ingen. Samma hål åt andra hållet: öppnaren kunde inte
  besvara Stayman/transfer/MSS off-book (Stayman-2♣ lästes till och med som
  "krav – ny färg"). Nu kopplas §4.3/§4.4 in på båda sidor av bordet när
  sangöppningen är auktionens enda kontraktsbud och motståndarna är tysta
  (stör de äger §7.8 läget). Svarets betydelse läses ur **budet**, aldrig ur
  partnerns kort. Rapportens giv landar nu i 5♦ via Minor Suit Stayman i stället
  för 1NT. Facit-test FÖRE fix: `auction-sang-offbook.test.ts`. Hela sviten grön.
- **2026-07-28 (kväll)** – **17+ säljer aldrig given över deras 1-lägesöppning
  (kod, §7.1, felrapport #40, ägarbeslut).** Öst passade med **20 hp** över
  Nords 1♥ och given såldes på fläcken (bricka 1). Roten: `overcall` hade inget
  utlopp för 17+ när den enda långfärgen är **öppnarens egen** — den starka
  17+-regeln kräver en EGEN 5+ färg, upplysnings-X:et kräver korthet i deras
  färg, och naturliga inklivet är kapat vid 16. Handen föll rakt igenom till
  pass. Nu dubblar 17+ som sista utlopp, precis som §7.7-försvaret redan gör mot
  svaga tvåor och spärrar. Taket 16 på det naturliga inklivet är oförändrat.
  Ägarens formulering i rapporten: "jag ser hellre en dubbling". Facit-test FÖRE
  fix: `Felrapport #40` i `auction-live.test.ts` + enhetstester i
  `overcalls.test.ts` (inkl. gränsvakten att 16 hp fortfarande passar). Hela
  sviten grön.
- **2026-07-28** – **Försvaret mot deras höjda spärr (kod, §7.7, ETAPP 6
  hål 4, ägarbeslut).** Förskanningens sista hål: budlådan krävde exakt ETT
  kontraktsbud i historiken för ett inkliv, och §7.6/§7.7-försvaret modellerades
  bara direkt över själva öppningen — efter deras öppning + spärrhöjning
  (`2♠–P–3♠` / `1♣–P–3♣`) fanns ingen väg in alls. En 21-poängare passade ut
  `2♦–P–3♦` (frö 20261477), en 18-poängare `2♥–P–3♥` (frö 20261449). Nu väcker
  försvaret med spärrfönstren (`defendPreempt`) både direkt över höjningen och
  i balansering ("låna en kung": X 14→11, färg 13→10, offshape-X med 3 kort i
  deras färg — bara på 3-läget). Samtidigt fick `defendPreempt` taket 16 på
  naturliga inklivet och 17+-utloppet "sälj aldrig given → X" (samma som
  `defendWeakTwo` fick i hål 3). Tre justeringar efter första mätvarvet
  (Mätning #18): 3NT över den höjda spärren kräver 19 direkt / 16 balansering
  (16 direkt stod på Kx-håll och gick djupt bet — X:et tar över och landar på
  par, frö 20261045); kungen lånas INTE mot 4-lägesöppningar (frö 20261533);
  och advancerns tvingade svar på 3-läget+ väljer honnörsstarkare färg på lika
  längd (4♣ på A832 före 4♥ på J982, frö 20261680). Ägarbeslut: höjningar
  förbi 3-läget lämnas, och tunna fördelningsutgångar (6♣ på 19 hp, frö
  20260858) jagas INTE — gränsvakterna ligger i facit-testet. Målkontrakten
  DD-verifierade före fixen. Facit-test FÖRE fix:
  `auction-sparrhojning-svar.test.ts` + enhetstester i
  defense-conventional.test.ts. Hela sviten grön.
- **2026-07-27 (kväll, del 2)** – **Taket i försvaret mot svaga tvåor (kod,
  §7.7, ETAPP 6 hål 3).** `defendWeakTwo` hade cue (15+ 5-5), 2NT-fönstret
  (15–18/12–15), takeout-X och naturligt inkliv (10–16) — men inget utlopp
  uppåt: frö 20260767 (balanserad 21-poängare i balansering), 20261571 (17 hp
  med stark 6-korts klöver) och 20261582 (17 hp balanserad i balansering, ÖVER
  12–15-fönstret) passade alla ut deras svaga tvåa. Nu: **3NT till spel**
  (balanserad 19+ direkt / 16+ balansering, eller stark 6+ minor med två
  topphonnörer + stopp från 15) och **stark X (17+)** som sista utlopp — men
  X:et behåller prioritet när handen har kort i deras färg (flexiblare; på frö
  20260811 var X-vägen 250 p bättre än 3NT). Alla tre målen DD-verifierade:
  3NT ger 10 stick (430/430/630 ≈ par). Facit-test FÖRE fix:
  `auction-svagtva-tak.test.ts` + enhetstester i defense-conventional.test.ts.
  Hela sviten grön.
- **2026-07-27 (kväll)** – **Advancern svarar när de bjuder över upplysnings-X
  (kod, §7.3, ETAPP 6 hål 2).** Förskanningens andra hål: `takeoutDoubleToAnswer`
  kräver att partnerns X är senaste icke-pass — höjde motståndarna (1♣–X–2♣)
  eller redubblade de försvann svaret HELT (frö 20261519: advancern teg med 15
  hp; fem frön totalt: 20260759, 20260811, 20260934, 20261519, 20261521). Nu:
  `advancerFreeBidAfterDouble` (fritt värde-/formstyrt svar; XX = tvångsflykt
  via `answerTakeoutDouble`) + `doublerAnswersCue` (cue besvaras alltid,
  högfärgen först — felrapport #11:s facit styrde prioriteten) + vakten
  `doublerRaisesAdvance` (dubblarens höjning skalar mot vad svaret visade:
  hopp 9–11 → accept 15+, fritt ~6–9 → utgång 19+/invit 16–18, XX-flykt höjs
  aldrig) + två strukturvakter: dubblarens höjning av advancerns färg läses
  inte längre som "X + egen stark färg" (blastade utgång på 8 hp), och
  motståndarnas straff-X på vårt cue friar inte dubblaren från svarsplikten.
  Facit-test FÖRE fix: `auction-upplysningsx-svar.test.ts` + enhetstester i
  doubles.test.ts. Hela sviten grön.
- **2026-07-27** – **Stöddubblingen har fått en svarsväg (kod, §7.4, ETAPP 6
  hål 1).** Systemrevisorns förskanning av "billig offring" visade att svararen
  ALDRIG svarade på öppnarens stöddubbling: svarstvånget efter partnerns X
  stängdes av så fort vår sida bjudit ett kontraktsbud, och stöddubblingen hade
  ingen egen väg. Fem frön (20260884, 20261005, 20261274, 20261433, 20261658,
  1 470 p) lämnade motståndarna i 2-läget dubblat fast vår sida ägde utgång.
  Nu: `answerSupportDouble` + `supportDoublerRebid` (doubles.ts) med detektorer
  i auction-live.ts — svararen svarar naturligt efter styrka (13+ sätter
  utgången, 10–12 inbjuder, minimum bjuder billigast; pass BARA som medvetet
  straffpass med trumfstack), öppnaren accepterar inbjudan med 15+ och
  respekterar att svararens nya färg är rondkrav (§5.5). På de fem fröna nås nu
  5♦, 3NT, 4♠, 4♥ och 5♣ — alla DD-verifierade spelbara. Facit-test FÖRE fix:
  `auction-stoddubbling-svar.test.ts` + enhetstester i doubles.test.ts.
  Rondkravs-stresstestets täckningströskel sänkt 5 → 1 (åtta av nio träffar
  var symptom på just det här hålet). Hela sviten grön.
- **2026-07-25 (genomgång)** – **Lebensohl markerad som ej inkopplad (§7.5, ingen
  regeländring).** En full genomgång av repot visade att `lebensohl.ts` är byggd
  och enhetstestad men aldrig importeras av produktionskoden: ett svep där motorn
  bjöd 3 000 givar gav 0 Lebensohl-bud, medan t.ex. Ogust gav 29 och Drury 12.
  Boken beskrev alltså ett verktyg bordet inte kan. §7.5 har fått en tydlig ruta
  om det tills inkopplingen görs. Samtidigt: en **kopplingsvakt** i
  `src/docs-vakt.test.ts` gör att en budmodul aldrig mer kan tappa kontakten med
  appen utan att testsviten blir röd.
- **2026-07-24 (kväll)** – **Familj C-resten: hoppskift-fortsättningen + slamport
  efter reverse/hoppskift (kod, §5/§5.1, ETAPP 4).** Två delar. **(1)**
  Semi-forcing-hoppskiftets svar (`rebid: hoppskift`, visade 16+) prefererade
  blint 3M under utgång (öppnaren passade kravet) och kollade aldrig fit i
  hoppskiftets egen färg — revisorns frön 20260799 (`1♠–1NT–3♥–3♠–P` med
  K942 i hjärter, 4♥ fanns, tapp 1200), 20260765 (AJ974 → 3NT i st.f. 4♥)
  och 20261334 (KJ982 → 3NT utan spaderstopp). Nu: 4+ i hoppskiftets färg +
  ~8 stödpoäng → utgång i fiten (4♥ / minor: 3NT bara med håll i objudna,
  annars 5m); 3-korts M-preferens med utgångsvärden → 4M; svaga händer
  prefererar billigast som förut. **(2)** Ny slamport efter 1-lägessvarens
  REVERSE (visade 16) och HOPPSKIFT (visade 19) i `buildAuction`: kaptenen
  räknar sin hand mot visat minimum när trumf är säkrad på egen kunskap
  (4+ i andrafärgen / 3+ i förstafärgen som lovar 5+; 4+ mot hoppskiftets
  minoröppning) → driv 33+ (4NT RKC), inbjudan 31–32, annars dagens flöde.
  Facit-test FÖRE fix: `auction-hoppskift-slam.test.ts` (10 fall; syntetiska
  slamgivar DD-verifierade, 6♣ = 12 stick). Hela sviten grön, tsc rent.
- **2026-07-24** – **Slamzon utan trumf efter 2♣ + positivt svar (kod, §4.4,
  ETAPP 4 F1 familj B fix 2).** Kaptenen i slamzon (33+ mot visade 22) utan
  funnen trumf gjorde förr ingenting — linjen dog och live-lagret rebjöd
  färger tills auktionen stannade i utgång (revisorns frö 20261372:
  `2♣–3♣–3♥–4♣–4♥` med 14 hp + AKQJT3 hos svararen; 6♣/6NT hemma, DD 12
  stick). Nu: egen redan visad **6+ färg med minst två topphonnörer** =
  självbärande trumf → **4NT RKC** i den (nyckelkortsvakt mot spelstick-
  öppningar); **6NT direkt bara efter öppnarens 3NT-återbud** (styrkan visad
  BALANSERAD). Första utkastet bjöd 6NT även efter färg-återbud — DD-skannen
  av alla 2♣-slammar fångade frö 20261107 (öppnaren 13 hp spelstick-6-5 →
  6NT åtta stick, fyra bet) och regeln stramades åt med det fröet som vakt.
  Under 33 utan trumf: oförändrat flöde (avgränsning: ingen kvantitativ
  inbjudan i 31–32 utan trumf). Facit-test FÖRE fix: `auction-2c-slam.test.ts`
  utökad till 18 fall (frö 20261372 → 6♣, 3NT-återbudets 6NT-väg,
  under-zonen + 20261107-vakten). Hela sviten grön, tsc rent.
- **2026-07-24** – **Slam efter stark 2♣ + positivt svar (kod, §4.4, ETAPP 4
  F1 familj B fix 1).** Efter 2♣ och ett positivt svar fanns ingen on-book-
  fortsättning när en trumf hittats — linjen tog slut och live-lagret höjde
  bara till utgång eller blastade 5m (revisorns frön 20261101: `2♣–2♥–3♥–4♥`
  med 24+11 hp och 6♥ hemma; 20261050/20261469/20260830: blast till 5m förbi
  RKC). Nu kör `buildAuction` **kaptensmatten** (ärliga slamportar) när trumf
  är funnen — B1: öppnaren stödde svararens positiva färg; B2: svararen har
  3+ kort i öppnarens naturliga färgrebud (lovade 5+): svararen (kaptenen)
  räknar sin hand mot 2♣-öppningens **visade minimum 22** (stark balanserad
  22+ hp eller ~9+ spelstick ≈ samma spelvärde) → **driv 33+** (4NT RKC),
  **inbjudan 31–32** (5M respektive stödhöjningen 4m/5m; öppnaren dömer
  accepten på sina EGNA Bergenpoäng så spelstick-händernas längd räknas
  ärligt), annars sätts utgången (GF). Storslam kräver visshet som förut.
  Facit-test FÖRE fix: `auction-2c-slam.test.ts` (11 fall, inkl. inbjudan
  accept/avböj). Hela sviten grön, tsc rent.
- **2026-07-07 (kväll)** – **ÄRLIGA SLAMPORTAR (kod, §5.2, §5.7, §6, §6.2).**
  Ägarbeslut efter total-granskning: all slamutredning "tjuvkikade" — portarna
  räknade parets FAKTISKA sammanlagda poäng, nyckelkort och kontroller ur båda
  händerna. Nu beslutar varje hand ärligt: **kaptensregeln** (egen hand + visat
  minimum: ≥33 driv, 31–32 inbjudan — kvantitativ 4NT över sang, 5M/4m i trumf;
  partnern accepterar över blott minimum), **härledning** av nyckelkort/ess ur
  svaret + egen hand (tvetydighet: anta högt mot visad 15+, annars lågt +
  partner-rättelse), **storslam kräver visshet**, **kontroll-gaten och den
  automatiska cue-ronden borttagna** (ägarval: lita på poängen; §6.2 gäller
  fortfarande som konvention för manuella cue). `familyAFitTrump` läser bara
  svararens hand (6+ egen hf / 5+ i öppnarens minor; gömda 4-4-fits jagas ej).
  Berör `slam-auction.ts`, `nt-slam.ts`, `auction.ts` (`pairControlsSideSuits`
  borttagen). **Kända ärliga misser** (medvetna, test-låsta): #29-originalgiven
  stannar nu i 3NT (13 hp mot visade 16–18 = under zonen) och familj A-givens
  4-korts minorfit drivs inte (fiten går inte att veta). Slamfrekvens efter
  ändringen (probe 60 000 givar): lillslam ~1/120, storslam ~1/4300 — mänskligt.
  Facit: `slam-auction.test.ts` (omskriven, ärlig mekanik inkl. inbjudan +
  rättelse), `auction-slam-*.test.ts`, `nt-slam.test.ts`. 1090 test gröna.
- **2026-07-07** – **Slam efter öppnarens hopphöjning (kod, §5.2, F1 familj C).** En
  probe (300 000 givar, DD-lösta) visade att paret ofta stannade i **4M** trots
  slamvärden efter **1x–1M–3M** (öppnaren hopphöjer svararens högfärg, 16–18 + 4
  stöd) – slam-arsenalen var inte inkopplad i den formen (41 slamzon-stopp av 1 563
  hopphöjningar, många DD-verifierat kalla slammar). Trumfen är redan överenskommen,
  så `buildAuction` kopplar nu in `slamInvestigation` (svararens högfärg trumf, med
  cue-rond som Jacoby-fiten – INTE skipCueRound) efter hopphöjningen. Portar mot
  överbud: slamzon (**≥33 stödpoäng**), **≥4 nyckelkort** och `pairControlsSideSuits`
  (ess/korthet i varje sidofärg – motorn går deterministiskt vidare till 4NT, så
  gaten krävs som i #29). Utanför portarna står den vanliga kedjan kvar (svararen
  4M / pass). Facit `auction-slam-jumpraise.test.ts` (2 DD-verifierade givar:
  1♥–1♠–3♠ → 6♠ och 1♣–1♠–3♠ → 6♠, båda DD 13). Make-rate-probe (250 000 givar):
  hooken drev slam 328 ggr; av de DD-lösta (18 – resten för tunga att lösa) höll 16,
  2 bet med exakt ett stick (finess-slam) = **88,9 %**, i linje med #29-hooken.
  1089 test gröna, tsc rent. **Kvar i F1:** familj B (2♣), C:s systerfall reverse +
  hoppskift (störst men rörigare – ingen överenskommen trumf).
- **2026-07-07** – **Slam-quirken stängd: hängande cue (kod, F1 familj D).** Probe-
  given `1♥–2NT–4♥` (paret har alla fem nyckelkort + trumfdam, 7♥ kall/DD 13) dog
  förr i **4♠**: `slamInvestigation`s cue-rond lade svararens cue (4♠) UTAN att
  öppnaren kunde cue:a tillbaka (ingen kontroll ovanför spader) → två svararbud i rad
  = olaglig auktion → live-lagret föll av linjen och passade delkontraktet (den kända
  ~0,25 %-slam-quirken). Fix: cue-ronden läggs nu bara som ett **komplett par**
  (svarare + öppnare); saknas öppnarens cue-svar hoppas hela ronden över → rakt på
  4NT RKC. Nyckelkortsporten (≥4) skyddar ändå mot slam med två snabba förlorare.
  Probe (200 000 byggda auktioner): **0 kvarvarande "två-i-rad"** (var >0 före).
  Facit `auction-slam-jacoby-cue.test.ts` (→ 7♥) + uppdaterad regression i
  `slam-auction.test.ts`. 1087 test gröna, tsc rent.
- **2026-07-07** – **Slam efter 1NT-återbud, OBALANSERAD del (kod, §5.7, F1 familj
  A).** Fortsättning på jämn-delen nedan: en obalanserad svarare med en **färgfit**
  mittemot 1NT-återbudet driver nu **färgslam** i stället för 3NT. `familyAFitTrump`
  (`slam-auction.ts`) väljer trumf (6+ egen hf → den; annars 8+ korts hf-fit; annars
  8+ korts minorfit, öppnarens minor först); `buildAuction` kör då `slamInvestigation`
  (skipCueRound + `pairControlsSideSuits`-gate, som #29) → 4NT RKC → 6 i färgen.
  Self-limitar (≥33 stödpoäng, ≥4 nyckelkort). Facit: probe-givan ♠A ♥AKJT ♦KQT8
  ♣J854 (4-4-4-1, 9-korts klöverfit) → **6♣**, DD-verifierat 12 stick (`auction-slam-
  1nt-rebid.test.ts`). Make-rate-probe: färgslammarna som DD-löstes gick hem. 1086
  test gröna, tsc rent. **Kvar i F1:** familj B (2♣), C (hoppskift/reverse), D (Jacoby-
  läcka).
- **2026-07-07** – **Slam efter 1NT-återbud (kod, §5.7, F1 familj A).** En
  utforskningsprob (40 000 givar, DD-lösta) för att **bredda slam-utforskningen**
  visade att en svarare med slamvärden mittemot öppnarens 12–14 1NT-återbud bara
  blåste **3NT** – slam-arsenalen var inte inkopplad i den auktionsformen (den fanns
  bara för Jacoby 2NT, inverterad minor, hopp-återbud i minor, MSS och Gerber-över-
  2NT). Nu kopplar `buildAuction` in `gerberRebidInvestigation` (`nt-slam.ts`) efter
  `1m–1M–1NT`: en **jämn** svarare (ingen 5-korts färg) med **≥33 hp ihop** frågar
  ess med **Gerber 4♣** och placerar 6NT/7NT i stället för 3NT. Räknar FAKTISK
  kombinerad hp (öppnaren är ett spann 12–14) och stannar i 4NT om två ess saknas
  (återanvänder `buildGerberSequence`). 5-korts högfärg → NMF-vägen; obalans →
  färgslam (senare steg i F1). Facit `auction-slam-1nt-rebid.test.ts` (1♣–1♥–1NT
  → 6NT, DD-verifierat 12 stick). 1085 test gröna, tsc rent.
- **2026-07-07** – **Felrapport #33 + #32-budgivning.** (1) **#33 – advancern hoppar
  inte förbi utgång:** i `raiseWithFit` (`auction-live.ts`) räknades en "inbjudande
  hopp" som partnerns nivå + 2, så över partnerns 5♦ blåste boten **7♦** (grand slam
  på 28 hp). Nu kapas inbjudande/enkla höjningar vid utgångsnivån (högfärg 4, lågfärg
  5) och advancern **passar** när partnern redan nått utgång (slamvärden sköts av
  sp≥13-grenarna). Facit `auction-advancer-cap.test.ts`. (2) **#32 – 6-5-öppning
  (§3):** ägarregel — 6-korts lågfärg + 5-korts högfärg öppnar HÖGfärgen med 12–15,
  LÅGfärgen med 16+ (kan reverse:a in högfärgen). `openings.ts`; facit i
  `openings.test.ts`. (#32:s spelfel + #34:s försvar = uppskjutet spelmotor-spår.)
  1084 test gröna, tsc rent.
- **2026-07-07** – **Slam efter hopp-återbud i egen minor (kod, §6, felrapport #29).**
  #29: N ♣AQJT94 (19) öppnade 1♣, S svarade 1♠, N hoppade 3♣ (16–18, 6+ klöver);
  boten stannade i 3NT trots en KALL slam (6♣/6NT/7 = 13 stick DD). Nu driver paret
  mot slam: efter `1m–1M–3m` med svararens fit (3+ i minoren) kopplar `buildAuction`
  in `slamInvestigation` (minoren som trumf) → 4NT 1430 RKC → placering (6♣ på #29).
  Cue-ronden hoppas medvetet över här (`skipCueRound` – ingen explicit trumf-
  överenskommelse före frågan, en cue kunde bli olaglig). I stället en **kontroll-
  gate** (`pairControlsSideSuits`): paret måste ha ess eller korthet i VARJE sidofärg
  innan slam-blasten, annars kunde RKC bjuda slam med två snabba förlorare i en
  objuden färg (bevisat i probe). Slamzon-porten (≥33 stödpoäng) + nyckelkortsporten
  (≥4/5) hindrar överbud på icke-slamhänder. Probe: av lästa DD-lösta går ~85 %+ hem.
  Facit `auction-slam-jumprebid.test.ts` (#29 → 6♣). 1080 test gröna, tsc rent.
- **2026-07-07** – **Systems-on över 2♣–2♦–2NT (kod, §4.4).** Efter öppnarens
  2NT-återbud (22–24) använder svararen nu samma konventioner som mot en naturlig
  2NT-öppning – **Stayman (3♣) och transfers (3♦/3♥) + Texas** – för att hitta
  4-4- och 5-3-högfärgsfit i stället för att blint bjuda 3NT (samma dags tidigare fix).
  Svararen bjöd väntebudet 2♦ (0–7 hp), så poänggränserna sänks två steg (utgång
  redan från 3 hp; 22+3 = 25). Återanvänder det befintliga 2NT-svarsmaskineriet
  via en `openerMin`-parameter (default 20 → naturlig 2NT-öppning byte-identisk):
  `respondTo2NT` / `openerRebidAfter2NTResponse` / `responderRebidIn2NTAuction`
  (`responses-2nt.ts` + `responder-rebids.ts`), hopbyggda i `strong-2nt-systemson.ts`
  och inkopplade i `buildAuction`. Effekt: ~30 % av alla 2♣–2♦–2NT-auktioner når
  nu en högfärgsutgång (4♥/4♠) som förr blev 3NT; svaga 5-färger signar av i 3♥/3♠
  i stället för 2NT. Facit `auction-2c-gameforce.test.ts` (4-4 Stayman → 4♥, 5-4 →
  högfärgsutgång). 1079 test gröna, tsc rent.
- **2026-07-07** – **2♣-öppningen håller sitt utgångskrav i live-lagret (kod, §4.4).**
  En utforskningsprob (300 000 givar) visade att **~64 % av alla ostörda 2♣-
  öppningar dog i DELKONTRAKT** trots att 2♣ är ovillkorligt utgångskrav (82 % av
  stoppen hade 23+ hp = rena kravbrott). Roten: `auctionForce` (`auction-live.ts`)
  kände igen 2/1 och rondkrav men **inte den starka 2♣-öppningens game-force** –
  `buildAuction` bygger bara ett par bud av 2♣-linjen och överlämnar resten, som
  passades bort. Fix: (1) ny 2♣-gren i `auctionForce` (game-krav tills utgång;
  undantag `2♣–2♦–2NT` = inbjudande) → `honorForce` driver vidare i stället för
  pass. (2) `respondToStrong2NTRebid`: efter `2♣–2♦–2NT` (22–24) bjuder svararen
  **3NT med 3+ hp** (22+3 = utgång), passar bara med 0–2. Delkontrakt-andelen föll
  **63,9 % → 1,7 %** (resten legitima bustar / korrekta 23–24-stopp). Full systems-
  on (Stayman/transfer över 2NT-återbudet) medvetet uppskjuten. Facit:
  `auction-2c-gameforce.test.ts` (6 givar, röda före). 1077 test gröna, tsc rent.
- **2026-07-06** – **Stark jämn hand når utgång efter minorhöjning i konkurrens
  (kod + §3/§5.10, felrapport #30).** Ägarbeslut (båda vägarna). (1) **Öppnings-
  uppgradering:** en jämn 19-hand med startpoäng ≥20 (många ess/kvalitetsfärger)
  öppnar **2NT** i stället för 1 i färg (`openings.ts`; facit i `openings.test.ts`).
  Fixade den rapporterade given: ♠AJ84 ♥AQJ9 ♦986 ♣AK öppnar nu 2NT → 3NT.
  (2) **Återbudsfix:** när vår minor höjs i konkurrens visar öppnaren en stark
  sangduglig hand med stopp – **3NT** (20+) / **2NT-inbjudan** (18–19), och höjaren
  accepterar 3NT med ett maximum (`openerStrongNTAfterMinorRaise` +
  `answerOpenerNTInvite` i `auction-live.ts`; facit i
  `auction-opener-minor-raise-nt.test.ts`). 1071 test gröna, tsc rent.
- **2026-07-06** – **Svagt hoppskift avskaffat (kod + §4.1/§4.2, felrapport #31).**
  Ägarbeslut. Svararen hoppade förr till 2♥/2♠ med en svag 6-korts högfärg (t.ex.
  1♦–2♥). Ny grundregel: när partnern har öppnat håller svararen budgivningen LÅG
  och bjuder den nya färgen billigast på 1-läget (1♥/1♠, rondkrav) så partnern får
  utrymme att beskriva sin hand – ett hopp berövar t.ex. 1NT. `respondToMajor` +
  `respondToMinor` (`responses.ts`) faller nu ned till 1-lägessvaret; öppnarens
  hantering av ett MANUELLT hoppskift (om ägaren själv hoppar) lämnas orörd i
  `rebids.ts`/`auction-interpret.ts`. Facit: `responses.test.ts` (svaga 6-korts-
  händerna + #31-handen ♠7 ♥KT6432 ♦Q4 ♣A986 över 1♦ → 1♥). 1062 test gröna.
- **2026-07-05** – **Starka upplysningsdubblingen: game-hopp borttaget + flerronds-
  fortsättning byggd (kod, live).** Ägarbeslut. (1) Det starka återbudet hoppar inte
  längre rakt till utgång – det bjuder färgen **lägst** (rondkrav); ett game-hopp mot
  en partner med 0 hp kan bli katastrof. (2) Ny KONTROLLERAD fortsättning i
  `auction-live.ts`: partnern **tvångssvarar** återbudet (stödstege med 3-korts stöd,
  annars egen/näst längsta objudna färg), den starka handen **dömer game på TP**
  (6+ färg & **22+ TP** = hopp till 3-läget = utgångskrav, annars lägsta nivå),
  partnern svarar 3-hoppet (utgång m. 1–2 stöd / 3NT nekar). Regler i §7.3. Ordet
  "monster" bannlyst genomgående (ägarbeslut) → "stark hand". *Öppen finslipning:*
  den starka handens dom **efter en stödhöjning** (partnern visade fit) körs på en
  medvetet konservativ default – se 👀 Bevaka i CLAUDE.md.
- **2026-07-05** – **Störd budgivning nedskriven i läsbara sektioner (§5.4, §7.8).**
  Redaktionellt (ägarmandat: allt som bottarna gör ska gå att läsa på sidan) –
  **ingen kodändring**. Tre live-beteenden som förr bara låg i koden/ändringsloggen
  fick nu egna sektioner: **§5.4** öppnarens rond-2 i inklämt konkurrensläge
  (delbit 6: pass / 3M / X=game try / 4M + partnerns svar), **§7.8 (a+b)** svar när
  motståndarna stör vårt 1NT (DONT) eller vår svaga tvåa/spärr (delbit 4), och
  **§7.8 (c)** straffdubbla deras flykt efter vårt 1NT + XX (delbit 5).
- **2026-07-05** – **Takeout Double fick en egen sektion (§7.3).** Redaktionell
  omstrukturering (ägarbeslut) – **ingen kodändring, inget ändrat botbeteende**.
  All upplysningsdubbling (takeout) samlas nu i **§7.3 Takeout Double**: grundfallet
  efter en bjuden färg (max 2 i deras, 3+ i var och en av de tre objudna, 10+), den
  starka 17+-handen (dubbla först, visa egen färg sedan), fallet efter två bjudna färger (4-4 i de två
  objudna, 10+) och takeout mot svaga tvåor (12/13/10) och spärrar (14+). Övriga
  dubblingar (negativ, responsiv, stöd) flyttades till **§7.4**; Lebensohl→§7.5,
  DONT→§7.6, konventionella öppningar→§7.7 (takeout-raderna där ersatta med en
  hänvisning till §7.3). Sidan "Budsystem" läser boken direkt, så sektionen syns
  live efter push.
- **2026-07-05** – **Felrapporter #20/#22/#23 + takeout-utbyggnad (live).** Fyra
  felrapporter avklarade: **#20** DONT-advancern relä:ar 2♦ (pass-eller-rätta) i
  stället för att passa singel-klöver, och inklivaren rättar till sin högre färg;
  **#22** stark svarare (19+ hp) tar utgång även mittemot en minimum-Ogust (4M med
  fit, annars 3NT); **#21** stängd som "inget fel" (botens pass var sund bridge);
  **#23** en 17+ stark enfärgshand upplysningsdubblar och visar sedan sin färg via
  ett **starkt återbud** (se §7.3). Samtidigt byggd **tvåfärgs-takeout**
  (1♦–P–1♥–X = 4+4+ i objudna, §7.3) och en takeout-bugg lagad: advancern kunde
  förr svara i motståndarnas egen färg – nu utesluts alla bjudna färger. **Medvetet
  EJ byggt:** den rena starka 17+-enfärgshanden *efter två bjudna färger* (kräver
  ändring i buildAuction-linjen – framtida jobb). Hela sviten grön, tsc rent.
- **2026-07-04** – **Felrapportering i Budvisningen (mergepunkt `213d90e`, live).**
  Samma `FelrapportDialog` som i Spela kort är nu inkopplad i Budvisningen
  (`Spela.tsx`): knappen "Rapportera fel →" dyker upp så snart auktionen budats
  färdigt – man behöver inte spela klart korten (görs ändå aldrig här).
  Kontraktet härleds ur buden (`contractFromCalls`), inga stick följer med.
  Dialogen fick valfria `title`/`intro`/`categories` så Budvisningen visar
  bud-specifik text ("Rapportera fel i budgivningen" + `BIDDING_REPORT_CATEGORIES`:
  Felaktig budgivning / Fel budförklaring / Fel slutkontrakt / Annat) utan att
  röra Spela kort-varianten. UI/verktygsändring – ingen budregel påverkad; hela
  sviten grön.
- **2026-07-04** – **R1 Fynd #2 delbit 6: öppnarens rond-2 i inklämt konkurrens­läge**
  (hela sviten grön, gren `feat/opener-competition-round2`). Efter partnerns enkla
  högfärgshöjning i konkurrens (`1M–(inkliv)–2M–(deras inklämda bud)`) fattar
  öppnaren nu ett riktigt beslut i stället för att falla till den grova off-book-
  catch-allen: **pass** (dött minimum) · **3M** (minimum + 6:e trumfen, lagen om
  totala stick) · **X = MAXIMAL DUBBLING** (game try, ~15–17 – motståndarnas bud
  klämmer bort cue-budet så X blir game try, INTE straff i just det läget) · **4M**
  (utgång, 18+). Partnern svarar X:et **4M** (accept, 8+ stödpoäng) / **3M**
  (avböjer, minimum). Golven speglar den ostörda `openerRebidAfterSimpleRaise`
  (15+ game try, 18+ utgång). Skopat till det INKLÄMDA läget (cue hamnar över 3M).
  Två detektorer i `decideCall`, FÖRE `maybePenaltyDouble` (maximal-dubblingens
  kända avvägning: straffdubblingen ges medvetet upp där). Ägarbeslut 2026-07-04
  (rättad från ett felaktigt cue-förslag – 3♥ är olagligt under 3♠). Facit före
  fix: `auction-opener-competition.test.ts`. Kvar av #2: öppnarens rond-2 när
  partnern bjöd ny färg/1NT, balanseringens lättnad, bredare flerronds-konkurrens.
- **2026-07-04** – **Revision R4 (gren `audit/r4-dok-ai`): rättat Bergen 3♣-golvet
  i boken.** Boken angav tidigare **3♣ = 7–10** samtidigt som **3♦ = 10–12** →
  talet 10 låg i båda. Koden (`responses.ts`) placerar en exakt 10:a i **3♦
  (limit)**, så bokens rätta intervall är **3♣ = 7–9, 3♦ = 10–12**. Endast
  redaktionell rättelse (§4.1-tabellerna + översikten) – **ingen beteendeändring**.
  Fynd #1/#3/#4/#5 lagade (facit först). **Fynd #2 delbit 1: DONT (§7.5) mot deras
  1NT inkopplad** i den levande budlådan (var kodad men aldrig anropad). **Ägar-
  beslut:** golv **8 hp i direkt sits, 6 hp i balansering** + rätt form
  (5-4+ eller 6-korts). Advancerns relä (2♣ efter X) + X-arens rättelse byggda så
  en DONT-X aldrig spelas som straffdubbling. Kvar av #2: takeout/Lebensohl mot
  svaga/spärr, Mathe, konkurrens efter våra egna öppningar. 1635 tester gröna.
- **2026-07-02** – **Felrapport #2–4 lagade: kravbud får aldrig passas** (testsvit
  1507, commit `df5bf21`, live). Tre spelade givar där bottarna passade bort krav:
  (1) **öppnarens svar på negativ dubbling** byggt (`openerAnswerNegativeDouble`,
  §7.3 "öppnaren svarar som på en upplysningsdubbling": utlovad hf billigast /
  hopp 16+ / NT med stopp / egen 6+ färg – aldrig pass) + **advancern höjer
  partnerns hoppinkliv spärrande med 3-korts stöd** (hoppinkliv lovar 6+ kort);
  (2) **öppnarens svar på fjärde färg** byggt (`openerAnswerFourthSuit`, §6.6-
  prioriteten: stöd / extra längd 6-4·5-5 / NT med stopp / höjning – aldrig pass,
  undantagen respekteras); (3) **svararens fortsättning i 2/1 GF** byggd
  (`responderRebidIn2over1Auction`, §5.3: fast arrival, försenat stöd, NT med
  stopp, andrafärgshöjning – aldrig pass under utgång; facket saknades helt i
  `responderSecondBid`). Alla tre givarna facit-låsta exakt ur rapporterna.
  **Beslut:** /felrapporter lämnar alltid en STANDARDRAPPORT (vad hände /
  anledning / fix / test) – inskrivet i kommandofilen.
- **2026-07-02** – **Flakigt MC-slutspelstest stabiliserat** (testsvit 729, endast
  testfil – motorn orörd). 6-korts NT-testet i `play-bot-smart.test.ts` föll ~1
  gång av 10–20: Monte-Carlo-röstningen samplar via `Math.random` och med 60
  sampel valde den ibland fel kort av ren slumpvarians. Seedskanning (30 seedar):
  60 sampel föll för 3/30, **100 sampel för 0/30**. Fix: sampelbudget 60 → 100 +
  deterministisk seedad slumpström (mulberry32 via `vi.spyOn(Math, 'random')`,
  återställd i `afterEach`). Verifierat: testfilen 20/20 gröna körningar,
  `npm test` × 3 = 729 passed. Commit `5117d3f`.
- **2026-07-02** – **FAS 11 – tänj MC-fönstret + webworker (av huvudtråden)**
  (testsvit 727). **Uppmätt** (riktiga givar): Monte-Carlo tog redan ~2 s vid 7
  kort och 8+ s vid 8 kort – på huvudtråden fryser det fliken. Lösning: (1) MC
  flyttad till en **webworker** (`mc-worker.ts`) → gränssnittet fryser aldrig,
  visar "Bot-hjärnan räknar (Monte Carlo) …" och faller tillbaka på tumregeln vid
  timeout/fel; (2) **adaptiv budget** (`mcBudget`): färre kort = fler sampel
  (billigare, bättre), 8 kort = bantad budget (~3,7 s); (3) **MC-fönstret tänjt
  7 → 8 kort** (nu ofarligt av huvudtråden). `usesMonteCarlo` avgör om ett drag
  räknas i workern eller inline. Verifierad i webbläsaren (worker hämtas med rätt
  base-path, postMessage-rundtur 37 ms, inga fel). Facit i `play-bot-smart.test.ts`.
- **2026-07-02** – **FAS 11 – "Varför?"-knapp (botten förklarar sitt kortval)**
  (testsvit 721). `play-bot.ts` fick `botCardReasoned`/`botCardSmartReasoned` som
  ger SAMMA kort som förut + en klartextsmotivering: utspel (§8.3 topp av sekvens
  vs. 3:e/5:e bästa), "cashar säker vinnare", "andra hand lågt", "ruffar aldrig
  partnern", "vinner billigast", och Monte-Carlo-draget ("delade ut N troliga
  lägen … flest stick i snitt"). De gamla `botCard`/`botCardSmart` är tunna
  wrappers (oförändrat beteende, alla tester gröna). Inkopplat i `Play.tsx`: efter
  varje botdrag visas "Öst spelade 3♣. **Varför?**" → klick fäller ut motiveringen.
  Verifierad i webbläsaren. Facit i `play-bot.test.ts`.
- **2026-07-01** – **FAS 11 pt 50 – signalavkodning (öppningsutspelet → hand-modellen)**
  (testsvit 717). Ny `signal-decode.ts`: motspelaren *läser* botens öppningsutspel
  och matar in slutsatsen i hand-modellen så Monte-Carlo-samplaren delar ut de
  dolda händerna troligare. Två **vattentäta**, ärliga slutsatser: (1) **längd** –
  boten leder ur sin längsta färg och en 13-kortshand har alltid ≥4 i sin längsta
  → utspelsfärgen ≥4 kort; (2) **honnör** – bara när det utspelade kortet bevisligen
  är utspelarens högsta i färgen (alla högre kort syns för den agerande) och är en
  honnör → utspelaren håller den touchérande honnören under (A→A-K, K→K-D, D→D-kn,
  kn→kn-10). Undviker A-D-kn-fällan (kn som 3:e bästa). **Ingen tjuvkik:** bara
  bottars utspel avkodas (deterministisk §8.3), aldrig människans (Syd).
  Hand-modellen fick ett **per-färg-HP-spann** (`suitHcp`) som samplaren
  (`monte-carlo.satisfies`) nu upprätthåller → den avkodade honnören placeras
  faktiskt hos utspelaren. Inkopplat i `botCardSmart`. Facit i `signal-decode.test.ts`
  (e2e: samplaren tvingas ge Öst D♥ efter K♥-utspel med A♥ synlig).
- **2026-07-01** – **FAS 11 pt 47–49 – facit-granskning av `signals.ts` mot §8**
  (testsvit 711). Alla encoders lästa mot systemboken → **svaren matchar facit**
  (honnörsutspel topp-av-sekvens, 3:e/5:e spotutspel, UDCA omvänd attityd/räkning,
  Lavinthal-sak). **Ingen kodändring.** Låste 14 tidigare oskyddade facit-beteenden
  i `signals.test.ts`: inre/längre honnörssekvenser (K-Q-10→K, A-K-Q-J→A),
  topp-utan-sekvens-fallbacken (A-J-10-9 → spot 3:e bästa), längre spotfärger
  (7-korts→lägsta, 8-korts→3:e), samt dubbelton/singel-spare för attityd/räkning/
  Lavinthal. Känd förenkling (som Rusinow, §8.4): inre sekvenser under en glapp-topp
  leds inte som honnör utan faller till spot – noterad, ej byggd.
- **2026-07-01** – Budmotorn: **FAS 10 (försvarsbud §7)** facit-granskad + klar
  (testsvit 644). Alla §7-verktyg lästa mot systemboken → **svaren matchar facit**
  (inkliv/Michaels/ovanlig 2NT, upplysnings-/negativ-/responsiv-/stöddubbling,
  Lebensohl, DONT, Mathe, svaga tvåor, Multi, spärrar). **Byggd lucka:**
  `advanceTwoSuiter` (`overcalls.ts`) – advancerns svar på partnerns tvåfärgsinkliv
  (Michaels / ovanlig 2NT), som saknades helt. **Ägarbeslut** (se §7.2 ovan):
  preferens till den längsta av partnerns färger (lika → högfärgen), aldrig pass
  ostört, contested → pass tillåtet. Facit i `overcalls.test.ts`. **Nästa gång:**
  FAS 11 kortspel/motspel-förfining.
- **2026-07-01** – Budmotorn: **FAS 9 (passad hand: Drury)** klar (testsvit 635).
  Facit-granskning §6.7: Drury-basen (`responses-drury.ts`) matchar systemboken –
  ingen textändring behövdes. **Byggd lucka:** `responderAnswerDrury` – svararens
  (passade handen) placering efter öppnarens Drury-återbud, inkopplad i
  `responderSecondBid`. Auktionen dog förut vid öppnarens 3M-utgångsförsök.
  **Ägarbeslut:** acceptera 3M med **stödpoäng ≥ 11** (`max(hp, dummyPoints)`),
  annars pass; öppnarens 2M-signoff / 4M-utgång passas. Signoff-auktioner stängs
  nu med svararens pass. E2e `1♥–2♦–3♥–4♥`. **Nästa gång:** FAS 10 försvarsbud.
- **2026-07-01** – Budmotorn: **FAS 8 (slamsystemet)** klar (testsvit 630, commit
  `340028a`): MSS-slam, facit-granskning §6.1–6.5, Gerber över 2NT, Exclusion när
  renons rankar över trumf.
- **2026-07-01** – Budmotorn: **FAS 6 (minorsystem) + FAS 7 (svaga öppningar)**
  facit-granskade och kompletta (testsvit 612). FAS 6: minor-regeln facit-låst,
  **svararens fortsättning efter inverterad minor byggd** (mot 3NT), svaga
  hoppskift verifierade (**ägarbeslut: inget 1♦–3♣**, §4.2 ovan). FAS 7: svaga
  tvåor/Ogust verifierade, **öppnarens feature-visning på spärr byggd** (§4.6),
  **Regel 2-3-4 inkopplad som sårbarhets-/kvalitetsgrind på spärröppningen**
  (ägarbeslut, öppningsstruktur: topphonnörer A/K/Q i den långa färgen – 3-läget
  ej sårbar ≥1/sårbar ≥2, 4-läget valfri/≥1; 12 HP-golvet orört). Presshöjning
  över spärr avvisad (bara utgångsvärden). **Nästa gång:** FAS 8 slamsystemet.
- **2026-06-25** – Systembok skapad. Öppningsbud + minor-regeln nedskrivna.
- **2026-06-25** – Avsnitt 4.1 (Svar på 1♥/1♠) nedskrivet: höjningar, splinter
  (3-läge=singleton, 4-läge=renons), Jacoby 2NT, svagt hoppskift (endast 1♥–2♠),
  semi-forcing 1NT med fortsättningsnot.
- **2026-06-25** – Jacoby 2NT-fortsättningen nedskriven (öppnarens återbud,
  renons via 4-läget, svararens cue-bids). Källmaterial (PDF) tas ur repot;
  `*.pdf` ignoreras framåt.
- **2026-06-25** – Jacoby-valen bekräftade: sidofärg = minst ess/kung (Cohen),
  3NT = 14–15. **Nästa gång:** splinter-fortsättningen i §4.1 – öppnarens väg
  mot slutkontrakt efter en splinter (nedvärdera vid slöseri mittemot kortfärg;
  annars cue-bid / 1430 RKC). Avvaktar ev. referens från ägaren.
- **2026-06-26** – Beslut: **Bergen-höjningar** införda (standard: 3♣ = 7–10,
  3♦ = 10–12, 3 i högfärgen = spärr) och splintern flyttad till **tvetydig
  splinter** (3♠ över 1♥ / 3♥ över 1♠; relä visar kort färg). §4.1 omarbetad:
  höjningsprinciper, båda svarstabellerna samt Bergen- och splinterfortsättning
  med slamvärdering (nedvärdera honnörer mittemot kort; annars cue-bid / 1430
  RKC). Källa: bridgebum.com. **Nästa gång:** för in övningar i appen som
  tränar Bergen + tvetydig splinter (JSON under `src/data/exercises/`), eller
  fortsätt systemboken med §5 (öppnarens återbud).
- **2026-06-26** – **Bergen game try** tillagd i §4.1: efter enkel höjning
  (1♥–2♥ / 1♠–2♠) bjuder öppnaren konstgjort **2NT** som utgångsförsök och
  svararen beskriver minimum/maximum + form/kortfärg. Källa: bridgebum.com.
- **2026-06-26** – §4.1 kompletterad på svarssidan: **direkt 3NT** på 1♥/1♠
  (13–15 hp, balanserad, exakt 2 i högfärgen, till spel) samt not om att
  **balanserad inbjudan utan stöd** går via semi-forcing 1NT → 2NT (direkt 2NT
  är Jacoby).
- **2026-06-26** – §4.2 (svar på 1♣/1♦) nedskrivet: 4-korts högfärger upp, 1NT
  6–10 ej krav, **inverterade minorhöjningar** (1m–2m stark 10+ krav, 1m–3m svag
  spärr), 2/1 GF, svaga hoppskift, 2NT 11–12 inbjudan, 3NT 13–15. Öppnarens
  fortsättning efter stark höjning (stopp-visning → 3NT). Källa: bridgebum.com.
- **2026-06-26** – Förkortningar införda i löptext: **hf** = högfärg, **lf** =
  lågfärg (definierade i §2). Konventionsnamn (t.ex. "Inverterad minor", "Minor
  Suit Stayman", "Minor-regeln") behålls oförändrade.
- **2026-06-26** – §5 påbörjad: allmänna principer (styrkenivåer 12–15/16–18/19+,
  reverse, hoppskift, 2NT 18–19) och §5.1 öppnarens återbud efter semi-forcing
  1NT (1♥/1♠), inkl. pass-möjligheten. Källa: bridgebum.com. **Nästa gång:**
  §5.2 återbud efter 1-läges färgsvar (t.ex. 1♣–1♥) och i 2/1 GF-budgivning.
- **2026-06-26** – §5 utbyggd: §5.2 öppnarens återbud efter 1-läges färgsvar
  (stöd/hopphöjning, ny färg, NT-stege 1NT=12–14 / 2NT=18–19, reverse 16+,
  hoppskift 19+, splinter) och §5.3 principer i 2/1 GF (naturligt/lugnt, fast
  arrival). Källa: bridgebum.com. **Nästa gång:** 1NT-öppningens svar (Stayman,
  transfers m.m.) eller §6-konventionerna en i taget.
- **2026-06-26** – §4.3 (svar på 1NT) påbörjad: översikt + **Stayman** (2♣,
  öppnarens 2♦/2♥/2♠) och **Jacoby-transfer** (2♦→♥, 2♥→♠, superaccept,
  svararens fortsättning). Källa: bridgebum.com. **Nästa gång:** Texas, Smolen
  och Minor Suit Stayman (2♠ + 4-läget) i §4.3.
- **2026-06-26** – §4.3 färdig: **Smolen** (1NT–2♣–2♦–3♥/3♠ = 4-5 i hf),
  **Texas-transfer** (4♦/4♥, utgång utan slamintresse) och **Minor Suit
  Stayman** (2♠, 5-4+ minorer) tillagda; översiktens 3- och 4-läges-svar
  definierade. Källa: bridgebum.com. **Nästa gång:** stark 2♣, svaga tvåor
  eller §6-konventionerna.
- **2026-06-26** – §4.4 (svar på stark 2♣) nedskrivet med **2♦ väntebud**:
  positiva svar (8+, 5+ färg), öppnarens återbud (2NT 22–24, 3NT 28–30,
  naturliga färgrebud krav) och **andra negativa** (billigaste minor 0–3 hp).
  Källa: bridgebum.com. **Nästa gång:** svaga tvåöppningar (2♦/2♥/2♠) eller
  §6-konventionerna.
- **2026-06-26** – §4.4 utbyggd med **följdbud vid träff och miss**: slamletning
  efter positivt svar (cue-bid → 1430 RKC, enkel höjning = slamintresse) och
  landning efter negativt/andra negativa (lågt färgrebud = ej krav, möjligt
  delkontrakt). Med exempel-budgivningar. Källa: bridgebum.com.
- **2026-06-26** – §4.5 (svar på svaga tvåor 2♦/2♥/2♠) nedskrivet: pass,
  spärrhöjning, ny färg krav, samt **Ogust** på 2NT-frågan (steg 3♣–3NT,
  min/max 6–8/9–11 + färgkvalitet). Källa: bridgebum.com. **Nästa gång:**
  spärröppningar (3-/4-läget) eller §6-konventioner (1430 RKC, cue-bid).
- **2026-06-26** – §4.6 (svar på spärröppningar) nedskrivet: ny färg = krav,
  höjning = spärr, 3NT till spel, 4NT = 1430 RKC; öppnarens feature-återbud;
  regel om 2-3-4. **Nästa gång:** §6 slamverktyg (1430 RKC, cue-bid).
- **2026-06-26** – §6 påbörjad: §6.1 **1430 RKC Blackwood** (5 nyckelkort,
  4NT-svar 5♣/5♦/5♥/5♠, trumfdam- och kungfråga) och §6.2 **cue-bid /
  kontrollbud** (först-/andra-rondskontroll, billigaste först, leder in i RKC).
  Källa: bridgebum.com. **Nästa gång:** Gerber, Sjöbergs 5NT, fjärde färg krav,
  eller försvarsbud (§7).
- **2026-06-26** – §6.3 **Sjöbergs 5NT** vald som kungfråga (svaret visar
  *vilken* kung, inte antal) och ersätter standard-kungfrågan i §6.1 – vi kan
  inte ha båda på 5NT. Källa: svenskbridge.se (RKCB 1430).
- **2026-06-26** – §6.4 **Gerber** nedskrivet: 4♣ = ess-fråga endast som hopp
  direkt över naturlig NT (svar 4♦/4♥/4♠/4NT), 5♣ = kungfråga; mot färgkontrakt
  används RKC. Källa: bridgebum.com. **Nästa gång:** fjärde färg krav, Drury,
  Michaels eller försvarsbud (§7).
- **2026-06-26** – §6.5 **Exclusion Blackwood (5-läges-voidwood)** tillagd
  (avancerad/valfri): hopp till 5-läget i sidofärg efter trumffit = renons,
  frågar nyckelkort utom renonsfärgens ess (1430-steg). Scopad till 5-läget för
  att inte störa splinter/Jacoby (regel: splinter tidigt/Exclusion sent, cue
  kryper/Exclusion hoppar). Källa: bridgebum.com.
- **2026-06-26** – §6.6 **fjärde färg krav** nedskrivet: fjärde färgen =
  konstgjord, krav till utgång (GF), partnerns svarsprioritet (3-stöd → extra
  längd → NT med stopp), samt när den är av. Källa: bridgebum.com. **Nästa
  gång:** Drury, Michaels, upplysningsdubbling eller försvarsbud (§7).
- **2026-06-26** – §6.7 **Drury (tvåvägs Reverse)** nedskrivet: passad hand över
  1♥/1♠ i 3:e/4:e hand; 2♣ = limithöjning 3 stöd, 2♦ = 4+ stöd; öppnaren
  rebjuder högfärgen = lätt (signoff), annars riktig öppning. Källa:
  bridgebum.com. **Nästa gång:** Michaels, upplysningsdubbling eller §7.
- **2026-06-26** – §7 påbörjad (försvar/konkurrens). Beslut: **DONT** mot deras
  1NT, och vi antar **negativa, responsiva och stöddubblingar** samt
  **Lebensohl** (utöver kortet). §7.1 inkliv & svar (cue = limithöjning+,
  1NT-inkliv återanvänder 1NT-systemet), §7.2 tvåfärgsinkliv (Michaels + ovanlig
  2NT, två zoner), §7.3 dubblingar nedskrivna. **Nästa gång:** §7.4 Lebensohl,
  §7.5 DONT, §7.6 mot stark 1♣/Multi/svaga tvåor/spärrar.
- **2026-06-26** – §7 färdig: §7.4 **Lebensohl** (2NT-relä, direkt = GF, "slow
  shows" stopp), §7.5 **DONT** mot deras 1NT (X/2♣/2♦/2♥/2♠ + advancer), §7.6
  mot stark 1♣ (Mathe), svaga tvåor (+Lebensohl), Multi 2♦ och spärrar. Källa:
  bridgebum.com. **Nästa gång:** §8 markeringar & utspel.
- **2026-06-26** – §8 (markeringar & utspel) nedskrivet: **UDCA** (omvänd attityd
  + räkning, ~2 stick), **Lavinthal**-sak, **3:e/5:e** spotkort-utspel och
  **standard honnörsutspel** (top of sequence). Rusinow + Smith Echo bortvalda
  men noterade som möjliga uppgraderingar. Därmed är **§1–§8 ifyllda**.
- **2026-06-26** – Redaktionellt för webben: §1 rensad (parnamn borttaget, källa
  dold, Bas utökad) och dokumenttiteln avidentifierad. Termen *kast* →
  **saka/sak** (ett sak, flera sak; sakar/sakat). Honnörsutspel (§8.3) flaggat
  för översyn. Budsystem-sidan i appen döljer §9 men loggen behålls i filen.
- **2026-06-26** – Honnörsutspel rättat (§8.3): **ess** (inte kung) leds från
  A-K – äkta top of sequence. Gör topputspelen entydiga (A = A-K, K = K-D);
  tvetydighetsnoten borttagen.
- **2026-06-27** – Budmotorn: **M3 klar**. Svar på 1♣/1♦ (§4.2) och 1NT (§4.3)
  i koden, samt **öppnarens återbud efter alla svar** (punkt 1–9): semi-forcing
  1NT (§5.1), Bergen game try + Bergen-fortsättning + splinter-relä + Jacoby 2NT
  (§4.1), 2-över-1 (§5.3), inverterade minorhöjningar (§4.2) och 1NT-grenens
  fullföljanden (Stayman/Jacoby/Texas/MSS, §4.3). Spela-fliken bygger nu hela
  ostörda auktioner. Detta är **kod**, inte systemändringar – systemboken
  oförändrad. Arbetslista för resten: **`docs/arbetslista.md`** (punkt 1–32).
- **2026-06-27** – Budmotorn: **punkt 10–12** (svararens andra bud) i koden
  (`responder-rebids.ts`): preferens/fortsättning efter semi-forcing 1NT (§5.1),
  Smolen + fortsättning efter fullföljd transfer/Stayman (§4.3), samt fjärde färg
  krav (§6.6). Auktionerna växer nu till fyra bud (~40 % av givarna). Kod, inte
  systemändring. **Nästa gång:** punkt 13 – svar på stark 2♣ (§4.4).
- **2026-06-27** – Budmotorn: **punkt 13** (svar på stark 2♣, §4.4) i koden
  (`responses-2c.ts`): svararens **2♦ väntebud** (0–7) + positiva svar (2♥/2♠/
  3♣/3♦ med 5+ färg, 2NT balanserad), öppnarens återbud (**2NT** 22–24 / **3NT**
  28–30 / naturlig **krav-färg**) och svararens **andra negativa** (3♣ med 0–3).
  Inkopplat i auktionsbyggaren (2♣ är nu en svarbar öppning). Avgränsning:
  NT-stegen över öppnarens 2NT (22–24) tas senare (överlappar §4.3). Kod, inte
  systemändring. **Nästa gång:** punkt 14 – svar på svaga tvåöppningar + Ogust (§4.5).
- **2026-06-27** – Budmotorn: **punkt 14** (svar på svaga tvåor 2♦/2♥/2♠, §4.5) i
  koden (`responses-weak2.ts`): svararens **spärrhöjning**, **ny färg (krav)**,
  **2NT Ogust** + öppnarens stegsvar (3♣/3♦/3♥/3♠/3NT enligt min/max + topp-
  honnörer) och svararens placering av kontraktet. Inkopplat i auktionsbyggaren
  (2♦/2♥/2♠ är nu svarbara öppningar). Avgränsning: minorfärgens placering efter
  Ogust (utgång på 5-läget) förenklad och flaggad. Kod, inte systemändring.
  **Nästa gång:** punkt 15 – svar på spärröppningar 3-/4-läget (§4.6).
- **2026-06-27** – Budmotorn: **punkt 15** (svar på spärröppningar 3X/4X, §4.6) i
  koden (`responses-preempt.ts`): svararen som kapten – pass, **höjning till
  utgång** (fit), **ny färg (krav)**, **3NT till spel** (stopp i sidofärger), samt
  öppnarens återbud på krav-ny-färg (stöd/rebjuden färg). Inkopplat i
  auktionsbyggaren (3C/3D/3H/3S/4C/4D/4H/4S svarbara). Avgränsning: 4NT (1430 RKC)
  och cue mot slam tas i §6 (punkt 18–19). Kod, inte systemändring.
  **Nästa gång:** punkt 16 – svar på 2NT-öppning + hantera 3NT-öppning.
- **2026-06-28** – Budmotorn: **punkt 16** (svar på 2NT-öppning + hantera 3NT-
  öppning) i koden (`responses-2nt.ts`). Viktig skillnad mot 1NT: 2NT (20–21) är
  **utgångskrav** så fort svararen har ~5 hp, alltså **inga inbjudningsbud** och
  konventionerna ett steg upp. Schema: **3♣ Stayman**, **3♦/3♥ transfer** (svag =
  signoff i delkontrakt, 11+ = slamintresse), **4♦/4♥ Texas** (6-färg, ren
  utgång), **3♠ minorfråga** (5-4 minorer, slam), **3NT** till spel, **4NT
  kvantitativ**, **6NT**. Öppnaren fullföljer Stayman/transfer/Texas/minorfråga
  och accepterar kvantitativ 4NT med max. **3NT-öppningen** (25–27): svararen
  placerar kontraktet (pass / 4NT kvantitativ / 6NT). Inkopplat i auktions-
  byggaren (2NT och 3NT svarbara). Avgränsning: exakta slamverktyg (RKC/Gerber/
  storslam) hör till §6 (punkt 18–20). Kod, inte systemändring.
  **Nästa gång:** punkt 17 – Drury (svar på 1♥/1♠ endast som passad hand, §6.7).
- **2026-06-28** – Budmotorn: **punkt 17–20** (Drury + alla slamverktyg) i koden.
  **Punkt 17 Drury** (§6.7, `responses-drury.ts`): passad hand över 1♥/1♠ →
  2♣ (limithöjning 3 trumf) / 2♦ (4+ trumf); öppnaren signalar lätt öppning genom
  rebjuden högfärg, annars utgångsförsök/utgång. Inkopplat i `buildAuction` via
  passad-hand-detektering. **Punkt 18–20 slamverktyg** (§6.1–6.5, `slam.ts`):
  1430 RKC-svar, trumfdam-fråga, cue-bid (billigaste 1:a-rondskontroll), Sjöbergs
  5NT-kungfråga (vilken kung), Gerber ess-/kungfråga och Exclusion (nyckelkort
  utom renonsfärgens ess). Byggda som rena, testade motorfunktioner; full
  inkoppling i en växande auktion kräver ett djupare auktionslager (öppnarens/
  svararens 3:e–4:e bud) som tas separat. Kod, inte systemändring.
  **Nästa gång:** punkt 21 – försvarsbud §7 (inkliv + svar), eller hoppa till
  kortspelet (punkt 28–30, DDS-solver) om ägaren vill spela ut korten.
- **2026-06-28** – Budmotorn: **punkt 21–27** (hela §7 försvarsbud + störd
  budgivning) i koden. **21–22** inkliv & tvåfärgsinkliv (`overcalls.ts`): enkelt/
  1NT-inkliv, Michaels, ovanlig 2NT, upplysningsdubbling, hoppinkliv + advancer.
  **23** dubblingar (`doubles.ts`): negativ, responsiv, stöd (exakt 3) + svar på
  upplysnings-X. **24** Lebensohl (`lebensohl.ts`): 2NT-relä vs direkt 3-läge,
  cue=Stayman, slow-shows-stopp. **25** DONT (`dont.ts`) mot deras 1NT. **26**
  försvar mot konventionella/svaga (`defense-conventional.ts`): Mathe, svaga tvåor,
  Multi 2♦, spärrar. **27** störd budgivning i `buildAuction`: LHO kliver in på
  riktigt och svararen reagerar (negativ dubbling/konkurrenshöjning/NT/redubbling);
  störda givar förgrenar av från det ostörda flödet (en konkurrensrond modelleras).
  Kod, inte systemändring. **Nästa gång:** kortspelet (punkt 28–30) – DDS double-
  dummy-solver + spelläge + markeringar/utspel (§8).
- **2026-06-28** – Visuell omgång (UI): "Spela kort" ritas om till ett **grönt
  filtbord i Synrey-stil**. Ny `src/components/PlayingCard.tsx` (riktigt kortface
  + burgundy baksida med vit kant). Du sitter Syd nederst; korten ihoptryckta så
  bara hörn-index syns, spelbart kort lyfts vid hover. **Träkarlen** läggs upp
  prydligt (Öst/Väst staplad vertikalt, Nord i grupper). **Trumfen** alltid på
  spelförarens högra hand sett från Syd, och **färgordningen alternerar svart/röd**
  (cykeln ♠ ♦ ♣ ♥ roteras med trumfen, `orderedSuits`). Deployad och verifierad
  live. Ren UI, ingen systemändring. **Nästa gång:** budlådan (auktion i fyra
  kolumner + färgkodade budknappar), sedan DDS-solvern (punkt 28).
- **2026-06-28** – Visuell omgång (UI): **polerad auktionsvy** (`AuctionView`).
  Rutnät V N Ö S med **zon/sårbarhet** (sårbart par rött), **giv-markör** ("giv ●"
  + "(du)" på Syd), **färgkodade bud** (Pass grön, Dbl röd, Redbl blå via
  `BidLabel`) och **inramat slutkontrakt**. Inkopplad i budträningen
  (`BiddingSession`, med `exercise.vulnerability`) och i **Spela-fliken** (ny
  `turnsToCalls` återskapar hela medurs-budföljden inkl. motståndarpassar).
  Ren UI, ingen systemändring. **Nästa gång:** visa samma auktionsvy på
  **"Spela kort"-fliken** (se docs/arbetslista.md → Visuellt/UI), sedan budlådans
  budknappar / DDS-solvern (punkt 28).
- **2026-06-29** – UI + brygga: **auktionsvyn på "Spela kort"-fliken**. Ny modul
  `src/lib/engine/auction-contract.ts` är bryggan mellan budmotorn och kortspelet:
  `dealForPlay` letar fram en giv vars (ostörda) auktion budats **klart** (motorns
  `open: false`), `finalContract` plockar slutkontraktet (sista kontraktsbudet) +
  spelföraren (den i kontraktssidan som **först nämnde färgen**). Kortspelet
  använder nu detta i stället för den fristående `pickContract`-heuristiken, så
  **budföljden som visas matchar kontraktet man spelar** (verifierat: 1♦–1NT–2♦ →
  spelar 2♦ av Väst). `AuctionView` ligger i en hopfällbar panel. `turnsToCalls`
  flyttad till samma modul och delas nu av Spela- och Spela kort-fliken (mindre
  dubbelkod). Tester: `auction-contract.test.ts` (7 st, inkl. 100-givars-invariant
  att sista budet = kontraktet). Städning: tog bort död `suitOfCall`/`SUIT_OF_CALL`
  i `responses-weak2.ts` (tsc nu helt ren). Ren kod/UI, ingen systemändring.
  **Nästa gång:** budlådans budknappar, sedan DDS-solvern (punkt 28) + punkt 30.
- **2026-06-29** – Kortspel: **förfinade bot-tumregler** (`play-bot.ts`). Tre
  klassiska doktrinregler ersätter det tidigare "vinn alltid om du kan":
  (1) **andra hand lågt** – när motståndaren leder och botten är näst på tur läggs
  lågt (spar honnörer) i stället för att vinna direkt; (2) **ruffa aldrig partnerns
  vinnande stick** – ny `lowAvoidRuff` kastar hellre lågt i en sidofärg än trumfar
  ett stick partnern redan vinner (eller slösar trumf utan att vinna); (3) **utspel
  = topp av honnörssekvens** (KQJ→K, QJ10→Q, AK→A), annars lågt från längsta färgen
  (spotkort i rad som 7654 räknas inte som sekvens). Tredje/fjärde hand vinner
  fortfarande billigast möjligt. Tester: `play-bot.test.ts` (8 st). De befintliga
  hel-utspelningstesterna (13 giltiga stick) är oförändrade. Ren logik, ingen
  systemändring. **Nästa gång:** DDS-solvern (punkt 28) + punkt 30 (markeringar/utspel).
- **2026-06-29** – Punkt 30: **markeringar & utspel (§8)** som rena, testade
  encoders i ny `src/lib/engine/signals.ts`. **§8.3 honnörsutspel** (`honorLead`):
  topp av en sammanhängande honnörssekvens (AK→A, KQ→K, QJ→Q, JT→J, AK
  dubbelton→A). **§8.3 spotutspel** (`spotLead`): 3:e bästa vid jämn längd, 5:e
  (=lägsta) vid udda, dubbelton→högsta. **§8.1 UDCA omvänd** (`attitudeCard`/
  `countCard`): attityd lågt=gillar/högt=ogillar, räkning lågt-högt=jämnt/
  högt-lågt=udda. **§8.2 Lavinthal-sak** (`lavinthalDiscard`): högt=högre övriga
  färgen, lågt=lägre. `leadFromSuit` (honnör före spot) är **inkopplat i
  bottens utspel** (`play-bot.ts`); botten leder nu §8-korrekt (t.ex. 3:e bästa
  ur en jämn 4-korts färg i stället för lägsta). Att LÄSA signaler (full
  försvarsstrategi) hör ihop med DDS (punkt 28). Tester: `signals.test.ts` (23 st).
  Ren logik, ingen systemändring. **Nästa gång:** DDS-solvern (punkt 28) – sista
  kortspelspunkten.
- **2026-06-29** – Punkt 28 (DDS-solver): först **research** – npm-paketen
  `bridge-dds` (kraschar i `CalcDDtablePBN`: `RuntimeError: null function` i
  Chrome/V8) och `@bridge-tools/dd` (fel wasm-sökväg, oklart resultat) är båda
  TRASIGA som publicerade. Därför **egen double-dummy-solver i ren TypeScript**
  (`src/lib/engine/dds.ts`) – inga beroenden, ingen WebAssembly, funkar på Pages.
  Teknik: alfa-beta med **nollfönster-binärsök**, **transpositionstabell** och
  **likvärdiga-kort-reduktion**. **Korrekthet bevisad** mot ett oberoende orakel
  (ren minimax på `play.ts`) över ~2000 små givar + kända fulla givar + mitt-i-
  spelet-ställningar. **Inkopplat:** "Visa facit"-knapp på Spela kort som visar
  spelförarens stick med perfekt spel från nuvarande ställning
  (`doubleDummyDeclarerRemaining`). **Avgränsning (prestanda):** en ren JS-DDS
  klarar inte tunga 13-kortsgivar (särskilt sang) på rimlig tid, så facit har en
  **nodbudget** (fryser aldrig gränssnittet) och blir tillförlitligt en bit in i
  given (få kort = snabbt); på utspelet kan det visa "för tung". Tester:
  `dds.test.ts`. Totalt 379 tester gröna. Ingen systemändring.
- **2026-06-29** – Slamverktyg (Steg 1 av 5): **Sjöbergs 5NT (kungfråga)
  inkopplad i den växande auktionen** (`slam-auction.ts`). Efter en högfärgsfit
  via Jacoby 2NT, när paret har alla fem nyckelkort + trumfdam i storslamszon
  (≥37), frågar kaptenen nu kungar med **5NT** (§6.3) i stället för att chansa
  rakt på storslam: en visad sidokung (öppnaren bjuder 6 i sidofärg) ger det 13:e
  sticket → kaptenen lyfter till 7; ingen kung (öppnaren bjuder 6 i trumf) → man
  stannar korrekt i 6; två+ kungar (öppnaren bjuder 7 i trumf) → storslam direkt.
  Detta rättar samtidigt det gamla beteendet som bjöd storslam helt utan sidokung.
  Tester: `slam-auction.test.ts` (5 st). Totalt 380 tester gröna. Ingen
  systemändring (motorn följer redan dokumenterad §6.3). **Nästa gång:** Steg 2 –
  cue-bid-rond före RKC efter högfärgsfit (se arbetslistan).
- **2026-06-29** – Slamverktyg (Steg 2 av 5): **cue-bid-rond före RKC inkopplad**
  (`slam-auction.ts`, §6.2). Efter en högfärgsfit i slamzon visar paret nu
  kontroller INNAN 4NT: kaptenen (svararen) cue-buddar billigaste första-
  rondskontroll (ess/renons) uppåt med `cheapestCueBid`, öppnaren cue-buddar
  billigaste kontroll ovanför, sedan frågar kaptenen 4NT RKC. Saknas kontroll
  hoppas ronden över (rakt på 4NT, som förut). Exempel ur systemboken realiseras:
  1♠–2NT–3♠–4♦–4♥–4NT–… **Avgränsning:** en cue-rond modelleras (kontrollvisning
  för realism/lärande); slutkontraktet styrs fortfarande av nyckelkortsräkningen,
  så RKC fångar redan ett saknat ess. Tester: `slam-auction.test.ts` (6 st, inkl.
  full auktion 1♠–2NT–3♠–4♦–4♥–4NT–5♦–6♠). Totalt 381 tester gröna. Ingen
  systemändring. **Nästa gång:** Steg 3 – minor-fit-slam (1430 RKC efter minorfit).
- **2026-06-29** – Slamverktyg (Steg 3–5 av 5, klart): resten av slamvägarna
  inkopplade i växande auktioner.
  **Steg 3 minor-fit** (`auction.ts`): `slamInvestigation` (suit-agnostisk) körs nu
  även efter **inverterad minor** (klöver-/ruterfit i slamzon) → 1430 RKC växer
  fram (ex. 1♣–2♣–3♣–4NT–5♦–6♣).
  **Steg 4 Gerber** (ny `nt-slam.ts`): över en naturlig 1NT frågar en slamsäker
  balanserad hand (18+ hp, ingen högfärg/MSS) ess med **Gerber 4♣** (§6.4) →
  ess-svar → placerar 6NT, eller 4NT om två ess saknas, eller kungfråga 5♣ → 7NT
  i storslamszon (≈37+). Kvantitativ 4NT (16–17) ligger kvar i den vanliga kedjan.
  Avgränsning: Gerber kopplas in över 1NT; över 2NT används tills vidare
  kvantitativ 4NT/6NT.
  **Steg 5 Exclusion** (`slam-auction.ts`): efter en **splinter** där öppnaren
  visat slamintresse (splinter-relä) kan svararen med en **sidorenons** hoppa till
  5 i renonsfärgen (**Exclusion**, §6.5) och fråga nyckelkort utom esset där →
  placerar 6/7 i trumf (ex. 1♠–3♥–3♠–5♣–5♦–7♠). Trygga avgränsningar (motorn har
  båda händerna och förkalkylerar): triggas bara när renonsfärgen rankar UNDER
  trumf (håller budnivåerna lagliga) och när det är slamsäkert (≤1 nyckelkort
  saknas); annars fortsätter den vanliga auktionen.
  Tester: `slam-auction.test.ts` + nya `nt-slam.test.ts` (13 nya, totalt 394
  gröna). Ingen systemändring (följer §6.1–6.5). **Nästa gång:** budlådans
  budknappar (UI), eller DDS-webworker (punkt 28).
- **2026-06-29** – UI (Spela kort, Feature 1 av 3): **två-klicks fan-ut vid
  kortspel** (`Play.tsx`). När det är din tur väljer första klicket på ett kort
  dess FÄRG – den fanas ut (gles + lyft + lätt förstoring) och övriga färger tonas
  ned – och andra klicket på ett kort i den valda färgen spelar det. Minskar
  felklick när korten ligger ihoptryckta. Gäller både Syd och träkarlen Nord (när
  du är spelförare). Verifierat i webbläsaren (första klick väljer/fanar ut utan
  att spela; andra klick spelar). Ren UI, ingen systemändring. **Nästa:** Feature 3
  (klickbara bud + ALERT) och Feature 2 (stegbar omspelning).
- **2026-06-29** – Spela kort (Feature 2): **stegbar omspelning** av en
  färdigspelad giv (`src/components/PlayReplay.tsx`). När given är slut byts
  livebordet mot en omspelning: alla fyra händer ligger upplagda **sorterade i
  färg** (som vid bordet) i respektive väderstreck – Väst/Öst som **staplade
  vågräta färgrader** (Fun Bridge-stil): en rad per färg, med varje färgs högsta
  kort fullt synligt INÅT mot mitten (Öst åt vänster, Väst åt höger) och de lägre
  intuckade utåt – och man stegar stick för stick
  (⏮ ◀ Föregående · Stick X/13 + vem som vann · Nästa ▶ ⏭, eller klicka ett kort
  för att hoppa dit). Mitten visar det aktuella sticket mot rätt väderstreck med
  vinnaren inramad; det aktuella stickets kort gulmarkeras i varje hand.
  Budgivningspanelen fälls dessutom ut automatiskt när given är klar så
  budförklaringarna (klickbara, Feature 3) finns till hands. Samtidigt:
  **träkarlen läggs nu upp i Fun Bridge-stil** – sidoträkarlen (Ö/V) ritas som
  separata vertikala färgkolumner sida vid sida i stället för en enda lång kolumn
  (`DummyHand` i `Play.tsx`). Färg- och sorteringslogiken är utbruten till delad
  `src/lib/cardLayout.ts` (`bySuit`, `orderedSuits`), använd av både bordet och
  omspelningen. Verifierat live (sidoträkarl i kolumner; omspelning färgsorterad,
  stegning fungerar). Ren UI, ingen systemändring. 398 tester gröna.
- **2026-06-29** – Spela kort/Budvisning (Feature 3): **klickbara bud + ALERT**
  i auktionsvyn (`AuctionView`). Varje bud med en känd förklaring går nu att
  klicka → en ruta under rutnätet visar *plats + bud + motorns förklaring*.
  Konstgjorda (konventionella) bud får ett litet blått **A** (alert) och en
  ALERT-tagg i rutan. Bedömningen görs i ny `src/lib/engine/alerts.ts`
  (`isAlertRule` på budmotorns regelnamn: transfers, Stayman, Jacoby 2NT,
  splinter, Bergen, RKC/Sjöberg/Gerber/Exclusion, cue-bud, Drury, Michaels,
  ovanlig 2NT, DONT, Lebensohl, Ogust, Smolen, fjärde färg krav, konventionella
  dubblingar m.m.). `ResolvedCall` bär nu valfria `rule`/`explanation`, ifyllda
  av `turnsToCalls` (motståndarpassar lämnas tomma → ej klickbara). Verifierat
  live: 1♥–1NT visade alert-A + "1NT (semi-forcing)". Tester: `alerts.test.ts`.
  Totalt 398 gröna. Ren UI/databrygga, ingen systemändring.
- **2026-06-29** – Buggfix (slam-cue): ägaren hittade i appen en olaglig auktion
  `1♥–2NT–4♦–4♣–…` på Spela kort. Cue-ronden (Steg 2) la alltid kontrollbudet på
  4-läget från klöver utan att kolla att budet var **lagligt** (högre än
  föregående). När öppnaren rebjudit en Jacoby-sidofärg på 4-läget (4♦) blev
  svararens 4♣-cue otillåtet. Fix (`slam-auction.ts`): `slamInvestigation` tar nu
  emot öppnarens återbud (`lastCall`) och cue-buddar bara lagligt ovanför det
  (annars hoppas ronden över → rakt på 4NT). Dessutom **stannar motorn nu i
  utgång i stället för att fråga RKC när paret saknar två nyckelkort** (≤3 av 5) –
  då blev "stanna i 5 i trumf" tidigare ett bud under RKC-svaret (särskilt
  minorfit). Tester: 2 nya regressionstester (`slam-auction.test.ts`). Totalt 396
  gröna.
- **2026-07-01** – Felsökning "spela kort" (ägaren hittade en giv där V/Ö borde
  spela slam men stannade i 3NT). Rotorsak i budgivningen: **2♣-öppningen var helt
  HP-styrd** (≥22 hp), så en stark FÖRDELNINGShand (få hp men lång stark färg)
  öppnade 1 i färg och behandlades sedan som minimum. **Beslut (ägaren): inför
  spelstick.** Nytt värderingsmått `playingTricks` (`evaluation.ts`): topphonnörer
  (EKD=3, EK=2, ED=1½ …) + långa kort (+1 per kort utöver det tredje i en färg med
  ess/kung att köra hem den på). En hand med **≥ 8½ spelstick öppnar nu 2♣**
  (`openings.ts`, regel `stark 2♣`) även med hp < 22 – "nära utgång på egen hand".
  Den balanserade 22+-regeln ligger kvar orörd. Spelsticken visas i handvyn bredvid
  HP/TP (`HandView.tsx`). Tester: 5 nya spelsticks- + 2 nya öppningstester, on-book
  bevisat orört (493 gröna). **Sparat till senare** (ägarens prio): (a) startkare
  1-lägesåterbud/hoppskift när en stark hand ändå öppnat på 1-läget, (b) ärligt
  giv-facit (perfekt spel från utspelet, inte "härifrån"), (c) DDS-optimal
  spelföring så toppstick faktiskt tas. **Nästa gång:** punkt (a) budgivning.
- **2026-07-01** – Budmotorn (**FAS 5 punkt 19–22, NT-systemet**), test-låst:
  **Stayman** – lagade inbjudnings-5-4-luckan (1NT–2♣–2♦ med 5-4 hf + 8–9 hp
  visar nu 5-korts hf naturligt på 2-läget, inte 2NT) och byggde **garbage
  Stayman** (svag exakt 4-4 hf + kort klöver → 2♣, passar svaret). **Transfers** –
  kärnan verifierad; byggde **5-5-högfärgsschemat** (transferriktningen kodar
  styrkan: svag→2♣, inbj→2♦ sedan 2♠, GF→2♥ sedan 3♥). **Smolen + Texas**
  verifierade oförändrat rätt. Två SYSTEMBESLUT (garbage Stayman JA; 5-5-schemat)
  nedskrivna i §4.3. +15 tester (574 gröna). **Nästa gång:** punkt 24/25
  (2NT-systemet + 3NT-öppningen), sedan punkt 23 (Minor Suit Stayman-fortsättning).
- **2026-07-01** – Budmotorn (**FAS 5 punkt 24–25, 2NT/3NT**), test-låst:
  2NT-systemet (20–21) och 3NT-öppningen (25–27) verifierade rätt (turerna 1–3:
  GF-schema + öppnarens fullföljande + placering av kvantitativ 4NT). **Byggde
  svararens turn 4 efter 2NT** (`responderRebidIn2NTAuction`): minorfit→utgång,
  ingen fit→3NT, 5-4 hf efter 2NT–3♣–3♦→**Smolen över 2NT** (speglar 1NT-varianten),
  svag transfer→pass. 2NT-auktioner löser sig nu helt på systemlinjen. +7 tester
  (581 gröna). Kod, inte systemändring. **Nästa gång:** punkt 23 (Minor Suit
  Stayman-fortsättning – svararens turn 4; slam-grenen hör till FAS 8).
- **2026-07-01** – **FAS 8 påbörjad – facit-granskning §6.1–6.5.** Alla sex
  slamverktyg i `slam.ts` genomlästa mot systemboken: **inget fel i svaren**,
  koden matchar facit exakt (1430 RKC, trumfdamfråga, cue-bud, Sjöbergs 5NT,
  Gerber ess/kung, Exclusion). Två luckor i facit-LÅSNINGEN täppta med 6 nya
  tester (Gerber kungfrågan 0/1/3/4 kungar + Exclusion steg 3–4). Ingen
  systemändring, ingen kodändring (618 gröna). **Nästa gång:** punkt 1 MSS-slam
  (slamfortsättning cue/RKC efter Minor Suit Stayman-minorfit).
- **2026-07-01** – **FAS 8 punkt 1 – MSS-slam.** Slamfortsättning efter
  `1NT–2♠–3♣/3♦` (minorfit garanterad – svararen har 4+ i båda minorerna).
  Ny `mssMinorFitContinuation` (`slam-auction.ts`), inkopplad i `auction.ts`.
  **Ägarbeslut: NT om säkert, annars minor.** Öppnaren är balanserad → NT-slam
  ger mer poäng och slipper stjälning: NT-säkert (alla hf har A/K/Q + svararen
  saknar renons) → 6NT (33–36 hp) / 7NT (37+ via Sjöbergs kungfråga), för svagt
  → 3NT. NT osäkert (en hf gapar / svararrenons) → minor-slam via cue→1430 RKC
  (6/7-minor), för svagt → 5-minorutgång (kan stjäla). Hela slamarsenalen. Döda
  4-minor-grenen bort ur `responder-rebids.ts`. +3 tester (621 gröna). Kod, inte
  systemändring. **Nästa gång:** punkt 2 (Gerber över 2NT) eller punkt 3
  (Exclusion när renonsfärg rankar över trumf).
- **2026-07-03** – **TP-steg E + F (SYSTEMÄNDRING, ägarbeslut efter
  exempelhänder).** **E: reverse/hoppskift på TP** (§5-principerna): styrkan
  räknas i **max(hp, startpoäng)** – form lyfter in i reverse- (≥16) och
  hoppskiftszonen (≥19), aldrig under hp (bekräftat mot bridgebum: reverse =
  "16+ points"). Byggda luckor: **öppnarens hoppskift efter 1-lägessvar fanns
  inte** (en 19-poängare utan fit rebjöd "2♣ minimum, ej krav") – nytt fack
  `hoppskift` (utgångskrav) i `openerRebidAfter1LevelResponse`; **svararens
  fortsättning efter hoppskiftet** byggd (placera kontraktet, aldrig pass) +
  pass-vakt efter reverse utan preferens (→ 2NT kravsvar). Semi-forcing-grenens
  reverse/hoppskift (§5.1) på samma golv. **F: lättöppningar i 3:e/4:e hand**
  (nytt §3-avsnitt): 3:e hand 1M med 10–11 hp (sårbar 11) + bra 5+ högfärg
  (≥2 topphonnörer A/K/Q); aldrig lätt minor/1NT; Drury skyddar. 4:e hand
  **regeln om 15** (hp + spader ≥ 15 → öppna, annars passa ut; ingen spärr i
  4:e hand under golvet). `classifyOpening` fick `seatOrder`, positionen trådad
  i `buildAuction`. +16 tester, facit FÖRE fix (13 låsta fel bevisade), on-book
  orört (1528 gröna).
- **2026-07-20** – **Felrapporterna #35–#39 betade (nya spåret "budgivningen mot
  perfekt", etapp 1).** **#35 (fix):** `strongDoubleContext` pekade ut FEL
  dubblare när BÅDA i paret hade X som första bud (upplysnings-X + responsiv X)
  – den sista vann, så partnerns fitvisande 4♠ lästes som "starkt återbud" och
  den redan begränsade handen tvingades "stödhöja" till 5♠. Nu utser den FÖRSTA
  dubblingen i tid dubblaren, och stödstegen i `advanceStrongDoubleRebid` går
  ALDRIG förbi utgång (samma princip som #33). Facit
  `auction-balancer-respects-game.test.ts`. **#37 (SYSTEMBYGGE, nytt §4.3-
  avsnitt):** öppnarens svar på svararens INBJUDAN i en 1NT-auktion fanns inte
  i den kanoniska linjen → föll till off-book-svaret som bjöd 3NT ("utan stöd")
  mitt i en Stayman-hittad hjärterfit, med fel förklaring. Ny
  `openerThirdBidIn1NTAuction` (`rebids.ts`, inkopplad i `auction.ts`): accept
  = över blott minimum (16–17; en 15:a med femte trumf uppgraderar), täcker
  Stayman-fit 3M / Stayman 2NT / transfer 3M / transfer 2NT (med 3-korts
  preferensrättelse till 3M på minimum). Facit `auction-nt-invite.test.ts`.
  **#38 (fix):** `buildAuction` STÄNGDE auktionen när advancern passade ett
  1-läges enkelt inkliv → öppnaren i utpassningssitsen fick aldrig
  återöppningsfrågan och sålde given i 1♠ med 15 hp + 6-korts topp-klöver. Nu
  lämnas auktionen öppen (finish(true)) så `openerReopensBalancing` (§7.1
  flerronds del B) tävlar 2♣. Facit i `auction-opener-reopen-balancing.test.ts`.
  **#39 (INGET FEL – bottarna friade av DD-facit):** ägaren trodde Ö/V missade
  3NT när ägarens 2♥-inkliv över 1NT dubblades (värden) och passades ut som
  straff – men DD säger 3NT = 2 BET (7 stick) medan 2♥X = 2 bet = **+500 i
  zonen**; straffen var rätt och bäst. Beteendet test-låst i
  `contested-openings.test.ts`. (#36 = mobil-UI, ligger kvar öppen i SENARE.)
  tsc rent, hela sviten grön.
- **2026-07-21** – **SYSTEMREVISORN byggd (etapp 2 i "budgivningen mot
  perfekt"; ingen budregel ändrad).** Mätrigg som slumpar givar, låter motorn
  bjuda ALLA fyra händerna, DD-löser och jämför slutkontraktet mot riktig
  par-poäng → objektiv missprocent + topplista över misstyper, omkörbar efter
  varje förbättring (samma frö = samma givar). Kod: `revisor.ts` (logik,
  enhetstestad med fejkad DD), `revisor-dds.ts` (orakel: npm-paketet
  `bridge-dds` = Bo Haglunds riktiga lösare i WASM som rent dev-beroende —
  egna TS-lösaren klarar inte helgivar i volym), `revisor.probe.test.ts`
  (körningen, REVISOR-gated så deploygrinden aldrig kör den). Körinstruktion +
  baslinjemätningen ("Mätning #1") i `docs/systemrevisorn.md`. tsc rent, hela
  sviten grön.
- **2026-07-21** – **Fel färg-spåret fix 1: "5♣-ryckaren" lagad (§5.6,
  live-lagret).** Revisorns största misstyp analyserad (alla 148 "fel färg
  med bet"-givar, mönstertabell i `docs/systemrevisorn.md`); värsta buggen:
  öppnaren DROG partnerns 3NT-avslut till 5♣ efter Stayman (t.ex.
  1NT–2♣–2♦–3NT–5♣ på Q985) — live-lagrets `partnerLastSuit` läste
  konstgjorda Stayman-2♣/3♣ och överföringar som naturliga färger, och
  `raiseWithFit`s minorutgångsgren kunde inte bjuda 3NT (upptaget) → 5♣.
  Två vakter i `auction-live.ts`: (1) `isArtificialNTResponse` — 2♣/3♣/
  överföringar direkt över egen sidas 1NT/2NT är ingen färg att stödja,
  (2) `partnerGameBidStandsUnopposed` — offBookResponse rör aldrig partnerns
  obestridda utgångsbud. Facit-test FÖRE fix (3 revisorsfrön låsta bet-5♣):
  `auction-stayman-not-natural.test.ts`. On-book orört; hela sviten grön.
  Mätning efter fix: se `docs/systemrevisorn.md`.
- **2026-07-21** – **Fel färg-spåret fix 2: 2♣-kravets minimi-steg väljer
  finaste färgen (§4.4).** Två delfel ur revisorns buggfamilj 2: **(a)**
  efter `2♣–2♦–3♣/3♦` bjöd svararen utan stöd/5-korts färg blint **3NT** —
  även på 0–1 hp med 4-korts högfärg(er) → sang från FEL (tomma) hand och
  4-4-högfärgsfits hittades aldrig (frö 20260958: 3NT −400 fast 4♥ bara går
  en bet). Nu visar `responderSecondBidAfter2C` (`responses-2c.ts`) billigaste
  **4-korts högfärg under 3NT** (hjärter före spader); utan fit bjuder
  öppnaren sangen = rätt hand. **(b)** svararen höjde öppnarens TVINGADE
  klöver-ombud (kravets "rebjuder egen färg" lovar bara 5+) på **dubbelton**
  i stället för att rebjuda sin egen 6-korts spader (frö 20260737:
  2♣–2♦–3♣–3♠–4♣–**5♣** bet, fast 4♠+1 = par 650). Ny vakt i `raiseWithFit`
  (`auction-live.ts`): dubbelton-"fit" slår aldrig en egen redan visad 6+
  färg → kravlogiken rebjuder den (4♠). Facit-test FÖRE fix (båda frön +
  enhetsfall): `auction-2c-finest-suit.test.ts`. tsc rent, hela sviten grön.
  Mätning efter fix: se `docs/systemrevisorn.md` (Mätning #3).
- **2026-07-21** – **Fel färg-spåret fix 3: cue-höjning i minor → 3NT före 5m
  (NY §5.11).** Revisorns buggfamilj 3 (frön 20260805/20260769): efter
  partnerns cue-höjning av vår minoröppning återgick öppnaren ALLTID
  billigast i färgen på minimum — även med jämn hand OCH stopp i deras färg
  — och cue-bjudaren utan eget stopp blåste 5m (en/två bet), fast 3NT från
  öppnarens sida var hemma (9 stick, 600; stoppet ♣K2/♦KT satt hos öppnaren).
  Nu bjuder `answerCueRaise` (`auction-live.ts`) **3NT med jämn hand + stopp
  i deras cuade färg** (bara minorfit — 4M orörd; gäller även maximum: cuet
  driver ändå till utgång, det här väljer den bättre). Minimiåtergången 3m
  betyder därmed ärligt "ojämn/inget stopp" → cue-bjudarens 5m är ett
  informerat val. Facit-test FÖRE fix (båda frön + stopp/max-enhetsfall):
  `auction-cueraise-3nt.test.ts`. tsc rent, hela sviten grön. Mätning efter
  fix: se `docs/systemrevisorn.md` (Mätning #4).
- **2026-07-21** – **Fel färg-spåret fix 4: tre konkurrens-fortsättningar
  (§4.5/§7.4/§7.7).** Revisorns buggfamilj 4, tre delfel: **(a)** advancerns
  svar på partnerns tvåfärgs-cue över deras svaga tvåa valde längsta sidofärg
  med klöver som lika-vinnare → **4♣ på tre hackor** fast 3♥ fanns en nivå
  lägre (frö 20260733: 4♣ tre bet, 5♥ hemma). Nu avgör **billigaste nivån**
  vid lika längd (`answerWeakTwoCue`, `auction-live.ts`) → exakt par. **(b)**
  öppnaren svarade partnerns negativa dubbling med **sang på minimum** bara
  för att stoppet fanns (frö 20260763: 11 hp → 2NT två bet). Nu kräver sangen
  på 2-läget+ ~15+; utan nivåhöjning föredras i ordning **annan objuden 4+
  färg** (4-4-fiten hittas, frö 20261351) → **eget 5-korts återbud** (2♦) →
  sang-med-stopp som sista utväg (`openerAnswerNegativeDouble`, `doubles.ts`).
  Följdbuggar (kalibrerade i tre mät-iterationer med frö-diff): ett TVINGAT
  billigt ombud i en färg som inte 1M-öppnats lovar bara 5 → ingen
  dubbelton-fit (`fitLengthNeeded`, `auction-live.ts`; gick ombudet UPP en
  nivå = 6+, eller lovade 1♥/1♠-öppningen redan 5+, räknas dubbelton som
  fit), och en dubbelton-höjning av ett tvingat ombud kräver **utgångsvärden**
  (13+ sp, `raiseWithFit`) — enkla/inbjudande dubbelton-höjningar pressade
  bara upp partnerns minimum en nivå (frön 20260847/20261251). **(c)** svararen krävde med **ny färg på 3-läget på 13 hp** mot partnerns
  svaga 2♥ (frö 20260774: tvingat 3♥ en bet fast 2♥ stod). Nu kräver ny färg
  på 3-läget ~15+ (2-läget kvar från 11); 11–14 utan fit och utan billig färg
  **passar** (`respondToWeakTwo`, `responses-weak2.ts`) — given slutar i Ö/V:s
  4♠-offring två bet = exakt par. Facit-test FÖRE fix (alla tre frön +
  enhetsfall): `auction-konkurrens-fortsattning.test.ts`. tsc rent, hela
  sviten grön. Mätning efter fix: se `docs/systemrevisorn.md` (Mätning #5).
- **2026-07-22** – **Fel färg-spåret fix 5: de två exponerade luckorna
  (§7.3/§7.4/§7.7).** Revisorns buggfamilj 4 pekade ut två kända luckor som fix
  4 exponerade. **(5a) Balansering över deras svaga tvåor** (§7.3/§7.7): i
  utpassningsläget (2♥–P–P–?) fanns förr bara takeout-X:et (golv 10, max 2 kort
  i deras färg) → 2♥–P–P–P såldes. Nu gäller "låna en kung" fullt ut:
  naturligt inkliv som ryms på 2-läget från **7 hp** (frö 20260770: 2♠ på 8 hp
  → 3♠ = par 140), offshape-X med **upp till 3 kort** i deras färg (frö
  20261342: X på 10 hp jämn), 2NT = **12–15** med stopp
  (`defendWeakTwo`/`conventionalDefense`, `defense-conventional.ts`). Plus
  **advancer-rabatten**: den som höjer ett balansinkliv över deras 2-läges+
  öppning räknar stödpoäng **−3** och kapas vid 3-läget utan äkta
  utgångsvärden (`partnerBalancedOverPreempt`/`raiseWithFit`,
  `auction-live.ts`; detektorn heter sedan F3 2026-08-07 `partnerBalanced`
  och gäller alla öppningsnivåer) — utan den blåstes 2♠-balanseringen till 4♠ bet (och
  fix 4-fröet 20260774 offrar nu billigare: 3♠ en bet i st.f. 4♠ två).
  Regressionsvakt: 8 hp med perfekt form balanserar fortfarande INTE (frö
  20261248 — N/S:s DD-smickrade 4♥ jagas inte). **(5b) Negativ-dubblarens
  invit-fortsättning** (§7.4): 9–12-handen passade öppnarens tvingade färgsvar
  (frö 20261354: 2♠ stod fast 5♦ 600 var hemma). Ny detektor
  `negativeDoublerContinues` (`auction-live.ts`): invit-preferens med 3-korts
  stöd för öppningsfärgen (frö 20261139: 3♥ → 4♥-fiten), egen 5+ färg
  billigast (frö 20261354: 3♦ → öppnaren höjer 5♦ = par; 6-korts från 9 hp,
  frö 20261179: 2♥ i st.f. 2♦ bet), eller 2NT med stopp; fit för den svarade
  färgen → höjningslogiken går före. **Kravsemantik justerad:** X + egen färg
  är EJ krav (dubblarens ombud) — `competitionForce` tvingar inte längre
  öppnaren att rebjuda över det (stresstestets orakel speglat; tröskeln för
  täckningsbeviset 20 → 5). Facit-test FÖRE fix:
  `auction-balansering-svag2.test.ts` + `auction-negx-invit.test.ts`. tsc
  rent, hela sviten grön. Mätningar: se `docs/systemrevisorn.md` (Mätning
  #6 + #7).
- **2026-07-22** – **Fel färg-spåret fix 6: fyra mönster ur mönsterjakten
  (§5.5/§5.9/§5.11/§7.1).** Ny mönsterjakt i M7:s 130 kvarvarande fel
  färg-givar (`REVISOR_EXAMPLES=500`) gav fyra rotorsaker: **(1) 5♣-utgångs-
  blåsen mot passad partner** (frön 20261090/20261409/20261459): `raiseWithFit`
  blåste minorutgång på 13–16 stödpoäng fast partnern (öppnaren) just PASSAT i
  konkurrensen → nu tävlande höjning billigast, aldrig invit/utgång mot en
  partner som senast passade (§7.1). **(2) Höjning lästes som ny färg** (frö
  20261112): svararens 4♥ i en färg öppnaren redan bjudit tolkades som "ny
  färg = rondkrav" → öppnaren drog partnerns utgång till 5♦ bet; nu är en
  färg vår sida bjudit en HÖJNING och utgångsbud lämnar inget rondkrav
  (`auctionForce`/`competitionForce` + stress-oraklet, §5.5). **(3) Tävlade
  över deras utgång** (frö 20261375): "öppnaren tävlar efter partnerns pass"
  bjöd 5♥ på 6-korts färg över deras 4♠ (−500) → återöppningen går aldrig
  över deras utgång (§5.9). **(4) Cue-höjaren blåste 5m på limit-värden**
  (frö 20260906): cuet lovar limit+; med under 13 stödpoäng mot öppnarens
  minimum-återgång passas nu (§5.11) — med utgångsvärden drivs som förr.
  Facit-test FÖRE fix (alla frön + starkare motexempel):
  `auction-felfarg-fix6.test.ts`. tsc rent, hela sviten grön. Mätning #8:
  se `docs/systemrevisorn.md`.
- **2026-07-24** – **Etapp 5 (missad utgång) fix 1+2: två mekaniska luckor
  (§6.6, §5.1).** Revisorns näst största post angripen. **(1) Svararens höjning
  av öppnarens ANDRA färg graderades inte** (frön 20260748/20261646): `fourthSuit`
  returnerade alltid den BILLIGASTE höjningen så snart svararen hade 4+ kort i
  öppnarens rond-2-färg, så `1♣–1♥–1♠–2♠` bjöds både på 6 hp och på 13 — öppnaren
  passade på minimum och utgången försvann. Nu gäller systemets vanliga stege på
  **stödpoäng** (`pointsWithFloor(..., 'support')`): under 10 = billigaste höjning,
  10–12 = hopphöjning (inbjudan), 13+ = utgång. Gäller HÖGFÄRGS-fit i icke-reverse-
  sekvenser; minorhöjningen (redan på 3-läget) och höjningen efter en reverse
  (öppnaren 17+, billigaste höjning redan krav) är oförändrade (§6.6). **(2) Öppnaren
  besvarade inte svararens inbjudan efter semi-forcing 1NT** (frö 20260843): den
  kanoniska linjen slutade vid svararens 2NT/3M → off-book-lagret PASSADE, så en
  14-hand med AQT863 sålde given i 2NT fast 4♠ var hemma. Ny `openerThirdBidAfter
  SemiForcing1NT` (§5.1): 15+ Bergenpoäng accepterar utgång, 2NT rättas ALLTID till
  högfärgen när återbudet lovat sex kort (6-2 spelar bättre än sang), och 2NT efter
  en ny färg (5-4-handen) är äkta sanginbjudan (14+ hp → 3NT). Facit-test FÖRE fix:
  `auction-missad-utgang.test.ts` (18 fall). tsc rent, hela sviten grön.
  **Mätning #9+#10:** snitt-tapp 289,5 → **288,1 p/giv**, missad utgång
  158 givar/53 050 p → **153/51 040**, exakt par 16,8 % → **17,0 %**; enda posten
  som växte är "för högt" (+2 givar/580 p — priset för de nya inbjudningarna).
  Detaljer i `docs/systemrevisorn.md`.
- **2026-07-24** – **Etapp 5 fix 3: "bra 15" i sang (§4.3, ÄGARBESLUT).** Ägaren
  fick de två värderings-golven ur förskanningen som frågor. **(a) 3M-inviten på
  platt 12 hp: golvet BEHÅLLS** (frö 20260942 = DD-smickrad; att sänka köper
  utgångar och betalar med bet) — ingen kodändring. **(b) 1NT-öppnarens
  2NT-accept på 15: accepteras som "kvalitets-15"**, inte som generellt sänkt
  golv. Ny `notrumpPoints` (`evaluation.ts`): startpoäng **+1 för tät
  honnörsklump (A-K-D i samma färg)** och **utan flathets-avdraget** (det gäller
  färgkontrakt). Används av 1NT-öppnarens accept både på den direkta 2NT-inbjudan
  (`openerRebidAfter1NTResponse`) och efter Stayman/transfer
  (`openerThirdBidIn1NTAuction`, sangfallet). Platt quack-15 avböjer fortfarande.
  Facit: fyra fall i `auction-missad-utgang.test.ts` (frö 20260744 → 3NT).
  **Mätning #11:** snitt-tapp **288,0**, missad utgång **151/50 640**, exakt par
  **17,1 %**.

- **2026-08-12 — Speldiagnosen S0, fynd 1 (frö 20260772):** cue-svarets färg
  efter upplysningsdubbling lovar exakt FYRA kort — `fitLengthNeeded`
  (`auction-live.ts`) räknar inte längre ett cue-svar mot "två bud = 6+", så
  advancern höjer aldrig utgång på dubbelton mot visade fyra (4♥ på A9 gick
  sex bet). Ny gren B i `answerStrongDoubleGameForce` (Part 4): cue-advancerns
  dom efter dubblarens LÅGA andra återbud — 3-korts stöd → utgång i färgen;
  annars 12+ hp med stopp i deras färg(er) → 3NT. Paragraf §7.3
  ("Advancerns svar"). Facit: `auction-konkurrens-fortsattning.test.ts`
  (20260772-läget + hela auktionen → 3NT).
