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
        className={`h-full transition-all duration-500 rounded-2xl overflow-hidden group relative flex flex-col ${
          popular 
            ? "shadow-2xl bg-white border border-teal-500/30 ring-1 ring-teal-500/20 z-10 scale-[1.02]" 
            : "shadow-sm hover:shadow-xl hover:-translate-y-1 bg-white border border-slate-200/60"
        }`}
      >
        <CardContent className="p-8 flex flex-col h-full relative">
          {popular && (
            <div className="absolute top-0 right-0 bg-teal-600/90 backdrop-blur text-white px-4 py-1.5 text-[10px] font-bold tracking-widest uppercase rounded-bl-xl shadow-sm">
              Más Popular
            </div>
          )}
          <h3 className="text-xl font-bold mb-2 font-title text-slate-900 tracking-tight">{name}</h3>
          <div className="flex items-baseline gap-1 mb-4">
            <span className="text-4xl font-bold font-title text-slate-900 tracking-tighter">{price}</span>
            <span className="text-slate-500 font-subtitle text-sm font-medium">/mes</span>
          </div>
          <p className="text-slate-500 mb-8 font-text leading-relaxed text-[15px]">{description}</p>
          <ul className="space-y-4 mb-8 flex-grow">
            {features.map((feature, i) => (
              <li key={i} className="flex items-start font-text text-[14px] text-slate-700">
                <CheckCircle className={`h-4 w-4 mr-3 flex-shrink-0 ${popular ? 'text-teal-600' : 'text-slate-400'}`} />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <Button
            className={`w-full h-11 text-[15px] font-medium transition-all duration-300 hover:scale-[1.02] active:scale-95 font-subtitle rounded-full group ${popular ? 'bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white shadow-lg shadow-teal-500/20' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-900 hover:text-white hover:border-slate-900 shadow-sm hover:shadow-lg'}`}
            asChild
          >
            <Link href={link}>
              {cta}
              <ArrowRight className={`ml-2 h-4 w-4 transition-all duration-300 group-hover:translate-x-1 ${popular ? 'text-teal-50/70 group-hover:text-white' : 'text-slate-400 group-hover:text-white'}`} />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  )
}

