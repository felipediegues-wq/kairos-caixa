-- =====================================================================
--  Kairós Caixa — 002: Casais (membros), mensalidades e devedores
--  Rode DEPOIS do schema.sql: SQL Editor > New query > cole tudo > Run.
--  Pode rodar de novo sem perder dados.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tabelas e colunas novas
-- ---------------------------------------------------------------------
create table if not exists caixa.casais (
  id           bigint generated always as identity primary key,
  nome         text not null check (length(trim(nome)) > 0),   -- ex.: "João e Maria Silva"
  esposo       text,
  esposa       text,
  telefone     text,
  email        text,
  funcao       text not null default 'membro'
               check (funcao in ('coordenador', 'vice_coordenador', 'secretario', 'financeiro', 'boa_vontade', 'membro')),
  mes_entrada  date not null default date_trunc('month', now())::date,  -- passa a dever a partir deste mês
  mes_saida    date,                                                    -- preenchido quando sai do grupo
  observacao   text,
  criado_em    timestamptz not null default now(),
  check (mes_saida is null or mes_saida >= mes_entrada)
);
comment on table caixa.casais is 'Casais (membros) do grupo. funcao: coordenador | vice_coordenador | secretario | financeiro | boa_vontade | membro';

-- Valor da mensalidade com vigência (o valor vale a partir do mês informado)
create table if not exists caixa.mensalidade_valores (
  id             bigint generated always as identity primary key,
  vigente_desde  date not null unique,
  valor          numeric(12, 2) not null check (valor >= 0)
);

-- Login do sistema ligado a um casal (define quem vê o relatório de devedores)
alter table caixa.usuarios add column if not exists casal_id bigint references caixa.casais (id) on delete set null;

-- Categoria marcada como "mensalidade" exige casal e mês de referência
alter table caixa.categorias add column if not exists mensalidade boolean not null default false;
do $$ begin
  alter table caixa.categorias add constraint categorias_mensalidade_entrada check (not mensalidade or tipo = 'Entrada');
exception when duplicate_object then null; end $$;

alter table caixa.lancamentos add column if not exists casal_id bigint references caixa.casais (id);
alter table caixa.lancamentos add column if not exists competencia date;   -- mês a que o pagamento se refere
create index if not exists lancamentos_casal_idx on caixa.lancamentos (casal_id, competencia);

-- ---------------------------------------------------------------------
-- 2. Permissão do relatório de devedores
--    Casal coordenador, casal secretário (pelo login ligado ao casal) e o admin.
-- ---------------------------------------------------------------------
create or replace function caixa.pode_ver_devedores()
returns boolean language sql stable security definer set search_path = caixa as $$
  select coalesce(
    caixa.eh_admin()
    or exists (
      select 1 from caixa.usuarios u
      join caixa.casais c on c.id = u.casal_id
      where u.id = auth.uid() and u.ativo
        and c.mes_saida is null
        and c.funcao in ('coordenador', 'secretario')
    ), false)
$$;

-- ---------------------------------------------------------------------
-- 3. Gatilhos
-- ---------------------------------------------------------------------
-- Casais: meses sempre no dia 1
create or replace function caixa.ajusta_casal()
returns trigger language plpgsql as $$
begin
  new.mes_entrada := date_trunc('month', new.mes_entrada)::date;
  if new.mes_saida is not null then
    new.mes_saida := date_trunc('month', new.mes_saida)::date;
  end if;
  new.nome := trim(new.nome);
  return new;
end $$;
drop trigger if exists ajusta_casal on caixa.casais;
create trigger ajusta_casal before insert or update on caixa.casais
  for each row execute function caixa.ajusta_casal();

create or replace function caixa.ajusta_mensalidade_valor()
returns trigger language plpgsql as $$
begin
  new.vigente_desde := date_trunc('month', new.vigente_desde)::date;
  return new;
end $$;
drop trigger if exists ajusta_mensalidade_valor on caixa.mensalidade_valores;
create trigger ajusta_mensalidade_valor before insert or update on caixa.mensalidade_valores
  for each row execute function caixa.ajusta_mensalidade_valor();

-- Lançamentos: agora também valida mensalidade (casal + mês de referência)
create or replace function caixa.valida_lancamento()
returns trigger language plpgsql security definer set search_path = caixa as $$
declare
  tipo_cat text;
  eh_mens  boolean;
begin
  select tipo, mensalidade into tipo_cat, eh_mens from caixa.categorias where id = new.categoria_id;
  if tipo_cat is null then
    raise exception 'Categoria inexistente.';
  end if;
  if tipo_cat <> new.tipo then
    raise exception 'A categoria escolhida é de %, mas o lançamento é de %.', tipo_cat, new.tipo;
  end if;
  if eh_mens then
    if new.casal_id is null or new.competencia is null then
      raise exception 'Mensalidade precisa do casal e do mês de referência.';
    end if;
    new.competencia := date_trunc('month', new.competencia)::date;
  else
    new.casal_id := null;
    new.competencia := null;
  end if;
  if tg_op = 'INSERT' then
    new.criado_por := coalesce(new.criado_por, auth.uid());
    new.criado_em := now();
  else
    new.criado_por := old.criado_por;
    new.criado_em := old.criado_em;
    new.atualizado_por := auth.uid();
    new.atualizado_em := now();
  end if;
  return new;
end $$;

-- Auditoria nas tabelas novas
do $$
declare t text;
begin
  foreach t in array array['casais', 'mensalidade_valores'] loop
    execute format('drop trigger if exists auditoria on caixa.%I', t);
    execute format('create trigger auditoria after insert or update or delete on caixa.%I
                    for each row execute function caixa.registra_auditoria()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 4. Relatório de mensalidades (só para quem pode ver devedores)
--    Uma linha por casal e por mês devido: valor esperado x valor pago.
-- ---------------------------------------------------------------------
create or replace function caixa.relatorio_mensalidades(p_ate date default null)
returns table (casal_id bigint, casal text, funcao text, mes date, esperado numeric, pago numeric)
language plpgsql stable security definer set search_path = caixa as $$
declare
  v_ate date := date_trunc('month', coalesce(p_ate, (now() at time zone 'America/Sao_Paulo')::date))::date;
begin
  if not caixa.pode_ver_devedores() then
    raise exception 'Somente o casal coordenador, o casal secretário e o administrador podem ver o relatório de devedores.';
  end if;
  return query
  with meses as (
    select c.id as cid, c.nome, c.funcao, gs::date as m
    from caixa.casais c
    cross join lateral generate_series(c.mes_entrada, least(v_ate, coalesce(c.mes_saida, v_ate)), interval '1 month') gs
  ),
  pagos as (
    select l.casal_id as cid, l.competencia as m, sum(l.valor) as total
    from caixa.lancamentos l
    join caixa.categorias k on k.id = l.categoria_id and k.mensalidade
    where l.casal_id is not null
    group by 1, 2
  )
  select me.cid, me.nome, me.funcao, me.m,
         coalesce((select v.valor from caixa.mensalidade_valores v
                   where v.vigente_desde <= me.m order by v.vigente_desde desc limit 1), 0)::numeric,
         coalesce(p.total, 0)::numeric
  from meses me
  left join pagos p on p.cid = me.cid and p.m = me.m
  order by me.nome, me.m;
end $$;

-- ---------------------------------------------------------------------
-- 5. Regras de acesso
-- ---------------------------------------------------------------------
alter table caixa.casais enable row level security;
alter table caixa.mensalidade_valores enable row level security;

drop policy if exists "casais: ver" on caixa.casais;
create policy "casais: ver" on caixa.casais for select to authenticated
  using (caixa.usuario_ativo());
-- quem cadastra casais: admin, casal coordenador e casal secretário
drop policy if exists "casais: gerenciar" on caixa.casais;
create policy "casais: gerenciar" on caixa.casais for all to authenticated
  using (caixa.pode_ver_devedores()) with check (caixa.pode_ver_devedores());

drop policy if exists "mensalidade: ver" on caixa.mensalidade_valores;
create policy "mensalidade: ver" on caixa.mensalidade_valores for select to authenticated
  using (caixa.usuario_ativo());
drop policy if exists "mensalidade: admin gerencia" on caixa.mensalidade_valores;
create policy "mensalidade: admin gerencia" on caixa.mensalidade_valores for all to authenticated
  using (caixa.eh_admin()) with check (caixa.eh_admin());

revoke all on caixa.casais, caixa.mensalidade_valores from anon, public;
grant select, insert, update, delete on caixa.casais, caixa.mensalidade_valores to authenticated;
revoke execute on all functions in schema caixa from anon, public;
grant execute on all functions in schema caixa to authenticated;

-- ---------------------------------------------------------------------
-- 6. Dados iniciais
-- ---------------------------------------------------------------------
insert into caixa.categorias (tipo, nome, ordem, mensalidade)
values ('Entrada', 'Mensalidades', 0, true)
on conflict (tipo, nome) do update set mensalidade = true;
