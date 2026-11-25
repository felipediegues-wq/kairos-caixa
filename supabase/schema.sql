-- =====================================================================
--  Kairós Caixa — estrutura do banco (Supabase / PostgreSQL)
--  Rode este arquivo inteiro no Supabase: SQL Editor > New query > Run.
--  Pode rodar de novo sem perder dados (usa "if not exists" / "or replace").
--
--  Tudo fica no schema "caixa", separado do schema "public". Assim o Kairós
--  pode usar o MESMO projeto Supabase de outro sistema sem interferir nele:
--  não cria nada em "public" e não coloca gatilhos em auth.users.
--  Depois de rodar, adicione "caixa" em: Project Settings > Data API >
--  Exposed schemas (veja o README).
-- =====================================================================

create schema if not exists caixa;
grant usage on schema caixa to authenticated;

-- ---------------------------------------------------------------------
-- 1. Tabelas
-- ---------------------------------------------------------------------

-- Perfil de cada usuário (ligado ao login do Supabase Auth)
create table if not exists caixa.usuarios (
  id          uuid primary key references auth.users (id) on delete cascade,
  nome        text not null default '',
  email       text,
  papel       text not null default 'leitura' check (papel in ('admin', 'tesoureiro', 'leitura')),
  ativo       boolean not null default false,
  criado_em   timestamptz not null default now()
);
comment on table caixa.usuarios is 'Usuários do sistema. papel: admin | tesoureiro | leitura. Só usuários ativos acessam os dados.';

-- Configurações gerais (sempre uma única linha, id = 1)
create table if not exists caixa.configuracoes (
  id             int primary key default 1 check (id = 1),
  nome_grupo     text not null default 'Grupo Kairós',
  saldo_inicial  numeric(12, 2) not null default 0,
  mes_inicial    date not null default date_trunc('month', now())::date,
  atualizado_em  timestamptz not null default now()
);

create table if not exists caixa.categorias (
  id      bigint generated always as identity primary key,
  tipo    text not null check (tipo in ('Entrada', 'Saída', 'Retirada')),
  nome    text not null check (length(trim(nome)) > 0),
  ativo   boolean not null default true,
  ordem   int not null default 0,
  unique (tipo, nome)
);

create table if not exists caixa.formas_pagamento (
  id      bigint generated always as identity primary key,
  nome    text not null unique check (length(trim(nome)) > 0),
  ativo   boolean not null default true,
  ordem   int not null default 0
);

create table if not exists caixa.lancamentos (
  id             bigint generated always as identity primary key,
  data           date not null,
  tipo           text not null check (tipo in ('Entrada', 'Saída', 'Retirada')),
  categoria_id   bigint not null references caixa.categorias (id),
  forma_id       bigint references caixa.formas_pagamento (id),
  descricao      text not null check (length(trim(descricao)) > 0),
  valor          numeric(12, 2) not null check (valor > 0),
  observacao     text,
  criado_por     uuid references caixa.usuarios (id) on delete set null default auth.uid(),
  criado_em      timestamptz not null default now(),
  atualizado_por uuid references caixa.usuarios (id) on delete set null,
  atualizado_em  timestamptz
);
create index if not exists lancamentos_data_idx on caixa.lancamentos (data);
create index if not exists lancamentos_categoria_idx on caixa.lancamentos (categoria_id);

-- Histórico de alterações (quem fez o quê e quando)
create table if not exists caixa.auditoria (
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
create index if not exists auditoria_em_idx on caixa.auditoria (em desc);

-- ---------------------------------------------------------------------
-- 2. Funções de permissão (usadas pelas regras de acesso)
-- ---------------------------------------------------------------------
create or replace function caixa.meu_papel()
returns text language sql stable security definer set search_path = caixa as $$
  select papel from caixa.usuarios where id = auth.uid() and ativo
$$;

create or replace function caixa.usuario_ativo()
returns boolean language sql stable security definer set search_path = caixa as $$
  select coalesce(caixa.meu_papel() is not null, false)
$$;

create or replace function caixa.pode_editar()
returns boolean language sql stable security definer set search_path = caixa as $$
  select coalesce(caixa.meu_papel() in ('admin', 'tesoureiro'), false)
$$;

create or replace function caixa.eh_admin()
returns boolean language sql stable security definer set search_path = caixa as $$
  select coalesce(caixa.meu_papel() = 'admin', false)
$$;

-- ---------------------------------------------------------------------
-- 3. Gatilhos (triggers)
-- ---------------------------------------------------------------------

-- 3.1 Registro no primeiro acesso ao Kairós.
--     O app chama esta função logo após o login. Ela cria o cadastro do usuário
--     no Kairós se ainda não existir: o PRIMEIRO vira admin ativo; os demais entram
--     como "leitura" e bloqueados até o admin liberar. Usuários do outro sistema
--     só aparecem aqui se abrirem o Kairós.
create or replace function caixa.registrar_acesso(p_nome text default null)
returns caixa.usuarios language plpgsql security definer set search_path = caixa as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_meta  jsonb;
  v_reg   caixa.usuarios;
  tem_admin boolean;
begin
  if v_uid is null then
    raise exception 'É preciso estar logado.';
  end if;
  select * into v_reg from caixa.usuarios where id = v_uid;
  if found then
    return v_reg;
  end if;
  select email, raw_user_meta_data into v_email, v_meta from auth.users where id = v_uid;
  perform pg_advisory_xact_lock(hashtext('caixa.registrar_acesso'));
  select exists (select 1 from caixa.usuarios where papel = 'admin') into tem_admin;
  insert into caixa.usuarios (id, email, nome, papel, ativo)
  values (
    v_uid,
    v_email,
    coalesce(nullif(trim(p_nome), ''), nullif(trim(v_meta ->> 'nome'), ''), nullif(trim(v_meta ->> 'name'), ''),
             nullif(trim(v_meta ->> 'full_name'), ''), split_part(v_email, '@', 1)),
    case when tem_admin then 'leitura' else 'admin' end,
    not tem_admin
  )
  on conflict (id) do nothing
  returning * into v_reg;
  if v_reg.id is null then
    select * into v_reg from caixa.usuarios where id = v_uid;
  end if;
  return v_reg;
end $$;

-- 3.2 Não deixa o sistema ficar sem nenhum admin ativo
create or replace function caixa.protege_ultimo_admin()
returns trigger language plpgsql security definer set search_path = caixa as $$
begin
  if old.papel = 'admin' and old.ativo
     and (new.papel <> 'admin' or not new.ativo)
     and not exists (select 1 from caixa.usuarios
                     where papel = 'admin' and ativo and id <> old.id) then
    raise exception 'O sistema precisa ter pelo menos um administrador ativo.';
  end if;
  return new;
end $$;

drop trigger if exists protege_ultimo_admin on caixa.usuarios;
create trigger protege_ultimo_admin
  before update on caixa.usuarios
  for each row execute function caixa.protege_ultimo_admin();

-- 3.3 Lançamentos: categoria precisa ser do mesmo tipo; registra quem alterou
create or replace function caixa.valida_lancamento()
returns trigger language plpgsql security definer set search_path = caixa as $$
declare
  tipo_cat text;
begin
  select tipo into tipo_cat from caixa.categorias where id = new.categoria_id;
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

drop trigger if exists valida_lancamento on caixa.lancamentos;
create trigger valida_lancamento
  before insert or update on caixa.lancamentos
  for each row execute function caixa.valida_lancamento();

-- 3.4 Configurações: data de atualização
create or replace function caixa.toca_configuracoes()
returns trigger language plpgsql as $$
begin
  new.id := 1;
  new.atualizado_em := now();
  return new;
end $$;

drop trigger if exists toca_configuracoes on caixa.configuracoes;
create trigger toca_configuracoes
  before update on caixa.configuracoes
  for each row execute function caixa.toca_configuracoes();

-- 3.5 Auditoria genérica
create or replace function caixa.registra_auditoria()
returns trigger language plpgsql security definer set search_path = caixa as $$
declare
  v_nome text;
  v_id   text;
begin
  select nome into v_nome from caixa.usuarios where id = auth.uid();
  v_id := case when tg_op = 'DELETE' then (to_jsonb(old) ->> 'id') else (to_jsonb(new) ->> 'id') end;
  insert into caixa.auditoria (tabela, registro_id, acao, usuario_id, usuario_nome, antes, depois)
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
  foreach t in array array['lancamentos', 'categorias', 'formas_pagamento', 'configuracoes', 'usuarios'] loop
    execute format('drop trigger if exists auditoria on caixa.%I', t);
    execute format('create trigger auditoria after insert or update or delete on caixa.%I
                    for each row execute function caixa.registra_auditoria()', t);
  end loop;
end $$;

-- 3.6 Cada usuário pode mudar o próprio nome (e só o nome)
create or replace function caixa.atualizar_meu_nome(novo_nome text)
returns void language plpgsql security definer set search_path = caixa as $$
begin
  if length(trim(coalesce(novo_nome, ''))) = 0 then
    raise exception 'Informe um nome.';
  end if;
  update caixa.usuarios set nome = trim(novo_nome) where id = auth.uid();
end $$;

-- ---------------------------------------------------------------------
-- 4. Regras de acesso (Row Level Security)
--    leitura    : vê tudo
--    tesoureiro : vê tudo + inclui/edita/exclui lançamentos
--    admin      : tudo + usuários, categorias, formas, configurações e auditoria
--    inativo / sem login : não vê nada
-- ---------------------------------------------------------------------
alter table caixa.usuarios         enable row level security;
alter table caixa.configuracoes    enable row level security;
alter table caixa.categorias       enable row level security;
alter table caixa.formas_pagamento enable row level security;
alter table caixa.lancamentos      enable row level security;
alter table caixa.auditoria        enable row level security;

drop policy if exists "usuarios: ver" on caixa.usuarios;
create policy "usuarios: ver" on caixa.usuarios for select to authenticated
  using (id = auth.uid() or caixa.usuario_ativo());
drop policy if exists "usuarios: admin altera" on caixa.usuarios;
create policy "usuarios: admin altera" on caixa.usuarios for update to authenticated
  using (caixa.eh_admin()) with check (caixa.eh_admin());

drop policy if exists "config: ver" on caixa.configuracoes;
create policy "config: ver" on caixa.configuracoes for select to authenticated
  using (caixa.usuario_ativo());
drop policy if exists "config: admin altera" on caixa.configuracoes;
create policy "config: admin altera" on caixa.configuracoes for update to authenticated
  using (caixa.eh_admin()) with check (caixa.eh_admin());

drop policy if exists "categorias: ver" on caixa.categorias;
create policy "categorias: ver" on caixa.categorias for select to authenticated
  using (caixa.usuario_ativo());
drop policy if exists "categorias: admin gerencia" on caixa.categorias;
create policy "categorias: admin gerencia" on caixa.categorias for all to authenticated
  using (caixa.eh_admin()) with check (caixa.eh_admin());

drop policy if exists "formas: ver" on caixa.formas_pagamento;
create policy "formas: ver" on caixa.formas_pagamento for select to authenticated
  using (caixa.usuario_ativo());
drop policy if exists "formas: admin gerencia" on caixa.formas_pagamento;
create policy "formas: admin gerencia" on caixa.formas_pagamento for all to authenticated
  using (caixa.eh_admin()) with check (caixa.eh_admin());

drop policy if exists "lancamentos: ver" on caixa.lancamentos;
create policy "lancamentos: ver" on caixa.lancamentos for select to authenticated
  using (caixa.usuario_ativo());
drop policy if exists "lancamentos: incluir" on caixa.lancamentos;
create policy "lancamentos: incluir" on caixa.lancamentos for insert to authenticated
  with check (caixa.pode_editar());
drop policy if exists "lancamentos: alterar" on caixa.lancamentos;
create policy "lancamentos: alterar" on caixa.lancamentos for update to authenticated
  using (caixa.pode_editar()) with check (caixa.pode_editar());
drop policy if exists "lancamentos: excluir" on caixa.lancamentos;
create policy "lancamentos: excluir" on caixa.lancamentos for delete to authenticated
  using (caixa.pode_editar());

drop policy if exists "auditoria: admin ve" on caixa.auditoria;
create policy "auditoria: admin ve" on caixa.auditoria for select to authenticated
  using (caixa.eh_admin());

-- Permissões básicas (o RLS acima é quem filtra de verdade)
revoke all on all tables in schema caixa from anon, public;
grant select, update on caixa.usuarios to authenticated;
grant select, update on caixa.configuracoes to authenticated;
grant select, insert, update, delete on caixa.categorias, caixa.formas_pagamento, caixa.lancamentos to authenticated;
grant select on caixa.auditoria to authenticated;
grant execute on function caixa.atualizar_meu_nome(text) to authenticated;
grant execute on function caixa.registrar_acesso(text) to authenticated;
revoke execute on all functions in schema caixa from anon, public;
grant execute on all functions in schema caixa to authenticated;

-- ---------------------------------------------------------------------
-- 5. Dados iniciais (só inserem se ainda não existirem)
-- ---------------------------------------------------------------------
insert into caixa.configuracoes (id, nome_grupo, saldo_inicial, mes_inicial)
values (1, 'Grupo Kairós', 0, date_trunc('month', now())::date)
on conflict (id) do nothing;

insert into caixa.categorias (tipo, nome, ordem) values
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

insert into caixa.formas_pagamento (nome, ordem) values
  ('Pix', 1), ('Dinheiro', 2), ('Cartão de débito', 3), ('Cartão de crédito', 4),
  ('Boleto', 5), ('Transferência', 6), ('Débito em conta', 7)
on conflict (nome) do nothing;
