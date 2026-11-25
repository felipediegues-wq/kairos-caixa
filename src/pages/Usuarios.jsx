import { useEffect, useState, useCallback } from 'react'
import { supabase, mensagemErro, urlDoSite } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Alerta, Carregando } from '../components/ui'
import { PAPEIS, dataBR } from '../lib/format'

export default function Usuarios() {
  const { usuario, recarregarPerfil } = useAuth()
  const [lista, setLista] = useState(null)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from('usuarios').select('*').order('ativo').order('nome')
    if (error) setErro(mensagemErro(error))
    else setLista(data)
  }, [])
  useEffect(() => { carregar() }, [carregar])

  async function alterar(p, mudanca, txt) {
    setErro('')
    setOk('')
    const { error } = await supabase.from('usuarios').update(mudanca).eq('id', p.id)
    if (error) return setErro(mensagemErro(error))
    setOk(txt)
    await carregar()
    if (p.id === usuario.id) recarregarPerfil()
  }

  if (!lista) return <Carregando />
  const pendentes = lista.filter((p) => !p.ativo)
  const link = urlDoSite()

  return (
    <>
      <div className="cabecalho">
        <div>
          <h1>Usuários e acessos</h1>
          <p className="muted">Libere quem pode entrar e defina o que cada pessoa pode fazer</p>
        </div>
      </div>
      <Alerta tipo="erro">{erro}</Alerta>
      <Alerta tipo="ok">{ok}</Alerta>

      <div className="card">
        <h2>Como dar acesso a alguém</h2>
        <ol className="small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li>Envie o endereço do sistema: <code>{link}</code>{' '}
            <button className="btn-link btn-pequeno" onClick={() => navigator.clipboard?.writeText(link).then(() => setOk('Endereço copiado.'))}>copiar</button></li>
          <li>A pessoa clica em <b>Criar conta</b> e confirma o e-mail.</li>
          <li>Ela aparece aqui como <span className="tag pendente">Aguardando</span>: escolha o perfil e clique em <b>Liberar</b>.</li>
        </ol>
        <div className="small muted" style={{ marginTop: 10 }}>
          <b>Administrador</b>: tudo, inclusive usuários, categorias e configurações · <b>Tesoureiro</b>: inclui, edita e exclui lançamentos ·{' '}
          <b>Leitura</b>: só consulta painel, lançamentos e relatórios.
        </div>
      </div>

      {pendentes.length > 0 && (
        <Alerta tipo="aviso">{pendentes.length} pessoa(s) aguardando liberação ou com acesso bloqueado.</Alerta>
      )}

      <div className="tabela-wrap" style={{ marginTop: 16 }}>
        <table className="tabela">
          <thead>
            <tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Situação</th><th>Desde</th><th></th></tr>
          </thead>
          <tbody>
            {lista.map((p) => (
              <tr key={p.id}>
                <td><b>{p.nome || '—'}</b>{p.id === usuario.id && <span className="muted small"> (você)</span>}</td>
                <td>{p.email}</td>
                <td>
                  <select value={p.papel} onChange={(e) => alterar(p, { papel: e.target.value }, `Perfil de ${p.nome || p.email} alterado para ${PAPEIS[e.target.value]}.`)}>
                    {Object.entries(PAPEIS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </td>
                <td>{p.ativo ? <span className="tag tesoureiro">Ativo</span> : <span className="tag pendente">Aguardando / bloqueado</span>}</td>
                <td className="nowrap">{dataBR(p.criado_em)}</td>
                <td className="right nowrap">
                  {p.ativo ? (
                    <button className="btn-link perigo" onClick={() => window.confirm(`Bloquear o acesso de ${p.nome || p.email}?`) && alterar(p, { ativo: false }, 'Acesso bloqueado.')}>
                      Bloquear
                    </button>
                  ) : (
                    <button className="btn-verde btn-pequeno" onClick={() => alterar(p, { ativo: true }, `Acesso de ${p.nome || p.email} liberado como ${PAPEIS[p.papel]}.`)}>
                      Liberar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">Para apagar uma conta de vez: Supabase → Authentication → Users. Bloquear já impede o acesso a todos os dados.</p>
    </>
  )
}
