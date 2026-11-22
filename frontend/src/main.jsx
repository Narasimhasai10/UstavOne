import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const rootEl = document.getElementById('root');
if (rootEl) {
  // If static fallback is present in DOM, hide it so React takes over completely
  const appRoot = document.getElementById('appRoot');
  if (appRoot) {
    appRoot.style.display = 'none';
  }
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
