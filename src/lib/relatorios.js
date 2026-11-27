import { chaveMes, somarMeses, rotuloMes } from './format'

// Valor com sinal: entradas somam, saídas e retiradas subtraem
export const comSinal = (l) => (l.tipo === 'Entrada' ? Number(l.valor) : -Number(l.valor))

export function ordenar(lancs) {
  return [...lancs].sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : a.id - b.id))
}

// Totais de um conjunto de lançamentos
export function totais(lancs) {
  const t = { entradas: 0, saidas: 0, retiradas: 0, qtd: lancs.length }
  for (const l of lancs) {
    const v = Number(l.valor)
    if (l.tipo === 'Entrada') t.entradas += v
    else if (l.tipo === 'Saída') t.saidas += v
    else t.retiradas += v
  }
  t.resultado = t.entradas - t.saidas - t.retiradas
  return t
}

// Saldo antes de uma data (exclusive)
export function saldoAntes(lancs, saldoInicial, dataISO) {
  let s = Number(saldoInicial) || 0
  for (const l of lancs) if (l.data < dataISO) s += comSinal(l)
  return s
}

// Adiciona o saldo acumulado a cada lançamento (em ordem de data)
export function comSaldo(lancs, saldoInicial) {
  let s = Number(saldoInicial) || 0
  return ordenar(lancs).map((l) => {
    s += comSinal(l)
    return { ...l, saldo: s }
  })
}

// Lista de meses (chaves 'AAAA-MM') a partir de um mês inicial
export function meses(inicioISO, qtd = 12) {
  return Array.from({ length: qtd }, (_, i) => chaveMes(somarMeses(inicioISO, i)))
}

// Resumo mês a mês
export function resumoMensal(lancs, saldoInicial, inicioISO, qtd = 12) {
  const ks = meses(inicioISO, qtd)
  let saldo = saldoAntes(lancs, saldoInicial, ks[0] + '-01')
  return ks.map((k) => {
    const doMes = lancs.filter((l) => chaveMes(l.data) === k)
    const t = totais(doMes)
    const saldoIni = saldo
    saldo += t.resultado
    return { mes: k, ...t, saldoInicial: saldoIni, saldoFinal: saldo }
  })
}

// Matriz do fluxo de caixa: categoria x mês
export function matrizFluxo(lancs, categorias, inicioISO, qtd = 12) {
  const ks = meses(inicioISO, qtd)
  const idx = new Map(ks.map((k, i) => [k, i]))
  const linhas = new Map()
  for (const c of categorias) linhas.set(c.id, { categoria: c, valores: Array(qtd).fill(0), total: 0 })
  for (const l of lancs) {
    const i = idx.get(chaveMes(l.data))
    if (i === undefined) continue
    let linha = linhas.get(l.categoria_id)
    if (!linha) {
      linha = { categoria: { id: l.categoria_id, nome: l.categoria?.nome || '(sem categoria)', tipo: l.tipo }, valores: Array(qtd).fill(0), total: 0 }
      linhas.set(l.categoria_id, linha)
    }
    linha.valores[i] += Number(l.valor)
    linha.total += Number(l.valor)
  }
  const porTipo = {}
  for (const tipo of ['Entrada', 'Saída', 'Retirada']) {
    const ls = [...linhas.values()]
      .filter((x) => x.categoria.tipo === tipo && (x.categoria.ativo !== false || x.total > 0))
      .sort((a, b) => (a.categoria.ordem ?? 0) - (b.categoria.ordem ?? 0) || a.categoria.nome.localeCompare(b.categoria.nome))
    const tot = Array(qtd).fill(0)
    ls.forEach((x) => x.valores.forEach((v, i) => (tot[i] += v)))
    porTipo[tipo] = { linhas: ls, totais: tot, total: tot.reduce((a, b) => a + b, 0) }
  }
  return { meses: ks, porTipo }
}

// Soma agrupada por um campo (categoria, forma...) dos lançamentos que passam no filtro
export function somaPor(lancs, chave, filtro = () => true) {
  const m = new Map()
  for (const l of lancs) {
    if (!filtro(l)) continue
    const nome = chave(l) || '(não informado)'
    m.set(nome, (m.get(nome) || 0) + Number(l.valor))
  }
  const total = [...m.values()].reduce((a, b) => a + b, 0)
  return [...m.entries()]
    .map(([nome, valor]) => ({ nome, valor, pct: total ? valor / total : 0 }))
    .sort((a, b) => b.valor - a.valor)
}

// Só saídas e retiradas
export const gastosPor = (lancs, chave) => somaPor(lancs, chave, (l) => l.tipo !== 'Entrada')

// Tudo o que o relatório de um período precisa (usado na tela e no PDF)
export function dadosPeriodo(lancamentos, saldoInicial, de, ate) {
  const doPeriodo = ordenar(lancamentos.filter((l) => l.data >= de && l.data <= ate))
  const t = totais(doPeriodo)
  const saldoNoInicio = saldoAntes(lancamentos, saldoInicial, de)
  const iniMes = de.slice(0, 7) + '-01'
  const qtdMeses = Math.max(1, Math.min(24,
    (Number(ate.slice(0, 4)) - Number(de.slice(0, 4))) * 12 + Number(ate.slice(5, 7)) - Number(de.slice(5, 7)) + 1))
  return {
    doPeriodo,
    t,
    saldoNoInicio,
    saldoNoFim: saldoNoInicio + t.resultado,
    iniMes,
    qtdMeses,
    mensal: resumoMensal(lancamentos, saldoInicial, iniMes, qtdMeses),
    lista: comSaldo(lancamentos, saldoInicial).filter((l) => l.data >= de && l.data <= ate),
    entradasPorCategoria: somaPor(doPeriodo, (l) => l.categoria?.nome, (l) => l.tipo === 'Entrada'),
    gastosPorCategoria: gastosPor(doPeriodo, (l) => l.categoria?.nome),
  }
}

// Valor da mensalidade vigente em um mês ('AAAA-MM-01')
export function valorMensalidade(valores, mesISO) {
  let v = 0
  for (const x of valores) if (x.vigente_desde <= mesISO) v = Number(x.valor)
  return v
}

// Total pago de mensalidade por mês ('AAAA-MM' -> valor) para um casal
export function pagoPorMes(lancamentos, casalId, ignorarId) {
  const m = new Map()
  for (const l of lancamentos) {
    if (l.casal_id !== casalId || !l.competencia || l.id === ignorarId) continue
    const k = l.competencia.slice(0, 7)
    m.set(k, (m.get(k) || 0) + Number(l.valor))
  }
  return m
}

// Descrição que pode ir para o grupo: mensalidade nunca mostra o nome do casal
export function descricaoPublica(l) {
  if (l.casal_id || l.categoria?.mensalidade) {
    return l.competencia ? `MENSALIDADE REF. ${rotuloMes(chaveMes(l.competencia)).toUpperCase()}` : 'MENSALIDADE'
  }
  return l.descricao
}
