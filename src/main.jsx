import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ToastProvider } from './components/UI.jsx'
import App from './App.jsx'
import './index.css'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ToastProvider>
          <App />
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)

if ('serviceWorker' in navigator) {
  // Ensure any old/incorrect service workers are removed so they don't serve stale
  // or incorrect cached content (previous builds cached source files and broke the site).
  window.addEventListener('load', async () => {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) {
        await r.unregister();
        console.log('Unregistered service worker:', r);
      }
    } catch (err) {
      console.warn('Service worker cleanup failed:', err);
    }
    // Intentionally not re-registering a service worker here to avoid caching issues
    // during rapid deploy iterations. If you want an offline SW, we can add a
    // production-ready service worker that caches built assets only.
  });
}
