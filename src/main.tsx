import './polyfills'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Providers } from './app/Providers'
import { Shell } from './app/Shell'
import { CreatePage } from './pages/CreatePage'
import { PayPage } from './pages/PayPage'
import { DashboardPage } from './pages/DashboardPage'
import { ReceiptPage } from './pages/ReceiptPage'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Providers>
        <Shell>
          <Routes>
            <Route path="/" element={<CreatePage />} />
            <Route path="/pay" element={<PayPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/tx/:sig" element={<ReceiptPage />} />
            <Route path="*" element={<CreatePage />} />
          </Routes>
        </Shell>
      </Providers>
    </BrowserRouter>
  </StrictMode>,
)
