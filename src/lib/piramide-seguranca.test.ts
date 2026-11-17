import { describe, expect, it } from 'vitest'
import { acidenteParaRelato, agruparPorClassificacao, agruparPorMes, contarSif, eventosGraves, ordenarPorSeveridade } from './piramide-seguranca'
import type { AcidenteSeguranca, RelatoSeguranca } from '@/types'

function acidente(over: Partial<AcidenteSeguranca>): AcidenteSeguranca {
  return {
    numero_credit: 1, unidade: 'ARACAJU', data_ocorrencia: '2026-08-01', ano: 2026, mes: 8, tipo: 'FAI',
    sif: false, sif_tipo: null, colaborador: null, funcao: null, ato: null, ocorrencia: null, ...over,
  }
}

function relato(over: Partial<RelatoSeguranca>): RelatoSeguranca {
  return {
    relato_id: 1, unidade: 'ARACAJU', data_ocorrencia: '2026-08-01', ano: 2026, mes: 8, classificacao: 'INCIDENTE',
    sif: false, sif_tipo: null, tipo_relato: null, detalhamento: null, ...over,
  }
}

describe('agruparPorClassificacao', () => {
  it('conta total e SIF válido (SIF PERCUSOR/SIF POTENCIAL) por classificação, ordenado do menos pro mais frequente', () => {
    const relatos = [
      ...Array.from({ length: 4 }, () => relato({ classificacao: 'ABORDAGEM POSITIVA' })),
      relato({ classificacao: 'INCIDENTE', sif: true, sif_tipo: 'SIF PERCUSOR' }),
      relato({ classificacao: 'INCIDENTE', sif: true, sif_tipo: 'SIF POTENCIAL' }),
      relato({ classificacao: 'FATAL' }),
    ]
    expect(agruparPorClassificacao(relatos)).toEqual([
      { classificacao: 'FATAL', total: 1, sif: 0 },
      { classificacao: 'INCIDENTE', total: 2, sif: 2 },
      { classificacao: 'ABORDAGEM POSITIVA', total: 4, sif: 0 },
    ])
  })

  it('sif_tipo fora de SIF PERCUSOR/SIF POTENCIAL não conta como SIF', () => {
    const relatos = [relato({ classificacao: 'INCIDENTE', sif: true, sif_tipo: 'SIF OUTRO TIPO' })]
    expect(agruparPorClassificacao(relatos)).toEqual([{ classificacao: 'INCIDENTE', total: 1, sif: 0 }])
  })

  it('lista vazia devolve pirâmide vazia', () => {
    expect(agruparPorClassificacao([])).toEqual([])
  })

  it('não depende de uma lista fixa de classificações — qualquer valor vindo dos dados vira uma fileira', () => {
    const resultado = agruparPorClassificacao([relato({ classificacao: 'CLASSIFICAÇÃO NUNCA VISTA ANTES' })])
    expect(resultado).toEqual([{ classificacao: 'CLASSIFICAÇÃO NUNCA VISTA ANTES', total: 1, sif: 0 }])
  })
})

describe('ordenarPorSeveridade', () => {
  it('sempre devolve as 9 fileiras padrão, na ordem de severidade — mesmo sem nenhum relato numa classificação (ex: Fatal zerado)', () => {
    const camadas = [
      { classificacao: 'ABORDAGEM POSITIVA', total: 100, sif: 0 },
      { classificacao: 'ATO INSEGURO', total: 20, sif: 0 },
      { classificacao: 'INCIDENTE', total: 10, sif: 2 },
    ]
    const resultado = ordenarPorSeveridade(camadas)
    expect(resultado.map(c => c.classificacao)).toEqual([
      'FATAL', 'LTI', 'MDI', 'MTI', 'FAI', 'INCIDENTE', 'ATO INSEGURO', 'CONDIÇÃO INSEGURA', 'ABORDAGEM POSITIVA',
    ])
    expect(resultado.find(c => c.classificacao === 'FATAL')).toEqual({ classificacao: 'FATAL', total: 0, sif: 0 })
    expect(resultado.find(c => c.classificacao === 'CONDIÇÃO INSEGURA')).toEqual({ classificacao: 'CONDIÇÃO INSEGURA', total: 0, sif: 0 })
    expect(resultado.find(c => c.classificacao === 'INCIDENTE')).toEqual({ classificacao: 'INCIDENTE', total: 10, sif: 2 })
  })

  it('classificação fora das 9 padrão não some — entra depois delas, mais frequente primeiro entre si', () => {
    const camadas = [
      { classificacao: 'CATEGORIA NOVA A', total: 3, sif: 0 },
      { classificacao: 'CATEGORIA NOVA B', total: 8, sif: 0 },
    ]
    const resultado = ordenarPorSeveridade(camadas)
    expect(resultado).toHaveLength(9 + 2)
    expect(resultado.slice(9).map(c => c.classificacao)).toEqual(['CATEGORIA NOVA B', 'CATEGORIA NOVA A'])
  })
})

describe('agruparPorMes', () => {
  it('quebra os relatos por mês, contando por classificação e o total do mês', () => {
    const relatos = [
      relato({ mes: 1, classificacao: 'INCIDENTE' }),
      relato({ mes: 1, classificacao: 'INCIDENTE' }),
      relato({ mes: 1, classificacao: 'ATO INSEGURO' }),
      relato({ mes: 2, classificacao: 'INCIDENTE' }),
    ]
    const porMes = agruparPorMes(relatos, 1, 3)
    expect(porMes).toHaveLength(3) // Jan, Fev, Mar — mesmo sem nenhum relato em Mar
    expect(porMes[0]).toEqual({ mes: 1, porClassificacao: new Map([['INCIDENTE', 2], ['ATO INSEGURO', 1]]), total: 3 })
    expect(porMes[1]).toEqual({ mes: 2, porClassificacao: new Map([['INCIDENTE', 1]]), total: 1 })
    expect(porMes[2]).toEqual({ mes: 3, porClassificacao: new Map(), total: 0 })
  })
})

describe('eventosGraves', () => {
  it('FATAL sempre entra, mesmo sem nenhuma marcação SIF', () => {
    const relatos = [relato({ mes: 8, classificacao: 'FATAL', sif: false, sif_tipo: null })]
    expect(eventosGraves(relatos, 8)).toHaveLength(1)
  })

  it('Incidente/LTI/MDI/FAI/MTI só entram quando também são SIF válido (SIF PERCUSOR ou SIF POTENCIAL)', () => {
    const relatos = [
      relato({ relato_id: 1, mes: 8, classificacao: 'INCIDENTE', sif: true, sif_tipo: 'SIF PERCUSOR' }),
      relato({ relato_id: 2, mes: 8, classificacao: 'LTI', sif: true, sif_tipo: 'SIF POTENCIAL' }),
      relato({ relato_id: 3, mes: 8, classificacao: 'MDI', sif: false, sif_tipo: null }), // sem SIF — não entra
      relato({ relato_id: 4, mes: 8, classificacao: 'FAI', sif: true, sif_tipo: 'SIF OUTRO TIPO' }), // SIF, mas não PERCUSOR/POTENCIAL — não entra
    ]
    expect(eventosGraves(relatos, 8).map(r => r.relato_id)).toEqual([1, 2])
  })

  it('ordena por data, mais recente primeiro, só do mês pedido', () => {
    const relatos = [
      relato({ relato_id: 1, mes: 8, data_ocorrencia: '2026-08-01', classificacao: 'FATAL' }),
      relato({ relato_id: 2, mes: 8, data_ocorrencia: '2026-08-15', classificacao: 'FATAL' }),
      relato({ relato_id: 5, mes: 7, data_ocorrencia: '2026-07-20', classificacao: 'FATAL' }), // mês errado — não entra
    ]
    const resultado = eventosGraves(relatos, 8)
    expect(resultado.map(r => r.relato_id)).toEqual([2, 1])
  })

  it('SIF fora das classificações válidas (ex: Abordagem Positiva) não entra, mesmo SIF Percusor/Potencial', () => {
    const relatos = [relato({ mes: 8, classificacao: 'ABORDAGEM POSITIVA', sif: true, sif_tipo: 'SIF PERCUSOR' })]
    expect(eventosGraves(relatos, 8)).toEqual([])
  })

  it('MTI com SIF Potencial entra', () => {
    const relatos = [relato({ relato_id: 9, mes: 8, classificacao: 'MTI', sif: true, sif_tipo: 'SIF POTENCIAL' })]
    expect(eventosGraves(relatos, 8).map(r => r.relato_id)).toEqual([9])
  })

  it('sem nenhum evento grave/SIF válido no mês, devolve lista vazia', () => {
    expect(eventosGraves([relato({ mes: 8, classificacao: 'INCIDENTE' })], 8)).toEqual([])
  })
})

describe('contarSif', () => {
  it('conta SIF válido (SIF PERCUSOR/SIF POTENCIAL) em qualquer classificação (diferente da tabela, que restringe) — usado nos cards', () => {
    const relatos = [
      relato({ classificacao: 'FATAL', sif: true, sif_tipo: 'SIF PERCUSOR' }),
      relato({ classificacao: 'INCIDENTE', sif: true, sif_tipo: 'SIF POTENCIAL' }),
      relato({ classificacao: 'ABORDAGEM POSITIVA', sif: true, sif_tipo: 'SIF PERCUSOR' }), // conta nos cards (não restringe classificação)
      relato({ classificacao: 'ATO INSEGURO', sif: true, sif_tipo: 'SIF POTENCIAL' }), // conta nos cards (não restringe classificação)
      relato({ classificacao: 'MTI', sif: false, sif_tipo: null }), // não é SIF — não conta
      relato({ classificacao: 'LTI', sif: true, sif_tipo: 'SIF OUTRO TIPO' }), // SIF, mas não PERCUSOR/POTENCIAL — não conta
    ]
    expect(contarSif(relatos)).toBe(4)
  })

  it('lista vazia conta zero', () => {
    expect(contarSif([])).toBe(0)
  })

  it('SIF PRECURSOR (grafia do relatório ACIDENTES) conta igual SIF PERCUSOR', () => {
    expect(contarSif([relato({ classificacao: 'FAI', sif: true, sif_tipo: 'SIF PRECURSOR' })])).toBe(1)
  })
})

describe('acidenteParaRelato', () => {
  it('converte pro formato de RelatoSeguranca, com origem "acidente"', () => {
    const a = acidente({ numero_credit: 3575404118, unidade: 'DIADEMA', tipo: 'FAI', ocorrencia: 'Descrição livre' })
    expect(acidenteParaRelato(a)).toMatchObject({
      relato_id: 3575404118, unidade: 'DIADEMA', classificacao: 'FAI', detalhamento: 'Descrição livre', origem: 'acidente',
    })
  })

  it('"INCIDENTES" (plural, como vem do relatório) normaliza pra "INCIDENTE" — soma na mesma fileira do relatório RELATOS', () => {
    expect(acidenteParaRelato(acidente({ tipo: 'INCIDENTES' })).classificacao).toBe('INCIDENTE')
  })

  it('"LTI FATL"/"LDI FATL" (as duas grafias) normaliza pra "FATAL"', () => {
    expect(acidenteParaRelato(acidente({ tipo: 'LTI FATL' })).classificacao).toBe('FATAL')
    expect(acidenteParaRelato(acidente({ tipo: 'LDI FATL' })).classificacao).toBe('FATAL')
  })

  it('FAI/LTI/MTI/MDI já batem direto com a classificação padrão, sem precisar traduzir', () => {
    expect(acidenteParaRelato(acidente({ tipo: 'FAI' })).classificacao).toBe('FAI')
    expect(acidenteParaRelato(acidente({ tipo: 'LTI' })).classificacao).toBe('LTI')
    expect(acidenteParaRelato(acidente({ tipo: 'MTI' })).classificacao).toBe('MTI')
    expect(acidenteParaRelato(acidente({ tipo: 'MDI' })).classificacao).toBe('MDI')
  })
})

describe('eventosGraves — linhas de origem "acidente" (relatório ACIDENTES)', () => {
  it('Incidente só entra com SIF Potencial — SIF Precursor não conta pra isso (só pro card de SIF)', () => {
    const relatos = [
      acidenteParaRelato(acidente({ numero_credit: 1, mes: 8, tipo: 'INCIDENTES', sif: true, sif_tipo: 'SIF POTENCIAL' })),
      acidenteParaRelato(acidente({ numero_credit: 2, mes: 8, tipo: 'INCIDENTES', sif: true, sif_tipo: 'SIF PRECURSOR' })),
      acidenteParaRelato(acidente({ numero_credit: 3, mes: 8, tipo: 'INCIDENTES', sif: false, sif_tipo: null })),
    ]
    expect(eventosGraves(relatos, 8).map(r => r.relato_id)).toEqual([1])
  })

  it('FAI, MTI, MDI e LTI entram sempre, mesmo sem nenhum SIF', () => {
    const relatos = ['FAI', 'MTI', 'MDI', 'LTI'].map((tipo, i) =>
      acidenteParaRelato(acidente({ numero_credit: i + 1, mes: 8, tipo, sif: false, sif_tipo: null })),
    )
    expect(eventosGraves(relatos, 8)).toHaveLength(4)
  })

  it('LTI FATL (vira FATAL) entra sempre, mesmo sem SIF', () => {
    const relatos = [acidenteParaRelato(acidente({ numero_credit: 1, mes: 8, tipo: 'LTI FATL', sif: false, sif_tipo: null }))]
    expect(eventosGraves(relatos, 8)).toHaveLength(1)
  })

  it('uma linha de ACIDENTES e uma de RELATOS no mesmo mês seguem cada uma a própria regra', () => {
    const relatos: RelatoSeguranca[] = [
      relato({ relato_id: 10, mes: 8, classificacao: 'INCIDENTE', sif: false, sif_tipo: null }), // RELATOS: Incidente sem SIF não entra
      acidenteParaRelato(acidente({ numero_credit: 20, mes: 8, tipo: 'MTI', sif: false, sif_tipo: null })), // ACIDENTES: MTI entra sempre
    ]
    expect(eventosGraves(relatos, 8).map(r => r.relato_id)).toEqual([20])
  })
})
