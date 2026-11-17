import * as XLSX from 'xlsx'
import { resolverUnidadeFlexivel } from '@/lib/unidade-resolver'
import type { Unidade } from '@/types'

/** Linha pronta pra gravar em `acidentes_seguranca` — unidade já resolvida (codigo). */
export interface ParsedAcidenteSeguranca {
  numero_credit: number
  unidade: string
  data_ocorrencia: string // 'YYYY-MM-DD'
  ano: number
  mes: number
  tipo: string
  sif: boolean
  /** Texto original da coluna SIF (ex: "SIF POTENCIAL"/"SIF PRECURSOR") — null quando "NOT SIF"/vazio. */
  sif_tipo: string | null
  colaborador: string | null
  funcao: string | null
  ato: string | null
  ocorrencia: string | null
}

export interface ParseAcidentesResultado {
  linhas: ParsedAcidenteSeguranca[]
  erros: string[]
  unidadesNaoReconhecidas: string[]
}

function normalizar(texto: string): string {
  return texto.trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function toStr(v: unknown): string {
  return String(v ?? '').trim()
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Hash determinístico simples (djb2) de uma string — base pra sintetizar um
 * `numero_credit` estável quando a planilha não traz um válido (ver
 * `numeroCreditDaLinha` abaixo). Mesmo texto sempre vira o mesmo número, então
 * reimportar o mesmo arquivo continua fazendo upsert (não duplica).
 */
function hashDjb2(texto: string): number {
  let hash = 5381
  for (let i = 0; i < texto.length; i++) {
    hash = ((hash << 5) + hash + texto.charCodeAt(i)) >>> 0 // hash*33 + c, 32 bits sem sinal
  }
  return hash
}

/**
 * O GInfo nem sempre preenche "NÚMERO CREDIT" (vem vazio, ou às vezes
 * literalmente o texto "GINFO") — não é erro de planilha, é assim que o
 * próprio relatório exporta em algumas linhas. Quando não dá pra usar o
 * número da planilha, sintetiza um a partir do resto da linha (unidade
 * resolvida + data + tipo + colaborador + ocorrência) — negativo, pra nunca
 * colidir com um NÚMERO CREDIT de verdade (sempre positivo na planilha).
 */
function numeroCreditDaLinha(bruto: string, unidadeCodigo: string, dataIso: string, tipo: string, colaborador: string, ocorrencia: string): number {
  const valido = Number(bruto)
  if (bruto !== '' && Number.isInteger(valido)) return valido
  const chave = [unidadeCodigo, dataIso, tipo, colaborador, ocorrencia].join('|')
  return -hashDjb2(chave)
}

/** "DATA" vem como "29/10/2026" (texto) ou `Date` (célula tipada). */
function parseData(raw: unknown): { iso: string; ano: number; mes: number } | null {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return { iso: `${raw.getFullYear()}-${pad2(raw.getMonth() + 1)}-${pad2(raw.getDate())}`, ano: raw.getFullYear(), mes: raw.getMonth() + 1 }
  }
  const str = toStr(raw)
  const match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (!match) return null
  const dia = Number(match[1])
  const mes = Number(match[2])
  const ano = Number(match[3])
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null
  return { iso: `${ano}-${pad2(mes)}-${pad2(dia)}`, ano, mes }
}

const HEADERS = {
  numeroCredit: 'NÚMERO CREDIT',
  filial: 'FILIAL',
  data: 'DATA',
  tipo: 'TIPO',
  sif: 'SIF',
  colaborador: 'COLABORADOR',
  funcao: 'FUNCAO',
  ato: 'ATO',
  ocorrencia: 'OCORRENCIA',
}

/** Valores da coluna SIF que significam "não é SIF" — qualquer outro valor preenchido (ex: "SIF POTENCIAL", "SIF PRECURSOR") é um SIF de verdade. */
const SIF_NEGATIVOS = ['NOT SIF', 'NAO', 'NÃO']

/**
 * Planilha "ACIDENTES" (segundo relatório do GInfo, além do RELATOS/GSDPQ —
 * ver `relatos-seguranca-parser.ts`) — colunas usadas: NÚMERO CREDIT (chave
 * de upsert — nem sempre vem preenchida com um número de verdade, o GInfo às
 * vezes deixa vazio ou escreve literalmente "GINFO"; quando isso acontece,
 * `numeroCreditDaLinha` sintetiza uma chave estável a partir do resto da
 * linha, em vez de rejeitar), FILIAL (texto livre tipo "CDD DIADEMA" —
 * resolvido pra unidade via `resolverUnidadeFlexivel`, tolera variações de
 * prefixo), DATA
 * (define ano/mês — a coluna MES da planilha, só com o nome do mês por
 * extenso, é ignorada: a DATA já traz ano+mês confiável), TIPO (Incidente,
 * FAI, LTI, MTI, MDI... não é lista fechada, vira uma "fileira" da pirâmide
 * depois de normalizada — ver `acidenteParaRelato` em piramide-seguranca.ts)
 * e SIF ("NOT SIF"/"NÃO"/vazio = não é SIF; "SIF POTENCIAL"/"SIF PRECURSOR"
 * = é, o texto original fica em `sif_tipo`). COLABORADOR/FUNCAO/ATO/
 * OCORRENCIA são guardados pra contexto na lista de eventos graves (ver
 * SlidePiramideSeguranca). Demais colunas da planilha real (projeto, local,
 * matriz de risco etc.) não são usadas nessa primeira leva.
 */
export function parseAcidentesSegurancaMatriz(matriz: unknown[][], unidades: Unidade[]): ParseAcidentesResultado {
  if (matriz.length === 0) return { linhas: [], erros: [], unidadesNaoReconhecidas: [] }

  const header = matriz[0].map(c => normalizar(toStr(c)))
  const idx = (nome: string) => header.findIndex(h => h === normalizar(nome))
  const iNumeroCredit = idx(HEADERS.numeroCredit)
  const iFilial = idx(HEADERS.filial)
  const iData = idx(HEADERS.data)
  const iTipo = idx(HEADERS.tipo)
  const iSif = idx(HEADERS.sif)
  const iColaborador = idx(HEADERS.colaborador)
  const iFuncao = idx(HEADERS.funcao)
  const iAto = idx(HEADERS.ato)
  const iOcorrencia = idx(HEADERS.ocorrencia)

  if (iNumeroCredit === -1 || iFilial === -1 || iData === -1 || iTipo === -1) {
    return {
      linhas: [], erros: ['Cabeçalho inválido — esperado pelo menos as colunas NÚMERO CREDIT, FILIAL, DATA e TIPO'],
      unidadesNaoReconhecidas: [],
    }
  }

  const linhas: ParsedAcidenteSeguranca[] = []
  const erros: string[] = []
  const unidadesNaoReconhecidas = new Set<string>()

  for (let i = 1; i < matriz.length; i++) {
    const cols = matriz[i]
    if (cols.every(c => toStr(c) === '')) continue

    const dataParsed = parseData(cols[iData])
    if (!dataParsed) {
      erros.push(`Linha ${i + 1}: data inválida em "${HEADERS.data}" ("${toStr(cols[iData])}")`)
      continue
    }

    const filialTexto = toStr(cols[iFilial])
    const unidade = resolverUnidadeFlexivel(filialTexto, unidades)
    if (!unidade) {
      unidadesNaoReconhecidas.add(filialTexto)
      continue
    }

    const tipo = toStr(cols[iTipo]).toUpperCase()
    if (!tipo) {
      erros.push(`Linha ${i + 1}: sem "${HEADERS.tipo}" preenchido`)
      continue
    }

    const sifTexto = iSif !== -1 ? toStr(cols[iSif]).toUpperCase() : ''
    const sif = sifTexto !== '' && !SIF_NEGATIVOS.includes(sifTexto)
    const colaborador = iColaborador !== -1 ? toStr(cols[iColaborador]) : ''
    const ocorrencia = iOcorrencia !== -1 ? toStr(cols[iOcorrencia]) : ''
    const numeroCredit = numeroCreditDaLinha(toStr(cols[iNumeroCredit]), unidade.codigo, dataParsed.iso, tipo, colaborador, ocorrencia)

    linhas.push({
      numero_credit: numeroCredit,
      unidade: unidade.codigo,
      data_ocorrencia: dataParsed.iso,
      ano: dataParsed.ano,
      mes: dataParsed.mes,
      tipo,
      sif,
      sif_tipo: sif ? sifTexto : null,
      colaborador: colaborador || null,
      funcao: iFuncao !== -1 ? (toStr(cols[iFuncao]) || null) : null,
      ato: iAto !== -1 ? (toStr(cols[iAto]) || null) : null,
      ocorrencia: ocorrencia || null,
    })
  }

  // O GInfo às vezes repete a mesma linha (mesmo NÚMERO CREDIT) mais de uma
  // vez na própria exportação — upsert com duas linhas de mesma chave NO
  // MESMO lote dá erro no Postgres ("ON CONFLICT DO UPDATE command cannot
  // affect row a second time"). Mantém só a última ocorrência de cada chave.
  const semDuplicadas = Array.from(new Map(linhas.map(l => [l.numero_credit, l])).values())

  return { linhas: semDuplicadas, erros, unidadesNaoReconhecidas: Array.from(unidadesNaoReconhecidas).sort() }
}

/** Lê a planilha Excel (.xlsx/.xls) — aba "ACIDENTES" se existir, senão a primeira. */
export async function parseAcidentesSegurancaXlsx(file: File, unidades: Unidade[]): Promise<ParseAcidentesResultado> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  const nomeAba = wb.SheetNames.includes('ACIDENTES') ? 'ACIDENTES' : wb.SheetNames[0]
  const sheet = wb.Sheets[nomeAba]
  if (!sheet) return { linhas: [], erros: ['Arquivo Excel sem abas'], unidadesNaoReconhecidas: [] }
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
  return parseAcidentesSegurancaMatriz(matriz, unidades)
}
