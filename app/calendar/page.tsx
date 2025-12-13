

"use client"

import { useSearchParams } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { ModernCalendar } from "@/components/calendar/modern-calendar"

export default function CalendarPage() {
  const searchParams = useSearchParams()
  const initialViewParam = searchParams.get('view')
  // Validate view param to match allowed types
  const initialView: "month" | "week" | "today" = 
    (initialViewParam === 'month' || initialViewParam === 'week' || initialViewParam === 'today') 
    ? initialViewParam 
    : 'month'
  
  return (
    <div className="space-y-6">
      <PageHeader title="Calendario" />
      <ModernCalendar 
        initialView={initialView}
      />
    </div>
  )
}
