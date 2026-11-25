import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useDados } from '../context/DadosContext'
import { PAPEIS } from '../lib/format'
import { Alerta } from './ui'

const base = import.meta.env.BASE_URL

export default function Layout() {
  const { perfil, eAdmin, sair } = useAuth()
  const { config, erro } = useDados()
  const [aberta, setAberta] = useState(false)
  const loc = useLocation()

  const links = [
    { to: '/', ico: '📊', txt: 'Painel', end: true },
    { to: '/lancamentos', ico: '🧾', txt: 'Lançamentos' },
    { to: '/fluxo', ico: '📅', txt: 'Fluxo de Caixa' },
    { to: '/relatorios', ico: '📄', txt: 'Relatórios' },
  ]
  const admin = [
    { to: '/categorias', ico: '🏷️', txt: 'Categorias e formas' },
    { to: '/usuarios', ico: '👥', txt: 'Usuários e acessos' },
    { to: '/configuracoes', ico: '⚙️', txt: 'Configurações' },
    { to: '/auditoria', ico: '🕑', txt: 'Histórico (auditoria)' },
  ]
  const fechar = () => setAberta(false)

  return (
    <div className="app">
      <aside className={`sidebar ${aberta ? 'aberta' : ''}`}>
        <div className="marca">
          <img src={`${base}medalhao-192.png`} alt="" />
          <div>
            <b>Kairós Caixa</b>
            <span>{config?.nome_grupo || 'Controle de gastos'}</span>
          </div>
        </div>
        <nav className="nav" onClick={fechar}>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end}>
              <span className="ico">{l.ico}</span>
              {l.txt}
            </NavLink>
          ))}
          {eAdmin && <div className="grupo">Administração</div>}
          {eAdmin &&
            admin.map((l) => (
              <NavLink key={l.to} to={l.to}>
                <span className="ico">{l.ico}</span>
                {l.txt}
              </NavLink>
            ))}
          <div className="grupo">Conta</div>
          <NavLink to="/perfil">
            <span className="ico">👤</span>Meu perfil
          </NavLink>
        </nav>
        <div className="usuario-box">
          <b>{perfil?.nome || perfil?.email}</b>
          <span>{PAPEIS[perfil?.papel] || ''}</span>
          <button className="btn-claro btn-pequeno" onClick={sair}>
            Sair
          </button>
        </div>
      </aside>
      <div className="conteudo">
        <div className="topo-mobile">
          <button onClick={() => setAberta(!aberta)} aria-label="Menu">☰</button>
          <b>Kairós Caixa</b>
        </div>
        <main className="pagina" key={loc.pathname}>
          <Alerta tipo="erro">{erro}</Alerta>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
