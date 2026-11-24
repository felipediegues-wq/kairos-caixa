import { useState } from 'react'
import { useDados } from '../context/DadosContext'
import { useAuth } from '../context/AuthContext'
import { Alerta, Carregando } from '../components/ui'
import { hojeISO, inicioMesISO, fimMesISO, somarMeses, dataBR } from '../lib/format'

const ATALHOS = [
  ['Este mês', () => [inicioMesISO(), fimMesISO()]],
  ['Mês passado', () => { const i = somarMeses(inicioMesISO(), -1); return [i, fimMesISO(i)] }],
  ['Últimos 3 meses', () => [somarMeses(inicioMesISO(), -2), fimMesISO()]],
  ['Este ano', () => { const a = hojeISO().slice(0, 4); return [`${a}-01-01`, `${a}-12-31`] }],
  ['Ano passado', () => { const a = Number(hojeISO().slice(0, 4)) - 1; return [`${a}-01-01`, `${a}-12-31`] }],
]

const SECOES = [
  ['resumo', 'Resumo do período (saldos, entradas, saídas)'],
  ['grafico', 'Gráfico mensal'],
  ['mensal', 'Resumo mês a mês'],
  ['categorias', 'Entradas e gastos por categoria'],
  ['lancamentos', 'Lista de lançamentos com saldo'],
  ['assinaturas', 'Linhas de assinatura (tesoureiro e coordenador)'],
  ['fluxo', 'Fluxo de caixa por categoria (página em paisagem)'],
]

export default function Relatorios() {
  const { config, lancamentos, categorias, carregando } = useDados()
  const { perfil } = useAuth()
  const [de, setDe] = useState(inicioMesISO())
  const [ate, setAte] = useState(fimMesISO())
  const [secoes, setSecoes] = useState(Object.fromEntries(SECOES.map(([k]) => [k, true])))
  const [erro, setErro] = useState('')
  const [gerando, setGerando] = useState(false)

  async function gerar() {
    setErro('')
    if (!de || !ate || ate < de) return setErro('Período inválido.')
    if (!Object.values(secoes).some(Boolean)) return setErro('Marque pelo menos uma seção.')
    setGerando(true)
    try {
      const { gerarPDF } = await import('../lib/pdf') // carrega o gerador só quando precisa
      gerarPDF({ config, lancamentos, categorias, opcoes: { de, ate, secoes, emitidoPor: perfil?.nome } })
    } catch (e) {
      console.error(e)
      setErro('Não foi possível gerar o PDF: ' + e.message)
    } finally {
      setGerando(false)
    }
  }

  if (carregando) return <Carregando />
  const qtd = lancamentos.filter((l) => l.data >= de && l.data <= ate).length

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Relatórios em PDF</h1>
          <p className="muted">Prestação de contas pronta para imprimir ou enviar ao grupo</p>
        </div>
      </div>
      <Alerta tipo="erro">{erro}</Alerta>
      <div className="grade grade-2">
        <div className="card">
          <h2>1. Período</h2>
          <div className="acoes" style={{ marginBottom: 12 }}>
            {ATALHOS.map(([rot, fn]) => (
              <button key={rot} className="btn-pequeno" onClick={() => { const [a, b] = fn(); setDe(a); setAte(b) }}>{rot}</button>
            ))}
          </div>
          <div className="form-grade">
            <label className="campo">De<input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></label>
            <label className="campo">Até<input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></label>
          </div>
          <p className="muted small" style={{ marginTop: 10 }}>
            {qtd} lançamento(s) entre {dataBR(de)} e {dataBR(ate)}.
          </p>
        </div>
        <div className="card">
          <h2>2. O que incluir</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {SECOES.map(([k, rot]) => (
              <label key={k} className="check">
                <input type="checkbox" checked={secoes[k]} onChange={(e) => setSecoes((s) => ({ ...s, [k]: e.target.checked }))} />
                {rot}
              </label>
            ))}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 16 }}>
        <button className="btn-perigo" onClick={gerar} disabled={gerando} style={{ padding: '11px 22px' }}>
          {gerando ? 'Gerando…' : '📄 Gerar PDF'}
        </button>
      </div>
    </>
  )
}
