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
      <Card className="border-none shadow-md hover:shadow-xl transition-all h-full overflow-hidden">
        <div className={`h-2 w-full bg-gradient-to-r ${color}`}></div>
        <CardContent className="p-8">
          <div
            className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}
          >
            {icon}
          </div>
          <h3 className="text-xl font-bold mb-3 font-title">{title}</h3>
          <p className="text-gray-600 mb-6 font-text">{description}</p>
          <ul className="space-y-2">
            {benefits.map((benefit, i) => (
              <li key={i} className="flex items-center font-text">
                <CheckCircle className="h-5 w-5 text-tertiary mr-2 flex-shrink-0" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </motion.div>
  )
}

