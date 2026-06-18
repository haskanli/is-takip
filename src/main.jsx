import { StrictMode } from 'react'
import { Component } from 'react'
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
    console.error('Corject runtime error:', error, info)
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
        color: '#F8FAFC',
        fontFamily: 'Inter, Segoe UI, sans-serif',
      }}>
        <div style={{
          maxWidth: 620,
          width: '100%',
          background: 'rgba(15,23,42,.86)',
          border: '1px solid rgba(248,250,252,.14)',
          borderRadius: 18,
          padding: 22,
          boxShadow: '0 24px 70px rgba(0,0,0,.34)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 2, color: '#818CF8', marginBottom: 10 }}>
            CORJECT
          </div>
          <h1 style={{ margin: '0 0 8px', fontSize: 22 }}>Ekran yüklenirken bir hata oluştu</h1>
          <p style={{ margin: '0 0 14px', color: '#CBD5E1', lineHeight: 1.55 }}>
            Sayfayı yenilemeyi deneyin. Devam ederse aşağıdaki hata metnini paylaşın.
          </p>
          <pre style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            background: '#111827',
            color: '#FCA5A5',
            borderRadius: 12,
            padding: 12,
            fontSize: 12,
            lineHeight: 1.5,
            maxHeight: 220,
            overflow: 'auto',
          }}>{this.state.error?.message || String(this.state.error)}</pre>
          <button onClick={() => window.location.reload()} style={{
            marginTop: 14,
            border: 0,
            borderRadius: 10,
            padding: '10px 14px',
            background: '#4A6CF7',
            color: '#fff',
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
