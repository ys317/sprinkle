import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Buffer } from 'buffer'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Providers } from './app/Providers'
import { Shell } from './app/Shell'
import { CreatePage } from './pages/CreatePage'
import { PayPage } from './pages/PayPage'
import { DashboardPage } from './pages/DashboardPage'
import './index.css'

;(globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Providers>
        <Shell>
          <Routes>
            <Route path="/" element={<CreatePage />} />
            <Route path="/pay" element={<PayPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="*" element={<CreatePage />} />
          </Routes>
        </Shell>
      </Providers>
    </BrowserRouter>
  </StrictMode>,
)
