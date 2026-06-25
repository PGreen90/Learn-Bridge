import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// VIKTIGT: base måste matcha repo-namnet på GitHub, annars blir sidan blank
// på GitHub Pages. Repo-namn = "Learn-Bridge"  ->  base = "/Learn-Bridge/".
export default defineConfig({
  base: '/Learn-Bridge/',
  plugins: [react(), tailwindcss()],
})
