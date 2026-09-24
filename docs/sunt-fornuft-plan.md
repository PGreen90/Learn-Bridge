# Sunt förnuft-lagret — motorn ska inte passa blint (NU sedan 2026-09-22)

> **Ägarens oro 2026-09-22** (efter frö 20296021, där ♠AKQJ865 passade över
> 1♥–(2NT)): *"bekymrad allmänt om hur svag motorn är på att reagera … tänka och
> agera själv, inte bara slaviskt följa en förutbestämd budföljd."* Det var en av
> anledningarna till motorbytet.

## Diagnosen
Beslutstabellen (`auction-decide.ts`) är regler för KÄNDA lägen. Träffar ingen rad
blir det `pass (ingen regel)` i `decideCallTraced` — tystnad utan tanke. Det är
inte "tänka själv", det är "hitta inte regeln, passa". Motorbytet gav rätt
arkitektur (egen hand + auktionen, stol för stol); det som saknas är att tabellen
täcker lägena, och ett sista lager som resonerar när den inte gör det.

## Riggen (byggd 2026-09-22)
`src/lib/engine/sunt-fornuft.probe.test.ts` — budar N givar, fångar varje pass
utan regel och klassar läget ur `auctionFacts` + egen hand:

```
$env:SUNT='1'; npx vitest run src/lib/engine/sunt-fornuft.probe.test.ts
```
(valfritt `SUNT_N`, `SUNT_FROM`). Rapport: `revisor-output/sunt-fornuft.txt`
(+ `.json` för diff före/efter). Kategorierna A–N är HYPOTESER — läs exemplen.

**Första mätningen (8 000 givar från 20290001, 78 404 bud):** 30 421 pass utan
regel. De flesta är rätt (B "vi står i utgång" 3 255 · F1 "de står i utgång"
7 157 · J "inget att säga" 12 049). **K "krav ligger på mig" = 0** — inga
kravbud passas. De misstänkta:

| Kat. | Antal | Vad | Bedömning efter läsning |
|---|---|---|---|
| D2 | 127 | partnern bjöd, jag objuden med 6+ hp | **Hål 1 (bekräftat):** advancern över partnerns **svaga hoppinkliv** — utan stöd passar hon oavsett styrka (16–18 hp!), med 3+ stöd höjer hon ALLTID spärrande (4♣ på 18 hp med stopp, i stället för 3NT). 25 fall i mätningen, 15 med 10+ hp. |
| E2 | 944 | partnern bjöd senast, jag har bjudit, 12+ | Blandat. Bekräftade hål: XX-handen som sedan passar (20290030: 19 hp) · dubblaren som passar i utpassningssits med 16 (20290022). |
| G1 | 1 060 | de bjöd, vår sida tyst, jag har 12+ | Mest rätt (balanserad utan inkliv/X). Hål: stark hand efter deras 1x–1NT (20290076: 20 hp passar). |
| N | 1 038 | utpassningssits med 10+ | Mest rätt. Kandidat: balansering med 14–16 mot deras låga delkontrakt. |
| L | 80 | partnern dubblade, jag passar | Kan vara straff (rätt) eller tappat svar — läs. |
| M | 452 | de dubblade vårt bud, pass utan regel | Ofta rätt (pass = "spela"), men ingen regel säger det. |
| H / I | 898 / 1 417 | fit eller egen färg mot deras låga bud | Mest 6–9 hp, pass rimligt; läs de med 10+. |

## Läget
- **Hål 1 BYGGT 2026-09-22** (ägarens besked: 3NT 15+ med stopp · ny färg ej krav,
  5+ kort och 15+ · ordningen ok): `advance-jump-overcall.ts` + facit. D2 12+ gick
  32 → 19 i mätningen. Ägarens tillägg: med stöd men utan utgångsintresse
  behövs ingen höjning (pass); bjuder de 3x tävlar advancern 4m (fanns redan).
- **Nya kandidater ur resterna av D2:** advancern efter partnerns **2NT-inkliv över
  deras svaga tvåa** (20291006: 12 hp passar 2NT 15–18 → 3NT saknas) · advancern
  över partnerns inkliv av deras **svaga tvåa** (20290669, 20291572) · advancerns
  ANDRA tur när de bjuder vidare (20290750: 15 hp + solid 7-korts klöver passar
  två gånger).

## Kursändring 2026-09-22: resonemangslagret i stället för regel per hål
Ägaren om XX-handen: *"partnern bjöd inte om klövern → inte 5 klöver; dubblade inte →
inte 4-4 i objudna; kvar 4♠ 4♣. SÅHÄR vill jag att en dator ska kunna resonera. Behöver
vi regler? Om jag hela tiden säger hur den ska tänka, hur ska den lära sig?"* Ägaren
accepterar lång betänketid (budgivning får ta tid); vald form: **budget + tidigt stopp**.

**Metoden** (`resonemang.ts`): slumpa de tre andra händerna · behåll de där motorn
själv (decideCall) reproducerar varje bud och pass · buda klart varje behållen giv med
fyra bottar per kandidatbud · dubbeldummy (WASM) · snittpoäng för vår sida · stopp när
ledaren är >2 standardfel före. Ärlig inferens; väntevärde över allt handen kan vara.

**Klockat 2026-09-22:** hel auktion 0,6 ms · slump+filter 0,03 ms (0,4 % stämmer i
1♣–X–XX–1♠–P–P) · DD-tabell median 0,25 s, p90 0,8 s. 15 s ≈ 12–35 händer.

**Steg 1 KLART 2026-09-22** — proben `resonemang.probe.test.ts` (`RESONEMANG=1`,
`RESONEMANG_BUDGET`) på tio pass-utan-regel-lägen: nio får vettiga bud (X/2NT/3♣/3♥/
4♥/3♠), det tionde (pass över 2♥ efter XX) ser rätt ut; 100 händer gav samma val som
15 s i alla tio. Rapport `revisor-output/resonemang.txt`. **Två lärdomar:**
1. **Inferensen = regelboken.** Ägarens 1♣-giv: lagret såg "partnern ♣5,0" — motorns
   öppnare passar efter XX + deras flykt även med fem klöver, så filtret behöll dem.
   Ägarens slutsats kräver överenskommelsen "öppnarens pass förnekar 5 klöver". Ägarens
   roll framöver: sätta överenskommelserna (systemet), inte besluten.
2. **Partnern måste förstå budet.** XX-handens X över 2♥ gav bara +124 trots att 2♥
   går bet — partnern läser X som upplysning och bjuder vidare. Betydelser måste stå i
   systemboken innan ett bud lönar sig i simuleringen.

**Steg 2 KLART 2026-09-23:** WASM-lösaren (bridge-dds 1.4.0) FUNGERAR i webbläsaren, både
i dev och i produktionsbygget (tillfällig sida /dev-wasm, borttagen): identiska DD-tabeller
som i Node på tio frön, median 0,25 s, laddning 0,07 s (byggd) / 3,8 s (dev). Inga
konsolfel. (Kraschen "null function" från punkt 28 i arbetslistan gäller inte längre —
nyare Vite/paket.) Bunten växer ~0,5 MB om lösaren tas in; lägg den i egen chunk/webworker.
**Steg 3 BYGGT 2026-09-23 — inkopplat i "Spela mot datorn":** bottarna (N/Ö/V) i
`useGame.ts`: ger tabellen `pass (ingen regel)` och läget är värt att tänka på
(`vardAttTanka`: inte i utgång, 10+ hp / 6-kortsfärg / partnern bjöd + 6+) simulerar
boten i webworkern `resonemang-worker.ts` (WASM-DD, budget `RESONEMANG_BUDGET_MS`
= 12 s, tidigt stopp; deterministiskt frö ur giv-id + läge). Bordet visar
"[Stol] tänker …"; regelnamn `resonemang`, förklaringen = inferensen i klartext.
Fel/timeout → pass som förr. Verifierat live: 1♣–(X)–XX–(1♠)–P–(P) → Nord tänkte
~15 s och bjöd 2♦ (proben: 2♥/2♦/X inom felmarginalen), inga konsolfel. `bridge-dds`
flyttad till dependencies. **Inte** inkopplat: tävlingsbottarna (nattjobbet, Node) och
borden (server) — de budar fortfarande bara ur tabellen; kandidat till nästa steg.
**Bugg 2026-09-24 (lagad):** lagret körde även i Dagens tävling (samma `useGame`) → en
bot som tänkte bjöd annat än tabellen och servern (`api-src/_lib/validera.ts`, botbud =
`decideCall`) avvisade hela inskicket (✗ i "Dina givar", ägarens giv 4 i tävling #54).
Först `useGame(…, { resonera: !tavling })`; samma dag ägarbeslut "bottarna ska tänka även i
tävlingen" → **standardläget** (`resoneraBot`, `RESONEMANG_STANDARD`: bestämt antal händer
i stället för sekunder, frö ur egen hand + auktion, slumpen ur leken minus egen hand — samma
bud på telefonen, servern och i natten) + servern godtar tänkta bud (`botbudGodtas`) +
nattgranskningens budkontroll (`budAvvikelser`) + tänkande datorspelare och förscreening
(`botBud`). Genrep `GENREP=1` (`tavling-genrep.probe.test.ts`). "[Stol] tänker …" är en flytande bricka på
budlådans underkant (ägarbeslut 2026-09-24: budlådan får inte ändra storlek).
**Urvalsprovet 2026-09-23** (`RESONEMANG=1 RESONEMANG_URVAL=60 RESONEMANG_BUDGET=12000`,
~10 min, `revisor-output/resonemang-urval.txt`): 29 av 60 fick ett bud, ~19 vettiga och
~7 dumma. Två rotorsaker:
1. **Brus valdes före pass** — lagret tog högsta snittet även när ledningen var slump
   (1NT −63 mot pass −70 på 11 händer). **Lagat: pass-spärren** (`valjMotPass`,
   `PASS_MARGINAL` = 2, facit `resonemang.test.ts`): ett bud väljs bara om det slår pass
   med mer än 2 standardfel, parat hand för hand; tidigt stopp bara när beslutet också
   klarar spärren. Omprovet: 14 av 29 bud → pass, bl.a. alla brusfynd (1NT i levande
   auktion, 2NT = lågfärgerna med jämn 16, 2♣ i deras färg, 4♠ på partnerns spärrhöjning).
   Priset: några vettiga bud på 1,0–1,6σ blir pass som förr (2♠-inkliv, X med renons,
   X av 4♦, 3NT på partnerns 3♣) — mer tid/händer, inte lägre spärr, är botemedlet.
2. **Budet provas utan att fråga systemet vad det betyder** (kandidaterna = varje
   4+-färg, X, XX, billigaste sang). Kvar efter spärren: 2♠ på fyrkort med 18 jämn (X är
   rätt), X av deras 3NT, 2♦ på fyrkort över stark 2♣, XX med 8 hp. **Lagat:
   systemfiltret** (`systemKandidater` + `sakraStick`, facit `resonemang.test.ts`), ägarens
   besked 2026-09-23 ("2/1-systemet är nyckeln"):
   - naturligt färgbud = **5+ kort i alla färger, lång färg först**; höjning av partnerns
     färg med 3+;
   - **konventionella bud rör lagret aldrig** (Michaels, ovanlig 2NT, cue — läses ur
     betydelselagret; hade handen passat konventionen hade tabellen bjudit den);
   - **XX = 10+ hp**; naturlig **sang = jämn hand med håll** i deras färger (utom höjning
     av partnerns sang);
   - **upplysningsdubbling = högst 2 kort i varje färg de bjudit** (ägarbeslut 2026-09-24:
     P P 1♦ P / P 1♥ P 2♥ / P P ? med ♠K43 ♥862 ♦AKQ87 ♣65 — "dubbel finns inte, jag vill
     bjuda ruter"; för svag för 3-läget med 12, 3♦ med 15 — styrkan avgör simuleringen);
   - **X av deras utgång = värdera handen mot budgivningen:** mina + partnerns *säkra*
     försvarsstick, räknade på händerna som stämmer med budgivningen (ess/kung bara så
     många ronder som både spelföraren och träkarlen har kort — AK i en färg de är
     korta i räknas inte), ska räcka till bet. Annars stryks X.
   Omprovet: alla fyra kvarvarande dumma bud borta (X av 3NT stryks: 3,1 säkra stick,
   det krävs 5). Försvaret mot deras starka 2♣ (ägarens X = utspel klöver) → `docs/senare.md`.
Steg 1-lägena med spärren (`RESONEMANG=1 RESONEMANG_BUDGET=12000`, `revisor-output/resonemang.txt`):
åtta av tio oförändrade (ägarens 1♣–X–XX-giv bjuder fortfarande, alla bud ~4σ före pass).
Två blev pass: 19 hp-dubblaren i (P)–P–(1♥)–X–(2♥)–P–(P) (2NT 1,5σ på 35 händer, 2,4σ
på 100 — tidsbrist, inte fel bud) och 17 hp med AKQT83 efter (3♦)–X–(XX)–P–(P), som nu
lämnar 3♦XX (AK9 bakom spärröppnaren; 3♠ bara 0,9σ före även på 100 händer — försvarbart).
Fynd i tabellen, inte i lagret: öppnaren passar 1♦–1♥–1♠–2NT med 16 → egen tabellrad.
**Kvar (2026-09-24):** (1) läs första nattgranskningens rapport med tänkande bottar
(budkontrollen — väntat: inga budavvikelser) · (2) ägarens känsla för väntetiden vid
bordet (sänk `RESONEMANG_STANDARD.maxHands` till 16 vid behov) · (3) tabellraden
1♦–1♥–1♠–2NT med 16 (öppnaren passar inviten) · ~~(4) borden (server) har inte lagret~~
— **KLART 2026-09-24:** bordets server bjuder med `botBud` + DD-orakel i alla
vägar (drivFram, facit-linjen, läge 2), stannar vid slut budget i stället för
tumregler, `maxDuration: 60`; detalj `docs/bord-plan.md` "Bottarna = tävlingens
bottar". Bevaka: väntetiden vid vänner-bordet.

## Byggordning (ägaren godkände 2026-09-22)
Principen: **mät → facit → regel**, ett hål i taget. Aldrig en enda catch-all
som "bjuder på allt" — den skulle förstöra systemriktig tystnad.

1. **Advancern över partnerns svaga hoppinkliv** (hål 1) — tydligast och
   systematiskt. Struktur = ägarens besked (frågor nedan).
2. **XX-handen och dubblaren i andra tur** (E2/N-fynden): den starka handen som
   visat styrka och sedan tystnar.
3. **Stark hand efter deras 1x–P–1NT / låga delkontrakt** (G1/N): balansering
   eller direkt aktion med 14+.
4. **Det sista lagret:** när ingen rad träffar — egen bärande färg + ovisad styrka?
   fit + poäng för nästa nivå? gemensam utgångsstyrka ej uttagen? Annars pass MED
   motivering ("inget att tillägga: …"), så tystnaden också är ett beslut.
   Vakt: lagret får aldrig återöppna ett avslut (`partnerSignedOff`) eller bjuda
   över utgång utan slamregel.

Efter varje steg: kör riggen igen, diff mot `sunt-fornuft.json`, läs de nya
auktionerna (samma metod som ovanlig 2NT-genomlysningen).

## Frågor till ägaren — hål 1 (advancern över svagt hoppinkliv, t.ex. (1♠)–3♣–(P)–?)
Hoppinklivet lovar 6+ kort och 6–10 hp (§7.1). I dag: 3+ stöd → alltid 4♣ (spärr);
utan stöd → pass utan regel.
1. **Utan stöd, stark hand (15+ med stopp i deras färg):** 3NT? Från vilken styrka?
2. **Egen färg:** ny färg på 3-läget — naturlig och krav (5+ kort, 10+ hp)? Eller
   inget eget färgbud över en spärr?
3. **Med stöd och stark hand:** när är höjningen till 5m/4M utgång i stället för
   spärr (t.ex. 3+ stöd och 14+)? Cue i deras färg som utgångsintresse?
4. **Mellanhänder (10–14, utan stöd/stopp):** pass, eller något?
