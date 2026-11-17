-- Migration 134: Acidentes de Segurança — segundo relatório que o GInfo
-- passou a exportar (além do RELATOS/GSDPQ, migration 115), com os
-- acidentes de verdade (Incidente, FAI, LTI, MTI, MDI, LTI Fatal...), que
-- precisa somar na mesma Pirâmide de Segurança do SDG Gerentes. Fica numa
-- tabela separada (não mistura com `relatos_seguranca`) porque a regra de
-- "quando entra na lista de eventos graves" é diferente pra esse relatório
-- (ver `piramide-seguranca.ts`/`acidentes-seguranca-parser.ts`) — o merge
-- com os relatos de sempre acontece em memória, na tela.
--
-- `numero_credit` é o ID único da linha na planilha de origem (coluna
-- "NÚMERO CREDIT") — chave de upsert, reimportar não duplica.
--
-- Mesmo nível de acesso do resto do SDG Gerentes/relatos_seguranca:
-- qualquer admin lê/escreve tudo; usuário de unidade só a própria.
--
-- Rodar no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS acidentes_seguranca (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_credit   bigint NOT NULL UNIQUE,
  unidade         text NOT NULL REFERENCES unidades(codigo),
  data_ocorrencia date NOT NULL,
  ano             int NOT NULL,
  mes             int NOT NULL CHECK (mes BETWEEN 1 AND 12),
  tipo            text NOT NULL, -- valor cru da coluna TIPO (ex: "INCIDENTES", "FAI", "LTI")
  sif             boolean NOT NULL DEFAULT false,
  sif_tipo        text, -- valor cru da coluna SIF quando é SIF (ex: "SIF POTENCIAL", "SIF PRECURSOR") — null quando "NOT SIF"
  colaborador     text,
  funcao          text,
  ato             text,
  ocorrencia      text, -- texto livre da coluna OCORRENCIA — mesmo papel do "detalhamento" dos relatos
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_acidentes_seguranca_busca ON acidentes_seguranca(unidade, ano, mes);

ALTER TABLE acidentes_seguranca ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leitura_acidentes_seguranca" ON acidentes_seguranca;
CREATE POLICY "leitura_acidentes_seguranca" ON acidentes_seguranca
  FOR SELECT TO authenticated
  USING (auth_role() = 'admin' OR unidade = auth_unidade());

DROP POLICY IF EXISTS "escrita_acidentes_seguranca" ON acidentes_seguranca;
CREATE POLICY "escrita_acidentes_seguranca" ON acidentes_seguranca
  FOR INSERT TO authenticated
  WITH CHECK (auth_role() = 'admin' OR unidade = auth_unidade());

DROP POLICY IF EXISTS "atualiza_acidentes_seguranca" ON acidentes_seguranca;
CREATE POLICY "atualiza_acidentes_seguranca" ON acidentes_seguranca
  FOR UPDATE TO authenticated
  USING (auth_role() = 'admin' OR unidade = auth_unidade())
  WITH CHECK (auth_role() = 'admin' OR unidade = auth_unidade());

DROP POLICY IF EXISTS "remocao_acidentes_seguranca" ON acidentes_seguranca;
CREATE POLICY "remocao_acidentes_seguranca" ON acidentes_seguranca
  FOR DELETE TO authenticated
  USING (auth_role() = 'admin' OR unidade = auth_unidade());

DROP TRIGGER IF EXISTS trg_acidentes_seguranca_updated_at ON acidentes_seguranca;
CREATE TRIGGER trg_acidentes_seguranca_updated_at
  BEFORE UPDATE ON acidentes_seguranca FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
