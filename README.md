# rebidz

En interaktiv webbapp för att **lära sig och spela bridge** (kortspelet) — bjuda,
träna budsystem och spela ut korten mot datorbottar. Allt körs i webbläsaren,
ingen backend, gratis-hostat på Vercel.

**🔗 Live:** https://rebidz.com

> Appen heter **rebidz** i gränssnittet — alltid gemener (ägarbeslut). Repo och
> URL heter fortfarande **Learn-Bridge** (medvetet – byts inte).

## Vad appen gör

- **Budträning** — se en hand, välj bud, få facit med förklaring.
- **Spela mot datorn** — levande budgivning + kortspel mot tre bottar; du sitter
  Syd (både spelförare och motspelare). Bottarna använder en "läsa bordet"-hjärna
  (Monte-Carlo + double-dummy, ingen tjuvkik på dolda kort).
- **Budsystem:** 2 över 1 (2/1 game force), med konventioner (Bergen, Stayman/
  transfers, RKC-slam, försvarskonventioner m.m.). Systemet är dokumenterat i
  [`docs/budsystem.md`](docs/budsystem.md).

## Teknisk stack

React + Vite + TypeScript + Tailwind CSS v4. Ingen server, allt client-side.
Framsteg sparas i `localStorage`. Deploy till Vercel sker via GitHub Actions vid
varje push till `main` — workflowen kör `tsc && npm test` och publicerar bara om
allt är grönt, så ett rött test stoppar publiceringen.

## Utveckling

```bash
npm install
npm run dev      # lokal förhandsvisning
npm test         # testsviten (vitest)
npm run build    # produktionsbygge (körs normalt av GitHub Actions)
```

Budmotorn bor i `src/lib/engine/` och är test-driven (en `*.test.ts` bredvid
nästan varje fil).

## För utvecklare (människa eller AI)

Detta projekt drivs med **Claude Code**. Läs **[`CLAUDE.md`](CLAUDE.md) först** —
den innehåller arbetssätt, låsta beslut och projektkartan (NU/NÄST/SENARE). Övrig
dokumentation ligger i [`docs/`](docs/):

- **[`docs/README.md`](docs/README.md) — index över all dokumentation.** Säger
  vilken fil som svarar på vad, så du slipper leta i 150 kB systembok.
- [`docs/budsystem.md`](docs/budsystem.md) — systemboken (sanningskällan; appens
  Budsystem-sida renderar den live).
- [`docs/status.md`](docs/status.md) — vad som är byggt (inkl. budmotorns tre
  auktionslager).
- [`docs/arbetsrutiner.md`](docs/arbetsrutiner.md) — sessionsrutiner.
