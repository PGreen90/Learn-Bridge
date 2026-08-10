import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
// Felfångaren ligger YTTERST med flit: den ska fånga fel var som helst i appen
// (även i Layout) och får därför inte själv bero på router eller sid-state.
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { AuthProvider } from './components/AuthProvider.tsx'
import { hoistAuthCallbackToHash } from './lib/backend/auth-callback-bootstrap.ts'
import { setupPwaUpdate } from './pwa-update.ts'

// Fånga inloggningslänkar från mejl innan HashRouter startar (Beslut B etapp 1).
hoistAuthCallbackToHash()

// Service workern registreras manuellt (prompt-läget) — se pwa-update.ts.
setupPwaUpdate()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {/* Inloggningsminnet ligger runt hela appen (Beslut B etapp 1) så varje
          sida och menyn kan fråga useAuth() om vem som är inloggad. */}
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)
