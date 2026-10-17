import { ServicesManager } from "@/components/dashboard/services/services-manager"
import { PageHeader } from "@/components/page-header"

export default function ServicesPage() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Tratamientos" 
        description="Consulta los tratamientos y sus duraciones de referencia para la agenda." 
      />
      <ServicesManager />
    </div>
  )
}
