import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, LineChart, Line,
  PieChart, Pie, Cell, LabelList,
} from 'recharts'
import { useDados } from '../context/DadosContext'
import { useAuth } from '../context/AuthContext'
import { Kpi, Carregando, CORES, PALETA } from '../components/ui'
import { brl, compacto, dataBR, rotuloMes, rotuloMesLongo, chaveMes, hojeISO, pct, somarMeses } from '../lib/format'
import { totais, resumoMensal, gastosPor, ordenar } from '../lib/relatorios'

const dica = (v) => brl(v)

export default function Painel() {
  const { config, lancamentos, carregando } = useDados()
  const { podeEditar } = useAuth()
  const [mesRef, setMesRef] = useState(chaveMes(hojeISO()))

  const saldoIni = Number(config?.saldo_inicial || 0)
  const geral = useMemo(() => totais(lancamentos), [lancamentos])
  const inicio = config?.mes_inicial || hojeISO().slice(0, 7) + '-01'
  const mensal = useMemo(() => resumoMensal(lancamentos, saldoIni, inicio, 12), [lancamentos, saldoIni, inicio])

  // opções de mês: do primeiro lançamento (ou mês inicial) até 2 meses à frente
  const opcoesMes = useMemo(() => {
    const primeiro = lancamentos[0]?.data && lancamentos[0].data < inicio ? lancamentos[0].data : inicio
    const ate = chaveMes(somarMeses(hojeISO(), 2))
    const lista = []
    let k = chaveMes(primeiro)
    while (k <= ate && lista.length < 120) {
      lista.push(k)
      k = chaveMes(somarMeses(k + '-01', 1))
    }
    return lista.reverse()
  }, [lancamentos, inicio])

  const doMes = useMemo(() => lancamentos.filter((l) => chaveMes(l.data) === mesRef), [lancamentos, mesRef])
  const resMes = useMemo(() => resumoMensal(lancamentos, saldoIni, mesRef + '-01', 1)[0], [lancamentos, saldoIni, mesRef])
  // maior gasto = saídas + retiradas
  const catMes = useMemo(() => gastosPor(doMes, (l) => l.categoria?.nome), [doMes])
  const catPeriodo = useMemo(() => gastosPor(lancamentos, (l) => l.categoria?.nome), [lancamentos])
  const formas = useMemo(() => gastosPor(lancamentos, (l) => l.forma?.nome), [lancamentos])
  const ultimos = useMemo(() => ordenar(lancamentos).slice(-6).reverse(), [lancamentos])

  if (carregando) return <Carregando />

  const dadosMensais = mensal.map((m) => ({
    mes: rotuloMes(m.mes), Entradas: m.entradas, Saídas: m.saidas, Retiradas: m.retiradas, Saldo: m.saldoFinal,
  }))
  const maior = catMes[0]

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Painel</h1>
          <p className="muted">{config?.nome_grupo} · visão geral do caixa</p>
        </div>
        {podeEditar && (
          <Link to="/lancamentos?novo=1" className="btn btn-verde">+ Novo lançamento</Link>
        )}
      </div>

      <div className="grade grade-kpi">
        <Kpi rotulo="Saldo atual" valor={brl(saldoIni + geral.resultado)} cor={CORES.azul} sub={`Saldo inicial ${brl(saldoIni)}`} />
        <Kpi rotulo="Total de entradas" valor={brl(geral.entradas)} cor={CORES.verde} />
        <Kpi rotulo="Total de saídas" valor={brl(geral.saidas)} cor={CORES.vermelho} />
        <Kpi rotulo="Total de retiradas" valor={brl(geral.retiradas)} cor={CORES.roxo} />
        <Kpi rotulo="Lançamentos" valor={geral.qtd} cor={CORES.azul2} />
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="cabecalho" style={{ marginBottom: 12 }}>
          <h2>Resumo do mês</h2>
          <select value={mesRef} onChange={(e) => setMesRef(e.target.value)} aria-label="Mês de referência">
            {opcoesMes.map((k) => (
              <option key={k} value={k}>{rotuloMesLongo(k)}</option>
            ))}
          </select>
        </div>
        <div className="grade grade-kpi">
          <Kpi rotulo="Entradas do mês" valor={brl(resMes.entradas)} cor={CORES.verde} />
          <Kpi rotulo="Saídas do mês" valor={brl(resMes.saidas)} cor={CORES.vermelho} />
          <Kpi rotulo="Retiradas do mês" valor={brl(resMes.retiradas)} cor={CORES.roxo} />
          <Kpi rotulo="Resultado do mês" valor={brl(resMes.resultado)} cor={resMes.resultado < 0 ? CORES.vermelho : CORES.azul} />
          <Kpi rotulo="Saldo no fim do mês" valor={brl(resMes.saldoFinal)} cor={CORES.azul} />
          <Kpi rotulo="Maior gasto do mês" texto valor={maior ? maior.nome : '—'} sub={maior ? `${brl(maior.valor)} · ${pct(maior.pct)} das saídas e retiradas` : 'sem saídas no mês'} cor={CORES.laranja} />
        </div>
      </div>

      <div className="grade grade-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h2>Entradas x saídas x retiradas por mês</h2>
          <ResponsiveContainer width="100%" height={290}>
            <BarChart data={dadosMensais} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8ecf2" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={compacto} tick={{ fontSize: 12 }} width={84} />
              <Tooltip formatter={dica} />
              <Legend />
              <Bar dataKey="Entradas" fill={CORES.verde} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Saídas" fill={CORES.vermelho} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Retiradas" fill={CORES.roxo} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h2>Evolução do saldo (fim de cada mês)</h2>
          <ResponsiveContainer width="100%" height={290}>
            <LineChart data={dadosMensais} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8ecf2" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={compacto} tick={{ fontSize: 12 }} width={84} />
              <Tooltip formatter={dica} />
              <Line type="linear" dataKey="Saldo" stroke={CORES.ouro} strokeWidth={3} dot={{ r: 4, fill: CORES.ouro }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h2>Gastos por categoria (todo o período)</h2>
          {catPeriodo.length === 0 ? (
            <div className="vazio">Nenhum gasto lançado ainda.</div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, catPeriodo.length * 30 + 20)}>
              <BarChart data={catPeriodo} layout="vertical" margin={{ top: 0, right: 90, left: 10, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="nome" width={160} tick={{ fontSize: 12 }} />
                <Tooltip formatter={dica} />
                <Bar dataKey="valor" name="Total" fill={CORES.vermelho} radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="valor" position="right" formatter={brl} style={{ fontSize: 12, fill: 'var(--texto)' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="card">
          <h2>Gastos por forma de pagamento</h2>
          {formas.length === 0 ? (
            <div className="vazio">Nenhum gasto lançado ainda.</div>
          ) : (
            <ResponsiveContainer width="100%" height={290}>
              <PieChart>
                <Pie data={formas} dataKey="valor" nameKey="nome" innerRadius={60} outerRadius={105} paddingAngle={2}
                  label={({ pct: p }) => (p >= 0.04 ? pct(p) : '')} labelLine={false}>
                  {formas.map((f, i) => <Cell key={f.nome} fill={PALETA[i % PALETA.length]} />)}
                </Pie>
                <Tooltip formatter={dica} />
                <Legend layout="vertical" align="right" verticalAlign="middle" />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="cabecalho" style={{ marginBottom: 10 }}>
          <h2>Últimos lançamentos</h2>
          <Link to="/lancamentos">Ver todos →</Link>
        </div>
        {ultimos.length === 0 ? (
          <div className="vazio">Nenhum lançamento ainda.</div>
        ) : (
          <div className="tabela-wrap">
            <table className="tabela">
              <tbody>
                {ultimos.map((l) => (
                  <tr key={l.id}>
                    <td className="nowrap">{dataBR(l.data)}</td>
                    <td><span className={`tag ${l.tipo}`}>{l.tipo}</span></td>
                    <td>{l.descricao}<div className="muted small">{l.categoria?.nome}</div></td>
                    <td className={`right nowrap ${l.tipo === 'Entrada' ? 'pos' : 'neg'}`}>
                      {l.tipo === 'Entrada' ? '+' : '−'} {brl(l.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
