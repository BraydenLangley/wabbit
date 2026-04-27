import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { WabbitProvider } from 'wabbit-react'
import App from './App'
import './index.css'

const WABBIT_ORIGIN = import.meta.env.VITE_WABBIT_ORIGIN ?? 'http://127.0.0.1:5173'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WabbitProvider origin={WABBIT_ORIGIN}>
      <App />
    </WabbitProvider>
  </StrictMode>
)
