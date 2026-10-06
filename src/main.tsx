import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AppStore } from './data'
import { LiveAppStore } from './live'
import { isDemoMode } from './mode'
import App from './App'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      {isDemoMode() ? <AppStore><App /></AppStore> : <LiveAppStore><App /></LiveAppStore>}
    </BrowserRouter>
  </React.StrictMode>,
)
