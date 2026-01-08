import { ServicesManager } from "@/components/dashboard/services/services-manager"
import { PageHeader } from "@/components/page-header"

export default function ServicesPage() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="Tratamientos y Precios" 
        description="Gestiona el catálogo de servicios, precios y duraciones para tu agenda." 
      />
      <ServicesManager />
    </div>
  )
}
