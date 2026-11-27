import { useEffect, useRef } from 'react'

export function Modal({ titulo, aoFechar, children, rodape, largura }) {
  // Não fecha ao clicar fora (evita perder o que foi digitado).
  // Esc pergunta antes de descartar se algum campo foi preenchido/alterado.
  const ref = useRef(null)
  const alterado = useRef(false)
  useEffect(() => {
    const esc = (e) => {
      if (e.key !== 'Escape') return
      if (!alterado.current || window.confirm('Fechar e descartar o que foi digitado?')) aoFechar()
    }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [aoFechar])
  const fechar = () => {
    if (!alterado.current || window.confirm('Fechar e descartar o que foi digitado?')) aoFechar()
  }
  return (
    <div className="modal-fundo">
      <div className="modal" ref={ref} style={largura ? { maxWidth: largura } : undefined} role="dialog" aria-modal="true"
        onInput={() => (alterado.current = true)} onChange={() => (alterado.current = true)}>
        <header>
          <h2>{titulo}</h2>
          <button onClick={fechar} aria-label="Fechar" title="Fechar">×</button>
        </header>
        <div className="corpo">{children}</div>
        {rodape && <footer>{rodape}</footer>}
      </div>
    </div>
  )
}

export function Kpi({ rotulo, valor, sub, cor, texto }) {
  return (
    <div className="kpi" style={{ '--cor': cor }}>
      <div className="rot">{rotulo}</div>
      <div className={`val${texto ? ' texto' : ''}`} title={typeof valor === 'string' ? valor : undefined}>{valor}</div>
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
  azul: 'var(--destaque-texto)',
  ouro: '#d4a017',
  azul2: '#2e75b6',
  verde: '#2e8b57',
  vermelho: '#c0392b',
  roxo: '#7d3c98',
  laranja: '#c55a11',
  cinza: '#5b6575',
}
export const PALETA = ['#2e75b6', '#2e8b57', '#c55a11', '#7d3c98', '#e0a800', '#17a2b8', '#c0392b', '#6c757d', '#1f3864', '#8bc34a', '#ff7043', '#5c6bc0']
