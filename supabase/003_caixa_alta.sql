-- =====================================================================
--  Kairós Caixa — 003: textos sempre em CAIXA ALTA
--  Rode depois do 002: SQL Editor > New query > cole tudo > Run.
--  Converte o que já existe e garante maiúsculas em tudo que for gravado.
--  E-mails NÃO são alterados (o login depende deles).
-- =====================================================================

-- Função genérica: coloca em maiúsculas as colunas passadas como argumento do gatilho
create or replace function caixa.caixa_alta()
returns trigger language plpgsql as $$
declare
  col text;
  j   jsonb := to_jsonb(new);
begin
  foreach col in array tg_argv loop
    if jsonb_typeof(j -> col) = 'string' then
      j := jsonb_set(j, array[col], to_jsonb(upper(j ->> col)));
    end if;
  end loop;
  new := jsonb_populate_record(new, j);
  return new;
end $$;

-- Gatilhos (o nome começa com "a_" para rodar antes dos outros gatilhos)
drop trigger if exists a_caixa_alta on caixa.lancamentos;
create trigger a_caixa_alta before insert or update on caixa.lancamentos
  for each row execute function caixa.caixa_alta('descricao', 'observacao');

drop trigger if exists a_caixa_alta on caixa.casais;
create trigger a_caixa_alta before insert or update on caixa.casais
  for each row execute function caixa.caixa_alta('nome', 'esposo', 'esposa', 'observacao');

drop trigger if exists a_caixa_alta on caixa.categorias;
create trigger a_caixa_alta before insert or update on caixa.categorias
  for each row execute function caixa.caixa_alta('nome');

drop trigger if exists a_caixa_alta on caixa.formas_pagamento;
create trigger a_caixa_alta before insert or update on caixa.formas_pagamento
  for each row execute function caixa.caixa_alta('nome');

drop trigger if exists a_caixa_alta on caixa.configuracoes;
create trigger a_caixa_alta before insert or update on caixa.configuracoes
  for each row execute function caixa.caixa_alta('nome_grupo');

drop trigger if exists a_caixa_alta on caixa.usuarios;
create trigger a_caixa_alta before insert or update on caixa.usuarios
  for each row execute function caixa.caixa_alta('nome');

-- Converte os dados que já existem.
-- Durante a conversão, o histórico e a marca de "editado" ficam desligados,
-- para os lançamentos não aparecerem como alterados.
alter table caixa.lancamentos disable trigger valida_lancamento;
alter table caixa.lancamentos disable trigger auditoria;
alter table caixa.casais disable trigger auditoria;
alter table caixa.categorias disable trigger auditoria;
alter table caixa.formas_pagamento disable trigger auditoria;
alter table caixa.configuracoes disable trigger auditoria;
alter table caixa.usuarios disable trigger auditoria;

update caixa.lancamentos set descricao = descricao
  where descricao <> upper(descricao) or coalesce(observacao, '') <> upper(coalesce(observacao, ''));
update caixa.casais set nome = nome
  where nome <> upper(nome) or coalesce(esposo, '') <> upper(coalesce(esposo, ''))
     or coalesce(esposa, '') <> upper(coalesce(esposa, '')) or coalesce(observacao, '') <> upper(coalesce(observacao, ''));
update caixa.categorias set nome = nome where nome <> upper(nome);
update caixa.formas_pagamento set nome = nome where nome <> upper(nome);
update caixa.configuracoes set nome_grupo = nome_grupo where nome_grupo <> upper(nome_grupo);
update caixa.usuarios set nome = nome where nome <> upper(nome);

alter table caixa.lancamentos enable trigger valida_lancamento;
alter table caixa.lancamentos enable trigger auditoria;
alter table caixa.casais enable trigger auditoria;
alter table caixa.categorias enable trigger auditoria;
alter table caixa.formas_pagamento enable trigger auditoria;
alter table caixa.configuracoes enable trigger auditoria;
alter table caixa.usuarios enable trigger auditoria;
