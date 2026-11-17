import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { AcidenteSeguranca } from '@/types'

/**
 * Acidentes de segurança de uma unidade no ANO inteiro (segundo relatório
 * do GInfo, além de `relatos_seguranca` — ver `useRelatosSeguranca.ts`),
 * migration 134. Mesmo padrão: busca o ano inteiro, quem consome filtra por
 * mês.
 */
export function useAcidentesSeguranca(unidade: string, ano: number | null) {
  const [acidentes, setAcidentes] = useState<AcidenteSeguranca[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!unidade || ano === null) { setAcidentes([]); setLoading(false); return }
    let ativo = true
    setLoading(true)
    supabase
      .from('acidentes_seguranca')
      .select('*')
      .eq('unidade', unidade)
      .eq('ano', ano)
      .then(({ data }) => {
        if (!ativo) return
        setAcidentes((data as AcidenteSeguranca[]) ?? [])
        setLoading(false)
      })
    return () => { ativo = false }
  }, [unidade, ano])

  return { acidentes, loading }
}
