import type { AcidenteSeguranca, RelatoSeguranca } from '@/types'

export interface CamadaPiramide {
  classificacao: string
  total: number
  sif: number
}

/**
 * Agrupa relatos de segurança por classificação — total de relatos + quantos
 * deles são SIF — ordenado do menos frequente pro mais frequente (mesma
 * leitura de uma pirâmide de segurança de verdade: topo estreito/raro, base
 * larga/comum). Não é uma lista fechada de classificações — desenha o que
 * vier nos dados importados (ver `relatos-seguranca-parser.ts`), então uma
 * classificação nova não cadastrada em lugar nenhum ainda assim aparece.
 */
export function agruparPorClassificacao(relatos: RelatoSeguranca[]): CamadaPiramide[] {
  const mapa = new Map<string, { total: number; sif: number }>()
  for (const r of relatos) {
    const atual = mapa.get(r.classificacao) ?? { total: 0, sif: 0 }
    atual.total += 1
    if (ehSifValido(r)) atual.sif += 1
    mapa.set(r.classificacao, atual)
  }
  return Array.from(mapa.entries())
    .map(([classificacao, { total, sif }]) => ({ classificacao, total, sif }))
    .sort((a, b) => a.total - b.total)
}

/**
 * Hierarquia de severidade padrão de segurança do trabalho (do mais grave —
 * topo estreito — pro mais comum — base larga). A pirâmide SEMPRE mostra
 * essas 9 fileiras, mesmo com 0 relato numa delas (ex: nunca teve Fatal) —
 * mesmo padrão de referência do usuário: a forma da pirâmide não muda mês a
 * mês, só os números dentro dela.
 */
const CLASSIFICACOES_PADRAO = [
  'FATAL', 'LTI', 'MDI', 'MTI', 'FAI', 'INCIDENTE', 'ATO INSEGURO', 'CONDIÇÃO INSEGURA', 'ABORDAGEM POSITIVA',
]

/**
 * Monta a pirâmide completa: as 9 fileiras padrão sempre aparecem, na ordem
 * de severidade (zeradas quando não tem relato) — preenchidas com o total/
 * SIF de `camadas` quando a classificação bate. Uma classificação fora
 * dessas 9 (nova, ainda não catalogada) não desaparece — entra depois de
 * todas as conhecidas, ordenada entre si do mais pro menos frequente
 * (aproximação razoável: sem saber a severidade real, pelo menos mantém
 * "mais raro primeiro").
 */
export function ordenarPorSeveridade(camadas: CamadaPiramide[]): CamadaPiramide[] {
  const porClassificacao = new Map(camadas.map(c => [c.classificacao, c]))
  const conhecidas = CLASSIFICACOES_PADRAO.map(classificacao => porClassificacao.get(classificacao) ?? { classificacao, total: 0, sif: 0 })
  const desconhecidas = camadas
    .filter(c => !CLASSIFICACOES_PADRAO.includes(c.classificacao))
    .sort((a, b) => b.total - a.total)
  return [...conhecidas, ...desconhecidas]
}

export interface RelatosDoMes {
  mes: number
  porClassificacao: Map<string, number>
  total: number
}

/**
 * Quebra os relatos por mês (mesInicial..mesFinal, inclusive) — pra montar a
 * grade de colunas mensais ao lado da pirâmide (uma coluna por mês, uma
 * célula por classificação, alinhada com a fileira correspondente da
 * pirâmide, + total do mês embaixo).
 */
export function agruparPorMes(relatos: RelatoSeguranca[], mesInicial: number, mesFinal: number): RelatosDoMes[] {
  const porMes: RelatosDoMes[] = []
  for (let m = mesInicial; m <= mesFinal; m++) {
    const doMes = relatos.filter(r => r.mes === m)
    const porClassificacao = new Map<string, number>()
    for (const r of doMes) porClassificacao.set(r.classificacao, (porClassificacao.get(r.classificacao) ?? 0) + 1)
    porMes.push({ mes: m, porClassificacao, total: doMes.length })
  }
  return porMes
}

/**
 * Valores da coluna SIF (`sif_tipo`) que contam como SIF de verdade pros
 * cards/tabela da Pirâmide — pedido explícito do usuário: "SIF POTENCIAL" e
 * "SIF PRECURSOR" contam (as duas grafias — "SIF PERCUSOR"/"SIF PRECURSOR" —
 * aceitas, os relatórios RELATOS e ACIDENTES escrevem diferente), outros
 * valores que a coluna SIF possa ter (além de "NÃO"/"NOT SIF") não.
 */
export const SIF_TIPOS_VALIDOS = ['SIF PERCUSOR', 'SIF PRECURSOR', 'SIF POTENCIAL']

function ehSifValido(relato: RelatoSeguranca): boolean {
  return relato.sif_tipo !== null && SIF_TIPOS_VALIDOS.includes(relato.sif_tipo)
}

/** FATAL sempre entra na tabela de eventos, mesmo sem marcação SIF nenhuma — pedido explícito do usuário. */
const CLASSIFICACAO_SEMPRE_LISTADA = 'FATAL'

/**
 * Classificações que só entram na TABELA de eventos abaixo da pirâmide
 * quando TAMBÉM são SIF válido (`ehSifValido`) — pedido explícito do
 * usuário: Incidente, LTI, MDI, FAI, MTI (sem Fatal, que já entra sozinho —
 * ver `CLASSIFICACAO_SEMPRE_LISTADA`). Um SIF marcado numa Abordagem
 * Positiva, Ato Inseguro ou Condição Insegura não entra na tabela, só polui
 * a apresentação. Os CARDS de SIF (`contarSif`), por outro lado, contam
 * qualquer classificação — essa lista vale só pra tabela. Regra do
 * relatório RELATOS (`origem` undefined/'relato') — o relatório ACIDENTES
 * tem regra própria, ver `ehEventoGraveAcidente`.
 */
export const CLASSIFICACOES_SIF_VALIDO = ['LTI', 'MDI', 'MTI', 'FAI', 'INCIDENTE']

/** Quantos relatos da lista são SIF válido (`ehSifValido` — "SIF PERCUSOR"/"SIF PRECURSOR"/"SIF POTENCIAL"), em qualquer classificação — usado nos cards "SIF do mês"/"SIF acumulado". Conta as duas origens (RELATOS e ACIDENTES) igual. */
export function contarSif(relatos: RelatoSeguranca[]): number {
  return relatos.filter(ehSifValido).length
}

/**
 * Regra de "entra na lista de eventos graves" pra uma linha vinda do
 * relatório ACIDENTES (`origem === 'acidente'`) — diferente da regra do
 * RELATOS: INCIDENTE só entra com SIF POTENCIAL (SIF Precursor não conta
 * pra isso, só pro card); qualquer outra classificação (FAI, MTI, MDI, LTI,
 * FATAL/LTI FATL...) entra sempre, sem precisar de SIF nenhum — pedido
 * explícito do usuário.
 */
function ehEventoGraveAcidente(relato: RelatoSeguranca): boolean {
  if (relato.classificacao === 'INCIDENTE') return relato.sif_tipo === 'SIF POTENCIAL'
  return true
}

/**
 * Relatos de um mês específico que merecem uma tabela de detalhe abaixo da
 * pirâmide — a regra depende da origem da linha (ver `RelatoSeguranca.origem`):
 * RELATOS (padrão): classificação FATAL (sempre, mesmo sem SIF) OU
 * classificação em `CLASSIFICACOES_SIF_VALIDO` que também seja SIF válido
 * (`ehSifValido`). ACIDENTES: ver `ehEventoGraveAcidente`. Ordenados do
 * mais recente pro mais antigo.
 */
export function eventosGraves(relatos: RelatoSeguranca[], mes: number): RelatoSeguranca[] {
  return relatos
    .filter(r => r.mes === mes && (
      r.origem === 'acidente'
        ? ehEventoGraveAcidente(r)
        : (r.classificacao === CLASSIFICACAO_SEMPRE_LISTADA || (CLASSIFICACOES_SIF_VALIDO.includes(r.classificacao) && ehSifValido(r)))
    ))
    .sort((a, b) => b.data_ocorrencia.localeCompare(a.data_ocorrencia))
}

/**
 * "INCIDENTES" (plural, como a planilha ACIDENTES escreve) precisa virar
 * "INCIDENTE" (singular) pra somar na mesma fileira da pirâmide que o
 * relatório RELATOS já usa — senão vira uma 10ª fileira nova em vez de somar
 * na existente. "LTI FATL"/"LDI FATL" (as duas grafias vistas) vira "FATAL"
 * — é a camada mais grave da pirâmide, mesmo vindo com esse código no
 * relatório de Acidentes. Qualquer outro valor (FAI, LTI, MTI, MDI) já bate
 * direto com a classificação padrão, sem precisar traduzir.
 */
function normalizarClassificacaoAcidente(tipo: string): string {
  const t = tipo.trim().toUpperCase()
  if (t === 'INCIDENTES') return 'INCIDENTE'
  if (t === 'LTI FATL' || t === 'LDI FATL') return 'FATAL'
  return t
}

/**
 * Converte uma linha de `acidentes_seguranca` (migration 134) pro mesmo
 * formato de `RelatoSeguranca`, pra poder somar na pirâmide reaproveitando
 * `agruparPorClassificacao`/`agruparPorMes`/`contarSif`/`eventosGraves` —
 * só esses quatro já sabem lidar com as duas origens juntas. `relato_id`
 * usa o próprio `numero_credit` (espaço numérico bem maior que o ID do
 * RELATOS, risco de colisão desprezível) só pra servir de key/identificador
 * em memória — nunca grava em `relatos_seguranca`.
 */
export function acidenteParaRelato(acidente: AcidenteSeguranca): RelatoSeguranca {
  return {
    relato_id: acidente.numero_credit,
    unidade: acidente.unidade,
    data_ocorrencia: acidente.data_ocorrencia,
    ano: acidente.ano,
    mes: acidente.mes,
    classificacao: normalizarClassificacaoAcidente(acidente.tipo),
    sif: acidente.sif,
    sif_tipo: acidente.sif_tipo,
    tipo_relato: null,
    detalhamento: acidente.ocorrencia,
    origem: 'acidente',
  }
}
