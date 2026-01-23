"use client"

import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"

interface TestimonialCardProps {
  name: string
  role: string
  quote: string
  image: string
  index: number
}

export function TestimonialCard({ name, role, quote, image, index }: TestimonialCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
    >
      <Card className="border-none shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 h-full overflow-hidden group bg-white">
        <div className="h-1.5 w-full bg-gradient-to-r from-primary to-teal-400"></div>
        <CardContent className="p-8">
          <div className="flex items-center gap-4 mb-6">
            <img
              src={image || "/placeholder.svg"}
              alt={name}
              className="rounded-full h-14 w-14 object-cover ring-4 ring-slate-50 group-hover:ring-teal-100 transition-all"
            />
            <div>
              <h4 className="font-bold font-title text-slate-900">{name}</h4>
              <p className="text-teal-600 text-sm font-subtitle font-medium">{role}</p>
            </div>
          </div>
          <div className="relative mb-6">
            <div className="absolute -top-2 -left-2 text-5xl text-teal-100 font-serif leading-none select-none">"</div>
            <p className="text-gray-600 italic relative z-10 font-text leading-relaxed pl-2">{quote}</p>
          </div>
          <div className="flex text-amber-400 gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <svg
                key={star}
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
              </svg>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

