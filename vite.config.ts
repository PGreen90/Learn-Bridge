import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// VIKTIGT: base måste matcha repo-namnet på GitHub, annars blir sidan blank
// på GitHub Pages. Repo-namn = "Learn-Bridge"  ->  base = "/Learn-Bridge/".
export default defineConfig({
  base: '/Learn-Bridge/',
  plugins: [react(), tailwindcss()],
  test: {
    // R5-fynd #3: .claude/worktrees/ innehåller parallella Claude Code-worktrees
    // med egna kopior av testerna – uteslut dem så `npm test` bara kör DENNA
    // arbetskopia (annars körs samma test dubbelt och kan flagga fel giv).
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
})
