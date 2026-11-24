import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [sessao, setSessao] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [recuperandoSenha, setRecuperandoSenha] = useState(
    () => new URLSearchParams(window.location.search).has('recuperar')
  )

  const carregarPerfil = useCallback(async (user) => {
    if (!user) {
      setPerfil(null)
      return
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
    setPerfil(data || { id: user.id, email: user.email, nome: '', papel: 'leitura', ativo: false })
  }, [])

  useEffect(() => {
    let ativo = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!ativo) return
      setSessao(data.session)
      await carregarPerfil(data.session?.user)
      setCarregando(false)
      limparUrl()
    })
    const { data: sub } = supabase.auth.onAuthStateChange((evento, s) => {
      if (evento === 'PASSWORD_RECOVERY') setRecuperandoSenha(true)
      setSessao(s)
      // fora do callback para não travar o cliente do Supabase
      setTimeout(() => carregarPerfil(s?.user), 0)
    })
    return () => {
      ativo = false
      sub.subscription.unsubscribe()
    }
  }, [carregarPerfil])

  const papel = perfil?.ativo ? perfil.papel : null
  const valor = {
    sessao,
    usuario: sessao?.user || null,
    perfil,
    carregando,
    papel,
    ativo: Boolean(perfil?.ativo),
    eAdmin: papel === 'admin',
    podeEditar: papel === 'admin' || papel === 'tesoureiro',
    recuperandoSenha,
    fimRecuperacao: () => setRecuperandoSenha(false),
    recarregarPerfil: () => carregarPerfil(sessao?.user),
    sair: () => supabase.auth.signOut(),
  }
  return <AuthCtx.Provider value={valor}>{children}</AuthCtx.Provider>
}

// Remove ?code=... e ?recuperar da barra de endereço depois do login por link
function limparUrl() {
  const u = new URL(window.location.href)
  if (u.searchParams.has('code') || u.searchParams.has('recuperar') || u.searchParams.has('error')) {
    u.search = ''
    window.history.replaceState({}, '', u.toString())
  }
}

export const useAuth = () => useContext(AuthCtx)
