import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import './styles.css'
import { supabaseConfigurado } from './lib/supabase'
import { AuthProvider, useAuth } from './context/AuthContext'
import { DadosProvider } from './context/DadosContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import { Aguardando, RedefinirSenha, SemConfiguracao } from './pages/Acesso'
import { Carregando } from './components/ui'
import { aplicarTema, temaSalvo } from './lib/tema'

aplicarTema(temaSalvo())

// Permite instalar como aplicativo (celular e computador)
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  window.__kairosInstalar = e
  window.dispatchEvent(new Event('kairos-instalavel'))
})
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {}))
}

const Painel = lazy(() => import('./pages/Painel'))
const Lancamentos = lazy(() => import('./pages/Lancamentos'))
const Fluxo = lazy(() => import('./pages/Fluxo'))
const Relatorios = lazy(() => import('./pages/Relatorios'))
const Categorias = lazy(() => import('./pages/Categorias'))
const Usuarios = lazy(() => import('./pages/Usuarios'))
const Configuracoes = lazy(() => import('./pages/Configuracoes'))
const Auditoria = lazy(() => import('./pages/Auditoria'))
const Perfil = lazy(() => import('./pages/Perfil'))
const Casais = lazy(() => import('./pages/Casais'))
const Mensalidades = lazy(() => import('./pages/Mensalidades'))

function SoAdmin({ children }) {
  const { eAdmin } = useAuth()
  return eAdmin ? children : <Navigate to="/" replace />
}

function App() {
  const { carregando, usuario, perfil, ativo, recuperandoSenha } = useAuth()
  if (carregando || (usuario && !perfil)) return <Carregando />
  if (recuperandoSenha && usuario) return <RedefinirSenha />
  if (!usuario) return <Login />
  if (!ativo) return <Aguardando />
  return (
    <DadosProvider>
      <Suspense fallback={<Carregando />}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Painel />} />
            <Route path="lancamentos" element={<Lancamentos />} />
            <Route path="fluxo" element={<Fluxo />} />
            <Route path="relatorios" element={<Relatorios />} />
            <Route path="perfil" element={<Perfil />} />
            <Route path="casais" element={<Casais />} />
            <Route path="mensalidades" element={<Mensalidades />} />
            <Route path="categorias" element={<SoAdmin><Categorias /></SoAdmin>} />
            <Route path="usuarios" element={<SoAdmin><Usuarios /></SoAdmin>} />
            <Route path="configuracoes" element={<SoAdmin><Configuracoes /></SoAdmin>} />
            <Route path="auditoria" element={<SoAdmin><Auditoria /></SoAdmin>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </DadosProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {supabaseConfigurado ? (
      <HashRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </HashRouter>
    ) : (
      <SemConfiguracao />
    )}
  </React.StrictMode>
)
