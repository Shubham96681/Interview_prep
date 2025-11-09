import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app.tsx'
import './index.css'

// Debug: Check for multiple React instances
console.log('React version:', React.version);
if (typeof window !== 'undefined' && (window as any).React && (window as any).React !== React) {
  console.error('⚠️ CRITICAL: Multiple React instances detected! This will cause React error #310');
  console.error('Window React:', (window as any).React);
  console.error('Module React:', React);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

























