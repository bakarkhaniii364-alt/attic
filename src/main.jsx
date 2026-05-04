import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ToastProvider } from './components/UI.jsx'
import App from './App.jsx'
import './index.css'
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

// Service worker logic for PWA and push notifications can be added here
// currently relying on standard browser caching for stability.
