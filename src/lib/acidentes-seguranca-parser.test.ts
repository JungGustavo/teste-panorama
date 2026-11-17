import { describe, expect, it } from 'vitest'
import { parseAcidentesSegurancaMatriz } from './acidentes-seguranca-parser'
import type { Unidade } from '@/types'

const HEADER = ['NÚMERO CREDIT', 'FILIAL', 'DATA', 'TIPO', 'SIF', 'COLABORADOR', 'FUNCAO', 'ATO', 'OCORRENCIA']

const DIADEMA: Unidade = { id: '1', codigo: 'DIADEMA', nome: 'Diadema', nome_ginfo: null, data_entrada: null, apelidos: null }
const unidades = [DIADEMA]

describe('parseAcidentesSegurancaMatriz', () => {
  it('extrai um acidente completo, resolvendo a unidade a partir do texto "CDD <cidade>"', () => {
    const matriz = [
      HEADER,
      [3575404118, 'CDD DIADEMA', '29/10/2026', 'INCIDENTES', 'SIF POTENCIAL', 'Fulano de Tal', 'MOTORISTA', 'ASSALTO OU TENTATIVA', 'Relato da ocorrência'],
    ]
    const { linhas, erros, unidadesNaoReconhecidas } = parseAcidentesSegurancaMatriz(matriz, unidades)
    expect(erros).toEqual([])
    expect(unidadesNaoReconhecidas).toEqual([])
    expect(linhas).toEqual([{
      numero_credit: 3575404118, unidade: 'DIADEMA', data_ocorrencia: '2026-10-29', ano: 2026, mes: 10,
      tipo: 'INCIDENTES', sif: true, sif_tipo: 'SIF POTENCIAL',
      colaborador: 'Fulano de Tal', funcao: 'MOTORISTA', ato: 'ASSALTO OU TENTATIVA', ocorrencia: 'Relato da ocorrência',
    }])
  })

  it('SIF: "NOT SIF"/"NÃO" (com ou sem acento) vira false/null, qualquer outro valor preenchido vira true + guarda o texto original (maiúsculo) em sif_tipo', () => {
    function sifDe(valorSif: string): { sif: boolean; sif_tipo: string | null } {
      const matriz = [HEADER, [1, 'CDD DIADEMA', '01/01/2026', 'FAI', valorSif, '', '', '', '']]
      const linha = parseAcidentesSegurancaMatriz(matriz, unidades).linhas[0]
      return { sif: linha.sif, sif_tipo: linha.sif_tipo }
    }
    expect(sifDe('NOT SIF')).toEqual({ sif: false, sif_tipo: null })
    expect(sifDe('NÃO')).toEqual({ sif: false, sif_tipo: null })
    expect(sifDe('NAO')).toEqual({ sif: false, sif_tipo: null })
    expect(sifDe('sif precursor')).toEqual({ sif: true, sif_tipo: 'SIF PRECURSOR' })
    expect(sifDe('Sif Potencial')).toEqual({ sif: true, sif_tipo: 'SIF POTENCIAL' })
  })

  it('unidade não reconhecida entra em unidadesNaoReconhecidas, sem derrubar o resto do arquivo', () => {
    const matriz = [
      HEADER,
      [1, 'CDD LUGAR NENHUM', '01/01/2026', 'FAI', 'NOT SIF', '', '', '', ''],
      [2, 'CDD DIADEMA', '01/01/2026', 'FAI', 'NOT SIF', '', '', '', ''],
    ]
    const { linhas, unidadesNaoReconhecidas } = parseAcidentesSegurancaMatriz(matriz, unidades)
    expect(linhas).toHaveLength(1)
    expect(unidadesNaoReconhecidas).toEqual(['CDD LUGAR NENHUM'])
  })

  it('data inválida vira erro, sem derrubar o resto do arquivo', () => {
    const matriz = [
      HEADER,
      [1, 'CDD DIADEMA', 'data-invalida', 'FAI', 'NOT SIF', '', '', '', ''],
      [2, 'CDD DIADEMA', '01/01/2026', 'FAI', 'NOT SIF', '', '', '', ''],
    ]
    const { linhas, erros } = parseAcidentesSegurancaMatriz(matriz, unidades)
    expect(linhas).toHaveLength(1)
    expect(erros).toHaveLength(1)
  })

  it('aceita data como objeto Date (planilha com célula tipada)', () => {
    const matriz = [HEADER, [1, 'CDD DIADEMA', new Date(2026, 9, 29), 'FAI', 'NOT SIF', '', '', '', '']]
    const { linhas } = parseAcidentesSegurancaMatriz(matriz, unidades)
    expect(linhas[0]).toMatchObject({ data_ocorrencia: '2026-10-29', ano: 2026, mes: 10 })
  })

  it('sem TIPO preenchido vira erro', () => {
    const matriz = [HEADER, [1, 'CDD DIADEMA', '01/01/2026', '', 'NOT SIF', '', '', '', '']]
    const { linhas, erros } = parseAcidentesSegurancaMatriz(matriz, unidades)
    expect(linhas).toHaveLength(0)
    expect(erros).toHaveLength(1)
  })

  it('NÚMERO CREDIT vazio ou "GINFO" (o GInfo às vezes exporta assim) não vira erro — sintetiza uma chave estável a partir do resto da linha', () => {
    const matriz = [
      HEADER,
      ['', 'CDD DIADEMA', '01/01/2026', 'FAI', 'NOT SIF', 'Fulano', '', '', 'Ocorrência A'],
      ['GINFO', 'CDD DIADEMA', '02/01/2026', 'FAI', 'NOT SIF', 'Ciclano', '', '', 'Ocorrência B'],
    ]
    const { linhas, erros } = parseAcidentesSegurancaMatriz(matriz, unidades)
    expect(erros).toEqual([])
    expect(linhas).toHaveLength(2)
    expect(linhas[0].numero_credit).toBeLessThan(0) // negativo — nunca colide com um NÚMERO CREDIT real (sempre positivo)
    expect(linhas[1].numero_credit).toBeLessThan(0)
    expect(linhas[0].numero_credit).not.toBe(linhas[1].numero_credit) // linhas diferentes -> chaves diferentes
  })

  it('a chave sintética é determinística — reimportar a mesma linha gera o mesmo numero_credit (upsert não duplica)', () => {
    const linha = ['', 'CDD DIADEMA', '01/01/2026', 'FAI', 'NOT SIF', 'Fulano', '', '', 'Ocorrência A']
    const r1 = parseAcidentesSegurancaMatriz([HEADER, linha], unidades).linhas[0]
    const r2 = parseAcidentesSegurancaMatriz([HEADER, linha], unidades).linhas[0]
    expect(r1.numero_credit).toBe(r2.numero_credit)
  })

  it('linhas com o mesmo NÚMERO CREDIT (o GInfo às vezes repete a mesma linha na exportação) saem deduplicadas, senão o upsert quebra no Postgres', () => {
    const matriz = [
      HEADER,
      [123, 'CDD DIADEMA', '15/10/2026', 'FAI', 'NOT SIF', 'Fulano', '', '', 'Ocorrência'],
      [123, 'CDD DIADEMA', '15/10/2026', 'FAI', 'NOT SIF', 'Fulano', '', '', 'Ocorrência'],
      [456, 'CDD DIADEMA', '16/10/2026', 'FAI', 'NOT SIF', 'Ciclano', '', '', 'Outra ocorrência'],
    ]
    const { linhas } = parseAcidentesSegurancaMatriz(matriz, unidades)
    expect(linhas).toHaveLength(2)
    expect(linhas.map(l => l.numero_credit)).toEqual([123, 456])
  })

  it('pula linhas totalmente vazias', () => {
    const matriz = [HEADER, ['', '', '', '', '', '', '', '', ''], [1, 'CDD DIADEMA', '01/01/2026', 'FAI', 'NOT SIF', '', '', '', '']]
    const { linhas } = parseAcidentesSegurancaMatriz(matriz, unidades)
    expect(linhas).toHaveLength(1)
  })

  it('cabeçalho sem as colunas mínimas vira erro geral', () => {
    const { linhas, erros } = parseAcidentesSegurancaMatriz([['A', 'B']], unidades)
    expect(linhas).toEqual([])
    expect(erros).toHaveLength(1)
  })

  it('retorna vazio pra matriz vazia', () => {
    expect(parseAcidentesSegurancaMatriz([], unidades)).toEqual({ linhas: [], erros: [], unidadesNaoReconhecidas: [] })
  })
})
