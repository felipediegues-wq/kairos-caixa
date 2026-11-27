import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { brl, num, pct, dataBR, rotuloMes, rotuloMesLongo, chaveMes, somarMeses, inicioMesISO } from './format'
import { resumoMensal, matrizFluxo, dadosPeriodo, descricaoPublica } from './relatorios'

const AZUL = [29, 29, 31] // preto do medalhão
const OURO = [212, 160, 23]
const VERDE = [46, 139, 87]
const VERMELHO = [192, 57, 43]
const ROXO = [125, 60, 152]
const CINZA = [91, 101, 117]

/**
 * Gera o PDF de prestação de contas.
 * opcoes: { de, ate, secoes: {resumo, grafico, mensal, fluxo, categorias, lancamentos, assinaturas}, emitidoPor }
 */
export function gerarPDF({ config, lancamentos, categorias, opcoes }) {
  const { de, ate, secoes, emitidoPor, logo } = opcoes
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const grupo = config?.nome_grupo || 'Grupo'
  const periodoTxt = `${dataBR(de)} a ${dataBR(ate)}`
  const saldoIni = Number(config?.saldo_inicial || 0)

  const P = dadosPeriodo(lancamentos, saldoIni, de, ate)
  const { t, mensal, iniMes, qtdMeses } = P
  const saldoAntes = P.saldoNoInicio
  const saldoFim = P.saldoNoFim

  // ---- cabeçalho e rodapé em todas as páginas ----
  const cabecalho = () => {
    const w = doc.internal.pageSize.getWidth()
    doc.setFillColor(...AZUL)
    doc.rect(0, 0, w, 20, 'F')
    doc.setFillColor(...OURO)
    doc.rect(0, 20, w, 0.9, 'F')
    let x = 12
    if (logo) {
      try {
        doc.addImage(logo, 'PNG', 9, 2, 16, 16)
        x = 29
      } catch {
        /* sem logo */
      }
    }
    doc.setTextColor(...OURO)
    doc.setFont('helvetica', 'bold').setFontSize(14)
    doc.text(grupo, x, 9.5)
    doc.setTextColor(255)
    doc.setFont('helvetica', 'normal').setFontSize(9)
    doc.text(`Relatório de caixa · ${periodoTxt}`, x, 15)
    doc.setTextColor(0)
  }
  const rodapes = () => {
    const n = doc.getNumberOfPages()
    for (let i = 1; i <= n; i++) {
      doc.setPage(i)
      const w = doc.internal.pageSize.getWidth()
      const h = doc.internal.pageSize.getHeight()
      doc.setFontSize(7.5).setTextColor(...CINZA)
      doc.text(`Emitido em ${new Date().toLocaleString('pt-BR')}${emitidoPor ? ' por ' + emitidoPor : ''} · Kairós Caixa`, 12, h - 7)
      doc.text(`Página ${i} de ${n}`, w - 12, h - 7, { align: 'right' })
      doc.setTextColor(0)
    }
  }
  const titulo = (txt, y) => {
    doc.setFont('helvetica', 'bold').setFontSize(11.5).setTextColor(...AZUL)
    doc.text(txt, 12, y)
    doc.setDrawColor(...OURO).setLineWidth(0.5)
    doc.line(12, y + 1.5, doc.internal.pageSize.getWidth() - 12, y + 1.5)
    doc.setTextColor(0).setFont('helvetica', 'normal')
    return y + 6
  }
  const novaPagina = (orientacao = 'portrait') => {
    doc.addPage('a4', orientacao)
    cabecalho()
    return 28
  }
  const yAtual = () => doc.lastAutoTable.finalY + 10
  const garantirEspaco = (y, altura) => (y + altura > doc.internal.pageSize.getHeight() - 15 ? novaPagina() : y)
  const estiloTabela = {
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.8 },
    headStyles: { fillColor: AZUL, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [246, 248, 251] },
    margin: { left: 12, right: 12, top: 26 },
    didDrawPage: cabecalho,
  }

  cabecalho()
  let y = 28

  // ---- 1. resumo ----
  if (secoes.resumo) {
    y = titulo('Resumo do período', y)
    const cards = [
      ['Saldo no início', brl(saldoAntes), AZUL],
      ['Entradas', brl(t.entradas), VERDE],
      ['Saídas', brl(t.saidas), VERMELHO],
      ['Retiradas', brl(t.retiradas), ROXO],
      ['Resultado', brl(t.resultado), t.resultado < 0 ? VERMELHO : AZUL],
      ['Saldo no fim', brl(saldoFim), AZUL],
    ]
    const largura = (doc.internal.pageSize.getWidth() - 24 - 5 * 3) / 3
    cards.forEach(([rot, val, cor], i) => {
      const x = 12 + (i % 3) * (largura + 3)
      const yy = y + Math.floor(i / 3) * 19
      doc.setFillColor(246, 248, 251).setDrawColor(...cor).setLineWidth(0.3)
      doc.roundedRect(x, yy, largura, 16, 1.5, 1.5, 'FD')
      doc.setFillColor(...cor)
      doc.rect(x, yy, 1.6, 16, 'F')
      doc.setFontSize(7.5).setTextColor(...CINZA).text(rot.toUpperCase(), x + 5, yy + 5.5)
      doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...cor).text(val, x + 5, yy + 12.5)
      doc.setFont('helvetica', 'normal').setTextColor(0)
    })
    y += 19 * 2 + 4
    doc.setFontSize(8.5).setTextColor(...CINZA)
    doc.text(`${t.qtd} lançamento(s) no período.`, 12, y)
    doc.setTextColor(0)
    y += 8
  }

  // ---- 2. gráfico mensal ----
  if (secoes.grafico && mensal.length) {
    y = garantirEspaco(y, 75)
    y = titulo('Entradas x saídas x retiradas por mês', y)
    y = graficoBarras(doc, mensal, 12, y + 2, doc.internal.pageSize.getWidth() - 24, 60) + 6
  }

  // ---- 3. resumo mensal ----
  if (secoes.mensal) {
    y = garantirEspaco(y, 40)
    y = titulo('Resumo mês a mês', y)
    autoTable(doc, {
      ...estiloTabela,
      startY: y,
      head: [['Mês', 'Saldo inicial', 'Entradas', 'Saídas', 'Retiradas', 'Resultado', 'Saldo final']],
      body: mensal.map((m) => [rotuloMesLongo(m.mes), num(m.saldoInicial), num(m.entradas), num(m.saidas), num(m.retiradas), num(m.resultado), num(m.saldoFinal)]),
      foot: [['Total', '', num(mensal.reduce((a, m) => a + m.entradas, 0)), num(mensal.reduce((a, m) => a + m.saidas, 0)),
        num(mensal.reduce((a, m) => a + m.retiradas, 0)), num(mensal.reduce((a, m) => a + m.resultado, 0)), num(mensal.at(-1).saldoFinal)]],
      footStyles: { fillColor: [230, 235, 243], textColor: AZUL, fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right', fontStyle: 'bold' } },
      didParseCell: (d) => {
        if (d.section === 'body' && d.column.index === 5 && mensal[d.row.index]?.resultado < 0) d.cell.styles.textColor = VERMELHO
        if (d.section !== 'body' && d.column.index > 0) d.cell.styles.halign = 'right'
      },
    })
    y = yAtual()
  }

  // ---- 4. gastos por categoria ----
  if (secoes.categorias) {
    const cats = P.gastosPorCategoria
    const ents = P.entradasPorCategoria
    y = garantirEspaco(y, 40)
    y = titulo('Entradas e gastos por categoria', y)
    const linhas = [
      ...ents.map((c) => ['Entrada', c.nome, num(c.valor), pct(c.pct)]),
      ...cats.map((c) => ['Saída / retirada', c.nome, num(c.valor), pct(c.pct)]),
    ]
    autoTable(doc, {
      ...estiloTabela,
      startY: y,
      head: [['Grupo', 'Categoria', 'Total (R$)', '% do grupo']],
      body: linhas.length ? linhas : [['—', 'Sem lançamentos no período', '', '']],
      columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' } },
      didParseCell: (d) => {
        if (d.section === 'body' && d.column.index === 0) d.cell.styles.textColor = d.cell.raw === 'Entrada' ? VERDE : VERMELHO
        if (d.section === 'head' && d.column.index >= 2) d.cell.styles.halign = 'right'
      },
    })
    y = yAtual()
  }

  // ---- 5. lançamentos ----
  if (secoes.lancamentos) {
    const lista = P.lista
    y = garantirEspaco(y, 40)
    y = titulo('Lançamentos do período', y)
    autoTable(doc, {
      ...estiloTabela,
      startY: y,
      head: [['Data', 'Tipo', 'Categoria', 'Descrição', 'Forma', 'Valor', 'Saldo']],
      body: lista.length
        ? lista.map((l) => [dataBR(l.data), l.tipo, l.categoria?.nome || '', descricaoPublica(l), l.forma?.nome || '', (l.tipo === 'Entrada' ? '' : '-') + num(l.valor), num(l.saldo)])
        : [['', '', '', 'Sem lançamentos no período', '', '', '']],
      styles: { ...estiloTabela.styles, fontSize: 7.8 },
      columnStyles: { 0: { cellWidth: 17 }, 1: { cellWidth: 16 }, 3: { cellWidth: 'auto' }, 5: { halign: 'right', cellWidth: 22 }, 6: { halign: 'right', cellWidth: 22, fontStyle: 'bold' } },
      didParseCell: (d) => {
        if (d.section === 'body' && d.column.index === 5) d.cell.styles.textColor = String(d.cell.raw).startsWith('-') ? VERMELHO : VERDE
        if (d.section === 'head' && d.column.index >= 5) d.cell.styles.halign = 'right'
      },
    })
    y = yAtual()
  }

  // ---- 6. assinaturas ----
  if (secoes.assinaturas) {
    y = garantirEspaco(y, 35)
    y += 18
    const w = doc.internal.pageSize.getWidth()
    const larg = (w - 24 - 20) / 2
    doc.setDrawColor(80).setLineWidth(0.3)
    ;[['Tesoureiro(a)', 12], ['Coordenador(a)', 12 + larg + 20]].forEach(([rot, x]) => {
      doc.line(x, y, x + larg, y)
      doc.setFontSize(9).text(rot, x + larg / 2, y + 5, { align: 'center' })
    })
    y += 12
  }

  // ---- 7. fluxo por categoria (página paisagem) ----
  if (secoes.fluxo) {
    const qtd = Math.min(12, qtdMeses)
    const m = matrizFluxo(lancamentos, categorias, iniMes, qtd)
    const res = resumoMensal(lancamentos, saldoIni, iniMes, qtd)
    const body = []
    const estilos = {}
    const add = (linha, estilo) => {
      if (estilo) estilos[body.length] = estilo
      body.push(linha)
    }
    const fmt = (v) => (Math.abs(v) < 0.005 ? '-' : num(v))
    add(['Saldo inicial do mês', ...res.map((r) => fmt(r.saldoInicial)), fmt(res[0].saldoInicial)], { fillColor: [238, 243, 250], fontStyle: 'bold' })
    for (const [tipo, cor, nome] of [['Entrada', VERDE, 'ENTRADAS'], ['Saída', VERMELHO, 'SAÍDAS'], ['Retirada', ROXO, 'RETIRADAS']]) {
      const g = m.porTipo[tipo]
      add([nome, ...Array(qtd + 1).fill('')], { fillColor: cor, textColor: 255, fontStyle: 'bold' })
      g.linhas.forEach((l) => add(['   ' + l.categoria.nome, ...l.valores.map(fmt), fmt(l.total)]))
      add([`Total de ${nome.toLowerCase()}`, ...g.totais.map(fmt), fmt(g.total)], { fillColor: [245, 245, 245], textColor: cor, fontStyle: 'bold' })
    }
    add(['RESULTADO DO MÊS', ...res.map((r) => fmt(r.resultado)), fmt(res.reduce((a, r) => a + r.resultado, 0))], { fillColor: [238, 243, 250], fontStyle: 'bold' })
    add(['SALDO FINAL DO MÊS', ...res.map((r) => fmt(r.saldoFinal)), fmt(res.at(-1).saldoFinal)], { fillColor: AZUL, textColor: 255, fontStyle: 'bold' })

    y = novaPagina('landscape')
    y = titulo(`Fluxo de caixa por categoria (${rotuloMes(m.meses[0])} a ${rotuloMes(m.meses.at(-1))})`, y)
    autoTable(doc, {
      ...estiloTabela,
      startY: y,
      head: [['Categoria', ...m.meses.map(rotuloMes), 'Total']],
      body,
      styles: { font: 'helvetica', fontSize: qtd > 8 ? 6.8 : 7.8, cellPadding: 1.4, halign: 'right' },
      columnStyles: { 0: { halign: 'left', cellWidth: 46 } },
      alternateRowStyles: {},
      didParseCell: (d) => {
        d.cell.styles.halign = d.column.index === 0 ? 'left' : 'right'
        if (d.section === 'body' && estilos[d.row.index]) Object.assign(d.cell.styles, estilos[d.row.index])
      },
    })
  }

  rodapes()
  const nome = `Relatorio_${(grupo || 'caixa').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w]+/g, '_')}_${de}_a_${ate}.pdf`
  doc.save(nome)
}

// Gráfico de barras agrupadas desenhado direto no PDF
function graficoBarras(doc, mensal, x, y, w, h) {
  const series = [['entradas', VERDE, 'Entradas'], ['saidas', VERMELHO, 'Saídas'], ['retiradas', ROXO, 'Retiradas']]
  const max = Math.max(1, ...mensal.flatMap((m) => series.map(([k]) => m[k])))
  const passo = Math.pow(10, Math.floor(Math.log10(max)))
  const topo = Math.ceil(max / passo) * passo
  const esq = 18
  const areaW = w - esq
  const areaH = h - 12
  doc.setFontSize(7).setTextColor(...CINZA).setDrawColor(225).setLineWidth(0.2)
  for (let i = 0; i <= 4; i++) {
    const v = (topo / 4) * i
    const yy = y + areaH - (areaH * i) / 4
    doc.line(x + esq, yy, x + w, yy)
    doc.text(v >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : String(Math.round(v)), x + esq - 2, yy + 1, { align: 'right' })
  }
  const grupoW = areaW / mensal.length
  const barW = Math.min(6, (grupoW * 0.75) / 3)
  mensal.forEach((m, i) => {
    const gx = x + esq + i * grupoW + (grupoW - barW * 3) / 2
    series.forEach(([k, cor], j) => {
      const bh = (areaH * m[k]) / topo
      if (bh > 0) {
        doc.setFillColor(...cor)
        doc.rect(gx + j * barW, y + areaH - bh, barW - 0.4, bh, 'F')
      }
    })
    doc.setTextColor(...CINZA).text(rotuloMes(m.mes), x + esq + i * grupoW + grupoW / 2, y + areaH + 4, { align: 'center' })
  })
  let lx = x + esq
  series.forEach(([, cor, nome]) => {
    doc.setFillColor(...cor).rect(lx, y + h - 3, 3, 3, 'F')
    doc.setTextColor(60).text(nome, lx + 4.5, y + h - 0.6)
    lx += 28
  })
  doc.setTextColor(0)
  return y + h
}

export { chaveMes, somarMeses }
