import { useEffect, useState } from 'react'
import { supabase, mensagemErro } from '../lib/supabase'
import { Alerta, Carregando } from '../components/ui'
import { dataHoraBR, dataBR, brl } from '../lib/format'

const TABELAS = { lancamentos: 'Lançamento', categorias: 'Categoria', formas_pagamento: 'Forma de pagamento', configuracoes: 'Configurações', usuarios: 'Usuário' }
const ACOES = { INSERT: 'Incluiu', UPDATE: 'Alterou', DELETE: 'Excluiu' }
const IGNORAR = new Set(['atualizado_em', 'atualizado_por', 'criado_em', 'criado_por'])

function resumo(r) {
  const d = r.depois || r.antes || {}
  if (r.tabela === 'lancamentos') return `${dataBR(d.data)} · ${d.tipo} · ${d.descricao} · ${brl(d.valor)}`
  if (r.tabela === 'usuarios') return `${d.nome || ''} (${d.email || ''})`
  if (r.tabela === 'configuracoes') return d.nome_grupo
  return d.nome || ''
}
function mudancas(r) {
  if (r.acao !== 'UPDATE' || !r.antes || !r.depois) return []
  return Object.keys(r.depois)
    .filter((k) => !IGNORAR.has(k) && JSON.stringify(r.antes[k]) !== JSON.stringify(r.depois[k]))
    .map((k) => `${k}: ${r.antes[k] ?? '—'} → ${r.depois[k] ?? '—'}`)
}

export default function Auditoria() {
  const [lista, setLista] = useState(null)
  const [tabela, setTabela] = useState('')
  const [limite, setLimite] = useState(200)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let q = supabase.from('auditoria').select('*').order('em', { ascending: false }).limit(limite)
    if (tabela) q = q.eq('tabela', tabela)
    q.then(({ data, error }) => (error ? setErro(mensagemErro(error)) : setLista(data)))
  }, [tabela, limite])

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Histórico de alterações</h1>
          <p className="muted">Quem incluiu, alterou ou excluiu cada registro</p>
        </div>
        <select value={tabela} onChange={(e) => setTabela(e.target.value)}>
          <option value="">Tudo</option>
          {Object.entries(TABELAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <Alerta tipo="erro">{erro}</Alerta>
      {!lista ? <Carregando /> : (
        <div className="tabela-wrap">
          <table className="tabela">
            <thead><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Registro</th></tr></thead>
            <tbody>
              {lista.length === 0 && <tr><td colSpan={4} className="vazio">Nada registrado.</td></tr>}
              {lista.map((r) => (
                <tr key={r.id}>
                  <td className="nowrap">{dataHoraBR(r.em)}</td>
                  <td>{r.usuario_nome || <span className="muted">sistema</span>}</td>
                  <td className="nowrap">{ACOES[r.acao] || r.acao} {(TABELAS[r.tabela] || r.tabela).toLowerCase()}</td>
                  <td>
                    {resumo(r)}
                    {mudancas(r).map((m) => <div key={m} className="muted small">{m}</div>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {lista && lista.length >= limite && (
        <button style={{ marginTop: 12 }} onClick={() => setLimite(limite + 200)}>Carregar mais</button>
      )}
    </>
  )
}
