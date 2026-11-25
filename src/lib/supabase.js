import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigurado = Boolean(url && key)

// flowType 'pkce': os links de e-mail voltam com ?code=..., o que funciona com o HashRouter (#/rota)
export const supabase = supabaseConfigurado
  ? createClient(url, key, {
      db: { schema: 'caixa' }, // tudo do Kairós fica no schema "caixa" (ver supabase/schema.sql)
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'kairos-caixa-auth',
      },
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
    [/row-level security|permission denied for table/i, 'Você não tem permissão para fazer isso.'],
    [/Invalid schema|permission denied for schema|schema must be one of/i, 'O schema "caixa" não está liberado na API do Supabase. Veja o passo 2 do README (Exposed schemas).'],
    [/violates foreign key constraint/i, 'Este item está em uso por lançamentos e não pode ser excluído. Desative-o.'],
    [/duplicate key value/i, 'Já existe um registro com esse nome.'],
    [/Signups not allowed/i, 'A criação de contas pelo site está desativada. Peça ao administrador do grupo para criar o seu acesso.'],
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
