import { useMemo, useState } from 'react'
import { useDados } from '../context/DadosContext'
import { Carregando } from '../components/ui'
import { num, rotuloMes, somarMeses, chaveMes } from '../lib/format'
import { matrizFluxo, resumoMensal } from '../lib/relatorios'

export function useFluxo(inicioISO) {
  const { lancamentos, categorias, config } = useDados()
  return useMemo(() => {
    const m = matrizFluxo(lancamentos, categorias, inicioISO, 12)
    const res = resumoMensal(lancamentos, config?.saldo_inicial, inicioISO, 12)
    return { ...m, resumo: res }
  }, [lancamentos, categorias, config, inicioISO])
}

const cel = (v, k) => (Math.abs(v) < 0.005 ? <td key={k} className="right zero">–</td> : <td key={k} className={`right nowrap ${v < 0 ? 'neg' : ''}`}>{num(v)}</td>)

export function TabelaFluxo({ fluxo }) {
  const { meses, porTipo, resumo } = fluxo
  const totalRes = resumo.reduce((a, r) => a + r.resultado, 0)
  return (
    <div className="tabela-wrap">
      <table className="tabela fluxo">
        <thead>
          <tr>
            <th>Categoria</th>
            {meses.map((k) => <th key={k} className="right">{rotuloMes(k)}</th>)}
            <th className="right">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr className="res">
            <td>Saldo inicial do mês</td>
            {resumo.map((r) => cel(r.saldoInicial, r.mes))}
            {cel(resumo[0].saldoInicial, 't')}
          </tr>
          {['Entrada', 'Saída', 'Retirada'].map((tipo) => {
            const g = porTipo[tipo]
            const nome = { Entrada: 'ENTRADAS', Saída: 'SAÍDAS', Retirada: 'RETIRADAS' }[tipo]
            return [
              <tr key={tipo + 'h'} className={`sec ${tipo}`}><td colSpan={meses.length + 2}>{nome}</td></tr>,
              ...g.linhas.map((l) => (
                <tr key={tipo + l.categoria.id}>
                  <td style={{ paddingLeft: 24 }}>{l.categoria.nome}{l.categoria.ativo === false ? ' (inativa)' : ''}</td>
                  {l.valores.map((v, i) => <Celula key={i} v={v} />)}
                  <td className="right nowrap"><b>{num(l.total)}</b></td>
                </tr>
              )),
              <tr key={tipo + 't'} className={`tot ${tipo}`}>
                <td>Total de {nome.toLowerCase()}</td>
                {g.totais.map((v, i) => <td key={i} className="right nowrap">{num(v)}</td>)}
                <td className="right nowrap">{num(g.total)}</td>
              </tr>,
            ]
          })}
          <tr className="res">
            <td>RESULTADO DO MÊS</td>
            {resumo.map((r) => cel(r.resultado, r.mes))}
            {cel(totalRes, 't')}
          </tr>
          <tr className="destaque">
            <td>SALDO FINAL DO MÊS</td>
            {resumo.map((r) => <td key={r.mes} className="right nowrap">{num(r.saldoFinal)}</td>)}
            <td className="right nowrap">{num(resumo[resumo.length - 1].saldoFinal)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
function Celula({ v }) {
  return Math.abs(v) < 0.005 ? <td className="right zero">–</td> : <td className="right nowrap">{num(v)}</td>
}

export default function Fluxo() {
  const { config, carregando } = useDados()
  const [inicio, setInicio] = useState(null)
  const ini = inicio || config?.mes_inicial || new Date().toISOString().slice(0, 7) + '-01'
  const fluxo = useFluxo(ini)
  if (carregando) return <Carregando />
  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Fluxo de Caixa</h1>
          <p className="muted">12 meses a partir de {rotuloMes(chaveMes(ini))} · valores em R$</p>
        </div>
        <div className="acoes">
          <button onClick={() => setInicio(somarMeses(ini, -12))}>← 12 meses</button>
          <label className="campo" style={{ flexDirection: 'row', alignItems: 'center' }}>
            Início
            <input type="month" value={chaveMes(ini)} onChange={(e) => e.target.value && setInicio(e.target.value + '-01')} />
          </label>
          <button onClick={() => setInicio(somarMeses(ini, 12))}>12 meses →</button>
        </div>
      </div>
      <TabelaFluxo fluxo={fluxo} />
    </>
  )
}
