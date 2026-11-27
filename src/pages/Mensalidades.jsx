import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, mensagemErro } from '../lib/supabase'
import { useDados } from '../context/DadosContext'
import { useAuth } from '../context/AuthContext'
import { Alerta, Carregando, Kpi, CORES, Modal } from '../components/ui'
import { valorMensalidade } from '../lib/relatorios'
import { brl, num, rotuloMes, rotuloMesLongo, chaveMes, hojeISO, FUNCOES } from '../lib/format'

// Agrupa as linhas (casal x mês) vindas do banco
function agrupar(linhas) {
  const m = new Map()
  for (const r of linhas) {
    let c = m.get(r.casal_id)
    if (!c) {
      c = { id: r.casal_id, nome: r.casal, funcao: r.funcao, meses: [], esperado: 0, pago: 0, falta: 0, emAberto: [] }
      m.set(r.casal_id, c)
    }
    const esperado = Number(r.esperado)
    const pago = Number(r.pago)
    const falta = Math.max(0, esperado - Number(r.pago))
    c.meses.push({ mes: chaveMes(r.mes), esperado, pago: Number(r.pago), falta })
    c.esperado += esperado
    c.pago += pago
    c.falta += falta
    if (falta > 0.004) c.emAberto.push({ mes: chaveMes(r.mes), falta, parcial: Number(r.pago) > 0 })
  }
  return [...m.values()].sort((a, b) => b.falta - a.falta || a.nome.localeCompare(b.nome))
}

export default function Mensalidades() {
  const { podeVerDevedores } = useAuth()
  const { config, valoresMensalidade, casais: cadastroCasais, carregando } = useDados()
  const [lembrete, setLembrete] = useState(null) // { tipo: 'grupo' } | { tipo: 'casal', casal }
  const [ate, setAte] = useState(chaveMes(hojeISO()))
  const [linhas, setLinhas] = useState(null)
  const [erro, setErro] = useState('')
  const [filtro, setFiltro] = useState('devendo')
  const [aberto, setAberto] = useState(null)
  const [gerando, setGerando] = useState(false)

  const carregar = useCallback(async () => {
    setErro('')
    setLinhas(null)
    const { data, error } = await supabase.rpc('relatorio_mensalidades', { p_ate: ate + '-01' })
    if (error) {
      setErro(mensagemErro(error))
      setLinhas([])
    } else setLinhas(data)
  }, [ate])

  useEffect(() => {
    if (podeVerDevedores) carregar()
  }, [podeVerDevedores, carregar])

  const casais = useMemo(() => (linhas ? agrupar(linhas) : []), [linhas])
  const devendo = casais.filter((c) => c.falta > 0.004)
  const visiveis = filtro === 'devendo' ? devendo : casais
  const totalAberto = devendo.reduce((a, c) => a + c.falta, 0)

  async function gerarPDF() {
    setGerando(true)
    try {
      const { pdfMensalidades } = await import('../lib/pdfMensalidades')
      const resp = await fetch(`${import.meta.env.BASE_URL}medalhao-192.png`).catch(() => null)
      let logo = null
      if (resp?.ok) {
        const blob = await resp.blob()
        logo = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => ok(null); r.readAsDataURL(blob) })
      }
      pdfMensalidades({ grupo: config?.nome_grupo, ate, casais: visiveis, apenasDevendo: filtro === 'devendo', logo })
    } catch (e) {
      setErro('Não foi possível gerar o PDF: ' + e.message)
    } finally {
      setGerando(false)
    }
  }

  if (!podeVerDevedores)
    return (
      <>
        <div className="cabecalho"><h1>Mensalidades em aberto</h1></div>
        <Alerta tipo="aviso">Este relatório é restrito ao casal coordenador, ao casal secretário e ao administrador.</Alerta>
      </>
    )
  if (carregando) return <Carregando />

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Mensalidades em aberto</h1>
          <p className="muted">Quem está em dia e quem ainda deve · acesso restrito</p>
        </div>
        <div className="acoes">
          <label className="campo" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            Considerar até
            <input type="month" value={ate} onChange={(e) => e.target.value && setAte(e.target.value)} />
          </label>
          <button className="btn-whats" onClick={() => setLembrete({ tipo: 'grupo' })} disabled={!linhas}><IconeWhats /> Lembrete para o grupo</button>
          <button className="btn-perigo" onClick={gerarPDF} disabled={gerando || !linhas}>{gerando ? 'Gerando…' : '📄 Gerar PDF'}</button>
        </div>
      </div>
      <Alerta tipo="erro">{erro}</Alerta>
      {valoresMensalidade.length === 0 && (
        <Alerta tipo="aviso">O valor da mensalidade ainda não foi definido. O administrador deve informá-lo em <b>Configurações</b>.</Alerta>
      )}

      {!linhas ? <Carregando /> : (
        <>
          <div className="grade grade-kpi">
            <Kpi rotulo="Casais devendo" valor={devendo.length} cor={devendo.length ? CORES.vermelho : CORES.verde} sub={`de ${casais.length} casal(is) com cobrança`} />
            <Kpi rotulo="Total em aberto" valor={brl(totalAberto)} cor={CORES.vermelho} />
            <Kpi rotulo="Casais em dia" valor={casais.length - devendo.length} cor={CORES.verde} />
            <Kpi rotulo="Total recebido" valor={brl(casais.reduce((a, c) => a + c.pago, 0))} cor={CORES.azul} sub={`até ${rotuloMesLongo(ate)}`} />
          </div>

          <div className="abas" style={{ marginTop: 18 }}>
            <button className={filtro === 'devendo' ? 'ativa' : ''} onClick={() => setFiltro('devendo')}>Devendo ({devendo.length})</button>
            <button className={filtro === 'todos' ? 'ativa' : ''} onClick={() => setFiltro('todos')}>Todos os casais ({casais.length})</button>
          </div>

          <div className="legenda-meses" style={{ marginBottom: 8 }}>
            <span className="tag mes-pago">✓ pago</span>
            <span className="tag mes-parcial">½ parcial</span>
            <span className="tag mes-aberto">em aberto</span>
            <span>· passe o mouse (ou toque) no mês para ver o valor</span>
          </div>
          <div className="tabela-wrap">
            <table className="tabela">
              <thead>
                <tr><th>Casal</th><th>Função</th><th>Meses</th><th className="right">Pago</th><th className="right">Em aberto</th><th></th></tr>
              </thead>
              <tbody>
                {visiveis.length === 0 && (
                  <tr><td colSpan={6} className="vazio">{filtro === 'devendo' ? '🎉 Nenhum casal devendo até este mês.' : 'Nenhum casal com cobrança no período.'}</td></tr>
                )}
                {visiveis.map((c) => [
                  <tr key={c.id}>
                    <td><b>{c.nome}</b></td>
                    <td className="small">{FUNCOES[c.funcao]}</td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {c.meses.map((m) => {
                          const st = m.falta <= 0.004 ? 'pago' : m.pago > 0 ? 'parcial' : 'aberto'
                          const dica = st === 'pago' ? `Pago ${brl(m.pago)}` : st === 'parcial' ? `Pago ${brl(m.pago)} de ${brl(m.esperado)} · faltam ${brl(m.falta)}` : `Em aberto · ${brl(m.falta)}`
                          return (
                            <span key={m.mes} className={`tag mes-${st}`} title={dica}>
                              {st === 'pago' ? '✓ ' : ''}{rotuloMes(m.mes)}{st === 'parcial' ? ' ½' : ''}
                            </span>
                          )
                        })}
                      </div>
                    </td>
                    <td className="right nowrap">{brl(c.pago)}</td>
                    <td className={`right nowrap ${c.falta > 0.004 ? 'neg' : ''}`}><b>{brl(c.falta)}</b></td>
                    <td className="right nowrap">
                      {c.falta > 0.004 && (
                        <button className="btn-link" style={{ color: '#1a9e4b' }} onClick={() => setLembrete({ tipo: 'casal', casal: c })} title="Enviar lembrete para este casal">
                          <IconeWhats /> Lembrar
                        </button>
                      )}
                      <button className="btn-link" onClick={() => setAberto(aberto === c.id ? null : c.id)}>{aberto === c.id ? 'Fechar' : 'Detalhar'}</button>
                    </td>
                  </tr>,
                  aberto === c.id && (
                    <tr key={c.id + 'd'}>
                      <td colSpan={6} style={{ background: 'var(--superficie-2)' }}>
                        <table className="tabela" style={{ maxWidth: 520 }}>
                          <thead><tr><th>Mês</th><th className="right">Valor</th><th className="right">Pago</th><th className="right">Falta</th></tr></thead>
                          <tbody>
                            {c.meses.map((m) => (
                              <tr key={m.mes}>
                                <td>{rotuloMesLongo(m.mes)}</td>
                                <td className="right">{num(m.esperado)}</td>
                                <td className="right">{num(m.pago)}</td>
                                <td className={`right ${m.falta > 0.004 ? 'neg' : 'pos'}`}>{m.falta > 0.004 ? num(m.falta) : '✓'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  ),
                ])}
              </tbody>
            </table>
          </div>
          {lembrete && (
            <Lembrete
              dados={lembrete}
              grupo={config?.nome_grupo || 'Grupo'}
              mes={ate}
              valorMes={valorMensalidade(valoresMensalidade, ate + '-01')}
              telefone={lembrete.casal ? cadastroCasais.find((x) => x.id === lembrete.casal.id)?.telefone : null}
              aoFechar={() => setLembrete(null)}
            />
          )}
          <p className="muted small">
            Cada casal paga a partir do mês em que entrou no grupo (cadastro de Casais) até o mês escolhido acima, ou até o mês de saída.
            Pagamentos são lançados em Lançamentos com a categoria de mensalidade, escolhendo o casal e os meses pagos.
          </p>
        </>
      )}
    </>
  )
}

// Número para o link do WhatsApp (Brasil): só dígitos, com 55 na frente
function numeroWhats(tel) {
  const d = String(tel || '').replace(/\D/g, '')
  if (d.length === 10 || d.length === 11) return '55' + d
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return d
  return null
}

// "DIEGO E ANA" -> "Diego e Ana" (só na mensagem; o cadastro continua em maiúsculas)
const MINUSCULAS = new Set(['e', 'de', 'da', 'do', 'das', 'dos'])
function nomeBonito(txt) {
  return String(txt || '')
    .toLocaleLowerCase('pt-BR')
    .split(/(\s+)/)
    .map((p, i) => (i > 0 && MINUSCULAS.has(p) ? p : p.charAt(0).toLocaleUpperCase('pt-BR') + p.slice(1)))
    .join('')
}

function textoGrupo(grupo, mes, valor) {
  return [
    `*${nomeBonito(grupo)} – Lembrete de mensalidade*`,
    '',
    'Queridos casais, a paz de Cristo! 🙏',
    `Lembramos que a mensalidade de *${rotuloMesLongo(mes)}*${valor > 0 ? ` é de *${brl(valor)}*` : ' já está aberta'}.`,
    'Quem ainda não acertou, por favor procure o casal financeiro.',
    '',
    'Obrigado e Deus abençoe!',
  ].join('\n')
}

function textoCasal(grupo, c) {
  const meses = c.emAberto.map((m) => `• ${rotuloMesLongo(m.mes)}: ${brl(m.falta)}${m.parcial ? ' (restante)' : ''}`)
  return [
    `*${nomeBonito(grupo)} – Lembrete de mensalidade*`,
    '',
    `Olá, ${nomeBonito(c.nome)}! A paz de Cristo! 🙏`,
    'Passando para lembrar das mensalidades em aberto:',
    ...meses,
    `*Total: ${brl(c.falta)}*`,
    '',
    'Se já pagou, desconsidere esta mensagem e nos avise para atualizarmos. Obrigado!',
  ].join('\n')
}

function Lembrete({ dados, grupo, mes, valorMes, telefone, aoFechar }) {
  const paraGrupo = dados.tipo === 'grupo'
  const [texto, setTexto] = useState(() => (paraGrupo ? textoGrupo(grupo, mes, valorMes) : textoCasal(grupo, dados.casal)))
  const [copiado, setCopiado] = useState(false)
  const numero = paraGrupo ? null : numeroWhats(telefone)

  function abrirWhats() {
    const url = (numero ? `https://wa.me/${numero}` : 'https://wa.me/') + '?text=' + encodeURIComponent(texto)
    window.open(url, '_blank', 'noopener')
  }
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    } catch {
      window.prompt('Copie o texto:', texto)
    }
  }

  return (
    <Modal titulo={paraGrupo ? 'Lembrete para o grupo' : `Lembrete para ${dados.casal.nome}`} aoFechar={aoFechar} largura={560}
      rodape={
        <>
          <button onClick={copiar}>{copiado ? '✓ Copiado' : 'Copiar texto'}</button>
          <button className="btn-whats" onClick={abrirWhats}><IconeWhats /> {numero ? 'Abrir conversa do casal' : 'Abrir no WhatsApp'}</button>
        </>
      }>
      <p className="muted small" style={{ marginTop: 0 }}>
        {paraGrupo
          ? 'Mensagem geral, sem nomes. Ao abrir o WhatsApp, escolha o grupo e envie.'
          : numero
            ? `O WhatsApp abre direto na conversa com o casal, no número ${telefone}.`
            : 'Este casal não tem telefone cadastrado: ao abrir o WhatsApp, escolha a conversa. Dica: cadastre o telefone em Casais.'}
        {' '}Você pode ajustar o texto abaixo.
      </p>
      <textarea className="sem-caixa-alta" rows={paraGrupo ? 9 : 11} value={texto} onChange={(e) => setTexto(e.target.value)} style={{ width: '100%', fontFamily: 'inherit' }} />
    </Modal>
  )
}

function IconeWhats() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" style={{ verticalAlign: '-3px' }}>
      <path d="M12 2a9.9 9.9 0 0 0-8.5 15l-1.4 5 5.1-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3a.5.5 0 0 0 0-.5l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7a2.8 2.8 0 0 0 1.8-1.3 2.3 2.3 0 0 0 .2-1.3c0-.1-.2-.2-.4-.3Z" />
    </svg>
  )
}
