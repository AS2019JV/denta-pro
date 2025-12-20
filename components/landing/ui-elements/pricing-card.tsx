"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowRight, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface PricingCardProps {
  name: string
  price: string
  description: string
  features: string[]
  cta: string
  popular: boolean
  color: string
  link: string
  index: number
}

export function PricingCard({
  name,
  price,
  description,
  features,
  cta,
  popular,
  color,
  link,
  index,
}: PricingCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: popular ? 0.95 : 0.9 }}
      whileInView={{ opacity: 1, y: 0, scale: popular ? 1.05 : 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className={`${popular ? "z-10" : ""}`}
    >
      <Card
        className={`border-none h-full ${
          popular ? "shadow-xl bg-white" : "shadow-md hover:shadow-xl bg-white"
        } transition-all rounded-xl overflow-hidden group`}
      >
        <div className={`h-2 w-full bg-gradient-to-r ${color}`}></div>
        <CardContent className="p-8">
          {popular && (
            <div className="absolute top-0 right-0 bg-tertiary text-primary px-4 py-1 text-sm font-medium font-subtitle">
              MÁS POPULAR
            </div>
          )}
          <h3 className="text-xl font-bold mb-2 font-title">{name}</h3>
          <div className="flex items-baseline gap-1 mb-4">
            <span className="text-4xl font-bold font-title">{price}</span>
            <span className="text-gray-500 font-subtitle">/mes</span>
          </div>
          <p className="text-gray-500 mb-6 font-text">{description}</p>
          <ul className="space-y-3 mb-8">
            {features.map((feature, i) => (
              <li key={i} className="flex items-center font-text">
                <CheckCircle className="h-5 w-5 text-tertiary mr-3 flex-shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <Button
            className={`w-full bg-gradient-to-r ${color} text-white group-hover:shadow-md transition-all font-subtitle`}
            asChild
          >
            <Link href={link}>
              {cta}
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  )
}

