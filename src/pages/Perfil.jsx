import { useEffect, useRef, useState } from 'react'
import { supabase, mensagemErro, urlDoSite } from '../lib/supabase'
import { TEMAS, useTema } from '../lib/tema'
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
      <EscolhaTema />
      <UsarNoCelular />
    </>
  )
}

function EscolhaTema() {
  const [tema, setTema] = useTema()
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h2>Aparência</h2>
      <p className="muted small" style={{ marginTop: 0 }}>Vale para este aparelho. Cada pessoa escolhe a sua.</p>
      <div className="escolha-tema">
        {Object.entries(TEMAS).map(([k, t]) => (
          <button key={k} className={tema === k ? 'ativo' : ''} onClick={() => setTema(k)}>
            <span className="amostra">
              <i style={{ background: t.cores[0], width: '30%' }} />
              <i style={{ background: t.cores[2], flex: 1, position: 'relative' }}>
                <i style={{ position: 'absolute', left: 8, top: 10, width: '45%', height: 8, borderRadius: 4, background: t.cores[1] }} />
              </i>
            </span>
            {t.nome}{tema === k ? ' ✓' : ''}
          </button>
        ))}
      </div>
    </div>
  )
}

function UsarNoCelular() {
  const canvas = useRef(null)
  const [podeInstalar, setPodeInstalar] = useState(Boolean(window.__kairosInstalar))
  const [instalado, setInstalado] = useState(window.matchMedia?.('(display-mode: standalone)').matches)
  const link = urlDoSite()

  useEffect(() => {
    import('qrcode').then((QR) => canvas.current && QR.toCanvas(canvas.current, link, { width: 168, margin: 1 }))
    const f = () => setPodeInstalar(true)
    window.addEventListener('kairos-instalavel', f)
    return () => window.removeEventListener('kairos-instalavel', f)
  }, [link])

  async function instalar() {
    const e = window.__kairosInstalar
    if (!e) return
    e.prompt()
    const r = await e.userChoice
    if (r.outcome === 'accepted') setInstalado(true)
    window.__kairosInstalar = null
    setPodeInstalar(false)
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h2>Usar no celular</h2>
      <div className="qr-box">
        <canvas ref={canvas} aria-label="QR code do endereço do sistema" />
        <div style={{ flex: 1, minWidth: 240 }}>
          <p style={{ marginTop: 0 }}>Aponte a câmera do celular para o código ao lado para abrir o sistema.</p>
          {instalado ? (
            <p className="pos"><b>✓ O Kairós Caixa já está instalado neste aparelho.</b></p>
          ) : podeInstalar ? (
            <button className="btn-primario" onClick={instalar}>📲 Instalar o Kairós Caixa neste aparelho</button>
          ) : null}
          <div className="small" style={{ marginTop: 10, lineHeight: 1.6 }}>
            <b>Android (Chrome):</b> abra o site → menu <b>⋮</b> → <b>Instalar app</b> (ou “Adicionar à tela inicial”).<br />
            <b>iPhone (Safari):</b> abra o site → botão <b>Compartilhar</b> (quadrado com seta) → <b>Adicionar à Tela de Início</b>.<br />
            O ícone do medalhão aparece na tela do celular e o sistema abre em tela cheia, como um aplicativo.
          </div>
          <div className="muted small" style={{ marginTop: 8 }}>Endereço: <code>{link}</code></div>
        </div>
      </div>
    </div>
  )
}
