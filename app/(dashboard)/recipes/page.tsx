"use client"

import { RecipesTab } from "@/components/settings/recipes-tab"
import { PageHeader } from "@/components/page-header"

export default function RecipesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Recetas Médicas" />
      <RecipesTab />
    </div>
  )
}
