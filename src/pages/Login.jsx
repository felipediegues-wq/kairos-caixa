import { useState } from 'react'
import { supabase, mensagemErro, urlDoSite } from '../lib/supabase'
import { Alerta } from '../components/ui'
import Medalhao3D from '../components/Medalhao3D'


// No celular não abre o teclado sozinho: a pessoa toca no campo quando quiser
const telaDeToque = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches

export default function Login() {
  const [modo, setModo] = useState('entrar') // entrar | criar | esqueci
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [senha2, setSenha2] = useState('')
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const [enviando, setEnviando] = useState(false)

  const trocar = (m) => {
    setModo(m)
    setErro('')
    setOk('')
  }

  async function enviar(e) {
    e.preventDefault()
    setErro('')
    setOk('')
    setEnviando(true)
    try {
      if (modo === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
        if (error) throw error
      } else if (modo === 'criar') {
        if (senha.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.')
        if (senha !== senha2) throw new Error('As senhas não conferem.')
        const { data, error } = await supabase.auth.signUp({
          email,
          password: senha,
          options: { data: { nome: nome.trim() }, emailRedirectTo: urlDoSite() },
        })
        if (error) throw error
        if (data.session) return // confirmação de e-mail desligada: já entra
        setOk('Conta criada! Enviamos um link de confirmação para o seu e-mail. Depois de confirmar, peça ao administrador para liberar seu acesso.')
        setModo('entrar')
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: urlDoSite('?recuperar=1') })
        if (error) throw error
        setOk('Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha.')
      }
    } catch (err) {
      setErro(mensagemErro(err))
    } finally {
      setEnviando(false)
    }
  }

  const titulos = { entrar: 'Entrar', criar: 'Criar conta', esqueci: 'Recuperar senha' }
  return (
    <div className="tela-login">
      <div className="caixa-login">
        <div className="login-topo">
          <Medalhao3D tamanho={150} />
          <h1>Kairós Caixa</h1>
          <div className="muted small">Controle de gastos e fluxo de caixa</div>
        </div>
        <h2 style={{ marginBottom: 12 }}>{titulos[modo]}</h2>
        <Alerta tipo="erro">{erro}</Alerta>
        <Alerta tipo="ok">{ok}</Alerta>
        <form onSubmit={enviar}>
          {modo === 'criar' && (
            <label className="campo">
              Seu nome
              <input value={nome} onChange={(e) => setNome(e.target.value)} required autoFocus={!telaDeToque} />
            </label>
          )}
          <label className="campo">
            E-mail
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" autoFocus={!telaDeToque && modo !== 'criar'} />
          </label>
          {modo !== 'esqueci' && (
            <label className="campo">
              Senha
              <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required
                autoComplete={modo === 'criar' ? 'new-password' : 'current-password'} />
            </label>
          )}
          {modo === 'criar' && (
            <label className="campo">
              Repita a senha
              <input type="password" value={senha2} onChange={(e) => setSenha2(e.target.value)} required autoComplete="new-password" />
            </label>
          )}
          <button className="btn-primario" disabled={enviando} style={{ justifyContent: 'center', padding: '10px' }}>
            {enviando ? 'Aguarde…' : modo === 'entrar' ? 'Entrar' : modo === 'criar' ? 'Criar conta' : 'Enviar link'}
          </button>
        </form>
        <div className="trocar">
          {modo === 'entrar' ? (
            <>
              <button className="btn-link" onClick={() => trocar('esqueci')}>Esqueci minha senha</button>
              <br />
              Ainda não tem acesso? <button className="btn-link" onClick={() => trocar('criar')}>Criar conta</button>
            </>
          ) : (
            <button className="btn-link" onClick={() => trocar('entrar')}>← Voltar para o login</button>
          )}
        </div>
      </div>
    </div>
  )
}
