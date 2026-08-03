import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
// Felfångaren ligger YTTERST med flit: den ska fånga fel var som helst i appen
// (även i Layout) och får därför inte själv bero på router eller sid-state.
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { setupPwaUpdate } from './pwa-update.ts'

// Service workern registreras manuellt (prompt-läget) — se pwa-update.ts.
setupPwaUpdate()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
