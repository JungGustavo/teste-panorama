import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, ListChecks, MonitorPlay } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toaster } from '@/components/ui/toaster'
import { ResumoExecutivoGerentesTab } from '@/components/financeira/ResumoExecutivoGerentesTab'
import { RelatosSegurancaImportacaoTab } from '@/components/financeira/RelatosSegurancaImportacaoTab'
import { AcidentesSegurancaImportacaoTab } from '@/components/financeira/AcidentesSegurancaImportacaoTab'

/** Subpágina SDG Gerentes — /sdg/gerentes. Gestão de conteúdo do SDG dos Gerentes (apresentação em `/sdg-gerentes`): Resumo Executivo + Importação dos Relatos e dos Acidentes de Segurança (os dois somam na mesma Pirâmide de Segurança, só admin). */
export function SdgGerentesGestaoPage() {
  const { role } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/sdg" className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ChevronLeft className="h-4 w-4" />
            SDG
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <h2 className="text-base font-semibold text-foreground">SDG Gerentes</h2>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" asChild>
            <a href="/area-financeira/plano-de-acao" target="_blank" rel="noopener noreferrer">
              <ListChecks className="h-4 w-4" />
              Plano de Ação
            </a>
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate('/sdg-gerentes')}>
            <MonitorPlay className="h-4 w-4" />
            Entrar em modo apresentação
          </Button>
        </div>
      </div>

      <Tabs defaultValue="resumo-executivo">
        <TabsList>
          <TabsTrigger value="resumo-executivo">Resumo Executivo</TabsTrigger>
          {role === 'admin' && <TabsTrigger value="importacao">Importação — Relatos de Segurança</TabsTrigger>}
          {role === 'admin' && <TabsTrigger value="importacao-acidentes">Importação — Acidentes</TabsTrigger>}
        </TabsList>

        <TabsContent value="resumo-executivo" className="pt-4">
          <ResumoExecutivoGerentesTab />
        </TabsContent>

        {role === 'admin' && (
          <TabsContent value="importacao" className="pt-4">
            <RelatosSegurancaImportacaoTab />
          </TabsContent>
        )}

        {role === 'admin' && (
          <TabsContent value="importacao-acidentes" className="pt-4">
            <AcidentesSegurancaImportacaoTab />
          </TabsContent>
        )}
      </Tabs>

      <Toaster />
    </div>
  )
}
