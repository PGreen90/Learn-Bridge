# CLAUDE.md — Bridge-app
Läs den här filen först varje session.
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
- `src/App.tsx` – just nu startsidan (byts mot riktig app)
- `src/index.css` – `@import "tailwindcss";` (Tailwind v4)
- `vite.config.ts` – base-path + react- och tailwind-plugin
- `.github/workflows/deploy.yml` – auto-bygge & publicering vid push
- (kommer) `src/data/*.json` – givar och budsystem som data
- (kommer) `src/components/*` – UI-delar

## Hur man lägger till innehåll
(Fylls i när datastrukturen finns – t.ex. "ny övningsgiv = lägg till
objekt i src/data/hands.json".)
## Kommandon
- `npm run dev` – lokal förhandsvisning under utveckling
- `npm run build` – byggs automatiskt av GitHub Actions, sällan manuellt
## Vad man INTE gör
- Lägg aldrig till backend/server/databas – Pages kan inte köra det.
- Glöm aldrig Vite `base`-pathen vid deploy.
- Bygg inte alla budsystem på en gång – ett i taget.
- Lämna aldrig ägaren med ett tekniskt fel utan förklaring + nästa steg.
