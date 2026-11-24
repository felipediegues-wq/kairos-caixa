import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigurado = Boolean(url && key)

// flowType 'pkce': os links de e-mail voltam com ?code=..., o que funciona com o HashRouter (#/rota)
export const supabase = supabaseConfigurado
  ? createClient(url, key, {
      auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
    })
  : null

// Endereço do site (sem hash), usado nos links enviados por e-mail
export function urlDoSite(params = '') {
  const { origin, pathname } = window.location
  return origin + pathname + params
}

// Traduz as mensagens de erro mais comuns do Supabase/Postgres
export function mensagemErro(err) {
  if (!err) return ''
  const m = err.message || String(err)
  const mapa = [
    [/Invalid login credentials/i, 'E-mail ou senha incorretos.'],
    [/Email not confirmed/i, 'Confirme seu e-mail pelo link que enviamos antes de entrar.'],
    [/User already registered/i, 'Já existe uma conta com este e-mail.'],
    [/Password should be at least/i, 'A senha precisa ter pelo menos 6 caracteres.'],
    [/row-level security|permission denied/i, 'Você não tem permissão para fazer isso.'],
    [/violates foreign key constraint/i, 'Este item está em uso por lançamentos e não pode ser excluído. Desative-o.'],
    [/duplicate key value/i, 'Já existe um registro com esse nome.'],
    [/rate limit/i, 'Muitas tentativas. Aguarde alguns minutos e tente de novo.'],
    [/Failed to fetch/i, 'Sem conexão com o servidor. Verifique sua internet.'],
  ]
  for (const [re, txt] of mapa) if (re.test(m)) return txt
  return m
}

// Busca todas as linhas, contornando o limite de 1000 por consulta
export async function buscarTodos(montarConsulta, tamanho = 1000) {
  let de = 0
  const todos = []
  for (;;) {
    const { data, error } = await montarConsulta().range(de, de + tamanho - 1)
    if (error) throw error
    todos.push(...data)
    if (data.length < tamanho) break
    de += tamanho
  }
  return todos
}
