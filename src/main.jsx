import { StrictMode, Suspense, lazy, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { reportClientError } from './utils/reportClientError'
import App from './App.jsx'
const PenaltyShootout = lazy(() => import('./penalty/ui/PenaltyShootout'))

function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash)

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  return hash
}

window.addEventListener('error', event => reportClientError(event.error || event.message, { source: 'window.onerror' }));
window.addEventListener('unhandledrejection', event => reportClientError(event.reason, { source: 'unhandledrejection' }));

function Root() {
  const hash = useHashRoute()
  if (hash.startsWith('#penalty')) {
    return <Suspense fallback={null}><PenaltyShootout /></Suspense>
  }
  return <App />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
