import { useState } from 'react'
import { supabase, mensagemErro } from '../lib/supabase'
import { useDados } from '../context/DadosContext'
import { Alerta, Carregando } from '../components/ui'
import { TIPOS } from '../lib/format'

export default function Categorias() {
  const { categorias, formas, lancamentos, carregando, recarregar } = useDados()
  const [aba, setAba] = useState('Saída')
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')

  if (carregando) return <Carregando />

  const ehForma = aba === 'formas'
  const tabela = ehForma ? 'formas_pagamento' : 'categorias'
  const itens = ehForma ? formas : categorias.filter((c) => c.tipo === aba)
  const uso = (id) => lancamentos.filter((l) => (ehForma ? l.forma_id : l.categoria_id) === id).length

  async function executar(promessa, sucesso) {
    setErro('')
    setOk('')
    const { error } = await promessa
    if (error) return setErro(mensagemErro(error))
    setOk(sucesso)
    recarregar()
  }

  const adicionar = (nome) => {
    const ordem = Math.max(0, ...itens.map((i) => i.ordem || 0)) + 1
    const reg = ehForma ? { nome, ordem } : { nome, tipo: aba, ordem }
    return executar(supabase.from(tabela).insert(reg), `"${nome}" adicionado.`)
  }
  const renomear = (item) => {
    const nome = window.prompt('Novo nome:', item.nome)
    if (!nome || nome.trim() === item.nome) return
    executar(supabase.from(tabela).update({ nome: nome.trim() }).eq('id', item.id), 'Nome alterado. Os lançamentos antigos já mostram o novo nome.')
  }
  const alternar = (item) =>
    executar(supabase.from(tabela).update({ ativo: !item.ativo }).eq('id', item.id), item.ativo ? `"${item.nome}" desativado (não aparece em novos lançamentos).` : `"${item.nome}" reativado.`)
  const excluir = (item) => {
    if (uso(item.id) > 0) return setErro(`"${item.nome}" tem ${uso(item.id)} lançamento(s). Desative em vez de excluir.`)
    if (!window.confirm(`Excluir "${item.nome}"?`)) return
    executar(supabase.from(tabela).delete().eq('id', item.id), `"${item.nome}" excluído.`)
  }
  const mover = async (item, dir) => {
    const lista = [...itens].sort((a, b) => a.ordem - b.ordem)
    const i = lista.findIndex((x) => x.id === item.id)
    const j = i + dir
    if (j < 0 || j >= lista.length) return
    const outro = lista[j]
    const oa = item.ordem === outro.ordem ? i + 1 : item.ordem
    const ob = item.ordem === outro.ordem ? j + 1 : outro.ordem
    const r1 = await supabase.from(tabela).update({ ordem: ob }).eq('id', item.id)
    const r2 = await supabase.from(tabela).update({ ordem: oa }).eq('id', outro.id)
    if (r1.error || r2.error) setErro(mensagemErro(r1.error || r2.error))
    recarregar()
  }

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Categorias e formas de pagamento</h1>
          <p className="muted">O que aparece nas listas ao lançar</p>
        </div>
      </div>
      <div className="abas">
        {TIPOS.map((t) => (
          <button key={t} className={aba === t ? 'ativa' : ''} onClick={() => { setAba(t); setErro(''); setOk('') }}>
            Categorias de {t.toLowerCase()}
          </button>
        ))}
        <button className={ehForma ? 'ativa' : ''} onClick={() => { setAba('formas'); setErro(''); setOk('') }}>Formas de pagamento</button>
      </div>
      <Alerta tipo="erro">{erro}</Alerta>
      <Alerta tipo="ok">{ok}</Alerta>
      <NovoItem key={aba} aoAdicionar={adicionar} />
      <div className="tabela-wrap" style={{ marginTop: 12 }}>
        <table className="tabela">
          <thead>
            <tr><th>Ordem</th><th>Nome</th>{aba === 'Entrada' && <th>Mensalidade de casal</th>}<th>Situação</th><th className="right">Lançamentos</th><th></th></tr>
          </thead>
          <tbody>
            {itens.length === 0 && <tr><td colSpan={5} className="vazio">Nenhum item.</td></tr>}
            {[...itens].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome)).map((item) => (
              <tr key={item.id} style={item.ativo ? undefined : { opacity: 0.6 }}>
                <td className="nowrap">
                  <button className="btn-link" onClick={() => mover(item, -1)} title="Subir">▲</button>
                  <button className="btn-link" onClick={() => mover(item, 1)} title="Descer">▼</button>
                </td>
                <td><b>{item.nome}</b></td>
                {aba === 'Entrada' && (
                  <td>
                    <label className="check" title="Lançamentos desta categoria pedem o casal e os meses pagos">
                      <input type="checkbox" checked={Boolean(item.mensalidade)}
                        onChange={() => executar(supabase.from('categorias').update({ mensalidade: !item.mensalidade }).eq('id', item.id),
                          !item.mensalidade ? `"${item.nome}" agora pede casal e mês (mensalidade).` : `"${item.nome}" não é mais mensalidade.`)} />
                      {item.mensalidade ? 'Sim' : 'Não'}
                    </label>
                  </td>
                )}
                <td>{item.ativo ? <span className="tag tesoureiro">Ativo</span> : <span className="tag inativo">Inativo</span>}</td>
                <td className="right">{uso(item.id)}</td>
                <td className="right nowrap">
                  <button className="btn-link" onClick={() => renomear(item)}>Renomear</button>
                  <button className="btn-link" onClick={() => alternar(item)}>{item.ativo ? 'Desativar' : 'Reativar'}</button>
                  <button className="btn-link perigo" onClick={() => excluir(item)}>Excluir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function NovoItem({ aoAdicionar }) {
  const [nome, setNome] = useState('')
  return (
    <form className="card filtros" onSubmit={async (e) => { e.preventDefault(); if (!nome.trim()) return; await aoAdicionar(nome.trim()); setNome('') }}>
      <label className="campo" style={{ flex: 1 }}>
        Novo item
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" maxLength={60} />
      </label>
      <button className="btn-verde">+ Adicionar</button>
    </form>
  )
}
