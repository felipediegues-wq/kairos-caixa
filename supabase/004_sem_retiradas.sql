-- =====================================================================
--  Kairós Caixa — 004: fim do tipo "Retirada" (só Entrada e Saída)
--  Rode depois do 003: SQL Editor > New query > cole tudo > Run.
--  - Categorias de Retirada viram categorias de Saída
--  - Lançamentos de Retirada viram Saída (sem marcar como "editado")
--  - A partir daqui o banco só aceita Entrada e Saída
--  Pode rodar de novo sem problema.
-- =====================================================================

-- Se já existir uma categoria de Saída com o mesmo nome de uma de Retirada,
-- os lançamentos passam para ela e a de Retirada é apagada.
update caixa.lancamentos l
   set categoria_id = s.id
  from caixa.categorias r
  join caixa.categorias s on s.tipo = 'Saída' and upper(s.nome) = upper(r.nome)
 where r.tipo = 'Retirada' and l.categoria_id = r.id;
delete from caixa.categorias r
 where r.tipo = 'Retirada'
   and exists (select 1 from caixa.categorias s where s.tipo = 'Saída' and upper(s.nome) = upper(r.nome));

-- Desliga histórico e marca de "editado" só durante a conversão
alter table caixa.lancamentos disable trigger valida_lancamento;
alter table caixa.lancamentos disable trigger auditoria;
alter table caixa.categorias disable trigger auditoria;

-- Categorias de Retirada passam para o fim da lista de Saída
update caixa.categorias
   set tipo = 'Saída',
       ordem = ordem + coalesce((select max(ordem) from caixa.categorias where tipo = 'Saída'), 0)
 where tipo = 'Retirada';

update caixa.lancamentos set tipo = 'Saída' where tipo = 'Retirada';

alter table caixa.lancamentos enable trigger valida_lancamento;
alter table caixa.lancamentos enable trigger auditoria;
alter table caixa.categorias enable trigger auditoria;

-- Daqui para frente: só Entrada e Saída
alter table caixa.lancamentos drop constraint if exists lancamentos_tipo_check;
alter table caixa.lancamentos add constraint lancamentos_tipo_check check (tipo in ('Entrada', 'Saída'));
alter table caixa.categorias drop constraint if exists categorias_tipo_check;
alter table caixa.categorias add constraint categorias_tipo_check check (tipo in ('Entrada', 'Saída'));
