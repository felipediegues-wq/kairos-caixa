import { useState } from 'react'
import { supabase, mensagemErro } from '../lib/supabase'
import { useDados } from '../context/DadosContext'
import { Alerta, Carregando } from '../components/ui'
import { num, lerValor, chaveMes, brl, rotuloMesLongo, hojeISO } from '../lib/format'

export default function Configuracoes() {
  const { config, valoresMensalidade, carregando, recarregar } = useDados()
  if (carregando || !config) return <Carregando />
  return (
    <>
      <Form config={config} recarregar={recarregar} />
      <ValoresMensalidade valores={valoresMensalidade} recarregar={recarregar} />
    </>
  )
}

function Form({ config, recarregar }) {
  const [nome, setNome] = useState(config.nome_grupo)
  const [saldo, setSaldo] = useState(num(config.saldo_inicial))
  const [mes, setMes] = useState(chaveMes(config.mes_inicial))
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function salvar(e) {
    e.preventDefault()
    setErro('')
    setOk('')
    const v = lerValor(saldo)
    if (Number.isNaN(v)) return setErro('Saldo inicial inválido.')
    if (!nome.trim()) return setErro('Informe o nome do grupo.')
    setSalvando(true)
    const { error } = await supabase
      .from('configuracoes')
      .update({ nome_grupo: nome.trim(), saldo_inicial: Math.round(v * 100) / 100, mes_inicial: mes + '-01' })
      .eq('id', 1)
    setSalvando(false)
    if (error) return setErro(mensagemErro(error))
    setOk('Configurações salvas.')
    recarregar()
  }

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Configurações</h1>
          <p className="muted">Dados gerais do caixa</p>
        </div>
      </div>
      <Alerta tipo="erro">{erro}</Alerta>
      <Alerta tipo="ok">{ok}</Alerta>
      <form className="card" onSubmit={salvar} style={{ maxWidth: 640 }}>
        <div className="form-grade">
          <label className="campo largo">
            Nome do grupo
            <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} />
          </label>
          <label className="campo">
            Saldo inicial (R$)
            <input value={saldo} onChange={(e) => setSaldo(e.target.value)} inputMode="decimal" style={{ textAlign: 'right' }} />
          </label>
          <label className="campo">
            Mês inicial dos relatórios
            <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
          </label>
        </div>
        <p className="muted small">
          <b>Saldo inicial</b>: quanto havia em caixa/conta antes do primeiro lançamento registrado no sistema.
          <br />
          <b>Mês inicial</b>: primeiro mês mostrado no Painel e no Fluxo de Caixa.
        </p>
        <button className="btn-primario" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
      </form>
    </>
  )
}

function ValoresMensalidade({ valores, recarregar }) {
  const [mes, setMes] = useState(chaveMes(hojeISO()))
  const [valor, setValor] = useState('')
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const atual = [...valores].filter((v) => v.vigente_desde <= hojeISO()).at(-1)

  async function adicionar(e) {
    e.preventDefault()
    setErro(''); setOk('')
    const v = lerValor(valor)
    if (!(v >= 0) || valor === '') return setErro('Informe o valor da mensalidade.')
    const { error } = await supabase.from('mensalidade_valores')
      .upsert({ vigente_desde: mes + '-01', valor: Math.round(v * 100) / 100 }, { onConflict: 'vigente_desde' })
    if (error) return setErro(mensagemErro(error))
    setOk(`Mensalidade de ${brl(v)} a partir de ${rotuloMesLongo(mes)}.`)
    setValor('')
    recarregar()
  }
  async function remover(v) {
    if (!window.confirm(`Remover o valor de ${brl(v.valor)} vigente desde ${rotuloMesLongo(chaveMes(v.vigente_desde))}?`)) return
    const { error } = await supabase.from('mensalidade_valores').delete().eq('id', v.id)
    if (error) return setErro(mensagemErro(error))
    recarregar()
  }

  return (
    <div className="card" style={{ maxWidth: 640, marginTop: 16 }}>
      <h2>Valor da mensalidade dos casais</h2>
      <p className="muted small" style={{ marginTop: 0 }}>
        Valor único para todos os casais. Para reajustar, adicione o novo valor a partir do mês em que passa a valer: os meses anteriores continuam com o valor antigo.
        {atual && <> Valor atual: <b>{brl(atual.valor)}</b>.</>}
      </p>
      <Alerta tipo="erro">{erro}</Alerta>
      <Alerta tipo="ok">{ok}</Alerta>
      <form className="filtros" onSubmit={adicionar}>
        <label className="campo">A partir de<input type="month" value={mes} onChange={(e) => setMes(e.target.value)} required /></label>
        <label className="campo">Valor (R$)<input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" placeholder="0,00" style={{ textAlign: 'right' }} /></label>
        <button className="btn-primario">Salvar valor</button>
      </form>
      {valores.length > 0 && (
        <div className="tabela-wrap" style={{ marginTop: 12 }}>
          <table className="tabela">
            <thead><tr><th>Vale a partir de</th><th className="right">Valor</th><th></th></tr></thead>
            <tbody>
              {[...valores].reverse().map((v) => (
                <tr key={v.id}>
                  <td>{rotuloMesLongo(chaveMes(v.vigente_desde))}</td>
                  <td className="right">{brl(v.valor)}</td>
                  <td className="right"><button className="btn-link perigo" onClick={() => remover(v)}>Remover</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
