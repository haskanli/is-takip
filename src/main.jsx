import { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class RootErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Corject render error', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: '#0F172A',
        color: '#fff',
        fontFamily: 'Inter, Segoe UI, sans-serif',
      }}>
        <div style={{
          width: 'min(520px, 100%)',
          background: '#111827',
          border: '1px solid rgba(255,255,255,.12)',
          borderRadius: 18,
          padding: 24,
          boxShadow: '0 20px 60px rgba(0,0,0,.28)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 3, color: '#A5B4FC', marginBottom: 10 }}>CORJECT</div>
          <h1 style={{ margin: 0, fontSize: 24, color: '#fff' }}>Beklenmeyen bir ekran hatası oluştu</h1>
          <p style={{ margin: '10px 0 0', color: '#CBD5E1', lineHeight: 1.6 }}>
            Sayfayı yenileyin. Devam ederse bu hata mesajını paylaşın.
          </p>
          <pre style={{
            marginTop: 14,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            background: '#020617',
            borderRadius: 12,
            padding: 12,
            color: '#FCA5A5',
            fontSize: 12,
          }}>{this.state.error?.message || 'Bilinmeyen hata'}</pre>
          <button onClick={() => window.location.reload()} style={{
            marginTop: 14,
            border: 0,
            borderRadius: 10,
            background: '#4A6CF7',
            color: '#fff',
            padding: '10px 14px',
            fontWeight: 800,
            cursor: 'pointer',
          }}>Sayfayı Yenile</button>
        </div>
      </div>
    )
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
)
