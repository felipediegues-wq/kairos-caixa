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
| **Casais** | Cadastro dos casais do grupo com função (coordenador, vice, secretário, financeiro, Boa Vontade, membro), contato, mês de entrada e de saída |
| **Mensalidades em aberto** | Quem está em dia e quem deve, mês a mês, com PDF — **só casal coordenador, casal secretário e administrador** |
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

### 1. Projeto Supabase
O Kairós **pode usar o mesmo projeto Supabase de outro sistema** (ex.: o das Ações). Tudo dele fica no schema **`caixa`**, separado do `public`: não altera tabelas, funções nem gatilhos do outro sistema.

- **Usando um projeto existente:** só abra o projeto no <https://supabase.com>.
- **Projeto novo:** **New project** → nome, senha do banco e região **South America (São Paulo)**.

### 2. Criar as tabelas e liberar o schema na API
1. **SQL Editor** → **New query** → cole todo o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) → **Run**. Deve aparecer “Success”. (Pode rodar de novo no futuro sem perder dados.)
2. **Project Settings → Data API** (ou **API**) → em **Exposed schemas**, **adicione `caixa`** (mantenha os que já estão, como `public`) → **Save**.

3. Rode também, nesta ordem, [`supabase/002_casais_mensalidades.sql`](supabase/002_casais_mensalidades.sql) (casais, mensalidades e devedores) [`supabase/003_caixa_alta.sql`](supabase/003_caixa_alta.sql) (textos sempre em maiúsculas) e [`supabase/004_sem_retiradas.sql`](supabase/004_sem_retiradas.sql) (só Entrada e Saída).

> Sem o passo 2.2 o site mostra o erro “schema caixa não está liberado”.

### 3. Configurar o login
Em **Authentication → URL Configuration**:
- **Redirect URLs:** adicione `https://felipediegues-wq.github.io/kairos-caixa/**` (e `http://localhost:5173/**` se for testar no computador).
- **Site URL:** se o projeto já é usado por outro sistema, **não mude** (deixe a do outro sistema). Em projeto só do Kairós, use `https://felipediegues-wq.github.io/kairos-caixa/`.

Em **Authentication → Sign In / Providers → Email**: deixe **Enable Email** ligado. “Confirm email” ligado é o recomendado.

> **Cadastro desativado no projeto?** Se aparecer “A criação de contas pelo site está desativada”, é porque em **Authentication → Sign In / Providers** a opção *Allow new users to sign up* está desligada. Nesse caso o admin cria cada conta em **Authentication → Users → Add user → Create new user** (marque *Auto Confirm User*); a pessoa entra no Kairós e o admin libera em **Usuários e acessos**.
>
> **Projeto compartilhado:** as contas de login são as mesmas dos dois sistemas. Quem já tem conta no outro sistema entra no Kairós com o mesmo e-mail e senha, mas **só vê o caixa depois que um administrador do Kairós liberar**. E quem criar conta pelo Kairós passa a existir também no cadastro de login do outro sistema (o acesso a cada um continua separado). Os e-mails de confirmação/recuperação usam os modelos já configurados no projeto.
>
> O Supabase gratuito envia poucos e-mails por hora; se precisar de mais, configure SMTP próprio em **Authentication → Emails → SMTP Settings**.

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
1. Abra o site e entre (ou clique em **Criar conta**, se ainda não tiver login no projeto). **A primeira pessoa que entrar no Kairós vira Administrador automaticamente** — então entre você primeiro.
2. Se criou conta agora, confirme o e-mail e entre.
3. Vá em **Configurações** e informe o nome do grupo, o saldo inicial e o mês inicial.
4. Mande o endereço do site para o grupo. Cada pessoa cria a própria conta e aparece em **Usuários e acessos** como “Aguardando”: escolha o perfil e clique em **Liberar**.

---

## Casais e mensalidades

1. **Configurações → Valor da mensalidade:** informe o valor e a partir de quando vale. Para reajustar, adicione um novo valor a partir do mês do reajuste (os meses anteriores mantêm o valor antigo).
2. **Casais:** cadastre cada casal com a função e o mês em que entrou no grupo (ele passa a dever a partir desse mês). Quando um casal sair, marque *Saiu do grupo* e o último mês.
3. **Lançamentos → Novo lançamento:** tipo *Entrada*, categoria **Mensalidades (casal)**, escolha o casal e clique nos meses que ele está pagando. O sistema grava um lançamento por mês, com o valor de cada mês (ou o valor que você digitar).
4. **Usuários e acessos:** ligue o login de cada pessoa ao casal dela. Quem é do **casal coordenador** ou do **casal secretário** passa a ver **Mensalidades em aberto** e pode cadastrar casais. Essa regra é aplicada no banco: os demais não conseguem consultar o relatório nem pela API.

Qualquer categoria de entrada pode virar “mensalidade de casal” em **Categorias e formas** (coluna *Mensalidade de casal*).

## Rodar no computador (opcional, para desenvolver)

Precisa do [Node.js 20+](https://nodejs.org).

```bash
npm install
cp .env.example .env.local   # e preencha com a URL e a chave do Supabase
npm run dev                  # abre em http://localhost:5173
```

## Estrutura

```
supabase/schema.sql      schema "caixa": tabelas, permissões (RLS), auditoria e dados iniciais
supabase/002_*.sql       casais, mensalidades e relatório de devedores
supabase/003_*.sql       textos sempre em CAIXA ALTA (exceto e-mails)
supabase/004_*.sql       fim do tipo Retirada: só Entrada e Saída
src/lib/                 conexão com o Supabase, formatação, cálculos e gerador de PDF
src/context/             login/perfil e carregamento dos dados
src/pages/               uma tela por arquivo
.github/workflows/       publicação automática no GitHub Pages
```

## Bom saber

- **Remover o Kairós do banco** (sem afetar o outro sistema): `drop schema caixa cascade;` no SQL Editor — apaga todos os dados do caixa.
- **Projeto gratuito do Supabase pausa** depois de 7 dias sem nenhum acesso. Se acontecer, entre no painel do Supabase e clique em **Restore**: os dados continuam lá.
- **Backup:** em Lançamentos, use *Exportar Excel (CSV)* de vez em quando; ou no Supabase, **Database → Backups** (planos pagos) / `pg_dump`.
- **Esqueceu a senha?** Na tela de login: *Esqueci minha senha*.
- **Apagar uma conta de vez:** Supabase → **Authentication → Users**. Para só impedir o acesso, use *Bloquear* em Usuários e acessos.
- O repositório é **público** (exigência do GitHub Pages gratuito). Não há senhas no código: os dados ficam no Supabase, protegidos pelas regras de acesso.
