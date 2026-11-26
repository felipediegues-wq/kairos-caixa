import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { num, rotuloMes, rotuloMesLongo, FUNCOES } from './format'

const PRETO = [29, 29, 31]
const OURO = [212, 160, 23]
const VERMELHO = [192, 57, 43]
const VERDE = [46, 139, 87]

export function pdfMensalidades({ grupo = 'Grupo', ate, casais, apenasDevendo, logo }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const w = doc.internal.pageSize.getWidth()
  const cabecalho = () => {
    doc.setFillColor(...PRETO).rect(0, 0, w, 20, 'F')
    doc.setFillColor(...OURO).rect(0, 20, w, 0.9, 'F')
    let x = 12
    if (logo) {
      try { doc.addImage(logo, 'PNG', 9, 2, 16, 16); x = 29 } catch { /* sem logo */ }
    }
    doc.setTextColor(...OURO).setFont('helvetica', 'bold').setFontSize(14).text(grupo, x, 9.5)
    doc.setTextColor(255).setFont('helvetica', 'normal').setFontSize(9)
      .text(`Mensalidades ${apenasDevendo ? 'em aberto' : '(todos os casais)'} · até ${rotuloMesLongo(ate)} · CONFIDENCIAL`, x, 15)
    doc.setTextColor(0)
  }
  cabecalho()

  const total = casais.reduce((a, c) => a + c.falta, 0)
  const devendo = casais.filter((c) => c.falta > 0.004).length
  doc.setFontSize(10).text(`${devendo} casal(is) com mensalidade em aberto · total em aberto: R$ ${num(total)}`, 12, 29)

  autoTable(doc, {
    startY: 33,
    head: [['Casal', 'Função', 'Meses em aberto', 'Pago (R$)', 'Em aberto (R$)']],
    body: casais.map((c) => [
      c.nome,
      FUNCOES[c.funcao] || '',
      c.emAberto.length ? c.emAberto.map((m) => rotuloMes(m.mes) + (m.parcial ? '*' : '')).join(', ') : 'Em dia',
      num(c.pago),
      num(c.falta),
    ]),
    foot: [['Total', '', '', num(casais.reduce((a, c) => a + c.pago, 0)), num(total)]],
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.8 },
    headStyles: { fillColor: PRETO, textColor: 255 },
    footStyles: { fillColor: [245, 240, 225], textColor: PRETO, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 248, 246] },
    columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: 12, right: 12, top: 26 },
    didDrawPage: cabecalho,
    didParseCell: (d) => {
      if (d.section === 'body' && d.column.index === 4) d.cell.styles.textColor = d.cell.raw === '0,00' ? VERDE : VERMELHO
      if (d.section !== 'body' && d.column.index >= 3) d.cell.styles.halign = 'right'
    },
  })
  const y = doc.lastAutoTable.finalY + 6
  doc.setFontSize(8).setTextColor(100).text('* pagamento parcial no mês. Documento de uso restrito da coordenação.', 12, y)

  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i)
    const h = doc.internal.pageSize.getHeight()
    doc.setFontSize(7.5).setTextColor(110)
    doc.text(`Emitido em ${new Date().toLocaleString('pt-BR')} · Kairós Caixa`, 12, h - 7)
    doc.text(`Página ${i} de ${n}`, w - 12, h - 7, { align: 'right' })
  }
  doc.save(`Mensalidades_em_aberto_ate_${ate}.pdf`)
}
