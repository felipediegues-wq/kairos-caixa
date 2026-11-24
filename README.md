# Kairós Caixa

Sistema web de **controle de gastos e fluxo de caixa** para o grupo, com login e controle de acessos.

- **Site:** React + Vite, publicado de graça no **GitHub Pages**
- **Banco de dados e login:** **Supabase** (PostgreSQL + Auth)
- **Endereço depois de publicado:** `https://felipediegues-wq.github.io/kairos-caixa/`

## O que o sistema faz

| Tela | O que tem |
|---|---|
| **Painel** | Saldo atual, totais, resumo do mês escolhido, maior gasto, gráficos (mensal, evolução do saldo, por categoria, por forma de pagamento) e últimos lançamentos |
| **Lançamentos** | Incluir, editar, duplicar e excluir; filtros por período, tipo, categoria e busca; saldo linha a linha; exportar para Excel (CSV) |
| **Fluxo de Caixa** | Tabela categoria × 12 meses, com saldo inicial, totais, resultado e saldo final de cada mês |
| **Relatórios (PDF)** | Prestação de contas com resumo, gráfico, mês a mês, categorias, lançamentos, fluxo e linhas de assinatura |
| **Categorias e formas** | Adicionar, renomear, ordenar, desativar e excluir (só admin) |
| **Usuários e acessos** | Liberar ou bloquear pessoas e definir o perfil de cada uma (só admin) |
| **Configurações** | Nome do grupo, saldo inicial e mês inicial dos relatórios (só admin) |
| **Histórico** | Auditoria: quem incluiu, alterou ou excluiu cada registro, com o valor anterior (só admin) |

### Perfis de acesso

| Perfil | Pode |
|---|---|
| **Administrador** | Tudo, inclusive usuários, categorias, configurações e histórico |
| **Tesoureiro** | Ver tudo e incluir/editar/excluir lançamentos |
| **Leitura** | Só consultar painel, lançamentos, fluxo e gerar relatórios |

As permissões são garantidas **no banco** (Row Level Security do Supabase), não só nas telas: mesmo que alguém tente acessar a API direto, só consegue o que o seu perfil permite. Quem cria conta entra **bloqueado** até um administrador liberar.

---

## Como colocar no ar (uma vez só, ~15 minutos)

### 1. Criar o projeto no Supabase
1. Entre em <https://supabase.com> e crie uma conta (pode usar o login do GitHub).
2. **New project** → dê um nome (ex.: `kairos-caixa`), crie uma senha do banco (guarde) e escolha a região **South America (São Paulo)**.
3. Espere 1–2 minutos até o projeto ficar pronto.

### 2. Criar as tabelas
1. No menu do Supabase: **SQL Editor** → **New query**.
2. Copie todo o conteúdo do arquivo [`supabase/schema.sql`](supabase/schema.sql), cole e clique **Run**.
3. Deve aparecer “Success”. (Pode rodar de novo no futuro sem perder dados.)

### 3. Configurar o login
Em **Authentication → URL Configuration**:
- **Site URL:** `https://felipediegues-wq.github.io/kairos-caixa/`
- **Redirect URLs:** adicione `https://felipediegues-wq.github.io/kairos-caixa/**` e, se for testar no computador, `http://localhost:5173/**`

Em **Authentication → Sign In / Providers → Email**: deixe **Enable Email** ligado. “Confirm email” ligado é o recomendado (a pessoa confirma o e-mail antes de entrar).

> O Supabase gratuito envia poucos e-mails por hora. Para um grupo pequeno costuma bastar; se precisar de mais, configure um SMTP próprio em **Authentication → Emails → SMTP Settings**.

### 4. Copiar as chaves do Supabase
Em **Project Settings → API** (ou **Data API**), copie:
- **Project URL** (ex.: `https://abcdxyz.supabase.co`)
- **anon public** key (uma chave longa que começa com `eyJ...`) — ou a **Publishable key** nos projetos novos

> Use **somente** a chave *anon/publishable*. **Nunca** coloque a chave `service_role`/secret no site.

### 5. Colocar as chaves no GitHub
No repositório: **Settings → Secrets and variables → Actions → New repository secret**, crie dois:
- `VITE_SUPABASE_URL` = Project URL
- `VITE_SUPABASE_ANON_KEY` = anon public key

### 6. Publicar
1. **Settings → Pages → Build and deployment → Source:** deixe **GitHub Actions**.
2. Aba **Actions** → **Publicar no GitHub Pages** → **Run workflow**.
3. Em ~1 minuto o site estará em `https://felipediegues-wq.github.io/kairos-caixa/`.

Toda vez que algo for alterado na branch `main`, o site é publicado de novo automaticamente.

### 7. Primeiro acesso
1. Abra o site e clique em **Criar conta**. **A primeira conta criada vira Administrador automaticamente.**
2. Confirme o e-mail e entre.
3. Vá em **Configurações** e informe o nome do grupo, o saldo inicial e o mês inicial.
4. Mande o endereço do site para o grupo. Cada pessoa cria a própria conta e aparece em **Usuários e acessos** como “Aguardando”: escolha o perfil e clique em **Liberar**.

---

## Rodar no computador (opcional, para desenvolver)

Precisa do [Node.js 20+](https://nodejs.org).

```bash
npm install
cp .env.example .env.local   # e preencha com a URL e a chave do Supabase
npm run dev                  # abre em http://localhost:5173
```

## Estrutura

```
supabase/schema.sql      tabelas, permissões (RLS), auditoria e dados iniciais
src/lib/                 conexão com o Supabase, formatação, cálculos e gerador de PDF
src/context/             login/perfil e carregamento dos dados
src/pages/               uma tela por arquivo
.github/workflows/       publicação automática no GitHub Pages
```

## Bom saber

- **Projeto gratuito do Supabase pausa** depois de 7 dias sem nenhum acesso. Se acontecer, entre no painel do Supabase e clique em **Restore**: os dados continuam lá.
- **Backup:** em Lançamentos, use *Exportar Excel (CSV)* de vez em quando; ou no Supabase, **Database → Backups** (planos pagos) / `pg_dump`.
- **Esqueceu a senha?** Na tela de login: *Esqueci minha senha*.
- **Apagar uma conta de vez:** Supabase → **Authentication → Users**. Para só impedir o acesso, use *Bloquear* em Usuários e acessos.
- O repositório é **público** (exigência do GitHub Pages gratuito). Não há senhas no código: os dados ficam no Supabase, protegidos pelas regras de acesso.
