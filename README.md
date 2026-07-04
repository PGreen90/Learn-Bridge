# RebidZ

En interaktiv webbapp för att **lära sig och spela bridge** (kortspelet) — bjuda,
träna budsystem och spela ut korten mot datorbottar. Allt körs i webbläsaren,
ingen backend, gratis-hostat på GitHub Pages.

**🔗 Live:** https://pgreen90.github.io/Learn-Bridge/

> Appen heter **RebidZ** i gränssnittet. Repo och URL heter fortfarande
> **Learn-Bridge** (medvetet – byts inte).

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
Framsteg sparas i `localStorage`. Auto-deploy till GitHub Pages via GitHub Actions
vid varje push till `main`.

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

- [`docs/status.md`](docs/status.md) — vad som är byggt (inkl. budmotorns tre
  auktionslager).
- [`docs/budsystem.md`](docs/budsystem.md) — systemboken (sanningskällan).
- [`docs/sanningskarta.md`](docs/sanningskarta.md) — systembok mot kod, rad för rad.
- [`docs/arbetsrutiner.md`](docs/arbetsrutiner.md) — sessionsrutiner.
