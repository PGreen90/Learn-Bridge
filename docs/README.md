# docs/ — vilken fil svarar på vad?

> **Läs det här först när du letar.** `CLAUDE.md` i repo-roten är kartan (vad vi
> gör nu). Den här filen säger vilken av dokumenten nedan du ska öppna — så att
> ingen läser 150 kB för att hitta en rad.
>
> 🟢 = levande dokument, hålls uppdaterat · 📘 = referens/systembok ·
> 📦 = arkiv, ändras inte längre

## De fyra du använder oftast

| Fil | 🟢/📘/📦 | Öppna den när … |
|---|---|---|
| **budsystem.md** (177 kB) | 📘 | du ska ändra eller slå upp en **budregel**. Systemboken i paragrafform. **Appens Budsystem-sida renderar den här filen live för ägaren** — varje regeländring MÅSTE skrivas in här. §9 = ändringslogg (visas inte på sidan). |
| **status.md** (38 kB) | 📘 | du ska röra **budmotorns kod**. Sök rubriken "Budmotorns tre auktionslager + `open`-handoff" = arkitekturkontraktet: hör logiken hemma i `auction.ts` (on-book), `auction-live.ts` (off-book/konkurrens) eller `auction-interpret.ts` (förklaring)? |
| **systemrevisorn.md** (57 kB) | 🟢 | du jobbar i mätspåret. Riggen, hur man kör den, **alla mätningar #1–#20**, förskanningarna (etapp 6 + **etapp 7 missad lillslam**) och mönsteranalyserna bakom varje fix. |
| **bevaka.md** | 🟢 | ägaren säger att något känns fel i spel, en felrapport kommer in, eller en ny fix ska läggas till bevakningslistan. |

## Planering & beslut

| Fil | | Innehåll |
|---|---|---|
| **konkurrensplan.md** | 🟢 | Konkurrensplanen mot BBO/Funbridge/Synrey (ägarbeslut 2026-07-29): hälsobedömningen av appen + roadmapen Fas 0–6 (kvalitetsgrund → facelift → konton → "Dagens givar" → mobilappar → engelska → realtidsbord). |
| **budsystem-revision.md** | 🟢 | Budsystemets hälsobild + körordningen F1–F6 och B-punkterna (t.ex. B13). Här står vad som är kvar att förbättra i systemet. |
| **senare.md** | 🟢 | Full beskrivning av allt i ⚪ SENARE och 🅿️ PARKERAT (CLAUDE.md listar bara rubrikerna). |
| **arbetsrutiner.md** | 🟢 | 🟢-checklistan vid sessionsstart och 🔴-checklistan vid sessionsslut. Följs varje gång. |
| **framtid-multiplayer-plattform.md** | 📘 | Beslut A (klart: Vercel + domän + PWA) vs **Beslut B** (konton/multiplayer/tävlingar) — parkerat stort spår, startas bara på uttryckligt ägarbeslut. |
| **bot-hjarna.md** | 📘 | Roadmap för bottarnas *spelstyrka* (inferens, Monte-Carlo). Spelmotor-spåret, inte budgivningen. |

## Referens (slå upp, läs inte rakt igenom)

| Fil | | Innehåll |
|---|---|---|
| **oversikt.md** | 📘 | Snabbreferens: hela 2/1-systemet på två sidor. Bra när du bara behöver komma ihåg vad ett bud betyder. |
| **handvardering.md** | 📘 | HP/TP/stödpoäng/Bergen/spelstick — vilka mått vi har och vad de används till. LTC infördes medvetet inte. |
| **kortspel.md** | 📘 | Spelmotorn: hur ett stick avgörs, hur bottarna spelar ut. |
| **sanningskarta.md** | 📦 | Inventering systembok mot faktisk kod (FAS 0, 2026-06-30). Historisk. |
| **off-book-syd.md** | 📘 | Definitionen av hur datorpartnern svarar när ägaren bjuder utanför boken. Låst av ägaren. |

## Arkiv — ändras inte längre

| Fil | | Innehåll |
|---|---|---|
| **historik.md** (123 kB) | 📦 | **Allt färdigt arbete**, nyast sist. Etapp 3/4/5/6-loggen, ÄRLIGA SLAMPORTAR-bygget, felrapporter #1–#39, UI-overhaulen, Steg A. Slå upp här när du undrar *varför* något byggdes som det gjordes. |
| **arbetslista.md** | 📦 | Byggordningen FAS 0–12 (genomförd). Punkt 28 = bakgrunden till vår egen DDS-lösare. Kvar som arkiv; NU/NÄST styrs av CLAUDE.md. |
| **tp-arbetslista.md** | 📦 | TP-stegen A–F. **Alla klara 2026-07-03** — filen innehåller gamla "⬜ Kvar att bygga"-rubriker som är överspelade av notisen högst upp. |
| **audit/** (5 filer + SLUTRAPPORT) | 📦 | Revisionen R1–R5 (2026-07-04): budsystem, arkitektur, UI/UX, dokumentation, git/deploy. Alla fynd är antingen åtgärdade eller upplyfta till SENARE. |
| **../AUDIT_PROMPTS.md** | 📦 | Promptarna som körde revisionen R1–R6. Behövs bara om vi vill göra om en revision. |

## Regler för dokumenten
- **CLAUDE.md ska vara kort.** Den laddas i sin helhet varje session — allt som
  inte är "vad gör vi nu + vilka regler gäller alltid" hör hemma här i `docs/`.
  När NU blir klart: flytta loggen till `historik.md`, behåll en rad i kartan.
- **budsystem.md är en produktyta**, inte bara dokumentation — ägaren läser den i
  appen. Skriv läsbar svenska i paragrafform, inte kodtermer.
- **Sifferregeln:** en siffra får stå i ett levande dokument bara om kommandot som
  återskapar den står bredvid (`docs/arbetsrutiner.md` förklarar varför). Kör
  `npm test` för testläget.
- **Vakten:** `src/docs-vakt.test.ts` kontrollerar automatiskt att docs pekar på
  kod som finns, att inga oreproducerbara testantal smyger in, att indexet här är
  komplett och att ingen motormodul tyst tappar kontakten med appen. Den kör i
  `npm test` — alltså i GitHub Actions deploygrind före varje publicering.
