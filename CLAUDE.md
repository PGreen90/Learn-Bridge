# CLAUDE.md — Bridge-app
Läs den här filen först varje session.

## Arbetsrutiner (följ varje gång)
- **Vid sessionsstart:** följ 🟢-checklistan i `docs/arbetsrutiner.md`.
- **Vid sessionsslut:** följ 🔴-checklistan i `docs/arbetsrutiner.md`.

## Vad det här är
Interaktiv webbapp för att lära sig och spela bridge (kortspelet).
Användaren ska kunna spela olika händer och lära sig olika budsystem.
Allt körs i webbläsaren, gratis-hostat på GitHub Pages.
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
- GitHub Pages = ENDAST statiska filer. Ingen server, databas eller
  backend-kod är möjlig.
- Auto-deploy: en GitHub Actions-workflow bygger sidan vid varje push
  till main. Ägaren kör ALDRIG bygg-kommandon själv – push räcker.
- Vite `base` MÅSTE sättas till "/<repo-namn>/", annars blir sidan
  blank på Pages. Det är det vanligaste deploy-felet – kontrollera det.
- Användarens framsteg sparas i localStorage (ingen databas).
## Bridge-specifikt
- "Rätt svar"-feedback via en double-dummy solver i WebAssembly
  (Bo Haglunds DDS, open source, kör i webbläsaren). Verifiera vilket
  npm-paket som är bäst underhållet innan du kopplar in det.
- Givar och budsystem ligger som JSON-filer i repot – aldrig
  hårdkodade inne i komponenterna.
- Budsystem: börja med ETT system, gör det ordentligt, lägg till fler
  senare. Bygg inte alla på en gång.
## Beslut (uppdatera vid behov)
- Budsystem att börja med: **2 över 1 (2/1)**. Endast detta först.
- Första funktion: **budträning** – visa hand, ägaren väljer bud,
  appen ger facit + förklaring.
- Nästa stora riktning: **Spela mot datorn** (offline mot bottar först;
  gratis/statiskt; människor online = framtid med backend). Kvalitet före tempo.
- **Budmotor** byggs som modul i `src/lib/engine/` som omsätter systemboken
  (`docs/budsystem.md`) till kod, avsnitt för avsnitt, test-drivet (`npm test`).
  Status: **M1–M3 klara + punkt 10–15**. Spela-fliken bygger ostörda auktioner
  öppning → svar → öppnarens återbud → **svararens andra bud** för öppningarna
  1♣/1♦/1♥/1♠/1NT, **stark 2♣** (`responses-2c.ts`), **svaga tvåor 2♦/2♥/2♠**
  med Ogust (`responses-weak2.ts`) **och spärröppningar 3X/4X**
  (`responses-preempt.ts`). Hela kartan över vad som återstår ligger i
  **`docs/arbetslista.md`** (punkt 1–32).
  **Nästa: punkt 16** – svar på 2NT-öppning + hantera 3NT-öppning, sedan
  slamverktyg (17–20) och kortspel (DDS-solver + spelläge).

## Konkreta fakta om detta projekt (för deploy)
- GitHub-repo: **PGreen90/Learn-Bridge** (publikt).
- Live-URL: **https://pgreen90.github.io/Learn-Bridge/**
- Vite `base` = **"/Learn-Bridge/"** (måste matcha repo-namnet exakt).
- Auth: gh CLI är inloggad som PGreen90 (device-flow) och är git
  credential helper. Pusha via `git push`. Scopes inkl. `workflow`.
- Node.js ligger i `C:\Program Files\nodejs\` (lägg den först i PATH
  i nya shells: npm/node finns inte alltid på PATH automatiskt).
- Pages-källa = "GitHub Actions" (build_type=workflow), redan aktiverat.

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
  det fungerar på GitHub Pages utan serverinställningar. Byt INTE till
  BrowserRouter utan att lägga till en 404-fallback för Pages.
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
- `npm run build` – byggs automatiskt av GitHub Actions, sällan manuellt
## Vad man INTE gör
- Lägg aldrig till backend/server/databas – Pages kan inte köra det.
- Glöm aldrig Vite `base`-pathen vid deploy.
- Bygg inte alla budsystem på en gång – ett i taget.
- Lämna aldrig ägaren med ett tekniskt fel utan förklaring + nästa steg.
