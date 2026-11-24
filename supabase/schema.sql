-- =====================================================================
--  Kairós Caixa — estrutura do banco (Supabase / PostgreSQL)
--  Rode este arquivo inteiro no Supabase: SQL Editor > New query > Run.
--  Pode rodar de novo sem perder dados (usa "if not exists" / "or replace").
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tabelas
-- ---------------------------------------------------------------------

-- Perfil de cada usuário (ligado ao login do Supabase Auth)
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  nome        text not null default '',
  email       text,
  papel       text not null default 'leitura' check (papel in ('admin', 'tesoureiro', 'leitura')),
  ativo       boolean not null default false,
  criado_em   timestamptz not null default now()
);
comment on table public.profiles is 'Usuários do sistema. papel: admin | tesoureiro | leitura. Só usuários ativos acessam os dados.';

-- Configurações gerais (sempre uma única linha, id = 1)
create table if not exists public.configuracoes (
  id             int primary key default 1 check (id = 1),
  nome_grupo     text not null default 'Grupo Kairós',
  saldo_inicial  numeric(12, 2) not null default 0,
  mes_inicial    date not null default date_trunc('month', now())::date,
  atualizado_em  timestamptz not null default now()
);

create table if not exists public.categorias (
  id      bigint generated always as identity primary key,
  tipo    text not null check (tipo in ('Entrada', 'Saída', 'Retirada')),
  nome    text not null check (length(trim(nome)) > 0),
  ativo   boolean not null default true,
  ordem   int not null default 0,
  unique (tipo, nome)
);

create table if not exists public.formas_pagamento (
  id      bigint generated always as identity primary key,
  nome    text not null unique check (length(trim(nome)) > 0),
  ativo   boolean not null default true,
  ordem   int not null default 0
);

create table if not exists public.lancamentos (
  id             bigint generated always as identity primary key,
  data           date not null,
  tipo           text not null check (tipo in ('Entrada', 'Saída', 'Retirada')),
  categoria_id   bigint not null references public.categorias (id),
  forma_id       bigint references public.formas_pagamento (id),
  descricao      text not null check (length(trim(descricao)) > 0),
  valor          numeric(12, 2) not null check (valor > 0),
  observacao     text,
  criado_por     uuid references public.profiles (id) on delete set null default auth.uid(),
  criado_em      timestamptz not null default now(),
  atualizado_por uuid references public.profiles (id) on delete set null,
  atualizado_em  timestamptz
);
create index if not exists lancamentos_data_idx on public.lancamentos (data);
create index if not exists lancamentos_categoria_idx on public.lancamentos (categoria_id);

-- Histórico de alterações (quem fez o quê e quando)
create table if not exists public.auditoria (
  id            bigint generated always as identity primary key,
  em            timestamptz not null default now(),
  tabela        text not null,
  registro_id   text,
  acao          text not null,
  usuario_id    uuid,
  usuario_nome  text,
  antes         jsonb,
  depois        jsonb
);
create index if not exists auditoria_em_idx on public.auditoria (em desc);

-- ---------------------------------------------------------------------
-- 2. Funções de permissão (usadas pelas regras de acesso)
-- ---------------------------------------------------------------------
create or replace function public.meu_papel()
returns text language sql stable security definer set search_path = public as $$
  select papel from public.profiles where id = auth.uid() and ativo
$$;

create or replace function public.usuario_ativo()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.meu_papel() is not null, false)
$$;

create or replace function public.pode_editar()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.meu_papel() in ('admin', 'tesoureiro'), false)
$$;

create or replace function public.eh_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.meu_papel() = 'admin', false)
$$;

-- ---------------------------------------------------------------------
-- 3. Gatilhos (triggers)
-- ---------------------------------------------------------------------

-- 3.1 Ao criar uma conta: cria o perfil. O PRIMEIRO usuário vira admin ativo;
--     os demais entram como "leitura" e inativos, aguardando aprovação do admin.
create or replace function public.ao_criar_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  tem_admin boolean;
begin
  select exists (select 1 from public.profiles where papel = 'admin') into tem_admin;
  insert into public.profiles (id, email, nome, papel, ativo)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1)),
    case when tem_admin then 'leitura' else 'admin' end,
    not tem_admin
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.ao_criar_usuario();

-- 3.2 Não deixa o sistema ficar sem nenhum admin ativo
create or replace function public.protege_ultimo_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.papel = 'admin' and old.ativo
     and (new.papel <> 'admin' or not new.ativo)
     and not exists (select 1 from public.profiles
                     where papel = 'admin' and ativo and id <> old.id) then
    raise exception 'O sistema precisa ter pelo menos um administrador ativo.';
  end if;
  return new;
end $$;

drop trigger if exists protege_ultimo_admin on public.profiles;
create trigger protege_ultimo_admin
  before update on public.profiles
  for each row execute function public.protege_ultimo_admin();

-- 3.3 Lançamentos: categoria precisa ser do mesmo tipo; registra quem alterou
create or replace function public.valida_lancamento()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  tipo_cat text;
begin
  select tipo into tipo_cat from public.categorias where id = new.categoria_id;
  if tipo_cat is null then
    raise exception 'Categoria inexistente.';
  end if;
  if tipo_cat <> new.tipo then
    raise exception 'A categoria escolhida é de %, mas o lançamento é de %.', tipo_cat, new.tipo;
  end if;
  if tg_op = 'INSERT' then
    new.criado_por := coalesce(new.criado_por, auth.uid());
    new.criado_em := now();
  else
    new.criado_por := old.criado_por;     -- não deixa trocar o autor
    new.criado_em := old.criado_em;
    new.atualizado_por := auth.uid();
    new.atualizado_em := now();
  end if;
  return new;
end $$;

drop trigger if exists valida_lancamento on public.lancamentos;
create trigger valida_lancamento
  before insert or update on public.lancamentos
  for each row execute function public.valida_lancamento();

-- 3.4 Configurações: data de atualização
create or replace function public.toca_configuracoes()
returns trigger language plpgsql as $$
begin
  new.id := 1;
  new.atualizado_em := now();
  return new;
end $$;

drop trigger if exists toca_configuracoes on public.configuracoes;
create trigger toca_configuracoes
  before update on public.configuracoes
  for each row execute function public.toca_configuracoes();

-- 3.5 Auditoria genérica
create or replace function public.registra_auditoria()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nome text;
  v_id   text;
begin
  select nome into v_nome from public.profiles where id = auth.uid();
  v_id := case when tg_op = 'DELETE' then (to_jsonb(old) ->> 'id') else (to_jsonb(new) ->> 'id') end;
  insert into public.auditoria (tabela, registro_id, acao, usuario_id, usuario_nome, antes, depois)
  values (
    tg_table_name, v_id, tg_op, auth.uid(), v_nome,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['lancamentos', 'categorias', 'formas_pagamento', 'configuracoes', 'profiles'] loop
    execute format('drop trigger if exists auditoria on public.%I', t);
    execute format('create trigger auditoria after insert or update or delete on public.%I
                    for each row execute function public.registra_auditoria()', t);
  end loop;
end $$;

-- 3.6 Cada usuário pode mudar o próprio nome (e só o nome)
create or replace function public.atualizar_meu_nome(novo_nome text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if length(trim(coalesce(novo_nome, ''))) = 0 then
    raise exception 'Informe um nome.';
  end if;
  update public.profiles set nome = trim(novo_nome) where id = auth.uid();
end $$;

-- ---------------------------------------------------------------------
-- 4. Regras de acesso (Row Level Security)
--    leitura    : vê tudo
--    tesoureiro : vê tudo + inclui/edita/exclui lançamentos
--    admin      : tudo + usuários, categorias, formas, configurações e auditoria
--    inativo / sem login : não vê nada
-- ---------------------------------------------------------------------
alter table public.profiles         enable row level security;
alter table public.configuracoes    enable row level security;
alter table public.categorias       enable row level security;
alter table public.formas_pagamento enable row level security;
alter table public.lancamentos      enable row level security;
alter table public.auditoria        enable row level security;

drop policy if exists "perfis: ver" on public.profiles;
create policy "perfis: ver" on public.profiles for select to authenticated
  using (id = auth.uid() or public.usuario_ativo());
drop policy if exists "perfis: admin altera" on public.profiles;
create policy "perfis: admin altera" on public.profiles for update to authenticated
  using (public.eh_admin()) with check (public.eh_admin());

drop policy if exists "config: ver" on public.configuracoes;
create policy "config: ver" on public.configuracoes for select to authenticated
  using (public.usuario_ativo());
drop policy if exists "config: admin altera" on public.configuracoes;
create policy "config: admin altera" on public.configuracoes for update to authenticated
  using (public.eh_admin()) with check (public.eh_admin());

drop policy if exists "categorias: ver" on public.categorias;
create policy "categorias: ver" on public.categorias for select to authenticated
  using (public.usuario_ativo());
drop policy if exists "categorias: admin gerencia" on public.categorias;
create policy "categorias: admin gerencia" on public.categorias for all to authenticated
  using (public.eh_admin()) with check (public.eh_admin());

drop policy if exists "formas: ver" on public.formas_pagamento;
create policy "formas: ver" on public.formas_pagamento for select to authenticated
  using (public.usuario_ativo());
drop policy if exists "formas: admin gerencia" on public.formas_pagamento;
create policy "formas: admin gerencia" on public.formas_pagamento for all to authenticated
  using (public.eh_admin()) with check (public.eh_admin());

drop policy if exists "lancamentos: ver" on public.lancamentos;
create policy "lancamentos: ver" on public.lancamentos for select to authenticated
  using (public.usuario_ativo());
drop policy if exists "lancamentos: incluir" on public.lancamentos;
create policy "lancamentos: incluir" on public.lancamentos for insert to authenticated
  with check (public.pode_editar());
drop policy if exists "lancamentos: alterar" on public.lancamentos;
create policy "lancamentos: alterar" on public.lancamentos for update to authenticated
  using (public.pode_editar()) with check (public.pode_editar());
drop policy if exists "lancamentos: excluir" on public.lancamentos;
create policy "lancamentos: excluir" on public.lancamentos for delete to authenticated
  using (public.pode_editar());

drop policy if exists "auditoria: admin ve" on public.auditoria;
create policy "auditoria: admin ve" on public.auditoria for select to authenticated
  using (public.eh_admin());

-- Permissões básicas (o RLS acima é quem filtra de verdade)
revoke all on public.profiles, public.configuracoes, public.categorias,
              public.formas_pagamento, public.lancamentos, public.auditoria from anon;
grant select, update on public.profiles to authenticated;
grant select, update on public.configuracoes to authenticated;
grant select, insert, update, delete on public.categorias, public.formas_pagamento, public.lancamentos to authenticated;
grant select on public.auditoria to authenticated;
grant execute on function public.atualizar_meu_nome(text) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Dados iniciais (só inserem se ainda não existirem)
-- ---------------------------------------------------------------------
insert into public.configuracoes (id, nome_grupo, saldo_inicial, mes_inicial)
values (1, 'Grupo Kairós', 0, date_trunc('month', now())::date)
on conflict (id) do nothing;

insert into public.categorias (tipo, nome, ordem) values
  ('Entrada', 'Contribuições', 1),
  ('Entrada', 'Doações', 2),
  ('Entrada', 'Eventos e vendas', 3),
  ('Entrada', 'Rendimentos', 4),
  ('Entrada', 'Outras entradas', 5),
  ('Saída', 'Alimentação', 1),
  ('Saída', 'Material e compras', 2),
  ('Saída', 'Eventos', 3),
  ('Saída', 'Transporte', 4),
  ('Saída', 'Aluguel e espaço', 5),
  ('Saída', 'Contas e serviços', 6),
  ('Saída', 'Comunicação e impressos', 7),
  ('Saída', 'Taxas bancárias', 8),
  ('Saída', 'Outros gastos', 9),
  ('Retirada', 'Saque em dinheiro', 1),
  ('Retirada', 'Repasse', 2),
  ('Retirada', 'Reembolso', 3)
on conflict (tipo, nome) do nothing;

insert into public.formas_pagamento (nome, ordem) values
  ('Pix', 1), ('Dinheiro', 2), ('Cartão de débito', 3), ('Cartão de crédito', 4),
  ('Boleto', 5), ('Transferência', 6), ('Débito em conta', 7)
on conflict (nome) do nothing;
