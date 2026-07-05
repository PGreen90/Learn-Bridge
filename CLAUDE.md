# CLAUDE.md — Bridge-app
Läs den här filen först varje session.

## 🗺️ Projektkarta — NU / NÄST / SENARE / PARKERAT
> **Detta är överblicken. Läs den först.** `docs/arbetslista.md`, `docs/status.md`
> och felsökningsplanen är detaljnivån — kartan här styr ordningen.
>
> **Järnregel:** 🔵 NU innehåller **exakt en sak**. Inget annat rörs förrän den är
> klar. Kommer ägaren med en ny idé mitt i ett NU-jobb ska Claude **stoppa** och
> säga *"bra idé — men just nu är NU: X, den rör vi inte"*, och lägga idén i
> ⚪ SENARE. NÄST har max 3 saker. När NU blir klar: flytta upp en sak från NÄST,
> visa återstående punkter (regeln i `docs/arbetsrutiner.md`) och låt ägaren välja.

### 🔵 NU — ägaren pekar ut nästa NU (Steg A helt klart; järnregeln: exakt en).
> **HELA STEG A ÄR KLART & LIVE (2026-07-05):** Del 1 (Vercel-flytt) + Del 2
> (`rebidz.com`-domän) + Del 3 (PWA). Därmed är **Beslut A** i framtidsdoket
> avklarat. **NU är öppet — ägaren väljer nästa sak** (presentera återstående
> punkter ur `docs/arbetslista.md` + NÄST-listan, en väljs, järnregeln). **Beslut B**
> (konton/multiplayer/tävlingar) är ett separat, STORT spår — inte automatiskt näst;
> börja det bara på uttryckligt ägarbeslut (`docs/framtid-multiplayer-plattform.md`).
> Bra kandidater om ägaren är osäker: göra boten bättre (spela + felrapportera),
> R2:s datadrivna detektorkedja (`docs/status.md`), eller UI-förfining.
>
> **Del 3 (PWA) KLAR & LIVE (2026-07-05):** appen är nu installerbar ("Lägg till på
> hemskärmen" på iPhone/Android, egen guld-spader-ikon på emerald) + fungerar
> offline. `vite-plugin-pwa` (autoUpdate) genererar service worker + `manifest.webmanifest`
> vid Vercel-bygget; `index.html` har apple-touch-icon + iPhone-taggar; ikoner i
> `public/` (192/512/maskable/apple-touch). Verifierat i webbläsaren mot skarpa
> bygget (SW registrerad scope `/`, manifest laddat, inga konsolfel). 1052 test
> gröna. Mergepunkt `565bbc8`. Ikonerna genererades ur `public/favicon.svg`-designen
> (engångsskript m. `sharp`, borttaget efteråt; `sharp` ej kvar i deps).
> **Uppföljning (2026-07-05, mergepunkt `43640e2`):** sidhuvudet fick
> `pt-[env(safe-area-inset-top)]` (`Layout.tsx`) – i PWA-helskärm på iPhone låg
> toppen annars under statusraden (klocka/batteri). Marginal = enhetens statusrad
> (0 i vanlig webbläsare). Bekräftat lagom av ägaren på hans iPhone. `<main>` hade
> redan motsvarande safe-area i botten.
>
> **Del 2 KLAR & LIVE (2026-07-05):** egen domän **https://rebidz.com** köpt via
> Vercel (auto-DNS, auto-förnyelse 5 juli 2027, WHOIS-privacy) + kopplad till
> learn-bridge-projektet (Production). `rebidz.com` = huvudadress (visar appen,
> HTTPS ✅); `www.rebidz.com` → 308 till rebidz.com. Ren Vercel-konfig, ingen
> kodändring. **Nya publika adressen att dela = https://rebidz.com** (gamla
> `learn-bridge-topaz.vercel.app` lever kvar som reserv).
>
> **Del 2 KLAR & LIVE (2026-07-05):** egen domän **https://rebidz.com** köpt via
> Vercel (auto-DNS, auto-förnyelse 5 juli 2027, WHOIS-privacy) + kopplad till
> learn-bridge-projektet (Production). `rebidz.com` = huvudadress (visar appen,
> HTTPS ✅); `www.rebidz.com` → 308 till rebidz.com. Ren Vercel-konfig, ingen
> kodändring. **Nya publika adressen att dela = https://rebidz.com** (gamla
> `learn-bridge-topaz.vercel.app` lever kvar som reserv).
>
> **Del 1 KLAR & LIVE (2026-07-05):** hosting flyttad från GitHub Pages till
> **Vercel** (repo & felrapport-URL stannar `Learn-Bridge` på GitHub). Konkret
> gjort: Vite `base` `/Learn-Bridge/` → `/` (`vite.config.ts`); vakttestet
> `src/deploy-config.test.ts` låser nu `/`; ny `vercel.json` kör test-/typgrinden
> (`npx tsc && npm test && npm run build`) så trasig kod aldrig går live — samma
> skydd som förr; gamla Pages-workflowen (`deploy.yml`) INAKTIVERAD (push-triggern
> borttagen, `workflow_dispatch`-endast, filen kvar som referens). 1052 tester
> gröna. Mergepunkter `79fd1d0` (flytten) + `18efe8b` (Pages av).
>
> **⚠️ Två ärliga varningar (upprepa för ägaren):** (1) Steg A förbättrar INTE
> boten — bara var appen bor; bot-utvecklingen är ett SEPARAT framtida NU. (2)
> `/felrapporter` överlever flytten OFÖRÄNDRAT (`src/lib/felrapport.ts` bygger bara
> en länk till `github.com/PGreen90/Learn-Bridge/issues/new`; repot stannar).
>
> **Föregående NU (bredare flerronds-konkurrens A+B+C, R1 Fynd #2 sista delbit) är
> KLAR, PUSHAD & i synk med origin** (git verifierat 2026-07-05 — den gamla "EJ
> PUSHAT"-noten nedan är inaktuell). Ägaren överrörde järnregeln medvetet och bad
> om alla tre bekräftade fel i EN session.
>
> **Senast klart (2026-07-05, EJ PUSHAT — inväntar PCD): bredare flerronds-
> konkurrens (A+B+C).** Metod: en utforskningsprob körde 4000 slumpgivar genom hela
> den levande auktionen, plockade ut äkta flerronds-konkurrenser och blottade tre
> bekräftade fel (verkliga händer lästa som facit). Alla tre byggda facit-först:
> - **A — öppnaren säljer i rond 2 när partnern PASSADE inklivet + RHO konkurrerade**
>   (`1♣–(1♠)–P–(2♠)`): ny `openerReopensAfterPartnerPass` (`auction-live.ts`) – egen
>   6+ färg → tävla; 15+ & kort i deras färg → återöppnings-X. Vakt: ingen
>   motståndar-X + motståndarna ≥2 kontraktsbud (skiljer från felrapport #23).
> - **B — öppnaren säljer i utpassningssitsen** (`1♠–(2♥)–P–P`): partnern trap-passar,
>   öppnaren återöppnar. `openerReopensBalancing` (`auction-live.ts`) – kort i deras
>   färg → X (partnern konverterar till straff), egen 6+ → rebjud, 15+ → X. **Kärnfix
>   i `auction.ts`:** `buildAuction` STÄNGDE linjen (`open=false`) så snart svararen
>   passade ett inkliv → contested-blocket hoppades över. Nu `finish(true)` (öppen,
>   som takeout-X/Michaels-grenarna) → decideCall äger fortsättningen. Invariant-testen
>   hoppar över öppna linjer → inget on-book-brott.
> - **C — advancern tävlar upp till fiten** (`1♠–(2♥)–2♠–?`): ett 2-läges inkliv lovar
>   6+ → 3-korts stöd = 9-korts fit. `advancerCompetesToFit` (`auction-live.ts`, före
>   off-book-svaret) – tävla 3M (lagen om totala stick), 13+ stödpoäng → utgång, svag
>   → pass. (Skilt från `raiseWithFit` som krävde 4-korts stöd och hade bjudit 4M.)
>
> Facit: `auction-opener-reopen-passed.test.ts` (A, 3), `auction-opener-reopen-
> balancing.test.ts` (B, 4), `auction-advancer-compete-fit.test.ts` (C, 2) – alla röda
> före fixen. **1052 tester gröna, tsc rent.** budsystem.md §5.9 + §7.1. Verifierat
> end-to-end i proben: #159→3♣, #56/#552→2♥ dubblat (straff), #263→3♥. Se 👀 Bevaka.
>
> **Kvar/öppet efter detta:** R2:s förslag att göra detektorkedjan i `decideCall`
> datadriven (~28 steg nu) står kvar som ett EGET framtida NU – väg in det innan fler
> konkurrenslägen staplas på (`docs/status.md` "Budmotorns tre auktionslager").
>
> ---
> **Föregående NU-historik (KLARA & LIVE):**
> Föregående NU ("låna en kung" i balansering, §7.1) är **KLAR & LIVE**.
>
> **Senast klart & LIVE (2026-07-05, commit `f36d058`, deploy grön):
> "Låna en kung" i balanseringssits (§7.1).** I utpassningsläget (deras
> 1-lägesöppning + två pass) är partnern markerad med värden, så §7-inklivets
> HP-golv sänks med **en kung (−3)**: enkelt inkliv 8→5, upplysnings-X 12→9 (form
> 10→7), 1NT-inkliv 15–18 → **11–14** (klassisk återöppnings-1NT). **Flat HP-lättnad
> — §7-lagret behåller rå HP; TP-i-§7 avvisades medvetet (ortogonalt: TP=formspak,
> kung=sitsspak, och TP lyfter inte de PLATTA händer balansering finns till för).**
> `overcall` (`overcalls.ts`) fick en `balancing`-flagga; trådad från BÅDE
> `maybeOvercall` (`auction-live.ts`, live) OCH `buildAuction` (`auction.ts`,
> on-book balanseringsgren — annars passades given ut med open=false och nådde
> aldrig live). Direkt sits **exakt oförändrad** (relief=0). Facit
> `overcall-balancing.test.ts` (6: enhet + integration; direkt-sits-kontroller
> bevisar seat-specificiteten). 1043 tester gröna, tsc rent, deploy grön.
> budsystem.md §7.1. Se 👀 Bevaka.
>
> **Senast klart & LIVE (2026-07-05, commit `112f0fc`, deploy grön): Öppnarens
> rond-2 i störd auktion efter partnerns NYA FÄRG / 1NT (§5.8).** Systerfallet till
> delbit 6 (§5.4, som gällde partnerns *höjning*). Roten
> (bevisad i utforskning): så snart motståndarna bjöd om över partnerns fria svar
> passade öppnaren bort ÄVEN starka händer (rondkravet är tekniskt av då). Ny
> detektor `openerRondTwoInCompetition` (`auction-live.ts`, före `maybePenaltyDouble`
> + off-book-svaret). Ägarbeslut 2026-07-05: **visa extra med CUE i deras färg +
> naturliga hopp**; trösklar speglar delbit 6 (**15+ = extra, 18+ = utgång, 6:e
> kortet = tävla**). 18+ högfärgsfit → 4M; 18+ jämn m. stopp → 3NT; 15–17 högfärgsfit
> → inbjudande hopphöjning; 15+ i övrigt → **cue** (hitta rätt utgång); minimum m.
> egen 6+ färg/fit → tävla; annars pass. Styrka = stödpoäng med fit, annars ren hp
> (så en lång svag färg inte blåser upp handen). Facit
> `auction-opener-competition-response.test.ts` (9, röda före fixen). 1037 tester
> gröna, tsc rent, deploy grön. Se 👀 Bevaka.
>
> **Senast klart & LIVE (2026-07-05, commit `a989a08`, deploy grön): Störda krav
> (§5.5).** Steg 1 hedrade krav bara OSTÖRT; nu även i KONKURRENS. `auctionForce`
> (`auction-live.ts`) fick en egen gren (`competitionForce` + `isJumpBid`): ett
> **fritt bud (ny färg, ej hopp, ej cue)** och en **reverse** i störd auktion är
> **RONDKRAV** — partnern tvingas svara via `honorForce` i stället för att passa.
> Aldrig utgångskrav i konkurrens (ägarbeslut: ett inkliv "lånar" utrymme → 2/1
> lovar värden men ej garanterad utgång). Passad svarare / hopp / cue undantas.
> Facit: `foundation-forcing-competition.test.ts` (störda A/B/C, röda före fixen) +
> `.stress.test.ts` (10 000 seedade givar; rondkravet utlöstes 146 ggr, passades
> aldrig). Se 👀 Bevaka.
>
> **Senast klart & LIVE (2026-07-05, commit `ca04175`, deploy grön): New Minor
> Forcing (§5.7).** Efter `1m–1M–1NT` bjuder svararen (5-korts högfärg + 11+) den
> oanvända lågfärgen (2♣/2♦, konstgjort krav); öppnaren svarar (5 prioriteringar,
> passar aldrig); svararen placerar (13+ når alltid utgång). `responder-rebids.ts`
> (`newMinorForcingBid`, `responderPlaceAfterNMF`), `rebids.ts` (`openerAnswerNMF`),
> `auction-live.ts` (`nmfToAnswer` + `nmfPlacementToAnswer` tvångssvarare). Facit
> `new-minor-forcing.test.ts` (21). End-to-end: `1♣–1♥–1NT–2♦–3♥–4♥` hittar 5-3-fit.
>
> **Senast klart & LIVE (2026-07-05, commit `eca5ff0`): budsystemets grunder steg 1.**
> `auctionForce`/`honorForce` → krav passas aldrig OSTÖRT (2/1, ny färg, reverse);
> `raiseWithFit` → minorfit + utgångsvärden når utgång (3NT/5m). Facit
> `foundation-forcing.test.ts` A–D. budsystem.md §5.5+§5.6. **Detta NU utvidgar det
> till konkurrens.**
>
> ---
> **HISTORIK nedan (tidigare sessioner, KLARA & LIVE — behandla ej som pågående):**
> Kontraktväljaren (KLAR & LIVE):
>
> **ALLA TRE DELSTEG BYGGDA & VERIFIERADE (2026-07-05, ej pushat):**
> - **(1) Filtret + motor-fix.** `contract-target.ts` (`matchesTarget` +
>   `simulateAuction`). **Under bygget upptäcktes att motorn ALDRIG nådde 5♣/5♦**
>   (0 av 30 000) – äkta lucka, inte att kontraktet är ovanligt. **Lagat**
>   (ägarregel: utforska bara med en svag färg): svararen med lågfärgsfit + en
>   osparrad färg går inverterad 2m i stället för att chansa 3NT och landar i 5m
>   (`responses.ts` `hasWeakSideSuit`, `responder-rebids.ts` inverterad-minimum →
>   5m). Nu nås 5♣/5♦ ~1 per 54. `budsystem.md` §4.2 uppdaterad.
> - **(2) Sökaren.** `dealForTarget` (slumpa tills match, tak 60 000, null-fallback).
> - **(3) Menyn i `Play.tsx`.** "Mål:"-pill → `ScenarioPicker` (7 scenariokort),
>   batchad sökning (300/tick, setTimeout → fryser aldrig) med `SearchOverlay`
>   ("Söker … N prövade" + Avbryt + ge-upp-väg), målet sparas i localStorage
>   (`play-target`), "Ny giv" letar på samma mål. Random = som förr.
>
> 996 tester gröna, tsc rent, verifierat i webbläsaren (pill, väljare, sökning för
> lågfärg + storslam, ren konsol). **Kontraktväljaren = KLAR & LIVE, inga öppna
> punkter (ägaren godkände 2026-07-05).**
>
> **NÄSTA GÅNG (ägarbeslut 2026-07-05): 🔵 NU blir "Budsystemets grunder — varför
> de faller".** Ägaren vill gräva i budsystemets FUNDAMENT och förstå varför de
> brister (inte laga en rapport i taget utan hitta rot-mönstren). Startpunkt:
> felrapport #26 + #27 (nyss lagade) visade samma rot — motorn hedrar
> utgångskrav/rondkrav i sin FÖRPLANERADE linje men tappar dem OFF-BOOK (när
> ägaren öppnar/bjuder en annan hand än motorn valt). Fråga ägaren vilka
> grundregler som känts opålitliga i spel och bygg facit-givar som blottar
> mönstret innan något byggs om. (Kontraktväljaren = KLAR & LIVE, se nedan — inga
> öppna punkter kvar.)
>
> **Senast klart & LIVE (2026-07-05):** felrapport #26 + #27 lagade, pushade,
> deploy grön (commit `f9531b2`). Båda samma rot: utgångskrav passades OFF-BOOK.
> #26 → `answerCueBidderRebid` (cue-bjudaren fullföljer efter öppnarens svar);
> #27 → `answerTwoOverOneRaise` (svararen sätter utgång efter 2/1 som öppnaren
> höjt). 998 tester gröna. Se 👀 Bevaka. **Detta är den direkta ingången till
> nästa NU** (off-book-krav = ett grund-mönster som faller).
>
> **Senast klart & LIVE (2026-07-05, mergepunkt `1bec779`):** starka
> upplysningsdubblingens **flerronds-fortsättning** byggd, test-låst & pushad
> (`auction-live.ts`: `strongDoubleContext` + `advanceStrongDoubleRebid` +
> `strongDoublerSecondRebid` + `answerStrongDoubleGameForce`). Game-hoppet borttaget
> (kan bli katastrof mot 0 hp); partnern tvångssvarar (stödstege / utan stöd egen
> färg); den starka handen dömer game på TP (**6+ & 22+ TP → hopp till 3-läget**,
> annars lägsta nivå); partnern svarar 3-hoppet (utgång m. 1–2 stöd / 3NT nekar).
> TP-tröskel 22 = ägarval efter 6 exempelhänder. Ordet "monster" bannlyst. 976
> tester gröna, tsc rent, deploy grön. **Öppen finslipning (ägaren, i spel):** den
> starka handens dom EFTER en stödhöjning körs på en konservativ default – se
> 👀 Bevaka.
> **NÄSTA GÅNG börjar vi med:** ägaren pekar ut nästa NU (en sak, järnregeln). Bra
> kandidater: **nästa delbit av R1 #2** (se "Kvar" nedan) eller en punkt ur R6:s
> handlingsplan (`docs/audit/SLUTRAPPORT.md`) / NÄST-listan.
>
> **Senast klart & live (2026-07-05, dok-synk – commits `8d2d413` + `70660fb`):**
> ägarmandat *"all ändring i Budsystemet ska gå att läsa på hemsidan."* Budsystem-
> sidan läser `docs/budsystem.md` direkt (§9 Ändringslogg är dold), så live-regler
> som förr bara låg i kod/ändringslogg skrevs nu in i läsbara sektioner: **§7.3
> Takeout Double** (egen sektion; ordet för den starka 17+-handen borttaget på ägarens begäran – skriv "bra/stark hand"),
> **§5.4** öppnarens rond-2 i inklämt läge (delbit 6), **§7.8** när motståndarna
> stör vår öppning (delbit 4+5). Ingen kodändring – bottarna bjuder som förut.
>
> **Läget (2026-07-04, audit session 9 avslutad):** Hela revisionen R1–R6 KLAR +
> live (0 KRITISK, 2 HÖG båda i R1, 27/32 fynd lagade; slutrapport
> `docs/audit/SLUTRAPPORT.md`). Därefter startade R1 Fynd #2 (bredda störd
> budgivning) och **delbit 6 är byggd, mergad (`ce7f1cd`) och LIVE.**
>
> **Delbit 6 (LIVE):** öppnarens rond-2 i det INKLÄMDA konkurrensläget efter
> partnerns enkla högfärgshöjning (`1M–(inkliv)–2M–(deras inklämda bud)`): pass
> (minimum) · 3M (6:e trumf, lagen om totala stick) · **X = MAXIMAL DUBBLING (game
> try, 15–17)** · 4M (utgång, 18+); partnern svarar X:et 4M (accept, 8+ stöd) /
> 3M (avböj). Två detektorer i `decideCall`, FÖRE `maybePenaltyDouble` (X reserverat
> för game try där — konventionens kända avvägning). Facit:
> `auction-opener-competition.test.ts` (7 integrationstester). Se 👀 Bevaka nedan.
>
> **Sidospår klart & live (2026-07-04, mergepunkt `213d90e`):** felrapportering
> inkopplad i **Budvisningen** (`Spela.tsx`) — knappen "Rapportera fel →" dyker upp
> så snart auktionen budats färdigt (korten spelas aldrig där, så inga stick följer
> med; kontraktet härleds ur buden). Samma `FelrapportDialog` som i Spela kort, men
> med valfri bud-specifik text ("Rapportera fel i budgivningen" +
> `BIDDING_REPORT_CATEGORIES`). Detaljer: `docs/status.md`.
>
> **Kvar av R1 #2 (kommande delbitar, ägarstyrt):** ~~öppnarens rond-2 (§5.8)~~ +
> ~~balanseringens "låna en kung"~~ + ~~bredare flerronds-konkurrens (A+B+C, §5.9 +
> §7.1)~~ (ALLA KLARA 2026-07-05; A+B+C ej pushat än). **R1 Fynd #2 är därmed i
> praktiken helt genomarbetat** — bara delbit 3 (Mathe mot stark 1♣) förblir medvetet
> PARKERAD (irrelevant tills vi lägger till fler budsystem).
>
> **Öppna SENARE-poster ur revisionen:** R3 #3 del 2 (auto-facit på hela given —
> kräver webworker). (R3 #8 "Förra sticket" = OK/klar, ägarbeslut 2026-07-05 —
> struken.) Se ⚪ SENARE nedan.
>
> Färdigt & pushat arbete (alla "🎉 KLART"-block + FAS-historiken) bor nu i
> **`docs/historik.md`** — inte här. Detaljerad status: `docs/status.md`.

### 👀 Bevaka i spel (aktiva noteringar från nyligen byggt — säg till om det känns fel)
- **Flerronds-konkurrens A+B+C (§5.9 + §7.1, 2026-07-05, NYTT — EJ PUSHAT):** störda
  auktioner säljs inte längre billigt i rond 2+. (A) Öppnar du 1 i färg, de kliver in,
  partnern PASSAR och de konkurrerar (`1♣–(1♠)–P–(2♠)`) → du tävlar nu (egen 6+ färg,
  eller X med kort i deras färg) i stället för att passa. (B) Samma men de passar också
  (`1♠–(2♥)–P–P`) → du återöppnar i utpassningssitsen (X med kort i deras färg → **din
  partner kan konvertera till straff**; egen 6+ → rebjud). (C) Din partner klev in på
  2-läget och de hittade sin fit (`1♠–(2♥)–2♠`) → du (advancern) tävlar nu **3♥** med
  3-korts stöd (9-korts fit, lagen om totala stick). **Bevaka:** (a) återöppnar/tävlar
  boten lagom ofta, eller väcker den given för lätt? (b) C:s golv är **~8 stödpoäng** –
  en riktigt svag hand med 9-korts fit passar (medvetet, tävlar inte på en bust); vill
  du ha renodlad "lag om totala stick" (tävla nästan alltid med fiten) → säg till, det
  är en trösklsjustering. (c) B:s partner som trap-passar och konverterar till straff –
  slår det rätt (blir det verkligen en straff, inte en flykt som får spela billigt)?
- **"Låna en kung" i balansering (§7.1, 2026-07-05, NYTT & LIVE):** i
  utpassningsläget (deras 1-lägesöppning + två pass) kliver boten nu in ~3 hp
  lättare — enkelt inkliv från 5 hp, upplysnings-X från 9 (form 7), återöppnings-1NT
  11–14. **Bevaka:** (a) balanserar boten lagom ofta, eller väcker den given på för
  skräpiga händer? (b) 2-läges-inkliv på ~5 hp kan bli aggressivt (lättnaden gäller
  även där) — säg till om det svider. (c) advancern (som svarar balanseringen) vet
  ännu INTE att partnern kan vara en kung lättare → kan övervärdera tillbaka; en
  "advancer-rabatt" är en möjlig uppföljning. (d) den starka 15–18 jämna handen i
  balansering dubblar först (om form) i stället för 1NT; saknar den form (lång i
  deras färg) kan den passa — ovanlig kant, säg till om den dyker upp.
- **Öppnarens rond-2 i konkurrens efter partnerns ny färg / 1NT (§5.8, 2026-07-05,
  NYTT & LIVE):** öppnar du 1 i färg, partnern svarar en fri ny färg / 1NT
  och motståndarna bjuder om (t.ex. `1♥–(1♠)–2♣–(2♠)`), passar öppnaren inte längre
  bort en stark hand. Extra visas med **cue i deras färg** (15+, hitta rätt utgång),
  18+ med högfärgsfit → 4M, 18+ jämn m. stopp → 3NT, 15–17 m. högfärgsfit →
  inbjudande hopphöjning; minimum tävlar med en egen 6+ färg eller en fit, annars
  pass. **Bevaka:** (a) cue:ar boten lagom ofta (inte varje 15-poängare som borde
  passat)? (b) hittar den rätt utgång efter cuet, eller överbjuder den? (c) medvetet
  bortval: i det här läget väljs **cue framför straffdubbling** på extra-händer –
  säg till om en straffdubbling av deras bud borde ha varit rätt i stället.
- **Störda krav = RONDKRAV (§5.5, 2026-07-05, NYTT):** klev en motståndare in och du
  gjorde ett **fritt bud** (ny färg, t.ex. `1♦–(1♠)–2♣`) eller öppnaren **reverse:ade**
  (`1♣–1♥–(1♠)–2♦`), så passar din partner inte längre — hen tvingas svara med ett
  naturligt minimibud (`competitionForce`/`honorForce`). Men bara **rondkrav**: buden
  får stanna UNDER utgång (ett inkliv "lånar" utrymme). **Bevaka:** (a) svarar boten
  förnuftigt (rätt naturligt bud, inte ett tvångsbud som låter konstigt)? (b) driver
  den ALDRIG till utgång i onödan här (2/1 i konkurrens lovar värden men ej utgång)?
  Hopp, cue i deras färg och en passad svarare undantas medvetet — säg till om ett av
  dem borde ha tvingat fram ett svar ändå.
- **Utgångskrav får aldrig passas OFF-BOOK (felrapport #26 + #27, 2026-07-05,
  NYTT):** två luckor där boten passade en KRAV-auktion när du bjudit off-book
  (motorn hade planerat en annan linje). (1) **#26** – efter din cue-höjning
  (1♣–2♥–3♥) fullföljer din partner nu utgångskravet efter öppnarens svar
  (`answerCueBidderRebid`): 3NT med stopp i deras färg, annars utgång i den
  överenskomna färgen. (2) **#27** – efter ett äkta 2-över-1 (utgångskrav) som
  öppnaren höjer sätter svararen nu minst utgång även off-book
  (`answerTwoOverOneRaise`) – uppstod när Syd öppnade den svagare handen så
  motorns on-book 2/1-fortsättning aldrig fyrade. Bara off-book berörs; on-book
  orört. **Bevaka:** når boten rätt utgång (4M/3NT/5m) och blåser den aldrig för
  högt? Säg till om den t.ex. borde utforskat slam i stället för att bara sätta
  utgång.
- **Lågfärgsutgång 5♣/5♦ nu nåbar (Kontraktväljaren delsteg 1, 2026-07-05, NYTT):**
  motorn kunde förr aldrig bjuda 5♣/5♦ (valde alltid 3NT). Nu, efter inverterad
  minor: en svarare med lågfärgsfit + en **osparrad färg** utforskar via 2m och
  landar i **5m** när paret inte kan hålla alla färger (i stället för att chansa
  3NT). Ägarregel: utforska bara med en **riktigt svag** färg (♠xx/♥xxx utan
  honnör). **Bevaka:** (a) drar boten till 5m när 3NT egentligen var säkert? (b)
  chansar den fortfarande 3NT med en helt öppen färg? Trösklar i `responses.ts`
  (`hasWeakSideSuit`) + `responder-rebids.ts` (inverterad-minimum → 5m).
- **Motspelarens kast-vakt + 1NT-återbudsförklaring (felrapport #24 + #25,
  2026-07-05, NYTT):** (1) **spelfel #25** – en försvarare som sakar blottar inte
  längre en honnör i onödan: ny "motspelarens kast-vakt" (`play-bot.ts`
  `defenderGuardDiscard`) sakar hellre ur en färg UTAN skyddsvärd honnör (en J+
  som ännu kan slås av ett högre ospelat kort), ärligt räknat ur egen hand +
  träkarl. Löser bara honnörs-blottning; bredare försvarsinferens (kasta rätt när
  partnerns hand är okänd) är fortsatt SENARE. Säg till om vakten någon gång
  behåller fel kort. (2) **budförklaring #24** – öppnarens 1NT-återbud efter
  färgöppning beskrivs nu som "balanserad minimihand ~12–14 hp" (ej "svag");
  ingen ändrad budgivning, bara texten (`auction-interpret.ts`).
- **Takeout-doublingar (felrapport #23 + stark-hand-fortsättning + tvåfärgs-X,
  2026-07-05, NYTT):** (1) en **17+ stark enfärgshand** upplysningsdubblar en öppning
  och visar sedan sin färg via ett **starkt återbud** — färgen **billigast (rondkrav,
  inget hopp)**; hopp-till-utgång är borttaget (kan bli katastrof mot 0 hp). Hela
  **flerronds-fortsättningen är nu byggd & test-låst**: partnern tvångssvarar
  (stödstege m. 3-korts stöd: enkel/hopp/utgång/cue efter hp — annars egen 5+ /
  näst längsta objudna färg), den starka handen dömer game på TP (**6+ färg & 22+ TP
  → hopp till 3-läget = utgångskrav**, annars lägsta nivå), partnern svarar 3-hoppet
  (utgång m. 1–2 stöd / 3NT nekar). **⚠️ Bevaka särskilt:** den starka handens dom
  EFTER en **stödhöjning** (partnern visade fit) körs på en medvetet **konservativ
  default** (accepterar utgång med tydligt tillägg: hopphöjning→18+ hp, enkel
  höjning→21+; cue→utgång som minimum; slam-utforskning ej byggd) — ägaren ville
  finslipa detta i spel, säg till om trösklarna känns fel. (2) När motståndarna
  bjudit **två färger** (1♦–P–1♥) dubblar en **4-4-hand (10+)** de objudna färgerna;
  advancern svarar aldrig i deras egen färg. Regler i `docs/budsystem.md` §7.3.
- **Öppnarens rond-2 i inklämt konkurrensläge (R1 Fynd #2 delbit 6, NYTT):** efter
  `1M–(inkliv)–2M–(deras inklämda bud)` passar öppnaren inte längre blint. Med
  minimum + 6:e trumf konkurrerar den 3M; med utgångsintresse (~15–17) dubblar den
  (**X = maximal dubbling = game try**, INTE straff i det läget); med 18+ bjuder den
  4M. Partnern svarar X:et 4M (max) / 3M (min). Golv: 15+ = game try, 18+ = utgång
  (speglar den ostörda openerRebidAfterSimpleRaise). Säg till om X-som-game-try
  känns fel, eller om golven bör justeras.
- **DONT mot deras 1NT (R1 Fynd #2 delbit 1):** bottarna stör nu deras
  1NT-öppning med DONT (X/2-läget) — golv 8 hp direkt, 6 hp balansering. Säg till
  om det känns för aggressivt/passivt.
- **Försvar mot deras svaga tvåor/spärrar (R1 Fynd #2 delbit 2, NYTT):** bottarna
  kliver nu in mot motståndarnas svaga 2♦/2♥/2♠ och spärrar (3-läget+) — takeout-X,
  2NT (15–18), cue, naturligt, 3NT. Golv för takeout-X: 12 hp ej sårbar / 13 sårbar
  direkt, 10 hp balansering; mot spärr 14 hp (medvetet stramare — säg till om du
  vill lätta även spärr-balanseringen).
- **Svar när motståndaren stör VÅR öppning (R1 Fynd #2 delbit 4, NYTT):** när du
  öppnar 1NT och en motståndare stör med DONT svarar din bot-partner nu (X/XX =
  straff/värden från 8 hp, egen 5+ färg = naturligt, annars pass) i stället för att
  passa. När du öppnar en svag tvåa/spärr och de takeout-dubblar redubblar partnern
  med 10+ (värden) eller höjer spärrartat med fit. Säg till om golven (8 / 10)
  känns fel.
- **Straffdubbla flykten efter vår XX (R1 Fynd #2 delbit 5, NYTT):** öppnar du
  1NT, de stör med DONT och din bot-partner redubblar (XX = vi äger handen), så
  flyr motståndarna undan till en färg STRAFFDUBBLAR din sida dem nu — varje steg,
  tills de får spela dubblat — i stället för att passa flykten. Utlöses bara efter
  vårt 1NT + XX (inte efter svaga tvåor/spärrar — där äger vi inte handen). Säg
  till om det känns för aggressivt att dubbla varje flyktbud.
- **Straffdubbling mot ägaren:** bottarna kan nu straffdubbla ÄGAREN vid
  offringar på 3-läget+ (poängsystemet). Säg till om det känns för aggressivt.
- **Essfrågor utan formell trumf / toppsekvenser andra hand / 4M-pass efter
  transfer-3NT** (felrapport #10–#13) — nya bot-beteenden att hålla ögonen på.
- **Michaels & essfrågor i fria auktioner; motspelarna sparar torra ess**
  (felrapport #6/#7/#9).
- **Balansering mot ägaren:** bottarna balanserar nu även MOT ägaren
  (symmetriskt — korrekt bridge, men säg till om det känns fel; felrapport #5).
- **Öst över spärrhöjning** (1♣–2♥–X–3♥ → konkurrera 3♠ eller passa?): NYTT
  frivilligt läge, boten passar — ägarbeslut om det känns fel (felrapport #1–4).

### 🟢 NÄST (max 3, i ordning)
1. **Mer UI-förfining** — ägaren pekar ut vad när det blir aktuellt.

### ⚪ SENARE (oordnat — hämtas upp till NÄST en i taget)
- **TP till §7-inkliven (2026-07-05, ägarbeslut vid "låna en kung"):** §7-lagret
  (`overcall`, `advanceOvercall`, DONT, försvar mot svaga tvåor) räknar fortfarande
  **rå HP** — TP (form/fördelning) har aldrig nått dit. Att låta balanserings- OCH
  direkt-inkliv räkna TP är en riktig förbättring (en formstark 8:a kliver in), men
  **additiv** ovanpå "låna en kung" (som är sits-spaken), inte en ersättare. Eget
  test-låst steg (som TP-stegen A–F). Plockas upp när ägaren vill bredda TP till §7.
- **Advancer-rabatt efter balansering (2026-07-05):** partnern som SVARAR en
  balansering vet ännu inte att balanseraren kan vara en kung lättare → kan
  övervärdera tillbaka och driva för högt. En symmetrisk "räkna en kung mindre när
  du svarar en balansering" saknas. Plockas upp om en giv visar att paret överbjuder.
- **17+ stark enfärgshand EFTER två bjudna färger (takeout, 2026-07-05):** en 17+
  enfärgshand som borde upplysningsdubbla när motståndarna redan bjudit två färger
  (t.ex. 1♦–P–1♥) gör det INTE — där följer `decideCall` en färdig buildAuction-
  linje som passar handen, så live-hanteraren (`maybeTakeoutOfResponse`, som bara
  gör 4-4) når aldrig fram. Att tvinga den starka dubblingen där kräver att den
  generativa linjen i `auction.ts` (`buildAuction`) modellerar inklivet — ett
  grundläggande ingrepp. Öppningsfallet + 4-4-fallet är klara & live (felrapport
  #23, §7.3). Plockas upp om en giv bevisar att luckan svider.
- **Auto-facit på hela given i webworker (R3 fynd #3 del 2):** visa spelförarens
  double-dummy-optimum automatiskt i resultatdialogen. Byggdes synkront men
  backades — helgivs-DDS från utspelet är för tung (probe: 79/80 kontrakt gav upp
  efter ~1,7 s, spränger 2M-nodbudgeten → skulle frysa + nästan alltid "för tung").
  Kräver bakgrundstråd (mc-worker) med möjliga långa väntetider, eller snabbare
  lösare. Del 1 (budhint "Motorn hade valt X") är redan gjord + live.
- **Kanoniska linjen passar ut ostörda tvåfärgsinkliv** (fynd felrapport #7,
  2026-07-03): `buildAuction` (`auction.ts`) kan stänga en linje som
  1♠–2NT–P–P–P — advancern ska aldrig passa ostört (ägarbeslut FAS 10).
  Live-budlådan är lagad; luckan finns bara i förbyggda linjer (Budvisningen
  m.m.). Trä in `advanceTwoSuiter` i linjens konkurrensrond.
- ~~**Dubblingar (X/XX) in i slutkontraktet**~~ **KLAR 2026-07-04** (commit
  `0864224`, parallellsession): X/XX följer med genom `contractFromCalls` och
  poängräkningen (`scoring.ts` enligt ägarens poängguide) är byggd.
- ~~**Felrapportering: PAT-i-localStorage-varianten**~~ **KLAR & LIVE 2026-07-05**
  (skicka issuen direkt från appen utan att öppna GitHub). Ägaren sparar en snäv
  fine-grained GitHub-nyckel (Issues: read/write på Learn-Bridge) EN gång i
  Inställningar (`src/lib/github-token.ts`, egen lagringsnyckel `rebidz:felrapport-token`
  utanför `learnbridge:`-prefixet → överlever "Nollställ framsteg"). Finns nyckel →
  `FelrapportDialog` skickar direkt via GitHubs API (`submitFelrapport` i
  `felrapport.ts`, POST `.../issues`), knappen blir "Skicka rapport ✓" + kvitto;
  saknas nyckel → oförändrat (öppnar förifylld GitHub-sida). Fel → svenskt
  meddelande + reservknapp "Öppna på GitHub →". Samma nyckel kan användas på flera
  enheter. 1061 test gröna.
- **Svårighetsnivåer på bottarna** (ägarbeslut: SENARE, ej del av FAS 11 MED).
- **Bot-hjärnans B2 (cash-ordning) + Steg C (rätta räkningen)** — villkorade:
  byggs bara om en facit-giv bevisar behovet (`docs/bot-hjarna.md`).
- **Motspelarnas kast-vakt (honnörs-blottning KLAR 2026-07-05, felrapport #25):**
  försvaret sakar inte längre bort en honnörs gardering (`defenderGuardDiscard`).
  KVAR: bredare försvarsinferens (kasta rätt när partnerns hand är okänd —
  längdparitet, signalering, skvis-försvar) kräver inferens om partnerns hand
  (eget arbete). Plockas upp om en facit-giv bevisar behovet.
- FAS 9 Passad hand, FAS 10 Försvarsbud, FAS 11 Kortspel = **KLARA & pushade**
  (bara kvar här som historik — behandla dem inte som återstående arbete).

### 🅿️ PARKERAT (medvetet INTE nu — sluta väga in i beslut)
- **Slam-quirken** (~0,25 %, Jacoby 2NT→cue→RKC): känd gräns, stängs lagligt.
  Bekräfta bara att den fortfarande stängs — jaga den aldrig som bugg.
- **DDS-facit på tunga fulla givar:** känd gräns (nodbudget). Ej fel.
- **Off-book §7 bredd** (inkliv över 1NT/svaga tvåor/spärrar; balansering
  BYGGD 2026-07-03 via felrapport #5 — kvar här: "låna en kung"-lättnaden,
  dvs. lättare krav i balanseringssits än direkt sits).
- **"Framkalla slutbud"-väljaren** (ägaridé) + **webworker för DDS-facit**.
- **Mathe mot stark konstgjord 1♣ (R1 Fynd #2 delbit 3) — FRAMTIDSIDÉ, ägarbeslut
  2026-07-04.** Funktionen `defendStrongClub` (`defense-conventional.ts`) är
  färdig + enhetstestad men medvetet EJ inkopplad, för i vårt 2/1-system är 1♣
  en NATURLIG öppning (den starka handen öppnar 2♣) → en stark konstgjord 1♣ kan
  aldrig dyka upp, så Mathe har inget läge att utlösas i. Mot naturlig 1♣ räcker
  vanliga inkliv/upplysningsdubbling (redan inkopplat via `maybeOvercall`).
  **Plockas upp först den dag vi lägger till FLER budsystem** (t.ex. stark klöver/
  Precision) — då blir den relevant, antingen för att bottarna spelar systemet
  själva eller möter en motståndare som gör det. Kopplas då in på samma sätt som
  DONT/svaga-två-försvaret (detektor i `buildAuction`). Se
  `docs/audit/r1-budsystem.md` (Fynd #2, delbit 3).

## Arbetsrutiner (följ varje gång)
- **Vid sessionsstart:** följ 🟢-checklistan i `docs/arbetsrutiner.md`.
- **Vid sessionsslut:** följ 🔴-checklistan i `docs/arbetsrutiner.md`.

## Vad det här är
Interaktiv webbapp för att lära sig och spela bridge (kortspelet).
Användaren ska kunna spela olika händer och lära sig olika budsystem.
Allt körs i webbläsaren, gratis-hostat på Vercel (flyttat från GitHub Pages
2026-07-05, Steg A Del 1).
- **Appen heter `RebidZ`** i gränssnittet (ägarens eget namn, beslut 2026-07-02).
  **Repo och URL förblir `Learn-Bridge`** (medvetet – byt inte). Ser du "RebidZ" i
  koden och "Bridge-app" i äldre text är RebidZ det rätta produktnamnet.
- **Designriktning (låst):** Synrey-inspirerat uttryck, **emerald-palett**, egen
  stil tillåten bortom Synrey. **Spader är SVARTA (ägaröverride – ändra INTE
  tillbaka till konventionell färg).** Läs de verkliga färgerna i `src/index.css`,
  anta dem inte. Framtida plattform-ambition (konton/multiplayer): `docs/framtid-
  multiplayer-plattform.md` = PARKERAT tills ägaren säger "kör".
## Vem jag bygger för
Ägaren är nybörjare utan programmeringsbakgrund.
- Förklara på enkel svenska. Inga tekniska termer utan förklaring.
- Ett steg i taget. Vänta på bekräftelse innan du går vidare.
- När ägaren måste göra något själv (klicka, logga in, godkänna):
  säg exakt var och vad.
- Du skriver ALL kod. Ägaren läser den inte. Optimera för korrekthet
  och för att DU lätt ska kunna underhålla den över tid.
## Teknisk stack
- React + Vite + TypeScript
- Tailwind CSS för styling
- Ingen backend. Allt client-side.
## Hosting & deploy (viktiga låsningar)
> **HOSTING FLYTTAD TILL VERCEL 2026-07-05 (Steg A Del 1).** Gamla GitHub Pages-
> workflowen (`deploy.yml`) är INAKTIVERAD (`workflow_dispatch`-endast, filen kvar
> som referens). Fortfarande ENDAST statiska filer / client-side – ingen backend
> (det kommer i ett senare, separat steg enligt `docs/framtid-multiplayer-plattform.md`).
- Statisk/client-side hosting. Ingen server, databas eller backend-kod (än).
- Auto-deploy: **Vercel** bygger & publicerar automatiskt vid varje push till main
  (kopplat via Vercels GitHub-app). Ägaren kör ALDRIG bygg-kommandon själv – push
  räcker. Vercel-projekt: `learn-bridge` under teamet `rebidz` (Hobby/gratis).
- **Test-/typgrind före live (R5-fynd #1, nu i `vercel.json`):** Vercel-bygget kör
  `npx tsc && npm test && npm run build` (buildCommand i `vercel.json`). Rött test
  eller typfel → bygget failar → ingen publicering. Ändra aldrig bort den grinden –
  den är enda automatiska skyddet mellan koden och det som blir live.
- Vite `base` MÅSTE vara `/` (Vercel serverar från domänens rot), annars blir sidan
  blank. **Låst av ett vaktest** (`src/deploy-config.test.ts`, R5-fynd #2) – bryter
  du base failar testsviten. (På gamla Pages var det `/Learn-Bridge/`.)
- **Rollback & "senast gröna live" (R5-fynd #4):** varje funktion mergas med en
  egen `--no-ff`-mergepunkt → backa en hel funktion med
  `git revert -m 1 <merge-sha>`. Vilken commit som just nu ligger publicerad =
  den senaste **Ready**-deployen i Vercel-dashboardens "Deployments"-flik (märkt
  Production). Det finns ingen separat tag/markör i repot; Vercel-historiken är facit.
- Användarens framsteg sparas i localStorage (ingen databas).
## Bridge-specifikt
- "Rätt svar"-feedback via en double-dummy solver i WebAssembly
  (Bo Haglunds DDS, open source, kör i webbläsaren). Verifiera vilket
  npm-paket som är bäst underhållet innan du kopplar in det.
- Givar och budsystem ligger som JSON-filer i repot – aldrig
  hårdkodade inne i komponenterna.
- Budsystem: börja med ETT system, gör det ordentligt, lägg till fler
  senare. Bygg inte alla på en gång.
## Beslut
- Budsystem: **2 över 1 (2/1)**. Endast detta (lägg till fler senare).
- **TP i budvalet (beslut 2026-06-30, byggs i steg).** Boten ska tänka i
  totalpoäng (TP/fördelning), inte rå HP. **Låst regel:** en **12 HP-hand öppnar
  alltid** – TP får aldrig *nedgradera* en öppningshand (människor gör det extremt
  sällan). TP får däremot *uppgradera* (bra 11:a öppnar) och *nudga sang*. Omfång:
  brett (öppning → svar → återbud), men implementeras **i test-låsta steg** så
  on-book aldrig rubbas. **Steg A klart:** öppningsgolvet (`openings.ts`:
  `HP ≥ 12 || TP ≥ 12`). **Steg B klart:** svararens högfärgshöjningar räknar
  **stödpoäng = `max(HP, dummyPoints)`** (`responses.ts` `respondToMajor`) – Bergen
  fullt (singel +3 m. 4 trumf) men aldrig under HP, så korthet *lyfter* en höjning
  (11 HP + singel + 4 trumf → splinter) men platta händer nedgraderas aldrig.
  **Steg C-1 klart:** öppnarens **högfärgs-accepter** räknar **Bergenpoäng =
  `max(HP, bergenPoints)`** (`rebids.ts`: `openerRebidAfterSimpleRaise`,
  `openerRebidAfterBergen`, `openerRebidAfterSplinter`) – form lyfter mot game
  try/utgång/slamintresse, aldrig under HP (en formstark 11:a accepterar utgång
  mot en limithöjning). **Kvar:** C-2 = svararens/öppnarens **minorhöjningar** på
  TP, C-3 = **sang-accepter**, D = TP-nudge för **sangöppning**. Ägaren vill ge
  **mänsklig input i konkreta budsituationer** löpande – fråga hellre än gissa.
- **Spelstick i öppningen (beslut 2026-07-01).** Nytt värderingsmått `playingTricks`
  (`evaluation.ts`): honnörer + långa kort (+1/kort över 3 i en färg med ess/kung).
  En hand med **≥ 8½ spelstick öppnar 2♣** (stark) även med HP < 22 – starka
  fördelningshänder (lång stark färg, få hp) tas nu om hand i stället för att öppna
  1 i färg och tolkas som minimum. Balanserade 22+ oförändrat. Visas i `HandView`.
  **Kvar (ägarens prio):** starkare 1-lägesåterbud/hoppskift när en stark hand ändå
  öppnar på 1-läget; sedan ärligt giv-facit + DDS-optimal spelföring (uppskjutet).
- Första funktion: **budträning** – visa hand, välj bud, appen ger facit.
- Nästa stora riktning: **Spela mot datorn** (offline mot bottar; kvalitet före tempo).
- **Målgrupp (beslut 2026-06-30): erfaren spelare** – en pålitlig, robust 2/1-
  partner/motståndare (inte nybörjarträning först).
- **PIVOT (beslut 2026-06-30): tolkande budmotor.** Roten till "stel/inkomplett/
  felaktig" var att motorn är **generativ** (hand → en kanonisk rad). Vi bygger ett
  **tolkande** lager (`src/lib/engine/auction-interpret.ts`) som läser den faktiska
  auktionen. **Steg 1+2 klara & live:** egna/off-book-bud får ALLTID en förklaring.
  **Steg 3 klart (kärnan):** `decideCall` lämnar ideallinjen när Syd bjuder
  off-book (`divergedFromLine`) och datorpartnern svarar historiedrivet
  (`offBookResponse`): stöd m. fit graderat efter stödpoäng (3-korts fit för
  öppnad högfärg, annars 4+; enkel/inbjudan/utgång), annars egen färg/sang.
  On-book bevisat oförändrat. **Konkurrens-fortsättning klar:** `decideCall`
  svarar historiedrivet även när linjen tagit slut men auktionen är öppen
  (`built.open`) – störda auktioner dör inte längre efter en rond; partner +
  advancer konkurrerar vidare. **§7-inkliv i budlådan klart:** när auktionen gått
  off-book kliver motståndarna in på RIKTIGT via `overcall` (`maybeOvercall` i
  `auction-live.ts`) i stället för att tystna – men bara DIREKT sits (motståndaren
  öppnade nyss 1 i färg, vår sida har inte sagt något). Inkliv/X/Michaels/ovanlig
  2NT ur §7-motorn. *(Balansering + inkliv över 1NT/svaga tvåor/spärrar byggdes
  senare – R1 Fynd #2 delbit 1–2, live. Slam-quirken är en känd, laglig gräns, se
  🅿️ PARKERAT. Vad som är NÄST styrs av projektkartan högst upp, inte av denna rad.)*
- Budmotor byggs i `src/lib/engine/`, test-drivet (`npm test`).
- **Innan du rör budlogik:** läs "Budmotorns tre auktionslager + `open`-handoff"
  i `docs/status.md` — det avgör om ny logik hör hemma i `auction.ts` (on-book),
  `auction-live.ts` (konkurrens/off-book) eller `auction-interpret.ts` (förklaring).
- Detaljerad implementationsstatus: **`docs/status.md`**
- Byggordning framåt: **`docs/arbetslista.md`** (NB: pivoten ovan går före den gamla
  FAS-ordningen i felsökningsplanen).

## Konkreta fakta om detta projekt (för deploy)
- GitHub-repo: **PGreen90/Learn-Bridge** (publikt). Repo-namnet byts INTE.
- Live-URL: **https://rebidz.com** (egen domän, Steg A Del 2 klar 2026-07-05;
  `www.rebidz.com` → 308 hit). Reserv: `learn-bridge-topaz.vercel.app`. Gamla
  `pgreen90.github.io/Learn-Bridge/` är ur bruk (blir blank, base=`/`).
- Vite `base` = **"/"** (Vercel serverar från roten).
- Hosting: **Vercel**, projekt `learn-bridge`, team `rebidz` (Hobby/gratis),
  kopplat till GitHub-repot via Vercels GitHub-app → auto-deploy vid push till main.
  Build-grinden ligger i `vercel.json`.
- Auth: gh CLI är inloggad som PGreen90 (device-flow) och är git
  credential helper. Pusha via `git push`. Scopes inkl. `workflow`.
- Node.js ligger i `C:\Program Files\nodejs\` (lägg den först i PATH
  i nya shells: npm/node finns inte alltid på PATH automatiskt).

## Projektstruktur
- `index.html` – sidans skal, laddar src/main.tsx
- `src/main.tsx` – startpunkt, monterar React-appen
- `src/App.tsx` – router (HashRouter) som kopplar adresser till sidor
- `src/index.css` – `@import "tailwindcss";` (Tailwind v4)
- `src/types/bridge.ts` – TypeScript-typer (Card, Hand, Deal, BiddingQuestion)
- `src/lib/storage.ts` – läs/skriv framsteg i localStorage
- `src/components/` – återanvändbara byggblock:
  - `Layout.tsx` (topbar + meny), `Panel.tsx`, `Button.tsx`,
    `SuitSymbol.tsx`, `HandView.tsx`
- `src/pages/` – en fil per skärm: `Home`, `BiddingPractice`,
  `Learn`, `Settings`
- `vite.config.ts` – base-path + react- och tailwind-plugin
- `.github/workflows/deploy.yml` – auto-bygge & publicering vid push
- (kommer) `src/data/*.json` – givar och budsystem som data

## Navigering (router)
- HashRouter används (adresser med #, t.ex. .../#/budtraning) eftersom
  det fungerar på statisk hosting utan serverinställningar. Byt INTE till
  BrowserRouter utan att lägga till SPA-rewrites (på Vercel: en rewrite av alla
  vägar till index.html i `vercel.json`).
- Lägg till ny skärm: skapa `src/pages/Xxx.tsx`, lägg till en
  `<Route>` i `App.tsx` och en länk i `NAV`-listan i `Layout.tsx`.

## Hur man lägger till innehåll
- Bridge-typerna bor i `src/types/bridge.ts` – utgå alltid från dem.
- Övningar ligger som JSON i `src/data/exercises/<tema>.json`, aldrig
  hårdkodade i komponenterna. Teman listas i `src/data/themes.json`.
- Inläsning sker i `src/lib/bidding.ts` (registret `EXERCISES_BY_THEME`).
  Ny temafil måste importeras och läggas till där.
- Handen skrivs som kort text, t.ex. `"S:AK974 H:K83 D:Q6 C:J52"`.
  Tian skrivs som `T`. Tom färg: `-`. Parsas av `parseHand`.
- En övning = `auction`: en lista med steg. Ett steg är antingen ett
  manus-bud `{ "bid": "1H" }` (partner/motståndare) eller ditt beslut
  `{ "decision": { "options": [...], "answer": "1S", "explanation": "..." } }`.
  Vem som bjuder räknas ut från `dealer` + ordningen (medurs N→E→S→W).
- Bud skrivs som `"1C"/"1D"/"1H"/"1S"/"1NT"`, samt `"P"`, `"X"`, `"XX"`.
- Lägena (Scope): `opening`, `opening-response`, `full-auction`.
  Ett tema hör till ett läge via fältet `scope` i themes.json.
## Kommandon
- `npm run dev` – lokal förhandsvisning under utveckling
- `npm run build` – byggs automatiskt av Vercel vid push, sällan manuellt
## Vad man INTE gör
- Lägg aldrig till backend/server/databas i nuläget – hostingen är statisk
  (backend planeras i ett separat, senare steg, se framtidsdoket).
- Glöm aldrig Vite `base` = `/` (Vercel serverar från roten; låst av vaktestet).
- Bygg inte alla budsystem på en gång – ett i taget.
- Lämna aldrig ägaren med ett tekniskt fel utan förklaring + nästa steg.
