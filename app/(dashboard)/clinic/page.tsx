"use client"

import { ClinicTab } from "@/components/settings/clinic-tab"
import { PageHeader } from "@/components/page-header"

export default function ClinicPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Mi Clínica" />
      <ClinicTab />
    </div>
  )
}
