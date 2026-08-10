# docs/ â€” vilken fil svarar pÃ¥ vad?

> **LÃ¤s det hÃ¤r fÃ¶rst nÃ¤r du letar.** `CLAUDE.md` i repo-roten Ã¤r kartan (vad vi
> gÃ¶r nu). Den hÃ¤r filen sÃ¤ger vilken av dokumenten nedan du ska Ã¶ppna â€” sÃ¥ att
> ingen lÃ¤ser 150 kB fÃ¶r att hitta en rad.
>
> ðŸŸ¢ = levande dokument, hÃ¥lls uppdaterat Â· ðŸ“˜ = referens/systembok Â·
> ðŸ“¦ = arkiv, Ã¤ndras inte lÃ¤ngre

## De fyra du anvÃ¤nder oftast

| Fil | ðŸŸ¢/ðŸ“˜/ðŸ“¦ | Ã–ppna den nÃ¤r â€¦ |
|---|---|---|
| **budsystem.md** (222 kB) | ðŸ“˜ | du ska Ã¤ndra eller slÃ¥ upp en **budregel**. Systemboken i paragrafform. **Appens Budsystem-sida renderar den hÃ¤r filen live fÃ¶r Ã¤garen** â€” varje regelÃ¤ndring MÃ…STE skrivas in hÃ¤r. Â§9 = Ã¤ndringslogg (visas inte pÃ¥ sidan). |
| **status.md** (43 kB) | ðŸ“˜ | du ska rÃ¶ra **budmotorns kod**. SÃ¶k rubriken "Budmotorns tre auktionslager + `open`-handoff" = arkitekturkontraktet: hÃ¶r logiken hemma i `auction.ts` (on-book), `auction-live.ts` (off-book/konkurrens) eller `auction-interpret.ts` (fÃ¶rklaring)? |
| **systemrevisorn.md** (72 kB) | ðŸŸ¢ | du jobbar i mÃ¤tspÃ¥ret. Riggen, hur man kÃ¶r den, **alla mÃ¤tningar #1â€“#25**, fÃ¶rskanningarna (etapp 6 + **etapp 7 missad lillslam**) och mÃ¶nsteranalyserna bakom varje fix. |
| **bevaka.md** | ðŸŸ¢ | Ã¤garen sÃ¤ger att nÃ¥got kÃ¤nns fel i spel, en felrapport kommer in, eller en ny fix ska lÃ¤ggas till bevakningslistan. |

## Planering & beslut

| Fil | | InnehÃ¥ll |
|---|---|---|
| **konkurrensplan.md** | ðŸŸ¢ | Konkurrensplanen mot BBO/Funbridge/Synrey (Ã¤garbeslut 2026-07-29): hÃ¤lsobedÃ¶mningen av appen + roadmapen Fas 0â€“6 (kvalitetsgrund â†’ facelift â†’ konton â†’ "Dagens givar" â†’ mobilappar â†’ engelska â†’ realtidsbord). |
| **budsystem-revision.md** | ðŸŸ¢ | Budsystemets hÃ¤lsobild + kÃ¶rordningen F1â€“F6 och B-punkterna (t.ex. B13). HÃ¤r stÃ¥r vad som Ã¤r kvar att fÃ¶rbÃ¤ttra i systemet. |
| **senare.md** | ðŸŸ¢ | Full beskrivning av allt i âšª SENARE och ðŸ…¿ï¸ PARKERAT (CLAUDE.md listar bara rubrikerna). |
| **utspel-diagnos.md** | ðŸŸ¢ | Komplett diagnos av bottarnas **utspel** (trick 1 + mitt-i-given): vilka regler som finns, att utspelet ignorerar budgivningen, hÃ¥len mot doktrin (Aâ€“G) och den beslutade byggordningen. Ã–ppna den nÃ¤r utspelsspÃ¥ret Ã¥terupptas. |
| **utspel-teori.md** | ðŸ“˜ | Den kÃ¤llfÃ¶rankrade bridgeteorin bakom utspelet (Pavlicek/Walker/Cohen/bridgebum): holdingsâ†’utspel-tabeller (fÃ¤rg + NT), tenass-principen, aktiv/passiv, budgivningens roll, Lightner, slam + konventionsvalen. VAD som Ã¤r rÃ¤tt bridge â€” bygg utspelskoden mot den hÃ¤r. |
| **arbetsrutiner.md** | ðŸŸ¢ | ðŸŸ¢-checklistan vid sessionsstart och ðŸ”´-checklistan vid sessionsslut. FÃ¶ljs varje gÃ¥ng. |
| **beslut-b-plan.md** | 🟢 | **Masterplanen för Beslut B (ägarbeslut 2026-08-08):** konton → daglig 12-givarstävling → realtidsbord. Etapperna 0–4, besluten som är tagna (Supabase, lösenord, ordningen), beslutsgrindarna som återstår, GDPR/säkerhetsdetaljerna. Öppna den när Beslut B-arbetet fortsätter. |
| **framtid-multiplayer-plattform.md** | ðŸ“˜ | Beslut A (klart: Vercel + domÃ¤n + PWA) vs **Beslut B** (konton/multiplayer/tÃ¤vlingar). Teknikunderlaget bakom Beslut B; sjÃ¤lva planen bor nu i `beslut-b-plan.md`. |
| **bot-hjarna.md** | ðŸ“˜ | Roadmap fÃ¶r bottarnas *spelstyrka* (inferens, Monte-Carlo). Spelmotor-spÃ¥ret, inte budgivningen. |

## Referens (slÃ¥ upp, lÃ¤s inte rakt igenom)

| Fil | | InnehÃ¥ll |
|---|---|---|
| **oversikt.md** | ðŸ“˜ | Snabbreferens: hela 2/1-systemet pÃ¥ tvÃ¥ sidor. Bra nÃ¤r du bara behÃ¶ver komma ihÃ¥g vad ett bud betyder. |
| **handvardering.md** | ðŸ“˜ | HP/TP/stÃ¶dpoÃ¤ng/Bergen/spelstick â€” vilka mÃ¥tt vi har och vad de anvÃ¤nds till. LTC infÃ¶rdes medvetet inte. |
| **kortspel.md** | ðŸ“˜ | Spelmotorn: hur ett stick avgÃ¶rs, hur bottarna spelar ut. |
| **sanningskarta.md** | ðŸ“¦ | Inventering systembok mot faktisk kod (FAS 0, 2026-06-30). Historisk. |
| **off-book-syd.md** | ðŸ“˜ | Definitionen av hur datorpartnern svarar nÃ¤r Ã¤garen bjuder utanfÃ¶r boken. LÃ¥st av Ã¤garen. |

## Arkiv â€” Ã¤ndras inte lÃ¤ngre

| Fil | | InnehÃ¥ll |
|---|---|---|
| **historik.md** (156 kB) | ðŸ“¦ | **Allt fÃ¤rdigt arbete**, nyast sist. Etapp 3/4/5/6-loggen, Ã„RLIGA SLAMPORTAR-bygget, felrapporter #1â€“#39, UI-overhaulen, Steg A. SlÃ¥ upp hÃ¤r nÃ¤r du undrar *varfÃ¶r* nÃ¥got byggdes som det gjordes. |
| **arbetslista.md** | ðŸ“¦ | Byggordningen FAS 0â€“12 (genomfÃ¶rd). Punkt 28 = bakgrunden till vÃ¥r egen DDS-lÃ¶sare. Kvar som arkiv; NU/NÃ„ST styrs av CLAUDE.md. |
| **tp-arbetslista.md** | ðŸ“¦ | TP-stegen Aâ€“F. **Alla klara 2026-07-03** â€” filen innehÃ¥ller gamla "â¬œ Kvar att bygga"-rubriker som Ã¤r Ã¶verspelade av notisen hÃ¶gst upp. |
| **audit/** (5 filer + SLUTRAPPORT) | ðŸ“¦ | Revisionen R1â€“R5 (2026-07-04): budsystem, arkitektur, UI/UX, dokumentation, git/deploy. Alla fynd Ã¤r antingen Ã¥tgÃ¤rdade eller upplyfta till SENARE. |
| **../AUDIT_PROMPTS.md** | ðŸ“¦ | Promptarna som kÃ¶rde revisionen R1â€“R6. BehÃ¶vs bara om vi vill gÃ¶ra om en revision. |

## Regler fÃ¶r dokumenten
- **CLAUDE.md ska vara kort.** Den laddas i sin helhet varje session â€” allt som
  inte Ã¤r "vad gÃ¶r vi nu + vilka regler gÃ¤ller alltid" hÃ¶r hemma hÃ¤r i `docs/`.
  NÃ¤r NU blir klart: flytta loggen till `historik.md`, behÃ¥ll en rad i kartan.
- **budsystem.md Ã¤r en produktyta**, inte bara dokumentation â€” Ã¤garen lÃ¤ser den i
  appen. Skriv lÃ¤sbar svenska i paragrafform, inte kodtermer.
- **Sifferregeln:** en siffra fÃ¥r stÃ¥ i ett levande dokument bara om kommandot som
  Ã¥terskapar den stÃ¥r bredvid (`docs/arbetsrutiner.md` fÃ¶rklarar varfÃ¶r). KÃ¶r
  `npm test` fÃ¶r testlÃ¤get.
- **Vakten:** `src/docs-vakt.test.ts` kontrollerar automatiskt att docs pekar pÃ¥
  kod som finns, att inga oreproducerbara testantal smyger in, att indexet hÃ¤r Ã¤r
  komplett och att ingen motormodul tyst tappar kontakten med appen. Den kÃ¶r i
  `npm test` â€” alltsÃ¥ i GitHub Actions deploygrind fÃ¶re varje publicering.
