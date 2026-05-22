// Initialize test mode immediately if present in query params
if (typeof window !== 'undefined') {
  const params = new URLSearchParams(window.location.search);
  if (params.get('test_mode') === 'true') {
    window.localStorage.setItem('attic_test_mode', 'true');
    const user = params.get('user');
    if (user) {
      window.localStorage.setItem('attic_test_user', user);
    }
  }
}

import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ToastProvider } from './components/UI.jsx'
import App from './App.jsx'
import './index.css'
import './styles/mobile.css'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'

import { AuthProvider } from './context/AuthContext.jsx'
import { SyncProvider } from './context/SyncContext.jsx'
import { CallProvider } from './context/CallContext.jsx'
import { ChatProvider } from './context/ChatContext.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <SyncProvider>
              <CallProvider>
                <ChatProvider>
                  <App />
                </ChatProvider>
              </CallProvider>
            </SyncProvider>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)

// Service worker logic for PWA and push notifications
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        console.log('Attic Service Worker registered:', reg.scope);
      })
      .catch(err => {
        console.error('Attic Service Worker registration failed:', err);
      });
  });
}

