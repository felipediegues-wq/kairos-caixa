import { useEffect, useMemo, useRef, useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts'
import { useDados } from '../context/DadosContext'
import { useAuth } from '../context/AuthContext'
import { Alerta, Carregando, Kpi, CORES } from '../components/ui'
import { TabelaFluxo } from './Fluxo'
import { hojeISO, inicioMesISO, fimMesISO, somarMeses, dataBR, brl, num, pct, compacto, rotuloMes, rotuloMesLongo } from '../lib/format'
import { dadosPeriodo, matrizFluxo, resumoMensal, descricaoPublica, tipoDe } from '../lib/relatorios'

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
  ['categorias', 'Entradas e saídas por categoria'],
  ['lancamentos', 'Lista de lançamentos com saldo'],
  ['assinaturas', 'Linhas de assinatura (só no PDF)'],
  ['fluxo', 'Fluxo de caixa por categoria'],
]

// Medalhão do grupo em base64, para o cabeçalho do PDF
async function carregarLogo() {
  try {
    const resp = await fetch(`${import.meta.env.BASE_URL}medalhao-192.png`)
    const blob = await resp.blob()
    return await new Promise((ok) => {
      const r = new FileReader()
      r.onload = () => ok(r.result)
      r.onerror = () => ok(null)
      r.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

// Texto que acompanha o PDF no WhatsApp (sem nomes de casais)
function textoResumo(config, P, de, ate) {
  return [
    `*${config?.nome_grupo || 'Grupo'} – Relatório de caixa*`,
    `Período: ${dataBR(de)} a ${dataBR(ate)}`,
    '',
    `Saldo no início: ${brl(P.saldoNoInicio)}`,
    `Entradas: ${brl(P.t.entradas)}`,
    `Saídas: ${brl(P.t.saidas)}`,
    `Resultado: ${brl(P.t.resultado)}`,
    `*Saldo no fim: ${brl(P.saldoNoFim)}*`,
    '',
    'Relatório completo em PDF em anexo.',
  ].join('\n')
}

const ehCelular = () => window.matchMedia?.('(pointer: coarse)').matches

export default function Relatorios() {
  const { config, lancamentos, categorias, carregando } = useDados()
  const { perfil } = useAuth()
  const [de, setDe] = useState(inicioMesISO())
  const [ate, setAte] = useState(fimMesISO())
  const [secoes, setSecoes] = useState(Object.fromEntries(SECOES.map(([k]) => [k, true])))
  const [erro, setErro] = useState('')
  const [gerando, setGerando] = useState(false)
  const [visualizar, setVisualizar] = useState(false)
  const [compartilhando, setCompartilhando] = useState(false)
  const [pronto, setPronto] = useState(null) // { arquivo, texto } quando o celular pede um 2º toque
  const [aviso, setAviso] = useState('')
  const refPrevia = useRef(null)

  // deixa o gerador de PDF e o logo carregados, para o compartilhamento sair rápido
  const logoRef = useRef(null)
  useEffect(() => {
    import('../lib/pdf')
    carregarLogo().then((l) => (logoRef.current = l))
  }, [])

  const periodoOk = Boolean(de && ate && ate >= de)

  function validar() {
    setErro('')
    if (!periodoOk) {
      setErro('Período inválido: a data final precisa ser igual ou depois da inicial.')
      return false
    }
    if (!Object.values(secoes).some(Boolean)) {
      setErro('Marque pelo menos uma seção.')
      return false
    }
    return true
  }

  function mostrar() {
    if (!validar()) return
    setVisualizar(true)
    setTimeout(() => refPrevia.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  }

  async function gerar() {
    if (!validar()) return
    setGerando(true)
    try {
      const { gerarPDF } = await import('../lib/pdf') // carrega o gerador só quando precisa
      const logo = await carregarLogo()
      gerarPDF({ config, lancamentos, categorias, opcoes: { de, ate, secoes, emitidoPor: perfil?.nome, logo } })
    } catch (e) {
      console.error(e)
      setErro('Não foi possível gerar o PDF: ' + e.message)
    } finally {
      setGerando(false)
    }
  }

  async function enviarArquivo(arquivo, texto) {
    try {
      await navigator.share({ files: [arquivo], text: texto, title: arquivo.name })
      setPronto(null)
      setAviso('')
    } catch (e) {
      if (e.name === 'AbortError') return // a pessoa desistiu
      if (e.name === 'NotAllowedError') {
        // alguns celulares exigem um novo toque: mostra o botão de envio
        setPronto({ arquivo, texto })
        return
      }
      throw e
    }
  }

  async function compartilhar() {
    if (!validar()) return
    setCompartilhando(true)
    setAviso('')
    setPronto(null)
    try {
      const { gerarPDF } = await import('../lib/pdf')
      const logo = logoRef.current || (await carregarLogo())
      const P = dadosPeriodo(lancamentos, Number(config?.saldo_inicial || 0), de, ate)
      const texto = textoResumo(config, P, de, ate)
      const opcoes = { de, ate, secoes, emitidoPor: perfil?.nome, logo }
      const arquivo = gerarPDF({ config, lancamentos, categorias, opcoes: { ...opcoes, comoArquivo: true } })
      if (navigator.canShare?.({ files: [arquivo] })) {
        await enviarArquivo(arquivo, texto)
      } else {
        // computador: baixa o PDF e abre o WhatsApp com o texto pronto
        const url = URL.createObjectURL(arquivo)
        const a = document.createElement('a')
        a.href = url
        a.download = arquivo.name
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 5000)
        window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank', 'noopener')
        setAviso('O PDF foi baixado. No WhatsApp que abriu, escolha o grupo e anexe o arquivo pelo clipe (📎) antes de enviar.')
      }
    } catch (e) {
      console.error(e)
      setErro('Não foi possível compartilhar: ' + e.message)
    } finally {
      setCompartilhando(false)
    }
  }

  const botaoWhats = (extra = {}) => (
    <button className="btn-whats" onClick={compartilhar} disabled={compartilhando} {...extra}>
      {compartilhando ? 'Preparando…' : <><IconeWhats /> Compartilhar no WhatsApp</>}
    </button>
  )

  if (carregando) return <Carregando />
  const qtd = lancamentos.filter((l) => l.data >= de && l.data <= ate).length

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Relatórios</h1>
          <p className="muted">Confira os dados na tela e depois gere o PDF para a prestação de contas</p>
        </div>
      </div>
      <Alerta tipo="erro">{erro}</Alerta>
      <Alerta tipo="info">{aviso}</Alerta>
      {pronto && (
        <div className="alerta ok" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          PDF pronto para enviar.
          <button className="btn-whats" onClick={() => enviarArquivo(pronto.arquivo, pronto.texto)}><IconeWhats /> Enviar no WhatsApp</button>
        </div>
      )}
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
      <div className="acoes" style={{ marginTop: 16 }}>
        <button className="btn-primario" onClick={mostrar} style={{ padding: '11px 22px' }}>
          👁 {visualizar ? 'Ir para a visualização' : 'Visualizar na tela'}
        </button>
        <button className="btn-perigo" onClick={gerar} disabled={gerando} style={{ padding: '11px 22px' }}>
          {gerando ? 'Gerando…' : '📄 Gerar PDF'}
        </button>
        {botaoWhats({ style: { padding: '11px 22px' } })}
      </div>
      <p className="muted small" style={{ marginTop: 8 }}>
        {ehCelular()
          ? 'No celular, o PDF vai direto para o WhatsApp: é só escolher o grupo.'
          : 'No computador, o PDF é baixado e o WhatsApp Web abre com o resumo pronto: escolha o grupo e anexe o PDF.'}
        {' '}Mensalidades aparecem sem o nome do casal.
      </p>

      {visualizar && periodoOk && (
        <div ref={refPrevia} style={{ scrollMarginTop: 16, marginTop: 24 }}>
          <Previa config={config} lancamentos={lancamentos} categorias={categorias} de={de} ate={ate} secoes={secoes}
            gerando={gerando} aoGerar={gerar} aoFechar={() => setVisualizar(false)} botaoWhats={botaoWhats} />
        </div>
      )}
    </>
  )
}

function Previa({ config, lancamentos, categorias, de, ate, secoes, gerando, aoGerar, aoFechar, botaoWhats }) {
  const saldoIni = Number(config?.saldo_inicial || 0)
  const P = useMemo(() => dadosPeriodo(lancamentos, saldoIni, de, ate), [lancamentos, saldoIni, de, ate])
  const fluxo = useMemo(() => {
    if (!secoes.fluxo) return null
    const qtd = Math.min(12, P.qtdMeses)
    return { ...matrizFluxo(lancamentos, categorias, P.iniMes, qtd), resumo: resumoMensal(lancamentos, saldoIni, P.iniMes, qtd) }
  }, [secoes.fluxo, lancamentos, categorias, P, saldoIni])
  const { t, mensal } = P

  return (
    <div className="previa">
      <div className="previa-topo">
        <div>
          <h2>{config?.nome_grupo} · Relatório de caixa</h2>
          <div className="muted small">Período: {dataBR(de)} a {dataBR(ate)} · {t.qtd} lançamento(s) · atualiza sozinho ao mudar as opções acima</div>
        </div>
        <div className="acoes">
          <button className="btn-perigo" onClick={aoGerar} disabled={gerando}>{gerando ? 'Gerando…' : '📄 Gerar PDF deste relatório'}</button>
          {botaoWhats()}
          <button onClick={aoFechar}>Fechar</button>
        </div>
      </div>

      {secoes.resumo && (
        <section className="card">
          <h2>Resumo do período</h2>
          <div className="grade grade-kpi">
            <Kpi rotulo="Saldo no início" valor={brl(P.saldoNoInicio)} cor={CORES.azul} />
            <Kpi rotulo="Entradas" valor={brl(t.entradas)} cor={CORES.verde} />
            <Kpi rotulo="Saídas" valor={brl(t.saidas)} cor={CORES.vermelho} />
            <Kpi rotulo="Resultado" valor={brl(t.resultado)} cor={t.resultado < 0 ? CORES.vermelho : CORES.azul} />
            <Kpi rotulo="Saldo no fim" valor={brl(P.saldoNoFim)} cor={CORES.azul} />
          </div>
        </section>
      )}

      {secoes.grafico && (
        <section className="card">
          <h2>Entradas x saídas por mês</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={mensal.map((m) => ({ mes: rotuloMes(m.mes), Entradas: m.entradas, Saídas: m.saidas }))}
              margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8ecf2" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={compacto} tick={{ fontSize: 12 }} width={84} />
              <Tooltip formatter={(v) => brl(v)} />
              <Legend />
              <Bar dataKey="Entradas" fill={CORES.verde} radius={[4, 4, 0, 0]} maxBarSize={36} />
              <Bar dataKey="Saídas" fill={CORES.vermelho} radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      {secoes.mensal && (
        <section className="card">
          <h2>Resumo mês a mês</h2>
          <div className="tabela-wrap">
            <table className="tabela">
              <thead>
                <tr><th>Mês</th><th className="right">Saldo inicial</th><th className="right">Entradas</th><th className="right">Saídas</th>
                  <th className="right">Resultado</th><th className="right">Saldo final</th></tr>
              </thead>
              <tbody>
                {mensal.map((m) => (
                  <tr key={m.mes}>
                    <td>{rotuloMesLongo(m.mes)}</td>
                    <td className="right nowrap">{num(m.saldoInicial)}</td>
                    <td className="right nowrap pos">{num(m.entradas)}</td>
                    <td className="right nowrap neg">{num(m.saidas)}</td>
                    <td className={`right nowrap ${m.resultado < 0 ? 'neg' : ''}`}>{num(m.resultado)}</td>
                    <td className="right nowrap"><b>{num(m.saldoFinal)}</b></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td><td></td>
                  <td className="right nowrap">{num(mensal.reduce((a, m) => a + m.entradas, 0))}</td>
                  <td className="right nowrap">{num(mensal.reduce((a, m) => a + m.saidas, 0))}</td>
                  <td className="right nowrap">{num(mensal.reduce((a, m) => a + m.resultado, 0))}</td>
                  <td className="right nowrap">{num(mensal.at(-1).saldoFinal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="muted small" style={{ marginBottom: 0 }}>Cada linha considera o mês inteiro.</p>
        </section>
      )}

      {secoes.categorias && (
        <section className="card">
          <h2>Entradas e saídas por categoria</h2>
          <div className="grade grade-2">
            <TabelaCategorias titulo="Entradas" itens={P.entradasPorCategoria} cor={CORES.verde} />
            <TabelaCategorias titulo="Saídas" itens={P.gastosPorCategoria} cor={CORES.vermelho} />
          </div>
        </section>
      )}

      {secoes.lancamentos && (
        <section className="card">
          <h2>Lançamentos do período</h2>
          <div className="tabela-wrap">
            <table className="tabela">
              <thead>
                <tr><th>Data</th><th>Tipo</th><th>Categoria</th><th>Descrição</th><th>Forma</th><th className="right">Valor</th><th className="right">Saldo</th></tr>
              </thead>
              <tbody>
                {P.lista.length === 0 && <tr><td colSpan={7} className="vazio">Sem lançamentos no período.</td></tr>}
                {P.lista.map((l) => (
                  <tr key={l.id}>
                    <td className="nowrap">{dataBR(l.data)}</td>
                    <td><span className={`tag ${tipoDe(l)}`}>{tipoDe(l)}</span></td>
                    <td>{l.categoria?.nome}</td>
                    <td>{descricaoPublica(l)}</td>
                    <td>{l.forma?.nome}</td>
                    <td className={`right nowrap ${l.tipo === 'Entrada' ? 'pos' : 'neg'}`}>{l.tipo === 'Entrada' ? '' : '−'}{brl(l.valor)}</td>
                    <td className="right nowrap"><b>{brl(l.saldo)}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {secoes.fluxo && fluxo && (
        <section className="card">
          <h2>Fluxo de caixa por categoria ({rotuloMes(fluxo.meses[0])} a {rotuloMes(fluxo.meses.at(-1))})</h2>
          <TabelaFluxo fluxo={fluxo} />
        </section>
      )}

      {secoes.assinaturas && (
        <p className="muted small center">As linhas de assinatura (tesoureiro e coordenador) aparecem no PDF.</p>
      )}

      <div className="acoes" style={{ justifyContent: 'center', marginTop: 12 }}>
        <button className="btn-perigo" onClick={aoGerar} disabled={gerando} style={{ padding: '11px 22px' }}>
          {gerando ? 'Gerando…' : '📄 Gerar PDF deste relatório'}
        </button>
        {botaoWhats({ style: { padding: '11px 22px' } })}
      </div>
    </div>
  )
}

function IconeWhats() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12 2a9.9 9.9 0 0 0-8.5 15l-1.4 5 5.1-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3a.5.5 0 0 0 0-.5l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7a2.8 2.8 0 0 0 1.8-1.3 2.3 2.3 0 0 0 .2-1.3c0-.1-.2-.2-.4-.3Z" />
    </svg>
  )
}

function TabelaCategorias({ titulo, itens, cor }) {
  const total = itens.reduce((a, i) => a + i.valor, 0)
  return (
    <div>
      <h3 style={{ color: cor, marginBottom: 8 }}>{titulo}</h3>
      <div className="tabela-wrap">
        <table className="tabela">
          <thead><tr><th>Categoria</th><th className="right">Total</th><th className="right">%</th><th style={{ width: '26%' }}></th></tr></thead>
          <tbody>
            {itens.length === 0 && <tr><td colSpan={4} className="vazio">Nada no período.</td></tr>}
            {itens.map((i) => (
              <tr key={i.nome}>
                <td>{i.nome}</td>
                <td className="right nowrap">{brl(i.valor)}</td>
                <td className="right nowrap">{pct(i.pct)}</td>
                <td><div className="barra"><div style={{ width: `${i.pct * 100}%`, background: cor }} /></div></td>
              </tr>
            ))}
          </tbody>
          {itens.length > 0 && (
            <tfoot><tr><td>Total</td><td className="right nowrap">{brl(total)}</td><td className="right">100%</td><td></td></tr></tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
