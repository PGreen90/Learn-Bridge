import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// VIKTIGT: hostas nu på Vercel, som serverar appen från roten på domänen.
// Därför base = "/" (inte längre "/Learn-Bridge/" som på GitHub Pages, där
// sidan låg under repo-namnet). Fel base här = blank sida. Låst av vaktestet
// src/deploy-config.test.ts.
export default defineConfig({
  base: '/',
  plugins: [react(), tailwindcss()],
  test: {
    // R5-fynd #3: .claude/worktrees/ innehåller parallella Claude Code-worktrees
    // med egna kopior av testerna – uteslut dem så `npm test` bara kör DENNA
    // arbetskopia (annars körs samma test dubbelt och kan flagga fel giv).
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
})
