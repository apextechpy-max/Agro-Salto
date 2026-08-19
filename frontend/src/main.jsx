import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Limpiar cachés antiguos de WebView / PWA si existen
if ('caches' in window) {
  caches.keys().then((names) => {
    names.forEach((name) => caches.delete(name))
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

