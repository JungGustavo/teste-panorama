import { Link } from 'react-router-dom'
import { ChevronLeft, FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toaster } from '@/components/ui/toaster'
import { useAuth } from '@/context/AuthContext'
import { useUnidades } from '@/hooks/useUnidades'
import { useEncontroContas, useEncontroContasMotivos } from '@/hooks/useEncontroContas'
import { DashboardEcTab } from '@/components/financeira/encontro-contas/DashboardEcTab'
import { TratativasTab } from '@/components/financeira/encontro-contas/TratativasTab'
import { HistoricoEcTab } from '@/components/financeira/encontro-contas/HistoricoEcTab'
import { ImportacaoEcTab } from '@/components/financeira/encontro-contas/ImportacaoEcTab'

const LINK_DRIVE_EVIDENCIAS = 'https://drive.google.com/drive/folders/1m9dI4IIpFP1iFBtL8zhqG7mHLdWlF37g'

/**
 * Encontro de Contas — /area-financeira/encontro-de-contas. Controle dos
 * descontos (ECs) que a Ambev lança via chamado: importação da planilha,
 * tratativa por unidade, validação do financeiro (mesmo fluxo do Plano de
 * Ação — ver `src/lib/encontro-contas.ts`) e dashboard gerencial. O botão
 * "Evidências" abre, numa aba nova, a pasta do Drive onde ficam os
 * comprovantes dos descontos (fora do app, mantida à mão por fora).
 */
export function EncontroDeContasPage() {
  const { role } = useAuth()
  const isAdmin = role === 'admin'
  const { unidades } = useUnidades()
  const { ecs, loading, recarregar } = useEncontroContas()
  const { motivos, recarregar: recarregarMotivos } = useEncontroContasMotivos()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/area-financeira"
            className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Área Financeira
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <h2 className="text-base font-semibold text-foreground">Encontro de Contas</h2>
        </div>
        <Button variant="outline" size="sm" asChild className="gap-2">
          <a href={LINK_DRIVE_EVIDENCIAS} target="_blank" rel="noopener noreferrer">
            <FolderOpen className="h-4 w-4" />
            Evidências (Drive)
          </a>
        </Button>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="tratativas">Tratativas</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          {isAdmin && <TabsTrigger value="importacao">Importação</TabsTrigger>}
        </TabsList>

        <TabsContent value="dashboard" className="pt-4">
          <DashboardEcTab ecs={ecs} unidades={unidades} loading={loading} />
        </TabsContent>

        <TabsContent value="tratativas" className="pt-4">
          <TratativasTab
            ecs={ecs} unidades={unidades} motivos={motivos} isAdmin={isAdmin}
            loading={loading} onAtualizado={recarregar} onMotivosAtualizados={recarregarMotivos}
          />
        </TabsContent>

        <TabsContent value="historico" className="pt-4">
          <HistoricoEcTab ecs={ecs} unidades={unidades} motivos={motivos} loading={loading} />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="importacao" className="pt-4">
            <ImportacaoEcTab
              ecsExistentes={ecs} unidades={unidades} motivos={motivos} isAdmin={isAdmin}
              onImportado={recarregar} onMotivosAtualizados={recarregarMotivos}
            />
          </TabsContent>
        )}
      </Tabs>

      <Toaster />
    </div>
  )
}
