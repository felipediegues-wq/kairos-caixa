import { useState } from 'react'
import { supabase, mensagemErro } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Alerta } from '../components/ui'

const base = import.meta.env.BASE_URL

function Caixa({ titulo, children }) {
  return (
    <div className="tela-login">
      <div className="caixa-login">
        <div className="logo">
          <img src={`${base}favicon.svg`} alt="" />
          <h1>Kairós Caixa</h1>
        </div>
        <h2 style={{ marginBottom: 12 }}>{titulo}</h2>
        {children}
      </div>
    </div>
  )
}

// Usuário entrou, mas o admin ainda não liberou
export function Aguardando() {
  const { perfil, sair, recarregarPerfil } = useAuth()
  return (
    <Caixa titulo="Aguardando liberação">
      <p>
        Olá{perfil?.nome ? `, ${perfil.nome}` : ''}! Sua conta (<b>{perfil?.email}</b>) foi criada, mas ainda precisa ser
        liberada por um administrador do grupo.
      </p>
      <p className="muted small">Avise o administrador. Assim que ele liberar, clique em “Verificar de novo”.</p>
      <div className="acoes" style={{ marginTop: 16 }}>
        <button className="btn-primario" onClick={recarregarPerfil}>Verificar de novo</button>
        <button onClick={sair}>Sair</button>
      </div>
    </Caixa>
  )
}

// Chegou pelo link de "esqueci minha senha"
export function RedefinirSenha() {
  const { fimRecuperacao } = useAuth()
  const [senha, setSenha] = useState('')
  const [senha2, setSenha2] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function salvar(e) {
    e.preventDefault()
    setErro('')
    if (senha.length < 6) return setErro('A senha precisa ter pelo menos 6 caracteres.')
    if (senha !== senha2) return setErro('As senhas não conferem.')
    setSalvando(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setSalvando(false)
    if (error) return setErro(mensagemErro(error))
    fimRecuperacao()
  }
  return (
    <Caixa titulo="Criar nova senha">
      <Alerta tipo="erro">{erro}</Alerta>
      <form onSubmit={salvar}>
        <label className="campo">
          Nova senha
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoFocus autoComplete="new-password" />
        </label>
        <label className="campo">
          Repita a nova senha
          <input type="password" value={senha2} onChange={(e) => setSenha2(e.target.value)} autoComplete="new-password" />
        </label>
        <button className="btn-primario" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar nova senha'}</button>
      </form>
    </Caixa>
  )
}

// Variáveis do Supabase não configuradas
export function SemConfiguracao() {
  return (
    <Caixa titulo="Falta configurar o Supabase">
      <p>O sistema não encontrou o endereço e a chave do Supabase.</p>
      <ul className="small">
        <li><b>No GitHub:</b> Settings → Secrets and variables → Actions → crie <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> e rode o deploy de novo.</li>
        <li><b>No computador:</b> copie <code>.env.example</code> para <code>.env.local</code> e preencha.</li>
      </ul>
      <p className="muted small">Veja o passo a passo no README do repositório.</p>
    </Caixa>
  )
}
