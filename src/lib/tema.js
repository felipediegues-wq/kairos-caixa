import { useEffect, useState } from 'react'

export const TEMAS = {
  kairos: { nome: 'Kairós', cores: ['#161618', '#f2b705', '#f4f6fa'], barra: '#161618' },
  claro: { nome: 'Claro', cores: ['#1f3864', '#2e75b6', '#f4f6fa'], barra: '#1f3864' },
  escuro: { nome: 'Escuro', cores: ['#0c0c0e', '#f2b705', '#1c1c1f'], barra: '#0c0c0e' },
}
const CHAVE = 'kairos-tema'

export function temaSalvo() {
  try {
    const t = localStorage.getItem(CHAVE)
    return TEMAS[t] ? t : 'kairos'
  } catch {
    return 'kairos'
  }
}

export function aplicarTema(t) {
  document.documentElement.dataset.tema = t
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', TEMAS[t]?.barra || '#161618')
  try {
    localStorage.setItem(CHAVE, t)
  } catch {
    /* navegador sem armazenamento: vale só nesta visita */
  }
  window.dispatchEvent(new CustomEvent('kairos-tema', { detail: t }))
}

// Tema escolhido por este usuário neste aparelho
export function useTema() {
  const [tema, setTema] = useState(temaSalvo)
  useEffect(() => {
    const f = (e) => setTema(e.detail)
    window.addEventListener('kairos-tema', f)
    return () => window.removeEventListener('kairos-tema', f)
  }, [])
  return [tema, aplicarTema]
}
