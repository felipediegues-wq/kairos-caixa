import { useMemo, useState } from 'react'
import { supabase, mensagemErro } from '../lib/supabase'
import { useDados } from '../context/DadosContext'
import { useAuth } from '../context/AuthContext'
import { Modal, Alerta, Carregando } from '../components/ui'
import { FUNCOES, rotuloMesLongo, chaveMes, hojeISO } from '../lib/format'

const ORDEM_FUNCAO = ['coordenador', 'vice_coordenador', 'secretario', 'financeiro', 'boa_vontade', 'membro']

export default function Casais() {
  const { casais, carregando, recarregar } = useDados()
  const { podeVerDevedores } = useAuth()
  const podeEditar = podeVerDevedores // admin, casal coordenador e casal secretário
  const [editando, setEditando] = useState(null)
  const [mostrarSaiu, setMostrarSaiu] = useState(false)
  const [busca, setBusca] = useState('')
  const [ok, setOk] = useState('')

  const lista = useMemo(() => {
    const b = busca.trim().toLowerCase()
    return casais
      .filter((c) => mostrarSaiu || !c.mes_saida)
      .filter((c) => !b || [c.nome, c.esposo, c.esposa, c.telefone, c.email].join(' ').toLowerCase().includes(b))
      .sort((a, b2) => ORDEM_FUNCAO.indexOf(a.funcao) - ORDEM_FUNCAO.indexOf(b2.funcao) || a.nome.localeCompare(b2.nome))
  }, [casais, mostrarSaiu, busca])

  if (carregando) return <Carregando />
  const ativos = casais.filter((c) => !c.mes_saida).length

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Casais</h1>
          <p className="muted">{ativos} casal(is) ativo(s) no grupo</p>
        </div>
        {podeEditar && <button className="btn-verde" onClick={() => setEditando({})}>+ Novo casal</button>}
      </div>
      <Alerta tipo="ok">{ok}</Alerta>
      {!podeEditar && (
        <Alerta tipo="info">Somente o administrador, o casal coordenador e o casal secretário podem cadastrar ou alterar casais.</Alerta>
      )}
      <div className="card filtros">
        <label className="campo" style={{ flex: 1, minWidth: 220 }}>
          Buscar
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome, telefone, e-mail…" />
        </label>
        <label className="check" style={{ paddingBottom: 8 }}>
          <input type="checkbox" checked={mostrarSaiu} onChange={(e) => setMostrarSaiu(e.target.checked)} />
          Mostrar casais que saíram
        </label>
      </div>

      <div className="tabela-wrap" style={{ marginTop: 14 }}>
        <table className="tabela">
          <thead>
            <tr><th>Casal</th><th>Função</th><th>Contato</th><th>No grupo desde</th><th>Situação</th>{podeEditar && <th></th>}</tr>
          </thead>
          <tbody>
            {lista.length === 0 && <tr><td colSpan={6} className="vazio">Nenhum casal cadastrado.</td></tr>}
            {lista.map((c) => (
              <tr key={c.id}>
                <td>
                  <b>{c.nome}</b>
                  {(c.esposo || c.esposa) && <div className="muted small">{[c.esposo, c.esposa].filter(Boolean).join(' e ')}</div>}
                </td>
                <td><span className={`tag funcao-${c.funcao}`}>{FUNCOES[c.funcao]}</span></td>
                <td className="small">{c.telefone}{c.telefone && c.email ? <br /> : null}{c.email}</td>
                <td className="nowrap">{rotuloMesLongo(chaveMes(c.mes_entrada))}</td>
                <td>{c.mes_saida ? <span className="tag inativo">Saiu em {rotuloMesLongo(chaveMes(c.mes_saida))}</span> : <span className="tag tesoureiro">Ativo</span>}</td>
                {podeEditar && <td className="right"><button className="btn-link" onClick={() => setEditando(c)}>Editar</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        A <b>função</b> do casal define quem vê o relatório de mensalidades em aberto: o casal coordenador e o casal secretário
        (além do administrador). Para isso, o login da pessoa precisa estar ligado ao casal em <i>Usuários e acessos</i>.
      </p>

      {editando && (
        <FormCasal inicial={editando} aoFechar={() => setEditando(null)}
          aoSalvar={(txt) => { setOk(txt); setEditando(null); recarregar() }} />
      )}
    </>
  )
}

function FormCasal({ inicial, aoFechar, aoSalvar }) {
  const novo = !inicial.id
  const [f, setF] = useState({
    nome: inicial.nome || '',
    esposo: inicial.esposo || '',
    esposa: inicial.esposa || '',
    telefone: inicial.telefone || '',
    email: inicial.email || '',
    funcao: inicial.funcao || 'membro',
    mes_entrada: chaveMes(inicial.mes_entrada || hojeISO()),
    saiu: Boolean(inicial.mes_saida),
    mes_saida: inicial.mes_saida ? chaveMes(inicial.mes_saida) : chaveMes(hojeISO()),
    observacao: inicial.observacao || '',
  })
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  // monta o nome do casal a partir dos dois nomes, se o campo estiver vazio
  const sugerirNome = () => {
    if (f.nome.trim() || !(f.esposo.trim() && f.esposa.trim())) return
    setF((x) => ({ ...x, nome: `${x.esposo.trim().split(' ')[0]} e ${x.esposa.trim()}` }))
  }

  async function salvar(e) {
    e?.preventDefault()
    setErro('')
    if (!f.nome.trim()) return setErro('Informe o nome do casal.')
    if (!f.mes_entrada) return setErro('Informe o mês de entrada no grupo.')
    if (f.saiu && f.mes_saida < f.mes_entrada) return setErro('O mês de saída não pode ser antes do mês de entrada.')
    const reg = {
      nome: f.nome.trim(),
      esposo: f.esposo.trim() || null,
      esposa: f.esposa.trim() || null,
      telefone: f.telefone.trim() || null,
      email: f.email.trim() || null,
      funcao: f.funcao,
      mes_entrada: f.mes_entrada + '-01',
      mes_saida: f.saiu ? f.mes_saida + '-01' : null,
      observacao: f.observacao.trim() || null,
    }
    setSalvando(true)
    const { error } = novo
      ? await supabase.from('casais').insert(reg)
      : await supabase.from('casais').update(reg).eq('id', inicial.id)
    setSalvando(false)
    if (error) return setErro(mensagemErro(error))
    aoSalvar(novo ? `Casal "${reg.nome}" cadastrado.` : `Casal "${reg.nome}" atualizado.`)
  }

  async function excluir() {
    if (!window.confirm(`Excluir o casal "${inicial.nome}"? Se ele já tiver mensalidades lançadas, marque "Saiu do grupo" em vez de excluir.`)) return
    const { error } = await supabase.from('casais').delete().eq('id', inicial.id)
    if (error) return setErro(mensagemErro(error))
    aoSalvar(`Casal "${inicial.nome}" excluído.`)
  }

  return (
    <Modal titulo={novo ? 'Novo casal' : 'Editar casal'} aoFechar={aoFechar}
      rodape={
        <>
          {!novo && <button className="btn-link perigo" onClick={excluir} style={{ marginRight: 'auto' }}>Excluir</button>}
          <button onClick={aoFechar}>Cancelar</button>
          <button className="btn-verde" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
        </>
      }>
      <Alerta tipo="erro">{erro}</Alerta>
      <form className="form-grade" onSubmit={salvar}>
        <label className="campo">Esposo<input value={f.esposo} onChange={set('esposo')} onBlur={sugerirNome} maxLength={80} /></label>
        <label className="campo">Esposa<input value={f.esposa} onChange={set('esposa')} onBlur={sugerirNome} maxLength={80} /></label>
        <label className="campo largo">
          Nome do casal (como aparece nas listas)
          <input value={f.nome} onChange={set('nome')} placeholder="Ex.: João e Maria Silva" maxLength={100} required />
        </label>
        <label className="campo">
          Função no grupo
          <select value={f.funcao} onChange={set('funcao')}>
            {ORDEM_FUNCAO.map((k) => <option key={k} value={k}>{FUNCOES[k]}</option>)}
          </select>
        </label>
        <label className="campo">
          No grupo desde (paga a partir de)
          <input type="month" value={f.mes_entrada} onChange={set('mes_entrada')} required />
        </label>
        <label className="campo">Telefone / WhatsApp<input value={f.telefone} onChange={set('telefone')} maxLength={30} /></label>
        <label className="campo">E-mail<input type="email" value={f.email} onChange={set('email')} maxLength={100} /></label>
        <div className="largo" style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label className="check" style={{ paddingBottom: 8 }}>
            <input type="checkbox" checked={f.saiu} onChange={(e) => setF((x) => ({ ...x, saiu: e.target.checked }))} />
            Saiu do grupo
          </label>
          {f.saiu && (
            <label className="campo">Último mês no grupo<input type="month" value={f.mes_saida} onChange={set('mes_saida')} /></label>
          )}
        </div>
        <label className="campo largo">Observação<textarea rows={2} value={f.observacao} onChange={set('observacao')} maxLength={500} /></label>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
