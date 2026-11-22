import './shared/services/migration.js';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './shared/components/ErrorBoundary.jsx';
import './index.css';

// Window error & unhandledrejection fallback handler
// If #root is still empty after 1.5s following an error, display styled recovery message
function setupStartupErrorFallback() {
  const showFallback = (err) => {
    console.error('[Utsavora Startup Error]', err);
    setTimeout(() => {
      const root = document.getElementById('root');
      if (root && (!root.innerHTML || root.innerHTML.trim() === '')) {
        root.innerHTML = `
          <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #1F0D16; color: #F8EBD8; font-family: system-ui, sans-serif; padding: 20px; text-align: center;">
            <div style="max-width: 420px; padding: 32px 24px; background: #2A141E; border: 1.5px solid #4A2634; border-radius: 20px; box-shadow: 0 16px 40px rgba(0,0,0,0.4);">
              <div style="font-size: 3rem; margin-bottom: 12px;">🪔</div>
              <h2 style="margin: 0 0 10px; color: #FFE7B0; font-size: 1.4rem;">Something went wrong.</h2>
              <p style="margin: 0 0 20px; opacity: 0.85; font-size: 0.95rem;">Something went wrong. Reload.</p>
              <button onclick="window.location.reload()" style="background: linear-gradient(135deg, #D4A373, #B8860B); color: #1F0D16; border: none; padding: 10px 24px; border-radius: 999px; font-weight: 700; cursor: pointer; font-size: 0.95rem;">Reload</button>
            </div>
          </div>
        `;
      }
    }, 1500);
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => showFallback(event.error || event.message));
    window.addEventListener('unhandledrejection', (event) => showFallback(event.reason));
  }
}

setupStartupErrorFallback();

const rootEl = document.getElementById('root');
if (rootEl) {
  // If static fallback is present in DOM, hide it so React takes over completely
  const appRoot = document.getElementById('appRoot');
  if (appRoot) {
    appRoot.style.display = 'none';
  }
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
}
