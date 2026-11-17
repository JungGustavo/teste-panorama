-- Migration 133: negócio em planos_acao.
--
-- Unidades com 2 gerentes reais (Camaçari: CDL=Rota, CDR=Armazém; Ponta
-- Grossa: Empurrada/Armazém) precisam marcar uma ação do Plano de Ação como
-- sendo de um negócio específico (ex: só do CDR) — até agora toda ação era
-- só por unidade, sem distinção. Ações já existentes ficam 'CONS' (visíveis
-- pros dois negócios, comportamento de sempre); quem quiser marcar uma ação
-- específica edita e escolhe o negócio certo a partir de agora.
--
-- Rodar no SQL Editor do Supabase.

ALTER TABLE planos_acao ADD COLUMN IF NOT EXISTS negocio text NOT NULL DEFAULT 'CONS';

NOTIFY pgrst, 'reload schema';
