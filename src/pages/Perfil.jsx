import { useState } from 'react'
import { supabase, mensagemErro } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Alerta } from '../components/ui'
import { PAPEIS } from '../lib/format'

export default function Perfil() {
  const { perfil, recarregarPerfil } = useAuth()
  const [nome, setNome] = useState(perfil?.nome || '')
  const [senha, setSenha] = useState('')
  const [senha2, setSenha2] = useState('')
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')

  async function salvarNome(e) {
    e.preventDefault()
    setErro(''); setOk('')
    const { error } = await supabase.rpc('atualizar_meu_nome', { novo_nome: nome })
    if (error) return setErro(mensagemErro(error))
    setOk('Nome atualizado.')
    recarregarPerfil()
  }
  async function salvarSenha(e) {
    e.preventDefault()
    setErro(''); setOk('')
    if (senha.length < 6) return setErro('A senha precisa ter pelo menos 6 caracteres.')
    if (senha !== senha2) return setErro('As senhas não conferem.')
    const { error } = await supabase.auth.updateUser({ password: senha })
    if (error) return setErro(mensagemErro(error))
    setSenha(''); setSenha2('')
    setOk('Senha alterada.')
  }

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Meu perfil</h1>
          <p className="muted">{perfil?.email} · {PAPEIS[perfil?.papel]}</p>
        </div>
      </div>
      <Alerta tipo="erro">{erro}</Alerta>
      <Alerta tipo="ok">{ok}</Alerta>
      <div className="grade grade-2">
        <form className="card" onSubmit={salvarNome}>
          <h2>Nome</h2>
          <label className="campo">Seu nome<input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} /></label>
          <button className="btn-primario" style={{ marginTop: 12 }}>Salvar nome</button>
        </form>
        <form className="card" onSubmit={salvarSenha}>
          <h2>Trocar senha</h2>
          <div className="form-grade">
            <label className="campo">Nova senha<input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" /></label>
            <label className="campo">Repita<input type="password" value={senha2} onChange={(e) => setSenha2(e.target.value)} autoComplete="new-password" /></label>
          </div>
          <button className="btn-primario" style={{ marginTop: 12 }}>Trocar senha</button>
        </form>
      </div>
    </>
  )
}
