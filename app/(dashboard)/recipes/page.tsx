"use client"

import { PageHeader } from "@/components/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { IssuedPrescriptionsList } from "@/components/issued-prescriptions-list"
import { RecipesTab } from "@/components/settings/recipes-tab"
import { FileText, BookmarkCheck } from "lucide-react"

export default function RecipesPage() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Recetas Médicas" 
        description="Gestión integral de prescripciones farmacológicas emitidas y plantillas odontológicas."
      />

      <Tabs defaultValue="history" className="space-y-4">
        <TabsList className="bg-muted/60 p-1 border">
          <TabsTrigger value="history" className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Historial de Recetas Emitidas
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <BookmarkCheck className="h-4 w-4 text-primary" />
            Plantillas de Recetas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="space-y-4">
          <IssuedPrescriptionsList />
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <RecipesTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
