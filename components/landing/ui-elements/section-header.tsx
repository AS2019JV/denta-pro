"use client"

import type React from "react"

import { motion } from "framer-motion"

interface SectionHeaderProps {
  badge: string
  title: React.ReactNode
  description?: string
  center?: boolean
  className?: string
}

export function SectionHeader({ badge, title, description, center = true, className = "" }: SectionHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className={`mb-16 ${center ? "text-center mx-auto" : ""} max-w-3xl ${className}`}
    >
      <div className="inline-flex items-center rounded-full bg-primary/10 px-4 py-1 text-sm text-primary mb-4 font-subtitle">
        <span className="mr-2 h-2 w-2 rounded-full bg-primary"></span>
        {badge}
      </div>
      <h2 className="text-3xl font-bold tracking-tighter md:text-4xl/tight lg:text-5xl mb-4 font-title">{title}</h2>
      {description && <p className="text-gray-500 md:text-xl/relaxed font-text">{description}</p>}
    </motion.div>
  )
}

