import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase, buscarTodos, mensagemErro } from '../lib/supabase'
import { useAuth } from './AuthContext'

const DadosCtx = createContext(null)

// Carrega uma vez configurações, categorias, formas e lançamentos.
// As telas chamam recarregar() depois de gravar algo.
export function DadosProvider({ children }) {
  const { ativo } = useAuth()
  const [config, setConfig] = useState(null)
  const [categorias, setCategorias] = useState([])
  const [formas, setFormas] = useState([])
  const [lancamentos, setLancamentos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const recarregar = useCallback(async () => {
    if (!ativo) return
    setErro('')
    try {
      const [cfg, cats, fps, lancs] = await Promise.all([
        supabase.from('configuracoes').select('*').eq('id', 1).maybeSingle(),
        supabase.from('categorias').select('*').order('tipo').order('ordem').order('nome'),
        supabase.from('formas_pagamento').select('*').order('ordem').order('nome'),
        buscarTodos(() =>
          supabase
            .from('lancamentos')
            .select(
              '*, categoria:categorias(id,nome,tipo), forma:formas_pagamento(id,nome), autor:profiles!lancamentos_criado_por_fkey(nome), editor:profiles!lancamentos_atualizado_por_fkey(nome)'
            )
            .order('data')
            .order('id')
        ),
      ])
      for (const r of [cfg, cats, fps]) if (r.error) throw r.error
      setConfig(cfg.data || { nome_grupo: 'Grupo', saldo_inicial: 0, mes_inicial: new Date().toISOString().slice(0, 7) + '-01' })
      setCategorias(cats.data)
      setFormas(fps.data)
      setLancamentos(lancs)
    } catch (e) {
      setErro(mensagemErro(e))
    } finally {
      setCarregando(false)
    }
  }, [ativo])

  useEffect(() => {
    recarregar()
  }, [recarregar])

  return (
    <DadosCtx.Provider value={{ config, categorias, formas, lancamentos, carregando, erro, recarregar }}>
      {children}
    </DadosCtx.Provider>
  )
}

export const useDados = () => useContext(DadosCtx)
