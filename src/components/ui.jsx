import { useEffect } from 'react'

export function Modal({ titulo, aoFechar, children, rodape, largura }) {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && aoFechar()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [aoFechar])
  return (
    <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="modal" style={largura ? { maxWidth: largura } : undefined} role="dialog" aria-modal="true">
        <header>
          <h2>{titulo}</h2>
          <button onClick={aoFechar} aria-label="Fechar">×</button>
        </header>
        <div className="corpo">{children}</div>
        {rodape && <footer>{rodape}</footer>}
      </div>
    </div>
  )
}

export function Kpi({ rotulo, valor, sub, cor }) {
  return (
    <div className="kpi" style={{ '--cor': cor }}>
      <div className="rot">{rotulo}</div>
      <div className="val">{valor}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  )
}

export function Alerta({ tipo = 'info', children }) {
  if (!children) return null
  return <div className={`alerta ${tipo}`}>{children}</div>
}

export function Carregando({ texto = 'Carregando…' }) {
  return <div className="carregando">{texto}</div>
}

export const CORES = {
  azul: '#1d1d1f',
  ouro: '#d4a017',
  azul2: '#2e75b6',
  verde: '#2e8b57',
  vermelho: '#c0392b',
  roxo: '#7d3c98',
  laranja: '#c55a11',
  cinza: '#5b6575',
}
export const PALETA = ['#2e75b6', '#2e8b57', '#c55a11', '#7d3c98', '#e0a800', '#17a2b8', '#c0392b', '#6c757d', '#1f3864', '#8bc34a', '#ff7043', '#5c6bc0']
