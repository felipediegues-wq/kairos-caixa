const brlFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const numFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pctFmt = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 })
const compactFmt = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

export const brl = (v) => brlFmt.format(Number(v) || 0)
export const num = (v) => numFmt.format(Number(v) || 0)
export const pct = (v) => pctFmt.format(Number(v) || 0)
export const compacto = (v) => 'R$ ' + compactFmt.format(Number(v) || 0)

// Datas trafegam como texto 'AAAA-MM-DD' (sem fuso horário)
export function dataBR(iso) {
  if (!iso) return ''
  const [a, m, d] = String(iso).slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}
export function dataHoraBR(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}
export function hojeISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export function inicioMesISO(iso = hojeISO()) {
  return iso.slice(0, 7) + '-01'
}
export function fimMesISO(iso = hojeISO()) {
  const [a, m] = iso.split('-').map(Number)
  const ultimo = new Date(a, m, 0).getDate()
  return `${a}-${String(m).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`
}
export function somarMeses(iso, n) {
  const [a, m] = iso.split('-').map(Number)
  const d = new Date(a, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
export const chaveMes = (iso) => String(iso).slice(0, 7) // 'AAAA-MM'
export function rotuloMes(chave) {
  const [a, m] = chave.split('-')
  return `${MESES[Number(m) - 1]}/${a.slice(2)}`
}
export function rotuloMesLongo(chave) {
  const [a, m] = chave.split('-')
  return `${MESES_LONGOS[Number(m) - 1]} de ${a}`
}

// Aceita "1.234,56", "1234,56", "1234.56", "R$ 10"
export function lerValor(txt) {
  if (typeof txt === 'number') return txt
  let s = String(txt || '').replace(/R\$|\s/g, '')
  if (!s) return NaN
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')
  return Number(s)
}

export const PAPEIS = {
  admin: 'Administrador',
  tesoureiro: 'Tesoureiro',
  leitura: 'Leitura',
}
export const TIPOS = ['Entrada', 'Saída', 'Retirada']

export const FUNCOES = {
  coordenador: 'Casal coordenador',
  vice_coordenador: 'Casal vice-coordenador',
  secretario: 'Casal secretário',
  financeiro: 'Casal financeiro',
  boa_vontade: 'Boa Vontade',
  membro: 'Membro',
}
