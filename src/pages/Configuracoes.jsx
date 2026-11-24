import { useState } from 'react'
import { supabase, mensagemErro } from '../lib/supabase'
import { useDados } from '../context/DadosContext'
import { Alerta, Carregando } from '../components/ui'
import { num, lerValor, chaveMes } from '../lib/format'

export default function Configuracoes() {
  const { config, carregando, recarregar } = useDados()
  if (carregando || !config) return <Carregando />
  return <Form config={config} recarregar={recarregar} />
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
