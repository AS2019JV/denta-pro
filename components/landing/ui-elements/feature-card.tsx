"use client"

import type React from "react"

import { motion } from "framer-motion"
import { CheckCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface FeatureCardProps {
  icon: React.ReactNode
  title: string
  description: string
  benefits: string[]
  color: string
  index: number
}

export function FeatureCard({ icon, title, description, benefits, color, index }: FeatureCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="group"
    >
      <Card className="border border-slate-200/60 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.1)] hover:-translate-y-1 transition-all duration-500 h-full overflow-hidden bg-white group-hover:border-slate-300/80">
        <CardContent className="p-8">
          <div
            className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-6 shadow-md transform group-hover:scale-105 transition-transform duration-500`}
          >
            {icon}
          </div>
          <h3 className="text-xl font-bold mb-3 font-title text-slate-900 tracking-tight">{title}</h3>
          <p className="text-slate-500 mb-6 font-text leading-relaxed text-[15px]">{description}</p>
          <ul className="space-y-3">
            {benefits.map((benefit, i) => (
              <li key={i} className="flex items-start font-text text-[14px] text-slate-600">
                <CheckCircle className="h-4 w-4 text-teal-600 mr-2.5 flex-shrink-0 mt-1" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </motion.div>
  )
}

