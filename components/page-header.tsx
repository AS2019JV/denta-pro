"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  description?: string
  children?: ReactNode
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-montserrat">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

interface PageContentProps {
  children: ReactNode
  className?: string
  pt?: string
}

export function PageContent({ children, className, pt = "py-6" }: PageContentProps) {
  return <div className={cn(`${pt} space-y-6`, className)}>{children}</div>
}
