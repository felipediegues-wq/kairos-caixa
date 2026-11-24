import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase, mensagemErro } from '../lib/supabase'
import { useDados } from '../context/DadosContext'
import { useAuth } from '../context/AuthContext'
import { Modal, Alerta, Carregando, Kpi, CORES } from '../components/ui'
import { brl, num, dataBR, dataHoraBR, hojeISO, inicioMesISO, fimMesISO, somarMeses, lerValor, TIPOS } from '../lib/format'
import { comSaldo, totais } from '../lib/relatorios'

const PERIODOS = {
  mes: 'Este mês',
  anterior: 'Mês passado',
  ano: 'Este ano',
  tudo: 'Tudo',
  outro: 'Escolher datas',
}
function intervalo(p) {
  const h = hojeISO()
  if (p === 'mes') return [inicioMesISO(h), fimMesISO(h)]
  if (p === 'anterior') {
    const ini = somarMeses(inicioMesISO(h), -1)
    return [ini, fimMesISO(ini)]
  }
  if (p === 'ano') return [h.slice(0, 4) + '-01-01', h.slice(0, 4) + '-12-31']
  return ['', '']
}

export default function Lancamentos() {
  const { lancamentos, categorias, formas, config, carregando, recarregar } = useDados()
  const { podeEditar } = useAuth()
  const [params, setParams] = useSearchParams()
  const [periodo, setPeriodo] = useState('tudo')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [tipo, setTipo] = useState('')
  const [categoria, setCategoria] = useState('')
  const [busca, setBusca] = useState('')
  const [editando, setEditando] = useState(null) // null | {} (novo) | lançamento
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (params.get('novo') && podeEditar) {
      setEditando({})
      setParams({}, { replace: true })
    }
  }, [params, setParams, podeEditar])

  const escolherPeriodo = (p) => {
    setPeriodo(p)
    if (p !== 'outro') {
      const [a, b] = intervalo(p)
      setDe(a)
      setAte(b)
    }
  }

  const todosComSaldo = useMemo(() => comSaldo(lancamentos, config?.saldo_inicial), [lancamentos, config])
  const filtrados = useMemo(() => {
    const b = busca.trim().toLowerCase()
    return todosComSaldo
      .filter((l) => (!de || l.data >= de) && (!ate || l.data <= ate))
      .filter((l) => !tipo || l.tipo === tipo)
      .filter((l) => !categoria || String(l.categoria_id) === categoria)
      .filter((l) => !b || [l.descricao, l.categoria?.nome, l.forma?.nome, l.observacao, l.autor?.nome].join(' ').toLowerCase().includes(b))
      .reverse() // mais recentes primeiro
  }, [todosComSaldo, de, ate, tipo, categoria, busca])
  const t = useMemo(() => totais(filtrados), [filtrados])
  const filtroSimples = !tipo && !categoria && !busca

  async function excluir(l) {
    if (!window.confirm(`Excluir o lançamento "${l.descricao}" de ${dataBR(l.data)} (${brl(l.valor)})?`)) return
    const { error } = await supabase.from('lancamentos').delete().eq('id', l.id)
    if (error) return setMsg(mensagemErro(error))
    setMsg('')
    recarregar()
  }

  function exportarCSV() {
    const linhas = [['Data', 'Tipo', 'Categoria', 'Descrição', 'Forma de pagamento', 'Valor', 'Saldo', 'Observação', 'Lançado por']]
    for (const l of [...filtrados].reverse())
      linhas.push([dataBR(l.data), l.tipo, l.categoria?.nome || '', l.descricao, l.forma?.nome || '', num(l.valor), num(l.saldo), l.observacao || '', l.autor?.nome || ''])
    const csv = linhas.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `lancamentos_${hojeISO()}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  if (carregando) return <Carregando />

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Lançamentos</h1>
          <p className="muted">Entradas, saídas e retiradas do caixa</p>
        </div>
        <div className="acoes">
          <button onClick={exportarCSV} disabled={!filtrados.length}>⬇ Exportar Excel (CSV)</button>
          {podeEditar && <button className="btn-verde" onClick={() => setEditando({})}>+ Novo lançamento</button>}
        </div>
      </div>
      <Alerta tipo="erro">{msg}</Alerta>

      <div className="card">
        <div className="filtros">
          <label className="campo">
            Período
            <select value={periodo} onChange={(e) => escolherPeriodo(e.target.value)}>
              {Object.entries(PERIODOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          {periodo === 'outro' && (
            <>
              <label className="campo">De<input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></label>
              <label className="campo">Até<input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></label>
            </>
          )}
          <label className="campo">
            Tipo
            <select value={tipo} onChange={(e) => { setTipo(e.target.value); setCategoria('') }}>
              <option value="">Todos</option>
              {TIPOS.map((x) => <option key={x}>{x}</option>)}
            </select>
          </label>
          <label className="campo">
            Categoria
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="">Todas</option>
              {categorias.filter((c) => !tipo || c.tipo === tipo).map((c) => (
                <option key={c.id} value={c.id}>{c.nome}{tipo ? '' : ` (${c.tipo})`}</option>
              ))}
            </select>
          </label>
          <label className="campo" style={{ flex: 1, minWidth: 200 }}>
            Buscar
            <input placeholder="Descrição, categoria, forma, quem lançou…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </label>
        </div>
      </div>

      <div className="grade grade-kpi" style={{ margin: '16px 0' }}>
        <Kpi rotulo="Entradas" valor={brl(t.entradas)} cor={CORES.verde} />
        <Kpi rotulo="Saídas" valor={brl(t.saidas)} cor={CORES.vermelho} />
        <Kpi rotulo="Retiradas" valor={brl(t.retiradas)} cor={CORES.roxo} />
        <Kpi rotulo="Resultado" valor={brl(t.resultado)} cor={t.resultado < 0 ? CORES.vermelho : CORES.azul} sub={`${t.qtd} lançamento(s)`} />
      </div>

      <div className="tabela-wrap">
        <table className="tabela">
          <thead>
            <tr>
              <th>Data</th><th>Tipo</th><th>Categoria</th><th>Descrição</th><th>Forma</th>
              <th className="right">Valor</th>
              {filtroSimples && <th className="right">Saldo</th>}
              {podeEditar && <th></th>}
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && (
              <tr><td colSpan={8} className="vazio">Nenhum lançamento encontrado.</td></tr>
            )}
            {filtrados.map((l) => (
              <tr key={l.id}>
                <td className="nowrap">{dataBR(l.data)}</td>
                <td><span className={`tag ${l.tipo}`}>{l.tipo}</span></td>
                <td>{l.categoria?.nome}</td>
                <td>
                  {l.descricao}
                  {l.observacao && <div className="muted small">{l.observacao}</div>}
                  <div className="muted small" title={l.atualizado_em ? `Alterado por ${l.editor?.nome || '?'} em ${dataHoraBR(l.atualizado_em)}` : ''}>
                    por {l.autor?.nome || '—'}{l.atualizado_em ? ' · editado' : ''}
                  </div>
                </td>
                <td>{l.forma?.nome}</td>
                <td className={`right nowrap ${l.tipo === 'Entrada' ? 'pos' : 'neg'}`}>{l.tipo === 'Entrada' ? '' : '−'}{brl(l.valor)}</td>
                {filtroSimples && <td className={`right nowrap ${l.saldo < 0 ? 'neg' : ''}`}><b>{brl(l.saldo)}</b></td>}
                {podeEditar && (
                  <td className="nowrap right">
                    <button className="btn-link" onClick={() => setEditando(l)}>Editar</button>
                    <button className="btn-link" onClick={() => setEditando({ ...l, id: undefined, data: hojeISO() })} title="Duplicar">Duplicar</button>
                    <button className="btn-link perigo" onClick={() => excluir(l)}>Excluir</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!filtroSimples && <p className="muted small">A coluna Saldo aparece quando não há filtro de tipo, categoria ou busca.</p>}

      {editando && (
        <FormLancamento
          inicial={editando}
          categorias={categorias}
          formas={formas}
          aoFechar={() => setEditando(null)}
          aoSalvar={() => { recarregar() }}
        />
      )}
    </>
  )
}

function FormLancamento({ inicial, categorias, formas, aoFechar, aoSalvar }) {
  const novo = !inicial.id
  const [f, setF] = useState({
    data: inicial.data || hojeISO(),
    tipo: inicial.tipo || 'Saída',
    categoria_id: inicial.categoria_id ? String(inicial.categoria_id) : '',
    forma_id: inicial.forma_id ? String(inicial.forma_id) : '',
    descricao: inicial.descricao || '',
    valor: inicial.valor ? num(inicial.valor) : '',
    observacao: inicial.observacao || '',
  })
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const [salvando, setSalvando] = useState(false)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const cats = categorias.filter((c) => c.tipo === f.tipo && (c.ativo || String(c.id) === f.categoria_id))
  const fps = formas.filter((x) => x.ativo || String(x.id) === f.forma_id)

  async function salvar(continuar) {
    setErro('')
    setOk('')
    const valor = lerValor(f.valor)
    if (!f.data) return setErro('Informe a data.')
    if (!f.categoria_id) return setErro('Escolha a categoria.')
    if (!f.descricao.trim()) return setErro('Informe a descrição.')
    if (!(valor > 0)) return setErro('Informe um valor maior que zero.')
    const reg = {
      data: f.data,
      tipo: f.tipo,
      categoria_id: Number(f.categoria_id),
      forma_id: f.forma_id ? Number(f.forma_id) : null,
      descricao: f.descricao.trim(),
      valor: Math.round(valor * 100) / 100,
      observacao: f.observacao.trim() || null,
    }
    setSalvando(true)
    const { error } = novo
      ? await supabase.from('lancamentos').insert(reg)
      : await supabase.from('lancamentos').update(reg).eq('id', inicial.id)
    setSalvando(false)
    if (error) return setErro(mensagemErro(error))
    aoSalvar()
    if (continuar) {
      setF((x) => ({ ...x, descricao: '', valor: '', observacao: '' }))
      setOk('Lançamento salvo! Pode digitar o próximo.')
    } else aoFechar()
  }

  return (
    <Modal
      titulo={novo ? 'Novo lançamento' : 'Editar lançamento'}
      aoFechar={aoFechar}
      rodape={
        <>
          <button onClick={aoFechar}>Cancelar</button>
          {novo && <button onClick={() => salvar(true)} disabled={salvando}>Salvar e lançar outro</button>}
          <button className="btn-verde" onClick={() => salvar(false)} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
        </>
      }
    >
      <Alerta tipo="erro">{erro}</Alerta>
      <Alerta tipo="ok">{ok}</Alerta>
      <form className="form-grade" onSubmit={(e) => { e.preventDefault(); salvar(false) }}>
        <label className="campo">Data<input type="date" value={f.data} onChange={set('data')} required /></label>
        <label className="campo">
          Tipo
          <select value={f.tipo} onChange={(e) => setF((x) => ({ ...x, tipo: e.target.value, categoria_id: '' }))}>
            {TIPOS.map((x) => <option key={x}>{x}</option>)}
          </select>
        </label>
        <label className="campo">
          Valor (R$)
          <input inputMode="decimal" placeholder="0,00" value={f.valor} onChange={set('valor')} required style={{ textAlign: 'right' }} />
        </label>
        <label className="campo">
          Categoria
          <select value={f.categoria_id} onChange={set('categoria_id')} required>
            <option value="">Escolha…</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
        <label className="campo">
          Forma de pagamento
          <select value={f.forma_id} onChange={set('forma_id')}>
            <option value="">—</option>
            {fps.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
          </select>
        </label>
        <label className="campo largo">Descrição<input value={f.descricao} onChange={set('descricao')} maxLength={150} required /></label>
        <label className="campo largo">Observação (opcional)<textarea rows={2} value={f.observacao} onChange={set('observacao')} maxLength={500} /></label>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
