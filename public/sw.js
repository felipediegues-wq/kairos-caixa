// Service worker mínimo: permite instalar o Kairós Caixa como aplicativo.
// Não guarda dados em cache: tudo vem sempre do servidor (dados sempre atualizados).
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => {})
